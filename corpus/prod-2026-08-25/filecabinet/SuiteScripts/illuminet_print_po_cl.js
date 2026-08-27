/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope Public
 *
 * Opens the PO print Suitelet for the current Inbound Shipment.
 *
 * Trimmed from the previous version, which imported six unused modules
 * (N/format, N/https, N/record, N/search, N/xml + an unused language
 * preference lookup) and passed &loc= / &type= parameters the Suitelet
 * never reads. `location` is not an inbound-shipment header field, so
 * &loc= was always empty anyway.
 */
define(['N/url', 'N/currentRecord'], function (url, currentRecord) {

    function pageInit(context) {
        // Required entry point; intentionally empty.
    }

    function openSuitelet(context) {
        let rec;
        try {
            rec = currentRecord.get();
        } catch (e) {
            rec = context.currentRecord;
        }

        if (!rec || !rec.id) {
            alert('Save the record before printing the Purchase Order.');
            return;
        }

        const output = url.resolveScript({
            scriptId: 'customscript_illuminet_print_po_sl',
            deploymentId: 'customdeploy_illuminet_print_po_sl',
            returnExternalUrl: false
        });

        window.open(output + '&custom_id=' + rec.id);
    }

    return {
        pageInit: pageInit,
        openSuitelet: openSuitelet
    };
});