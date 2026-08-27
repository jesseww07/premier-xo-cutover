/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
 define(['N/format', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/util', 'N/file'],
 /**
  * @param {format} format
  * @param {log} log
  * @param {record} record
  * @param {runtime} runtime
  * @param {search} search
  * @param {task} task
  * @param {util} util
  * @param {file} file
  */
 function (format, log, record, runtime, search, task, util, file) {

     function getInputData() {
         var mySearch = search.load({
             id: 'customsearch938'
         })
         return mySearch
     }

     function map(context) {
         try {
             let result = JSON.parse(context.value);
             let docID = result.id
            // log.debug('docID',docID)
             
             var custRec = record.load({
                 type: 'customrecord_zastro_la_data_dump',
                 id: docID
             })
             var itemLinkage = custRec.getValue({ fieldId: 'custrecord_zastro_linked_item' })
             if (itemLinkage) {
                 return
             }
             else {
                 var itemText = custRec.getValue({ fieldId: 'custrecord_zas_unique_id' })
                 var returnId = getItemId(itemText)
                 if(returnId){
                     custRec.setValue({
                         fieldId: 'custrecord_zastro_linked_item',
                         value:returnId
                     })
                     custRec.save()
                 }
             }
         }
         catch (e) {
             log.error('COULD NOT COMPLETE MAPPING', e)
         }

     }

     const getItemId = (itemText) => {
         var returnId;
         var itemSearchObj = search.create({
             type: "item",
             filters:
                 [
                     ["custitem_la_unique_id", "is", itemText]
                 ],
             columns:
                 [
                     "internalid"
                 ]
         });
         var searchResultCount = itemSearchObj.runPaged().count;
         log.debug("itemSearchObj result count", searchResultCount);
         itemSearchObj.run().each(function (result) {
             // .run().each has a limit of 4,000 results
             var idRead = result.getValue({ name: 'internalid' })
             returnId = idRead
             return true;
         });
         return returnId
     }

     return {
         getInputData: getInputData,
         map: map,
         //reduce: reduce,
         //        summarize: summarize
     };

 });
