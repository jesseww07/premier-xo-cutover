/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime'],
/**
 * @param {record} record
 * @param {search} search
 * @param {ui} ui
 * @param {dialog} dialog
 * @param {runtime} runtime
 */
function (record, search, ui, dialog, runtime) {

    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @Since 2016.1
     */
    function onAction(context) {
        try {
            var salesOrd = context.newRecord
            var id = salesOrd.id
            log.debug('id',id)

            var zeroOut = false
            //pull the sales order - this will be a before record submit

            //get all needed fields
            //delivery method - shipmethod
            //ship state - shipstate
            //location - location
            //source - source
            var deliveryMethod = salesOrd.getValue({
                fieldId: 'shipmethod'
            });
            var deliveryMethodText = salesOrd.getText({
                fieldId: 'shipmethod'
            });
            var shipState = salesOrd.getValue({
                fieldId: 'shipstate'
            });
            var soLocation = salesOrd.getValue({
                fieldId: 'location'
            });
            var soSource = salesOrd.getValue({
                fieldId: 'source'
            });
            var orderedFromLoc = salesOrd.getValue({
                fieldId: 'custbody_pl_ordered_from_location'
            });
          var customerId = salesOrd.getValue({
                fieldId: 'companyid'
            });
          
          var isTaxable = search.lookupFields({
                 type: search.Type.CUSTOMER,
                 id: customerId,
                 columns: ['taxable']
                });
            //run through trials


            //if delivery method (we dont have these in so use text version) is customer pick up then it needs to be evaluated
          log.debug('isTaxable', isTaxable)
            log.debug('deliveryMethodText', deliveryMethodText)
            log.debug('shipState', shipState)
            log.debug('soLocation', soLocation)
            log.debug('soSource', soSource)
            log.debug('orderedFromLoc', orderedFromLoc)
          soLocation = orderedFromLoc
           log.debug('resetSoLocation', soLocation)
            if (soSource == 'CSV') {
                return
            }
            
            if (deliveryMethodText == 'Customer Pick-Up') {
                var setTaxCode = publishTaxCode(salesOrd, soLocation, zeroOut)
            }
            else {
                if (soSource == 'Web Order') {
                    log.debug('Web Order')
                    zeroOut = true
                    var setTaxCode = publishTaxCode(salesOrd, soLocation, zeroOut)

                }
                else if (shipState == 'AZ') {
                    log.debug('shipState', shipState)
                    var setTaxCode = publishTaxCode(salesOrd, soLocation, zeroOut)

                }
                else {
                    log.debug('Meets no conditions!!')
                }
            }


        }
        catch (e) {
            log.debug('failure in eaches', e)
        }
    }

    const publishTaxCode = (salesOrd, soLocation, zeroOut) => {
        try {
            var numLines = salesOrd.getLineCount({
                sublistId: 'item'
            });
            if (zeroOut == true) {
                for (var x = 0; x < numLines; x++) {
                    log.debug('x', x)
                    var selectLine = salesOrd.selectLine({
                        sublistId: 'item',
                        line: x
                    });

                    salesOrd.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'taxcode',
                        value: -8
                    });
                    salesOrd.commitLine({
                        sublistId: 'item'
                    })
                }
                //if zeroOut is TRUE then just go and set ELSE FOLLOOW LOGIC
                //run a tiered condition to see if it is a certain location
            }
            else if (soLocation == 2 || soLocation == 3) {
                for (var x = 0; x < numLines; x++) {
                    log.debug('x', x)
                    var selectLine = salesOrd.selectLine({
                        sublistId: 'item',
                        line: x
                    });
                    var isTax = salesOrd.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pr_is_taxable'
                    });
                    if (isTax == 'Taxable') {
                        salesOrd.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode',
                            value: -276
                        });
                    }
                    else {
                        salesOrd.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode',
                            value: -8
                        });
                    }
                    salesOrd.commitLine({
                        sublistId: 'item'
                    })


                }
                //Tuscon is 2 Or 3
                //internal id is -78
            }
            else if (soLocation == 5 || soLocation == 6) {
                for (var x = 0; x < numLines; x++) {
                    log.debug('x', x)
                    var selectLine = salesOrd.selectLine({
                        sublistId: 'item',
                        line: x
                    });
                    var isTax = salesOrd.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pr_is_taxable'
                    });
                    if (isTax == 'Taxable') {
                        salesOrd.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode',
                            value: -239
                        });
                    }
                    else {
                        salesOrd.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode',
                            value: -8
                        });
                    }
                    salesOrd.commitLine({
                        sublistId: 'item'
                    })
                }
                //Scottsdale is 5 Or 6
                //internal id is -37
            }
            else if (soLocation == 8) {
                for (var x = 0; x < numLines; x++) {
                    log.debug('x', x)
                    var selectLine = salesOrd.selectLine({
                        sublistId: 'item',
                        line: x
                    });
                    var isTax = salesOrd.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pr_is_taxable'
                    });
                    if (isTax == 'Taxable') {
                        salesOrd.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode',
                            value: -234
                        });
                    }
                    else {
                        salesOrd.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode',
                            value: -8
                        });
                    }
                    salesOrd.commitLine({
                        sublistId: 'item'
                    })
                }
                //Phoenix is 8
                //internal id is 103
            }

            //based off of what location then set the value under the tax

            return salesOrd
        }
        catch (e) {
            log.debug('e', e)
            log.debug('e on line x', x)
            return
        }
    }

    return {
        onAction: onAction
    };

});