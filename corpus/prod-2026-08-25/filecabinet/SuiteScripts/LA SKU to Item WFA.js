/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 * @description Syncs LightsAmerica Record ID to linked Item record
 * Also updates LA record Name field to display SKU instead of internal ID
 * 
 * Trigger: After Record Submit on customrecord_zastro_lights_items
 */
define(['N/record', 'N/log'], (record, log) => {
    const onAction = (context) => {
        try {
            const laRecord = context.newRecord;
            const laRecordId = laRecord.id;
            
            const linkedItemId = laRecord.getValue({ 
                fieldId: 'custrecord_lights_linked_item' 
            });
            
            const lightsAmericaSku = laRecord.getValue({ 
                fieldId: 'custrecord_lights_sku' 
            });
            
            // Skip entirely if no SKU - record is incomplete
            if (!lightsAmericaSku) {
                log.debug('Skipped - No SKU', `LA Record ${laRecordId} has no SKU value`);
                return;
            }
            
            // Update LA record Name field to show SKU instead of internal ID
            try {
                record.submitFields({
                    type: 'customrecord_zastro_lights_items',
                    id: laRecordId,
                    values: {
                        'name': lightsAmericaSku
                    },
                    options: { ignoreMandatoryFields: true }
                });
                log.debug('LA Name Updated', `LA Record ${laRecordId} → Name: ${lightsAmericaSku}`);
            } catch (e) {
                log.error('LA Name Update Failed', `LA Record ${laRecordId}: ${e.message}`);
            }
            
            // Skip if no linked item
            if (!linkedItemId) {
                log.debug('Item Sync Skipped', `LA Record ${laRecordId} has no linked item`);
                return;
            }
            
            // Update linked Inventory Item
            try {
                record.submitFields({
                    type: record.Type.INVENTORY_ITEM,
                    id: linkedItemId,
                    values: {
                        'custitem_la_sku': laRecordId
                    },
                    options: { ignoreMandatoryFields: true }
                });
                
                log.debug('Item Updated', `Inventory Item ${linkedItemId} → LA Record: ${laRecordId}`);
                
            } catch (e) {
                log.error('Item Update Failed', `Item ${linkedItemId} for LA Record ${laRecordId}: ${e.message}`);
            }
            
        } catch (e) {
            log.error('Workflow Action Error', e.message);
        }
    };
    return { onAction };
});