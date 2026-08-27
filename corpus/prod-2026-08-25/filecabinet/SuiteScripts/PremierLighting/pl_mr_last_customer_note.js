/**
 * pl_mr_last_customer_note.js
 *
 * Surfaces the most recent User Note from a customer's Communication tab onto
 * stored entity fields, so it can be joined into the AR aging saved searches
 * (Transaction -> Customer Fields) without a second-level join.
 *
 * Two deployments off this one script:
 *   1. INCREMENTAL  - param custscript_pl_note_lookback_hrs = 72, every 30 min
 *   2. FULL REBUILD - no param (processes everything), nightly ~2am.
 *                     Also serves as the one-time backfill: Save & Execute.
 *
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/format', 'N/runtime', 'N/log'],
    (search, record, format, runtime, log) => {

    // ---------------------------------------------------------------------
    // CONFIG - verify the NOTE_* search field IDs in Sandbox before go-live.
    // Build a quick Note saved search in the UI, add each column, and confirm
    // the internal ID in the Results tab. Correct them here only.
    // ---------------------------------------------------------------------
    const CFG = {
        // Target fields on the Customer record
        FLD_DATE:      'custentity_pl_last_note_date',
        FLD_AUTHOR:    'custentity_pl_last_note_author',
        FLD_TEXT:      'custentity_pl_last_note_text',
        FLD_DIRECTION: 'custentity_pl_last_note_direction',

        // Source fields on the Note search.
        // VERIFIED 07/30/2026 against a live Note search export:
        //   Internal ID, {author}, {title}, {notedate}, {note},
        //   {direction}, {notetype}, {company}
        NOTE_COMPANY:   'company',
        NOTE_DATE:      'notedate',   // format: '07/30/2026 9:10 am'
        NOTE_AUTHOR:    'author',
        NOTE_TEXT:      'note',
        NOTE_TITLE:     'title',
        NOTE_DIRECTION: 'direction',  // Incoming / Outgoing

        // Exclusion - MANDATORY.
        // Verified against production 07/30/2026: of 9,093 notes, 6,624 carry
        // BOTH an entity and a transaction. Without this, virtually every
        // customer's "most recent note" would be a transaction note rather
        // than a collections communication.
        //
        // The note search exposes NO direct 'transaction' filter field - only
        // a transaction JOIN. Rather than guess at '@NONE@' semantics across a
        // join, this pulls the join as a COLUMN and rejects in the map stage.
        // Slightly more map invocations, zero chance of silently filtering
        // everything out.
        //
        // Also verified: entity+activity = 0 rows, entity+item = 0 rows, so
        // no exclusion is needed for those.
        NOTE_TXN_JOIN:  'transaction',
        NOTE_TXN_FIELD: 'internalid',

        PARAM_LOOKBACK: 'custscript_pl_note_lookback_hrs',
        TEXT_MAX: 300              // must match the field's Max Length
    };

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    /** Collapse all whitespace/newlines so the preview stays on one line. */
    const flatten = (s) => String(s || '').replace(/\s+/g, ' ').trim();

    /**
     * Truncate at a word boundary. Falls back to a hard cut if the last space
     * is too far left (e.g. one very long token like a URL or PO number).
     */
    const truncateAtWord = (s, max) => {
        if (s.length <= max) return s;
        const cut = s.substr(0, max - 3);
        const lastSpace = cut.lastIndexOf(' ');
        const base = (lastSpace > max * 0.6) ? cut.substr(0, lastSpace) : cut;
        return base + '...';
    };

    /**
     * Note date arrives as '07/30/2026 9:10 am' (verified against a live
     * export). Parse the FULL datetime - date-only parsing makes every note on
     * a given day tie, and reduce would then keep an arbitrary one rather than
     * the latest. Collections logs multiple contacts per day, so this matters.
     * Falls back to date-only if the datetime format is rejected.
     */
    const parseNoteDate = (raw) => {
        if (!raw) return null;
        const s = String(raw).trim();
        try {
            return format.parse({ value: s, type: format.Type.DATETIME });
        } catch (e1) {
            try {
                return format.parse({ value: s.split(' ')[0], type: format.Type.DATE });
            } catch (e2) {
                log.error({ title: 'Unparseable note date', details: s + ' :: ' + e2.message });
                return null;
            }
        }
    };

    // ---------------------------------------------------------------------
    // getInputData
    // ---------------------------------------------------------------------
    const getInputData = () => {
        const lookback = runtime.getCurrentScript().getParameter({ name: CFG.PARAM_LOOKBACK });

        // Only filter on what is verified. Transaction exclusion happens in
        // map() via the join column below.
        const filters = [[CFG.NOTE_COMPANY, 'noneof', '@NONE@']];

        if (lookback) {
            // 'hoursago<N>' is not a valid relative-date token (search filters
            // only accept day-granularity keywords), so compute the cutoff
            // explicitly. Date-only and floored, i.e. over-inclusive by up to
            // a day: reduce keeps only the latest note per customer, so extra
            // rows cost a little governance but never accuracy.
            const cutoff = new Date(Date.now() - Number(lookback) * 60 * 60 * 1000);
            const cutoffStr = format.format({ value: cutoff, type: format.Type.DATE });
            filters.push('AND', [CFG.NOTE_DATE, 'onorafter', cutoffStr]);
            log.audit({ title: 'Mode', details: 'INCREMENTAL - lookback ' + lookback + 'h (onorafter ' + cutoffStr + ')' });
        } else {
            log.audit({ title: 'Mode', details: 'FULL REBUILD' });
        }

        return search.create({
            type: search.Type.NOTE,
            filters: filters,
            columns: [
                search.createColumn({ name: CFG.NOTE_COMPANY }),
                search.createColumn({ name: CFG.NOTE_DATE, sort: search.Sort.DESC }),
                search.createColumn({ name: CFG.NOTE_AUTHOR }),
                search.createColumn({ name: CFG.NOTE_TITLE }),
                search.createColumn({ name: CFG.NOTE_DIRECTION }),
                search.createColumn({ name: CFG.NOTE_TEXT }),
                search.createColumn({
                    name: CFG.NOTE_TXN_FIELD,
                    join: CFG.NOTE_TXN_JOIN
                })
            ]
        });
    };

    // ---------------------------------------------------------------------
    // map - key on the parent entity so reduce sees one customer at a time
    // ---------------------------------------------------------------------
    const map = (context) => {
        try {
            const row = JSON.parse(context.value);
            const v = row.values;

            const company = v[CFG.NOTE_COMPANY];
            const companyId = (company && company.length) ? company[0].value : null;
            if (!companyId) return;

            // Reject transaction-attached notes. Search result keys for joined
            // columns are '<join>.<field>'.
            const txnKey = CFG.NOTE_TXN_JOIN + '.' + CFG.NOTE_TXN_FIELD;
            const txn = v[txnKey];
            const txnId = Array.isArray(txn) ? (txn.length ? txn[0].value : null)
                                             : (txn || null);
            if (txnId) return;

            const author = v[CFG.NOTE_AUTHOR];
            const dir = v[CFG.NOTE_DIRECTION];

            context.write({
                key: companyId,
                value: {
                    date:      v[CFG.NOTE_DATE] || '',
                    author:    (author && author.length) ? author[0].text : '',
                    title:     v[CFG.NOTE_TITLE] || '',
                    direction: (dir && dir.length) ? dir[0].text : (dir || ''),
                    note:      v[CFG.NOTE_TEXT] || ''
                }
            });
        } catch (e) {
            log.error({ title: 'map failed', details: e.message });
        }
    };

    // ---------------------------------------------------------------------
    // reduce - collapse to the single latest note, one write per customer
    // ---------------------------------------------------------------------
    const reduce = (context) => {
        const customerId = context.key;

        let latest = null;
        let latestTime = -1;

        context.values.forEach((raw) => {
            const n = JSON.parse(raw);
            const d = parseNoteDate(n.date);
            if (!d) return;
            const t = d.getTime();
            if (t > latestTime) {
                latestTime = t;
                latest = { obj: n, dateObj: d };
            }
        });

        if (!latest) return;

        // Prefer the note body; fall back to the title if the body is empty.
        const body = flatten(latest.obj.note) || flatten(latest.obj.title);

        try {
            record.submitFields({
                type: record.Type.CUSTOMER,
                id: customerId,
                values: {
                    [CFG.FLD_DATE]:      latest.dateObj,
                    [CFG.FLD_AUTHOR]:    truncateAtWord(latest.obj.author, 100),
                    [CFG.FLD_DIRECTION]: latest.obj.direction || '',
                    [CFG.FLD_TEXT]:      truncateAtWord(body, CFG.TEXT_MAX)
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });
        } catch (e) {
            // Log and move on - one bad customer shouldn't kill the run.
            log.error({
                title: 'submitFields failed for customer ' + customerId,
                details: e.name + ': ' + e.message
            });
        }
    };

    // ---------------------------------------------------------------------
    // summarize
    // ---------------------------------------------------------------------
    const summarize = (summary) => {
        let updated = 0;
        summary.reduceSummary.keys.iterator().each(() => { updated++; return true; });

        let errors = 0;
        summary.reduceSummary.errors.iterator().each((key, err) => {
            errors++;
            log.error({ title: 'Reduce error on customer ' + key, details: err });
            return true;
        });

        summary.mapSummary.errors.iterator().each((key, err) => {
            errors++;
            log.error({ title: 'Map error on note ' + key, details: err });
            return true;
        });

        log.audit({
            title: 'Last-note sync complete',
            details: 'Customers updated: ' + updated +
                     ' | Errors: ' + errors +
                     ' | Usage: ' + summary.usage +
                     ' | Yields: ' + summary.yields
        });
    };

    return { getInputData, map, reduce, summarize };
});
