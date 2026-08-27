/**
 * illuminet_print_po_sl.js
 *
 * Prints the vendor Purchase Order document for an inbound shipment.
 *
 * CHANGED FROM THE DEPLOYED VERSION: only that the header data, line data and
 * rendering now come from illuminet_po_data_lib -- the same module the email
 * Suitelet uses -- so both produce an identical PDF.
 *
 * UNCHANGED: the preflight gate, the force escape hatch, the stamp write, the
 * render-before-stamp ordering and the error pages are exactly as deployed.
 *
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
define(['N/log', 'N/record', 'N/url', 'N/runtime', './illuminet_po_data_lib'],
function (log, record, url, runtime, poLib) {

  const STAMP_FIELD = 'custrecord_zas_po_email_stamp';

  function onRequest(context) {
    const params = context.request.parameters;
    const originatingID = parseInt(params.custom_id, 10);
    const force = params.force === 'T';

    if (!originatingID) {
      context.response.write(poLib.buildErrorHtml('Missing or invalid custom_id parameter.'));
      return;
    }

    // Data + preflight + totals, all from the shared document layer.
    const doc = poLib.buildDocument(originatingID, force);

    if (doc.lines.length === 0) {
      context.response.write(poLib.buildErrorHtml(
        'No purchase order lines found on inbound shipment ' + originatingID + '.'));
      return;
    }

    // Hard errors block the print (no stamp, no PDF) unless &force=T.
    if (doc.preflight.errors.length > 0 && !force) {
      const self = url.resolveScript({
        scriptId: runtime.getCurrentScript().id,
        deploymentId: runtime.getCurrentScript().deploymentId,
        returnExternalUrl: false
      });
      context.response.write(poLib.buildPreflightHtml(
        doc.preflight,
        originatingID,
        self + '&custom_id=' + originatingID + '&force=T',
        'printed'
      ));
      return;
    }

    // Render FIRST, stamp SECOND. A render failure must not leave the
    // shipment stamped as if a PO document was produced.
    const pdfFile = poLib.generatePdf(doc.lines, doc.inboundData, poLib.TEMPLATE_ID);

    try {
      record.submitFields({
        type: 'inboundshipment',
        id: originatingID,
        values: (function () { const v = {}; v[STAMP_FIELD] = new Date(); return v; })()
      });
    } catch (e) {
      // Stamping is bookkeeping; never fail the print over it.
      log.error('PO print stamp failed', e);
    }

    context.response.writeFile({ file: pdfFile, isInline: true });
  }

  return { onRequest: onRequest };
});