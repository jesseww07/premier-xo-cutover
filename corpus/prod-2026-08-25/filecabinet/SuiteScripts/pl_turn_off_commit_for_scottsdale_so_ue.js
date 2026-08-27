define(['N/log', 'N/record', 'N/search'],
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     * @NModuleScope
     */
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     */

    function (log, record, search) {

        function beforeSubmit (context) {
            try {
                let so = context.newRecord;
                let soId = so.id;
                
                log.debug('soId', soId);
                
                let location = so.getValue({
                    fieldId: 'location'
                });
                log.debug('location', location);

                if (location == 4 || location == 5 || location == 6) {
                    so.setValue({
                        fieldId: 'custbody_pr_turn_commit_off',
                        value: true
                    });
                }

            }
            catch (error) {
                log.debug('ERROR in afterSubmit', error);
            }
        }

        return {
            beforeSubmit: beforeSubmit
        }
    }
)