/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/ui/dialog',],
    /**
     * @param {log} log
     * @param {record} record
     * @param {record} search
     * @param {dialog} dialog
     */
    function (log, record, search, dialog) {


        function pageInit(context) {

            log.debug('context')
            var salesOrd = context.currentRecord


            log.debug('salesOrd', salesOrd)

            var taxCorrection = salesOrd.getValue({
                fieldId: 'custbody4'
            });
          log.debug('taxCorrection', taxCorrection)
          var cutoverTax = salesOrd.getValue({
                fieldId: 'custbody1'
            });
		log.debug('cutoverTax', cutoverTax)
            if (taxCorrection == true) {
                runDialog(cutoverTax)
                return true
            }

            else {
                return true
            }

            //  catch (e) {
            //      log.error('error', e)
            //      return true
            //  }
        }

        function runDialog(cutoverTax) {
            require(['N/ui/dialog'],
                function (dialog) {
                    var options = {
                        title: 'Alert',
                        message: `This order may be undergoing tax corrections. Please verify taxes match the ITE tax total of ${cutoverTax}`
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
             pageInit: pageInit,
            //        fieldChanged: fieldChanged,
            //        postSourcing: postSourcing,
            //        sublistChanged: sublistChanged,
            //         lineInit: lineInit,
            //         validateField: validateField,
            //         validateLine: validateLine,
            //        validateInsert: validateInsert,
            //        validateDelete: validateDelete,
            // saveRecord: saveRecord
        };

    });