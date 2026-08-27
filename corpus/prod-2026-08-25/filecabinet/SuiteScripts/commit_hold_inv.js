/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime', 'N/https', 'N/xml'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {ui} ui
     * @param {dialog} dialog
     * @param {runtime} runtime
     * @param {https} https
     * @param {xml} xml
     */
    function (record, search, ui, dialog, runtime, https, xml) {

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
                let salesOrd = context.newRecord
                var id = salesOrd.id
                log.debug('id', id)
                var objRecord = record.load({
                    type:'salesorder',
                    id: id,
                    isDynamic: true
                })

                // let objRecord = context.newRecord
                // var id = objRecord.id
                // log.debug('id', id)
               
                var commitOff = objRecord.getValue({
                    fieldId: 'custbody_pr_turn_commit_off'
                })
                var numLines = objRecord.getLineCount({
                    sublistId: 'item'
                });
                for (var i = 0; i < numLines; i++) {
                    var invCommit = objRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'commitinventory',
                        line: i
                    });
                    log.debug('invCommit',invCommit)
                    log.debug('commitOff',commitOff)
                    if (invCommit == 1 && commitOff == false) {
                        var lineNum = objRecord.selectLine({
                            sublistId: 'item',
                            line: i
                        });
                        objRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'commitinventory',
                            value: 3,
                            ignoreFieldChange: true
                        });
                        objRecord.commitLine({
                            sublistId: 'item'
                        });
                    }
                    else if(invCommit == 3 && commitOff == true){
                        var lineNum = objRecord.selectLine({
                            sublistId: 'item',
                            line: i
                        });
                        objRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'commitinventory',
                            value: 1,
                            ignoreFieldChange: true
                        });
                        objRecord.commitLine({
                            sublistId: 'item'
                        });
                    }
                }
                if(commitOff == true){
                    objRecord.setValue({
                        fieldId: 'custbody_pr_turn_commit_off',
                        value: false
                    })
                }
                else{
                    objRecord.setValue({
                        fieldId: 'custbody_pr_turn_commit_off',
                        value: true
                    })
                }
                objRecord.save()
            }
            catch (e) {
                log.debug('e', e)
            }
        }



        return {
            onAction: onAction
        };

    });
