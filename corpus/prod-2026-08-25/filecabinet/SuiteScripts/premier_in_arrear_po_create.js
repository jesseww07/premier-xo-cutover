/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
 define(['N/log', 'N/record', 'N/search'],
 /**
  * @param {log} log
  * @param {record} record
  * @param {search} search
  */
 function (log, record, search) {
     function execute(context) {

         try {
             // Create a search for sales orders meeting specific criteria
             const salesOrderSearch = search.create({
                 type: "salesorder",
                 filters: [
                     ["type", "anyof", "SalesOrd"],
                     "AND",
                     ["mainline", "is", "F"],
                     "AND",
                     ["taxline", "is", "F"],
                     "AND",
                     ["shipping", "is", "F"],
                     "AND",
                     ["specialorder", "anyof", "@NONE@"],
                     "AND",
                     ["custcol_zastro_unconsolidated_item", "is", "T"],
                     "AND",
                     ["formulanumeric: CASE WHEN {quantity} > NVL({quantitypicked},0) THEN 1 ELSE 0 END", "greaterthan", "0"],
                     "AND",
                     ["closed", "is", "F"],
                     "AND",
                     ["status","anyof","SalesOrd:B","SalesOrd:D","SalesOrd:E"],
                          "AND",
                     // ["datecreated","onorafter","1/28/2025 12:00 am"],
                     // "AND", 
                     ["item.type","anyof","InvtPart"], 
       "AND", 
       ["custcol_cpo_block","is","F"], 
       "AND", 
       ["location","noneof","15","9"], 
       "AND", 
       ["formulanumeric: CASE WHEN {quantity} > NVL({quantityshiprecv},0) THEN 1 ELSE 0 END","greaterthan","0"], 
       "AND", 
       ["custcol_zastro_unconsolidated_no","anyof","@NONE@"]

  
                 ],
                 columns: [
                     search.createColumn({ name: "internalid", summary: "GROUP" }),
                     //search.createColumn({ name: "custcolcustcol_zastro_vendor", summary: "GROUP" }),
                               search.createColumn({ name: "location", summary: "GROUP" }),
                               search.createColumn({ name: "class", summary: "GROUP" }), // ADDED: Pulling the class from the SO header
                               search.createColumn({
                                name: "vendor",
                                join: "item",
                                summary: "GROUP"
                              })
                   
                 ]
             });

             const salesOrderCount = salesOrderSearch.runPaged().count;
             log.debug("Sales Order Search Count", salesOrderCount);
             
             // Process each sales order result
             salesOrderSearch.run().each(result => {
                 try {
                     const salesOrderId = result.getValue({ name: 'internalid', summary: search.Summary.GROUP });
                     const preferredVendor = result.getValue({ join: 'item', name: 'vendor', summary: search.Summary.GROUP });
                     //const preferredVendor = result.getValue({ name: 'custcolcustcol_zastro_vendor', summary: search.Summary.GROUP });
const useLocation = result.getValue({ name: 'location', summary: search.Summary.GROUP });
const soClass = result.getValue({ name: 'class', summary: search.Summary.GROUP }); // ADDED: Grabbing the class value

                   log.debug('salesOrderId',salesOrderId)
                   
                     if (!preferredVendor) {
                         log.debug("Skipped Sales Order", `Sales Order ID ${salesOrderId} has no preferred vendor.`);
                         return true; // Skip this iteration
                     }
                     var connectIt = false
                     var shipmentItem;
                     // Create a purchase order
                     const purchaseOrder = record.create({
                         type: record.Type.PURCHASE_ORDER,
                         isDynamic: true,
                         defaultValues: { entity: preferredVendor }
                     });
                     purchaseOrder.setValue({ fieldId: 'location', value: useLocation })
                     purchaseOrder.setValue({ fieldId: 'specord', value: true })
                     
                     // ADDED: Force "IPO" prefix if your Auto-Gen numbering allows overrides
                     // purchaseOrder.setValue({ fieldId: 'tranid', value: 'IPO' + salesOrderId });
                     
                     // ADDED: Setting the class on the PO Body
                     if (soClass) {
                         purchaseOrder.setValue({ fieldId: 'class', value: soClass });
                     }

 log.debug('HERE1',preferredVendor)
                     // Create a secondary search for related sales order lines
                     const salesOrderLineSearch = search.create({
                         type: "salesorder",
                         filters: [
                             ["shipping", "is", "F"],
                             "AND", ["cogs", "is", "F"],
                             "AND", ["taxline", "is", "F"],
                             "AND", ["mainline", "is", "F"],
                             "AND", ["quantity", "greaterthan", "0"],
                             "AND", ["specialorder", "anyof", "@NONE@"],
                             "AND", ["custcol_zastro_unconsolidated_item", "is", "T"],
                             "AND", ["internalid", "anyof", salesOrderId],
                             "AND", ["custcolcustcol_zastro_vendor", "anyof", preferredVendor],
                             "AND", ["custcol_cpo_block","is","F"], 
                         ],
                         columns: [
                             search.createColumn({ name: "item" }),
                             search.createColumn({ name: "line" }),
                             search.createColumn({ name: "quantity" }),
                             search.createColumn({ name: "custcol_pr_room_location" }),
                             search.createColumn({ name: "custcol_inboud_id_to_link" }),
                             search.createColumn({ name: "custcol_self_id" }),
                             search.createColumn({ name: "location" }),
                             search.createColumn({ name: "lineuniquekey" }),
                         ]
                     });

                     // Process each sales order line
                     salesOrderLineSearch.run().each(lineResult => {
                         try {
                             var inboundId = lineResult.getValue({ name: 'custcol_inboud_id_to_link' })

                             purchaseOrder.selectNewLine({ sublistId: 'item' });

                             purchaseOrder.setCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'item',
                                 value: lineResult.getValue({ name: 'item' })
                             });

                             purchaseOrder.setCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'quantity',
                                 value: lineResult.getValue({ name: 'quantity' })
                             });

                             if (inboundId) {
                                 connectIt = inboundId
                                 shipmentItem = lineResult.getValue({ name: 'item' })
                                 purchaseOrder.setCurrentSublistValue({
                                     sublistId: 'item',
                                     fieldId: 'custcol_inboud_id_to_link',
                                     value: lineResult.getValue({ name: 'custcol_inboud_id_to_link' })
                                 });
                             }
                             purchaseOrder.setCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'custcol_pr_room_location',
                                 value: lineResult.getValue({ name: 'custcol_pr_room_location' })
                             });

                             purchaseOrder.setCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'custcol_self_id',
                                 value: lineResult.getValue({ name: 'custcol_self_id' })
                             });
                             var createdFrom = salesOrderId
                             var line = lineResult.getValue({ name: 'line' })
                             var lineId = createdFrom + '_' + line
                             purchaseOrder.setCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'createdfrom',
                                 value: createdFrom
                             });
                             purchaseOrder.setCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'orderdoc',
                                 value: createdFrom
                             });
                             purchaseOrder.setCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'orderline',
                                 value: line
                             });
                             purchaseOrder.setCurrentSublistValue({
                                 sublistId: 'item',
                                 fieldId: 'id',
                                 value: lineId
                             });




                           //check UOM
                                
                                var uom = purchaseOrder.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'units'
                                });
                                var uomText = purchaseOrder.getCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'units_display'
                                });
                                log.audit('uom',uom)
                                log.audit('uomText',uomText)
                                if(Number(uom)==null || Number(uom)==1 || Number(uom)==''){
                                    log.audit('WE SHOULD BE GOOD',uom)
                                }
                                else{
                                    // ADDED: Cache the rate and amount before wiping the UOM to prevent empty amount errors
                                    var currentRate = purchaseOrder.getCurrentSublistValue({ sublistId: 'item', fieldId: 'rate' });
                                    var currentAmount = purchaseOrder.getCurrentSublistValue({ sublistId: 'item', fieldId: 'amount' });

                                    purchaseOrder.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'units',
                                        value:null
                                    });

                                    // ADDED: Restore the rate and amount
                                    if (currentRate) {
                                        purchaseOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: currentRate });
                                    }
                                    if (currentAmount) {
                                        purchaseOrder.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: currentAmount });
                                    }

                                    log.audit('Changing to One',uom)
                                }

                             purchaseOrder.commitLine({ sublistId: 'item' });

                             return true; // Continue to next line
                         } catch (lineError) {
                             log.error("Error Processing Line", lineError.message);
                             return true; // Skip this line but continue processing other lines
                         }
                     });

                     // Save the purchase order
                     try {

                         const purchaseOrderId = purchaseOrder.save();
                         log.debug("Purchase Order Created", `PO ID: ${purchaseOrderId}`);
                         if (connectIt) {
                             addReorderPointInbound(connectIt, purchaseOrderId, shipmentItem)
                         }
                     } catch (poSaveError) {
                         log.error("Error Saving Purchase Order", poSaveError.message);
                     }

                     return true; // Continue to next sales order
                 } catch (orderError) {
                     log.error("Error Processing Sales Order", orderError.message);
                     return true; // Skip this sales order but continue processing others
                 }
             });
         } catch (scriptError) {
             log.error("Script Execution Error", scriptError.message);
         }
     }
     const addReorderPointInbound = (inboundMade, returnROPPO, shipmentItem) => {
         var lineKey = findPurchaseKey(shipmentItem, inboundMade, returnROPPO)
         var inboundShipment = record.load({ type: record.Type.INBOUND_SHIPMENT, id: inboundMade, isDynamic: true })
         inboundShipment.selectNewLine({ sublistId: 'items' });
         inboundShipment.setCurrentSublistValue('items', 'purchaseorder', returnROPPO);
         inboundShipment.setCurrentSublistValue('items', 'shipmentitem', lineKey);
         inboundShipment.commitLine({ sublistId: 'items' });
         return inboundShipment.save();
     };
     const findPurchaseKey = (shipmentItem, inboundMade, returnROPPO) => {
         var returnVal;
         var transactionSearchObj = search.create({
             type: "transaction",
             filters:
                 [
                     ["internalidnumber", "equalto", returnROPPO],
                     "AND",
                     ["mainline", "is", "F"],
                     "AND",
                     ["taxline", "is", "F"],
                     "AND",
                     ["shipping", "is", "F"],
                     "AND",
                     ["item", "anyof", shipmentItem],
                     "AND",
                     ["custcol_inboud_id_to_link", "is", inboundMade]
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
         return returnVal
     }

     return {
         execute: execute
     };
 });