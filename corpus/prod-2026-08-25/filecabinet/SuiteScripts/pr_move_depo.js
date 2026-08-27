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
     * @param {file} file
     */
    function (format, log, record, runtime, search, task, util, file) {

        function getInputData() {
            var mySearch = search.load({
                id: 'customsearch508'
            })
            return mySearch
        }

        function map(context) {
            try {
                let result = JSON.parse(context.value);
                let depoID = result.id
                log.debug('depoID', depoID)

                var deposit = record.load({
                    type: 'customerdeposit',
                    id: depoID
                })
                
                // deposit.setValue({
                //     fieldId: 'undepfunds',
                //     value: false
                // })
                deposit.setValue({
                    fieldId: 'account',
                    value: 652
                })
                deposit.save()

            }
            catch (e) {
                log.error('COULD NOT COMPLETE MAPPING', e)
            }

        }

        return {
            getInputData: getInputData,
            map: map,
            //reduce: reduce,
            //        summarize: summarize
        };

    });
