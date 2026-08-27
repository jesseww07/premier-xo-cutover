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
            let vend = loadedRecord.getValue('custrecord_zastro_vendor')
            //log.debug('form', form)
            log.debug({
                title: 'before load triggered',
                details: context.type
            })
            if(vend == 2731 ||
                vend == 2732 ||
                vend == 2733 ||
                vend == 2734 ||
                vend == 2735 ||
                vend == 2736 ||
                vend == 2737 ||
                vend == 2738 ||
                vend == 2739 ||
                vend == 2740 ||
                vend == 2741 ||
                vend == 2742 ||
                vend == 2743 ||
                vend == 2744 || 
                vend == 2745 ||
                vend == 2746){
                    context.form.addButton({
                        id: "custpage_pop_up",
                        label: "Move Inventory for Order",
                        functionName: "openSuitelet"
                    });
        
                }
    
            context.form.clientScriptModulePath = "SuiteScripts/pr_china_con_cl.js";
        }
        else {
            return
        }
    }
    exports.beforeLoad = beforeLoad;
    return exports;
});

