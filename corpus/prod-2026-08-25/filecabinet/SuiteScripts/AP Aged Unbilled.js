/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * pl_ap_aged_unbilled_sl.js
 * -----------------------------------------------------------------------------
 * AP — "Aged Unbilled Receipts" dashboard (Suitelet).
 *
 * The COMPLEMENT to the AP Genius Pre-Check dashboard:
 *   pl_ap_grab_dashboard_sl  -> what landed recently and needs an invoice grabbed.
 *   this one                 -> what was received a while ago and STILL has no bill.
 *
 * The Pre-Check queue is a recency window; a receipt falls off it after a few days
 * whether or not anyone billed it. Nothing downstream catches the miss either —
 * AP Genius only fires once an invoice EXISTS, so a missing invoice raises no
 * exception anywhere. This dashboard is that backstop.
 *
 * DATA SOURCE OF TRUTH:
 *   Saved search  customsearch_jww_ap_aged_unbilled  ("JWW_AP Aged Unbilled Receipts").
 *   The search owns the population logic (PO status F/E, aged >= 30 days). This
 *   Suitelet never re-derives it — it loads + runs the search on every page load.
 *
 * ENRICHMENT (governance-light):
 *   One chunked SuiteQL pass over previoustransactionlink resolves each PO to its
 *   MOST RECENT item receipt date. This matters: the saved search can only age off
 *   the PO date, because a detail search cannot carry a MAX() over the receipt join
 *   without becoming a summary search. PO 159016 is the canonical example — a
 *   08/15/2023 PO received 02/28/2026, i.e. ~160 days unbilled, not ~1,088.
 *   Days Unbilled (receipt-based) is therefore the PRIMARY metric here; the search's
 *   PO-date aging is kept as a secondary reference column.
 *
 * FLAGGED (not invoice chases):
 *   DATA_ERROR_POS lists POs known to carry bad cost data rather than a missing
 *   invoice — currently the three MZZ1944 unit-of-measure POs. They are pulled out
 *   of the chase list into their own section so nobody spends an afternoon calling
 *   Amazon about $787K of railing wire.
 *
 * COLUMN DEPENDENCY: display values are matched by COLUMN LABEL (same convention as
 *   the Pre-Check Suitelet). If you relabel columns in the saved search, update
 *   LABELS below. Vendor and Location are read with getText() because the search
 *   returns internal IDs for them.
 * -----------------------------------------------------------------------------
 */
define(['N/search', 'N/query', 'N/url', 'N/log'], function (search, query, url, log) {

  var SAVED_SEARCH_ID = 'customsearch_jww_ap_aged_unbilled';

  // Field id of the affiliated-inbound body field, matched on the search column by
  // name so a label change cannot silently break the grouping.
  var INBOUND_FIELD = 'custbody_zas_affiliated_inbounds';

  // Which receipt drives a shipment's age. 'last' = days since the shipment
  // finished landing (is the invoice late?). 'first' = days since the first item
  // landed (how long has the exposure existed?). A shipment still trickling in
  // reads fresh under 'last' and old under 'first'; 'last' is the better chase
  // trigger, and the row detail shows the span either way.
  var SHIPMENT_AGE_BASIS = 'last';   // 'last' | 'first'

  // Rows whose most recent receipt is newer than this are almost certainly still
  // moving through the AP Genius Pre-Check queue (customsearch4065). They are NOT
  // removed — coverage matters more than tidiness, and AP Genius will not raise a
  // second bill against lines already billed. They are flagged and sorted last so
  // the genuinely stale rows stay legible. Measured on the SAME clock as the rest
  // of this dashboard (last item receipt), which is the whole point: 4065 ages by
  // receipt date, and 4413's own search ages by PO date, so without this the two
  // lists overlap ~55%.
  var RECENT_RECEIPT_DAYS = 30;

  // 'flag'    — keep them, badge them, sort them last (default)
  // 'exclude' — drop them entirely for a hard split
  var RECENT_MODE = 'flag';

  // POs that are data errors, not missing invoices. Pulled into the flagged
  // section instead of the chase list. Add internal IDs here as they turn up.
  var DATA_ERROR_POS = {
    926529: 'MZZ1944 — bad unit-of-measure rate ($1,312.25/unit vs $0.13 corrected)',
    926637: 'MZZ1944 — bad unit-of-measure rate ($1,312.25/unit vs $0.13 corrected)',
    929233: 'MZZ1944 — bad unit-of-measure rate ($1,312.25/unit vs $0.13 corrected)'
  };

  // Saved-search column labels read directly (see COLUMN DEPENDENCY note).
  var LABELS = {
    poDate:    'PO Date',
    daysAged:  'Days Aged',
    bucket:    'Aging Bucket',
    inbound:   'Affiliated Inbounds',  // returns inbound shipment INTERNAL ID
    tranid:    'PO #',
    vendor:    'Vendor',          // returns internal id -> use getText
    amount:    'PO Amount',
    status:    'Status',
    location:  'Location',        // returns internal id -> use getText
    memo:      'Memo',
    internalId:'PO Internal ID',
    email:     'Vendor Email',
    phone:     'Vendor Phone'
  };

  // ---------------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------------
  function onRequest(context) {
    if (context.request.method !== 'GET') {
      context.response.write('Method not allowed.');
      return;
    }
    var data;
    try {
      data = buildData();
    } catch (e) {
      log.error({ title: 'AP aged unbilled dashboard build failed', details: e });
      context.response.write(errorPage(e));
      return;
    }
    context.response.write(renderPage(data));
  }

  // ---------------------------------------------------------------------------
  // Build the dataset
  // ---------------------------------------------------------------------------
  function buildData() {
    var s = search.load({ id: SAVED_SEARCH_ID });

    var colByLabel = {};
    s.columns.forEach(function (c) { if (c.label) { colByLabel[c.label] = c; } });

    // Match the affiliated-inbound column by FIELD NAME, not label. NetSuite only
    // populates column.label when a custom label was explicitly set, and this is a
    // relationship field, so a label-only lookup silently yields undefined and every
    // row collapses into one "no inbound" group. Name matching is deterministic and
    // survives relabeling.
    var inbCol = null;
    s.columns.forEach(function (c) {
      if (String(c.name || '').toLowerCase() === INBOUND_FIELD) { inbCol = c; }
    });
    if (!inbCol) {
      inbCol = colByLabel[LABELS.inbound] ||
               colByLabel[String(LABELS.inbound).trim()] || null;
    }
    if (!inbCol) {
      s.columns.forEach(function (c) {
        var l = String(c.label || '').trim().toLowerCase();
        if (!inbCol && l.indexOf('inbound') >= 0) { inbCol = c; }
      });
    }

    var idCol = colByLabel[LABELS.internalId];
    if (!idCol) {
      throw new Error('Could not find the "' + LABELS.internalId + '" column in ' +
        SAVED_SEARCH_ID + '. Update LABELS.internalId if it was relabeled.');
    }

    var recs = [];
    var poIds = [];

    var paged = s.runPaged({ pageSize: 1000 });
    paged.pageRanges.forEach(function (pr) {
      paged.fetch({ index: pr.index }).data.forEach(function (r) {
        var poId = String(readCol(r, idCol) || '').trim();
        // Shipment linkage is deliberately NOT read from the search.
        // custbody_zas_affiliated_inbounds is a Zastro relationship (virtual) field:
        // SuiteQL renders it as the literal string "RELATIONSHIP FIELD" and the
        // SuiteScript search API returns nothing for it on getValue OR getText.
        // It is resolved from inboundshipmentitem below instead.
        recs.push({
          poId:     poId,
          poDate:   readCol(r, colByLabel[LABELS.poDate]),
          poDays:   Math.floor(Number(readCol(r, colByLabel[LABELS.daysAged])) || 0),
          tranid:   stripHtml(readCol(r, colByLabel[LABELS.tranid])),
          vendor:   normNone(stripHtml(readCol(r, colByLabel[LABELS.vendor], true))),
          amount:   Math.abs(Number(readCol(r, colByLabel[LABELS.amount])) || 0),
          status:   poStatusLabel(readCol(r, colByLabel[LABELS.status])),
          loc:      normNone(stripHtml(readCol(r, colByLabel[LABELS.location], true))),
          memo:     stripHtml(readCol(r, colByLabel[LABELS.memo])),
          email:    stripHtml(readCol(r, colByLabel[LABELS.email])),
          phone:    stripHtml(readCol(r, colByLabel[LABELS.phone]))
        });
        if (poId) { poIds.push(poId); }
      });
    });

    // Resolve each PO -> most recent item receipt date + receipt count.
    // previoustransactionlink is used because transaction.createdfrom is not
    // reliably filterable in this account (it throws on an IN predicate).
    var rcpt = {};   // poId -> {last:'MM/DD/YYYY', n:Number}
    chunk(dedupe(poIds), 1000).forEach(function (ids) {
      var sql =
        'SELECT ptl.previousdoc AS poid, ' +
        '       MIN(t.trandate)  AS firstreceipt, ' +
        '       MAX(t.trandate)  AS lastreceipt, ' +
        '       COUNT(t.id)      AS receipts ' +
        'FROM previoustransactionlink ptl ' +
        'JOIN transaction t ON t.id = ptl.nextdoc ' +
        "WHERE t.recordtype = 'itemreceipt' " +
        '  AND ptl.previousdoc IN (' + ids.join(',') + ') ' +
        'GROUP BY ptl.previousdoc';
      try {
        query.runSuiteQL({ query: sql }).asMappedResults().forEach(function (m) {
          rcpt[String(m.poid)] = {
            first: m.firstreceipt || '',
            last:  m.lastreceipt  || '',
            n:     Number(m.receipts) || 0
          };
        });
      } catch (e) {
        // Enrichment is optional — the dashboard still works on PO-date aging.
        log.error({ title: 'Receipt-date enrichment failed (falling back to PO date)', details: e });
      }
    });

    // Resolve PO -> inbound shipment via the NATIVE link (inboundshipmentitem),
    // the same path the AP Genius Pre-Check Suitelet uses. This is the real data
    // model relationship: a PO's lines physically sit on an inbound shipment.
    // externaldocumentnumber is the number the vendor printed on their own
    // paperwork and quotes on their invoice; to them it IS the PO.
    //
    // A PO can appear on more than one shipment (partial fulfilment across
    // containers). We keep the most recent (highest id) as its home shipment and
    // record the count so the row can say so.
    var poShip = {};   // poId  -> {shipId, extDoc, shipCount}
    var seen   = {};   // poId  -> {shipId:1} for distinct counting
    chunk(dedupe(poIds), 1000).forEach(function (ids) {
      var sql =
        'SELECT isi.purchaseordertransaction AS poid, ' +
        '       isi.inboundshipment          AS shipid, ' +
        '       ish.externaldocumentnumber   AS extdoc ' +
        'FROM inboundshipmentitem isi ' +
        'JOIN inboundshipment ish ON ish.id = isi.inboundshipment ' +
        'WHERE isi.purchaseordertransaction IN (' + ids.join(',') + ')';
      try {
        query.runSuiteQL({ query: sql }).asMappedResults().forEach(function (m) {
          var poid = String(m.poid), sid = String(m.shipid);
          if (!seen[poid]) { seen[poid] = {}; }
          seen[poid][sid] = 1;
          if (!poShip[poid] || Number(sid) > Number(poShip[poid].shipId)) {
            poShip[poid] = { shipId: sid, extDoc: m.extdoc || '' };
          }
        });
      } catch (e) {
        log.error({ title: 'Inbound shipment resolution failed', details: e });
      }
    });
    Object.keys(poShip).forEach(function (poid) {
      poShip[poid].shipCount = Object.keys(seen[poid] || {}).length;
    });

    // How many POs on THIS list share each inbound. A vendor invoice usually
    // covers the whole shipment, so >1 means one document clears several rows.
    var shipPoCount = {};
    recs.forEach(function (b) {
      var ps = poShip[b.poId];
      if (ps) { shipPoCount[ps.shipId] = (shipPoCount[ps.shipId] || 0) + 1; }
    });

    var rows = [], flagged = [];

    recs.forEach(function (b) {
      var r   = rcpt[b.poId] || null;
      var rdL = r ? r.last  : '';
      var rdF = r ? r.first : '';
      var rdays  = rdL ? daysBetween(rdL) : null;
      var rdaysF = rdF ? daysBetween(rdF) : null;

      // Receipt-based age is the real measure; fall back to PO age if unresolved.
      var days = (rdays === null) ? b.poDays : rdays;

      var sh = poShip[b.poId] || null;

      var row = {
        poId:       b.poId,
        vendor:     b.vendor || '(unidentified)',
        tranid:     b.tranid || ('PO ' + b.poId),
        poUrl:      recordUrl('purchaseorder', b.poId),
        shipId:     sh ? sh.shipId : '',
        inboundDoc: sh ? sh.extDoc : '',
        inboundUrl: sh ? recordUrl('inboundshipment', sh.shipId) : '',
        shipShare:  sh ? (shipPoCount[sh.shipId] || 1) : 0,
        shipSpan:   sh ? (sh.shipCount || 1) : 0,
        poDate:   b.poDate || '',
        poDays:   b.poDays,
        rcptDate:  rdL,
        rcptFirst: rdF,
        rcptN:     r ? r.n : 0,
        days:      days,
        daysFirst: (rdaysF === null) ? b.poDays : rdaysF,
        est:      (rdays === null),      // aging is estimated from PO date
        recent:   (rdays !== null && rdays < RECENT_RECEIPT_DAYS),
        bucket:   bucketFor(days),
        amount:   b.amount,
        status:   b.status,
        loc:      b.loc,
        memo:     b.memo,
        email:    b.email,
        phone:    b.phone
      };

      if (RECENT_MODE === 'exclude' && row.recent) {
        return;   // hard split: recently received rows belong to the Pre-Check queue
      }

      if (DATA_ERROR_POS[b.poId]) {
        row.reason = DATA_ERROR_POS[b.poId];
        flagged.push(row);
      } else {
        rows.push(row);
      }
    });

    var resolved = 0;
    rows.forEach(function (r) { if (r.shipId) { resolved++; } });
    flagged.forEach(function (r) { if (r.shipId) { resolved++; } });

    return {
      rows: rows,
      flagged: flagged,
      pulled: nowStamp(),
      diag: {
        colFound:  !!inbCol,
        colName:   inbCol ? String(inbCol.name || '') : '',
        colLabel:  inbCol ? String(inbCol.label || '') : '',
        total:     recs.length,
        resolved:  resolved
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function readCol(result, col, preferText) {
    if (!col) { return ''; }
    if (preferText) {
      var t = result.getText(col);
      if (t) { return t; }
    }
    var v = result.getValue(col);
    return (v == null) ? '' : v;
  }

  function stripHtml(s) {
    return String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim();
  }

  function normNone(s) {
    var t = String(s == null ? '' : s).trim();
    return (t === '- None -' || t.toLowerCase() === 'none') ? '' : t;
  }

  function recordUrl(type, id) {
    if (!id) { return ''; }
    try {
      return url.resolveRecord({ recordType: type, recordId: id, isEditMode: false });
    } catch (e) {
      log.error({ title: 'recordUrl failed for ' + type + ' ' + id, details: e });
      return '';
    }
  }

  // 'MM/DD/YYYY' -> whole days elapsed to today.
  function daysBetween(mdY) {
    var p = String(mdY).split('/');
    if (p.length !== 3) { return null; }
    var then = new Date(Number(p[2]), Number(p[0]) - 1, Number(p[1]));
    if (isNaN(then.getTime())) { return null; }
    var now = new Date();
    var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((t0 - then) / 86400000);
  }

  function bucketFor(d) {
    if (d > 180) { return '4. Over 180 days'; }
    if (d >  90) { return '3. 91-180 days'; }
    if (d >  60) { return '2. 61-90 days'; }
    return '1. 30-60 days';
  }

  // The saved search returns raw status strings ('pendingBilling'), not F/E codes.
  function poStatusLabel(code) {
    var raw = String(code == null ? '' : code).trim();
    var map = {
      pendingbilling:            'Pending Billing',
      pendingbillpartreceived:   'Partially Received/Pending Billing',
      f:                         'Pending Billing',
      e:                         'Partially Received/Pending Billing'
    };
    var k = raw.replace(/^.*:/, '').toLowerCase();
    return map[k] || raw;
  }

  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) { out.push(arr.slice(i, i + size)); }
    return out;
  }

  function dedupe(arr) {
    var seen = {}, out = [];
    arr.forEach(function (v) { if (!seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  }

  function two(n) { return (n < 10 ? '0' : '') + n; }
  function nowStamp() {
    var d = new Date();
    return two(d.getMonth() + 1) + '/' + two(d.getDate()) + '/' + d.getFullYear() +
           ' ' + two(d.getHours()) + ':' + two(d.getMinutes());
  }

  function errorPage(e) {
    return '<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#9a2a00">' +
           '<h3>Dashboard could not load</h3><p>' +
           String((e && e.message) || e).replace(/</g, '&lt;') +
           '</p><p style="color:#5d7383">Check that saved search ' + SAVED_SEARCH_ID +
           ' exists and the running role can view it.</p></body></html>';
  }

  // ---------------------------------------------------------------------------
  // Client-side dashboard app (stringified into the page; never runs server-side)
  // ---------------------------------------------------------------------------
  function clientApp() {
    var body = document.getElementById('body');
    var state = { q: '', vend: '', loc: '', bucket: '', view: 'ship', sort: 'days', dir: -1, open: {}, hideRecent: false };

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function money(n) { var v = Number(n) || 0; return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function compact(n) {
      var v = Number(n) || 0;
      if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
      if (v >= 1000)    return '$' + (v / 1000).toFixed(1) + 'K';
      return '$' + v.toFixed(0);
    }
    function pd(d) { var p = String(d).split('/').map(Number); return (p[2] || 0) * 10000 + (p[0] || 0) * 100 + (p[1] || 0); }
    function bClass(b) {
      if (b.indexOf('4.') === 0) return 'b-d';
      if (b.indexOf('3.') === 0) return 'b-c';
      if (b.indexOf('2.') === 0) return 'b-b';
      return 'b-a';
    }
    function bShort(b) { return b.replace(/^\d\.\s*/, ''); }

    Array.from(new Set(ROWS.map(function (r) { return r.vendor; }))).sort().forEach(function (v) {
      var o = document.createElement('option'); o.value = v; o.textContent = v;
      document.getElementById('fvend').appendChild(o);
    });
    Array.from(new Set(ROWS.map(function (r) { return r.loc; }).filter(Boolean))).sort().forEach(function (v) {
      var o = document.createElement('option'); o.value = v; o.textContent = v;
      document.getElementById('floc').appendChild(o);
    });

    function filt() {
      return ROWS.filter(function (r) {
        if (state.hideRecent && r.recent) return false;
        if (state.vend && r.vendor !== state.vend) return false;
        if (state.loc && r.loc !== state.loc) return false;
        if (state.bucket && bClass(r.bucket) !== state.bucket) return false;
        if (state.q) {
          var s = (r.vendor + ' ' + r.inboundDoc + ' ' + r.tranid + ' ' + r.loc + ' ' +
                   r.memo + ' ' + r.email).toLowerCase();
          if (s.indexOf(state.q.toLowerCase()) < 0) return false;
        }
        return true;
      });
    }
    function srt(rows) {
      var k = state.sort, d = state.dir;
      return rows.slice().sort(function (a, b) {
        if (a.recent !== b.recent) return a.recent ? 1 : -1;   // in-flight last
        var av, bv;
        if (k === 'days' || k === 'amount' || k === 'poDays') { av = Number(a[k]) || 0; bv = Number(b[k]) || 0; }
        else if (k === 'rcptDate') { av = pd(a.rcptDate); bv = pd(b.rcptDate); }
        else if (k === 'poDate')   { av = pd(a.poDate);   bv = pd(b.poDate); }
        else { av = String(a[k] || '').toLowerCase(); bv = String(b[k] || '').toLowerCase(); }
        return av < bv ? -1 * d : av > bv ? 1 * d : 0;
      });
    }
    function contactH(r) {
      var bits = [];
      if (r.email) bits.push('<a class="mail" href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>');
      if (r.phone) bits.push('<span class="ph">' + esc(r.phone) + '</span>');
      return bits.length ? bits.join('<br>') : '<span class="so">&mdash;</span>';
    }
    function inboundH(r) {
      if (!r.inboundDoc && !r.inboundUrl) {
        return '<span class="inb none" title="No affiliated inbound shipment on this PO">&mdash;</span>';
      }
      var label = r.inboundDoc || '(no ext #)';
      var core = r.inboundUrl
        ? '<a class="doc" href="' + r.inboundUrl + '" target="_blank" rel="noopener" title="Open inbound shipment">' + esc(label) + '</a>'
        : '<span class="doc">' + esc(label) + '</span>';
      var multi = (r.shipSpan > 1)
        ? '<span class="badge b-multi" title="This PO appears on ' + r.shipSpan + ' inbound shipments; shown under the most recent">' + r.shipSpan + ' ships</span>'
        : '';
      var share = (r.shipShare > 1)
        ? '<span class="badge b-share" title="' + r.shipShare + ' unbilled POs on this list share this inbound — one vendor invoice likely covers them all">&times;' + r.shipShare + '</span>'
        : '';
      return core + share + multi;
    }
    function rowH(r, child) {
      var po = r.poUrl
        ? '<a class="doc po" href="' + r.poUrl + '" target="_blank" rel="noopener" title="Open purchase order">' + esc(r.tranid) + '</a>'
        : '<span class="doc po">' + esc(r.tranid) + '</span>';
      var recv = r.rcptDate
        ? '<span class="mono">' + esc(r.rcptDate) + '</span>' +
          (r.rcptN > 1 ? '<span class="so"> &middot; ' + r.rcptN + ' rcpts</span>' : '')
        : '<span class="so">unresolved</span>';
      var dayCell = (r.recent ? '<span class="badge b-inflight" title="Under ' + RECENT_DAYS + ' days since receipt \u2014 likely still on the Pre-Check queue">in flight</span> ' : '') +
        '<span class="dnum">' + r.days + '</span>' +
        (r.est ? '<span class="estflag" title="No receipt link resolved — aged from PO date">~</span>' : '');
      return '<tr class="' + (child ? 'kid' : '') + '">' +
        '<td class="tw"></td>' +
        '<td><span class="vname">' + esc(r.vendor) + '</span>' +
          (r.memo ? '<div class="memo">' + esc(r.memo) + '</div>' : '') + '</td>' +
        '<td>' + (child ? '<span class="kidtick">&#8627;</span>' : inboundH(r)) + '</td>' +
        '<td>' + po + '</td>' +
        '<td>' + recv + '</td>' +
        '<td class="num">' + dayCell + '</td>' +
        '<td><span class="badge ' + bClass(r.bucket) + '">' + esc(bShort(r.bucket)) + '</span></td>' +
        '<td class="num">' + money(r.amount) + '</td>' +
        '<td><span class="loc">' + esc(r.loc) + '</span></td>' +
        '<td class="contact">' + contactH(r) + '</td>' +
        '<td class="ref mono">' + esc(r.poDate) + '</td>' +
        '<td class="ref num">' + r.poDays + '</td>' +
        '<td class="ref"><span class="pill">' + esc(r.status) + '</span></td></tr>';
    }
    // Roll filtered rows up to the inbound shipment — the unit the vendor bills.
    // POs with no affiliated inbound collect into a single synthetic group so
    // nothing silently disappears from the list.
    function shipGroups(rows) {
      var map = {}, order = [];
      rows.forEach(function (r) {
        // A PO with no inbound is not "affiliated with a vendor" — the affiliation
        // is PO -> inbound shipment. Those POs get one group PER VENDOR so the row
        // reads as what it is: POs billed directly, no consolidating shipment.
        var k = r.shipId ? ('s' + r.shipId) : ('d' + r.vendor);
        if (!map[k]) {
          map[k] = { key: k, doc: r.inboundDoc, url: r.inboundUrl, direct: !r.shipId,
                     vend: {}, n: 0, amt: 0, first: '', last: '',
                     ageLast: 1e9, ageFirst: 0, rcpts: 0, rows: [] };
          order.push(k);
        }
        var g = map[k];
        g.rows.push(r);
        g.n += 1;
        g.amt += Number(r.amount) || 0;
        g.rcpts += Number(r.rcptN) || 0;
        g.vend[r.vendor] = 1;
        if (r.rcptFirst && (!g.first || pd(r.rcptFirst) < pd(g.first))) g.first = r.rcptFirst;
        if (r.rcptDate  && (!g.last  || pd(r.rcptDate)  > pd(g.last)))  g.last  = r.rcptDate;
        g.ageLast  = Math.min(g.ageLast,  Number(r.days) || 0);
        g.ageFirst = Math.max(g.ageFirst, Number(r.daysFirst) || 0);
        if (!r.recent) { g.hasAged = true; }
      });
      return order.map(function (k) {
        var g = map[k];
        g.vendors = Object.keys(g.vend);
        g.days = (AGE_BASIS === 'first') ? g.ageFirst : g.ageLast;
        g.bucket = g.days > 180 ? '4. Over 180 days'
                 : g.days >  90 ? '3. 91-180 days'
                 : g.days >  60 ? '2. 61-90 days' : '1. 30-60 days';
        g.span = (g.first && g.last && g.first !== g.last) ? (g.ageFirst - g.ageLast) : 0;
        g.recent = !g.hasAged;   // every PO on this shipment landed inside the window
        return g;
      });
    }

    function shipHeadH(g) {
      var label = g.direct
        ? '<span class="direct" title="These POs have no inbound shipment consolidating them, so there is no vendor-facing shipment number \u2014 chase them on the NS PO #">Direct \u2014 no inbound shipment</span>'
        : (g.url
            ? '<a class="doc big" href="' + g.url + '" target="_blank" rel="noopener" title="Open inbound shipment">' + esc(g.doc || '(no ext #)') + '</a>'
            : '<span class="doc big">' + esc(g.doc || '(no ext #)') + '</span>');
      var vend = g.vendors.length === 1
        ? esc(g.vendors[0])
        : g.vendors.length + ' vendors on this shipment';
      var inflight = g.recent
        ? '<span class="badge b-inflight" title="Most recent receipt is under ' + RECENT_DAYS + ' days old \u2014 almost certainly still in the AP Genius Pre-Check queue. Left on this list deliberately; not a duplicate risk.">in flight</span>'
        : '';
      var span = g.span > 0
        ? '<span class="span" title="Receipts landed across ' + g.span + ' days: ' + esc(g.first) + ' to ' + esc(g.last) + '">' + esc(g.first) + ' &rarr; ' + esc(g.last) + '</span>'
        : '<span class="span">' + ((g.last || g.first) ? esc(g.last || g.first) : '&mdash;') + '</span>';
      return '<tr class="ship' + (state.open[g.key] ? ' open' : '') + '" data-g="' + esc(g.key) + '">' +
        '<td class="tw"><span class="tw-i">' + (state.open[g.key] ? '&#9662;' : '&#9656;') + '</span></td>' +
        '<td class="sv">' + vend + '</td>' +
        '<td>' + label + inflight + '</td>' +
        '<td class="num"><span class="pocount">' + g.n + (g.n === 1 ? ' PO' : ' POs') + '</span></td>' +
        '<td>' + span + '</td>' +
        '<td class="num"><span class="dnum">' + g.days + '</span></td>' +
        '<td><span class="badge ' + bClass(g.bucket) + '">' + esc(bShort(g.bucket)) + '</span></td>' +
        '<td class="num strong">' + money(g.amt) + '</td>' +
        '<td colspan="5"></td></tr>';
    }

    function render() {
      var rows = filt();
      document.getElementById('empty').style.display = rows.length ? 'none' : 'block';

      if (state.view === 'ship') {
        var groups = shipGroups(rows);
        groups.sort(function (a, b) {
          if (a.recent !== b.recent) return a.recent ? 1 : -1;   // in-flight last
          if (a.direct !== b.direct) return a.direct ? 1 : -1;
          return (b.days - a.days) || (b.amt - a.amt);
        });
        document.getElementById('shown').textContent =
          groups.length + ' inbound' + (groups.length === 1 ? '' : 's') +
          ' \u00b7 ' + rows.length + ' PO' + (rows.length === 1 ? '' : 's') +
          ' \u00b7 ' + compact(rows.reduce(function (a, r) { return a + (Number(r.amount) || 0); }, 0));
        var out = '';
        groups.forEach(function (g) {
          out += shipHeadH(g);
          if (state.open[g.key]) {
            out += srt(g.rows).map(function (r) { return rowH(r, true); }).join('');
          }
        });
        body.innerHTML = out;
      } else {
        document.getElementById('shown').textContent =
          rows.length + ' of ' + ROWS.length + ' \u00b7 ' +
          compact(rows.reduce(function (a, r) { return a + (Number(r.amount) || 0); }, 0));

        if (state.view === 'vendor') {
          var agg = {};
          rows.forEach(function (r) {
            if (!agg[r.vendor]) agg[r.vendor] = { n: 0, amt: 0, max: 0 };
            agg[r.vendor].n += 1;
            agg[r.vendor].amt += Number(r.amount) || 0;
            agg[r.vendor].max = Math.max(agg[r.vendor].max, Number(r.days) || 0);
          });
          rows = rows.slice().sort(function (a, b) {
            var d = (agg[b.vendor].amt - agg[a.vendor].amt);
            if (d) return d;
            var x = a.vendor.toLowerCase(), y = b.vendor.toLowerCase();
            if (x !== y) return x < y ? -1 : 1;
            return b.days - a.days;
          });
          var html = '', last = null;
          rows.forEach(function (r) {
            if (r.vendor !== last) {
              var a = agg[r.vendor];
              html += '<tr class="grp"><td colspan="12">' + esc(r.vendor) +
                '<span class="gc">' + a.n + ' PO' + (a.n > 1 ? 's' : '') +
                ' \u00b7 ' + money(a.amt) + ' \u00b7 oldest ' + a.max + 'd</span></td></tr>';
              last = r.vendor;
            }
            html += rowH(r);
          });
          body.innerHTML = html;
        } else {
          body.innerHTML = srt(rows).map(function (r) { return rowH(r); }).join('');
        }
      }

      document.body.classList.toggle('ship-view', state.view === 'ship');
      Array.prototype.forEach.call(document.querySelectorAll('thead th'), function (th) {
        var k = th.getAttribute('data-k');
        if (k === state.sort) th.classList.add('act'); else th.classList.remove('act');
        var a = th.querySelector('.arr');
        if (a) a.textContent = (k === state.sort && state.dir === 1) ? '^' : 'v';
      });
    }

    // Fail loudly if the inbound column stopped resolving. The first version of
    // this dashboard collapsed all 723 POs into one group and looked plausible.
    if (DIAG.total && DIAG.resolved === 0) {
      var dg = document.getElementById('diag');
      dg.style.display = 'block';
      dg.innerHTML = '<b>Inbound grouping unavailable.</b> The <code>inboundshipmentitem</code> ' +
        'lookup returned no shipment for any of ' + DIAG.total + ' POs, so everything is showing ' +
        'as direct. Check the Execution Log for a SuiteQL error.';
    } else if (DIAG.total && DIAG.resolved / DIAG.total < 0.5) {
      var dg2 = document.getElementById('diag');
      dg2.style.display = 'block';
      dg2.innerHTML = '<b>Low inbound coverage.</b> Only ' + DIAG.resolved + ' of ' + DIAG.total +
        ' POs resolved to an inbound shipment (expected roughly 88%). Worth a look before ' +
        'trusting the grouping.';
    }

    var totalVal = ROWS.reduce(function (a, r) { return a + (Number(r.amount) || 0); }, 0);
    var over90   = ROWS.filter(function (r) { return r.days > 90; });
    document.getElementById('k-po').textContent   = shipGroups(ROWS).length;
    var inflightN = ROWS.filter(function (r) { return r.recent; }).length;
    document.getElementById('k-posub').textContent =
      ROWS.length + ' POs' + (inflightN ? ' \u00b7 ' + inflightN + ' in flight' : '');
    document.getElementById('k-val').textContent  = compact(totalVal);
    document.getElementById('k-90').textContent   = over90.length;
    document.getElementById('k-90s').textContent  =
      compact(over90.reduce(function (a, r) { return a + (Number(r.amount) || 0); }, 0)) + ' at risk';
    document.getElementById('k-vend').textContent = new Set(ROWS.map(function (r) { return r.vendor; })).size;

    if (FLAGGED.length) {
      document.getElementById('flagWrap').style.display = 'block';
      document.getElementById('flagCount').textContent = FLAGGED.length;
      document.getElementById('flagRows').innerHTML = FLAGGED.map(function (r) {
        var po = r.poUrl
          ? '<a class="doc" href="' + r.poUrl + '" target="_blank" rel="noopener">' + esc(r.tranid) + '</a>'
          : esc(r.tranid);
        return '<tr><td class="mono" style="font-weight:600">' + po + '</td>' +
          '<td>' + esc(r.vendor) + '</td>' +
          '<td class="mono">' + esc(r.rcptDate || r.poDate) + '</td>' +
          '<td class="num">' + money(r.amount) + '</td>' +
          '<td><span class="reason">' + esc(r.reason) + '</span></td></tr>';
      }).join('');
      document.getElementById('flagTotal').textContent =
        money(FLAGGED.reduce(function (a, r) { return a + (Number(r.amount) || 0); }, 0));
    }

    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
    document.getElementById('fvend').addEventListener('change', function (e) { state.vend = e.target.value; render(); });
    document.getElementById('floc').addEventListener('change', function (e) { state.loc = e.target.value; render(); });
    document.getElementById('fview').addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') return;
      state.view = e.target.getAttribute('data-v');
      Array.prototype.forEach.call(document.querySelectorAll('#fview button'), function (b) {
        if (b === e.target) b.classList.add('on'); else b.classList.remove('on');
      });
      document.getElementById('expandWrap').style.visibility =
        (state.view === 'ship') ? 'visible' : 'hidden';
      render();
    });
    document.getElementById('hideRecent').addEventListener('change', function (e) {
      state.hideRecent = e.target.checked;
      state.open = {};
      document.getElementById('expandAll').checked = false;
      render();
    });
    document.getElementById('expandAll').addEventListener('change', function (e) {
      state.open = {};
      if (e.target.checked) {
        shipGroups(filt()).forEach(function (g) { state.open[g.key] = true; });
      }
      render();
    });
    body.addEventListener('click', function (e) {
      var tr = e.target.closest ? e.target.closest('tr.ship') : null;
      if (!tr) return;
      var k = tr.getAttribute('data-g');
      state.open[k] = !state.open[k];
      render();
    });
    document.getElementById('refToggle').addEventListener('change', function (e) { document.body.classList.toggle('show-ref', e.target.checked); });
    document.getElementById('fbucket').addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') return;
      state.bucket = e.target.getAttribute('data-b');
      Array.prototype.forEach.call(document.querySelectorAll('#fbucket button'), function (b) {
        if (b === e.target) b.classList.add('on'); else b.classList.remove('on');
      });
      render();
    });
    Array.prototype.forEach.call(document.querySelectorAll('thead th'), function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (!k) return;
        if (state.sort === k) state.dir *= -1; else { state.sort = k; state.dir = -1; }
        render();
      });
    });
    var fb = document.getElementById('flagBody'), fc = document.getElementById('flagChev');
    document.getElementById('flagHead').addEventListener('click', function () {
      var open = fb.style.display !== 'none';
      fb.style.display = open ? 'none' : 'block';
      fc.textContent = open ? 'v show' : '^ hide';
    });

    render();
  }

  // ---------------------------------------------------------------------------
  // Page shell
  // ---------------------------------------------------------------------------
  function renderPage(data) {
    var rowsJson = JSON.stringify(data.rows).replace(/</g, '\\u003c');
    var flagJson = JSON.stringify(data.flagged).replace(/</g, '\\u003c');
    var clientSrc = '(' + clientApp.toString() + ')();';

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>AP &mdash; Aged Unbilled Receipts</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">' +
      '<style>' + CSS + '</style></head><body>' +

      '<header class="top"><div class="wrap">' +
        '<div><h1>AP &mdash; Aged Unbilled Receipts</h1>' +
        '<div class="sub">Goods received, invoice never arrived. The Pre-Check queue is a recency window &mdash; a receipt drops off it after a few days whether or not it was billed, and AP Genius only fires once an invoice exists. This is the backstop for what fell through.</div></div>' +
        '<div class="meta">Live from <b>JWW_AP Aged Unbilled Receipts</b><br>(customsearch_jww_ap_aged_unbilled)<br>Refreshed <b>' + data.pulled + '</b>' +
        '<br><button class="refresh" onclick="location.reload()">&#8635; Refresh</button></div>' +
      '</div></header>' +

      '<div class="wrap">' +
        '<div class="kpis">' +
          '<div class="kpi"><div class="n" id="k-po">0</div><div class="l">Inbounds to chase <span id="k-posub" class="sm2"></span></div></div>' +
          '<div class="kpi multi"><div class="n" id="k-val">$0</div><div class="l">Total value</div></div>' +
          '<div class="kpi alert"><div class="n" id="k-90">0</div><div class="l">Over 90 days <span id="k-90s" class="sm"></span></div></div>' +
          '<div class="kpi good"><div class="n" id="k-vend">0</div><div class="l">Vendors to chase</div></div>' +
        '</div>' +

        '<div class="diag" id="diag" style="display:none;"></div>' +

        '<p class="sectlabel">Chase list <span class="qual">&middot; aged by receipt date</span> ' +
          '<span class="shown" id="shown"></span></p>' +
        '<div class="controls">' +
          '<input type="text" id="q" placeholder="Search vendor, PO #, memo, email…">' +
          '<select id="fvend"><option value="">All vendors</option></select>' +
          '<select id="floc"><option value="">All locations</option></select>' +
          '<div class="seg" id="fbucket">' +
            '<button data-b="" class="on">All</button>' +
            '<button data-b="b-a">30-60</button>' +
            '<button data-b="b-b">61-90</button>' +
            '<button data-b="b-c">91-180</button>' +
            '<button data-b="b-d">180+</button>' +
          '</div>' +
          '<div class="seg" id="fview">' +
            '<button data-v="ship" class="on" title="One row per inbound shipment \u2014 the unit the vendor invoices">By inbound</button>' +
            '<button data-v="po" title="Flat list, one row per purchase order">By PO</button>' +
            '<button data-v="vendor" title="Grouped by vendor">By vendor</button>' +
          '</div>' +
          '<label class="toggle" id="expandWrap"><input type="checkbox" id="expandAll"> Expand all</label>' +
          '<label class="toggle" style="margin-left:14px" title="Hide rows received in the last 30 days \u2014 those are still moving through the AP Genius Pre-Check queue"><input type="checkbox" id="hideRecent"> Hide in-flight</label>' +
          '<label class="toggle" style="margin-left:14px"><input type="checkbox" id="refToggle"> Show PO date / status</label>' +
        '</div>' +

        '<div class="panel"><table id="tbl"><thead><tr>' +
          '<th class="tw"></th>' +
          '<th data-k="vendor">Vendor<span class="arr">v</span></th>' +
          '<th data-k="inboundDoc">Inbound / PO #<span class="arr">v</span></th>' +
          '<th data-k="tranid">NS PO #<span class="arr">v</span></th>' +
          '<th data-k="rcptDate">Received<span class="arr">v</span></th>' +
          '<th data-k="days">Days Unbilled<span class="arr">v</span></th>' +
          '<th data-k="bucket">Bucket<span class="arr">v</span></th>' +
          '<th data-k="amount">Amount<span class="arr">v</span></th>' +
          '<th data-k="loc">Location<span class="arr">v</span></th>' +
          '<th>Contact</th>' +
          '<th data-k="poDate" class="ref">PO Date<span class="arr">v</span></th>' +
          '<th data-k="poDays" class="ref">Days Since PO<span class="arr">v</span></th>' +
          '<th class="ref">PO Status</th>' +
        '</tr></thead><tbody id="body"></tbody></table>' +
        '<div class="empty" id="empty" style="display:none;">No POs match the current filters.</div></div>' +

        '<div id="flagWrap" style="display:none;">' +
        '<div class="excl-head" id="flagHead">' +
          '<h2><span class="tag">Do not chase</span> Flagged &mdash; data errors, not missing invoices ' +
          '(<span id="flagCount">0</span>)</h2>' +
          '<span class="chev" id="flagChev">v show</span></div>' +
        '<div class="excl-body" id="flagBody" style="display:none;"><div class="panel"><table><thead><tr>' +
          '<th>PO #</th><th>Vendor</th><th>Received</th><th>Amount</th><th>Why it is flagged</th>' +
          '</tr></thead><tbody id="flagRows"></tbody></table></div>' +
          '<div class="excl-note">These carry bad cost data rather than a missing invoice, so no vendor invoice exists to collect &mdash; total <b id="flagTotal">$0</b>. ' +
          'They need the receipts corrected and the POs closed. Maintain the list in DATA_ERROR_POS at the top of the Suitelet.</div></div></div>' +

        '<div class="foot">' +
          '<b>How to read this:</b> each row is a purchase order that has been received but never billed. ' +
          '<b>Inbound / PO #</b> is the inbound shipment&rsquo;s external document number &mdash; the number the vendor printed on their own paperwork and quotes on their invoice. To them, that IS the PO, so lead with it on every call; the NS PO # is internal. It opens the inbound shipment. A <b>&times;N</b> badge means N unbilled POs on this list share that inbound, so one invoice likely clears all of them. ' +
          '<b>Days Unbilled</b> is measured from the most recent item receipt, not the PO date &mdash; a 2023 PO received last quarter is ~100 days unbilled, not ~1,000. A <b>~</b> means no receipt link resolved and the age falls back to PO date. ' +
          '<b>Contact</b> is on the row because this list is worked by asking vendors for copy invoices, not by data entry. ' +
          '<b>By inbound</b> is the default and the view to work from: the inbound consolidates several POs onto one transaction for the vendor, so it is the pseudo-PO end to end and one invoice normally settles the whole shipment. Click a row to see the POs inside it. ' +
          '<b>Receipts</b> often land across several dates on one shipment, so the header shows the span (first &rarr; last); shipment age is measured from the <b>last</b> receipt, i.e. when it became fully invoiceable. Change SHIPMENT_AGE_BASIS to \'first\' to age from the earliest instead. ' +
          '<b>No affiliated inbound</b> collects POs with no shipment link; those are chased on the NS PO # directly. ' +
          '<b>In flight</b> marks rows received in the last 30 days &mdash; those are still moving through the AP Genius Pre-Check queue and usually clear themselves. They are kept here on purpose (coverage beats tidiness, and AP Genius will not raise a second bill against lines already billed) but sorted last so genuinely stale rows stay on top. Use <b>Hide in-flight</b> for the pure chase list. ' +
          '<b>A row leaves this list</b> when its PO reaches Fully Billed or Closed. ' +
          '<b>Live</b> &mdash; re-pulls the saved search on load, or hit Refresh.' +
        '</div>' +
      '</div>' +

      '<script>var ROWS=' + rowsJson + ';var FLAGGED=' + flagJson +
        ";var AGE_BASIS='" + SHIPMENT_AGE_BASIS + "';" +
        'var RECENT_DAYS=' + RECENT_RECEIPT_DAYS + ';' +
        'var DIAG=' + JSON.stringify({
          colFound: data.diag.colFound, colName: data.diag.colName,
          colLabel: data.diag.colLabel, total: data.diag.total,
          resolved: data.diag.resolved, field: INBOUND_FIELD
        }) + ';' + clientSrc + '</' + 'script>' +
      '</body></html>';
  }

  var CSS =
    ":root{--navy:#003764;--navy-2:#0a4a7a;--ink:#13232f;--muted:#5d7383;--bg:#d9dadb;--card:#fff;--line:#dbe3ea;--link:#36677D;--alert:#D64700;--good:#3D7A41;--multi:#8a5a00;--multi-bg:#fbeecf;--rma:#9a2a00;--rma-bg:#fbe3d8;--po:#0a4a7a;--po-bg:#e6eef6;}" +
    "*{box-sizing:border-box;}body{margin:0;background:var(--bg);color:var(--ink);font-family:'IBM Plex Sans',-apple-system,sans-serif;font-size:14px;line-height:1.45;}" +
    ".mono{font-family:'IBM Plex Mono',monospace;font-size:12.5px;}.wrap{max-width:1320px;margin:0 auto;padding:0 20px 20px;}" +
    "header.top{background:linear-gradient(105deg,var(--navy),var(--navy-2));color:#fff;padding:12px 0 5px;border-bottom:3px solid var(--alert);}" +
    "header.top .wrap{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;}" +
    "header.top h1{margin:0;font-size:23px;font-weight:700;letter-spacing:-.3px;}header.top .sub{margin-top:6px;font-size:12.5px;color:#bcd3e6;max-width:720px;}" +
    "header.top .meta{font-size:11.5px;color:#9cbdd6;text-align:right;line-height:1.6;}header.top .meta b{color:#fff;font-weight:600;}" +
    ".kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:11px 0 9px;}" +
    ".kpi{background:var(--card);border:1px solid var(--line);border-radius:5px;padding:8px;position:relative;overflow:hidden;}" +
    ".kpi:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--navy);}" +
    ".kpi.good:before{background:var(--good);}.kpi.multi:before{background:var(--multi);}.kpi.alert:before{background:var(--alert);}" +
    ".kpi .n{font-size:30px;font-weight:700;font-family:'IBM Plex Mono',monospace;letter-spacing:-1px;line-height:1;}" +
    ".kpi .l{font-size:11.5px;color:var(--muted);margin-top:7px;text-transform:uppercase;letter-spacing:.5px;}" +
    ".kpi .sm{text-transform:none;letter-spacing:0;color:var(--alert);font-weight:600;margin-left:5px;}" +
    ".controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:7px;}" +
    ".controls input[type=text],.controls select{font-family:inherit;font-size:13px;padding:4px 11px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);min-width:150px;}" +
    ".controls input[type=text]{min-width:250px;}" +
    ".seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff;}" +
    ".seg button{border:0;background:#fff;padding:8px 12px;font:inherit;font-size:12.5px;cursor:pointer;color:var(--muted);border-right:1px solid var(--line);}" +
    ".seg button:last-child{border-right:0;}.seg button.on{background:var(--navy);color:#fff;font-weight:600;}" +
    ".toggle{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);cursor:pointer;user-select:none;}" +
    ".toggle:first-of-type{margin-left:auto;}.toggle input{width:16px;height:16px;accent-color:var(--navy);}" +
    ".panel{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;}" +
    "table{width:100%;border-collapse:collapse;}" +
    "thead th{background:#f4f7f9;color:var(--navy);font-size:11px;text-transform:uppercase;letter-spacing:.6px;text-align:left;padding:11px 12px;border-bottom:2px solid var(--line);cursor:pointer;white-space:nowrap;position:sticky;top:0;z-index:2;}" +
    "thead th .arr{opacity:.35;font-size:10px;margin-left:3px;}thead th.act .arr{opacity:1;}" +
    "tbody td{padding:9px 12px;border-bottom:1px solid #d9dadb;vertical-align:top;}tbody tr:hover{background:#f7fafc;}" +
    "tr.grp td{background:#eaf0f5;font-weight:600;color:var(--navy);font-size:12px;text-transform:uppercase;letter-spacing:.5px;padding:8px 7px;}" +
    "tr.grp td .gc{color:var(--muted);font-weight:500;text-transform:none;letter-spacing:0;margin-left:8px;font-size:11.5px;}" +
    ".vname{font-weight:600;}.memo{font-size:11.5px;color:var(--muted);margin-top:2px;max-width:260px;}" +
    "a.doc{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--link);font-weight:500;text-decoration:none;border-bottom:1px dotted rgba(54,103,125,.5);}a.doc:hover{border-bottom-style:solid;}" +
    ".badge{display:inline-block;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;}" +
    ".b-a{background:#eef6ef;color:var(--good);}.b-b{background:var(--multi-bg);color:var(--multi);}" +
    ".b-c{background:#fbe3d8;color:var(--rma);}.b-d{background:var(--alert);color:#fff;}" +
    ".b-share{background:var(--po-bg);color:var(--po);margin-left:6px;cursor:help;}" +
    "th.tw,td.tw{width:26px;padding-left:10px;padding-right:0;}" +
    "tr.ship{cursor:pointer;background:#eef3f7;}tr.ship:hover{background:#e3ebf2;}" +
    "tr.ship td{border-bottom:1px solid #c9d6e0;padding-top:11px;padding-bottom:11px;}" +
    "tr.ship .tw-i{color:var(--navy);font-size:11px;}" +
    "tr.ship a.doc.big{font-size:14px;font-weight:600;}" +
    "tr.ship .sv{font-size:12.5px;color:var(--ink);font-weight:600;}" +
    "tr.ship .span{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--muted);}" +
    "tr.ship td.strong{font-weight:700;}" +
    "tr.kid td{background:#fbfcfd;}tr.kid td:nth-child(2){padding-left:20px;}" +
    "body:not(.ship-view) th.tw,body:not(.ship-view) td.tw{display:none;}" +
    "#expandWrap{visibility:visible;}" +
    ".pocount{color:var(--muted);font-size:12px;}" +
    ".b-inflight{background:#eef2f6;color:var(--muted);margin-left:8px;font-weight:500;cursor:help;}" +
    "tr.ship .b-inflight{margin-left:10px;}" +
    ".kidtick{color:#c3ced7;padding-left:6px;}" +
    "tr.ship .direct{font-size:12.5px;color:var(--muted);font-style:italic;cursor:help;}" +
    ".diag{background:#fdf3e3;border:1px solid #e8cfa0;border-radius:7px;padding:9px 12px;margin:0 0 10px;font-size:12.5px;color:#7a4b00;}" +
    ".diag code{font-family:'IBM Plex Mono',monospace;background:#f6e6c8;padding:1px 5px;border-radius:3px;}" +
    ".inb.none{color:#b7c3cc;font-family:'IBM Plex Mono',monospace;}a.doc.po{font-size:12px;opacity:.85;}" +
    ".num{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;white-space:nowrap;}" +
    ".dnum{font-weight:600;}.estflag{color:var(--muted);cursor:help;margin-left:3px;}" +
    ".loc{font-size:12.5px;color:var(--muted);}.so{font-size:12px;color:var(--muted);}" +
    ".contact{font-size:11.5px;line-height:1.5;}a.mail{color:var(--link);text-decoration:none;}a.mail:hover{text-decoration:underline;}" +
    ".ph{color:var(--muted);font-family:'IBM Plex Mono',monospace;}" +
    ".excl-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--rma-bg);border:1px solid #f0c9b8;border-radius:10px;margin-top:22px;cursor:pointer;}" +
    ".excl-head h2{margin:0;font-size:14px;color:var(--rma);display:flex;align-items:center;gap:9px;}" +
    ".excl-head .tag{background:var(--rma);color:#fff;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:20px;text-transform:uppercase;letter-spacing:.4px;}" +
    ".excl-head .chev{color:var(--rma);font-size:12px;}.excl-body{margin-top:10px;}" +
    ".excl-body table thead th{background:#fbeee7;color:var(--rma);}" +
    ".reason{font-size:12px;color:var(--rma);}" +
    ".excl-note{font-size:12px;color:var(--rma);padding:0 2px;margin:8px 2px 0;}" +
    ".foot{margin-top:12px;font-size:12px;color:var(--muted);line-height:1.7;border-top:1px solid var(--line);padding-top:16px;}.foot b{color:var(--ink);}" +
    ".empty{padding:30px;text-align:center;color:var(--muted);font-size:13px;}" +
    ".sectlabel{font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin:0 0 8px 2px;font-weight:600;}" +
    ".sectlabel .qual{color:var(--good);font-weight:600;}" +
    ".sectlabel .shown{float:right;color:var(--navy);font-weight:600;text-transform:none;letter-spacing:0;font-size:12px;}" +
    ".pill{display:inline-block;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;background:#e6eef6;color:#0a4a7a;white-space:nowrap;}" +
    ".ref{display:none;}body.show-ref .ref{display:table-cell;}" +
    ".refresh{margin-top:8px;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:7px;padding:5px 12px;font:inherit;font-size:11.5px;cursor:pointer;}.refresh:hover{background:rgba(255,255,255,.26);}" +
    "@media(max-width:900px){.kpis{grid-template-columns:repeat(2,1fr);}thead th:nth-child(8),tbody td:nth-child(8){display:none;}}";

  return { onRequest: onRequest };
});