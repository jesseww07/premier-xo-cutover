/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * pl_ap_grab_dashboard_sl.js
 * -----------------------------------------------------------------------------
 * AP Genius — "Invoices to Grab" dashboard (Suitelet).
 *
 * Renders a self-contained, filterable HTML dashboard of item receipts that are
 * received and waiting on a vendor invoice (the "ready for OCR" pickup queue).
 *
 * DATA SOURCE OF TRUTH:
 *   Saved search  customsearch4065  ("JWW_Daily Receiving- Ready for OCR").
 *   The search owns the filter logic for what is "ready for OCR." This Suitelet
 *   never re-derives that logic — it simply loads + runs the search each time,
 *   so the dashboard is LIVE (re-pulls on every load).
 *
 * ENRICHMENT (governance-light):
 *   One SuiteQL self-join on the transaction table maps each item receipt to its
 *   Created From document (PO / Return Auth / Transfer Order) and resolves the
 *   vendor name. This avoids per-row record.load() calls and is resilient even
 *   if the saved search's display columns are relabeled later.
 *
 * CLASSIFICATION:
 *   purchaseorder      -> grab list (these go to AP Genius)
 *   returnauthorization-> excluded (customer return into stock, not an invoice)
 *   transferorder      -> excluded (internal warehouse move, no vendor invoice)
 *   anything else / no source -> excluded ("review")
 *
 * NOTE: AP Genius performs 3-way matching + financial/inventory verification on
 *   drop, so this view intentionally omits amount and PO status — it is purely a
 *   "what to grab" queue.
 *
 * COLUMN DEPENDENCY: the few display values read straight from the saved search
 *   (receipt date, location, inbound #, sales order) are matched by COLUMN LABEL.
 *   If you rename those columns in the search, update LABELS below.
 * -----------------------------------------------------------------------------
 */
define(['N/search', 'N/query', 'N/url', 'N/log'], function (search, query, url, log) {

  var SAVED_SEARCH_ID = 'customsearch4065';

  // Only POs that are still billable belong in the grab queue. NetSuite PO status
  // codes:  F = Pending Billing,  E = Partially Received/Pending Billing. Everything
  // else (G Fully Billed, B Pending Receipt, D Partially Received, A Pending
  // Approval, H Closed) is either not yet billable or already done, so it drops off.
  var BILLABLE = { E: true, F: true };

  // Saved-search column labels we read directly (see COLUMN DEPENDENCY note).
  // NOTE: the inbound shipment is intentionally NOT read from the search — its
  // "Inbound / PO #" column is a summary aggregate that returns the wrong id.
  // We derive the affiliated inbound from the data model instead (see buildData).
  var LABELS = {
    internalId:  'Internal ID',     // Created From internal ID (added in summary view)
    date:        'Date',
    location:    'Location',
    salesOrder:  'Sales Order',
    customer:    'Customer',
    createdFrom: 'Created From'   // formula/HTML column; used only to parse the "N IPOs" count
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
      log.error({ title: 'AP grab dashboard build failed', details: e });
      context.response.write(errorPage(e));
      return;
    }
    context.response.write(renderPage(data, data.pulled));
  }

  // ---------------------------------------------------------------------------
  // Build the dataset
  // ---------------------------------------------------------------------------
  function buildData() {
    var s = search.load({ id: SAVED_SEARCH_ID });

    // Map columns by label so we can read display values regardless of internal id.
    var colByLabel = {};
    s.columns.forEach(function (c) {
      if (c.label) { colByLabel[c.label] = c; }
    });

    // Locate the "Created From" internal-ID column. Prefer the labeled column;
    // fall back to a createdfrom->internalid join column if the label differs.
    // Locate the "Created From" internal-ID column. It renders as "Minimum of
    // Internal ID" (summary prefix), so match by label variants first, then fall
    // back to any internalid column (preferring a createdfrom join).
    var idCol = colByLabel[LABELS.internalId] ||
                colByLabel['Minimum of Internal ID'] ||
                colByLabel['Minimum Of Internal ID'];
    if (!idCol) {
      var anyId = null, createdId = null;
      s.columns.forEach(function (c) {
        if (c.name === 'internalid') {
          if (!anyId) { anyId = c; }
          if (!createdId && c.join && String(c.join).toLowerCase().indexOf('created') === 0) {
            createdId = c;
          }
        }
      });
      idCol = createdId || anyId;
    }
    if (!idCol) {
      throw new Error('Could not find the Created From internal ID column in ' +
        SAVED_SEARCH_ID + '. Expected a "Minimum of Internal ID" column; ' +
        'update LABELS.internalId if it was relabeled.');
    }

    // This is a SUMMARY (grouped) search, so result.id is not populated, and its
    // "Inbound / PO #" column is an aggregate that returns the wrong inbound id.
    // Read only the reliable per-row values; derive the inbound shipment below.
    var recs = [];            // [{srcId, date, loc, so, cust, multi}]
    var srcIds = [];

    var paged = s.runPaged({ pageSize: 1000 });
    paged.pageRanges.forEach(function (pr) {
      var page = paged.fetch({ index: pr.index });
      page.data.forEach(function (r) {
        var srcId = String(readCol(r, idCol) || '').trim();
        recs.push({
          srcId: srcId,
          date:  readCol(r, colByLabel[LABELS.date]),
          loc:   normNone(stripHtml(readCol(r, colByLabel[LABELS.location], true))),
          so:    normNone(stripHtml(readCol(r, colByLabel[LABELS.salesOrder]))),
          cust:  normNone(stripHtml(readCol(r, colByLabel[LABELS.customer], true))),
          multi: parseIpoCount(readCol(r, colByLabel[LABELS.createdFrom]))
        });
        if (srcId) { srcIds.push(srcId); }
      });
    });

    var uniqueSrc = dedupe(srcIds);

    // Enrich each source document (PO / RA / TO): type, tranid, amount, status, entity.
    var meta = {};            // srcId -> {srcType, tranid, amount, status, vendor}
    chunk(uniqueSrc, 1000).forEach(function (ids) {
      var sql =
        'SELECT src.id AS srcid, ' +
        '       src.recordtype AS srctype, ' +
        '       src.tranid AS srctranid, ' +
        '       NVL(ABS(src.foreigntotal),0) AS amount, ' +
        '       src.status AS postatus, ' +
        '       BUILTIN.DF(src.entity) AS entname ' +
        'FROM transaction src ' +
        'WHERE src.id IN (' + ids.join(',') + ')';
      query.runSuiteQL({ query: sql }).asMappedResults().forEach(function (m) {
        meta[String(m.srcid)] = {
          srcType:    m.srctype,
          tranid:     m.srctranid,
          amount:     (m.amount == null ? 0 : Number(m.amount)),
          status:     poStatusLabel(m.postatus),
          statusCode: normStatusCode(m.postatus),
          vendor:     m.entname || ''
        };
      });
    });

    // Map each PO -> its inbound shipment: external document number (the vendor-
    // facing PO number that prints on the PO PDF and is referenced on the vendor's
    // invoice) + the shipment internal id (for a clickable link). Derived from
    // inboundshipmentitem because the summary search can't give it reliably. For a
    // consolidated ("N IPOs") inbound, every PO in the group shares one shipment,
    // so resolving the row's (MIN) PO yields the correct shipment.
    var poIds = uniqueSrc.filter(function (id) {
      var m = meta[id];
      return m && m.srcType === 'purchaseorder';
    });
    var inb = {};             // poId -> {shipId, extDoc}
    chunk(poIds, 1000).forEach(function (ids) {
      var sql =
        'SELECT isi.purchaseordertransaction AS poid, ' +
        '       isi.inboundshipment AS shipid, ' +
        '       ish.externaldocumentnumber AS extdoc ' +
        'FROM inboundshipmentitem isi ' +
        'JOIN inboundshipment ish ON ish.id = isi.inboundshipment ' +
        'WHERE isi.purchaseordertransaction IN (' + ids.join(',') + ')';
      query.runSuiteQL({ query: sql }).asMappedResults().forEach(function (m) {
        var poid = String(m.poid);
        // If a PO spans multiple shipments, keep the most recent (highest id).
        if (!inb[poid] || Number(m.shipid) > Number(inb[poid].shipId)) {
          inb[poid] = { shipId: m.shipid, extDoc: m.extdoc || '' };
        }
      });
    });

    // Inbound-level billability. Billing status lives on each PO, but a consolidated
    // ("N IPOs") inbound can mix statuses, so we look at EVERY PO on each shipment in
    // play: the inbound stays in the queue if ANY of its POs is still billable, and
    // the status pill reflects the most-billable status found (F > E). This way a
    // fully-billed receipt drops off, but a part-billed consolidation does not.
    var shipIds = [];
    Object.keys(inb).forEach(function (poid) {
      var sid = inb[poid].shipId;
      if (sid && shipIds.indexOf(sid) < 0) { shipIds.push(sid); }
    });
    var shipInfo = {};        // shipId -> {billable:bool, label:str}
    chunk(shipIds, 1000).forEach(function (ids) {
      var sql =
        'SELECT isi.inboundshipment AS shipid, t.status AS postatus ' +
        'FROM inboundshipmentitem isi ' +
        'JOIN transaction t ON t.id = isi.purchaseordertransaction ' +
        'WHERE t.recordtype = \'purchaseorder\' ' +
        '  AND isi.inboundshipment IN (' + ids.join(',') + ')';
      query.runSuiteQL({ query: sql }).asMappedResults().forEach(function (m) {
        var sid  = String(m.shipid);
        var code = normStatusCode(m.postatus);
        var cur  = shipInfo[sid] || { billable: false, label: '' };
        if (BILLABLE[code]) {
          cur.billable = true;
          // Prefer "Pending Billing" (F) over the partial (E) as the headline status.
          if (code === 'F' || !cur.label) { cur.label = poStatusLabel(code); }
        }
        shipInfo[sid] = cur;
      });
    });

    // Merge + classify.
    var rows = [];   // grab list (billable purchase orders)
    var excl = [];   // returns / transfers / unlinked
    var billedHidden = 0;   // received POs dropped because they are no longer billable
    recs.forEach(function (base) {
      var m = base.srcId ? meta[base.srcId] : null;

      if (!m) {
        // No Created From / not a transaction source — can't be grabbed as a bill.
        excl.push({
          tranid: base.srcId ? ('#' + base.srcId) : 'No source',
          kind:   'No source document',
          entity: '\u2014',
          loc:    base.loc || '',
          ref:    base.so || '',
          date:   base.date || ''
        });
        return;
      }

      if (m.srcType === 'purchaseorder') {
        var link = inb[base.srcId] || null;
        var sInfo = (link && link.shipId) ? shipInfo[String(link.shipId)] : null;

        // Billable if the inbound has any billable PO; for receipts not tied to an
        // inbound shipment, fall back to this PO's own status.
        var billable = sInfo ? sInfo.billable : !!BILLABLE[m.statusCode];
        if (!billable) { billedHidden++; return; }

        rows.push({
          vendor:     m.vendor || '(unidentified)',
          poDoc:      m.tranid || ('PO ' + base.srcId),
          poUrl:      recordUrl('purchaseorder', base.srcId),
          inboundDoc: link ? link.extDoc : '',
          inboundUrl: (link && link.shipId) ? recordUrl('inboundshipment', link.shipId) : '',
          date:   base.date || '',
          loc:    base.loc || '',
          so:     base.so || '',
          cust:   base.cust || '',
          amount: m.amount || 0,
          status: (sInfo && sInfo.label) ? sInfo.label : m.status || '',
          multi:  base.multi || 0
        });
      } else {
        excl.push({
          tranid: m.tranid || ('#' + base.srcId),
          kind:   kindFor(m.srcType),
          entity: m.vendor || '\u2014',
          loc:    base.loc || '',
          ref:    base.so || '',
          date:   base.date || ''
        });
      }
    });

    return { rows: rows, excl: excl, billedHidden: billedHidden, pulled: nowStamp() };
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

  // NetSuite shows "- None -" for empty link fields; treat that as blank.
  function normNone(s) {
    var t = String(s == null ? '' : s).trim();
    return (t === '- None -' || t.toLowerCase() === 'none') ? '' : t;
  }

  // Resolve a relative record URL (returns '' on any failure so links degrade gracefully).
  function recordUrl(type, id) {
    if (!id) { return ''; }
    try {
      return url.resolveRecord({ recordType: type, recordId: id, isEditMode: false });
    } catch (e) {
      log.error({ title: 'recordUrl failed for ' + type + ' ' + id, details: e });
      return '';
    }
  }

  // "2 IPOs" / "6 IPOs" -> 2 / 6 ; single PO display -> 0
  function parseIpoCount(s) {
    var m = stripHtml(s).match(/(\d+)\s*IPOs/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  function kindFor(rt) {
    if (rt === 'returnauthorization') { return 'Customer return (RA)'; }
    if (rt === 'transferorder')       { return 'Internal transfer (TO)'; }
    return 'Other (' + rt + ')';
  }

  // Normalize a raw status value to its bare code (tolerates the 'PurchOrd:F' form).
  function normStatusCode(code) {
    return String(code == null ? '' : code).replace(/^.*:/, '').toUpperCase();
  }

  // PO status codes -> readable labels (tolerates the 'PurchOrd:F' long form too).
  function poStatusLabel(code) {
    var map = {
      A: 'Pending Approval',
      B: 'Pending Receipt',
      D: 'Partially Received',
      E: 'Partially Received/Pending Billing',
      F: 'Pending Billing',
      G: 'Fully Billed',
      H: 'Closed'
    };
    if (!code) { return ''; }
    var c = normStatusCode(code);
    return map[c] || c;
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
    var state = { q: '', vend: '', loc: '', type: '', group: false, sort: 'date', dir: -1 };

    Array.from(new Set(ROWS.map(function (r) { return r.vendor; }))).sort().forEach(function (v) {
      var o = document.createElement('option'); o.value = v; o.textContent = v; document.getElementById('fvend').appendChild(o);
    });
    Array.from(new Set(ROWS.map(function (r) { return r.loc; }))).sort().forEach(function (v) {
      var o = document.createElement('option'); o.value = v; o.textContent = v; document.getElementById('floc').appendChild(o);
    });

    function pd(d) { var p = String(d).split('/').map(Number); return (p[2] || 0) * 10000 + (p[0] || 0) * 100 + (p[1] || 0); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function money(n) { var v = Number(n) || 0; return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    function filt() {
      return ROWS.filter(function (r) {
        if (state.vend && r.vendor !== state.vend) return false;
        if (state.loc && r.loc !== state.loc) return false;
        if (state.type === 'single' && r.multi > 0) return false;
        if (state.type === 'multi' && !(r.multi > 0)) return false;
        if (state.q) {
          var s = (r.vendor + ' ' + r.poDoc + ' ' + r.inboundDoc + ' ' + r.loc + ' ' + r.so).toLowerCase();
          if (s.indexOf(state.q.toLowerCase()) < 0) return false;
        }
        return true;
      });
    }
    function srt(rows) {
      var k = state.sort, d = state.dir;
      return rows.slice().sort(function (a, b) {
        var av, bv;
        if (k === 'date') { av = pd(a.date); bv = pd(b.date); }
        else if (k === 'amount') { av = Number(a.amount) || 0; bv = Number(b.amount) || 0; }
        else if (k === 'inbound') { av = String(a.inboundDoc || '').toLowerCase(); bv = String(b.inboundDoc || '').toLowerCase(); }
        else if (k === 'created') { av = String(a.poDoc || '').toLowerCase(); bv = String(b.poDoc || '').toLowerCase(); }
        else { av = String(a[k] || '').toLowerCase(); bv = String(b[k] || '').toLowerCase(); }
        return av < bv ? -1 * d : av > bv ? 1 * d : 0;
      });
    }
    function rowH(r) {
      var cust = r.cust ? ' <span class="so">&middot; ' + esc(r.cust) + '</span>' : '';
      var inbound = r.inboundDoc
        ? (r.inboundUrl
            ? '<a class="doc" href="' + r.inboundUrl + '" target="_blank" rel="noopener" title="Open inbound shipment">' + esc(r.inboundDoc) + '</a>'
            : '<span class="doc">' + esc(r.inboundDoc) + '</span>')
        : '<span class="inb none">&mdash;</span>';
      var created = r.multi > 0
        ? '<span class="badge b-multi" title="Consolidated inbound shipment built from ' + r.multi + ' POs">' + r.multi + ' IPOs</span>'
        : (r.poUrl
            ? '<a class="doc po" href="' + r.poUrl + '" target="_blank" rel="noopener" title="Open purchase order">' + esc(r.poDoc) + '</a>'
            : '<span class="doc po">' + esc(r.poDoc) + '</span>');
      var so = r.so ? '<span class="so">' + esc(r.so) + '</span>' : '<span class="so">&mdash;</span>';
      return '<tr><td><span class="vname">' + esc(r.vendor) + '</span></td>' +
        '<td>' + inbound + '</td>' +
        '<td>' + created + '</td>' +
        '<td class="mono" style="font-size:12.5px">' + esc(r.date) + '</td>' +
        '<td><span class="loc">' + esc(r.loc) + '</span>' + cust + '</td>' +
        '<td>' + so + '</td>' +
        '<td class="ref num">' + (r.amount ? money(r.amount) : '<span class="so">&mdash;</span>') + '</td>' +
        '<td class="ref">' + (r.status ? '<span class="pill">' + esc(r.status) + '</span>' : '<span class="so">&mdash;</span>') + '</td></tr>';
    }
    function render() {
      var rows = filt();
      document.getElementById('empty').style.display = rows.length ? 'none' : 'block';
      if (state.group) {
        rows = rows.slice().sort(function (a, b) {
          var x = a.vendor.toLowerCase(), y = b.vendor.toLowerCase();
          return x < y ? -1 : x > y ? 1 : pd(b.date) - pd(a.date);
        });
        var html = '', last = null, counts = {};
        rows.forEach(function (r) { counts[r.vendor] = (counts[r.vendor] || 0) + 1; });
        rows.forEach(function (r) {
          if (r.vendor !== last) {
            html += '<tr class="grp"><td colspan="8">' + esc(r.vendor) + '<span class="gc">' +
                    counts[r.vendor] + ' receipt' + (counts[r.vendor] > 1 ? 's' : '') + '</span></td></tr>';
            last = r.vendor;
          }
          html += rowH(r);
        });
        body.innerHTML = html;
      } else {
        body.innerHTML = srt(rows).map(rowH).join('');
      }
      Array.prototype.forEach.call(document.querySelectorAll('thead th'), function (th) {
        var k = th.getAttribute('data-k');
        if (k === state.sort) th.classList.add('act'); else th.classList.remove('act');
        var a = th.querySelector('.arr');
        if (a) a.textContent = (k === state.sort && state.dir === 1) ? '^' : 'v';
      });
    }

    document.getElementById('k-ready').textContent = ROWS.length;
    document.getElementById('k-vend').textContent = new Set(ROWS.map(function (r) { return r.vendor; })).size;
    document.getElementById('k-multi').textContent = ROWS.filter(function (r) { return r.multi > 0; }).length;
    document.getElementById('k-excl').textContent = EXCL.length;

    
    document.getElementById('exclRows').innerHTML = EXCL.map(function (r) {
      return '<tr><td class="mono" style="color:var(--rma);font-weight:600">' + esc(r.tranid) + '</td>' +
        '<td><span class="kindbadge">' + esc(r.kind) + '</span></td>' +
        '<td>' + esc(r.entity) + '</td><td><span class="loc">' + esc(r.loc) + '</span></td>' +
        '<td><span class="so">' + esc(r.ref) + '</span></td>' +
        '<td class="mono" style="font-size:12.5px">' + esc(r.date) + '</td></tr>';
    }).join('');

    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
    document.getElementById('fvend').addEventListener('change', function (e) { state.vend = e.target.value; render(); });
    document.getElementById('floc').addEventListener('change', function (e) { state.loc = e.target.value; render(); });
    document.getElementById('grp').addEventListener('change', function (e) { state.group = e.target.checked; render(); });
    document.getElementById('refToggle').addEventListener('change', function (e) { document.body.classList.toggle('show-ref', e.target.checked); });
    document.getElementById('ftype').addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') return;
      state.type = e.target.getAttribute('data-t');
      Array.prototype.forEach.call(document.querySelectorAll('#ftype button'), function (b) {
        if (b === e.target) b.classList.add('on'); else b.classList.remove('on');
      });
      render();
    });
    Array.prototype.forEach.call(document.querySelectorAll('thead th'), function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (state.sort === k) state.dir *= -1; else { state.sort = k; state.dir = 1; }
        state.group = false; document.getElementById('grp').checked = false;
        render();
      });
    });
    var eb = document.getElementById('exclBody'), ec = document.getElementById('exclChev');
    document.getElementById('exclHead').addEventListener('click', function () {
      var open = eb.style.display !== 'none';
      eb.style.display = open ? 'none' : 'block';
      ec.textContent = open ? 'v show' : '^ hide';
    });

    render();
  }

  // ---------------------------------------------------------------------------
  // Page shell
  // ---------------------------------------------------------------------------
  function renderPage(data, pulled) {
    var rowsJson = JSON.stringify(data.rows).replace(/</g, '\\u003c');
    var exclJson = JSON.stringify(data.excl).replace(/</g, '\\u003c');
    var billedHidden = data.billedHidden || 0;
    var clientSrc = '(' + clientApp.toString() + ')();';

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>AP Genius — Invoices to Grab</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">' +
      '<style>' + CSS + '</style></head><body>' +

      '<header class="top"><div class="wrap">' +
        '<div><h1>AP Genius &mdash; Invoices to Grab</h1>' +
        '<div class="sub">Received items awaiting a vendor invoice. <b>Inbound / PO #</b> is the vendor-facing number on their invoice — it opens the inbound shipment. AP Genius runs the 3-way match on drop; this is just the pickup queue.</div></div>' +
        '<div class="meta">Live from <b>JWW_Daily Receiving- Ready for OCR</b><br>(customsearch4065)<br>Refreshed <b>' + pulled + '</b>' +
        '<br><button class="refresh" onclick="location.reload()">&#8635; Refresh</button></div>' +
      '</div></header>' +

      '<div class="wrap">' +
        '<div class="kpis">' +
          '<div class="kpi good"><div class="n" id="k-ready">0</div><div class="l">Ready to grab (POs)</div></div>' +
          '<div class="kpi"><div class="n" id="k-vend">0</div><div class="l">Distinct vendors</div></div>' +
          '<div class="kpi multi"><div class="n" id="k-multi">0</div><div class="l">Multi-PO inbounds</div></div>' +
          '<div class="kpi alert"><div class="n" id="k-excl">0</div><div class="l">Excluded · not invoices</div></div>' +
        '</div>' +

        '<p class="sectlabel">Pickup queue <span class="qual">&middot; billable POs only</span></p>' +
        '<div class="controls">' +
          '<input type="text" id="q" placeholder="Search vendor, inbound / PO #…">' +
          '<select id="fvend"><option value="">All vendors</option></select>' +
          '<select id="floc"><option value="">All locations</option></select>' +
          '<div class="seg" id="ftype">' +
            '<button data-t="" class="on">All</button>' +
            '<button data-t="single">Single PO</button>' +
            '<button data-t="multi">Multi-PO</button>' +
          '</div>' +
          '<label class="toggle"><input type="checkbox" id="grp"> Group by vendor</label>' +
          '<label class="toggle" style="margin-left:14px"><input type="checkbox" id="refToggle"> Show $ / status</label>' +
        '</div>' +

        '<div class="billednote" id="billednote" style="display:none;"></div>' +

        '<div class="panel"><table id="tbl"><thead><tr>' +
          '<th data-k="vendor">Vendor<span class="arr">v</span></th>' +
          '<th data-k="inbound">Inbound / PO #<span class="arr">v</span></th>' +
          '<th data-k="created">Created From<span class="arr">v</span></th>' +
          '<th data-k="date">Receipt Date<span class="arr">v</span></th>' +
          '<th data-k="loc">Location<span class="arr">v</span></th>' +
          '<th data-k="so">Linked SO<span class="arr">v</span></th>' +
          '<th data-k="amount" class="ref">Amount<span class="arr">v</span></th>' +
          '<th data-k="status" class="ref">PO Status<span class="arr">v</span></th>' +
        '</tr></thead><tbody id="body"></tbody></table>' +
        '<div class="empty" id="empty" style="display:none;">No receipts match the current filters.</div></div>' +

        '<div class="excl-head" id="exclHead">' +
          '<h2><span class="tag">Do not send</span> Excluded — not vendor invoices</h2>' +
          '<span class="chev" id="exclChev">v show</span></div>' +
        '<div class="excl-body" id="exclBody" style="display:none;"><div class="panel"><table><thead><tr>' +
          '<th>Document #</th><th>Type</th><th>Entity</th><th>Location</th><th>Reference</th><th>Date</th>' +
          '</tr></thead><tbody id="exclRows"></tbody></table></div>' +
          '<div class="excl-note">Return Authorizations are customer returns into stock; Transfer Orders are internal moves. Neither has a vendor invoice — sending them to AP Genius would create erroneous bills.</div></div>' +

        '<div class="foot">' +
          '<b>How to read this:</b> each row is an item receipt awaiting a vendor invoice — grab that vendor\'s invoice and drop it into AP Genius. ' +
          '<b>Inbound / PO #</b> is the inbound shipment\'s external document number — the PO number printed for the vendor and referenced on their invoice — and it opens the inbound shipment record. ' +
          '<b>Created From</b> is the underlying NetSuite PO (opens the PO), or <b>N IPOs</b> when one inbound consolidates several POs. ' +
          '<b>Amount &amp; PO status</b> (Show $ / status toggle) are reference only — AP Genius verifies both. ' +
          '<b>Billable only:</b> only POs in <b>Pending Billing</b> or <b>Partially Received/Pending Billing</b> appear; a receipt drops off automatically once its PO(s) are fully billed. For a consolidated inbound, it stays until every PO on the shipment is billed. ' +
          '<b>Live</b> &mdash; re-pulls customsearch4065 on load, or hit Refresh.' +
        '</div>' +
      '</div>' +

      '<script>var ROWS=' + rowsJson + ';var EXCL=' + exclJson + ';var BILLED_HIDDEN=' + billedHidden + ';' + clientSrc + '</' + 'script>' +
      '</body></html>';
  }

  var CSS =
    ":root{--navy:#003764;--navy-2:#0a4a7a;--ink:#13232f;--muted:#5d7383;--bg:#d9dadb;--card:#fff;--line:#dbe3ea;--link:#36677D;--alert:#D64700;--good:#3D7A41;--po:#0a4a7a;--po-bg:#e6eef6;--multi:#8a5a00;--multi-bg:#fbeecf;--rma:#9a2a00;--rma-bg:#fbe3d8;}" +
    "*{box-sizing:border-box;}body{margin:0;background:var(--bg);color:var(--ink);font-family:'IBM Plex Sans',-apple-system,sans-serif;font-size:14px;line-height:1.45;}" +
    ".mono{font-family:'IBM Plex Mono',monospace;}.wrap{max-width:1180px;margin:0 auto;padding:0 20px 20px;}" +
    "header.top{background:linear-gradient(105deg,var(--navy),var(--navy-2));color:#fff;padding:12px 0 5px;border-bottom:3px solid var(--alert);}" +
    "header.top .wrap{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;}" +
    "header.top h1{margin:0;font-size:23px;font-weight:700;letter-spacing:-.3px;}header.top .sub{margin-top:6px;font-size:12.5px;color:#bcd3e6;max-width:660px;}" +
    "header.top .meta{font-size:11.5px;color:#9cbdd6;text-align:right;line-height:1.6;}header.top .meta b{color:#fff;font-weight:600;}" +
    ".kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:11px 0 9px;}" +
    ".kpi{background:var(--card);border:1px solid var(--line);border-radius:5px;padding:8px 8px;position:relative;overflow:hidden;}" +
    ".kpi:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--navy);}" +
    ".kpi.good:before{background:var(--good);}.kpi.multi:before{background:var(--multi);}.kpi.alert:before{background:var(--alert);}" +
    ".kpi .n{font-size:30px;font-weight:700;font-family:'IBM Plex Mono',monospace;letter-spacing:-1px;line-height:1;}" +
    ".kpi .l{font-size:11.5px;color:var(--muted);margin-top:7px;text-transform:uppercase;letter-spacing:.5px;}" +
    ".controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:7px;}" +
    ".controls input[type=text],.controls select{font-family:inherit;font-size:13px;padding:4px 11px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);min-width:150px;}" +
    ".controls input[type=text]{min-width:240px;}" +
    ".seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff;}" +
    ".seg button{border:0;background:#fff;padding:8px 13px;font:inherit;font-size:12.5px;cursor:pointer;color:var(--muted);border-right:1px solid var(--line);}" +
    ".seg button:last-child{border-right:0;}.seg button.on{background:var(--navy);color:#fff;font-weight:600;}" +
    ".toggle{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);cursor:pointer;user-select:none;margin-left:auto;}" +
    ".toggle input{width:16px;height:16px;accent-color:var(--navy);}" +
    ".panel{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;}" +
    "table{width:100%;border-collapse:collapse;}" +
    "thead th{background:#f4f7f9;color:var(--navy);font-size:11px;text-transform:uppercase;letter-spacing:.6px;text-align:left;padding:11px 14px;border-bottom:2px solid var(--line);cursor:pointer;white-space:nowrap;position:sticky;top:0;z-index:2;}" +
    "thead th .arr{opacity:.35;font-size:10px;margin-left:3px;}thead th.act .arr{opacity:1;}" +
    "tbody td{padding:10px 14px;border-bottom:1px solid #d9dadb;vertical-align:middle;}tbody tr:hover{background:#f7fafc;}" +
    "tr.grp td{background:#eaf0f5;font-weight:600;color:var(--navy);font-size:12px;text-transform:uppercase;letter-spacing:.5px;padding:8px 7px;}" +
    "tr.grp td .gc{color:var(--muted);font-weight:500;text-transform:none;letter-spacing:0;margin-left:8px;font-size:11.5px;}" +
    ".vname{font-weight:600;}" +
    "a.doc{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--link);font-weight:500;text-decoration:none;border-bottom:1px dotted rgba(54,103,125,.5);}a.doc:hover{border-bottom-style:solid;}" +
    ".inb{font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink);}.inb.none{color:#b7c3cc;}" +
    ".badge{display:inline-block;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;}" +
    ".b-po{background:var(--po-bg);color:var(--po);}.b-multi{background:var(--multi-bg);color:var(--multi);cursor:help;}" +
    ".loc{font-size:12.5px;color:var(--muted);}.so{font-size:12px;color:var(--muted);font-family:'IBM Plex Mono',monospace;}" +
    ".excl-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--rma-bg);border:1px solid #f0c9b8;border-radius:10px;margin-top:22px;cursor:pointer;}" +
    ".excl-head h2{margin:0;font-size:14px;color:var(--rma);display:flex;align-items:center;gap:9px;}" +
    ".excl-head .tag{background:var(--rma);color:#fff;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:20px;text-transform:uppercase;letter-spacing:.4px;}" +
    ".excl-head .chev{color:var(--rma);font-size:12px;}.excl-body{margin-top:10px;}" +
    ".excl-body table thead th{background:#fbeee7;color:var(--rma);}" +
    ".kindbadge{display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:#f3d9cc;color:var(--rma);white-space:nowrap;}" +
    ".excl-note{font-size:12px;color:var(--rma);padding:0 2px;margin:8px 2px 0;}" +
    ".foot{margin-top:12px;font-size:12px;color:var(--muted);line-height:1.7;border-top:1px solid var(--line);padding-top:16px;}.foot b{color:var(--ink);}" +
    ".empty{padding:30px;text-align:center;color:var(--muted);font-size:13px;}" +
    ".sectlabel{font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);margin:0 0 8px 2px;font-weight:600;}" +
    ".sectlabel .qual{color:var(--good);font-weight:600;}" +
    ".billednote{font-size:12.5px;color:var(--good);background:#eef6ef;border:1px solid #cfe4d0;border-radius:7px;padding:7px 11px;margin:0 0 12px 0;}" +
    ".billednote b{color:var(--good);}" +
    ".ref{display:none;}body.show-ref .ref{display:table-cell;}" +
    ".num{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;}" +
    ".pill{display:inline-block;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;background:#e6eef6;color:#0a4a7a;white-space:nowrap;}" +
    ".refresh{margin-top:8px;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:7px;padding:5px 12px;font:inherit;font-size:11.5px;cursor:pointer;}.refresh:hover{background:rgba(255,255,255,.26);}" +
    "@media(max-width:760px){.kpis{grid-template-columns:repeat(2,1fr);}thead th:nth-child(6),tbody td:nth-child(6){display:none;}}";

  return { onRequest: onRequest };
});