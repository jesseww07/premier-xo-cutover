/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/runtime', 'N/log', 'N/search'], function (record, runtime, log, search) {

    function getInputData(context) {
        const script = runtime.getCurrentScript();
        const updatesJson = script.getParameter({ name: 'custscript_mr_inbound_updates' });
        const inboundId   = script.getParameter({ name: 'custscript_mr_inbound_id' });

        if (!updatesJson || !inboundId) {
            log.error('Missing Params', 'No updates or inbound ID found.');
            return {};
        }

        let updates = JSON.parse(updatesJson);

        // Group everything by Inbound Shipment ID to force single-thread processing
        let data = {};
        data[inboundId] = updates;
        return data;
    }

    function reduce(context) {
        const inboundId = context.key;
        const updates = JSON.parse(context.values[0]); 

        log.audit('Processing Updates', `Inbound Shipment: ${inboundId} - Lines: ${updates.length}`);

        try {
            // ─── 1. UPDATE INBOUND SHIPMENT ONCE ─────────────────────────────────────
            let inbRecord = record.load({ type: 'inboundShipment', id: inboundId, isDynamic: false });
            let hasInboundChanges = false;

            updates.forEach(upd => {
                let matchedLine = inbRecord.findSublistLineWithValue({
                    sublistId: 'items',
                    fieldId: 'shipmentitem',
                    value: upd.poLineKey
                });

                if (matchedLine !== -1) {
                    inbRecord.setSublistValue({ sublistId: 'items', fieldId: 'expectedrate', line: matchedLine, value: parseFloat(upd.updatedRate) });
                    
                    // Also update the total line amount
                    let quantity = inbRecord.getSublistValue({ sublistId: 'items', fieldId: 'quantityexpected', line: matchedLine }) || 0;
                    inbRecord.setSublistValue({ sublistId: 'items', fieldId: 'shipmentitemamount', line: matchedLine, value: parseFloat(quantity) * parseFloat(upd.updatedRate) });
                    
                    hasInboundChanges = true;
                }
            });

            if (hasInboundChanges) {
                inbRecord.save({ enableSourcing: true, ignoreMandatoryFields: true });
                log.audit('Inbound Shipment Saved', `ID: ${inboundId}`);
            }

            // ─── 2. LOOKUP PO IDs FOR CSOs ───────────────────────────────────────────
            let csoIds = updates.map(u => u.csoId);
            let poMap = {}; // Maps CSO ID to PO Internal ID

            if (csoIds.length > 0) {
                search.create({
                    type: 'customrecord_consolidated_special_order',
                    filters: [['internalid', 'anyof', csoIds]],
                    columns: ['custrecord_special_consolidated_po']
                }).run().each(result => {
                    poMap[result.id] = result.getValue('custrecord_special_consolidated_po');
                    return true;
                });
            }

            // Group updates by PO to prevent collisions
            let updatesByPo = {};
            updates.forEach(upd => {
                let poId = poMap[upd.csoId];
                if (poId) {
                    if (!updatesByPo[poId]) updatesByPo[poId] = [];
                    updatesByPo[poId].push(upd);
                }
            });

            // ─── 3. UPDATE PURCHASE ORDERS (1 Load/Save per PO) ──────────────────────
            for (let poId in updatesByPo) {
                try {
                    let poRecord = record.load({ type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: false });
                    let poUpdates = updatesByPo[poId];
                    let poChanged = false;

                    let lineCount = poRecord.getLineCount({ sublistId: 'item' });
                    
                    poUpdates.forEach(upd => {
                        for (let i = 0; i < lineCount; i++) {
                            let lineKey = poRecord.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
                            if (lineKey === upd.poLineKey) {
                                poRecord.setSublistValue({ sublistId: 'item', fieldId: 'rate', line: i, value: parseFloat(upd.updatedRate) });
                                poChanged = true;
                                break;
                            }
                        }
                    });

                    if (poChanged) {
                        poRecord.save({ enableSourcing: true, ignoreMandatoryFields: true });
                        log.audit('PO Saved', `ID: ${poId} - Updated ${poUpdates.length} lines`);
                    }
                } catch (e) {
                    log.error('PO Update Failed', `PO ID: ${poId} | Error: ${e.message}`);
                }
            }

            // ─── 4. UPDATE CSO RECORDS ───────────────────────────────────────────────
            updates.forEach(upd => {
                record.submitFields({
                    type: 'customrecord_consolidated_special_order',
                    id: upd.csoId,
                    values: {
                        custrecord_consol_item_rate: upd.updatedRate,
                        custrecord_mli_consol_adjust_price: false // Keep false so no stray scripts fire
                    },
                    options: { enableSourcing: false, ignoreMandatoryFields: true }
                });
            });

            log.audit('CSO Records Updated', `Count: ${updates.length}`);

        } catch (e) {
            log.error('Reduce Processing Error', e.message);
        }
    }

    function summarize(context) {
        context.reduceSummary.errors.iterator().each(function (key, error) {
            log.error('Map/Reduce Error', `Key: ${key} — ${error}`);
            return true;
        });
        log.audit('Process Complete', 'Bulk updates finished successfully.');
    }

    return { getInputData, reduce, summarize };
});