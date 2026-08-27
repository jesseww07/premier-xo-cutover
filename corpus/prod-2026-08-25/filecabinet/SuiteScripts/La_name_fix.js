/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @description Fix LA record names to display SKU instead of internal ID
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    const getInputData = () => {
        log.audit('Starting', 'Loading saved search');
        return search.load({ id: 'customsearch_la_name_fix' });
    };

    const map = (context) => {
        const result = JSON.parse(context.value);
        const laRecordId = result.id;
        const currentName = result.values.name;
        const skuValue = result.values.custrecord_lights_sku;

        // Skip if already correct or no SKU
        if (!skuValue || currentName === skuValue) return;

        try {
            record.submitFields({
                type: 'customrecord_zastro_lights_items',
                id: laRecordId,
                values: { 'name': skuValue },
                options: { ignoreMandatoryFields: true }
            });
            log.debug('Fixed', `LA ${laRecordId} → Name: ${skuValue}`);
        } catch (e) {
            log.error('Failed', `LA ${laRecordId}: ${e.message}`);
        }
    };

    const summarize = (summary) => {
        let processedCount = 0;
        summary.mapSummary.keys.iterator().each(() => {
            processedCount++;
            return true;
        });
        
        log.audit('Complete', `Processed ${processedCount} records`);
        
        summary.mapSummary.errors.iterator().each((key, error) => {
            log.error('Map Error', `Key: ${key}, Error: ${error}`);
            return true;
        });
    };

    return { getInputData, map, summarize };
});