define(['N/record','N/redirect'], function (record,redirect) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    var exports = {};
    function afterSubmit(context) {
        let thisRecord = context.newRecord
        if (thisRecord.id) {
            redirect.toSuitelet({
                scriptId: '2833',
                deploymentId: '1',
                parameters: {
                    'custom_id':thisRecord.id
                } 
            });
        }
        else {
            return
        }
    }
    exports.afterSubmit = afterSubmit;
    return exports;
});

