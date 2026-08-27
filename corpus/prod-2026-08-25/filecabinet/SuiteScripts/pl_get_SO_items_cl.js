define(['N/url', 'N/currentRecord'],
/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
function(url, currentRecord) {

    function pageInit(context) {}

    function openSuitelet(context, page = 1) {
        let thisRecord;

        try {
            thisRecord = currentRecord.get();
        } catch (e) {
            thisRecord = context.currentRecord;
        }

        let loc = thisRecord.getValue({ fieldId: 'location' });

        let output = url.resolveScript({
            scriptId: 'customscript_pl_create_item_list_sl',
            deploymentId: 'customdeploy_pl_create_item_list_sl',
            returnExternalUrl: false
        });

        window.open(output + '&custom_id=' + thisRecord.id + '&loc=' + loc + '&type=' + thisRecord.type + '&page=' + page);
    }

    return {
        pageInit: pageInit,
        openSuitelet: openSuitelet
    };
});
