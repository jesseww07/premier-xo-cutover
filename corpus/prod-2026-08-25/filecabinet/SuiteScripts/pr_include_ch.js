/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     */
    function (log, record, search) {

        function getInputData() {

            var mySearch = search.load({
                id: 'customsearch429'
            })
            return mySearch
        }

        function map(context) {
            try {
                var result = JSON.parse(context.value)
                var recordId = result.id
				log.debug('result', result)
				log.debug('recordId', recordId)
                             let invItem = record.load({
                    type: 'inventoryitem',
                    id: recordId
                });
                let includeCh= invItem.setValue({
                    fieldId: 'includechildren',
                  	value: true
                })
                invItem.save()
            
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



