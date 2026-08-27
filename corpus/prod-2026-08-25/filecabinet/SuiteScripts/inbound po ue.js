/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * @description When an Inbound Shipment is created or edited, this script reads the PO IDs
 *              from the inbound's item lines, finds the corresponding redirector record
 *              (customrecord_mli_inbound_redirector), and pushes the redirector ID into
 *              the custbody_zas_affiliated_inbounds multi-select field on each linked PO.
 *              This mirrors the pattern used by the Live Inventory Order field on Sales Orders.
 * 
 * @deployment  Deploy on: Inbound Shipment (inboundshipment)
 *              Event:     afterSubmit
 *              Status:    Released
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    /**
     * afterSubmit - fires after the inbound shipment record is saved
     * @param {Object} context
     */
    function afterSubmit(context) {
        if (context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.EDIT) {
            return;
        }

        var inboundId = context.newRecord.id;
        log.debug('afterSubmit:start', 'Processing Inbound Shipment ID: ' + inboundId);

        try {
            // ─── Step 1: Find the redirector record for this inbound shipment ───
            var redirectorId = findRedirectorForInbound(inboundId);
            if (!redirectorId) {
                log.debug('afterSubmit', 'No redirector record found for inbound ' + inboundId + ' — skipping.');
                return;
            }
            log.debug('afterSubmit', 'Found redirector ID: ' + redirectorId + ' for inbound ' + inboundId);

            // ─── Step 2: Get unique PO IDs from the inbound's item lines ───
            var poIds = getPoIdsFromInbound(inboundId);
            if (!poIds.length) {
                log.debug('afterSubmit', 'No PO lines found on inbound ' + inboundId);
                return;
            }
            log.debug('afterSubmit', 'Found ' + poIds.length + ' unique PO(s): ' + JSON.stringify(poIds));

            // ─── Step 3: Push redirector ID into each PO's multi-select ───
            poIds.forEach(function (poId) {
                updatePoWithRedirector(poId, redirectorId);
            });

        } catch (e) {
            log.error('afterSubmit:error', 'Unhandled error processing inbound ' + inboundId + ': ' + e.message + '\n' + e.stack);
        }
    }

    /**
     * Search for the customrecord_mli_inbound_redirector record that points to this inbound.
     * @param {string|number} inboundId
     * @returns {string|null} redirector internal ID or null
     */
    function findRedirectorForInbound(inboundId) {
        var redirectorId = null;

        search.create({
            type: 'customrecord_mli_inbound_redirector',
            filters: [
                ['custrecord_mli_redirect_to', 'anyof', inboundId],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        }).run().each(function (result) {
            redirectorId = result.id;
            return false; // first match only
        });

        return redirectorId;
    }

    /**
     * Load the inbound shipment and extract unique PO IDs from its item sublist.
     * @param {string|number} inboundId
     * @returns {string[]} array of unique PO internal IDs
     */
    function getPoIdsFromInbound(inboundId) {
        var inboundRec = record.load({
            type: record.Type.INBOUND_SHIPMENT,
            id: inboundId,
            isDynamic: false
        });

        var lineCount = inboundRec.getLineCount({ sublistId: 'items' });
        var poIds = [];

        for (var i = 0; i < lineCount; i++) {
            var poId = inboundRec.getSublistValue({
                sublistId: 'items',
                fieldId: 'purchaseorder',
                line: i
            });

            if (poId && poIds.indexOf(String(poId)) === -1) {
                poIds.push(String(poId));
            }
        }

        return poIds;
    }

    /**
     * Load a PO, read the current multi-select values, push the redirector ID if not already
     * present, and save.
     * @param {string} poId
     * @param {string} redirectorId
     */
    function updatePoWithRedirector(poId, redirectorId) {
        try {
            var poRec = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: poId,
                isDynamic: false
            });

            var currentInbounds = poRec.getValue({
                fieldId: 'custbody_zas_affiliated_inbounds'
            });

            log.debug('updatePO:' + poId, 'Current custbody_zas_affiliated_inbounds = ' + JSON.stringify(currentInbounds));

            // Multi-select getValue returns an array; handle edge cases
            if (!Array.isArray(currentInbounds)) {
                currentInbounds = currentInbounds ? [String(currentInbounds)] : [];
            }

            var redirectorStr = String(redirectorId);

            // Check if already present (compare as strings to be safe)
            var alreadyLinked = currentInbounds.some(function (val) {
                return String(val) === redirectorStr;
            });

            if (alreadyLinked) {
                log.debug('updatePO:' + poId, 'Redirector ' + redirectorId + ' already present — skipping.');
                return;
            }

            // Push and save — same pattern as Live Inventory Order
            currentInbounds.push(redirectorStr);

            poRec.setValue({
                fieldId: 'custbody_zas_affiliated_inbounds',
                value: currentInbounds
            });

            var savedId = poRec.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            log.audit('updatePO:' + poId, 'Successfully linked redirector ' + redirectorId + ' → PO ' + savedId);

        } catch (e) {
            log.error('updatePO:' + poId, 'Error: ' + e.message);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});