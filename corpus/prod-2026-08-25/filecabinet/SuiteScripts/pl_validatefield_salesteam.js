/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/runtime'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {record} search
     * * @param {record} runtime
     */
    function (log, record, search, runtime) {


        function validateField(context) {
            var thisRecord;
            try {
                thisRecord = context.currentRecord
            }
            catch (e) {
                thisRecord = currentRecord.get()
            }



            try {
                var internal = thisRecord.id


                if (context.fieldId == 'entity') {

                    var currentUser = runtime.getCurrentUser()
                    log.debug('currentUser', currentUser)
                    var salesRep = currentUser.id
                    log.debug('salesRep', salesRep)

                    var numLines = thisRecord.getLineCount({
                        sublistId: 'salesteam'
                    })
                    
                    log.debug('numLines', numLines)
                  
                    if (numLines == 1) {
                        thisRecord.removeLine({
                            sublistId: 'salesteam',
                            line: 0,
                            ignoreRecalc: false
                        });
                        log.debug('zero?')
                        thisRecord.selectNewLine({
                            sublistId: 'salesteam'
                        })
                        thisRecord.setCurrentSublistValue({
                            sublistId: 'salesteam',
                            fieldId: 'employee',
                            value: salesRep
                        });
                        thisRecord.setCurrentSublistValue({
                            sublistId: 'salesteam',
                            fieldId: 'isprimary',
                            value: true
                        });
                        thisRecord.setCurrentSublistValue({
                            sublistId: 'salesteam',
                            fieldId: 'issalesrep',
                            value: true
                        });
                        thisRecord.setCurrentSublistValue({
                            sublistId: 'salesteam',
                            fieldId: 'salesrole',
                            value: -2,
                        });
                        thisRecord.setCurrentSublistValue({
                            sublistId: 'salesteam',
                            fieldId: 'contribution',
                            value: '100.0%',
                        });
                        thisRecord.commitLine({
                            sublistId: 'salesteam'
                        });
                    }

                }
                return true
            }
            catch (e) {
                log.error('error', e)
                return true
            }
        }

        return {
            //pageInit: pageInit,
            //        fieldChanged: fieldChanged,
            //        postSourcing: postSourcing,
            //        sublistChanged: sublistChanged,
            //lineInit: lineInit,
            validateField: validateField,
            //         validateLine: validateLine,
            //        validateInsert: validateInsert,
            //        validateDelete: validateDelete,
            //        saveRecord: saveRecord
        };

    });

