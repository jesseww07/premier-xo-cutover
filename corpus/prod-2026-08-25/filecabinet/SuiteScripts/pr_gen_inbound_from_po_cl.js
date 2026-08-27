/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
/**
 * API Version 2.1
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      5/23/25       Alex Gjorvad                         Client
 * 
 *          Script Functionality
 * 
 */
define(['N/format', 'N/https', 'N/record', 'N/runtime', 'N/search', 'N/url', 'N/xml', 'N/currentRecord', 'N/ui/dialog'], function (format, https, record, runtime, search, url, xml, currentRecord, dialog) {
    function pageInit(context) { }

    function redirect(context) {
        alert('Inbound Shipment Being Created');
        var thisRecord;
        try {
            thisRecord = currentRecord.get()
        }
        catch (e) {
            thisRecord = context.currentRecord
        }
        var params = {}
        var purchaseOrder = thisRecord.id;
        if (purchaseOrder) {
            params.custpage_order_id = purchaseOrder;
        }
        var suiteUrl = url.resolveScript({
            scriptId: 'customscript_gli_gen_inbound_po_sl',
            deploymentId: 'customdeploy1',
            // set the script Id and the deployment Id for the suitelet you want to pass the value to.           
            params: params
        });
        console.log('url', suiteUrl);
        window.location.href = suiteUrl;
    }

    return {
        pageInit: pageInit,
        redirect: redirect
    };
});