/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
 define(['N/log', 'N/record', 'N/search', 'N/util'],
 /**
  * @param {log} log
  * @param {record} record
  * @param {search} search
  * @param {util} util
  */
 function (log, record, search, util) {

     /**
      * Definition of the Scheduled script trigger point.
      *
      * @param {Object} scriptContext
      * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
      * @Since 2015.2
      */
     function execute(context) {
         try {
             var returnArray = runSearch()
             log.debug('returnArray', returnArray)
             if (returnArray.length > 0) {
                 var foundItem;
                 for (var x = 0; x < returnArray.length; x++) {
                     var itemToCheck = returnArray[x].item
                     log.debug('itemToCheck', itemToCheck)
                     var docId = returnArray[x].id
                     log.debug('docId', docId)
                     var returnItem = checkItem(itemToCheck)
                     log.debug('returnItem', returnItem)
                     if (!returnItem) {
                         var returnCreated = createItem(itemToCheck)
                         foundItem = returnCreated
                     }
                     else{
                         foundItem = returnItem
                     }
                     var quoteItem = record.submitFields({
                         type: 'customrecord_pr_quote_child',
                         id: docId,
                         values: {
                             'custrecord_pr_child_item': foundItem
                         }
                     });
                 }
             }
         }
         catch (e) {
             log.debug('e', e)
         }
     }
     const runSearch = () => {
         var returnArray = new Array()
         var customrecord_pr_quote_parentSearchObj = search.create({
             type: "customrecord_pr_quote_child",
             filters:
                 [
                     ["custrecord_pr_child_item_text", "isnotempty", ""],
                     "AND",
                     ["custrecord_pr_child_item", "anyof", "@NONE@"]
                 ],
             columns:
                 [
                     "internalid",
                     "custrecord_pr_child_item_text"
                 ]
         });
         var searchResultCount = customrecord_pr_quote_parentSearchObj.runPaged().count;
         log.debug("customrecord_pr_quote_parentSearchObj result count", searchResultCount);
         customrecord_pr_quote_parentSearchObj.run().each(function (result) {
             var id = result.getValue({
                 name: 'internalid'
             })
             log.debug('id', id);
             var item = result.getValue({
                 name: 'custrecord_pr_child_item_text'
             })
             log.debug('item', item);

             var returnObj = new Object()
             log.debug('here')
             returnObj.id = id
             log.debug('here2')
             returnObj.item = item
             log.debug('here3')
             returnArray.push(returnObj)
             log.debug('here4')
             return true;
         });
         return returnArray
     }
     const checkItem = (itemToCheck) => {
         var returnId;
         var customerSearchObj = search.create({
             type: "item",
             filters:
                 [
                     ["itemid", "is", itemToCheck]
                 ],
             columns:
                 [
                     search.createColumn({
                         name: "itemid",
                         sort: search.Sort.ASC
                     }),
                     "internalid"
                 ]
         });
         var searchResultCount = customerSearchObj.runPaged().count;
         log.debug("customerSearchObj result count", searchResultCount);
         customerSearchObj.run().each(function (result) {
             var id = result.getValue({
                 name: "internalid"
             })
             returnId = id
             return true;
         });
         return returnId
     }
     const createItem = (itemToCheck) => {
         log.debug('in record create')
         var item = record.create({
             type: 'inventoryitem',
             isDynamic: true
         })
         item.setValue({
             fieldId: 'itemid',
             value: itemToCheck
         })
         item.setValue({
             fieldId: 'subsidiary',
             value: 2
         })
         var savedItem = item.save({
             ignoreMandatoryFields: true
           });
         return savedItem 
     }
     return {
         execute: execute
     };

 });