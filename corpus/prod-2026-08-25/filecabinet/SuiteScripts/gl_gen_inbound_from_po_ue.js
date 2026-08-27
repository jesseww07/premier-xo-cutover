/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
/**
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      5/22/25       Alex Gjorvad                        User Event
 * 
 *          Script Functionality
 * 
 */

define(["N/task", "N/ui/serverWidget", "N/search"], function (task, serverWidget, search) {
    function beforeLoad(context) {
        if (context.type == 'view') {
      log.debug('CALLED', 'I AM BEING CALLED');
      var purchaseOrder = context.newRecord;
      log.debug('purchase_order', purchaseOrder);
      var poId = purchaseOrder.id
      log.debug('po_id', poId);
      var lineCount = purchaseOrder.getLineCount({
        sublistId: 'item'
      });
      var poArray = [];
      for (var i = 0; i < lineCount; i++) {
        var lineUniqueKey = purchaseOrder.getSublistValue({
            sublistId: 'item',
            fieldId: 'lineuniquekey',
            line: i
        });
        poArray.push(lineUniqueKey);
      }
      var customrecord_consolidated_special_orderSearchObj = search.create({
        type: "customrecord_consolidated_special_order",
        filters:
        [
           ["custrecord_inbound_shipment","noneof","@NONE@"], 
           "AND", 
           stringFieldAnyOf('custrecord_consolidated_po_unique', poArray)
        ],
        columns:
        [
           search.createColumn({name: "internalid", label: "Internal ID"})
        ]
     });
     var searchResultCount = customrecord_consolidated_special_orderSearchObj.runPaged().count;
     log.debug("customrecord_consolidated_special_orderSearchObj result count",searchResultCount);
     if (searchResultCount != lineCount) {
      context.form.addButton({
        id: "custpage_create_so",
        label: "Transform to Inbound (new)",
        functionName: 'redirect'
      });
      // internal id of the client script on file cabinet
      context.form.clientScriptFileId = "69806";
    }
}
}
  
    function stringFieldAnyOf(fieldId, listOfValues) {
        var result = [];
        if (listOfValues.length > 0) {
            for (var i = 0; i < listOfValues.length; i++) {
                result.push([fieldId, 'is', listOfValues[i]]);
                result.push('or');
            }
            result.pop(); // remove the last 'or'
        }
        return result;
    }

    return {
      beforeLoad: beforeLoad,
    };
  });