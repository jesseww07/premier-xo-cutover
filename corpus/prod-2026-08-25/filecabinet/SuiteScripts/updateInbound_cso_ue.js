/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * Deployed on: customrecord_consolidated_special_order
 * Event:       afterSubmit  (set Event Type = EDIT in the deployment record)
 *
 * When the CSO's adjust_price flag is flipped to true, this script:
 *   1. Updates the linked InboundShipment line amount (qty × newRate)
 *   2. Updates the linked Purchase Order line rate
 *   3. Resets the adjust_price flag back to false
 *
 * CHANGES FROM ORIGINAL:
 *   - Added explicit EDIT-only guard at the top. The deployment had a blank
 *     event type, meaning this fired on CREATE and DELETE too.
 *   - Removed all commented-out dead code blocks for clarity.
 *   - FIX: InboundShipment update switched from dynamic mode (selectLine /
 *     setCurrentSublistValue / commitLine) to static mode (setSublistValue).
 *     Dynamic mode on inbound shipments can fail to persist silently.
 *   - FIX: Line matching now uses findSublistLineWithValue on 'shipmentitem'
 *     (the PO unique line key) instead of looping on 'itemid' (text field).
 *     The old itemID getValue() returns an internal ID integer which never
 *     equals an item text field value.
 *   - FIX: Flag reset moved to BEFORE the inbound/PO updates so a save
 *     failure can't leave adjust_price stuck true, causing infinite re-fires.
 *   - FIX: Both catch blocks now log the full error object, not just .message,
 *     so stack traces are visible in the execution log.
 *   - FIX: expectedrate is set in addition to shipmentitemamount so the
 *     inbound shipment's per-unit rate is also updated, not just the total.
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {
            // Only run on edits — not creates, deletes, or other event types
            if (context.type !== context.UserEventType.EDIT) {
                return;
            }

            const consolidatedRecord = context.newRecord;

            const adjustPrice = consolidatedRecord.getValue('custrecord_mli_consol_adjust_price');
            if (!adjustPrice) {
                // Flag not set — nothing to do
                log.debug('afterSubmit', 'adjust_price not set, skipping');
                return;
            }

            log.debug('afterSubmit', `adjust_price is true on CSO ID: ${consolidatedRecord.id}`);

            // ── Shared values ────────────────────────────────────────────
            const itemID         = consolidatedRecord.getValue('custrecord_special_consolidated_item');
            const poUniqueLineKey = consolidatedRecord.getValue('custrecord_consolidated_po_unique');
            // custrecord_consol_item_rate is a Text field — explicitly parseFloat
            // to handle values like '.80' (no leading zero) safely across all math ops
            const newRate        = parseFloat(consolidatedRecord.getValue('custrecord_consol_item_rate')) || 0;
            const poId           = consolidatedRecord.getValue('custrecord_special_consolidated_po');
            const inboundId      = consolidatedRecord.getValue('custrecord_inbound_shipment');

            if (!poUniqueLineKey) {
                log.error('afterSubmit', 'custrecord_consolidated_po_unique is empty — cannot match lines');
                return;
            }

            // ── 1. Reset the adjust_price flag FIRST ─────────────────────
            // Do this before any saves so a downstream failure can't leave
            // the flag stuck true and cause this UE to re-fire indefinitely.
            record.submitFields({
                type: 'customrecord_consolidated_special_order',
                id: consolidatedRecord.id,
                values: { custrecord_mli_consol_adjust_price: false },
                options: { enableSourcing: false, ignoreMandatoryFields: true }
            });
            log.debug('afterSubmit', `adjust_price reset to false on CSO ID: ${consolidatedRecord.id}`);

            // ── 2. Update InboundShipment line ───────────────────────────
            // Uses static mode (isDynamic: false) + setSublistValue.
            // Dynamic mode (selectLine/setCurrentSublistValue/commitLine)
            // can fail to persist on inbound shipments without throwing.
            // Matches by 'shipmentitem' field (= poUniqueLineKey) which is
            // a reliable unique key — avoids the text-vs-ID mismatch that
            // would occur matching on 'itemid'.
            if (inboundId) {
                try {
                    const InbRecord = record.load({
                        type: 'inboundShipment',
                        id: inboundId,
                        isDynamic: false
                    });

                    log.audit('afterSubmit', `Loaded InboundShipment ID: ${inboundId}`);

                    const matchedLine = InbRecord.findSublistLineWithValue({
                        sublistId: 'items',
                        fieldId:   'shipmentitem',
                        value:     poUniqueLineKey
                    });

                    log.debug('afterSubmit', `findSublistLineWithValue result: line=${matchedLine}, key=${poUniqueLineKey}`);

                    if (matchedLine !== -1) {
                        const quantity = InbRecord.getSublistValue({
                            sublistId: 'items',
                            fieldId:   'quantityexpected',
                            line:      matchedLine
                        });

                        const newAmount = parseFloat(quantity) * parseFloat(newRate);
                        log.debug('afterSubmit', `Inbound line ${matchedLine}: qty=${quantity}, rate=${newRate}, amount=${newAmount}`);

                        // Set both the per-unit rate and the line total
                        InbRecord.setSublistValue({
                            sublistId: 'items',
                            fieldId:   'expectedrate',
                            line:      matchedLine,
                            value:     parseFloat(newRate)
                        });

                        InbRecord.setSublistValue({
                            sublistId: 'items',
                            fieldId:   'shipmentitemamount',
                            line:      matchedLine,
                            value:     newAmount
                        });

                        InbRecord.save({ enableSourcing: true, ignoreMandatoryFields: false });
                        log.audit('afterSubmit', `InboundShipment ${inboundId} saved — line ${matchedLine} updated`);

                    } else {
                        log.error('afterSubmit', `No inbound line matched shipmentitem key: ${poUniqueLineKey}`);
                    }

                } catch (inbErr) {
                    log.error('afterSubmit - InboundShipment update failed', JSON.stringify({ message: inbErr.message, name: inbErr.name }));
                }
            }

            // ── 3. Update Purchase Order line rate ───────────────────────
            if (poId) {
                try {
                    const poRecord = record.load({
                        type: record.Type.PURCHASE_ORDER,
                        id: poId,
                        isDynamic: false
                    });

                    const poLineCount = poRecord.getLineCount({ sublistId: 'item' });
                    let poLineMatched = false;

                    for (let i = 0; i < poLineCount; i++) {
                        const lineKey = poRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId:   'lineuniquekey',
                            line:      i
                        });

                        if (lineKey === poUniqueLineKey) {
                            poRecord.setSublistValue({
                                sublistId: 'item',
                                fieldId:   'rate',
                                line:      i,
                                value:     parseFloat(newRate)
                            });
                            poLineMatched = true;
                            log.debug('afterSubmit', `PO line ${i} matched key ${poUniqueLineKey}, rate set to ${newRate}`);
                            break;
                        }
                    }

                    if (!poLineMatched) {
                        log.error('afterSubmit', `No PO line matched lineuniquekey: ${poUniqueLineKey}`);
                    }

                    poRecord.save();
                    log.audit('afterSubmit', `Purchase Order ${poId} saved`);

                } catch (poErr) {
                    log.error('afterSubmit - PO update failed', JSON.stringify({ message: poErr.message, name: poErr.name }));
                }
            }

        } catch (e) {
            log.error('afterSubmit - Unhandled Error', e.message);
        }
    }

    return { afterSubmit };
});