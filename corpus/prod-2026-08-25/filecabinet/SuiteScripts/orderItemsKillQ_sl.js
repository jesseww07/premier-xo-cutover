/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/redirect', 'N/url', 'N/log'], function (record, redirect, url, log) {

    const cleanVal = (val) => {
        if (val === null || val === undefined) return '';
        var str = String(val);
        if (str.indexOf('ScriptNullObjectAdapter') > -1) return '';
        return str;
    };

    function onRequest(context) {
        if (context.request.method === 'GET') {
            try {
                let recordId = cleanVal(context.request.parameters.test);
                let vendor   = cleanVal(context.request.parameters.vend);

                if (!recordId) {
                    log.error('Error', 'No record ID provided.');
                    return;
                }

                log.debug('Kill Queue Redirect', 'vendor param value: ' + vendor);

                let rec = record.load({
                    type: 'customrecord_consolidated_special_order',
                    id: recordId
                });
                rec.setValue({ fieldId: 'custrecord_mli_remove_from_queue',        value: true });
                rec.setValue({ fieldId: 'isinactive',                               value: true });
                rec.setValue({ fieldId: 'custrecord_special_consolidated_linked',   value: true });
                rec.save();

                // Resolve the main Order Items Suitelet URL internally — no extforms
                var returnUrl = url.resolveScript({
                    scriptId:   'customscript_illuminet_generate_master_p',  // ← your main Suitelet script ID
                    deploymentId: 'customdeploy_illuminet_generate_master_p',                           // ← adjust if different
                    params: {
                        custom_id: vendor
                    }
                });

                redirect.redirect({ url: returnUrl });

            } catch (error) {
                log.error('Error in Cancel Suitelet', error);
            }
        }
    }

    return { onRequest };
});