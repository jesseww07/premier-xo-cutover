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
            var deliveryRec = context.newRecord
            var deliveryRecID = deliveryRec.id
            var getContentRecords = retrieveContentRecords(deliveryRecID)
            if(getContentRecords){
                var returnedAdjustment = createInvAdj(getContentRecords)
                editCustRecord(getContentRecords)
                deliveryRec.setValue({
                    fieldId: 'custrecord_pr_cust_owned_inv_adj',
                    value: returnedAdjustment
                })
            }


        }
        const createInvAdj = (getContentRecords) => {
            var invAdj = record.create({
                type: 'inventoryadjustment',
                isDynamic: true,
            })
            invAdj.setValue({
                fieldId: 'subsidiary',
                value: 2,
            });
            invAdj.setValue({
                fieldId: 'adjlocation',
                value: 9,
            });
            invAdj.setValue({
                fieldId: 'account',
                value: 235,
            });
        

            for (let i = 0; i < getContentRecords.length; i++) {
                var ordItem = getContentRecords[i].item
                var ordQty = getContentRecords[i].qty
                var binNumber = getContentRecords[i].bin
               

                invAdj.selectNewLine({
                    sublistId: 'inventory'
                });
                invAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'item',
                    value: ordItem
                });
                var turnNegative = Number(ordQty) * -1
                invAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'adjustqtyby',
                    value: turnNegative
                });
                invAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'location',
                    value: 9
                });
                invAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'unitcost',
                    value: 0.00
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
                    value: binNumber
                });
                subrec.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'quantity',
                    value: turnNegative
                });
                log.debug('commit line in sub - set number', 1)
                subrec.commitLine({
                    sublistId: 'inventoryassignment'
                });
                log.debug('commit line - created sub', 1)
                invAdj.commitLine({
                    sublistId: 'inventory'
                });
            }
            var savedAdjustment = invAdj.save()
            return savedAdjustment
        }
        const editCustRecord = (getContentRecords) => {
            for(var x=0; x<getContentRecords.length;x++){
                var custRec = record.load({
                    type: 'customrecord_stored_inventory_contents',
                    id: getContentRecords[x].id
                })
                custRec.setValue({
                    fieldId: 'custrecord_stored_qty',
                    value: 0
                })
                custRec.save()
            }
            return
        }
        const retrieveContentRecords = (deliveryRecID) => {
            var contentArray = new Array()
            var customrecord_stored_inventory_contentsSearchObj = search.create({
                type: "customrecord_stored_inventory_contents",
                filters:
                [
                   ["custrecord_pr_delivery_record","anyof",deliveryRecID]
                ],
                columns:
                [
                   "internalid",
                   "custrecord_stored_item",
                   "custrecord_stored_qty",
                   "custrecord_stored_bin"
                ]
             });
             var searchResultCount = customrecord_stored_inventory_contentsSearchObj.runPaged().count;
             log.debug("customrecord_stored_inventory_contentsSearchObj result count",searchResultCount);
             customrecord_stored_inventory_contentsSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var item = result.getValue({
                    name: 'custrecord_stored_item'
                })
                var qty = result.getValue({
                    name: 'custrecord_stored_qty'
                })
                var bin = result.getValue({
                    name: 'custrecord_stored_bin'
                })
                var id = result.getValue({
                    name: 'internalid'
                })
                var contentObject = new Object()
                contentObject.item = item
                contentObject.qty = qty
                contentObject.bin = bin
                contentObject.id = id
                contentArray.push(contentObject)
                return true;
             });
             return contentArray
        }
        return {
            onAction: onAction
        };

    });
