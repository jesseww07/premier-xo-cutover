/**
 * @NApiVersion 2.1
  * @NModuleScope Public
 * @NScriptType ClientScript
 */
 define(['N/currentRecord', 'N/url', 'N/https', 'N/search', 'N/record'],

 function (currentRecord, url, https, search, record) {
     function pageInit(context) { }

     function fieldChanged(context) {
         let fieldName = context.fieldId;
         if (fieldName === 'custpage_item') {
             try {
                 updateInventoryList(context, false);
             } catch (err) {
                 console.error(err.name, err.message);
             }
         }
         return true;
     }

     function updateInventoryList(context) {
         let slRecord = currentRecord.get();
         let itemId = slRecord.getValue({ fieldId: 'custpage_item' });
         // slRecord.setValue({fieldId:'custpage_item',value:itemId})
         //           return
         let suiteLetURL = url.resolveScript({
             scriptId: 'customscript_steal_send_to',
             deploymentId: 'customdeploy_steal_send_to',
             returnExternalUrl: false
         });

         // Call SuiteLet
         const response = https.post({
             url: suiteLetURL,
             body: {
                 "is_onchange": true,
                 "custpage_item": itemId,
             },
             headers: { 'content-type': 'application/json' },
         });

         let results = JSON.parse(response.body);
         console.log('results', results);

         // Remove all existing lines
         let existingLineCount = slRecord.getLineCount({ sublistId: 'custpage_steal_inventory_sublist' });
         console.log('Line Count: ' + existingLineCount);

         for (let i = existingLineCount; i >= 1; i--) {
             console.log('Removing Line: ' + i);
             slRecord.removeLine({
                 sublistId: 'custpage_steal_inventory_sublist',
                 line: i - 1,
                 ignoreRecalc: true
             });
         }

         // Get the POST results search data
         let resultLines = results['results'];

         // Check if resultLines is defined and is an array

         for (var x = 0; x < resultLines.length; x++) {
             try {
                 var line = resultLines[x];
                 if (Number(line.custpage_qty_committed) <= 0) {
                     slRecord.selectNewLine({ sublistId: 'custpage_steal_inventory_sublist' });
                     var lineKeys = Object.keys(line);
                     lineKeys.forEach(function (key) {
                         slRecord.setCurrentSublistValue({
                             sublistId: 'custpage_steal_inventory_sublist',
                             fieldId: key,
                             value: line[key]
                         });
                     })
                     slRecord.commitLine({ sublistId: 'custpage_steal_inventory_sublist' });
                 }
             } catch (e) {

             }

         }






         // if (Array.isArray(resultLines)) {
         //     resultLines.forEach((line, index) => {
         //         slRecord.selectNewLine({ sublistId: 'custpage_steal_inventory_sublist' });
         //         Object.keys(line).forEach(key => {
         //             slRecord.setCurrentSublistValue({
         //                 sublistId: 'custpage_steal_inventory_sublist',
         //                 fieldId: key,
         //                 value: line[key],
         //                 line: index
         //             });
         //                 slRecord.commitLine({ sublistId: 'custpage_steal_inventory_sublist' });
         //         });

         //     });
         // } else {
         //     console.error('No results found or results is not an array', resultLines);
         // }
     }


     return {
         pageInit: pageInit,
         fieldChanged: fieldChanged,
         updateInventoryList: updateInventoryList
     };
 });
