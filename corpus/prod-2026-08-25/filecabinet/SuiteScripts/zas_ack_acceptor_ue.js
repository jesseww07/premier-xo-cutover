/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
 define(['N/ui/serverWidget', 'N/record'], function(serverWidget, record) {
    function beforeLoad(context) {
        if (context.type === context.UserEventType.VIEW) {
            var form = context.form;
            form.clientScriptModulePath = './zas_ack_acceptor_cl.js'; // Link to the client script
            form.addButton({
                id: 'custpage_vendor_ref_btn',
                label: 'Acknowledge PO - NEW',
                functionName: 'openVendorRefPopup'
            });
        }
    }
    return {
        beforeLoad: beforeLoad
    };
});