define(['N/record','N/search'], function (record,search) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    var exports = {};
    function afterSubmit(context) {
        let thisRecord = context.newRecord
        if (thisRecord.id) {
            let loadedRecord = record.load({
                type: thisRecord.type,
                id: thisRecord.id,
                isDynamic: true
            })
            var itemList = loadedRecord.getValue({
                fieldId:'custrecord_zastro_po_item_list'
            })
            var purchPrice = loadedRecord.getValue({
                fieldId:'custrecord_zastro_item_purchase_price'
            })
            var purchQty = loadedRecord.getValue({
                fieldId:'custrecord_zastro_qty'
            })
            if(itemList){
                log.debug('itemList',itemList)
                var returnedSum = getItemSum(itemList)
                log.debug('returnedSum',returnedSum)
                var id = record.submitFields({
                    type: 'customrecord_zastro_po_consolid',
                    id: itemList,
                    values: {
                        'custrecord_zastro_total_price': returnedSum
                    }
                });
            }
            else{
                var itemName = loadedRecord.getValue({
                    fieldId:'custrecord_zastro_item_name'
                }) 
                log.debug('itemName',itemName)
                var returnedSum = findVendor(itemName)
                //returnedSum = (Number(returnedSum) - (Number(purchPrice)*Number(purchQty)))
                var itemList = findItemList(itemName)
                log.debug('returnedSum',returnedSum)
                var id = record.submitFields({
                    type: 'customrecord_zastro_po_consolid',
                    id: itemList,
                    values: {
                        'custrecord_zastro_total_price': returnedSum
                    }
                });
            }
           
        }
        else {
            return
        }
    }
    const findItemList = (itemName) => {
        var returnVendor;
        var itemSearchObj = search.create({
            type: "item",
            filters:
            [
               ["internalid","is",itemName]
            ],
            columns:
            [
               "vendor"
            ]
         });
         var searchResultCount = itemSearchObj.runPaged().count;
         log.debug("itemSearchObj result count",searchResultCount);
         itemSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var vendor = result.getValue({
                name: 'vendor'
            })
            returnVendor = vendor
            return true;
         });
         var itemList = getItemList(returnVendor)
         return itemList
    }
    const findVendor = (itemName) => {
        var returnVendor;
        var itemSearchObj = search.create({
            type: "item",
            filters:
            [
               ["internalid","is",itemName]
            ],
            columns:
            [
               "vendor"
            ]
         });
         var searchResultCount = itemSearchObj.runPaged().count;
         log.debug("itemSearchObj result count",searchResultCount);
         itemSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var vendor = result.getValue({
                name: 'vendor'
            })
            returnVendor = vendor
            return true;
         });
         log.debug('returnVendor',returnVendor)
         var itemList = getItemList(returnVendor)
         log.debug('itemList',itemList)
         var returnedSum = getItemSum(itemList)
         log.debug('HERE',returnedSum)
         return returnedSum
    }
    const getItemList = (returnVendor) => {
        var returnList;
        var customrecord_zastro_po_consolidSearchObj = search.create({
            type: "customrecord_zastro_po_consolid",
            filters:
            [
               ["custrecord_zastro_is_consolidated","is","F"], 
               "AND", 
               ["custrecord_zastro_vendor","anyof",returnVendor]
            ],
            columns:
            [
               search.createColumn({
                  name: "id",
                  sort: search.Sort.ASC
               })
            ]
         });
         var searchResultCount = customrecord_zastro_po_consolidSearchObj.runPaged().count;
         log.debug("customrecord_zastro_po_consolidSearchObj result count",searchResultCount);
         customrecord_zastro_po_consolidSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var list = result.getValue({
                name: 'id'
            })
            returnList = list
            return true;
         });
       return returnList
    }
    const getItemSum = (itemList) => {
        var returnSum = 0
        var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
            type: "customrecord_zastro_unconsolidated_items",
            filters:
            [
               ["custrecord_zastro_is_consolidated_on_po","is","F"], 
               "AND", 
               ["custrecord_zastro_po_item_list","anyof",itemList]
            ],
            columns:
            [
               search.createColumn({
                  name: "formulacurrency",
                  summary: "SUM",
                  formula: "{custrecord_zastro_item_purchase_price}*{custrecord_zastro_qty}"
               })
            ]
         });
         var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
         log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count",searchResultCount);
         customrecord_zastro_unconsolidated_itemsSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var sum = result.getValue({
                name: 'formulacurrency',
                  summary: search.Summary.SUM
            })
            returnSum = sum
            return true;
         });
         return returnSum
    }
    exports.afterSubmit = afterSubmit;
    return exports;
});

