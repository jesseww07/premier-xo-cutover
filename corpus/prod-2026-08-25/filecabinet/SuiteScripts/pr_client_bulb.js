/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {record} search
     */
    function (log, record, search) {


        function saveRecord(context) {
            var thisRecord;
            try {
                log.debug('context')
                salesOrd = context.currentRecord
            }
            catch (e) {
                log.debug('get')
                salesOrd = currentRecord.get()
            }
            //log.debug('this record', thisRecord)
            try {

                var itemCount = salesOrd.getLineCount({
                    sublistId: 'item'
                });
                log.debug('salesOrd', salesOrd)
                log.debug('itemCount', itemCount)
                var hasBulb = false
                if (itemCount > 0) {
                    for (var x = 0; x < itemCount; x++) {
                        var selectLine = salesOrd.selectLine({
                            sublistId: 'item',
                            line: x
                        });
                        var lightBulb = salesOrd.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_premier_is_bulb'
                        });
                        if (lightBulb == true) {
                            hasBulb = true
                        }
                    }
                }
                if (hasBulb == false) {
                    runDialog()
                    return true
                }

                else {
                    return true
                }
            }
            catch (e) {
                log.error('error', e)
                return true
            }
        }

        function runDialog(whatToSay) {
            require(['N/ui/dialog'],
                function (dialog) {
                    var options = {
                        title: 'Alert',
                        message: 'This order has no bulbs, please revise if applicable.'
                    };
                    function success(result) {
                        console.log('Success with value ' + result);
                    }
                    function failure(reason) {
                        console.log('Failure: ' + reason);
                    }
                    dialog.alert(options).then(success).catch(failure);
                });
        }

        return {
            // pageInit: pageInit,
            //        fieldChanged: fieldChanged,
            //        postSourcing: postSourcing,
            //        sublistChanged: sublistChanged,
            //         lineInit: lineInit,
            //         validateField: validateField,
            //         validateLine: validateLine,
            //        validateInsert: validateInsert,
            //        validateDelete: validateDelete,
            saveRecord: saveRecord
        };

    });