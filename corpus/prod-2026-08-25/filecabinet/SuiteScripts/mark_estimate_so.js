/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/error'], function(record, search, error) {
    function afterSubmit(context) {
        if (context.type !== context.UserEventType.CREATE) {
            return;
        }

        var salesOrder = context.newRecord;
        var originatingEstimate = salesOrder.getValue('createdfrom');

        if (originatingEstimate) {
            try {
                var estimateRecord = record.load({
                    type: record.Type.ESTIMATE,
                    id: originatingEstimate,
                    isDynamic: true
                });

                var estimateLineCount = estimateRecord.getLineCount({ sublistId: 'item' });

                for (var i = 0; i < estimateLineCount; i++) {
                    estimateRecord.selectLine({ sublistId: 'item', line: i });

                    var estItemId = estimateRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
                    var estMarkType = estimateRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_pr_room_location' });  

                    var isEstimateLineLinked = estimateRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_created_so' });

                    if (isEstimateLineLinked) {
                        continue;  // Skip already linked lines
                    }

                    var soLineCount = salesOrder.getLineCount({ sublistId: 'item' });
                    for (var k = 0; k < soLineCount; k++) {
                        var soItemId = salesOrder.getSublistValue({ sublistId: 'item', fieldId: 'item', line: k });
                        var soMarkType = salesOrder.getSublistValue({ sublistId: 'item', fieldId: 'custcol_pr_room_location', line: k });

                        if (soItemId === estItemId && soMarkType === estMarkType) {
                            // Only update if both item ID and Mark Type match
                            estimateRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_moved_checkbox',
                                value: true
                            });
                            estimateRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_created_so',
                                value: salesOrder.id  // Link to the specific Sales Order
                            });
                            break;  // Move to the next Estimate line after linking
                        }
                    }

                    estimateRecord.commitLine({ sublistId: 'item' });
                }

                estimateRecord.save();
            } catch (e) {
                log.error('Error updating Estimate', e);
                throw error.create({
                    name: 'UPDATE_ESTIMATE_ERROR',
                    message: 'An error occurred while updating the Estimate record.'
                });
            }
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
