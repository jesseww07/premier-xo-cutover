/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget', 'N/url', 'N/record', 'N/log'], function (serverWidget, url, record, log) {
    function beforeLoad(context) {
        if (context.type === context.UserEventType.VIEW || context.type === context.UserEventType.EDIT) {
            log.debug("helllooooo")
            let form = context.form;
            let thisRecord = context.newRecord
            let recId = thisRecord.id;
            let vendorId = thisRecord.getValue('custrecord_mli_inbound_vendor');

            let vendor = thisRecord.getSublistValue({
               sublistId: 'items',
               fieldId: 'vendorid',
               line: 0
            })

            log.debug("vendor", vendor)
            log.debug("inbound shipment id", recId)
            log.debug("vendorId", vendorId)

            let suiteletUrl = url.resolveScript({
                scriptId: 'customscript_lyte_sl_add_item',
                deploymentId: 'customdeploy_lyte_sl_add_item',
                params: {
                    inbound_shipment_id: recId ,
                    custom_id: vendor
                }
            });

            form.addButton({
                id: 'custpage_add_item_btn',
                label: 'Add Item',
                functionName: `window.open('${suiteletUrl}', '_blank', 'width=600,height=400')`
            });
        }
    }

    return { beforeLoad };
});
