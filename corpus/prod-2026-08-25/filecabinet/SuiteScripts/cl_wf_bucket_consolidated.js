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
                var soInternal = salesOrd.id
                log.debug(soInternal)
                var soNo = salesOrd.getValue({
                    fieldId: 'tranid'
                });
                var entity = salesOrd.getValue({
                    fieldId: 'entity'
                });
                var shipAddress = salesOrd.getValue({
                    fieldId: 'shipaddress'
                });
                var project = salesOrd.getValue({
                    fieldId: 'memo'
                });
                var soLocation = salesOrd.getValue({
                    fieldId: 'location'
                });
                var lineCount = salesOrd.getLineCount({
                    sublistId: 'item'
                });
                log.debug('lineCount',lineCount)
                if (lineCount > 0) {
                    for (var i = 0; i < lineCount; i++) {
                        var specialProduct = salesOrd.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_zastro_unconsolidated_item',
                            line: i
                        });
                        log.debug('specialProduct',specialProduct)
                        if (specialProduct == 'T' || specialProduct == true) {
 var qtyPicked = salesOrd.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantitypicked',
                                line: i
                            });
                             var soQty = salesOrd.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'quantity',
                                    line: i
                                });
if(Number(soQty)>Number(qtyPicked)){
                             var includedInPO = salesOrd.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_zastro_po_included',
                                line: i
                            });
                            var allocatedFromShow = salesOrd.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_zastro_from_showroom',
                                line: i
                            });
                            log.debug('includedInPO',includedInPO)
                            log.debug('allocatedFromShow',allocatedFromShow)
                         //   if (includedInPO == false || includedInPo == 'F') {
                                   if (includedInPO != true) {
                              log.debug('why are we here.....')
                                var soItem = salesOrd.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    line: i
                                });
                             
                                var roomLocation = salesOrd.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcolcustcol_zastro_room_location',
                                    line: i
                                });
                                var targetVendor = salesOrd.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcolcustcol_zastro_vendor',
                                    line: i
                                });
                                var purchasePrice = salesOrd.getSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_zastro_purchase_price',
                                    line: i
                                });
                                log.debug('running returnedParent')
                                var returnedParent = runConsolidatedSearch(targetVendor, soLocation)
                                log.debug('returnedParent', returnedParent)
                                if (returnedParent) {
                                    var toCreate = false
                                    var docAlteration = returnedParent
                                }
                                else {
                                    var toCreate = true
                                    var docAlteration = runAlterationsOnParent(targetVendor, toCreate, soLocation)
                                }

                                var payload = new Object()
                                payload.soItem = soItem
                                payload.soQty = soQty
                                payload.soLocation = soLocation
                                payload.roomLocation = roomLocation
                                payload.soInternal = soInternal
                                payload.entity = entity
                                payload.shipAddress = shipAddress
                                payload.project = project
                                payload.purchasePrice = purchasePrice
                                log.debug('payload', payload)
                                try{
                                    var returnedLineLevel = createConsolidatedItemDoc(payload, docAlteration)
                                }
                                catch(e){
                                    log.debug('create e', e)
                                }
                                var lineNum = salesOrd.selectLine({
                                    sublistId: 'item',
                                    line: i
                                });
                                salesOrd.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_zastro_unconsolidated_no',
                                    value: docAlteration,
                                    ignoreFieldChange: true
                                });
                                salesOrd.commitLine({
                                    sublistId: 'item'
                                });
                            }
}




                    
                        }
                    }
                }

            }
            catch (e) {
                log.debug('failure in eaches',e)
            }
        }
        const createConsolidatedItemDoc = (payload, docAlteration) => {
            var lineDoc = record.create({
                type: 'customrecord_zastro_unconsolidated_items',
                isDynamic: true
            });
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_po_item_list',
                value: docAlteration
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_item_name',
                value: payload.soItem
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_qty',
                value: payload.soQty
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_location_home',
                value: payload.roomLocation
            })
            lineDoc.setValue({
                fieldId: 'xxxxx',
                value: payload.soLocation
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_so_no',
                value: payload.soInternal
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_customer',
                value: payload.entity
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_ship_address',
                value: payload.shipAddress
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_project',
                value: payload.project
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_print_on_label',
                value: true
            })
            var submitNewCustom = lineDoc.save()
            return submitNewCustom
        }

        const runAlterationsOnParent = (targetVendor, toCreate, soLocation) => {
            var today = new Date()
            if (toCreate == true) {
                var parentRec = record.create({
                    type: 'customrecord_zastro_po_consolid',
                    isDynamic: true
                });
                parentRec.setValue({
                    fieldId: 'custrecord_zastr_date',
                    value: today
                })
                parentRec.setValue({
                    fieldId: 'custrecord_zastro_vendor',
                    value: targetVendor
                })
                // parentRec.setValue({
                //     fieldId: 'custrecord_ill_location',
                //     value: soLocation
                // })
                var createdDoc = parentRec.save()
                return createdDoc
            }
        }

        const runConsolidatedSearch = (targetVendor, soLocation) => {
            log.debug('soLocation',soLocation)
            var returnID
            var customrecord_zastro_po_consolidSearchObj = search.create({
                type: "customrecord_zastro_po_consolid",
                filters:
                    [
                        ["custrecord_zastro_vendor", "anyof", targetVendor],
                        "AND",
                        ["custrecord_zastro_is_consolidated", "is", "F"],
                        "AND",
                        ["custrecord_ill_location", "anyof", soLocation]
                    ],
                columns:
                    [
                        "internalid"
                    ]
            });
            var searchResultCount = customrecord_zastro_po_consolidSearchObj.runPaged().count;
            log.debug("customrecord_zastro_po_consolidSearchObj result count", searchResultCount);
            customrecord_zastro_po_consolidSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var internalID = result.getValue({
                    name: 'internalid'
                })
                returnID = internalID
                return true;
            });
            return returnID
        }


        return {
            onAction: onAction
        };

    });

