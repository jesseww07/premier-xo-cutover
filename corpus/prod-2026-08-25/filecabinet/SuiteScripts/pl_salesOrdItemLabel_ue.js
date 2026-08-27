define(['N/record'], function (record) {
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
            log.debug('thisRecord', thisRecord)
            let form = loadedRecord.getValue('customform')
            log.debug('form', form)
            log.debug({
                title: 'before load triggered',
                details: context.type
            })

            context.form.addButton({
                id: "custpage_print_so_labels",
                label: "Job Labels",
                functionName: "openSuitelet"
            });

            context.form.clientScriptModulePath = "SuiteScripts/pl_salesOrdItemLabel_cl.js";
        }
        else {
            return
        }
    }
    exports.beforeLoad = beforeLoad;
    return exports;
});

