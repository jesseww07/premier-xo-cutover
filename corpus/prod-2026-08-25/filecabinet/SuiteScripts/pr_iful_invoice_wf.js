/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {ui} ui
     * @param {dialog} dialog
     * @param {runtime} runtime
     */
    function (record, search, ui, dialog, runtime) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(context) {
            try {
                var custRec = context.newRecord
                var id = custRec.id
                log.debug(id)
                var createdFrom = custRec.getValue({
                    fieldId:'createdfrom'
                })
                var returnItems = getArray(custRec)
                log.debug('returnItems', returnItems)
                var createdInv = createInvoice(createdFrom, returnItems)
                log.debug('createdInv', createdInv)
                custRec.setValue({
                    fieldId: 'custbody_pr_focused_invoice',
                    value: createdInv
                });
            }
            catch (e) {
                log.debug('failure in eaches', e)
            }
        }
        const getArray = (objRecord) => {
            var returnArr = new Array()
            var numLines = objRecord.getLineCount({
                sublistId: 'item'
            });
            if (numLines > 0) {
                var indexCount = Number(numLines) - 1
                //log.debug('indexCount', indexCount)
                for (var l = 0; l <= indexCount; l++) {
                    var ordItem = objRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: l
                    })
                    var ordRoom = objRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pr_room_location',
                        line: l
                    })
                    var ordQty = objRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: l
                    })
                    var lineObj = new Object()
                    lineObj.item = ordItem
                    lineObj.room = ordRoom
                    lineObj.qty = ordQty
                    returnArr.push(lineObj)
                }
            }
            return returnArr
        }
        const createInvoice = (id, returnItems) => {
            try{
                var objRecord = record.transform({
                    fromType: 'salesorder',
                    fromId: id,
                    toType: 'invoice',
                    isDynamic: true,
                });
                var numLines = objRecord.getLineCount({
                    sublistId: 'item'
                });
                if (numLines > 0) {
                    var indexCount = Number(numLines) - 1
                    log.debug('indexCount', indexCount)
                    for (var x = Number(indexCount); x >= 0; x--) {
                        log.debug('x',x)
                        var invItem = objRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: x
                        })
                        var invRoom = objRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pr_room_location',
                            line: x
                        })
                        var matchFound = false
                        log.debug('invItem',invItem)
                        for(var z=0;z<returnItems.length;z++){
                            var matchItem = returnItems[z].item
                     
                            log.debug('matchItem',matchItem)
                            if(invItem == matchItem){
                                log.debug('invRoom',invRoom)
                                log.debug('matchRoom',matchRoom)
                                var matchRoom = returnItems[z].room
                                if(invRoom == matchRoom){
                                    log.debug('IN',invItem)
                                    matchFound = true
                                    objRecord.selectLine({
                                        sublistId: 'item',              
                                        line: x,
                                    })
                                    objRecord.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'quantity',
                                        line: x,
                                        value: returnItems[z].qty
                                    })
                                    objRecord.commitLine({
                                        sublistId: 'item'
                                    })
                                }
                            }
                        }
                        if(matchFound == true){
                            //yay
                            log.debug('we have match', invItem)
                        }
                        else{
                            log.debug('run delete', invItem)
                            objRecord.removeLine({
                                sublistId: 'item',
                                line: x
                            });
                        }
                    }
                    var rec = objRecord.save()
                    return rec
                }
            }
            catch(e){
                log.debug('e',e)
                return null
            }
        }

        return {
            onAction: onAction
        };

    });
