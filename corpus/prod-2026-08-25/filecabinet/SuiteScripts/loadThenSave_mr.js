/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/format', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/util', 'N/file', 'N/render', 'N/email'],
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
    function (format, log, record, runtime, search, task, util, file, render, email) {

        function getInputData() {
            var mySearch = search.load({
                id: 'customsearch1508'
            })
            return mySearch
        }

        function map(context) {
         //return false
            try {
                let result = JSON.parse(context.value);
                log.debug('result', result)
                let id = result.id
                log.debug('id', id)
              

                var loadedRec = record.load({
                    type:'customrecord_zastro_lights_items',
                    id: id,
                    isDynamic:true
                })
    
                loadedRec.save({ignoreMandatoryFields: true})
                return true
              
            }
            catch (e) {
                log.error('COULD NOT COMPLETE MAPPING', e)
            }
        }

      

     

        function returner(word) {
            word = word.replace(/&/g, "&amp;")
            word = word.replace(/</g, "&lt;")
            word = word.replace(/>/g, "&gt;")
            word = word.replace(/'/g, "&#39;")
            word = word.replace(/"/g, "&quot;");
            return word
        }

        return {
            getInputData: getInputData,
            map: map,
            //  reduce: reduce,
            //        summarize: summarize
        };
    });
