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
                var changeOrd = context.newRecord
                var id = changeOrd.id
                log.debug(id)

                var origItem = changeOrd.getValue({
                    fieldId: 'custrecord_originitating_item'
                });
                var qty = changeOrd.getValue({
                    fieldId: 'custrecord_requested_qty'
                });
                var components = changeOrd.getValue({
                    fieldId: 'custrecord_comp_list'
                });
                var location = changeOrd.getValue({
                    fieldId: 'custrecord_location'
                });
                var bin = changeOrd.getValue({
                    fieldId: 'custrecord_bin_to_take'
                });
                
                var returnEM = findEMItem(origItem)
                if (returnEM) {
                    var payload = new Object()
                    payload.origItem = origItem
                    payload.returnEM = returnEM
                    payload.qty = qty
                    payload.components = components
                    payload.location = location
                    payload.bin = bin
                    var createdAdjustment = createInvAdj(payload)
                    var returnSave = submitFields(payload,createdAdjustment,changeOrd)
                }
                else {
                    log.debug('error - no item')
                }


            }


            catch (e) {
                log.debug('failure in eaches', e)
            }
        }

        const submitFields = (payload,createdAdjustment,changeOrd) => {
            var today = new Date()
            changeOrd.setValue({
                fieldId: 'custrecord_em_item',
                value: payload.returnEM
            })
            changeOrd.setValue({
                fieldId: 'custrecord_date_approved',
                value: today
            })
            changeOrd.setValue({
                fieldId: 'custrecord_system_created_adjustment',
                value: createdAdjustment
            })
            changeOrd.save()
        }

        const findEMItem = (origItem) => {
            var returnItem;
            var itemSearchObj = search.create({
                type: "item",
                filters:
                [
                   ["internalidnumber","equalto",origItem]
                ],
                columns:
                [
                   "custitem_pr_em_product"
                ]
             });
             var searchResultCount = itemSearchObj.runPaged().count;
             log.debug("itemSearchObj result count",searchResultCount);
             itemSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var emItem = result.getValue({
                    name:'custitem_pr_em_product'
                })
                returnItem = emItem
                return true;
             });
             if(!returnItem){
                
                var lookup = search.lookupFields({
                    type: 'customer',
                    id: entity,
                    columns: 'itemid'
                })
                log.debug('lookup', lookup)
                var itemName = searchEntityNote.itemid
                var newItemName = itemName + '-EM'
                log.debug('entityNote', entityNote)
                var objRecord = record.copy({
                    type: 'inventoryitem',
                    id: origItem,
                    isDynamic: true,
                   });
                   objRecord.setValue9({
                       fieldId: 'itemid',
                       value: newItemName
                   })
             }
             return returnItem
        }

        const createInvAdj = (payload) => {
            var invAdj = record.create({
                type: 'inventoryadjustment',
                isDynamic: true,
            })
            invAdj.setValue({
                fieldId: 'subsidiary',
                value: 2,
            });
            invAdj.setValue({
                fieldId: 'account',
                value: 224,
            });
            invAdj.selectNewLine({
                sublistId: 'inventory'
            });
            invAdj.setCurrentSublistValue({
                sublistId: 'inventory',
                fieldId: 'item',
                value: payload.origItem
            });
            
            invAdj.setCurrentSublistValue({
                sublistId: 'inventory',
                fieldId: 'adjustqtyby',
                value: Number(payload.qty)*-1
            });

            invAdj.setCurrentSublistValue({
                sublistId: 'inventory',
                fieldId: 'location',
                value: payload.location
            });
            var subrec = invAdj.getCurrentSublistSubrecord({
                sublistId: 'inventory',
                fieldId: 'inventorydetail'
            });
            subrec.selectNewLine({
                sublistId: 'inventoryassignment'
            });

            subrec.setCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'binnumber',
                value: payload.bin
            });
            subrec.setCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'quantity',
                value: Number(payload.qty)*-1
            });

            subrec.commitLine({
                sublistId: 'inventoryassignment'
            });
            log.debug('commit line - created sub', 1)
            invAdj.commitLine({
                sublistId: 'inventory'
            });


            invAdj.selectNewLine({
                sublistId: 'inventory'
            });
            invAdj.setCurrentSublistValue({
                sublistId: 'inventory',
                fieldId: 'item',
                value: payload.returnEM
            });
            
            invAdj.setCurrentSublistValue({
                sublistId: 'inventory',
                fieldId: 'adjustqtyby',
                value: Number(payload.qty)
            });

            invAdj.setCurrentSublistValue({
                sublistId: 'inventory',
                fieldId: 'location',
                value: payload.location
            });
            var subrec = invAdj.getCurrentSublistSubrecord({
                sublistId: 'inventory',
                fieldId: 'inventorydetail'
            });
            subrec.selectNewLine({
                sublistId: 'inventoryassignment'
            });

            subrec.setCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'binnumber',
                value: payload.bin
            });
            subrec.setCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'quantity',
                value: Number(payload.qty)
            });
  
            subrec.commitLine({
                sublistId: 'inventoryassignment'
            });
            log.debug('commit line - created sub', 1)
            invAdj.commitLine({
                sublistId: 'inventory'
            });

            var savedAdjustment = invAdj.save()
            return savedAdjustment
        }

        return {
            onAction: onAction
        };

    });