/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * 
 * @description Backfill script that retroactively populates the custbody_zas_affiliated_inbounds
 *              multi-select field on Purchase Orders.
 * 
 *              Strategy:
 *              - getInputData: Search all active customrecord_mli_inbound_redirector records
 *              - map: For each redirector, load its linked inbound shipment, extract PO IDs
 *                     from item lines, and emit (PO ID → redirector ID) pairs
 *              - reduce: For each PO, merge all redirector IDs into the multi-select field
 * 
 * @deployment  Deploy as: Map/Reduce
 *              Status:    Not Scheduled (trigger manually or schedule once)
 *              Concurrency: 1
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    /**
     * getInputData - Returns all active redirector records with their linked inbound ID.
     *                Uses a standard saved search (no restricted fields).
     */
    function getInputData() {
        log.audit('getInputData', 'Starting backfill of custbody_zas_affiliated_inbounds');

        return search.create({
            type: 'customrecord_mli_inbound_redirector',
            filters: [
                ['isinactive', 'is', 'F']
            ],
            columns: [
                search.createColumn({ name: 'internalid' }),
                search.createColumn({ name: 'name' }),
                search.createColumn({ name: 'custrecord_mli_redirect_to' })
            ]
        });
    }

    /**
     * map - Receives one redirector record per call.
     *       Loads the linked inbound shipment, reads PO IDs from its item lines,
     *       and emits (PO ID → redirector ID) for each unique PO.
     */
    function map(context) {
        var searchResult = JSON.parse(context.value);

        var redirectorId = searchResult.id;
        var redirectorName = searchResult.values.name;
        var inboundIdRaw = searchResult.values.custrecord_mli_redirect_to;

        // custrecord_mli_redirect_to is a select field — extract the internal ID
        var inboundId = null;
        if (inboundIdRaw && typeof inboundIdRaw === 'object') {
            // Search result format: { value: "2335", text: "INBSHIP2331" }
            inboundId = inboundIdRaw.value;
        } else if (inboundIdRaw) {
            inboundId = String(inboundIdRaw);
        }

        if (!inboundId) {
            log.debug('map:skip', 'Redirector ' + redirectorId + ' (' + redirectorName + ') has no linked inbound — skipping.');
            return;
        }

        log.debug('map', 'Redirector ' + redirectorId + ' → Inbound ' + inboundId);

        // Load the inbound shipment to read PO IDs from item lines
        try {
            var inboundRec = record.load({
                type: record.Type.INBOUND_SHIPMENT,
                id: inboundId,
                isDynamic: false
            });

            var lineCount = inboundRec.getLineCount({ sublistId: 'items' });
            var emittedPos = {};

            for (var i = 0; i < lineCount; i++) {
                var poId = inboundRec.getSublistValue({
                    sublistId: 'items',
                    fieldId: 'purchaseorder',
                    line: i
                });

                if (poId && !emittedPos[poId]) {
                    emittedPos[poId] = true;

                    // Key = PO ID, Value = redirector ID
                    context.write({
                        key: String(poId),
                        value: String(redirectorId)
                    });
                }
            }

            if (!Object.keys(emittedPos).length) {
                log.debug('map:skip', 'Inbound ' + inboundId + ' has no PO lines.');
            }

        } catch (e) {
            log.error('map:error', 'Failed to load inbound ' + inboundId +
                ' (redirector ' + redirectorId + '): ' + e.message);
        }
    }

    /**
     * reduce - Receives all redirector IDs for a single PO.
     *          Loads the PO, reads current multi-select values, merges in any missing
     *          redirector IDs, and saves if changes were made.
     */
    function reduce(context) {
        var poId = context.key;

        // Deduplicate redirector IDs
        var targetRedirectorIds = [];
        context.values.forEach(function (val) {
            var rid = String(val);
            if (rid && rid !== 'undefined' && targetRedirectorIds.indexOf(rid) === -1) {
                targetRedirectorIds.push(rid);
            }
        });

        log.debug('reduce:PO-' + poId, 'Target redirector IDs: ' + JSON.stringify(targetRedirectorIds));

        if (!targetRedirectorIds.length) {
            context.write({ key: poId, value: 'SKIPPED_NO_REDIRECTORS' });
            return;
        }

        try {
            var poRec = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: poId,
                isDynamic: false
            });

            var currentInbounds = poRec.getValue({
                fieldId: 'custbody_zas_affiliated_inbounds'
            });

            // Normalize to string array
            if (!Array.isArray(currentInbounds)) {
                currentInbounds = currentInbounds ? [String(currentInbounds)] : [];
            }
            currentInbounds = currentInbounds.map(String);

            // Filter out empty strings
            currentInbounds = currentInbounds.filter(function (v) { return v && v !== ''; });

            // Determine which redirectors are missing
            var newIds = targetRedirectorIds.filter(function (rid) {
                return currentInbounds.indexOf(rid) === -1;
            });

            if (!newIds.length) {
                log.debug('reduce:PO-' + poId, 'Already up to date — skipping save.');
                context.write({ key: poId, value: 'SKIPPED' });
                return;
            }

            // Merge and save
            var mergedIds = currentInbounds.concat(newIds);

            poRec.setValue({
                fieldId: 'custbody_zas_affiliated_inbounds',
                value: mergedIds
            });

            var savedId = poRec.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            log.audit('reduce:PO-' + poId, 'Updated — added redirector(s): ' + JSON.stringify(newIds) +
                ' | Total now: ' + JSON.stringify(mergedIds));

            context.write({ key: poId, value: 'UPDATED' });

        } catch (e) {
            log.error('reduce:PO-' + poId, 'Error: ' + e.message);
            context.write({ key: poId, value: 'ERROR: ' + e.message });
        }
    }

    /**
     * summarize - Logs final stats.
     */
    function summarize(summary) {
        log.audit('summarize', 'Backfill complete.');
        log.audit('summarize', 'Total seconds: ' + summary.seconds);
        log.audit('summarize', 'Usage units: ' + summary.usage);
        log.audit('summarize', 'Yields: ' + summary.yields);

        var updated = 0;
        var skipped = 0;
        var errors = 0;

        summary.output.iterator().each(function (key, value) {
            if (value === 'UPDATED') updated++;
            else if (value === 'SKIPPED' || value === 'SKIPPED_NO_REDIRECTORS') skipped++;
            else errors++;
            return true;
        });

        log.audit('summarize:results', 'Updated: ' + updated + ' | Skipped: ' + skipped + ' | Errors: ' + errors);

        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error('map:stageError', 'Key: ' + key + ' | Error: ' + error);
            return true;
        });
        summary.reduceSummary.errors.iterator().each(function (key, error) {
            log.error('reduce:stageError', 'Key: ' + key + ' | Error: ' + error);
            return true;
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});