/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define([
    'N/record',
    'N/log'
], function (record, log) {

    /**
     * Entry point for your WF Action.
     * @param {Object} context
     * @param {Record} context.newRecord   — your custom record
     */
    function onAction(context) {
        var wrkRec = context.newRecord;
        var soId = wrkRec.getValue('custrecord_pr_stored_reallocation_so');
        var lineKey = wrkRec.getValue('custrecord_pr_stored_reallocation_key');
        if (!soId || !lineKey) {
            log.debug('skip', 'Missing SO or line key');
            return;
        }

        // 1) load the sales order
        var soRec = record.load({
            type: record.Type.SALES_ORDER,
            id: soId,
            isDynamic: false
        });

        // 2) find the line by lineuniquekey
        var lineIdx = soRec.findSublistLineWithValue({
            sublistId: 'item',
            fieldId: 'lineuniquekey',
            value: lineKey
        });
        if (lineIdx < 0) {
            log.error('not found', 'Lineuniquekey ' + lineKey + ' not on SO ' + soId);
            return;
        }

        // 3) pull your PO‐and‐special flags off that line
        var poId = soRec.getSublistValue({
            sublistId: 'item', fieldId: 'createpo', line: lineIdx
        });
        var inbText = soRec.getSublistValue({
            sublistId: 'item', fieldId: 'custcol_pl_so_inbound', line: lineIdx
        });
        var isUnconsolidated = soRec.getSublistValue({
            sublistId: 'item', fieldId: 'custcol_zastro_unconsolidated_item', line: lineIdx
        });
        log.debug('poId',poId)
        log.debug('inbText',inbText)
        log.debug('isUnconsolidated',isUnconsolidated)
        // 4) branch
        if (!poId && !isUnconsolidated) {
            // No PO, Not Special → do nothing
            log.debug('no action', 'neither special nor PO');
            return;

        } else if (!poId && isUnconsolidated) {
            // mark non consildated
            log.debug('!poId && isUnconsolidated', poId + '_' + isUnconsolidated);
            return;
        }
        else if (poId && !inbText) {
            // kill po
            log.debug('poId && !inbText', poId + '_' + inbText);
            // return;
            killPO(soRec, lineIdx);
            splitLine(soRec, lineIdx)
        }
        else if (poId && inbText) {
            // breaklink
            log.debug('poId && inbText', poId + '_' + inbText);
            //return;
            //killPO(soRec, lineIdx);
            splitLine(soRec, lineIdx)
        }
        else {
            log.debug('nuffin')
        }

        // 5) persist any changes
        soRec.save({ ignoreMandatoryFields: true });
    }
    function killPO(soRec, lineIdx) {
        var randomGen = soRec.getSublistValue({
            sublistId: 'item', fieldId: 'custcol_self_id', line: lineIdx
        });
        var linkedSO = soRec.getSublistValue({
            sublistId: 'item', fieldId: 'custcol_zas_linked_so_rec', line: lineIdx
        });

        if (randomGen && linkedSO) {
            var recObj = record.load({ type: 'customrecord_consolidated_special_order', id: linkedSO })
            var poId = recObj.getValue({ fieldId: 'custrecord_special_consolidated_po' })
            var poKey = recObj.getValue({ fieldId: 'custrecord_consolidated_po_unique' })
            if (poKey && poId) {
                var poRecord = record.load({ type: 'purchaseorder', id: poId, isDynamic: true })
                let lineCount = poRecord.getLineCount({ sublistId: 'item' });
                log.debug('PO line count', lineCount);
                if (Number(lineCount) > 1) {
                    // Iterate backwards over the item sublist and remove matching lines
                    for (let i = lineCount - 1; i >= 0; i--) {
                        let lineUniqueKey = poRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'lineuniquekey',
                            line: i
                        });
                        log.debug('PO Line ' + i + ' unique key', poKey);

                        if (lineUniqueKey == poKey) {
                            poRecord.removeLine({
                                sublistId: 'item',
                                line: i,
                                ignoreRecalc: true
                            });
                            log.debug('Removed PO line ' + i + ' matching poKey', poKey);
                        }
                    }
                    // Save the updated Purchase Order record
                    let poId = poRecord.save();
                } else {
                    record.delete({ type: 'purchaseorder', id: poId })
                }
            }
        }
    }

    function splitLine(soRec, lineIdx) {
        var qtyOrdered = soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: lineIdx });
        var qtyCommitted = soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantitycommitted', line: lineIdx });
        var qtyShipped = soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantityfulfilled', line: lineIdx });
        var linkedSO = soRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_zas_linked_so_rec', line: lineIdx });

        log.debug('quantities', {
            ordered: qtyOrdered,
            committed: qtyCommitted,
            shipped: qtyShipped
        });

        var processedQty = Number(qtyCommitted) + Number(qtyShipped);
        var remainderQty = Number(qtyOrdered) - processedQty;

        if (remainderQty <= 0) {
            log.debug('splitLine', 'No remainder – skipping split');
            return;
        }

        var item = soRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: lineIdx });
        var rate = soRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: lineIdx });
        var description = soRec.getSublistValue({ sublistId: 'item', fieldId: 'description', line: lineIdx });
        var location = soRec.getSublistValue({ sublistId: 'item', fieldId: 'location', line: lineIdx });

        soRec.setSublistValue({
            sublistId: 'item',
            line: lineIdx,
            fieldId: 'quantity',
            value: processedQty
        });

        var newLineIdx = soRec.getLineCount({ sublistId: 'item' });

        hijackLabels(processedQty, remainderQty, linkedSO);

        soRec.insertLine({
            sublistId: 'item',
            line: lineIdx
        });

        soRec.setSublistValue({ sublistId: 'item', line: newLineIdx, fieldId: 'item', value: item });
        soRec.setSublistValue({ sublistId: 'item', line: newLineIdx, fieldId: 'quantity', value: remainderQty });
        soRec.setSublistValue({ sublistId: 'item', line: newLineIdx, fieldId: 'rate', value: rate });
        soRec.setSublistValue({ sublistId: 'item', line: newLineIdx, fieldId: 'description', value: description });
        soRec.setSublistValue({ sublistId: 'item', line: newLineIdx, fieldId: 'location', value: location });

        log.audit('splitLine', 'Line ' + lineIdx + ' split into processed ' + processedQty + ' and remainder ' + remainderQty);
        return soRec
    }
    function hijackLabels(processedQty, remainderQty, linkedSO) {
        // 1) load the existing special-order record
        var recObj = record.load({
          type: 'customrecord_consolidated_special_order',
          id:   linkedSO,
          isDynamic: false
        });
      
        // 2) list of every field you want to clone
        var fieldsToClone = [
          'custrecord_cancel_completed',
          'custrecord_consol_item_rate',
          'custrecord_consolidated_po_unique',
          'custrecord_inbound_shipment',
          'custrecord_ipo_migrate',
          'custrecord_mli_consol_price_updated',
          'custrecord_mli_consol_price_waiting',
          'custrecord_mli_remove_from_queue',
          'custrecord_po_linked',
          'custrecord_special_consolidated_item',
          'custrecord_special_consolidated_key',
          'custrecord_special_consolidated_linked',
          'custrecord_special_consolidated_po',
          'custrecord_special_consolidated_ref',
          'custrecord_special_consolidated_sl',
          'custrecord_special_consolidated_so',
          'custrecord_special_consolidated_vendor'
        ];
      
        // 3) pull them all into a map
        var values = {};
        fieldsToClone.forEach(function(fieldId) {
          values[fieldId] = recObj.getValue({ fieldId: fieldId });
        });
      
        // 4) update the original’s qty to processedQty
        recObj.setValue({
          fieldId: 'custrecord_special_consolidated_qty',
          value:   processedQty
        });
        recObj.save({ ignoreMandatoryFields: true });
      
        // 5) create a new special-order record
        var recObjNew = record.create({
            type: 'customrecord_consolidated_special_order',
          isDynamic: false
        });
      
        // 6) copy over every field you collected
        fieldsToClone.forEach(function(fieldId) {
          recObjNew.setValue({
            fieldId: fieldId,
            value:   values[fieldId]
          });
        });
      
        // 7) set the new record’s qty to the remainderQty
        recObjNew.setValue({
          fieldId: 'custrecord_special_consolidated_qty',
          value:   remainderQty
        });
      
        // 8) persist the new record
        recObjNew.save({ ignoreMandatoryFields: true });
      }


    return {
        onAction: onAction
    };
});
