/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {util} util
     */
    function (log, record, search, util) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(context) {
            var returnData = getItems()
            log.debug('returnData',returnData)
            if(returnData.length>0){
                //for(var i=0;i<returnData.length;i++){
                for(var i=0;i<5;i++){
                    var lineData = returnData[i]
                    var processEdit = editItem(lineData)
                }
            }
        }
        const editItem = (lineData) => {
            log.debug('lineData',lineData)
            var it = record.load({
                type: 'inventoryitem',
                id: lineData.int,
                isDynamic:true
            })
            var itemName = it.setValue({
                fieldId:'custitem_la_manufacturer_name',
                value:lineData.vendor
            })
            var itemName = it.setValue({
                fieldId:'custitem_la_manufacturer_number',
                value:lineData.itemName
            })
            it.save()
        }
        const getItems = () => {
            var returnArr = new Array()
            var itemSearchObj = search.create({
                type: "item",
                filters:
                [
                   ["custitem_la_manufacturer_name","isempty",""], 
                   "AND", 
                   ["isinactive","is","F"]
                ],
                columns:
                [
                   "internalid",
                   search.createColumn({
                      name: "itemid",
                      sort: search.Sort.ASC
                   }),
                   "custitem_la_manufacturer_number",
                   "custitem_la_manufacturer_name",
                   "vendor"
                ]
             });
             var searchResultCount = itemSearchObj.runPaged().count;
             log.debug("itemSearchObj result count",searchResultCount);
             itemSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var itemName = result.getValue({
                    name:'itemid'
                })
                var vendor = result.getValue({
                    name:'vendor'
                })
                var int = result.getValue({
                    name:'internalid'
                })
                var retObj = new Object()
                retObj.itemName = itemName
                retObj.vendor = vendor
                retObj.int = int
                returnArr.push(retObj)
                return true;
             });
             return returnArr
        }
 
       



        return {
            execute: execute
        };

    });
