// Minka AIR
// If the customer has a price level discount and a mink product shows then revert that product to retail, at the bottom of the order put in our special discount item at the price level equivalent of their total item price(s)
// Bulbs don’t get discounted
// Add a recalc button

define(['N/record', 'N/search'], function (record, search) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    var exports = {};
    function afterSubmit(context) {
        try{
            let curLoad = context.newRecord
            if (curLoad.id) {
                let thisRecord = record.load({
                    type: curLoad.type,
                    id: curLoad.id,
                    isDynamic: true
                })
                let itemID = curLoad.id
                var itemText = thisRecord.getValue({
                    fieldId:'displayname'
                })
                var currImg = thisRecord.getValue({
                    fieldId:'custitem_idwd_vend_item_image'
                })
                if(currImg){
                    return
                }
                var returnCustom = checkCustomRecords(itemText)
                if(returnCustom){
                    thisRecord.setValue({
                        fieldId:'custitem_idwd_vend_item_image',
                        value:returnCustom
                    })
                    thisRecord.save()
                }
    
            }
        }
        catch(e){
            log.debug('e',e)
        }
    }
    const checkCustomRecords = (itemText) => {
        var rtnString = ''
        var customrecord_zastro_la_data_dumpSearchObj = search.create({
            type: "customrecord_zastro_la_data_dump",
            filters:
            [
               ["custrecord_zas_manufacturer_number","is",itemText]
            ],
            columns:
            [
               "custrecord_zas_image"
            ]
         });
         var searchResultCount = customrecord_zastro_la_data_dumpSearchObj.runPaged().count;
         log.debug("customrecord_zastro_la_data_dumpSearchObj result count",searchResultCount);
         customrecord_zastro_la_data_dumpSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var imageURL = result.getValue({name:'custrecord_zas_image'})
            rtnString = imageURL
            return true;
         });
        return rtnString

    }
    exports.afterSubmit = afterSubmit;
    return exports;
});

