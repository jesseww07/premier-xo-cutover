/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @description Backfill LightsAmerica Record link on Item records (Chunked)
 * Also updates LA record Name field to display SKU instead of internal ID
 * Only processes LA records linked to active, existing Items
 * 
 * Set the Chunk Number parameter (0-9) on deployment for each run
 */
define(['N/search', 'N/record', 'N/log', 'N/runtime'], (search, record, log, runtime) => {

    const TOTAL_CHUNKS = 10;

    const getInputData = () => {
        const script = runtime.getCurrentScript();
        const chunkNumber = script.getParameter({ name: 'custscript_la_chunk_number' }) || 0;
        
        log.audit('Starting Backfill', `Processing chunk ${chunkNumber} of ${TOTAL_CHUNKS}`);
        
        return search.create({
            type: 'customrecord_zastro_lights_items',
            filters: [
                ['custrecord_lights_linked_item', 'isnotempty', ''],
                'AND',
                ['isinactive', 'is', 'F'],
                'AND',
                ['custrecord_lights_linked_item.isinactive', 'is', 'F'],
                'AND',
                ['formulanumeric: MOD({internalid}, ' + TOTAL_CHUNKS + ')', 'equalto', chunkNumber]
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
        
        const linkedItemId = result.values.custrecord_lights_linked_item?.value 
            || result.values.custrecord_lights_linked_item;
        const laRecordId = result.id;
        const lightsAmericaSku = result.values.custrecord_lights_sku;
        
        if (linkedItemId && laRecordId) {
            // Update the LA record's Name field to show SKU instead of internal ID
            if (lightsAmericaSku) {
                updateLaRecordName(laRecordId, lightsAmericaSku);
            }
            
            // Update the Item with link to LA record
            updateItem(linkedItemId, laRecordId);
        }
    };

    const updateItem = (itemId, laRecordId) => {
        const itemTypes = [
            record.Type.INVENTORY_ITEM,
            record.Type.NON_INVENTORY_ITEM
        ];
        
        for (const itemType of itemTypes) {
            try {
                record.submitFields({
                    type: itemType,
                    id: itemId,
                    values: {
                        'custitem_la_sku': laRecordId
                    },
                    options: { ignoreMandatoryFields: true }
                });
                log.debug('Item Updated', `${itemType} ${itemId} → LA Record: ${laRecordId}`);
                return true;
            } catch (e) {
                // Try next type
            }
        }
        
        log.error('Item Update Failed', `Could not update item ${itemId}`);
        return false;
    };

    const updateLaRecordName = (laRecordId, skuValue) => {
        try {
            record.submitFields({
                type: 'customrecord_zastro_lights_items',
                id: laRecordId,
                values: {
                    'name': skuValue
                },
                options: { ignoreMandatoryFields: true }
            });
            log.debug('LA Name Updated', `LA Record ${laRecordId} → Name: ${skuValue}`);
            return true;
        } catch (e) {
            log.error('LA Name Update Failed', `Could not update LA record ${laRecordId}: ${e.message}`);
            return false;
        }
    };

    const reduce = (context) => {
        // Not used - processing happens in Map
    };

    const summarize = (summary) => {
        const script = runtime.getCurrentScript();
        const chunkNumber = script.getParameter({ name: 'custscript_la_chunk_number' }) || 0;
        
        let errorCount = 0;
        
        summary.mapSummary.errors.iterator().each((key, error) => {
            log.error(`Map Error - Key ${key}`, error);
            errorCount++;
            return true;
        });
        
        log.audit('CHUNK COMPLETE', {
            chunk: chunkNumber,
            totalChunks: TOTAL_CHUNKS,
            inputRecords: summary.inputSummary.totalInputCount,
            errors: errorCount,
            runtime: summary.seconds + ' seconds'
        });
    };

    return { getInputData, map, reduce, summarize };
});