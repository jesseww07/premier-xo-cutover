/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/format', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/util', 'N/file', 'N/render'],
    /**
     * @param {format} format
     * @param {log} log
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {task} task
     * @param {util} util
     */
    function (format, log, record, runtime, search, task, util, file, render) {

        function getInputData() {

            let mySearch = search.load({
                id: 'customsearch_pr_migrate_inb_po'
            })
            return mySearch
        }

        function map(context) {
            try {
                let result = JSON.parse(context.value)
                let custId = result.id
                log.debug('custId', custId)
                var recObj = record.load({ type: 'customrecord_consolidated_special_order', id: custId })
                var linked = recObj.getValue({ fieldId: 'custrecord_ipo_migrate' })
                var purchOrd = recObj.getValue({ fieldId: 'custrecord_special_consolidated_po' })
                var poKey = recObj.getValue({ fieldId: 'custrecord_consolidated_po_unique' })
                var inboundText = recObj.getValue({ fieldId: 'custrecord_special_consolidated_ref' })
                if (!linked && purchOrd && poKey && inboundText) {
                    var res = sendToPO(purchOrd, poKey, inboundText)
                    if(res){
                        recObj.setValue({fieldId: 'custrecord_ipo_migrate', value: true});
                        recObj.save();
                    }
                }
            }
            catch (e) {
                log.error('COULD NOT COMPLETE MAPPING', e)
            }

        }
        const sendToPO = (purchOrd, poKey, inboundText) => {
            try {
                var poObj = record.load({ type: 'purchaseorder', id: purchOrd, isDynamic: true });

                var lineIndex = poObj.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'lineuniquekey',
                    value: poKey
                });

                if (lineIndex !== -1) {
                    var existingValue = poObj.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pr_inbound_link',
                        line: lineIndex
                    });

                    if (!existingValue) {
                        poObj.selectLine({ sublistId: 'item', line: lineIndex });
                        poObj.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_pr_inbound_link', text: inboundText });
                        poObj.commitLine({ sublistId: 'item' });

                        poObj.save();
                        return true
                    } else {
                        return true
                    }
                    log.debug('Purchase Order Updated', `PO ID: ${purchOrd}, Line Key: ${poKey}, Inbound Text: ${inboundText}`);
                } else {
                    log.debug('Line not found', `PO ID: ${purchOrd}, Line Key: ${poKey}`);
                }
            } catch (e) {
                log.error('Error updating PO', e);
            }
        };


        return {
            getInputData: getInputData,
            map: map,
            //        reduce: reduce,
            //        summarize: summarize
        };

    });



