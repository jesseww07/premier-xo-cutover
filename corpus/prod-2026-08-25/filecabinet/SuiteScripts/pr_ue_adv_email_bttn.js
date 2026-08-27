/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
 define(['N/record', 'N/ui/serverWidget', 'N/url', 'N/log'], function(record, ui, url, log) {
    function beforeLoad(context) {
        if (context.type === context.UserEventType.VIEW) {
            let form = context.form;
            let type = context.newRecord.type
            log.debug("type", type)

                form.addButton({
                    id: 'custpage_email_po',
                    label: 'Advanced Email PO',
                    functionName: 'redirectToEmailPOSuitelet'
                });

            form.clientScriptModulePath = './pr_cl_adv_email_btt.js';
        }
    }
    return {
        beforeLoad: beforeLoad
    };
});