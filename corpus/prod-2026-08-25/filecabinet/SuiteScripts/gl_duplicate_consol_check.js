/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
 define(['N/log', 'N/record', 'N/search', 'N/util', 'N/file', 'N/email', 'N/sftp'],
 /**
  * @param {log} log
  * @param {record} record
  * @param {search} search
  * @param {util} util
  * @param {file} file
  * @param {email} email
  * @param {sftp} sftp
  */
 function (log, record, search, util, file, email, sftp) {
 
     /**
      * Definition of the Scheduled script trigger point.
      *
      * @param {Object} scriptContext
      * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
      * @Since 2015.2
      */
 
     function execute(context) {
         try{
         let orderArray = orderSearch()
         log.debug('orderArray', orderArray)
         
         if (orderArray.length >0){
             for (let x=0;x<orderArray.length;x++){
             let marked = markRecs(orderArray[x])
         }
     }
 }
 catch(e){
     log.error('error in execute',e)
 }
     }
 
     const markRecs = (id) =>{
         try{
         record.submitFields({
             type: 'customrecord_consolidated_special_order',
             id: id,
             values: {
                 custrecord_special_consolidated_linked: true,
               isinactive: true
             }
         })
     }
     catch(e){
         log.error('error in markrecs',e)
     }
     }
 
     const orderSearch = () => {
         try{
         let array = []
         var customrecord_consolidated_special_orderSearchObj = search.create({
             type: "customrecord_consolidated_special_order",
             filters:
             [
                ["custrecord_special_consolidated_linked","is","F"], 
                "AND", 
                ["custrecord_consolidated_po_unique","isnotempty",""], 
                "AND", 
                ["count(internalid)","greaterthan","1"]
             ],
             columns:
             [
                search.createColumn({
                   name: "custrecord_consolidated_po_unique",
                   summary: "GROUP"
                }),
                search.createColumn({
                   name: "internalid",
                   summary: "COUNT"
                }),
                search.createColumn({
                   name: "internalid",
                   summary: "MIN"
                })
             ]
          });
          var searchResultCount = customrecord_consolidated_special_orderSearchObj.runPaged().count;
          log.debug("customrecord_consolidated_special_orderSearchObj result count",searchResultCount);
          customrecord_consolidated_special_orderSearchObj.run().each(function(result){
             
             let int = result.getValue({
                 name: "internalid",
                 summary: "MIN"
              })
              log.debug('internal id to mark',int)
             array.push(int)
             return true;
          });
          
         return array
         }
         catch(e){
             log.error('error in order search',e)
         }
     }
    
 
 
     return {
         execute: execute
     };
 
 });