define(['N/ui/serverWidget'],
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    function (serverWidget) {
        let exports = {};

        function beforeLoad(context) {
            let thisRecord = context.newRecord;
            if (!thisRecord.id) return;

            context.form.addButton({
                id: "custpage_get_items",
                label: "Select Items",
                functionName: "openSuitelet"
            });

            context.form.clientScriptModulePath = "SuiteScripts/pl_get_SO_items_cl.js";
        }

        exports.beforeLoad = beforeLoad;
        return exports;
    });
