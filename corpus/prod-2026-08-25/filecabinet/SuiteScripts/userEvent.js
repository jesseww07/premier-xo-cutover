/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

define(['N/record', 'N/search'],

    /**
     * @param {record} record
     * @param {search} search
     */
    function (record, search) {

        /**
         * Function definition to be triggered before record is loaded.
         * @param {Object} context
         * @param {Record} context.newRecord - New record
         * @param {Record} context.oldRecord - Old record
         * @param {string} context.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(context) {
            log.debug(context)
            if (context.type !== 'create') {
                return;
            }
            else {
                let thisRecord = context.newRecord
                if (thisRecord.id) {
                    let loadedRecord = record.load({
                        type: thisRecord.type,
                        id: thisRecord.id,
                        isDynamic: true
                    })
                    //grab the item id

                    var itemId = loadedRecord.getValue({
                        fieldId: 'custrecord_zastro_item_name'
                    })
                    //THIS WILL come throuogh as an internal id when it is pulled
                    //run a search to get the purchase price
                    //use the below function with a search - THIS IS NOT COMPLETE
                    var returnedPrice = fetchPrice(itemId)
                    log.debug('returnedPrice', returnedPrice)
                    //set the purchase price with returned variable
                    loadedRecord.setValue({
                        fieldId: "custrecord_zastro_item_purchase_price", 
                        value: returnedPrice

                    })
                    loadedRecord.save()
                    
                }

            }
        }

        const fetchPrice = (itemId) => {
            //define a variable
            var itemCost = 0
            //set that variable (override) with result in the loop
            //change the id searched against in the filters with the variable passed through the function
            //return the variable as the end of the function
            var itemSearchObj = search.create({
                type: "item",
                filters:
                    [
                        ["internalid", "anyof", itemId]
                    ],
                columns:
                    [
                        "vendorcost"
                    ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            log.debug("itemSearchObj result count", searchResultCount);
            itemSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var vendorCost = result.getValue({
                    name: 'vendorcost'
                })
                itemCost = vendorCost;
            
                return true;
            });
            return itemCost;
        }

        return {
            //beforeLoad: null,
            //beforeSubmit: null,
            afterSubmit: afterSubmit
        }
    }
);