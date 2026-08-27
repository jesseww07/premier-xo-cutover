define(['N/search', 'N/record', 'N/log'],
    (search, record, log) => {
        /**
         * Module Description...
         *
         * @type {Object} module-name
         * @copyright 2021
         * @author  <>
         * @NApiVersion 2.1
         * @NModuleScope SameAccount
         * @NScriptType ClientScript
         */
        var exports = {};
        /**
         * fieldChanged event handler; executed when a field is changed by a user or client side call.
         *
         * @gov XXX
         *
         * @param {Object} context
         * @param {CurrentRecord} context.currentRecord - The current form record
         * @param {string} context.sublistId - The internal ID of the sublist.
         * @param {string} context.fieldId - The internal ID of the field that was changed.
         * @param {string} [context.lineNum] - The index of the line if the field is in a sublist or
         *        matrix.
         * @param {string} [context.columnNum] - The index of the column if the field is in a matrix.
         */
        function fieldChanged(context) {
            let thisRecord;
            thisRecord = context.currentRecord
            log.debug('context.fieldId', context.fieldId)
            if (context.fieldId == 'paymentmethod') {
                var stopAutomation = thisRecord.getValue({
                    fieldId: 'custbody_stop_pp_automation'
                })
                var orderFromLocation = thisRecord.getValue({
                    fieldId: 'custbody_pl_ordered_from_location'
                })
                log.debug('orderFromLocation', orderFromLocation)
                log.debug('stopAutomation', stopAutomation)
                if (stopAutomation == false) {
                    var useProfile = getPaymentProfileID(orderFromLocation)
                    if(useProfile){
                        thisRecord.setValue({
                            fieldId:'creditcardprocessor',
                            value:useProfile
                        })
                        return true
                    }
                    else{
                        return true
                    }
                }


                return true
            }
            else {
                return true
            }
        }
        getPaymentProfileID = (orderFromLocation) => {
            var returnProf;
            //phoenix

            if (orderFromLocation == 8) {
                returnProf = 4
            }
            //scottsdale
            else if (orderFromLocation == 5 || orderFromLocation == 6) {
                returnProf = 5
            }
            //tuscon
            else if (orderFromLocation == 1 || orderFromLocation == 2) {
                returnProf = 6
            }
            return returnProf


            // Edit | View	3	Pax - Northside	EXTERNAL	No	No
            // Edit | View	2	Pax - Phoenix	EXTERNAL	No	No
            // Edit | View	1	Pax - Scottsdale	EXTERNAL	No	No
            // Edit | View	6	Versapay - Northside	EXTERNAL	No	No
            // Edit | View	4	Versapay - Phoenix	EXTERNAL	No	No
            // Edit | View	5	Versapay - Scottsdale	EXTERNAL	No	No
        }

        //exports.pageInit = pageInit;
        exports.fieldChanged = fieldChanged;
        //exports.saveRecord = saveRecord;
        return exports;
    });