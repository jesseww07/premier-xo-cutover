/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
define(['N/record'], function (record) {
    function onAction(context) {
        try {
            let item = context.newRecord;
            let id = item.id;
            let currentUpc = item.getValue({ fieldId: 'upccode' });

            // 1. Ensure we actually have an ID 
            // 2. ONLY update if the UPC doesn't already match the ID (prevents infinite loops)
            if (id && currentUpc !== String(id)) {
                log.debug('Setting UPC', `Updating UPC to match Internal ID: ${id}`);
                
                // submitFields is faster than load/save and prevents heavy re-triggering
                record.submitFields({
                    type: item.type,
                    id: id,
                    values: {
                        'upccode': id
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            }
        } catch (e) {
            log.error('Error setting UPC to Internal ID', e);
        }
    }

    return {
        onAction: onAction
    };
});