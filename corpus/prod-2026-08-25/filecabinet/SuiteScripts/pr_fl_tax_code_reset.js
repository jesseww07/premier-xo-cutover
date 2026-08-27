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
         var taxCode = context.newRecord
         var taxCodeID = consolidatedPO.id
        var tCode = record.load({
            type:'salestaxitem',
            id:taxCodeID
        })
        var curr = tCode.getValue({fieldId:'taxagency'})
        log.debug('curr',curr)
        // tCode.setValue({fieldId:'taxagency',value:2415})
        // tCode.save()

     }

     return {
         onAction: onAction
     };

 });
