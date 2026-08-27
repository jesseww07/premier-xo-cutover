/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget', 'N/url'], function (serverWidget, url) {

    function beforeLoad(context) {
        if (context.type === context.UserEventType.VIEW) {
            var form = context.form;
            var recordId = context.newRecord.id;
var shipmentRecord = context.newRecord
           var emailSent = shipmentRecord.getValue({ fieldId: 'custrecord_inbound_email_sent'});
              if(emailSent){
                return
              }
            var suiteletUrl = url.resolveScript({
                scriptId: 'customscript_pl_email_inbound_sl',
                deploymentId: 'customdeploy1',
                params: { custom_id: recordId }
            });

            form.addButton({
                id: 'custpage_open_suitelet',
                label: 'Email PO',
                functionName: "window.open('" + suiteletUrl + "', '_blank')"
            });
        }
    }

    return { beforeLoad: beforeLoad };
});
