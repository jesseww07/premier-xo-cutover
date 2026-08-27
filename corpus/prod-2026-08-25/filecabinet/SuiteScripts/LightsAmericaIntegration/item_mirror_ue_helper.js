    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */

    define([
        'N/log',
        'N/record',
        'SuiteScripts/LightsAmericaIntegration/Templates/customer_item_mapping_pace.js',
        'SuiteScripts/LightsAmericaIntegration/Model/item.js'
    ],
    
        function (log, record, customerTemplate, itemModel) {
    
        var exports = {};
        function afterSubmit(context) {
            log.debug('START_SCRIPT', '');
            var newRecordId = context.newRecord.id;
            var lightsItem = record.load({
                type: 'customrecord_zastro_lights_items',
                id: newRecordId
            });

               var skuValue = lightsItem.getValue({ fieldId: 'custrecord_lights_sku' });
        if (!skuValue) {
            log.audit('SKIP_RECORD', 'No SKU present on record ' + newRecordId);
            return; // Exit script when sky isnt there
        }
    
            var configRecord = itemModel.getLightsConfig();
            var customerFieldMapping = customerTemplate.getCustomItemFieldMapping();
            var manufacturerMappingTable = itemModel.getStoredManufacturerMapingTable();
            log.debug('manufacturerMappingTable',manufacturerMappingTable)
    
            var netsuiteItemId = lightsItem.getValue({fieldId: 'custrecord_lights_linked_item'});
            log.debug('netsuiteItemId',netsuiteItemId)
            var previousItemId = netsuiteItemId;
    
            var skuOnlyLookupEnabled = configRecord.getValue({fieldId: 'custrecord_lights_enable_sku_only'});
            //this is set to false in premier rn
            var enableCreateItems = configRecord.getValue({fieldId: 'custrecord_zastro_lights_enable_create_p'});
            //this is set to false in premier rn
            var enableUpdateItems = configRecord.getValue({fieldId: 'custrecord_zastro_lights_enable_update_p'});
            //this is set to false in premier rn
            var mergeOneRecord = lightsItem.getValue({fieldId: 'custrecord_zastro_lights_merge_item'});
            //this is set to false on all items in premier rn
    
            if (mergeOneRecord) {
                //this is set to false on all items in premier rn
                netsuiteItemId = itemModel.mergeOneItemRecord(configRecord, manufacturerMappingTable, customerFieldMapping, lightsItem, false);
                if (netsuiteItemId) {
                    lightsItem.setValue({fieldId: 'custrecord_zastro_lights_merge_item', value: false});
                    lightsItem.setValue({fieldId: 'custrecord_lights_linked_item', value: netsuiteItemId});
                    lightsItem.save();
                    return true;
                }
    
            }
    
            //Link the item if not already
            if (!netsuiteItemId) {
                //if no linked item on custom record 
                if (skuOnlyLookupEnabled) {
                    //this is false in premier rn
                    var sku = lightsItem.getValue({fieldId: 'custrecord_lights_mfr_number'});
                    var mappedNetsuiteVendor;
                    var lightsAmericaVendorName = lightsItem.getValue({fieldId: 'custrecord_lights_mfr_name'});
                    log.debug('SKU_VENDOR', sku + '_' + lightsAmericaVendorName);
                    lightsAmericaVendorName = lightsAmericaVendorName.toUpperCase();
            
                    if (lightsAmericaVendorName && manufacturerMappingTable.hasOwnProperty(lightsAmericaVendorName)) {
                        mappedNetsuiteVendor = manufacturerMappingTable[lightsAmericaVendorName];
                        netsuiteItemId = itemModel.findItemBySkuOnly(sku, mappedNetsuiteVendor['internalid']);
                    }
    
                    else {
                        log.error('NO_MAPPED_VENDOR', 'Vendor not mapped');
                    }
                }
    
                if (!netsuiteItemId) {
                    log.debug('going to findItemByMfrSku in item.js - lightsItem',lightsItem)
                    netsuiteItemId = itemModel.findItemByMfrSku(lightsItem, manufacturerMappingTable);
                }
    
            }
    
            //Update/create the item
            if (netsuiteItemId) {
                if (enableUpdateItems) {
                    netsuiteItemId = itemModel.updateOneItemRecord(netsuiteItemId, configRecord, manufacturerMappingTable, customerFieldMapping, lightsItem);
                }
            }
    
            else {
                if (enableCreateItems) {
                    netsuiteItemId = itemModel.createOneItemRecord(configRecord, manufacturerMappingTable, customerFieldMapping, lightsItem, false);
                }
    
            }
    
            //Update the item record if an item id is found
            if (netsuiteItemId && !previousItemId) {
                lightsItem.setValue({fieldId: 'custrecord_lights_linked_item', value: netsuiteItemId});
                lightsItem.save();
            }
    
            else if (!netsuiteItemId) {
                log.error('NO_ITEM_ID_RETURNED');
                //TODO: Indicate some error status/reporting
            }
        }
    
        exports.afterSubmit = afterSubmit;
        return exports;
    });
    
    