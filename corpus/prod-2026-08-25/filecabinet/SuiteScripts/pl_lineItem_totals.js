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
         log.debug('in onAction');

         try {
            var salesOrder = context.newRecord;
            
            var itemCount = salesOrder.getLineCount({
                sublistId: 'item'
            });

            log.debug('itemCount',itemCount);

            var orderSum = 0;
            var shippedSum = 0;
            var billedSum = 0;

            for (var i=0; i<itemCount; i++) {
                var item = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                })
                var rate = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: i
                })
                var quantity = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                })
                if (item != -2) {
                    var orderTotal = Number(salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: i
                    }));
                    orderSum += orderTotal;
                    var shippedTotal = Number(salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantityfulfilled',
                        line: i
                    }));
                    var lineShipped = shippedTotal * rate;
                    shippedSum += lineShipped;
                    var billedTotal = Number(salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantitybilled',
                        line: i
                    }));
                    var lineBilled = billedTotal * rate;
                    billedSum += lineBilled;
                }
            }
            var percentShipped = (shippedSum / orderSum)*100;
            var percentBilled = (billedSum / orderSum)*100;

            salesOrder.setValue({
                fieldId: 'custbody_pr_percent_shipped',
                value: percentShipped
            })
            salesOrder.setValue({
                fieldId: 'custbody_pr_percent_billed',
                value: percentBilled
            })

            log.debug('order sum', orderSum);
            log.debug('shipped sum', shippedSum);
            log.debug('billed sum', billedSum);
            log.debug('percentage shipped', percentShipped);
            log.debug('percentage billed', percentBilled);

         }
         catch (e) {
             log.debug('failure in eaches', e)
         }
     }
     return {
         onAction: onAction
     };

 });