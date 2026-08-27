define(['N/record', 'N/search'], function (record, search) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    var exports = {};
    function beforeLoad(context) {
        let thisRecord = context.newRecord
        if (thisRecord.id) {
            let loadedRecord = record.load({
                type: thisRecord.type,
                id: thisRecord.id,
                isDynamic: true
            })
            context.form.addButton({
                id: "custpage_send_email",
                label: "Print Pallet Label",
                functionName: "openSuitelet"
            });

            context.form.clientScriptModulePath = "SuiteScripts/pl_palletLabel_cs.js";


        }
        else {
            return
        }
    }

    exports.beforeLoad = beforeLoad;
    return exports;
});

