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
                id: "custpage_pop_up",
                label: "Start Delivery Slip",
                functionName: "openSuitelet"
            });
//SuiteBundles : Bundle 426516
            context.form.clientScriptModulePath = "SuiteScripts/client_generate_code_start_delivery.js";
        }
        else {
            return
        }
    }
    exports.beforeLoad = beforeLoad;
    return exports;
});

