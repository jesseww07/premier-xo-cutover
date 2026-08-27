define(['N/record','N/search'], function (record,search) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    var exports = {};
    function beforeLoad(context) {
        let thisRecord = context.newRecord
        if (thisRecord.id) {
            let loadedRecord = record.load({
                type: thisRecord.type,
                id: thisRecord.id,
                isDynamic: true
            })
            log.debug('thisRecord', thisRecord)
            let form = loadedRecord.getValue('customform')
            let vendor = loadedRecord.getValue('custrecord_zastro_vendor')
            let location = loadedRecord.getValue('custrecord_ill_location')

        
            log.debug('form', form)
            log.debug({
                title: 'before load triggered',
                details: context.type
            })
            if(location){
                var searchReturn = runDocSearch(vendor,location)
                if(searchReturn > 1){
                    context.form.addButton({
                        id: "custpage_build_orders",
                        label: "Open Bucket Addditional Location",
                        functionName: "openSuitelet"
                    });
                }
                else{
                    //do nothing
                }
            }
         
            context.form.clientScriptModulePath = "SuiteScripts/pr_loc_cl.js";
        }
        else {
            return
        }
    }
    const runDocSearch = (vendor,location) => {
        var returnLoad;
        var customrecord_zastro_po_consolidSearchObj = search.create({
            type: "customrecord_zastro_po_consolid",
            filters:
            [
               ["custrecord_zastro_vendor","anyof",vendor], 
               "AND", 
               ["custrecord_zastro_is_consolidated","is","F"]
            ],
            columns:
            [
               "internalid"
            ]
         });
         var searchResultCount = customrecord_zastro_po_consolidSearchObj.runPaged().count;
         log.debug("customrecord_zastro_po_consolidSearchObj result count",searchResultCount);
         customrecord_zastro_po_consolidSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var docID = result.getValue({
                name: 'internalid'
            })
            returnLoad = docID
            return true;
         });
         return searchResultCount
    }
    exports.beforeLoad = beforeLoad;
    return exports;
});

