/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @description One-time backfill for Items missing LA SKU link
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    const getInputData = () => {
        return search.create({
            type: 'customrecord_zastro_lights_items',
            filters: [
                ['custrecord_lights_sku', 'isnotempty', ''],
                'AND',
                ['isinactive', 'is', 'F'],
                'AND',
                ['custrecord_lights_linked_item.isinactive', 'is', 'F'],
                'AND',
                ['custrecord_lights_linked_item.custitem_la_sku', 'anyof', '@NONE@']
            ],
            columns: [
                search.createColumn({ name: 'internalid' }),
                search.createColumn({ name: 'custrecord_lights_linked_item' }),
                search.createColumn({ name: 'custrecord_lights_sku' })
            ]
        });
    };

    const map = (context) => {
        const result = JSON.parse(context.value);
        const laRecordId = result.id;
        const linkedItemId = result.values.custrecord_lights_linked_item?.value;
        const skuValue = result.values.custrecord_lights_sku;

        if (!linkedItemId || !skuValue) {
            log.debug('Skipped', `LA ${laRecordId} - missing linked item or SKU`);
            return;
        }

        try {
            // Update LA record name to SKU
            record.submitFields({
                type: 'customrecord_zastro_lights_items',
                id: laRecordId,
                values: { 'name': skuValue },
                options: { ignoreMandatoryFields: true }
            });

            // Update Item with LA record link
            record.submitFields({
                type: record.Type.INVENTORY_ITEM,
                id: linkedItemId,
                values: { 'custitem_la_sku': laRecordId },
                options: { ignoreMandatoryFields: true }
            });

            log.debug('Updated', `Item ${linkedItemId} → LA ${laRecordId} (${skuValue})`);

        } catch (e) {
            log.error('Update Failed', `LA ${laRecordId}, Item ${linkedItemId}: ${e.message}`);
        }
    };

    const summarize = (summary) => {
        log.audit('Complete', `Processed ${summary.inputSummary.totalInputCount} records`);
        
        summary.mapSummary.errors.iterator().each((key, error) => {
            log.error('Map Error', `Key: ${key}, Error: ${error}`);
            return true;
        });
    };

    return { getInputData, map, summarize };
});