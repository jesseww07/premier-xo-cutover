/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/format', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/util'],
    /**
     * @param {format} format
     * @param {log} log
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {task} task
     * @param {util} util
     */
    function (format, log, record, runtime, search, task, util) {

        function getInputData() {

            let mySearch = search.load({
                id: 'customsearch446'
            })
            return mySearch
        }

        function map(context) {
            try {
                let result = JSON.parse(context.value)
                let recordId = result.id
                record.delete({
                    type: 'bin',
                    id: recordId,
                });
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