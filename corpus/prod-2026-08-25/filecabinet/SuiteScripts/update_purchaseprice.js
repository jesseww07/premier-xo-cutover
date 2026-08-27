/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define([], function () {

    function beforeSubmit_updatePurchasePrice(context) {
        if (context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.EDIT) {
            return;
        }

        var newRec = context.newRecord;
        var oldRec = context.oldRecord;

        var lineCount = newRec.getLineCount({ sublistId: 'itemvendor' });

        // Track changes
        var preferredVendorChanged = false;
        var preferredPriceChanged = false;

        var newPreferredPrice = null;

        for (var i = 0; i < lineCount; i++) {
            var isPreferred = newRec.getSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'preferredvendor',
                line: i
            });

            if (isPreferred) {
                var price = newRec.getSublistValue({
                    sublistId: 'itemvendor',
                    fieldId: 'purchaseprice',
                    line: i
                });

                // Check against old record if available
                if (oldRec) {
                    var oldVendorCount = oldRec.getLineCount({ sublistId: 'itemvendor' });
                    for (var j = 0; j < oldVendorCount; j++) {
                        var wasPreferred = oldRec.getSublistValue({
                            sublistId: 'itemvendor',
                            fieldId: 'preferredvendor',
                            line: j
                        });
                        if (wasPreferred) {
                            var oldPrice = oldRec.getSublistValue({
                                sublistId: 'itemvendor',
                                fieldId: 'purchaseprice',
                                line: j
                            });
                            var oldVendorId = oldRec.getSublistValue({
                                sublistId: 'itemvendor',
                                fieldId: 'vendor',
                                line: j
                            });
                            var newVendorId = newRec.getSublistValue({
                                sublistId: 'itemvendor',
                                fieldId: 'vendor',
                                line: i
                            });

                            if (oldVendorId !== newVendorId) {
                                preferredVendorChanged = true;
                            }
                            if (oldPrice !== price) {
                                preferredPriceChanged = true;
                            }
                            break;
                        }
                    }
                } else {
                    // No old record (CREATE)
                    preferredVendorChanged = true;
                    preferredPriceChanged = true;
                }

                newPreferredPrice = price;
                break;
            }
        }

        // Only update if there’s a relevant change
        if ((preferredVendorChanged || preferredPriceChanged) &&
            newPreferredPrice !== null &&
            newPreferredPrice !== '' &&
            !isNaN(newPreferredPrice)) {

            newRec.setValue({
                fieldId: 'cost',
                value: parseFloat(newPreferredPrice)
            });
        }
    }

    return {
        beforeSubmit: beforeSubmit_updatePurchasePrice
    };

});
