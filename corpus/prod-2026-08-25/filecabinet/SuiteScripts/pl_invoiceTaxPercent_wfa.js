/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
 define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime', 'N/render', 'N/email'],
 /**
  * @param {record} record
  * @param {search} search
  * @param {ui} ui
  * @param {dialog} dialog
  * @param {runtime} runtime
  */
 function (record, search, ui, dialog, runtime, render, email) {

     /**
      * Definition of the Suitelet script trigger point.
      *
      * @param {Object} scriptContext
      * @param {Record} scriptContext.newRecord - New record
      * @param {Record} scriptContext.oldRecord - Old record
      * @Since 2016.1
      */
     function onAction(context) {
         var invoice = context.newRecord
         var id = invoice.id
         log.debug(id)



         let tax = getTax(id)
         log.debug('tax rate',tax)


         var sup = record.submitFields({
            type: 'invoice',
            id: id,
            values: {
                custbody_pl_tax_percetage: tax[0]
            }
        })
        log.debug('sup', sup);

        //  var invoice = record.load({
        //     type: record.Type.INVOICE,
        //     id: id,
        // });
        // log.debug("invoice", invoice);
        //  //custbody_pl_tax_percetage

        //  invoice.setValue({
        //     fieldId: 'custbody_pl_tax_percetage',
        //     value: tax[0]
        // });
        // invoice.save({ignoreMandatoryFields: true })

     }

     const getTax = (id) => {
         let array = []
        var invoiceSearchObj = search.create({
            type: "invoice",
            filters:
            [
               ["internalidnumber","equalto",id], 
               "AND", 
               ["mainline","is","T"], 
               "AND", 
               ["type","anyof","CustInvc"]
            ],
            columns:
            [
               "taxtotal",
               "netamountnotax",
               search.createColumn({
                  name: "formulapercent",
                  formula: "ROUND({taxtotal}/{netamountnotax},5)"
               }),
            ]
         });
         var searchResultCount = invoiceSearchObj.runPaged().count;
         log.debug("invoiceSearchObj result count",searchResultCount);
         invoiceSearchObj.run().each(function(result){
            let tax = result.getValue({
                name: "formulapercent",
                formula: "ROUND({taxtotal}/{netamountnotax},5)"
             })
             array.push(tax)
            return true;
         });
        return array
     }

    

     return {
         onAction: onAction
     };

 });