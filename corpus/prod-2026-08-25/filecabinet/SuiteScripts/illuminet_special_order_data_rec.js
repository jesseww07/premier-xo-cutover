/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/log', 'N/record', 'N/search', 'N/util'],
    (log, record, search, util) => {

        const getInputData = () => {
            const salesorderSearchObj = search.create({
                type: "salesorder",
                filters: [
                    ["type","anyof","SalesOrd"],
                    "AND",
                    ["mainline","is","F"],
                    "AND",
                    ["item.type","anyof","InvtPart"],
                    "AND",
                    ["custcol_special_connected","is","F"],
                    "AND",
                    ["custcol_zastro_unconsolidated_item","is","T"],
                    "AND",
                    ["specialorder", "noneof", "@NONE@"],
                    "AND",
                    ["status", "anyof", "SalesOrd:B", "SalesOrd:D", "SalesOrd:E"], // Open, Pending Fulfillment, or Partially Fulfilled Sales Orders
                    // "AND",
                    // ["datecreated","onorafter","1/13/2025 12:00 am"], 
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
                    "internalid", // Sales Order internal ID
                    "trandate", "tranid", // Transaction date and ID
                    "item", // Item ID
                    "quantity", // Quantity ordered
                    "specialorder", // Special order reference
                    "custcol_special_connected", // Custom column: special connected flag
                    "lineuniquekey", // Line unique key
                    "line", // Line number
                    "custcol_pr_room_location", // Room location custom field
                    "custcolcustcol_zastro_vendor", // Vendor custom field
                    "custcol_self_id", // Self-made ID custom field
                    "otherrefnum" // PO#
                ]
            });

            const results = [];
            salesorderSearchObj.run().each(result => {
                results.push({
                    id: result.id,
                    values: result.getAllValues()
                });
                return true;
            });

            log.audit('Search Results', JSON.stringify(results));
            return results;
        };





        const map = (context) => {
            log.audit('context', context)
            // Map stage: group sales order lines by sales order ID
            const payload = JSON.parse(context.value);
            const salesOrderID = payload.id;
            const result = payload.values
            log.debug('result', result)
            log.debug('salesOrderID', salesOrderID)

            // Output the sales order ID as the key and sales order line details as the value
            context.write({
                key: salesOrderID,
                value: {
                    soID: salesOrderID, // Sales order internal ID
                    specialOrder: result.specialorder, // Special order reference
                    uniqueKey: result.lineuniquekey, // Line unique key
                    room: result.custcol_pr_room_location, // Room location
                    item: result.item, // Item ID
                    vendor: result.custcolcustcol_zastro_vendor, // Vendor ID
                    qty: result.quantity, // Quantity ordered
                    selfMade: result.custcol_self_id, // Self-made ID
                    purchId: result.specialorder[0].value,
                    otherrefnum: result.otherrefnum
                }
            });
            log.debug('poID', result.specialorder.value)
        };

        const reduce = (context) => {
          
            const salesOrderID = context.key;
            log.debug('reduce context', context)
          
            const lineData = context.values.map(val => JSON.parse(val)); // Array of sales order line data

            let salesOrd;
            try {
                // Load sales order record only once per reduce group (per sales order)
                salesOrd = record.load({
                    type: 'salesorder',
                    id: salesOrderID,
                    isDynamic: true
                });
            } catch (e) {
                log.error(`Error loading sales order ID ${salesOrderID}`, e);
                return;
            }
            log.debug('salesOrd', salesOrd)
            // Process each line of the sales order
            lineData.forEach(lineObj => {
                const { specialOrder, uniqueKey, item, vendor, qty, selfMade, room, purchId, otherrefnum } = lineObj;
                log.debug('salesOrd: lineObj', lineObj)
                // Update purchase order details and retrieve updated key and rate
                const returnPOKey = updatePO(specialOrder, uniqueKey, item, selfMade, purchId);
                log.debug('salesOrd: returnPOKey', returnPOKey)
                if (returnPOKey) {
                    log.debug('salesOrd: vendor', vendor[0].value)
                    // Get the vendor's custom field for linked records
                    const vendorField = search.lookupFields({
                        type: 'vendor',
                        id: vendor[0].value,
                        columns: ['custentity_zas_order_items']
                    });
                    log.debug('salesOrd: vendorField', vendorField)
                    const linked = vendorField.custentity_zas_order_items;
                    log.audit('salesOrd: linked', linked)
                    let useId;
                    if (linked && linked.length > 0 && linked[0].value) {
                        useId = linked[0].value;
                    } else {
                        useId = createLinkedParent(vendor);
                        record.submitFields({
                            type: 'vendor',
                            id: vendor[0].value,
                            values: {
                                'custentity_zas_order_items': useId
                            }
                        });
                    }

                    // Create custom record based on line data
                    const returnRec = createCustomRecord(salesOrderID, specialOrder, uniqueKey, item, returnPOKey.key, vendor, useId, qty, returnPOKey.rate, room, otherrefnum);
                    log.debug('returnRec', returnRec)
                    if (returnRec) {
                        // Update the sales order line with the custom record reference and mark it as connected
                        try {
                            updateSalesOrderLine(salesOrd, selfMade, returnRec);
                        }
                        catch (e) {
                            log.error('e on update so line', e)
                        }



                    }
                }
            });

            try {
                // Save the sales order after processing all lines
                var soSave = salesOrd.save({ ignoreMandatoryFields: true })
                log.audit('soSave', soSave)
            } catch (e) {
                log.error(`Error saving sales order ID ${salesOrderID}`, e);
            }
        };

        const updatePO = (specialOrder, uniqueKey, checkItem, selfMade, purchId) => {
            let returnUnique = {};
          log.error('selfMade',selfMade)
            try {
                let purchOrd = record.load({ type: 'purchaseorder', id: purchId, isDynamic: true })
                // Locate the matching purchase order line based on self-made ID
                let identifier = purchOrd.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'custcol_self_id',
                    value: selfMade
                });
                log.debug('purchOrd: Line identifier', identifier)
                if (Number(identifier) >= 0) {
                    // Update purchase order line details and commit changes
                    purchOrd.selectLine({ sublistId: 'item', line: identifier });
                    purchOrd.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_zas_unique_key', value: uniqueKey });
                    returnUnique.key = purchOrd.getCurrentSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey' });
                    returnUnique.rate = purchOrd.getCurrentSublistValue({ sublistId: 'item', fieldId: 'rate' });
                    purchOrd.commitLine({ sublistId: 'item' });
                    purchOrd.save();
                }
                return returnUnique;
            } catch (e) {
                log.error('Error updating purchase order', e);
            }
        };

        const updateSalesOrderLine = (salesOrd, selfMade, returnRec) => {
            // Find the sales order line that matches the self-made ID
            let identifier = salesOrd.findSublistLineWithValue({
                sublistId: 'item',
                fieldId: 'custcol_self_id',
                value: selfMade
            });
            log.debug('Line identifier', identifier)
            if (Number(identifier) >= 0) {
                // Update the sales order line with the custom record reference and mark it as connected
                salesOrd.selectLine({ sublistId: 'item', line: identifier });

                salesOrd.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_zas_linked_so_rec',
                    value: returnRec
                });
                salesOrd.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_special_connected',
                    value: true
                });

                salesOrd.commitLine({ sublistId: 'item' });
                log.debug('Line COMMITTED', identifier)
            }
        };

        const createLinkedParent = (vendor) => {
            log.debug('entering create linked', vendor)
            // Create a linked parent record for the vendor
            try {
                const parLink = record.create({ type: 'customrecord_consolidated_vendor_select', isDynamic: true });
                parLink.setValue({ fieldId: 'custrecord_vendor_select_vendor', value: vendor[0].value });
                const suitLink = `https://7513000.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=2796&deploy=1&compid=7513000&ns-at=AAEJ7tMQJ6TkmxTRKXjNCSeU5ZgheaUAOZXJJNFgknVdNeFvaEY&custom_id=${vendor[0].value}`;
                parLink.setValue({ fieldId: 'custrecord_vendor_select_sl', value: suitLink });
                return parLink.save();
            } catch (e) {
                log.error('e in create linked', e)
            }
        };

        const createCustomRecord = (soID, specialOrder, uniqueKey, item, returnPOKey, vendor, parentId, qty, poRate, room, otherrefnum) => {
            try {
                // Create a custom record for the consolidated special order
                log.debug('entering created data rec')
                const custRec = record.create({
                    type: 'customrecord_consolidated_special_order',
                    isDynamic: true
                });

                custRec.setValue({ fieldId: 'custrecord_special_consolidated_qty', value: qty });
                custRec.setValue({ fieldId: 'custrecord_consolidated_po_unique', value: returnPOKey });
                custRec.setValue({ fieldId: 'custrecord_special_consolidated_vendor', value: vendor[0].value });
                custRec.setValue({ fieldId: 'custrecord_consol_item_rate', value: poRate });
                custRec.setValue({ fieldId: 'custrecord_special_consolidated_sl', value: parentId });
                custRec.setValue({ fieldId: 'custrecord_special_consolidated_so', value: soID });
                custRec.setValue({ fieldId: 'custrecord_special_consolidated_po', value: specialOrder[0].value });
                custRec.setValue({ fieldId: 'custrecord_special_consolidated_key', value: uniqueKey });
                custRec.setValue({ fieldId: 'custrecord_special_consolidated_item', value: item[0].value });
                custRec.setValue({ fieldId: 'custrecord_special_consolidated_room', value: room });
                custRec.setValue({ fieldId: 'custrecord_special_consolidated_ref', value: otherrefnum });

                return custRec.save();
            } catch (e) {
                log.error('Error creating custom record', e);
                return null;
            }
        };

        return {
            getInputData,
            map,
            reduce
        };
    });
