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

         search.load({
             id: 'customsearch707'
             //id: 'customsearch426'
         }).run().each(function (result) {
             try {
                 log.debug(result)
                 var parentId = result.id
                 log.debug('parentId', parentId)
                 var returnStatus = getChildData(parentId)
                 if(returnStatus == true){
                     var id = record.submitFields({
                         type: 'customrecord_pr_quote_parent',
                         id: itemList,
                         values: {
                             'custrecord_pr_is_complete': true
                         }
                     });
                 }
             }
             catch (e) {
                 return true
             }

         })
     }

     const getChildData = (parentId) => {
         var returnStatus = true
         var customrecord_pr_quote_childSearchObj = search.create({
             type: "customrecord_pr_quote_child",
             filters:
             [
                ["custrecord_pl_parent","anyof",parentId]
             ],
             columns:
             [
                "internalid",
                "custrecord_pr_child_item",
                "custrecord_pr_child_item_text"
             ]
          });
          var searchResultCount = customrecord_pr_quote_childSearchObj.runPaged().count;
          log.debug("customrecord_pr_quote_childSearchObj result count",searchResultCount);
          customrecord_pr_quote_childSearchObj.run().each(function(result){
             // .run().each has a limit of 4,000 results
             var id = result.getValue({
                 name:'internalid'
             })
             var item = result.getValue({
                 name:'custrecord_pr_child_item'
             })
             var itemText = result.getValue({
                 name:'custrecord_pr_child_item_text'
             })
             log.debug('item',item)
             if(item == null || item == '' || !item){
                 returnStatus = fail
             }
             return true;
          });
         return returnStatus
     }


     return {
         execute: execute
     };

 });