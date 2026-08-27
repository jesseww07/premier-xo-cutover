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
      * @param {Object} context
      * @param {Record} context.newRecord - New record
      * @param {Record} context.oldRecord - Old record
      * @Since 2016.1
      */
     function onAction(context) {
         try {
             var itemArray = new Array()
             var custRec = context.newRecord
             var id = custRec.id
             log.debug(id)

             var salesOrderID = custRec.getValue({ fieldId: 'custrecord_cat_rec_send_to_so' })
             var fromObj = new Object()
             fromObj.key = custRec.getValue({ fieldId: 'custrecord_steal_from_key' })
             fromObj.qty = custRec.getValue({ fieldId: 'custrecord_cat_qty_to_steal' })
                  log.audit('fromObj',fromObj)
            
                                 var returnChangesFrom = editSalesOrder(salesOrderID, fromObj, 'from')

             var sendSOID = custRec.getValue({ fieldId: 'custrecordcat_rec_so' })
             var toObj = new Object()
             toObj.key = custRec.getValue({ fieldId: 'custrecord_mli_steal_linekey' })
             toObj.qty = custRec.getValue({ fieldId: 'custrecord_cat_qty_to_steal' })
             log.audit('toObj',toObj)
          
                                 var returnChangesTo = editSalesOrder(sendSOID, toObj, 'to')
              log.audit('returnChangesFrom',returnChangesFrom)
             log.audit('returnChangesTo',returnChangesTo)
              log.audit('fromObj',fromObj)
             log.audit('toObj',toObj)

            //  returnChangesFrom = 99999
            //  returnChangesTo = 99999
             if (returnChangesFrom && returnChangesTo) {
                 var alterItem = custRec.getValue({ fieldId: 'custrecord_cat_rec_item' })
                 var alterQty = custRec.getValue({ fieldId: 'custrecord_cat_qty_to_steal' })
                                    var reopened = openCommitAgain(salesOrderID, alterItem, toObj.key)

                 //To Record - Needs Sticker | Has A Source
                
                 
                 
                 
                 
                 




                 //we just need to find the consolidated recs and split them
                  var resTo = alterCustomRecords(returnChangesTo, returnChangesFrom, sendSOID)











                 
                 
                 //var killedPO = dropQtyOnToPurch(toObj.key, alterQty, alterItem)

                 //From Record - Had a Sticker | Needs a Source
                 //var keyToSwap = toObj.key
                 //var replacementPO = genReplacementPO(alterItem,alterQty,keyToSwap) NOT NEEDED ANYMORE DOING

                          

             }
         }
         catch (e) {
             log.debug('failure in eaches', e)
         }
     }
     const dropQtyOnToPurch = (key, qty, item) => {
         log.audit('item in dropQtyO', item)
         var returnObj = new Object();
         var customrecord_consolidated_special_orderSearchObj = search.create({
             type: "customrecord_consolidated_special_order",
             filters:
                 [
                     ["custrecord_special_consolidated_key", "is", key],
                     "AND",
                     ["custrecord_special_consolidated_item", "anyof", item]
                 ],
             columns:
                 [
                     "custrecord_special_consolidated_po",
                     "custrecord_consolidated_po_unique"
                 ]
         });
         var searchResultCount = customrecord_consolidated_special_orderSearchObj.runPaged().count;
         log.debug("customrecord_consolidated_special_orderSearchObj result count", searchResultCount);
         customrecord_consolidated_special_orderSearchObj.run().each(function (result) {
             // .run().each has a limit of 4,000 results
             returnObj.po = result.getValue({ name: 'custrecord_special_consolidated_po' })
             returnObj.key = result.getValue({ name: 'custrecord_consolidated_po_unique' })
             return true;
         });
         if (returnObj.po) {
             var inboundMade = getInbound(item, key)
             if (inboundMade) {
                 var editedInbound = alterInboundLine(inboundMade, item, key, qty, returnObj.po)
             }

             var purchOrd = record.load({ type: 'purchaseorder', id: returnObj.po, isDynamic: true })
             var lineNumber = purchOrd.findSublistLineWithValue({
                 sublistId: 'item',
                 fieldId: 'lineuniquekey',
                 value: returnObj.key
             });
             log.debug('lineNumber', lineNumber)
             if (Number(lineNumber) > -1) {
                 purchOrd.selectLine({
                     sublistId: 'item',
                     line: lineNumber
                 })
                 var currQty = purchOrd.getCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'quantity'
                 });
                 var newQty = Number(currQty) - Number(qty)
                 purchOrd.setCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'quantity',
                     value: newQty
                 });
                 purchOrd.commitLine({
                     sublistId: 'item'
                 })
                 purchOrd.save()
             }
         }
     }
     const alterInboundLine = (inboundMade, findItem, key, qty, po) => {
         try{
             const inboundShipment = record.load({ type: record.Type.INBOUND_SHIPMENT, id: inboundMade, isDynamic: true })

             const sublistId = 'items'; 
             const lineCount = inboundShipment.getLineCount({ sublistId });
             log.debug('lineCount',lineCount)
             // Iterate through each line on the sublist
             log.audit('FIND inboundMade',inboundMade)
             log.audit('FIND findItem',findItem)
             log.audit('FIND po',po)
             for (let i = 0; i < lineCount; i++) {
                 const currentItem = inboundShipment.getSublistValue({
                     sublistId: sublistId,
                     fieldId: 'itemid', // Replace with the field ID for the item
                     line: i
                 });
     
                 const currentPurchaseOrder = inboundShipment.getSublistValue({
                     sublistId: sublistId,
                     fieldId: 'purchaseorder', // Replace with the field ID for the purchase order
                     line: i
                 });
     
                 // Compare item and purchase order
                 log.debug('currentItem',currentItem)
                 log.debug('currentPurchaseOrder',currentPurchaseOrder)
                 if (currentItem == findItem && currentPurchaseOrder == po) {
                     log.debug('HITTTTT',i)
                     inboundShipment.selectLine({ sublistId: 'items', line: i });
                     var currQty = inboundShipment.getCurrentSublistValue('items', 'quantityexpected');
                     var newQty = Number(currQty)-Number(qty)
                     if(Number(newQty)>0){
                         inboundShipment.setCurrentSublistValue('items', 'quantityexpected', newQty);
                         inboundShipment.commitLine({ sublistId: 'items' });
                     }
                     else{
                         inboundShipment.removeLine({
                             sublistId: 'items',
                             line: i,
                             ignoreRecalc: true
                         });
                     }
                 
                 }
             }
             return inboundShipment.save();
         }
         catch(e){
             log.error('e on alter inbo',e)
         }
     }
     const genReplacementPO = (repItem, repQty, keyToSwap) => {
         var useVendor = getItemVendor(repItem)
         var inboundMade = getInbound(repItem, keyToSwap)
         log.audit('useVendor', useVendor)
         log.audit('inboundMade', inboundMade)
         if (useVendor && inboundMade) {
             // var returnROPPO = createReOrderPO(useVendor,repItem,repQty);
             // log.debug('returnROPPO',returnROPPO)
             // var returnInbound = addReorderPointInbound(inboundMade, returnROPPO);
             // log.debug('returnInbound',returnInbound)
             // var returnRec = createDataRecords(extraArr, returnROPPO, returnInbound);
             // log.debug('returnRec',returnRec)
         }

     }
     const getInbound = (repItem, keyToSwap) => {
         var returnVal;
         var customrecord_consolidated_special_orderSearchObj = search.create({
             type: "customrecord_consolidated_special_order",
             filters:
                 [
                     ["custrecord_special_consolidated_key", "is", keyToSwap],
                     "AND",
                     ["custrecord_special_consolidated_item", "anyof", repItem]
                 ],
             columns:
                 [
                     "custrecord_inbound_shipment"
                 ]
         });
         var searchResultCount = customrecord_consolidated_special_orderSearchObj.runPaged().count;
         log.debug("customrecord_consolidated_special_orderSearchObj result count", searchResultCount);
         customrecord_consolidated_special_orderSearchObj.run().each(function (result) {
             // .run().each has a limit of 4,000 results
             var res = result.getValue({ name: 'custrecord_inbound_shipment' })
             returnVal = res
             return true;
         });
         return returnVal
     }
     const createDataRecords = (custArray, returnROPPO, returnInbound) => {
         if (custArray) {
             custArray.forEach(obj => {
                 var specialReq = record.create({ type: 'customrecord_consolidated_special_order' });
                 specialReq.setValue('custrecord_special_consolidated_po', returnROPPO);
                 specialReq.setValue('custrecord_special_consolidated_item', obj.itemId);
                 specialReq.setValue('custrecord_special_consolidated_vendor', obj.venId);
                 specialReq.setValue('custrecord_special_consolidated_qty', obj.itemQty);
                 specialReq.setValue('custrecord_inbound_shipment', returnInbound);
                 specialReq.setValue('custrecord_consol_item_rate', obj.itemCost);
                 specialReq.save();
                 log.debug('specialReq', specialReq)
             });
         }
     };
     const getItemVendor = (repItem) => {
         var returnVal;
         var itemSearchObj = search.create({
             type: "item",
             filters:
                 [
                     ["internalid", "anyof", repItem]
                 ],
             columns:
                 [
                     "vendor"
                 ]
         });
         var searchResultCount = itemSearchObj.runPaged().count;
         log.debug("itemSearchObj result count", searchResultCount);
         itemSearchObj.run().each(function (result) {
             // .run().each has a limit of 4,000 results
             var res = result.getValue({ name: 'vendor' })
             returnVal = res
             return true;
         });
         return returnVal
     }
     const createReOrderPO = (useVendor, itemId, itemQty) => {
         try {
             var purchOrd = record.create({ type: 'purchaseorder', isDynamic: true });
             purchOrd.setValue('entity', useVendor);

             purchOrd.setValue('location', 6);
             ropArr.forEach(obj => {
                 purchOrd.selectNewLine('item');
                 purchOrd.setCurrentSublistValue('item', 'item', itemId);
                 purchOrd.setCurrentSublistValue('item', 'quantity', itemQty);
                 purchOrd.commitLine('item');
             });

             return purchOrd.save();
         } catch (e) {
             log.error('createReOrderPO', e);
         }
     };
     const addReorderPointInbound = (inboundMade, returnROPPO, item) => {
         var inboundShipment = record.load({ type: record.Type.INBOUND_SHIPMENT, id: inboundMade, isDynamic: true })
         inboundShipment.selectNewLine({ sublistId: 'items' });
         inboundShipment.setCurrentSublistValue('items', 'purchaseorder', returnROPPO);
         inboundShipment.setCurrentSublistValue('items', 'shipmentitem', data.unique);
         inboundShipment.commitLine({ sublistId: 'items' });
         return inboundShipment.save();
     };
     const openCommitAgain = (salesOrderID, alterItem, alterKey) => {
         var returnVal;
         var transactionSearchObj = search.create({
             type: "transaction",
             filters:
                 [
                     ["internalidnumber", "equalto", salesOrderID],
                     "AND",
                     ["mainline", "is", "F"],
                     "AND",
                     ["taxline", "is", "F"],
                     "AND",
                     ["shipping", "is", "F"],
                     "AND",
                     ["commit", "anyof", "3"],
                     "AND",
                     ["item", "anyof", alterItem]
                 ],
             columns:
                 [
                     "lineuniquekey"
                 ]
         });
         var searchResultCount = transactionSearchObj.runPaged().count;
         log.debug("transactionSearchObj result count", searchResultCount);
         transactionSearchObj.run().each(function (result) {
             // .run().each has a limit of 4,000 results
             var res = result.getValue({ name: 'lineuniquekey' })
             returnVal = res
             return true;
         });
         if (returnVal) {
             var inboundMade = getInbound(alterItem, alterKey)
             var salesOrd = record.load({ type: 'salesorder', id: salesOrderID, isDynamic: true })
             var lineNumber = salesOrd.findSublistLineWithValue({
                 sublistId: 'item',
                 fieldId: 'lineuniquekey',
                 value: returnVal
             });
             log.debug('lineNumber in reopen qtys', lineNumber)
             if (Number(lineNumber) > -1) {
                 salesOrd.selectLine({
                     sublistId: 'item',
                     line: lineNumber
                 })
                 salesOrd.setCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'commitinventory',
                     value: 1
                 });
                 salesOrd.setCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'custcol_zastro_unconsolidated_item',
                     value: true
                 });
                 salesOrd.setCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'custcol_inboud_id_to_link',
                     value: inboundMade
                 });
                 salesOrd.commitLine({
                     sublistId: 'item'
                 })
                 try {
                     salesOrd.save()
                 }
                 catch (e) {
                     log.error('on save so on edits')
                 }

             }
         }
         return returnVal
     }
     const alterCustomRecords = (returnChanges, returnChangesFrom, salesOrderID) => {
        try {
          // 1. Load the original consolidated-special-order record
          const origRec = record.load({
            type: 'customrecord_consolidated_special_order',
            id: returnChanges.custRec
          });
      
          // 2. Compute drop vs. remaining quantities
          const currQty   = parseFloat(origRec.getValue({ fieldId: 'custrecord_special_consolidated_qty' })) || 0;
          const dropQty   = parseFloat(returnChanges.addedQty) || 0;
          const copyQty   = parseFloat(returnChangesFrom.leftQty) || 0;
      
          // 3. Update original to the dropped quantity
          origRec.setValue({
            fieldId: 'custrecord_special_consolidated_qty',
            value: dropQty
          });
          origRec.save();
      
          // 4. Clone the record for the remainder
          const cloneRec = record.copy({
            type: 'customrecord_consolidated_special_order',
            id:   returnChangesFrom.custRec
          });
      
          // 5. Swap in the remaining quantity
          cloneRec.setValue({
            fieldId: 'custrecord_special_consolidated_qty',
            value: copyQty
          });
      
          // 6. Re-link any other fields (adjust these fieldIds as needed)
          cloneRec.setValue({
            fieldId: 'custrecord_linked_sales_order',
            value:   salesOrderID
          });    
          cloneRec.setValue({
            fieldId: 'custrecord_special_consolidated_key',
            value:   null
          });   
          cloneRec.setValue({
            fieldId: 'custrecord_consolidated_po_unique',
            value:   null
          });      
          // 7. Save the new record and return its internal ID
          const newRecId = cloneRec.save();
          return newRecId;
      
        } catch (e) {
          log.error({
            title:   'alterCustomRecords failed',
            details: e
          });
        }
      };
     const editSalesOrder = (salesOrderID, obj, type) => {
         try {
             var returnObj = new Object()
             var salesOrd = record.load({ type: 'salesorder', id: salesOrderID, isDynamic: true })
             var numLines = salesOrd.getLineCount({
                 sublistId: 'item'
             });
             var lineNumber = salesOrd.findSublistLineWithValue({
                 sublistId: 'item',
                 fieldId: 'lineuniquekey',
                 value: obj.key
             });
             log.debug('lineNumber', lineNumber)
             if (Number(lineNumber) > -1) {
                 salesOrd.selectLine({
                     sublistId: 'item',
                     line: lineNumber
                 })
                 var item = salesOrd.getCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'item'
                 });
                 var qty = salesOrd.getCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'quantity'
                 });
                 var priceLevel = salesOrd.getCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'price'
                 });
                 var rate = salesOrd.getCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'rate'
                 });
                 var custRec = salesOrd.getCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'custcol_zas_linked_so_rec'
                 });
                var roomLoc = salesOrd.getCurrentSublistValue({
                     sublistId: 'item',
                     fieldId: 'custcol_pr_room_location'
                 });

                 var newQty = Number(qty) - Number(obj.qty)
                 var newLineQty = Number(obj.qty)

                 returnObj.item = item
                 returnObj.leftQty = newQty
                 returnObj.addedQty = newLineQty
                 returnObj.custRec = custRec
                 returnObj.roomLoc = roomLoc






                 if (Number(newQty) <= 0) {
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'custcol_zastro_unconsolidated_item',
                         value: false
                     })
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'quantity',
                         value: 0
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'createpo',
                         value: null
                     });
                     if (type == 'from') {
                         // salesOrd.setCurrentSublistValue({
                         //     sublistId: 'item',
                         //     fieldId: 'commitinventory',
                         //     value: 3
                         // });
                         salesOrd.setCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'custcol_zastro_steal_memo',
                             value: 'Inventory Stolen By xxx For xxx Record Link xxxx'
                         });
                     }
                     else {
                         salesOrd.setCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'custcol_zastro_steal_memo',
                             value: 'Inventory Stolen By xxx For xxx Record Link xxxx'
                         });
                     }

                     salesOrd.commitLine({
                         sublistId: 'item'
                     });
                     salesOrd.insertLine({
                         sublistId: 'item',
                         line: lineNumber,
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'item',
                         value: item
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'custcol_zastro_unconsolidated_item',
                         value: false
                     })
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'quantity',
                         value: qty
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'price',
                         value: priceLevel
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'rate',
                         value: rate
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'custcol_pr_room_location',
                         value: roomLoc
                     });

                   
                     if (type == 'from') {
                         salesOrd.setCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'commitinventory',
                             value: 3
                         });
                         salesOrd.setCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'custcol_zastro_steal_memo',
                             value: 'Inventory Stolen By xxx For xxx Record Link xxxx'
                         });
                     }
                     else {
                         salesOrd.setCurrentSublistValue({
                             sublistId: 'item',
                             fieldId: 'custcol_zastro_steal_memo',
                             value: 'Inventory Stolen By xxx For xxx Record Link xxxx'
                         });
                     }
                     salesOrd.commitLine({
                         sublistId: 'item'
                     });
                 }
                 else {
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'quantity',
                         value: 0
                     })
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'price',
                         value: priceLevel
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'rate',
                         value: rate
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'custcol_zastro_unconsolidated_item',
                         value: false
                     })
                     salesOrd.commitLine({
                         sublistId: 'item'
                     })
                     salesOrd.insertLine({
                         sublistId: 'item',
                         line: lineNumber,
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'item',
                         value: item
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'custcol_zastro_unconsolidated_item',
                         value: false
                     })
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'quantity',
                         value: qty
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'price',
                         value: priceLevel
                     });
                     salesOrd.setCurrentSublistValue({
                         sublistId: 'item',
                         fieldId: 'rate',
                         value: rate
                     });
                     salesOrd.commitLine({
                         sublistId: 'item'
                     });
                 }
             }
             salesOrd.save()
             return returnObj
         }
         catch (e) {
             log.error('e on save ${type}', e)
         }
     }
     return {
         onAction: onAction

     }
 })

