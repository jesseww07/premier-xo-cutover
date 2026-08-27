/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/log'], function(currentRecord, log) {

    function fieldChanged(context) {
        let currentRec = context.currentRecord;
        let sublistName = context.sublistId;
        let fieldId = context.fieldId;

        // Only run on item sublist when unconsolidated item checkbox changes
        if (sublistName === 'item' && fieldId === 'custcol_zastro_unconsolidated_item') {
            log.emergency('script is running on when unconsolidated item checkbox changes');

            let line = currentRec.getCurrentSublistIndex({ sublistId: 'item' });

            let isUnconsolidated = currentRec.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_zastro_unconsolidated_item'
            });
            log.emergency("isUnconsolidated", isUnconsolidated)

            let createPO = currentRec.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'createpo'
            });
            log.emergency("createPO", createPO);

            let orderStatus = currentRec.getValue({ fieldId: 'status' });
            log.emergency("orderStatus", orderStatus);

            // If status is "Pending Approval", unconsolidated is false, and createpo is "Special Order"
            if (orderStatus === "Pending Approval" && isUnconsolidated === false && createPO === "SpecOrd") {
                log.emergency("special order will clear")
                currentRec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'createpo',
                    value: '', // Clear it
                    ignoreFieldChange: true
                });
            }
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
