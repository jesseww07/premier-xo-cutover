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
          
                    context.form.addButton({
                        id: "custpage_pop_up",
                        label: "Update ESDs",
                        functionName: "openSuitelet"
                    });
        
                
    
            context.form.clientScriptModulePath = "SuiteScripts/pr_update_esd_cl.js";
        }
        else {
            return
        }
    }
    exports.beforeLoad = beforeLoad;
    return exports;
});

