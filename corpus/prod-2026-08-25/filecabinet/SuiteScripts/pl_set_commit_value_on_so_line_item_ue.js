define(['N/record', 'N/search'], function (record, search) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    let exports = {};
    function beforeLoad(context) {
        let thisRecord = context.newRecord
        if (thisRecord.id) {
            let loadedRecord = record.load({
                type: thisRecord.type,
                id: thisRecord.id,
                isDynamic: true
            })
            context.form.addButton({
                id: "custpage_set_item_commit_values",
                label: "Commit Items",
                functionName: "openSuitelet"
            });

            context.form.clientScriptModulePath = "SuiteScripts/pl_set_commit_value_on_so_line_item_cl.js";


        }
        else {
            return
        }
    }

    exports.beforeLoad = beforeLoad;
    return exports;
});