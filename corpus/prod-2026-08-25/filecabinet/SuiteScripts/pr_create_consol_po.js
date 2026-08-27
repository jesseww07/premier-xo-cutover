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
            try{
                       log.debug(context)
                var loadCust = context.newRecord
                var id = loadCust.id
                log.debug(id)
              //customrecord_zastro_po_consolid
                var vendorNo = loadCust.getValue({
                    fieldId: 'custrecord_zastro_vendor'
                });
                var loc = loadCust.getValue({
                    fieldId: 'custrecord_ill_location'
                });
                
              log.debug('vendorNo', vendorNo)
                if(vendorNo){
                    var returnObj = getPOInfo(id)
                    log.debug('returnObj',returnObj)
                    var returnedPO = createPO(returnObj,vendorNo,id,loc)
                    var returnLine = closeLineItems(id)
                    var returnParent = closeParentDoc(id, returnedPO)

                }
            }
            catch(e){
                log.debug('e',e)
            }
        }


        const createPO = (returnObj, vendorNo, id, loc) => {
            var purchOrd = record.create({
                type: 'purchaseorder',
                isDynamic: true
            });
            purchOrd.setValue({
                fieldId: 'entity',
                value: vendorNo
            })
            purchOrd.setValue({
                fieldId: 'location',
                value: loc
            })
            purchOrd.setValue({
                fieldId: 'supervisorapproval',
                value: true
            })
           purchOrd.setValue({
                fieldId: 'custbody_zastro_po_source',
                value: id
            })
          
            if(returnObj){
                for(var x=0; x<returnObj.length; x++){
                    purchOrd.selectNewLine({
                        sublistId: 'item'
                    });
                    purchOrd.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: returnObj[x].item
                    });
                    purchOrd.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: returnObj[x].qty
                    });
                    purchOrd.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: returnObj[x].cost
                    });
                    purchOrd.commitLine({
                        sublistId: 'item'
                    })
                }
                var poID = purchOrd.save()
            }
            if(poID){
                return poID
            }
            else{
                return 'nope'
            }
        }

        const getPOInfo = (itemList) => {
          var poArray = new Array ()
            var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
                type: "customrecord_zastro_unconsolidated_items",
                filters:
                [
                   ["custrecord_zastro_po_item_list","anyof",itemList], 
                   "AND", 
                   ["custrecord_zastro_is_consolidated_on_po","is","F"]
                ],
                columns:
                [
                   search.createColumn({
                      name: "custrecord_zastro_item_name",
                      summary: "GROUP"
                   }),
                   search.createColumn({
                      name: "custrecord_zastro_qty",
                      summary: "SUM"
                   }),
                   search.createColumn({
                      name: "custrecord_zastro_item_purchase_price",
                      summary: "GROUP"
                   }),
                   search.createColumn({
                      name: "custrecord_zastro_so_no",
                      summary: "MAX"
                   }),
                   search.createColumn({
                      name: "custrecord_zastro_customer",
                      summary: "GROUP"
                   })
                ]
             });
             var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
             log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count",searchResultCount);
             customrecord_zastro_unconsolidated_itemsSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var item = result.getValue({
                    name: 'custrecord_zastro_item_name',
                  	summary: search.Summary.GROUP
                })
                var qty = result.getValue({
                    name: 'custrecord_zastro_qty',
                  	summary: search.Summary.SUM
                })
                var cost = result.getValue({
                    name: 'custrecord_zastro_item_purchase_price',
                  	summary: search.Summary.GROUP
                })
                var itemObject = new Object ()
                itemObject.item = item
                itemObject.qty = qty
                itemObject.cost = cost
                poArray.push(itemObject)

        
                return true;
             });
             return poArray
        }

        const closeLineItems = (id) => {
            var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
                type: "customrecord_zastro_unconsolidated_items",
                filters:
                [
                   ["custrecord_zastro_po_item_list","anyof",id], 
                   "AND", 
                   ["custrecord_zastro_is_consolidated_on_po","is","F"]
                ],
                columns:
                [
                   "internalid"
                ]
             });
             var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
             log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count",searchResultCount);
             customrecord_zastro_unconsolidated_itemsSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var lineID = result.getValue({
                    name: 'internalid'
                })
                var consItem = record.load({
                    type: 'customrecord_zastro_unconsolidated_items',
                    id: lineID,
                    isDynamic: true
                })
                consItem.setValue({
                    fieldId: 'custrecord_zastro_is_consolidated_on_po',
                    value: true
                })
                consItem.save()
                return true;
             });
             return 'done'
        }

        const closeParentDoc = (internal, po) => {
            var parentRec = record.load({
                type: 'customrecord_zastro_po_consolid',
                id: internal,
                isDynamic: true
            })
            parentRec.setValue({
                fieldId: 'custrecord_zastro_is_consolidated',
                value: true
            })
             parentRec.setValue({
                fieldId: 'custrecord_zastro_po_no',
                value: po
            })
          
            parentRec.save()
        }

        return {
            onAction: onAction
        };

    });