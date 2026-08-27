/*
* To protect against version incompatibility, this script includes the @NApiVersion tag.
* myModule.js
* @NApiVersion 2.x
*/

define([
    'N/log',
    'N/record',
    'N/runtime',
    'N/search'
], function (log, record, runtime, search) {

    function getStoredManufacturerMapingTable() {
        var resultMappingTable = {};

        var mfrMappingSearch = search.create({
            type: "customrecord_manufacturer_mapping",
            filters:
                [
                    ["custrecord_zastro_mm_vendor", "noneof", "@NONE@"],
                    "AND",
                    ["custrecord_lights_america_name", "isnotempty", ""]
                ],
            columns:
                [
                    search.createColumn({
                        name: "custrecord_lights_america_name",
                    }),
                    search.createColumn({
                        name: "internalid",
                        join: "CUSTRECORD_ZASTRO_MM_VENDOR",
                    }),
                    search.createColumn({
                        name: "custrecord_vendor_abbr",
                    }),
                    search.createColumn({
                        name: "custrecord_vendor_suffix",
                    }),
                    search.createColumn({
                        name: "custrecord_exclude_from_item_creation",
                    })
                ]
        });

        mfrMappingSearch.run().each(function (result) {
            var mfrCatalogVendorName = result.getValue({ name: 'custrecord_lights_america_name' });
            var netsuiteVendorInternalId = result.getValue({ name: 'internalid', join: 'CUSTRECORD_ZASTRO_MM_VENDOR' });
            var mfrPrefix = result.getValue({ name: 'custrecord_vendor_abbr' });
            var mfrSuffix = result.getValue({ name: 'custrecord_vendor_suffix' });
            var excludeItemCreation = result.getValue({ name: 'custrecord_exclude_from_item_creation' });

            if (mfrCatalogVendorName) {
                mfrCatalogVendorName = mfrCatalogVendorName.toUpperCase();
            }

            resultMappingTable[mfrCatalogVendorName] = {
                'internalid': netsuiteVendorInternalId,
                'prefix': mfrPrefix,
                'suffix': mfrSuffix,
                'exclude_create': excludeItemCreation
            };

            return true;
        });

        return resultMappingTable;
    }


    function updateOneItemRecord(itemInternalId, configRecord, manufacturerMappingTable, customerTemplate, catalogItem) {
        //Initialize field mapping objects
        var fieldMapping = customerTemplate['field_mapping'];

        var existingItemRecord = record.load({
            type: 'inventoryitem',
            id: itemInternalId,
            isDynamic: true
        });

        existingItemRecord.setValue({ fieldId: 'offersupport', value: true });
        existingItemRecord.setValue({ fieldId: 'usebins', value: true });
        existingItemRecord.setValue({ fieldId: 'custitem_zastro_special_order', value: true });
        

        try{
        existingItemRecord.setValue({ fieldId: 'custitem_la_sku', value: catalogItem.id });
        }
        catch(e){
            log.error('e on setting la item rec on ns item rec',e)
        }

        //Set primary identifier
        var sku = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_number' });

        var mappedNetsuiteVendor;
        var lightsAmericaVendorName = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_name' });
        lightsAmericaVendorName = lightsAmericaVendorName.toUpperCase();

        if (lightsAmericaVendorName && manufacturerMappingTable.hasOwnProperty(lightsAmericaVendorName)) {
            mappedNetsuiteVendor = manufacturerMappingTable[lightsAmericaVendorName];
            var skuPrefix = mappedNetsuiteVendor['prefix'];
            if (skuPrefix) {
                sku = skuPrefix + sku;
            }
        }

        //Do not set for now. Can cause problems
        //existingItemRecord.setValue({fieldId: 'itemid', value: sku});

        //Set field mappings
        var lightsMappingFieldNames = Object.keys(fieldMapping);
        for (var i = 0; i < lightsMappingFieldNames.length; i++) {
            var fieldName = lightsMappingFieldNames[i];
            var fieldId = fieldMapping[fieldName];
            log.debug('fieldName', fieldName)
            log.debug('fieldId', fieldId)
            if (!fieldId) {
                continue;
            }

            //Do not update salesdescription
            if (fieldName == 'custrecord_lights_description') {
                continue;
            }



            var fieldValue = catalogItem.getValue({ fieldId: fieldName });
            log.debug('fieldValue', fieldValue)
            if (!fieldValue) {
                continue;
            }


            if (fieldName == 'custrecord_lights_bulbs_included' && fieldValue == 'Yes') {
                log.debug('setting bulbs', fieldValue)
                existingItemRecord.setValue({
                    fieldId: 'custitem_la_bulbs_included',
                    value: true
                });
            }
            else {

                existingItemRecord.setValue({
                    fieldId: fieldMapping[fieldName],
                    value: fieldValue
                });
            }
        }

        // Check if custitem_la_active is changing from 'Yes' to 'No' and set inactive date
        var newActiveValue = catalogItem.getValue({ fieldId: 'custrecord_lights_active' });
        if (newActiveValue) {
            var currentActiveValue = existingItemRecord.getValue({ fieldId: 'custitem_la_active' });
            log.debug('Active Status Check', 'Current: ' + currentActiveValue + ', New: ' + newActiveValue);

            if (currentActiveValue === 'Yes' && newActiveValue === 'No') {
                log.debug('Setting Inactive Date', 'Item changed from active to inactive');
                existingItemRecord.setValue({
                    fieldId: 'custitem_la_inactivedate',
                    value: new Date()
                });
            }
        }

        //Always update item price
        existingItemRecord = setItemPrice(false, existingItemRecord, catalogItem);

        var doNotUpdateFieldName = configRecord.getValue({ fieldId: 'custrecord_zastro_lights_do_not_update' });
        var doNotChangePrice = existingItemRecord.getValue({ fieldId: doNotUpdateFieldName });

        var vendorLineCount = existingItemRecord.getLineCount({
            sublistId: 'itemvendor'
        });

        if (mappedNetsuiteVendor && vendorLineCount > 0) {
            //New item set preferred vendor
            if (!doNotChangePrice) {
                existingItemRecord = updateExistingVendorPrice(catalogItem, existingItemRecord, mappedNetsuiteVendor);
            }
        }

        else if (mappedNetsuiteVendor) {
            var subsidiaryId = configRecord.getValue({ fieldId: 'custrecord_zastro_lights_subsidiary_id' });
            existingItemRecord = setNewItemVendor(catalogItem, existingItemRecord, mappedNetsuiteVendor, subsidiaryId);
        }

        existingItemRecord.setValue({
            fieldId: 'custitem_zastro_la_updated_at',
            value: new Date()
        });

        try {
            existingItemRecord.save({ ignoreMandatoryFields: true });
            return itemInternalId;
        }

        catch (err) {
            log.error('ERROR_UPDATING_ITEM');
            log.error(err.name, err.message);
            return itemInternalId;
        }
    }


    function setItemPrice(newItem, itemRecord, catalogItem) {
        var regularPrice = catalogItem.getValue({ fieldId: 'custrecord_lights_regular_price' });
        var existingPrice;

        var multiCurrency = runtime.isFeatureInEffect({
            feature: 'MULTICURRENCY'
        });
        log.debug('multiCurrency', multiCurrency)
        if (multiCurrency === true) {
            itemRecord.selectLine({
                sublistId: 'price1',
                line: 0
            });

            itemRecord.setCurrentSublistValue({
                sublistId: 'price1',
                fieldId: 'pricelevel',
                value: 1
            });

            if (!newItem) {
                existingPrice = itemRecord.getCurrentSublistValue({
                    sublistId: 'price1',
                    fieldId: 'price_1_',
                });
            }

            itemRecord.setCurrentSublistValue({
                sublistId: 'price1',
                fieldId: 'price_1_',
                value: regularPrice
            });

            itemRecord.commitLine({
                sublistId: 'price1'
            });
        }

        else {
            itemRecord.selectLine({
                sublistId: 'price',
                line: 0
            });
            itemRecord.setCurrentSublistValue({
                sublistId: 'price',
                fieldId: 'pricelevel',
                value: 1
            });

            if (!newItem) {
                existingPrice = itemRecord.getCurrentSublistValue({
                    sublistId: 'price',
                    fieldId: 'price_1_',
                });
            }

            itemRecord.setCurrentSublistValue({
                sublistId: 'price',
                fieldId: 'price_1_',
                value: regularPrice
            });
            itemRecord.commitLine({
                sublistId: 'price'
            });
        }

        if (newItem) {
            itemRecord.setValue({
                fieldId: 'custitem_la_price_changed_date',
                value: new Date()
            });
        }

        else {
            if (Number(existingPrice) != Number(regularPrice)) {
                itemRecord.setValue({
                    fieldId: 'custitem_la_price_changed_date',
                    value: new Date()
                });
            }
        }

        return itemRecord;
    }


    function setNewItemVendor(catalogItem, newItemRecord, mappedNetsuiteVendor, subsidiaryId) {
        //Process the vendor sublist. Add manufacturer as preferred vendor
        //Initialize empty variable for Netsuite Vendor ID
        var cost = catalogItem.getValue({ fieldId: 'custrecord_lights_cost' });
        var netsuiteVendorInternalId = mappedNetsuiteVendor['internalid'];

        newItemRecord.selectNewLine({
            sublistId: 'itemvendor',
        });

        newItemRecord.setCurrentSublistValue({
            sublistId: 'itemvendor',
            fieldId: 'vendor',
            value: netsuiteVendorInternalId
        });

        if (subsidiaryId) {
            newItemRecord.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'subsidiary',
                value: subsidiaryId
            });
        }

        newItemRecord.setCurrentSublistValue({
            sublistId: 'itemvendor',
            fieldId: 'purchaseprice',
            value: cost
        });

        newItemRecord.setCurrentSublistValue({
            sublistId: 'itemvendor',
            fieldId: 'preferredvendor',
            value: true
        });

        newItemRecord.commitLine({
            sublistId: 'itemvendor'
        });

        return newItemRecord;
    }


    function updateExistingVendorPrice(catalogItem, itemRecord, mappedNetsuiteVendor) {
        //Process the vendor sublist. Add manufacturer as preferred vendor
        //Initialize empty variable for Netsuite Vendor ID
        var cost = catalogItem.getValue({ fieldId: 'custrecord_lights_cost' });
        var netsuiteVendorInternalId = mappedNetsuiteVendor['internalid'];

        itemRecord.selectLine({
            sublistId: 'itemvendor',
            line: 0 //Likely to fail
        });

        itemRecord.setCurrentSublistValue({
            sublistId: 'itemvendor',
            fieldId: 'purchaseprice',
            value: cost
        });

        itemRecord.commitLine({
            sublistId: 'itemvendor'
        });

        return itemRecord;
    }


    function mergeOneItemRecord(configRecord, manufacturerMappingTable, customerTemplate, catalogItem, virtualCatalog) {
        log.debug('CALLING_MERGE_PRODUCT_FUNCTION');
        var sku = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_number' });
        var uniqueId = catalogItem.getValue({ fieldId: 'custrecord_lights_unique_id' });
        var externalId = 'zastro_la_' + uniqueId;

        var mappedNetsuiteVendor;
        var lightsAmericaVendorName = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_name' });
        lightsAmericaVendorName = lightsAmericaVendorName.toUpperCase();

        if (lightsAmericaVendorName && manufacturerMappingTable.hasOwnProperty(lightsAmericaVendorName)) {
            mappedNetsuiteVendor = manufacturerMappingTable[lightsAmericaVendorName];
        }

        var foundExistingItemId;
        //Step 1: Clear out the items that have incorrect external id
        findAndClearNeededExternalId(externalId);

        //Step 2: Identify the Netsuite product in the catalog using a legacy sku search (with no prefix or suffix)
        foundExistingItemId = findItemBySkuOnly(sku, mappedNetsuiteVendor['internalid']);

        if (foundExistingItemId) {
            return updateOneItemRecord(foundExistingItemId, configRecord, manufacturerMappingTable, customerTemplate, catalogItem);
        }

        else {
            return createOneItemRecord(configRecord, manufacturerMappingTable, customerTemplate, catalogItem, virtualCatalog);
        }

    }


    function createOneItemRecord(configRecord, manufacturerMappingTable, customerTemplate, catalogItem, virtualCatalog) {
        var sku = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_number' });
        var displayNameSku = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_number' });
        var uniqueId = catalogItem.getValue({ fieldId: 'custrecord_lights_unique_id' });
        var externalId = 'zastro_la_' + uniqueId;

        var mappedNetsuiteVendor;
        var lightsAmericaVendorName = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_name' });
        lightsAmericaVendorName = lightsAmericaVendorName.toUpperCase();

        if (lightsAmericaVendorName && manufacturerMappingTable.hasOwnProperty(lightsAmericaVendorName)) {
            mappedNetsuiteVendor = manufacturerMappingTable[lightsAmericaVendorName];
            var skuPrefix = mappedNetsuiteVendor['prefix'];
            var skuSuffix = mappedNetsuiteVendor['suffix'];
            var excludeCreate = mappedNetsuiteVendor['exclude_create'];

            if (excludeCreate && !virtualCatalog) {
                log.error('ITEM_CONFIG_EXCLUDED', 'This item is excluded by configuration');
                return false;
            }

            if (skuPrefix) {
                sku = skuPrefix + sku;
            }

            if (skuSuffix) {
                sku = sku + skuSuffix;
            }
        }

        //Initialize field mapping objects
        var fieldMapping = customerTemplate['field_mapping'];
        var defaults = customerTemplate['defaults'];

        //Initialize new Netsuite item
        var newItemRecord = record.create({
            type: 'inventoryitem',
            isDynamic: true
        });

        //Set Subsidiary if configured. Not all accounts will have one world installed
        //  var subsidiaryId = configRecord.getValue({fieldId: 'custrecord_zastro_lights_subsidiary_id'});
        var subsidiaryId = 2
        // if (subsidiaryId) {
        newItemRecord.setValue({
            fieldId: 'subsidiary',
            value: subsidiaryId
        });
        // }
        newItemRecord.setValue({
            fieldId: 'includechildren',
            value: true
        });

        //Set primary identifier
        newItemRecord.setValue({ fieldId: 'itemid', value: sku });
        newItemRecord.setValue({ fieldId: 'displayname', value: displayNameSku });
        newItemRecord.setValue({ fieldId: 'externalid', value: externalId });
        newItemRecord.setValue({ fieldId: 'offersupport', value: true });
        newItemRecord.setValue({ fieldId: 'usebins', value: true });
        newItemRecord.setValue({ fieldId: 'custitem_zastro_special_order', value: true });
        try{
            newItemRecord.setValue({ fieldId: 'custitem_la_sku', value: catalogItem.id });
        }
        catch(e){
            log.error('error setting sku on item link',e)
        }
        

        //Set item defaults before field mappings
        var lightsDefaultMappingFieldNames = Object.keys(defaults);
        for (var i = 0; i < lightsDefaultMappingFieldNames.length; i++) {
            var fieldName = lightsDefaultMappingFieldNames[i];
            var fieldValue = defaults[fieldName];

            newItemRecord.setValue({
                fieldId: fieldName,
                value: fieldValue
            });
        }

        //Set field mappings
        var lightsMappingFieldNames = Object.keys(fieldMapping);
        for (var i = 0; i < lightsMappingFieldNames.length; i++) {
            var fieldName = lightsMappingFieldNames[i];
            var fieldId = fieldMapping[fieldName];
            if (!fieldId) {
                continue;
            }

            var fieldValue = catalogItem.getValue({ fieldId: fieldName });
            if (!fieldValue) {
                continue;
            }


            if (fieldName == 'custrecord_lights_bulbs_included' && fieldValue == 'Yes') {
                log.debug('setting bulbs', fieldValue)
                newItemRecord.setValue({
                    fieldId: 'custitem_la_bulbs_included',
                    value: true
                });
            }
            else {

                newItemRecord.setValue({
                    fieldId: fieldMapping[fieldName],
                    value: fieldValue
                });
            }


            // newItemRecord.setValue({
            //     fieldId: fieldMapping[fieldName],
            //     value: fieldValue
            // });
        }

        if (mappedNetsuiteVendor) {
            //New item set preferred vendor
            newItemRecord = setNewItemVendor(catalogItem, newItemRecord, mappedNetsuiteVendor, subsidiaryId);
        }

        newItemRecord = setItemPrice(true, newItemRecord, catalogItem);

        newItemRecord.setValue({
            fieldId: 'custitem_zastro_la_updated_at',
            value: new Date()
        });

        try {
            //var newItemId = newItemRecord.save();
            var newItemId = newItemRecord.save({ ignoreMandatoryFields: true });
            return newItemId;
        }

        catch (err) {
            log.error('ERROR_CREATING_ITEM', sku);
            log.error(err.name, err.message);
            if (err.name == 'DUP_ITEM') {
                var itemInternalId = getExistingItemId(sku, uniqueId, mappedNetsuiteVendor, externalId);
                log.debug('EXISTING_ITEM_ID', itemInternalId);
                if (itemInternalId) {
                    if (virtualCatalog) {
                        return itemInternalId;
                    }

                    else {
                        return updateOneItemRecord(itemInternalId, configRecord, manufacturerMappingTable, customerTemplate, catalogItem);
                    }
                }

                else {
                    return false;
                }
            }

            else {
                return false;
            }
        }
    }


    function getLightsConfig() {
        var configSearch = search.create({
            type: "customrecord_zastro_lights_file_config",
            filters:
                [
                    ["isinactive", "isnot", 'T']
                ],
            columns:
                [
                    search.createColumn({
                        name: "internalid",
                    })
                ]
        });

        var internalId = '';
        configSearch.run().each(function (result) {
            internalId = result.getValue({
                name: 'internalid',
            });

            return false;
        });

        var configRecord = record.load({
            type: 'customrecord_zastro_lights_file_config',
            id: internalId
        });

        return configRecord;
    }


    function findAndClearNeededExternalId(externalid) {
        log.debug('FIND_CLEAR_EXTERNALID', externalid);
        var itemSearchObj = search.create({
            type: "item",
            filters:
                [
                    ["externalid", "is", externalid],
                ],
            columns:
                [
                    search.createColumn({ name: "internalid" })
                ]
        });

        itemSearchObj.run().each(function (result) {
            var itemInternalId = result.getValue({ name: 'internalid' });
            log.debug('FOUND_ITEM_USING_EXTERNALID', itemInternalId);
            var item = record.load({ 'type': 'inventoryitem', id: itemInternalId, isDynamic: true });
            item.setValue({ fieldId: 'externalid', value: externalid + '_old' });
            item.save();
            return false;
        });
    }


    function findAndClearNeededUniqueId(uniqueId) {
        var itemSearchObj = search.create({
            type: "item",
            filters:
                [
                    ["externalid", "is", externalid],
                ],
            columns:
                [
                    search.createColumn({ name: "internalid" })
                ]
        });

        itemSearchObj.run().each(function (result) {
            var itemInternalId = result.getValue({ name: 'internalid' });
            var item = record.load({ 'type': 'inventoryitem', id: itemInternalId, isDynamic: true });
            item.setValue({ fieldId: 'externalid', value: externalid + '_old' });
            item.save();
            return false;
        });
    }


    function findItemBySkuOnly(itemId, mappedNetsuiteVendor) {
        var itemInternalId;

        var itemSearchObj = search.create({
            type: "item",
            filters:
                [
                    ["itemid", "is", itemId]
                ],
            columns:
                [
                    search.createColumn({ name: "internalid" }),
                    search.createColumn({ name: "vendor" })
                ]
        });

        itemSearchObj.run().each(function (result) {
            var itemResultId = result.getValue({ name: 'internalid' });
            log.debug('FOUND_ITEM_USING_SKU', itemResultId);
            var preferredVendor = result.getValue({ name: 'vendor' });
            log.debug('CHECKING_IF_VENDOR_MATCHES', preferredVendor);
            if (mappedNetsuiteVendor == preferredVendor) {
                itemInternalId = itemResultId;
                log.debug('VENDOR_DOES_MATCH');
                return false;
            }

            else {
                log.debug('VENDOR_DID_NOT_MATCH');
            }

            return true;
        });

        return itemInternalId;
    }


    function findItemByMfrSku(catalogItem, manufacturerMappingTable) {
        log.debug('in findItemByMfrSku - catalogItem ', catalogItem)
        log.debug('in findItemByMfrSku - manufacturerMappingTable', manufacturerMappingTable)
        var sku = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_number' });
        log.debug('sku', sku)

        var displayNameSku = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_number' });
        var uniqueId = catalogItem.getValue({ fieldId: 'custrecord_lights_unique_id' });
        log.debug('uniqueId', uniqueId)

        var externalId = 'zastro_la_' + uniqueId;

        var mappedNetsuiteVendor;
        var lightsAmericaVendorName = catalogItem.getValue({ fieldId: 'custrecord_lights_mfr_name' });
        log.debug('lightsAmericaVendorName', lightsAmericaVendorName)

        lightsAmericaVendorName = lightsAmericaVendorName.toUpperCase();


        if (lightsAmericaVendorName && manufacturerMappingTable.hasOwnProperty(lightsAmericaVendorName)) {
            //checks whether mapping table has a key that matches that vendor name
            mappedNetsuiteVendor = manufacturerMappingTable[lightsAmericaVendorName];
            var skuPrefix = mappedNetsuiteVendor['prefix'];
            var skuSuffix = mappedNetsuiteVendor['suffix'];

            if (skuPrefix) {
                sku = skuPrefix + sku;
            }

            if (skuSuffix) {
                sku = sku + skuSuffix;
            }
        }

        else {
            log.error('COULD_NOT_MAP_VENDOR', 'A vendor match could not be found.');
        }

        var itemInternalId;

        var itemSearchObj = search.create({
            type: "item",
            filters:
                [
                    ["name", "is", sku]
                ],
            columns:
                [
                    search.createColumn({ name: "internalid" }),
                    search.createColumn({ name: "vendor" })
                ]
        });

        itemSearchObj.run().each(function (result) {
            var itemResultId = result.getValue({ name: 'internalid' });
            log.debug('FOUND_ITEM_USING_SKU', itemResultId);
            var preferredVendor = result.getValue({ name: 'vendor' });
            log.debug('CHECKING_IF_VENDOR_MATCHES', preferredVendor);
            if (mappedNetsuiteVendor['internalid'] == preferredVendor) {
                itemInternalId = itemResultId;
                log.debug('VENDOR_DOES_MATCH');
                return false;
            }

            else {
                log.debug('VENDOR_DID_NOT_MATCH');
            }

            return true;
        });

        return itemInternalId;
    }


    function getExistingItemId(itemId, uniqueId, mappedNetsuiteVendor, externalId) {
        //This function is called when a DUP_ITEM exception is thrown by Netsuite.
        //Try to find the item
        var itemInternalId;
        //It is unlikely this search would work unless a problem is being self corrected
        var itemSearchObj = search.create({
            type: "item",
            filters:
                [
                    ["custitem_la_unique_id", "is", uniqueId],
                    "OR",
                    ["custitem_la_unique_id", "is", uniqueId + '.0']
                ],
            columns:
                [
                    search.createColumn({ name: "internalid" })
                ]
        });

        itemSearchObj.run().each(function (result) {
            itemInternalId = result.getValue({ name: 'internalid' });
            return false;
        });

        if (itemInternalId) {
            return itemInternalId;
        }

        //This would like get called when the customer has a product existing before the integration
        var itemSearchObj = search.create({
            type: "item",
            filters:
                [
                    ["itemid", "is", itemId]
                ],
            columns:
                [
                    search.createColumn({ name: "internalid" }),
                    search.createColumn({ name: "vendor" })
                ]
        });

        itemSearchObj.run().each(function (result) {
            var itemResultId = result.getValue({ name: 'internalid' });
            var preferredVendor = result.getValue({ name: 'vendor' });
            if (mappedNetsuiteVendor == preferredVendor) {
                itemInternalId = itemResultId;
                return false;
            }

            return true;
        });

        return itemInternalId;
    }

    return {
        getStoredManufacturerMapingTable: getStoredManufacturerMapingTable,
        updateOneItemRecord: updateOneItemRecord,
        createOneItemRecord: createOneItemRecord,
        mergeOneItemRecord: mergeOneItemRecord,
        findItemBySkuOnly: findItemBySkuOnly,
        findItemByMfrSku: findItemByMfrSku,
        getLightsConfig: getLightsConfig
    };

});