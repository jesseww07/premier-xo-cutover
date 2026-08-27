/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
 define(['N/currentRecord', 'N/url', 'N/https', 'N/search', 'N/ui/dialog', 'N/log'],
 /**
  * @param {record} record
  * @param {search} search
  * @param {dialog} dialog
  */
 function (currentRecord, url, https, search, dialog, log) {

     function pageInit(context) { }

     function fieldChanged(context) {
         try {
             var sublistId = context.sublistId;
             var fieldId = context.fieldId;
             var currentRecord = context.currentRecord;

             // Only trigger if the field changed is the checkbox in the sublist
             if (sublistId === 'sublist' && fieldId === 'custpage_selected') {
                 updateRunningTotal(currentRecord);
             }
         } catch (e) {
             console.error('Error in fieldChanged: ' + e.message);
         }
     }

     /**
      * Function to calculate the running total based on selected checkboxes
      */
     function updateRunningTotal(currentRecord) {
         var total = 0;
         var lineCount = currentRecord.getLineCount({ sublistId: 'sublist' });

         for (var i = 0; i < lineCount; i++) {
             var isChecked = currentRecord.getSublistValue({
                 sublistId: 'sublist',
                 fieldId: 'custpage_selected',
                 line: i
             });

             if (isChecked) {
                 var quantity = currentRecord.getSublistValue({
                     sublistId: 'sublist',
                     fieldId: 'custpage_qty',
                     line: i
                 }) || 0;

                 var rate = currentRecord.getSublistValue({
                     sublistId: 'sublist',
                     fieldId: 'custpage_cost',
                     line: i
                 }) || 0;

                 total += (Number(quantity) * Number(rate));
             }
         }

         // Update a field (e.g., custpage_total) to display the sum
         currentRecord.setValue({
             fieldId: 'custpage_total',
             value: total.toFixed(2) // Formatting to 2 decimal places
         });
     }
     function applyFilter(currentRecord) {
        log.error('CLICK')
        dialog.alert({
            title: "Testting",
            message: "Ready to Apply Filter"
        });
        var suiteletUrl = url.resolveScript({
            scriptId: 'customscript_illuminet_generate_master_p',
            deploymentId: 'customdeploy_illuminet_generate_master_p',
            params: { custom_id: 225, filter: 'T' }
          });
        setWindowChanged(window, false);
        window.location.href = suiteletUrl;
     }
     return {
         pageInit: pageInit,
         fieldChanged: fieldChanged,
         applyFilter: applyFilter
     };
 });