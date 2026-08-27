/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record'], function(record) {

    function beforeLoad(context) {
        if (context.type !== context.UserEventType.CREATE) {
            return;
        }

        var salesOrder = context.newRecord;
        var originatingEstimate = salesOrder.getValue('createdfrom');

        if (originatingEstimate) {
            var estimateRecord = record.load({
                type: record.Type.ESTIMATE,
                id: originatingEstimate
            });

            var estimateLineCount = estimateRecord.getLineCount({ sublistId: 'item' });

            for (var i = estimateLineCount - 1; i >= 0; i--) {
                var linkedSO = estimateRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_created_so',
                    line: i
                });

                if (linkedSO) {
                    salesOrder.removeLine({
                        sublistId: 'item',
                        line: i
                    });
                }
            }
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
