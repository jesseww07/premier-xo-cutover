define(['N/record', 'N/search'], function (record, search) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    var exports = {};
    function beforeLoad(context) {
      log.debug('context',context)
        let thisRecord = context.newRecord
        if (thisRecord.id) {
            let loadedRecord = record.load({
                type: thisRecord.type,
                id: thisRecord.id,
                isDynamic: true
            })
            context.form.addButton({
                id: "custpage_send_email",
                label: "Item Demand Summary",
                functionName: "openSuitelet"
            });

            context.form.clientScriptModulePath = "SuiteScripts/pl_rec_report_cl.js";


        }
        else {
            return
        }
    }

    exports.beforeLoad = beforeLoad;
    return exports;
});

