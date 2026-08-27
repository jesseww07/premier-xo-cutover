/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/log'],
    function(record, search, log) {

        // ---- Config -------------------------------------------------------
        var CUSTOM_REC = 'customrecord_zastro_lights_items';
        var ITEM_TYPE  = 'inventoryitem';            // all linked items are inventory

        // CONFIRM this field id (inferred from "Linked Item Record" label):
        var LINKED_ITEM_FIELD = 'custrecord_la_linked_item';
        // -------------------------------------------------------------------

        function getInputData() {
            return search.load({ id: 'customsearch_la_record_delete' });
        }

        function map(context) {
            var result = JSON.parse(context.value);
            context.write({ key: result.id, value: result.id });
        }

        function reduce(context) {
            var customId = context.key;
            var itemId = null;

            // 1. Capture the linked item BEFORE deleting the custom record.
            try {
                var f = search.lookupFields({
                    type: CUSTOM_REC,
                    id: customId,
                    columns: [LINKED_ITEM_FIELD]
                });
                var linked = f[LINKED_ITEM_FIELD];
                if (linked && linked.length) itemId = linked[0].value;
            } catch (e) {
                // Custom record may already be gone; the delete below confirms.
            }

            // 2. Delete the custom record (always intended).
            try {
                record.delete({ type: CUSTOM_REC, id: customId });
                context.write({ key: customId, value: 'CUSTOM_DELETED' });
            } catch (e) {
                if (e.name === 'RCRD_DSNT_EXIST') {
                    context.write({ key: customId, value: 'CUSTOM_SKIPPED' });
                } else {
                    log.error({ title: 'Custom Delete Error',
                                details: 'ID: ' + customId + ' - ' + e.name + ': ' + e.message });
                    context.write({ key: customId, value: 'CUSTOM_ERROR' });
                }
                return; // custom record didn't delete -> leave the item alone
            }

            // 3. Handle the linked item.
            if (!itemId) { context.write({ key: customId, value: 'NO_ITEM' }); return; }

            // Guard: only delete the item if it is inactive. A lookup miss or
            // undefined status is treated as active -> SKIP, so this can never
            // delete a live item by accident.
            var isInactive = false;
            try {
                var itemF = search.lookupFields({
                    type: ITEM_TYPE,
                    id: itemId,
                    columns: ['isinactive']
                });
                isInactive = (itemF.isinactive === true);
            } catch (e) {
                if (e.name === 'RCRD_DSNT_EXIST') { context.write({ key: customId, value: 'ITEM_GONE' }); return; }
                log.error({ title: 'Item Lookup Error', details: 'Item ' + itemId + ' - ' + e.message });
                context.write({ key: customId, value: 'ITEM_LOOKUP_ERROR' }); return;
            }

            if (!isInactive) { context.write({ key: customId, value: 'ITEM_ACTIVE_SKIPPED' }); return; }

            // Inactive item -> delete. The custom-record delete above already
            // removed one dependency on the item, which helps it clear.
            try {
                record.delete({ type: ITEM_TYPE, id: itemId });
                context.write({ key: customId, value: 'ITEM_DELETED' });
            } catch (e) {
                if (e.name === 'RCRD_DSNT_EXIST') {
                    context.write({ key: customId, value: 'ITEM_GONE' });
                } else {
                    // Has transaction history / other dependencies -> expected, not a failure.
                    context.write({ key: customId, value: 'ITEM_BLOCKED' });
                }
            }
        }

        function summarize(summary) {
            var c = {
                CUSTOM_DELETED: 0, CUSTOM_SKIPPED: 0, CUSTOM_ERROR: 0,
                NO_ITEM: 0, ITEM_ACTIVE_SKIPPED: 0, ITEM_GONE: 0,
                ITEM_DELETED: 0, ITEM_BLOCKED: 0, ITEM_LOOKUP_ERROR: 0
            };

            summary.output.iterator().each(function(key, value) {
                if (c.hasOwnProperty(value)) c[value]++;
                return true;
            });

            log.audit({
                title: 'LA Record Delete - Run Summary',
                details:
                    'Custom recs -> deleted: ' + c.CUSTOM_DELETED +
                    ', already gone: ' + c.CUSTOM_SKIPPED +
                    ', errors: ' + c.CUSTOM_ERROR +
                    ' || Items -> deleted: ' + c.ITEM_DELETED +
                    ', blocked (has dependencies): ' + c.ITEM_BLOCKED +
                    ', still active (skipped): ' + c.ITEM_ACTIVE_SKIPPED +
                    ', already gone: ' + c.ITEM_GONE +
                    ', no linked item: ' + c.NO_ITEM +
                    ', lookup errors: ' + c.ITEM_LOOKUP_ERROR +
                    ' || usage: ' + summary.usage +
                    ', concurrency: ' + summary.concurrency +
                    ', yields: ' + summary.yields
            });

            summary.mapSummary.errors.iterator().each(function(key, error) {
                log.error({ title: 'Map Error for key: ' + key, details: error });
                return true;
            });
            summary.reduceSummary.errors.iterator().each(function(key, error) {
                log.error({ title: 'Reduce Error for key: ' + key, details: error });
                return true;
            });
        }

        return { getInputData: getInputData, map: map, reduce: reduce, summarize: summarize };
    });