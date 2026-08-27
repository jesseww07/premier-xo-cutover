/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * Tax Rate Lookup v2 — hybrid engine / published-rate-table lookup
 *
 * Routing:
 *   1. Nexus states + ZIP        -> SuiteTax engine (non-posting Estimate, unchanged from v1)
 *   2. Non-nexus states, or any  -> STE's own rate-table files in the File Cabinet
 *      lookup without a ZIP         (zips/*.js -> taxgroups/US.js -> taxcodes/US.js)
 *   3. Engine returns empty      -> falls through to the rate tables instead of erroring
 *
 * The rate-table files are the same AMD data modules the SuiteTax engine itself
 * loads, so they stay current automatically as tax content updates install.
 *
 * No-address workflow (new construction): city+state, or county+state, resolves
 * a state/county/city stack directly from taxcodes/US.js — no ZIP required.
 * The tool always returns SOMETHING (worst case: state-level rate + guidance).
 *
 * Response shape is backward compatible with v1 (status, combined_rate, data[]),
 * plus: source ('engine'|'tables'), resolution, notes[] (plain-language strings).
 *
 * ---------------------------------------------------------------------------
 * v2.1 (2026-08-14) — engine-path fixes. Symptom: every AZ ZIP returned
 * 9.100% (Phoenix 85085) regardless of the ZIP typed; Mesa 85210 should be
 * 8.300%. Three causes, all in engineLookup():
 *   1. The hard-coded environment ID sets were INVERTED. Production used
 *      customer 38166 / item 1644664 — a real customer (billing address in
 *      Phoenix) and a real inventory item. The actual dummies are 15611 /
 *      1648722. IDs are now resolved BY NAME via SuiteQL (cached), so the
 *      same file is correct in production and sandbox.
 *   2. The ship-to was written with body fields (shipaddr1/shipcity/shipzip).
 *      Those do not stick on save — the estimate kept the customer's own
 *      address, so SuiteTax priced that address. Now written through the
 *      `shippingaddress` subrecord.
 *   3. No verification. The saved estimate's ship ZIP is now compared to the
 *      requested ZIP; a mismatch falls through to the rate tables instead of
 *      silently returning a confident wrong answer.
 * Also: engine rows were labeled from `taxtype` ("US city sales tax"). They
 * are now labeled from `taxcode` ("City sales tax for Mesa, Maricopa County,
 * Arizona") to match the table path, and zero-rate "Not liable" rows are
 * dropped. Cache key bumped to v3 so stale 9.1% answers do not survive deploy.
 *
 * v2.2 (2026-08-14) — ORIGIN SOURCING. The 9.100%-for-every-AZ-ZIP result was
 * not a bug: Arizona sources local TPT to the SELLER's location, so the city
 * portion follows our Location, not the ship-to. Verified against every AZ
 * sales order since 2026-06 — Broadway (Phoenix) orders tax Phoenix even when
 * shipped to Peoria/Gilbert/Glendale; SDL-SR and Phoenix Retail (Scottsdale)
 * tax Scottsdale; TUC-SR/TUC-WH tax Tucson. The ship-to city never drives it.
 *   - The estimate is now stamped with a Location: the logged-in user's own
 *     (runtime.getCurrentUser().location), falling back to Broadway/Phoenix,
 *     so the engine quotes from where the user actually sells.
 *   - When the engine and the published tables disagree, the ADDRESS rate is
 *     displayed (that is what the tool is asked for) and a warning names the
 *     rate SuiteTax will really charge and why. No hard-coded list of
 *     origin-sourced states — divergence between the two paths is the signal.
 *   - Successful lookups now emit one audit log line, and &debug=T returns the
 *     applied ship address, origin location, both rate sets and the resolved
 *     dummy IDs (never cached, in either direction).
 * ---------------------------------------------------------------------------
 */
define(['N/record', 'N/file', 'N/cache', 'N/query', 'N/log', 'N/runtime'],
    (record, file, cache, query, log, runtime) => {

    // -----------------------------------------------------------------------
    // CONFIGURATION
    // -----------------------------------------------------------------------
    // NOTE: SuiteScript APIs (incl. N/runtime) may not be called while the
    // define callback evaluates — environment is resolved lazily per request.
    //
    // The engine path saves a throwaway Estimate, so the customer and item it
    // uses MUST be the dedicated dummies. Hard-coded per-environment ID sets
    // were the v2 bug (they were inverted, pointing production at a real
    // customer whose own address was priced for every lookup). Resolve them by
    // NAME instead — one cached query, correct in production and sandbox, and
    // it survives a sandbox refresh renumbering.
    const DUMMY_NAME = 'Tax Lookup';   // customer entityid AND item itemid

    // Last-resort IDs if the name lookup fails (verified in production,
    // 2026-08-14). Never point these at a real customer or a stock item.
    const ENV_FALLBACK = { CUSTOMER_ID: 15611, ITEM_ID: 1648722, SUBSIDIARY: 2 };

    let _env = null;
    const getEnv = () => {
        if (_env) return _env;

        const c = getCache();
        const hit = c.get({ key: 'engine_env' });
        if (hit) { try { _env = JSON.parse(hit); return _env; } catch (e) { /* re-resolve */ } }

        const env = { CUSTOMER_ID: null, ITEM_ID: null, SUBSIDIARY: null, resolvedBy: 'name' };
        try {
            const cust = query.runSuiteQL({
                query: 'SELECT id, subsidiary FROM customer ' +
                       "WHERE UPPER(entityid) = ? AND (isinactive IS NULL OR isinactive = 'F')",
                params: [DUMMY_NAME.toUpperCase()]
            }).asMappedResults();
            if (cust.length === 1) {
                env.CUSTOMER_ID = cust[0].id;
                env.SUBSIDIARY  = cust[0].subsidiary || ENV_FALLBACK.SUBSIDIARY;
            } else {
                log.error({ title: 'Tax Lookup | dummy customer lookup',
                    details: cust.length + ' customers named "' + DUMMY_NAME + '" — expected exactly 1.' });
            }

            const itm = query.runSuiteQL({
                query: 'SELECT id FROM item ' +
                       "WHERE UPPER(itemid) = ? AND (isinactive IS NULL OR isinactive = 'F')",
                params: [DUMMY_NAME.toUpperCase()]
            }).asMappedResults();
            if (itm.length === 1) {
                env.ITEM_ID = itm[0].id;
            } else {
                log.error({ title: 'Tax Lookup | dummy item lookup',
                    details: itm.length + ' items named "' + DUMMY_NAME + '" — expected exactly 1.' });
            }
        } catch (e) {
            log.error({ title: 'Tax Lookup | dummy record lookup failed', details: e.message });
        }

        if (!env.CUSTOMER_ID || !env.ITEM_ID) {
            log.audit({ title: 'Tax Lookup | using fallback engine IDs',
                details: 'Name lookup incomplete — falling back to ' + JSON.stringify(ENV_FALLBACK) });
            env.CUSTOMER_ID = env.CUSTOMER_ID || ENV_FALLBACK.CUSTOMER_ID;
            env.ITEM_ID     = env.ITEM_ID     || ENV_FALLBACK.ITEM_ID;
            env.SUBSIDIARY  = env.SUBSIDIARY  || ENV_FALLBACK.SUBSIDIARY;
            env.resolvedBy  = 'fallback';
        }

        c.put({ key: 'engine_env', value: JSON.stringify(env), ttl: NEXUS_TTL });
        _env = env;
        return _env;
    };

    // Origin location for the engine path. Arizona (and other origin-sourced
    // states) tax an in-state sale at the SELLER's city, not the delivery city
    // — verified against AZ sales orders 2026-06 onward: Broadway (Phoenix)
    // orders are taxed Phoenix even when shipped to Peoria/Gilbert/Glendale,
    // SDL-SR/Phoenix Retail (Scottsdale) orders are taxed Scottsdale, TUC-*
    // orders are taxed Tucson. The estimate must therefore carry the same
    // Location the quoting user would put on a real order.
    //
    // Location 8 = 'Broadway', 4024 E Broadway Rd, Phoenix AZ 85040 — the same
    // address as subsidiary 2, so it matches SuiteTax's own no-location default.
    const ORIGIN_FALLBACK_LOCATION = 8;

    // Top-level File Cabinet folder holding the STE rate data
    // (verified via SuiteQL: mediaitemfolder 'SuiteTax Engine Data' with
    //  taxauthorities / taxcodes / taxgroups / zips children).
    const STE_DATA_FOLDER = 'SuiteTax Engine Data';

    // Subpaths relative to that folder: '<subfolder>/<file>'
    const PATHS = {
        zipFile:   (prefix) => 'zips/' + prefix + '.js',
        taxGroups: 'taxgroups/US.js',
        taxCodes:  'taxcodes/US.js'
    };

    // City -> representative ZIP index ("CITY|ST|ZIP" per line). Generated file —
    // upload cityzips_US.txt to the SuiteScripts folder. Needed because many
    // cities (all of NV, most of CA, ...) impose no city-level tax, so their
    // names never appear in taxcodes/US.js; the index bridges city -> ZIP and
    // the lookup then follows the normal ZIP path (district taxes included).
    // Absolute paths (leading '/') bypass the STE folder resolution.
    const CITY_INDEX_PATH = '/SuiteScripts/cityzips_US.txt';

    const CACHE_NAME  = 'tax_lookup';
    const RESULT_TTL  = 21600;  // 6h — rate content changes at most monthly
    const NEXUS_TTL   = 43200;  // 12h

    const LEVEL_ORDER = { STATE: 0, COUNTY: 1, COUNTY_LOCAL: 2, CITY: 3, DISTRICT: 4 };

    // -----------------------------------------------------------------------
    // Small helpers
    // -----------------------------------------------------------------------
    const todayStr = () => {
        const d = new Date();
        const p = (n) => (n < 10 ? '0' : '') + n;
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    };

    const getCache = () => cache.getCache({ name: CACHE_NAME, scope: cache.Scope.PROTECTED });

    /** Parse one line of an STE data module ("{...}," per line). Returns object or null. */
    const parseObjLine = (line) => {
        let t = line.trim();
        if (!t.startsWith('{')) return null;
        if (t.endsWith(',')) t = t.slice(0, -1);
        try { return JSON.parse(t); } catch (e) { return null; }
    };

    /**
     * Resolve a data file's internal ID via SuiteQL (folder name -> file name),
     * cached — used when path-based file.load fails. Three tiny, join-free
     * queries so it works even on accounts where SuiteQL joins are restricted.
     */
    const resolveFileId = (subpath) => {
        const c = getCache();
        const key = 'fileid|' + subpath;
        const hit = c.get({ key: key });
        if (hit) return parseInt(hit, 10);

        const parts = subpath.split('/');   // [subfolder, filename]
        const one = (sql, params) => {
            const rows = query.runSuiteQL({ query: sql, params: params }).asMappedResults();
            return rows.length ? rows[0].id : null;
        };
        const rootId = one(
            "SELECT id FROM mediaitemfolder WHERE name = ? AND parent IS NULL", [STE_DATA_FOLDER]);
        if (!rootId) return null;
        const subId = one(
            "SELECT id FROM mediaitemfolder WHERE name = ? AND parent = ?", [parts[0], rootId]);
        if (!subId) return null;
        const fileId = one(
            "SELECT id FROM file WHERE name = ? AND folder = ?", [parts[1], subId]);
        if (fileId) c.put({ key: key, value: String(fileId), ttl: NEXUS_TTL });
        return fileId;
    };

    /** Load a data file by path, falling back to ID resolution. */
    const loadDataFile = (subpath) => {
        if (subpath.charAt(0) === '/') return file.load({ id: subpath }); // absolute
        try {
            return file.load({ id: '/' + STE_DATA_FOLDER + '/' + subpath });
        } catch (pathErr) {
            const id = resolveFileId(subpath);
            if (!id) throw pathErr;
            return file.load({ id: id });
        }
    };

    /** Stream a data file line by line. cb returns false to stop early. */
    const scanFile = (subpath, cb) => {
        const f = loadDataFile(subpath);
        f.lines.iterator().each((line) => {
            const keepGoing = cb(line.value);
            return keepGoing !== false;
        });
    };

    /** Is a {validFrom, validUntil} window active today? */
    const isCurrent = (row, today) =>
        (!row.validFrom || row.validFrom <= today) &&
        (!row.validUntil || row.validUntil >= today);

    /**
     * Current base rate (%) for a tax code's taxRates array.
     * Returns { pct, tiered } or null. Uses the lowest tier (what applies to
     * the first dollar); the engine handles tier thresholds on real transactions.
     */
    const currentRate = (taxRates, today) => {
        const current = (taxRates || []).filter((r) => isCurrent(r, today));
        if (!current.length) return null;
        current.sort((a, b) => parseFloat(a.tierFrom || 0) - parseFloat(b.tierFrom || 0));
        return { pct: parseFloat(current[0].rate) * 100, tiered: current.length > 1 };
    };

    const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

    /** "City sales tax for Abbeville, Henry County, Alabama" -> {place, middle, stateName} */
    const parseName = (name) => {
        const m = /\bfor (.+)$/i.exec(name || '');
        if (!m) return { place: name || '', middle: '', stateName: '' };
        const parts = m[1].split(', ');
        return {
            place:     parts[0],
            middle:    parts.length > 2 ? parts.slice(1, -1).join(', ') : '',
            stateName: parts[parts.length - 1]
        };
    };

    /** Human jurisdiction label for a tax code object. */
    const labelFor = (code) => {
        const n = parseName(code.name);
        switch (code.level) {
            case 'STATE':        return n.place + ' State';
            case 'COUNTY':       return titleCase((code.steCode.split('_')[2] || n.place));
            case 'COUNTY_LOCAL': return titleCase((code.steCode.split('_')[2] || n.place)) + ' (Local)';
            case 'CITY':         return n.place + ' (City)';
            case 'DISTRICT':     return n.place + ' (District)';
            default:             return n.place || code.steCode;
        }
    };

    /** Build a v1-compatible breakdown row from a tax code object. */
    const rowFor = (code, rate) => ({
        jurisdiction: labelFor(code),
        tax_code:     code.steCode,
        rate:         rate.pct.toFixed(3) + '%',
        rate_numeric: rate.pct,
        tax_amount:   0,
        level:        code.level,
        tiered:       rate.tiered
    });

    const sortBreakdown = (rows) =>
        rows.sort((a, b) => (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99));

    const digitsOnly = (s) => String(s == null ? '' : s).replace(/\D/g, '');

    /**
     * Infer a level from an engine tax-code / tax-type label so engine rows sort
     * and render exactly like table rows. Order matters: "county local" and
     * "district" must be tested before the looser "county" / "city" patterns.
     */
    const LEVEL_PATTERNS = [
        { re: /county\s+local/i,      level: 'COUNTY_LOCAL' },
        { re: /\bdistrict\b|\bspecial\b|\btransit\b/i, level: 'DISTRICT' },
        { re: /\bcounty\b/i,          level: 'COUNTY' },
        { re: /\bcity\b|\bmunicipal\b|\blocal\b/i, level: 'CITY' },
        { re: /\bstate\b/i,           level: 'STATE' }
    ];
    const levelFromLabel = (codeName, typeName) => {
        // Match the DESCRIPTOR only — the part before " for ". The place name
        // that follows almost always contains "County" ("City sales tax for
        // Mesa, Maricopa County, Arizona"), which would otherwise make every
        // city code look like a county code.
        const head = /^([\s\S]*?)\bfor\b/i.exec(codeName || '');
        const texts = [head ? head[1] : '', typeName || '', codeName || ''];
        for (let t = 0; t < texts.length; t++) {
            for (let i = 0; i < LEVEL_PATTERNS.length; i++) {
                if (LEVEL_PATTERNS[i].re.test(texts[t])) return LEVEL_PATTERNS[i].level;
            }
        }
        return '';
    };

    // -----------------------------------------------------------------------
    // Origin location (the seller side of an origin-sourced sale)
    // -----------------------------------------------------------------------
    /**
     * The location the engine should quote from: the logged-in user's own
     * location, falling back to Broadway/Phoenix. Returns
     * { id, name, city, state } or null if it cannot be resolved.
     */
    const getOriginLocation = () => {
        let locId = 0;
        try { locId = parseInt(runtime.getCurrentUser().location, 10) || 0; }
        catch (e) { log.error({ title: 'Tax Lookup | getCurrentUser failed', details: e.message }); }
        if (!locId || locId <= 0) locId = ORIGIN_FALLBACK_LOCATION;

        const c = getCache();
        const key = 'origin_loc|' + locId;
        const hit = c.get({ key: key });
        if (hit) { try { return JSON.parse(hit); } catch (e) { /* re-resolve */ } }

        try {
            const rows = query.runSuiteQL({
                query: 'SELECT l.id, l.name, a.city, a.state FROM location l ' +
                       'LEFT JOIN locationMainAddress a ON a.nkey = l.mainaddress ' +
                       "WHERE l.id = ? AND (l.isinactive IS NULL OR l.isinactive = 'F')",
                params: [locId]
            }).asMappedResults();
            if (!rows.length) {
                log.error({ title: 'Tax Lookup | origin location unusable',
                    details: 'Location ' + locId + ' is missing or inactive — the estimate will be left ' +
                             'without a location and SuiteTax will fall back to the subsidiary address.' });
                return null;
            }
            const info = {
                id:    rows[0].id,
                name:  rows[0].name || ('Location ' + locId),
                city:  rows[0].city  || '',
                state: rows[0].state || '',
                fromUser: locId !== ORIGIN_FALLBACK_LOCATION
            };
            c.put({ key: key, value: JSON.stringify(info), ttl: NEXUS_TTL });
            return info;
        } catch (e) {
            log.error({ title: 'Tax Lookup | origin location query failed', details: e.message });
            return null;
        }
    };

    // -----------------------------------------------------------------------
    // Nexus detection (dynamic — new registrations appear with no code change)
    // -----------------------------------------------------------------------
    /** Returns array of US state codes with a nexus, or null if undeterminable. */
    const getNexusStates = () => {
        const c = getCache();
        const cached = c.get({ key: 'nexus_states' });
        if (cached) { try { return JSON.parse(cached); } catch (e) { /* fall through */ } }
        try {
            // nexus.state holds the state code directly ('AZ', 'TN', ...) —
            // no join needed (verified; JOIN state is rejected on this account)
            const rows = query.runSuiteQL({
                query: 'SELECT country, state FROM nexus'
            }).asMappedResults();
            const states = rows
                .filter((r) => String(r.country || '').toUpperCase() === 'US' && r.state)
                .map((r) => String(r.state).toUpperCase());
            if (states.length) {
                c.put({ key: 'nexus_states', value: JSON.stringify(states), ttl: NEXUS_TTL });
                return states;
            }
            return null;
        } catch (e) {
            log.error({ title: 'Tax Lookup| nexus query failed', details: e.message });
            return null; // unknown -> engine-first behavior with table fallback
        }
    };

    // -----------------------------------------------------------------------
    // PATH A: SuiteTax engine (non-posting Estimate)
    // -----------------------------------------------------------------------
    const ENGINE_TEST_AMOUNT = 100;   // $ on the throwaway line

    /**
     * Price a test line against a real address through SuiteTax.
     *
     * Returns { breakdown, notes } or null. Null means "engine did not give a
     * trustworthy answer" — no tax detail, or the address it actually priced
     * was not the address requested — and the caller falls through to the
     * published rate tables. Returning null is always safe; returning a wrong
     * number is not.
     */
    const engineLookup = (zip, city, state, origin) => {
        const ENV = getEnv();
        if (!ENV.CUSTOMER_ID || !ENV.ITEM_ID) return null;

        let estimateId = null;
        try {
            const est = record.create({ type: record.Type.ESTIMATE, isDynamic: true });
            est.setValue({ fieldId: 'entity', value: ENV.CUSTOMER_ID });
            if (ENV.SUBSIDIARY) est.setValue({ fieldId: 'subsidiary', value: ENV.SUBSIDIARY });
            // Origin matters: in an origin-sourced state the Location on the
            // transaction — not the ship-to — decides the city/county rate.
            if (origin && origin.id) est.setValue({ fieldId: 'location', value: origin.id });

            // The ship-to MUST go through the shippingaddress subrecord. Setting
            // the body fields (shipaddr1 / shipcity / shipstate / shipzip) does
            // NOT stick on save — the estimate silently keeps the customer's own
            // address, and SuiteTax then prices THAT address. That was the
            // 9.100%-for-every-AZ-ZIP bug.
            est.setValue({ fieldId: 'shipoverride', value: true });
            const ship = est.getSubrecord({ fieldId: 'shippingaddress' });
            ship.setValue({ fieldId: 'country', value: 'US' });   // country first — it drives the state list
            ship.setValue({ fieldId: 'addr1',   value: '123 Tax Lookup Ln' });
            // Only pass a city when the user gave one. A placeholder like
            // 'Unknown' can make address resolution fall back to a default.
            if (city) ship.setValue({ fieldId: 'city', value: city });
            ship.setValue({ fieldId: 'state', value: state });
            ship.setValue({ fieldId: 'zip',   value: zip });

            est.selectNewLine({ sublistId: 'item' });
            est.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item',     value: ENV.ITEM_ID });
            est.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
            est.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate',     value: ENGINE_TEST_AMOUNT });
            if (origin && origin.id) {
                // Belt and braces — the body location normally cascades, but a
                // line whose location is blank would source from the subsidiary.
                try { est.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: origin.id }); }
                catch (locErr) { log.error({ title: 'Tax Lookup | line location not settable', details: locErr.message }); }
            }
            est.commitLine({ sublistId: 'item' });

            estimateId = est.save({ ignoreMandatoryFields: true });
            const saved = record.load({ type: record.Type.ESTIMATE, id: estimateId });

            // --- guard: did SuiteTax actually price the address we asked for? ---
            const wantZip   = digitsOnly(zip).slice(0, 5);
            const wantState = String(state || '').toUpperCase();
            let gotZip = '', gotState = '';
            try {
                const savedShip = saved.getSubrecord({ fieldId: 'shippingaddress' });
                gotZip   = digitsOnly(savedShip.getValue({ fieldId: 'zip' })).slice(0, 5);
                gotState = String(savedShip.getValue({ fieldId: 'state' }) || '').toUpperCase();
            } catch (subErr) {
                log.error({ title: 'Tax Lookup | could not read back ship address', details: subErr.message });
            }
            if ((wantZip && gotZip !== wantZip) || (wantState && gotState && gotState !== wantState)) {
                log.error({
                    title: 'Tax Lookup | engine address mismatch — using rate tables',
                    details: 'requested ' + wantState + ' ' + wantZip +
                             ' but the estimate priced ' + gotState + ' ' + gotZip +
                             ' (customer ' + ENV.CUSTOMER_ID + ', resolved by ' + ENV.resolvedBy + ')'
                });
                return null;
            }

            // --- read the tax detail ---
            const count = saved.getLineCount({ sublistId: 'taxdetails' });
            const breakdown = [];
            const seen = {};
            for (let i = 0; i < count; i++) {
                const codeId   = saved.getSublistValue({ sublistId: 'taxdetails', fieldId: 'taxcode',   line: i });
                // taxcode TEXT carries the real jurisdiction name — e.g.
                // "City sales tax for Mesa, Maricopa County, Arizona".
                // taxtype text is only ever the generic "US city sales tax".
                const codeName = saved.getSublistText({ sublistId: 'taxdetails',  fieldId: 'taxcode',   line: i });
                const typeName = saved.getSublistText({ sublistId: 'taxdetails',  fieldId: 'taxtype',   line: i });
                const rate     = parseFloat(saved.getSublistValue({ sublistId: 'taxdetails', fieldId: 'taxrate',   line: i }) || 0);
                const amount   = parseFloat(saved.getSublistValue({ sublistId: 'taxdetails', fieldId: 'taxamount', line: i }) || 0);

                if (!rate) continue;                       // drops "Not liable to tax, <State>" 0.000% rows
                const key = String(codeId || codeName);
                if (seen[key]) continue;                   // one row per jurisdiction
                seen[key] = true;

                const level = levelFromLabel(codeName, typeName);
                breakdown.push({
                    jurisdiction: codeName
                        ? labelFor({ name: codeName, level: level, steCode: '' })
                        : (typeName || String(codeId)),
                    tax_code:     codeName || String(codeId),
                    rate:         rate.toFixed(3) + '%',
                    rate_numeric: rate,
                    tax_amount:   Math.abs(amount),
                    level:        level
                });
            }
            if (!breakdown.length) return null;

            const cityRow = breakdown.filter((b) => b.level === 'CITY')[0];
            return {
                breakdown: sortBreakdown(breakdown),
                taxedCity: cityRow ? cityRow.jurisdiction.replace(' (City)', '') : '',
                appliedZip: gotZip,
                appliedState: gotState,
                notes: ['Calculated by SuiteTax on a $' + ENGINE_TEST_AMOUNT + ' test line. A few ' +
                        'jurisdictions (many Arizona cities, Tennessee single-article) change rate above a ' +
                        'single-item threshold, so large-ticket lines can differ.']
            };
        } finally {
            if (estimateId) {
                try {
                    record.delete({ type: record.Type.ESTIMATE, id: estimateId });
                } catch (delErr) {
                    log.error({ title: 'Tax Lookup | failed to delete estimate ' + estimateId, details: JSON.stringify(delErr) });
                }
            }
        }
    };

    // -----------------------------------------------------------------------
    // PATH B: published rate tables (STE data files)
    // -----------------------------------------------------------------------

    /** ZIP(+4) -> tax group steCode. Returns { taxGroup, usedPlus4 } or null. */
    const resolveZipGroup = (zip5, plus4, today) => {
        let entries = null;
        try {
            scanFile(PATHS.zipFile(zip5.slice(0, 4)), (line) => {
                if (line.indexOf('"' + zip5 + '":') === -1) return true;
                const a = line.indexOf('['), b = line.lastIndexOf(']');
                if (a === -1 || b === -1) return true;
                try { entries = JSON.parse(line.substring(a, b + 1)); } catch (e) { /* ignore */ }
                return false;
            });
        } catch (e) {
            log.error({ title: 'Tax Lookup | zip file load failed', details: e.message });
            return null;
        }
        if (!entries) return null;
        const current = entries.filter((r) => isCurrent(r, today));
        if (!current.length) return null;

        if (plus4) {
            const p4 = parseInt(plus4, 10);
            const hit = current.find((r) => parseInt(r.rangeFrom, 10) <= p4 && p4 <= parseInt(r.rangeUntil, 10));
            if (hit) return { taxGroup: hit.taxGroup, usedPlus4: true };
        }
        const def = current.find((r) => r.rangeFrom === '0' && r.rangeUntil === '9999');
        return { taxGroup: (def || current[0]).taxGroup, usedPlus4: false };
    };

    /** Tax group steCode -> Set of member SALES tax code steCodes (current members only). */
    const groupSalesCodes = (groupCode, today) => {
        let codes = null;
        scanFile(PATHS.taxGroups, (line) => {
            if (line.indexOf('"steCode": "' + groupCode + '"') === -1) return true;
            const g = parseObjLine(line);
            if (g && g.taxCodes) {
                codes = g.taxCodes
                    .filter((tc) => tc.type === 'SALES' && isCurrent(tc, today))
                    .map((tc) => tc.taxCode);
            }
            return false;
        });
        return codes;
    };

    /** Collect current-rate rows for a Set of steCodes within one state. */
    const ratesForCodes = (state, codeSet, today) => {
        const rows = [];
        const stateTag = '"state": "' + state + '"';
        let remaining = codeSet.size;
        scanFile(PATHS.taxCodes, (line) => {
            if (line.indexOf(stateTag) === -1) return true;
            const c = parseObjLine(line);
            if (!c || !codeSet.has(c.steCode)) return true;
            const r = currentRate(c.taxRates, today);
            if (r) rows.push(rowFor(c, r));
            remaining--;
            return remaining > 0;
        });
        return sortBreakdown(rows);
    };

    /**
     * Find the best tax GROUP for a jurisdiction. Groups are authoritative on
     * which codes stack together (summing matched codes directly double-counts
     * in states with multiple state-level codes, e.g. SC).
     *
     * targetSte  - a tax code steCode the group must contain (null = state-only group)
     * preferFn   - receives the Set of member levels; true = ideal group (early stop)
     * Returns array of member steCodes, or null.
     */
    const bestGroupCodes = (state, targetSte, preferFn, today) => {
        const stateTag = '"state": "' + state + '"';
        let best = null;
        scanFile(PATHS.taxGroups, (line) => {
            if (line.indexOf(stateTag) === -1) return true;
            if (targetSte && line.indexOf('"' + targetSte + '"') === -1) return true;
            const g = parseObjLine(line);
            if (!g || !g.taxCodes) return true;
            const members = g.taxCodes.filter((tc) => tc.type === 'SALES' && isCurrent(tc, today));
            if (targetSte && !members.some((m) => m.taxCode === targetSte)) return true;
            if (!members.length) return true;
            const levels = new Set(members.map((m) => m.level));
            const ideal = preferFn(levels);
            const score = (ideal ? 0 : 1000) + members.length;
            if (!best || score < best.score) best = { score, ideal, members };
            return !best.ideal; // stop at the first ideal group
        });
        if (!best) return null;
        return {
            codes:  best.members.map((m) => m.taxCode),
            levels: [...new Set(best.members.map((m) => m.level))]
        };
    };

    /**
     * City / county / state resolution with NO Zip — the no-address workflow.
     * 1. One pass over taxcodes/US.js finds the state's COUNTY codes and any
     *    CITY codes whose name matches the requested city.
     * 2. The matched code anchors a tax-group search (bestGroupCodes), and the
     *    group's full membership is priced — so code stacking is always correct.
     */
    const cityPathLookup = (state, city, county, today) => {
        const stateTag  = '"state": "' + state + '"';
        const cityUpper = (city || '').toUpperCase().replace(/\s+/g, ' ').trim();
        const countyUpper = (county || '').toUpperCase().replace(/\s+/g, ' ').trim();

        const countyCodes = [], cityHits = [];
        scanFile(PATHS.taxCodes, (line) => {
            if (line.indexOf(stateTag) === -1) return true;
            if (line.indexOf('SALES') === -1) return true;               // cheap prefilter
            const c = parseObjLine(line);
            if (!c || c.taxType.indexOf('SALES') === -1) return true;    // SALES only (skip USE)
            if (c.level === 'COUNTY' || c.level === 'COUNTY_LOCAL') {
                countyCodes.push(c);
            } else if (c.level === 'CITY' && cityUpper) {
                if (parseName(c.name).place.toUpperCase() === cityUpper) cityHits.push(c);
            }
            return true;
        });

        const notes = [];
        let resolution = 'state';

        // County segment lives in the steCode: US_TN_SHELBY COUNTY_CITY_SALES_1
        const countySeg = (c) => (c.steCode.split('_')[2] || '');

        // --- pick the anchor code: the matched city, else the typed county ---
        let anchor = null;
        if (cityHits.length) {
            const counties = [...new Set(cityHits.map(countySeg))];
            let chosen = cityHits;
            if (counties.length > 1) {
                if (countyUpper) {
                    const filt = cityHits.filter((c) => countySeg(c).indexOf(countyUpper) === 0);
                    if (filt.length) chosen = filt;
                }
                if (chosen === cityHits) {
                    chosen = cityHits.filter((c) => countySeg(c) === counties[0]);
                    notes.push(titleCase(cityUpper) + ' exists in more than one county here (' +
                        counties.map(titleCase).join('; ') + '). Showing ' + titleCase(counties[0]) +
                        ' — enter a county to switch.');
                }
            }
            anchor = chosen[0];
            resolution = 'city';
        } else if (cityUpper) {
            notes.push('No city-level tax found for "' + titleCase(cityUpper) +
                '" — it may not impose one, or check the spelling.');
        }

        if (!anchor && countyUpper) {
            const seg = countyCodes.map(countySeg).find((s) => s.indexOf(countyUpper) === 0);
            if (seg) {
                anchor = countyCodes.find((c) => countySeg(c) === seg);
                resolution = 'county';
            } else {
                notes.push('County "' + titleCase(countyUpper) + '" was not found in ' + state + ' — check the spelling.');
            }
        }

        // --- group-driven pricing: the group decides exactly which codes stack ---
        let group = null;
        if (anchor && resolution === 'city') {
            group = bestGroupCodes(state, anchor.steCode, (lv) => !lv.has('DISTRICT'), today);
        } else if (anchor) {
            group = bestGroupCodes(state, anchor.steCode,
                (lv) => !lv.has('CITY') && !lv.has('DISTRICT'), today);
            if (group && group.levels.indexOf('CITY') !== -1) {
                notes.push('No county-only rate is published for this county — showing a representative ' +
                    'rate for a city within it. Local rate caps often make this uniform county-wide.');
            }
        }
        if (!group) {
            // state-base group: membership is exactly the state-level code(s)
            group = bestGroupCodes(state, null, (lv) => lv.size === 1 && lv.has('STATE'), today);
            if (anchor) {
                notes.push('Could not match a tax group for that ' + resolution + ' — state rate shown.');
            }
            resolution = 'state';
        }

        const breakdown = (group && group.codes.length)
            ? ratesForCodes(state, new Set(group.codes), today)
            : [];

        if (resolution === 'state') {
            notes.push('State-level rate only — add a city or county (or a ZIP once one exists) for local rates.');
        } else {
            notes.push('Resolved by ' + resolution + ' name. Special-district taxes are tied to ZIP+4 areas ' +
                'and are not included — rates may be slightly higher in some districts.');
        }
        if (breakdown.some((b) => b.tiered)) {
            notes.push('One or more rates are tiered (rate drops above a threshold amount); base rate shown.');
        }

        return { breakdown: sortBreakdown(breakdown), resolution, notes };
    };

    /**
     * City -> representative ZIP via the generated index file.
     * Handles Saint/St variants and stray periods. Returns zip5 or null
     * (including when the index file isn't installed — callers fall back).
     */
    const cityIndexZip = (state, city) => {
        const norm = city.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
        const cands = [norm];
        if (norm.indexOf('ST ') === 0)    cands.push('SAINT ' + norm.slice(3));
        if (norm.indexOf('SAINT ') === 0) cands.push('ST ' + norm.slice(6));
        const keys = cands.map((c) => c + '|' + state + '|');
        let zip = null;
        try {
            scanFile(CITY_INDEX_PATH, (line) => {
                const t = line.replace(/\./g, '').trim();
                for (let i = 0; i < keys.length; i++) {
                    if (t.indexOf(keys[i]) === 0) {
                        const z = t.slice(keys[i].length).trim();
                        if (/^\d{5}$/.test(z)) zip = z;
                        return false;
                    }
                }
                return true;
            });
        } catch (e) {
            log.error({ title: 'Tax Lookup | city index unavailable', details: e.message });
        }
        return zip;
    };

    /**
     * Full table lookup. Order of preference:
     *   1. Real ZIP (if provided)
     *   2. City w/ county -> name-anchored path (county drives disambiguation)
     *   3. City -> index ZIP -> normal ZIP path (districts included)
     *   4. Name-anchored city/county path
     *   5. State-only
     */
    const tablesLookup = (zip5, plus4, city, county, state) => {
        const today = todayStr();
        const notes = [];

        const tryZip = (z, p4) => {
            const zipRes = resolveZipGroup(z, p4, today);
            if (!zipRes) return null;
            const codeList = groupSalesCodes(zipRes.taxGroup, today);
            if (!codeList || !codeList.length) return null;
            const breakdown = ratesForCodes(state, new Set(codeList), today);
            if (!breakdown.length) return null;
            const n = [];
            if (p4 && !zipRes.usedPlus4) n.push('ZIP+4 ' + p4 + ' was not found in the tables; base ZIP rates shown.');
            if (breakdown.some((b) => b.tiered)) {
                n.push('One or more rates are tiered (rate drops above a threshold amount); base rate shown.');
            }
            return { breakdown, usedPlus4: zipRes.usedPlus4, notes: n };
        };

        // 1. Real ZIP
        if (zip5) {
            const r = tryZip(zip5, plus4);
            if (r) {
                if (!plus4) r.notes.push('Base ZIP rates shown; some special-district taxes vary by ZIP+4.');
                return { breakdown: r.breakdown, resolution: r.usedPlus4 ? 'zip+4' : 'zip',
                         effectiveZip: zip5, notes: notes.concat(r.notes) };
            }
            notes.push('ZIP ' + zip5 + ' was not found in the rate tables' +
                (city || county ? ' — resolved by city/county instead.' : '.'));
        }

        // 2. City with an explicit county: the name-anchored path respects the county
        if (city && county) {
            const a = cityPathLookup(state, city, county, today);
            if (a.resolution === 'city') {
                a.notes = notes.concat(a.notes);
                return a;
            }
        }

        // 3. City via index ZIP (covers cities with no city-level tax code: NV, most of CA, ...)
        if (city) {
            const idxZip = cityIndexZip(state, city);
            if (idxZip) {
                const r = tryZip(idxZip, '');
                if (r) {
                    r.notes.unshift('Rates shown for ZIP ' + idxZip + ' (central ' + titleCase(city.toUpperCase()) +
                        '), including its district taxes. Rates can vary slightly across a large city.');
                    // effectiveZip lets the caller run the engine for a city-only
                    // lookup — otherwise an origin-sourcing warning could never
                    // reach the no-address (new construction) workflow.
                    return { breakdown: r.breakdown, resolution: 'city',
                             effectiveZip: idxZip, notes: notes.concat(r.notes) };
                }
            }
        }

        // 4./5. Name-anchored city/county path, degrading to state-only with guidance
        const cityRes = cityPathLookup(state, city, county, today);
        cityRes.notes = notes.concat(cityRes.notes);
        return cityRes;
    };

    // -----------------------------------------------------------------------
    // Main entry
    // -----------------------------------------------------------------------
    const onRequest = (context) => {
        try {
            context.response.setHeader({ name: 'Content-Type', value: 'application/json' });
            if (context.request.method !== 'GET') {
                context.response.write(JSON.stringify({ status: 'error', message: 'Only GET supported.' }));
                return;
            }

            const p      = context.request.parameters;
            const city   = (p.city   || '').trim();
            const county = (p.county || '').trim();
            const state  = (p.state  || '').trim().toUpperCase();
            const debugMode = String(p.debug || '').toUpperCase() === 'T';
            const digits = (p.zip    || '').replace(/\D/g, '');
            const zip5   = digits.length >= 5 ? digits.slice(0, 5) : '';
            const plus4  = digits.length >= 9 ? digits.slice(5, 9) : '';

            if (!state) {
                context.response.write(JSON.stringify({ status: 'error', message: 'State is required.' }));
                return;
            }
            if (!zip5 && !city && !county) {
                context.response.write(JSON.stringify({ status: 'error', message: 'Provide a zip, city, or county.' }));
                return;
            }

            const c = getCache();
            // 'v3' — bumped with the engine-path fix so cached 9.100% answers
            // from the previous build cannot outlive the deploy.
            const cacheKey = ['v3', state, zip5, plus4, city.toUpperCase(), county.toUpperCase()].join('|');
            // &debug=T always runs live and is never cached — a debug payload
            // must not be served to a normal caller, or vice versa.
            const cached = debugMode ? null : c.get({ key: cacheKey });
            if (cached) { context.response.write(cached); return; }

            const nexusStates = getNexusStates();               // null = unknown
            const inNexus = nexusStates ? nexusStates.indexOf(state) !== -1 : null;

            let result = null;
            const notes = [];
            const sumOf = (rows) => rows.reduce((s, r) => s + r.rate_numeric, 0);
            const origin = getOriginLocation();
            let eng = null;

            // The published tables always run: they are the "rate at that
            // address" answer, and they also supply a representative ZIP for
            // city-only lookups so the engine can be consulted even when the
            // jobsite has no address yet.
            const dest = tablesLookup(zip5, plus4, city, county, state);
            const destRate = dest.breakdown.length ? sumOf(dest.breakdown) : null;

            // Engine path: needs an address, and a state we are (or might be)
            // registered in. A city-only lookup uses the table's index ZIP.
            const engZip = zip5 ? (zip5 + (plus4 ? '-' + plus4 : '')) : (dest.effectiveZip || '');
            if (engZip && inNexus !== false) {
                try {
                    eng = engineLookup(engZip, city, state, origin);
                    if (!eng && inNexus === true) {
                        notes.push('SuiteTax did not return a verified result for this address — showing published rate tables instead.');
                    }
                } catch (engErr) {
                    log.error({ title: 'Tax Lookup | engine path failed, using tables', details: engErr.message });
                    notes.push('Engine lookup failed — showing published rate tables instead.');
                }
            }

            // -----------------------------------------------------------------
            // Origin vs destination reconciliation.
            //
            // The engine answers "what will we actually charge" — which in an
            // origin-sourced state (Arizona) is the rate at OUR location, not
            // the delivery address. The tables answer "what is the rate at that
            // address". When those disagree, the address breakdown is shown (it
            // is what the tool is asked for) with a warning naming the number
            // that will really land on the order. No hard-coded list of
            // origin-sourced states — the divergence itself is the signal.
            // -----------------------------------------------------------------
            const engRate = eng ? sumOf(eng.breakdown) : null;
            const diverges = (eng && destRate !== null && Math.abs(engRate - destRate) > 0.0005);

            if (eng && (destRate === null || !diverges) && zip5) {
                // Engine agrees (or the tables found nothing) and the user gave
                // a real ZIP — show the engine's own breakdown, as before.
                result = {
                    source:     'engine',
                    resolution: plus4 ? 'zip+4' : 'zip',
                    breakdown:  eng.breakdown,
                    notes:      notes.concat(eng.notes || [])
                };
            } else if (eng && destRate === null) {
                result = { source: 'engine', resolution: 'city', breakdown: eng.breakdown, notes: notes.concat(eng.notes || []) };
            } else {
                result = {
                    source:     'tables',
                    resolution: dest.resolution,
                    breakdown:  dest.breakdown,
                    notes:      notes.concat(dest.notes)
                };
                if (diverges) {
                    result.notes.unshift(
                        'Heads up — SuiteTax will charge ' + engRate.toFixed(3) + '% on this order, not the ' +
                        destRate.toFixed(3) + '% shown above. ' + state + ' sources local tax to the seller\'s ' +
                        'location, so an order written from ' + (origin ? origin.name : 'our default location') +
                        ' is taxed at the ' + (eng.taxedCity || 'seller\'s city') + ' rate no matter where it ' +
                        'ships. The breakdown above is the rate at the delivery address — quote ' +
                        engRate.toFixed(3) + '% unless accounting says otherwise.'
                    );
                    result.engine = {
                        combined_rate: engRate.toFixed(3) + '%',
                        taxed_city:    eng.taxedCity,
                        data:          eng.breakdown
                    };
                }
                if (inNexus === false) {
                    result.notes.push('We are not currently registered to collect tax in ' + state +
                        ' — rates are from the published SuiteTax tables. Confirm collection with accounting before quoting tax.');
                }
            }

            // Never return a hard "nothing": explain a genuinely empty result
            if (!result.breakdown.length) {
                result.notes.push('No sales tax rates found — ' + state +
                    ' may not impose a general state sales tax. Local taxes (if any) need a city match.');
            }

            const combined = result.breakdown.reduce((s, r) => s + r.rate_numeric, 0);
            const body = {
                status: 'success',
                zip: zip5 + (plus4 ? '-' + plus4 : ''), city, county, state,
                source: result.source,
                resolution: result.resolution,
                engine_driven: result.source === 'engine',
                combined_rate: combined.toFixed(3) + '%',
                data: result.breakdown,
                notes: result.notes,
                origin_location: origin
                    ? { id: origin.id, name: origin.name, city: origin.city, from_user: !!origin.fromUser }
                    : null
            };
            // Present only when the engine and the address disagree (origin sourcing).
            if (result.engine) body.engine = result.engine;

            // A successful lookup logs nothing by default, which makes "is it
            // even running?" unanswerable. One audit line per uncached lookup,
            // plus &debug=T for the full picture in the response itself.
            log.audit({
                title: 'Tax Lookup | ' + state + ' ' + (zip5 || city || county),
                details: 'source=' + result.source + ' combined=' + body.combined_rate +
                         (result.engine ? ' engine=' + result.engine.combined_rate +
                                          ' (' + result.engine.taxed_city + ')' : '') +
                         ' origin=' + (origin ? origin.name + '#' + origin.id : 'none') +
                         ' engineRan=' + (eng ? 'Y' : 'N')
            });

            if (debugMode) {
                body.debug = {
                    engine_ran:        !!eng,
                    engine_applied:    eng ? { zip: eng.appliedZip, state: eng.appliedState } : null,
                    engine_combined:   eng ? sumOf(eng.breakdown).toFixed(3) + '%' : null,
                    engine_data:       eng ? eng.breakdown : null,
                    origin_location:   origin,
                    dummy_customer_id: getEnv().CUSTOMER_ID,
                    dummy_item_id:     getEnv().ITEM_ID,
                    env_resolved_by:   getEnv().resolvedBy,
                    nexus_state:       inNexus,
                    cache_key:         cacheKey
                };
            }

            const payload = JSON.stringify(body);

            if (!debugMode) c.put({ key: cacheKey, value: payload, ttl: RESULT_TTL });
            context.response.write(payload);

        } catch (error) {
            log.error({ title: 'tax_lookup_portlet_sl | onRequest error', details: JSON.stringify(error) });
            context.response.write(JSON.stringify({ status: 'error', message: error.message }));
        }
    };

    return { onRequest };
});