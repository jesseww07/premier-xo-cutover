/**
 * API Version 2.1
 * 
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      5/23/25       Alex Gjorvad                       Suitelet
 * 
 *          Script Functionality
 * 
 */
/**
*@NApiVersion 2.1
*@NScriptType Suitelet
*/
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/task', 'N/error', 'N/https', 'N/file', 'N/render', 'N/ui/dialog', 'N/redirect'],
    function (log, serverWidget, record, search, url, task, error, https, file, render, dialog, redirect) {
        function onRequest(context) {
            var poId = context.request.parameters.custpage_order_id;
            log.debug('po_id', poId);
            try {
                // const recObj = context.newRecord;
                // const poId = recObj.id;
                var recObj = record.load({
                    type: 'purchaseorder',
                    id: poId
                });
                const vendorId = recObj.getValue({ fieldId: 'entity' });
    
                log.debug('PO ID', poId);
                log.debug('Vendor ID from PO', vendorId);
    
                const returnData = getInboundFeedData(poId, vendorId);
                log.debug('returnData', returnData);
    
                if (!returnData.length) {
                    log.audit('No qualifying PO lines found.', 'Aborting inbound shipment creation.');
                    return;
                }
    
                // Step 1: Create and save Inbound Shipment with vendor only
                let inboundShipment = record.create({
                    type: 'inboundshipment',
                    isDynamic: true
                });
                inboundShipment.setValue({
                    fieldId: 'custrecord_mli_inbound_vendor',
                    value: vendorId
                });
                var externalDocNumber = returnData[0].doc;
                inboundShipment.setValue({
                    fieldId: 'externaldocumentnumber',
                    value: externalDocNumber
                });
    
                const inboundShipmentId = inboundShipment.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
    
                log.debug('Initial inboundShipmentId', inboundShipmentId);
    
                // Step 2: Reload the saved Inbound Shipment and add lines
                inboundShipment = record.load({
                    type: 'inboundshipment',
                    id: inboundShipmentId,
                    isDynamic: true
                });
    
                var redirectorRec = createRedirect(inboundShipmentId, externalDocNumber);
                inboundShipment.setValue({
                    fieldId: 'custrecord_mli_redirect_record',
                    value: redirectorRec
                })
                returnData.forEach(data => {
                    inboundShipment.selectNewLine({ sublistId: 'items' });
                    inboundShipment.setCurrentSublistValue({ sublistId: 'items', fieldId: 'purchaseorder', value: data.poid });
                    inboundShipment.setCurrentSublistValue({ sublistId: 'items', fieldId: 'shipmentitem', value: data.unique });
                    inboundShipment.commitLine({ sublistId: 'items' });
                });
    
                var savedInbound = inboundShipment.save({ enableSourcing: true, ignoreMandatoryFields: true });
    
                // Step 3: Create custom records for each line
                returnData.forEach(data => {
                    const customRecord = record.create({ type: 'customrecord_consolidated_special_order', isDynamic: true });
                    customRecord.setValue({ fieldId: 'custrecord_special_consolidated_po', value: poId });
                    customRecord.setValue({ fieldId: 'custrecord_special_consolidated_item', value: data.item });
                    customRecord.setValue({ fieldId: 'custrecord_special_consolidated_vendor', value: vendorId });
                    customRecord.setValue({ fieldId: 'custrecord_special_consolidated_qty', value: data.quantity });
                    customRecord.setValue({ fieldId: 'custrecord_consolidated_po_unique', value: data.unique });
                    customRecord.setValue({ fieldId: 'custrecord_inbound_shipment', value: inboundShipmentId });
                    customRecord.setValue({ fieldId: 'custrecord_consol_item_rate', value: data.rate });
                    customRecord.setValue({ fieldId: 'custrecord14', value: new Date() });
                    customRecord.save({ enableSourcing: true, ignoreMandatoryFields: true });
                });
                    var updatePO = setPOFields(recObj, redirectorRec);
                    log.debug('po_saved', updatePO);
                    // redirect.redirect({
                    //     url: `https://7513000-sb1.app.netsuite.com/app/accounting/transactions/shipping/inboundshipment/inboundshipment.nl?id=${inboundShipmentId}`
                    // });
                    redirect.toRecord({
                        type: record.Type.INBOUND_SHIPMENT,
                        id: savedInbound
                      });
            } catch (error) {
                log.error('Error in onAction', error.message);
            }
        }
    
    
        //     function onAction(context) {
        //         try {
        //             // Get the Work Order record
        //             var recObj = context.newRecord;
        //             log.debug('poId', recObj.id);
        //             log.debug('context', context);
        //             var poId = recObj.id
        //             var vendorId = recObj.getValue({ fieldId: 'entity' });
        //             log.debug('vendorId',vendorId)
    
    
        //             var returnData = getInboundFeedData(poId,vendorId);
        //             log.debug('returnData', returnData)
        //             const inboundShipment = record.create({ type: 'inboundshipment', isDynamic: true });
        //             log.debug('inboundShipment',inboundShipment)
        //           //this needs work vendor name
        //             inboundShipment.setValue({ fieldId: 'custrecord_zas_inbound_vendor', value: returnData[0].vendor })
        //             log.debug('set vendor',returnData[0].vendor)
        //            // inboundShipment.setValue({ fieldId: 'externaldocumentnumber', value: returnData[0].doc })
    
        // //ensure redirect record is made
    
        //             returnData.forEach(data => {
        //                 inboundShipment.selectNewLine({ sublistId: 'items' });
        //                 inboundShipment.setCurrentSublistValue('items', 'purchaseorder', data.poid);
        //                 inboundShipment.setCurrentSublistValue('items', 'shipmentitem', data.unique);
        //                 inboundShipment.commitLine({ sublistId: 'items' });
        //             });
        //             const inboundShipmentId = inboundShipment.save({ enableSourcing: true, ignoreMandatoryFields: true });
    
    
        //             if (inboundShipmentId) {
        //                 returnData.forEach(data => {
        //                     const customRecord = record.create({ type: 'customrecord_consolidated_special_order', isDynamic: true });
        //                     customRecord.setValue({ fieldId: 'custrecord_special_consolidated_po', value: poId });
        //                     customRecord.setValue({ fieldId: 'custrecord_special_consolidated_item', value: data.item });
        //                     customRecord.setValue({ fieldId: 'custrecord_special_consolidated_vendor', value: vendor });
        //                     customRecord.setValue({ fieldId: 'custrecord_special_consolidated_qty', value: data.quantity });
        //                     customRecord.setValue({ fieldId: 'custrecord_consolidated_po_unique', value: data.unique });
        //                     customRecord.setValue({ fieldId: 'custrecord_inbound_shipment', value: inboundShipmentId });
        //                     customRecord.setValue({ fieldId: 'custrecord_consol_item_rate', value: data.rate });
        //                     // customRecord.setValue({ fieldId: 'custrecord_pp_fulfill_amount', value: fulfillableAmount });
        //                     customRecord.setValue({ fieldId: 'custrecord14', value: new Date() });
        //                     //customRecord.setValue({ fieldId: 'custrecord_special_consolidated_ref', value: poRefNum });
        //                     customRecord.save({ enableSourcing: true, ignoreMandatoryFields: true });
        //                 });
        //             }
        //         } catch (error) {
        //             log.error('Error', 'Error setting inventory details: ' + error.message);
    
        //         }
        //     }
    
    
    
        const getInboundFeedData = (returnROPPO, vendor) => {
            log.debug('in getInboundFeedData - returnROPPO', returnROPPO)
            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters: [
                    ["type", "anyof", "PurchOrd"],
                    "AND", ["cogs", "is", "F"],
                    "AND", ["taxline", "is", "F"],
                    "AND", ["mainline", "is", "F"],
                    "AND", ["shipping", "is", "F"],
                    "AND", ["internalid", "anyof", returnROPPO],
                    "AND", ["itemtype", "startswith", "Inv"],
                    "AND", ["formulanumeric: CASE WHEN {quantity} > NVL({quantityshiprecv},0) THEN 1 ELSE 0 END", "greaterthan", "0"]
                ],
                columns: ["tranid", "lineuniquekey", "internalid", "entity", "item", "quantity", "rate"]
            });
    
            var returnArr = [];
            purchaseorderSearchObj.run().each(result => {
                returnArr.push({
                    unique: result.getValue('lineuniquekey'),
                    poid: result.getValue('internalid'),
                    vendor: vendor,
                    doc: result.getValue('tranid'),
                    item: result.getValue('item'),
                    quantity: result.getValue('quantity'),
                    rate: result.getValue('rate'),
                });
                return true;
            });
    
            return returnArr;
        };
    
        function createRedirect(inboundShipmentId, externalDocNumber) {
            var redirectRec = record.create({ type: 'customrecord_mli_inbound_redirector' })
            redirectRec.setValue({ fieldId: 'name', value: externalDocNumber })
            redirectRec.setValue({ fieldId: 'custrecord_mli_redirect_to', value: inboundShipmentId })
            redirectRec.setValue({ fieldId: 'custrecord_pre_standalone_po', value: true })
            var redirRecSave = redirectRec.save()
            return redirRecSave;
        }
    
        function setPOFields(purchaseOrder, redirectorRec) {
    // var purchaseOrder = record.load({
    //     type: 'purchaseorder',
    //     id: poId
    // });
    purchaseOrder.setValue({
        fieldId: 'custbody_pr_ipo_to_inbound',
        value: true
    });
    var lineCount = purchaseOrder.getLineCount({
        sublistId: 'item'
    });
    for (var i = 0; i < lineCount; i++) {
        var inboundLinkPresent = purchaseOrder.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_zas_inbound_link',
            line: i
        })
        if (!inboundLinkPresent || inboundLinkPresent == null || inboundLinkPresent == '') {
        purchaseOrder.setSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_zas_inbound_link',
            line: i,
            value: redirectorRec
        });
    }
}
    var poSaved = purchaseOrder.save();
    return poSaved;
        }

        return {
            onRequest: onRequest
        };
    });