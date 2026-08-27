define(['N/record', 'N/ui/serverWidget', 'N/search'], function (record, serverWidget, search) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    var exports = {};
    function afterSubmit(context) {
        let thisRecord = context.newRecord
        if (thisRecord.id) {
            try{
              
                var poNum = thisRecord.getValue({
                    fieldId: 'custrecord_special_consolidated_po'
                });
                var poKey = thisRecord.getValue({
                    fieldId: 'custrecord_consolidated_po_unique'
                });
                var item = thisRecord.getValue({
                    fieldId: 'custrecord_special_consolidated_item'
                });

                var salesOrd = thisRecord.getValue({
                    fieldId: 'custrecord_special_consolidated_so'
                });
                log.debug('salesOrd',salesOrd)

                   var itemPrice = thisRecord.getValue({
                    fieldId: 'custrecord_consol_item_rate'
                });
                log.debug('itemPrice', itemPrice)

                if (itemPrice) {
                    log.debug('already price set, stopping')
                   // return false
                }

                if (!itemPrice){
                    let vendorPrice = getPrice(item)
                    log.debug('vendor price',vendorPrice)
                    if(vendorPrice){
                        record.submitFields({
                            type: 'customrecord_consolidated_special_order',
                            id: thisRecord.id,
                            values: {
                                'custrecord_consol_item_rate': vendorPrice
                            }
                        });
                    }
                }

                if(salesOrd){
                let loadedRecord = record.load({
                    type: 'salesorder',
                    id: salesOrd,
                    isDynamic: true
                })

                let depositAmt = loadedRecord.getValue('custbody_zas_deposit_taken')
                log.debug('depositAmt', depositAmt)
                if(depositAmt){

                    record.submitFields({
                        type: 'customrecord_consolidated_special_order',
                        id: thisRecord.id,
                        values: {
                            'custrecord_mli_consol_deposit': depositAmt
                        }
                    });
                }
            }
              else{
                log.debug('in th eelse')
              //if(Number(salesOrd)<0){
                    //  log.debug('in th SUBMIT')
                    //  record.submitFields({
                    //     type: 'customrecord_consolidated_special_order',
                    //     id: thisRecord.id,
                    //     values: {
                    //         'custrecord_special_consolidated_so': 18553
                    //     }
                    // });
             // }
           
              }
                
                if(item && poNum && !poKey){
                    log.debug('poNum',poNum)
                    log.debug('poKey',poKey)
                    log.debug('item',item)
                    var returnKey = findPOKey(poNum,item)
                    log.debug('returnKey',returnKey)
                    if(returnKey){
                        
                        record.submitFields({
                            type: 'customrecord_consolidated_special_order',
                            id: thisRecord.id,
                            values: {
                                'custrecord_consolidated_po_unique': returnKey
                            }
                        });
                    }
               
                }

               



            }catch(e){
                log.debug('e',e)
            }
  
        }
    }

    const getPrice = (item) =>{
        let cost
        var itemSearchObj = search.create({
            type: "item",
            filters:
            [
               ["internalidnumber","equalto",item]
            ],
            columns:
            [
               "vendorcost"
            ]
         });
         var searchResultCount = itemSearchObj.runPaged().count;
         log.debug("itemSearchObj result count",searchResultCount);
         itemSearchObj.run().each(function(result){
             cost = result.getValue('vendorcost')
          log.debug('cost',cost)
            return true;
         });
         return cost
    }


    const findPOKey = (poNum,item) => {
        var returnVal;
        var purchaseorderSearchObj = search.create({
            type: "purchaseorder",
            filters:
            [
               ["type","anyof","PurchOrd"], 
               "AND", 
               ["mainline","is","F"], 
               "AND", 
               ["taxline","is","F"], 
               "AND", 
               ["shipping","is","F"], 
               "AND", 
               ["internalidnumber","equalto",poNum], 
               "AND", 
               ["item","anyof",item]
            ],
            columns:
            [
               "lineuniquekey"
            ]
         });
         var searchResultCount = purchaseorderSearchObj.runPaged().count;
         log.debug("purchaseorderSearchObj result count",searchResultCount);
         purchaseorderSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var res = result.getValue({name:'lineuniquekey'})
            returnVal = res
            return true;
         });
        return returnVal
    }

    //exports.beforeLoad = beforeLoad;
    exports.afterSubmit = afterSubmit;
    return exports;
});