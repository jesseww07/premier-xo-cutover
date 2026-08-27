/**
 * illuminet_po_data_lib.js
 *
 * Shared DOCUMENT layer for the vendor Purchase Order PDF (Advanced PDF
 * template 236). BOTH the print Suitelet and the email Suitelet require this
 * module, so there is exactly ONE producer of the template's data contract
 * and the printed PDF and the emailed PDF are the same document.
 *
 * SCOPE: this module builds and renders the PDF. Nothing else. It performs no
 * record writes, sends no email, and owns no stamping or workflow behaviour --
 * each Suitelet keeps its own, unchanged. Keep it that way; the whole point is
 * that the document is shared and the side effects are not.
 *
 * The whole reason this file exists: template 236 was rewritten against the
 * print Suitelet's object shape, and the email Suitelet kept emitting the old
 * shape. Same template, two producers, silent drift. Never again -- if the
 * template contract changes, it changes here, once.
 *
 * TEMPLATE 236 CONTRACT -- do not change without changing the template:
 *
 *   record (alias 'record')
 *     tranid, entity, billaddress, shipaddress, location, otherrefnum,
 *     trandate, duedate, terms, custbody_vendor_ship_notes, richText,
 *     subtotal, total
 *
 *   results.results[] (alias 'results')
 *     item, itemnote, description, quantity, uom, rate, amount
 *
 * Empty values MUST be '' (empty string), never ' ' (single space). The
 * template guards optional blocks with ?has_content, and a single space is
 * has_content == true -- that is what printed the blank "Due Date:" label and
 * the invisible unit-of-measure note on the legacy output.
 *
 *@NApiVersion 2.1
 *@NModuleScope Public
 */
define(['N/search', 'N/query', 'N/render', 'N/format'],
function (search, query, render, format) {

  // ---------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------
  const TEMPLATE_ID = 236;
  const PLACEHOLDER_RATE_FLOOR = 0.05; // per-unit rates at/below this are treated as unpriced placeholders

  // =====================================================================
  // HEADER DATA
  //
  // Collects every distinct PO-level value across the consolidation,
  // asserts homogeneity, and reports disagreements:
  //   - mixed LOCATION -> hard error (the template hardcodes the Ship-To
  //     address by location, so a mixed shipment can print the wrong
  //     warehouse).
  //   - mixed terms / addresses / vendor# -> warning; the first sorted
  //     value prints so output is at least deterministic.
  // Pulls the real PO due date (earliest across the consolidation) rather
  // than aliasing the created date.
  // =====================================================================
  const getInboundData = (originatingID, preflight) => {
    const returnObj = {};
    const buckets = {
      location: new Set(), terms: new Set(), otherrefnum: new Set(),
      shipaddress: new Set(), shipaddressee: new Set(),
      billaddress: new Set(), billaddressee: new Set(),
      shipnotes: new Set()
    };
    const dueDates = [];

    search.create({
      type: 'inboundshipment',
      filters: [['internalid', 'anyof', originatingID]],
      columns: [
        'internalid', 'externaldocumentnumber', 'createddate', 'memo',
        'custrecord_zas_rich_memo', 'custrecord_mli_inbound_vendor',
        search.createColumn({ name: 'location', join: 'purchaseOrder' }),
        search.createColumn({ name: 'terms', join: 'purchaseOrder' }),
        search.createColumn({ name: 'otherrefnum', join: 'purchaseOrder' }),
        search.createColumn({ name: 'duedate', join: 'purchaseOrder' }),
        search.createColumn({ name: 'shipaddress', join: 'purchaseOrder' }),
        search.createColumn({ name: 'shipaddressee', join: 'purchaseOrder' }),
        search.createColumn({ name: 'billaddress', join: 'purchaseOrder' }),
        search.createColumn({ name: 'billaddressee', join: 'purchaseOrder' }),
        search.createColumn({ name: 'custbody_vendor_ship_notes', join: 'purchaseOrder' })
      ]
    }).run().each(function (result) {
      // Shipment-level scalars: identical on every row, safe to overwrite.
      returnObj.id       = result.getValue({ name: 'internalid' });
      returnObj.doc      = xmlEscape(result.getValue({ name: 'externaldocumentnumber' }));
      returnObj.date     = result.getValue({ name: 'createddate' });
      returnObj.memo     = xmlEscape(result.getValue({ name: 'memo' }));
      returnObj.vendor   = xmlEscape(result.getText({ name: 'custrecord_mli_inbound_vendor' }));
      returnObj.richText = result.getValue({ name: 'custrecord_zas_rich_memo' }) || '';

      // PO-level values: collect, don't overwrite.
      addIf(buckets.location,      result.getText({ name: 'location', join: 'purchaseOrder' }));
      addIf(buckets.terms,         result.getText({ name: 'terms', join: 'purchaseOrder' }));
      addIf(buckets.otherrefnum,   result.getValue({ name: 'otherrefnum', join: 'purchaseOrder' }));
      addIf(buckets.shipaddress,   result.getValue({ name: 'shipaddress', join: 'purchaseOrder' }));
      addIf(buckets.shipaddressee, result.getValue({ name: 'shipaddressee', join: 'purchaseOrder' }));
      addIf(buckets.billaddress,   result.getValue({ name: 'billaddress', join: 'purchaseOrder' }));
      addIf(buckets.billaddressee, result.getValue({ name: 'billaddressee', join: 'purchaseOrder' }));
      addIf(buckets.shipnotes,     result.getValue({ name: 'custbody_vendor_ship_notes', join: 'purchaseOrder' }));

      const dd = result.getValue({ name: 'duedate', join: 'purchaseOrder' });
      if (dd) dueDates.push(dd);

      return true;
    });

    // Homogeneity checks -------------------------------------------------
    if (buckets.location.size > 1) {
      preflight.errors.push('Mixed receiving locations across consolidated POs: ' +
        [...buckets.location].join(' / ') +
        '. The Ship-To address is derived from location -- a mixed shipment can print the wrong warehouse.');
    }
    ['terms', 'otherrefnum', 'shipaddress', 'billaddress'].forEach((k) => {
      if (buckets[k].size > 1) {
        preflight.warnings.push('Mixed ' + k + ' across consolidated POs (' +
          [...buckets[k]].join(' | ') + '). Printing the first sorted value.');
      }
    });

    returnObj.location      = xmlEscape(firstSorted(buckets.location));
    returnObj.terms         = xmlEscape(firstSorted(buckets.terms));
    returnObj.otherrefnum   = xmlEscape(firstSorted(buckets.otherrefnum));
    returnObj.shipaddress   = xmlEscape(firstSorted(buckets.shipaddress));
    returnObj.shipaddressee = xmlEscape(firstSorted(buckets.shipaddressee));
    returnObj.billaddress   = xmlEscape(firstSorted(buckets.billaddress));
    returnObj.billaddressee = xmlEscape(firstSorted(buckets.billaddressee));
    returnObj.custbody_vendor_ship_notes = xmlEscape(firstSorted(buckets.shipnotes));

    // Template-facing aliases: vendor-recognizable number + vendor name.
    returnObj.tranid = returnObj.doc;
    returnObj.entity = returnObj.vendor;

    // trandate is what the template prints as "Date Created". The email
    // Suitelet used to set `createddate` instead, which the template does
    // not read -- that is why the emailed PO had a blank Date Created.
    returnObj.trandate = returnObj.date
      ? format.format({ value: new Date(returnObj.date), type: format.Type.DATE })
      : '';

    // Real due date: earliest PO due date across the consolidation.
    // '' (row hidden by the template) when no PO carries one -- never the
    // created date masquerading as a due date, and never ' '.
    if (dueDates.length > 0) {
      const d = new Date(dueDates.sort((a, b) => new Date(a) - new Date(b))[0]);
      returnObj.duedate = isNaN(d.getTime())
        ? ''
        : format.format({ value: d, type: format.Type.DATE });
    } else {
      returnObj.duedate = '';
    }

    return returnObj;
  };

  // =====================================================================
  // LINE DATA
  //
  // Three principles, each mapped to a production defect on
  // PO 85995 / INBSHIP3365:
  //
  // 1. GROUP BY ITEM INTERNAL ID (+ rate), never by item.vendorname.
  //    Item S28602 carries vendorname "S12130" -- vendorname grouping
  //    printed it as a second S12130 line (the "phantom duplicate").
  //
  // 2. GROUP BY RATE so each printed rate is a REAL rate from a real PO.
  //    SUM(amount)/SUM(qty) printed prices that existed on no PO (S21351
  //    printed $3.65; actual rates were $3.00 and $3.70).
  //
  // 3. PACK MATH FROM THE UOM RECORD (unitstypeuom.conversionrate), not
  //    from regex-parsing the unit label. The label regex silently no-ops
  //    on any unit not named "<n> PACK" and produced fractional
  //    quantities (S21367: 2 units / 3-pack printed "0.667").
  // =====================================================================
  const getPOLines = (originatingID, preflight, force) => {
    const sql =
      "SELECT i.id AS itemid_internal, i.itemid AS pl_item, i.vendorname, " +
      "       i.purchasedescription, isi.porate, " +
      "       NVL(u.conversionrate, 1) AS pack, u.unitname, " +
      "       SUM(isi.quantityexpected) AS qty_each, " +
      "       SUM(isi.shipmentitemamount) AS amount " +
      "FROM inboundshipmentitem isi " +
      "JOIN transactionline potl ON potl.uniquekey = isi.shipmentitemtransaction " +
      "JOIN item i ON i.id = potl.item " +
      "LEFT JOIN unitstypeuom u ON u.internalid = i.purchaseunit " +
      "WHERE isi.inboundshipment = ? " +
      "GROUP BY i.id, i.itemid, i.vendorname, i.purchasedescription, isi.porate, u.conversionrate, u.unitname " +
      "ORDER BY i.itemid, isi.porate";

    const rows = query.runSuiteQL({ query: sql, params: [originatingID] }).asMappedResults();

    // --- Collision + multi-rate detection over the full row set --------
    const byVendorName = {}; // vendorname -> Set(pl_item)
    const ratesByItem = {};  // pl_item -> Set(rate)
    const missingVendorName = [];
    rows.forEach((r) => {
      const vn = (r.vendorname || r.pl_item || '').trim();
      (byVendorName[vn] = byVendorName[vn] || new Set()).add(r.pl_item);
      (ratesByItem[r.pl_item] = ratesByItem[r.pl_item] || new Set()).add(Number(r.porate));
      if (!r.vendorname) missingVendorName.push(r.pl_item);
    });

    Object.keys(byVendorName).forEach((vn) => {
      if (byVendorName[vn].size > 1) {
        preflight.errors.push('Vendor item code "' + vn + '" is shared by ' +
          byVendorName[vn].size + ' different items (' + [...byVendorName[vn]].join(', ') +
          '). The vendor cannot tell these lines apart -- fix the item vendorname or force through with PL# disambiguators.');
      }
    });
    Object.keys(ratesByItem).forEach((it) => {
      if (ratesByItem[it].size > 1) {
        preflight.warnings.push('Item ' + it + ' carries ' + ratesByItem[it].size +
          ' different PO rates (' + [...ratesByItem[it]].sort((a, b) => a - b).join(' / ') +
          ') across the consolidated POs -- it will print as separate lines per rate. ' +
          'Confirm the spread is intentional before sending.');
      }
    });
    if (missingVendorName.length > 0) {
      preflight.warnings.push(missingVendorName.length + ' item(s) have no Vendor Name on the item record, ' +
        'so the vendor will see OUR internal item number instead of theirs: ' +
        missingVendorName.slice(0, 10).join(', ') +
        (missingVendorName.length > 10 ? ', ...' : '') + '.');
    }

    // --- Build printable lines ------------------------------------------
    const lines = [];
    rows.forEach((r) => {
      const qtyEach = Number(r.qty_each) || 0;
      const amount = Number(r.amount) || 0;
      const pack = Number(r.pack) || 1;
      if (qtyEach === 0 && amount === 0) return; // nothing to print

      const displayQty = qtyEach / pack;

      // Fractional packs must never reach a vendor document.
      if (!Number.isInteger(displayQty)) {
        preflight.errors.push('Item ' + r.pl_item + ': ' + qtyEach +
          ' units is not a whole number of "' + (r.unitname || pack + ' PACK') +
          '" (' + displayQty.toFixed(2) + ' packs). Correct the order quantity before sending.');
      }

      // Per-DISPLAYED-unit rate, so printed rate x printed qty = printed
      // amount on every line.
      const unitRate = displayQty > 0 ? amount / displayQty : 0;

      // Unpriced placeholder detection (S21381 went out at $0.01).
      if (unitRate > 0 && unitRate <= PLACEHOLDER_RATE_FLOOR) {
        preflight.errors.push('Item ' + r.pl_item + ': rate $' + unitRate.toFixed(2) +
          ' looks like an unpriced placeholder. Set the real PO cost before sending.');
      }

      // Penny-drift guard.
      const rounded = Math.round(unitRate * 100) / 100;
      if (displayQty > 0 && Math.abs(rounded * displayQty - amount) > 0.02) {
        preflight.warnings.push('Item ' + r.pl_item + ': rounded rate ' + rounded.toFixed(2) +
          ' x ' + displayQty + ' differs from line amount ' + amount.toFixed(2) + ' by more than $0.02.');
      }

      const collision = byVendorName[(r.vendorname || r.pl_item || '').trim()].size > 1;

      lines.push({
        item: xmlEscape(r.vendorname || r.pl_item),
        // Populated only when a vendorname collision exists AND the user
        // forced through the error: disambiguates with our item #.
        itemnote: (collision && force) ? xmlEscape('PL# ' + r.pl_item) : '',
        description: xmlEscape(r.purchasedescription),
        quantity: Number.isInteger(displayQty) ? displayQty.toLocaleString() : displayQty.toFixed(2),
        uom: (pack > 1 && r.unitname) ? xmlEscape(r.unitname) : '',
        rate: formatCurrency(unitRate),
        amount: formatCurrency(amount),
        _amountNum: amount
      });
    });

    return lines;
  };

  // =====================================================================
  // ONE-CALL BUILDER
  //
  // Both Suitelets call this. It guarantees subtotal/total are derived
  // from the SAME line array the vendor sees, so the totals row always
  // equals the sum of printed lines -- the email Suitelet used to compute
  // a totalSum it never bound to the template, printing blank totals.
  // =====================================================================
  const buildDocument = (originatingID, force) => {
    const preflight = { errors: [], warnings: [] };

    const inboundData = getInboundData(originatingID, preflight);
    const lines = getPOLines(originatingID, preflight, force);

    const totalSum = lines.reduce((sum, l) => sum + l._amountNum, 0);
    inboundData.subtotal = formatCurrency(totalSum);
    inboundData.total = formatCurrency(totalSum);

    return { inboundData: inboundData, lines: lines, preflight: preflight, totalSum: totalSum };
  };

  // =====================================================================
  // RENDERING
  // =====================================================================
  const generatePdf = (lines, inboundData, templateId) => {
    const renderer = render.create();
    renderer.setTemplateById({ id: templateId || TEMPLATE_ID });
    renderer.addCustomDataSource({ format: render.DataSource.OBJECT, alias: 'record', data: inboundData });
    renderer.addCustomDataSource({ format: render.DataSource.OBJECT, alias: 'results', data: { results: lines } });
    return renderer.renderAsPdf();
  };

  // Blocking page listing everything preflight found, with an explicit
  // force escape hatch. `actionLabel` lets the print and email Suitelets
  // describe what was NOT done ("printed" / "emailed to the vendor").
  const buildPreflightHtml = (preflight, originatingID, forceUrl, actionLabel) => {
    const act = actionLabel || 'generated';
    let html = '<html><head><title>PO Preflight - Blocked</title></head>' +
      '<body style="font-family: sans-serif; max-width: 860px; margin: 30px auto;">' +
      '<h2 style="color:#922C2C;">Purchase Order blocked - fix these before sending</h2>' +
      '<p>The PO for inbound shipment <b>' + originatingID + '</b> was <b>not</b> ' + act +
      ' and the record was <b>not</b> stamped.</p>';

    html += '<h3>Errors (' + preflight.errors.length + ')</h3><ol>';
    preflight.errors.forEach((e) => { html += '<li style="margin-bottom:8px;">' + e + '</li>'; });
    html += '</ol>';

    if (preflight.warnings.length > 0) {
      html += '<h3>Warnings (' + preflight.warnings.length + ')</h3><ol>';
      preflight.warnings.forEach((w) => { html += '<li style="margin-bottom:8px;">' + w + '</li>'; });
      html += '</ol>';
    }

    html += '<p style="margin-top:24px;"><a href="' + forceUrl + '" ' +
      'style="background:#922C2C;color:#fff;padding:10px 16px;text-decoration:none;" ' +
      'onclick="return confirm(\'Proceed anyway with all listed problems? Colliding vendor codes will be disambiguated with PL item numbers.\');">' +
      'Proceed Anyway (force)</a></p>' +
      '</body></html>';

    return html;
  };

  const buildErrorHtml = (message) =>
    '<html><body style="font-family: sans-serif; margin: 40px;">' +
    '<h2>Unable to generate Purchase Order</h2><p>' + message + '</p></body></html>';

  // =====================================================================
  // HELPERS
  // =====================================================================
  const addIf = (set, val) => {
    if (val !== null && val !== undefined && String(val).trim() !== '') set.add(String(val));
  };
  const firstSorted = (set) => (set.size ? [...set].sort()[0] : '');

  const formatCurrency = (num) => Number(num).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Escapes XML-significant characters. Returns '' (NOT ' ') for empty
  // input so FreeMarker ?has_content guards work. The legacy returner()
  // helper returned a single space, which made ?has_content always true --
  // that is what rendered the empty "Vendor Shipping Instructions" box,
  // the labelled-but-blank "Due Date:", and the invisible UOM note.
  const xmlEscape = (word) => {
    if (word === null || word === undefined || word === '') return '';
    return String(word)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;');
  };

  return {
    TEMPLATE_ID: TEMPLATE_ID,
    buildDocument: buildDocument,
    getInboundData: getInboundData,
    getPOLines: getPOLines,
    generatePdf: generatePdf,
    buildPreflightHtml: buildPreflightHtml,
    buildErrorHtml: buildErrorHtml,
    formatCurrency: formatCurrency,
    xmlEscape: xmlEscape
  };
});
