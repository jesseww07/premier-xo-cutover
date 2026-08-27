/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/format', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/util', 'N/file'],
    /**
     * @param {format} format
     * @param {log} log
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {task} task
     * @param {util} util
     */
    function (format, log, record, runtime, search, task, util, file) {

        function getInputData() {

            let mySearch = search.load({
                id: 'customsearch638'
            })
            return mySearch
        }

        function map(context) {
            try {
        
                let result = JSON.parse(context.value)
                log.debug('context',result)
                let recID = result.id
                let recItem = result.values.itemid
                let recVen = result.values.vendor.text
            

                var it = record.load({
                    type: 'inventoryitem',
                    id: recID,
                    isDynamic:true
                })
                var itemName = it.setValue({
                    fieldId:'custitem_la_manufacturer_name',
                    value:recVen
                })
                var itemName = it.setValue({
                    fieldId:'custitem_la_manufacturer_number',
                    value:recItem
                })
                it.save()
            }
            catch (e) {
                log.error('COULD NOT COMPLETE MAPPING', e)
            }

        }

        return {
            getInputData: getInputData,
            map: map,
            //        reduce: reduce,
            //        summarize: summarize
        };

    });



