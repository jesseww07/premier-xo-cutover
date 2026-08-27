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
             itemRec = context.currentRecord
         }
         catch (e) {
             log.debug('get')
             itemRec = currentRecord.get()
         }
         //log.debug('this record', thisRecord)
         try {

             var vendors = itemRec.getLineCount({
                 sublistId: 'itemvendor'
             });
             log.debug('itemRec', itemRec)
             log.debug('vendors', vendors)
             var preferred = false
             if (vendors > 0) {
                 log.debug("in if")
                 for (var x = 0; x < vendors; x++) {
                    log.debug("in loop")
                     var selectLine = itemRec.selectLine({
                         sublistId: 'itemvendor',
                         line: x
                     });
                     var hasPreferred = itemRec.getCurrentSublistValue({
                         sublistId: 'itemvendor',
                         fieldId: 'preferredvendor'
                     });
                     if (hasPreferred == true) {
                         preferred = true
                     }
                 }
             }
             if (hasPreferred == false) {
                 runDialog()
                 
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
                     message: 'Please check the box for a preferred vendor!'
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