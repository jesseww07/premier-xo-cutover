/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
 define([
        'N/record',
        'N/search',
        'N/log',
        'N/error',
        'N/runtime',
        'SuiteScripts/LightsAmericaIntegration/Templates/customer_wishlist_mapping_pace.js',
        'SuiteScripts/LightsAmericaIntegration/Model/item.js',
        'SuiteScripts/LightsAmericaIntegration/lights_america_wishlist_restlet.js',
    ],
    function (record, search, log, error, runtime, customerTemplate, itemModel, restletModel) {


function execute() {
    //Scan for any new imported objects
    //Check each line item and verify the line item exists
    //If not, create the item and mark it processed
    //Eventually search for items will return none and sale can be created

    //@model customrecord_zastro_lights_wishlist_cfg
    var configRecord = getLightsWishlistConfig();
    //var customerFieldMapping = customerTemplate.getCustomItemFieldMapping();
    var manufacturerMappingTable = itemModel.getStoredManufacturerMapingTable();

    var scriptObj = runtime.getCurrentScript();
    //For each quote/order
    var parentObjects = findParentObjects(configRecord);
    for (var i = 0; i < parentObjects.length; i++){
        var parentObject = parentObjects[i];
        var parentId = parentObject['parent_id'];
        log.debug('PARENT_ID', parentId);

        //Find line items
        var childObjects = findChildObjects(configRecord, parentId);
        for (var ci = 0; ci < childObjects.length; ci++){
            if (scriptObj.getRemainingUsage() < 120) {
                log.debug('CANCEL_CHILD_CREATION', 'Get Remaining Usage too low');
                return;
            }

            var childObject = childObjects[ci];
            log.debug('CHILD_OBJECT', childObject);
            var childId = childObject['child_id'];
            var netsuiteItemId = childObject['netsuite_item_id'];
            if (netsuiteItemId) {
                continue;
            }

            var mappedNetsuiteVendor;
            var configuredSku;
            //Manufacturer code used to do lookup
            var manufacturerNumber = childObject['itemid'];
            configuredSku = manufacturerNumber;

            var manufacturerName = childObject['custitem_manufacturer_name'];

            manufacturerName = manufacturerName.toUpperCase();

            if (manufacturerName && manufacturerMappingTable.hasOwnProperty(manufacturerName)) {
                mappedNetsuiteVendor = manufacturerMappingTable[manufacturerName];
                var skuPrefix = mappedNetsuiteVendor['prefix'];
                var skuSuffix = mappedNetsuiteVendor['suffix'];
    
                if (skuPrefix) {
                    configuredSku = skuPrefix + configuredSku;
                }
    
                if (skuSuffix) {
                    configuredSku = configuredSku + skuSuffix;
                }
            }

            childObjects[ci]['placeholder_item'] = false;
            var placeholderItem = false;

            var configPlaceholderId = configRecord.getValue({
                fieldId: 'custrecord_zastro_lights_prod_fallback'
            });

            var productMissingAction = configRecord.getValue({
                fieldId: 'custrecord_zastro_lights_prod_action'
            });

            //Check if the item exists
            var itemId = findProduct(configuredSku);
            if (!itemId) {
                if (productMissingAction == 1) {
                    itemId = createItem(childObject);
                    log.debug('ITEM_CREATED', itemId);
                }

                else if (productMissingAction == '2') {
                    itemId = configPlaceholderId;
                    childObjects[ci]['placeholder_item'] = true;
                    placeholderItem = true;
                    log.debug('ITEM_PLACEHOLDER_USED', itemId);
                }

                else {
                    log.debug('MISSING_CONFIG_ACTION', 'Missing Product Missing Config');
                    //TODO: something
                }

            }

            childObjects[ci]['netsuite_item_id'] = itemId;

            //Set this item is processed
            record.submitFields({
                type: 'customrecord_child_api_object',
                id: childId,
                values: {
                    custrecord_netsuite_item_id: itemId,
                    custrecord_is_placeholder_item: placeholderItem
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields : true
                }
            });

            log.debug('SET_CHILD_ITEM_ID', 'Item ID is set');
        }

        if (scriptObj.getRemainingUsage() < 100) {
            log.debug('CANCEL_SALE_CREATION', 'Get Remaining Usage too low');
            return;
        }

        log.debug('CREATING_WISHLIST', '');
        saleId = createSalesOrder(configRecord, parentObject, childObjects);
        log.debug('CREATED_WISHLIST_ID', saleId);

        record.submitFields({
            type: 'customrecord_parent_api_object',
            id: parentId,
            values: {
                custrecord_sale: saleId,
                custrecord_zastro_lights_created_wl: true
            },
            options: {
                enableSourcing: false,
                ignoreMandatoryFields : true
            }
        });

    }
}


function setItemPrice(itemRecord, itemPrice) {
    var multiCurrency = runtime.isFeatureInEffect({
        feature: 'MULTICURRENCY'
    });

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
            value: itemPrice
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

        itemRecord.setCurrentSublistValue({
            sublistId: 'price',
            fieldId: 'price_1_',
            value: itemPrice
        });
        itemRecord.commitLine({
            sublistId: 'price'
        });
    }

    return itemRecord;
}


//TODO: Merge product create from wishlist into main product
function createItem(object) {
    log.debug('CREATING_ITEM');
    var item = record.create({
        type: 'inventoryitem',
        isDynamic: true
    });

    var keys = Object.keys(object);
    for (var i = 0; i < keys.length; i++){
        var key = keys[i];
        item.setValue({
            fieldId: key,
            value: object[key]
        });

        //TODO: Check for pricing system config
        if (key == 'custitem_list_price') {
            item = setItemPrice(item, object[key]);
        }

        if (key == 'custitem_manufacturer_name') {
            var vendorId = findVendorId(object[key]);
            if (!vendorId) {
                vendorId = findVendorMappingId(object[key]);
            }

            if (vendorId) {
                item.setValue({
                    fieldId: 'vendor',
                    value: vendorId
                });
            }
        }
    }

    var itemId = item.save({ignoreMandatoryFields : true});
    return itemId;

}


function createSalesOrder(configRecord, parentObject, childObjects) {
    log.debug('CREATING_WISHLIST_VALS', parentObject);
    if (parentObject['transaction_type'] == 'wishlist') {
        var transactionType = 'estimate';
    }

    else {
        var transactionType = 'salesorder';
    }

    var customFormId = configRecord.getValue({
        fieldId: 'custrecord_zastro_lights_custom_form'
    });

    var subsidiaryId = configRecord.getValue({
        fieldId: 'custrecord_zastro_lights_la_sub_id'
    });

    var sale = record.create({
        type: transactionType,
        isDynamic: true
    });

    if (customFormId) {
        //Progressive: 178
        //Lee Lighting: 191
        sale.setValue({
            fieldId: 'customform',
            value: customFormId
        });
    }

    sale.setValue({
        fieldId: 'entity',
        value: parentObject['customer_id']
    });

    if (subsidiaryId) {
        sale.setValue({
            fieldId: 'subsidiary',
            value: subsidiaryId
        });
    }

    var defaultLocationId = configRecord.getValue({
        fieldId: 'custrecord_la_default_location'
    });

    if (defaultLocationId) {
        sale.setValue({
            fieldId: 'location',
            value: defaultLocationId
        });
    }

    sale.setValue({
        fieldId: 'memo',
        value: parentObject['wishlist_name']
    });

    //Set Sales Rep
    var salesRepId = parentObject['salesperson_link'];
    if (salesRepId) {
        sale.setValue({fieldId: 'salesrep', value: salesRepId});
    }

    var fromAddr1 = configRecord.getValue({
        fieldId: 'custrecord_la_default_address_1'
    });
    var fromCity = configRecord.getValue({
        fieldId: 'custrecord_la_default_city'
    });
    var fromState = configRecord.getValue({
        fieldId: 'custrecord_la_default_state'
    });
    var fromZip = configRecord.getValue({
        fieldId: 'custrecord_la_default_zip'
    });
    var fromCountry = configRecord.getValue({
        fieldId: 'custrecord_la_default_country_code'
    });

    var shippingAddress = sale.getValue({
        fieldId: 'shipzip'
    });

    if (!shippingAddress) {
        var subRecord = sale.getSubrecord({
            fieldId: 'shippingaddress'
        }).setValue({
            fieldId: 'country',
            value: fromCountry
        }).setValue({
            fieldId: 'city',
            value: fromCity
        }).setValue({
            fieldId: 'state',
            value: fromState
        }).setValue({
            fieldId: 'zip',
            value: fromZip
        }).setValue({
            fieldId: 'addr1',
            value : fromAddr1
        });
    }

    //Initialize line fields
    var lineHouseFieldId = configRecord.getValue({
        fieldId: 'custrecord_zastro_lights_house_field'
    });

    var lineNoteFieldId = configRecord.getValue({
        fieldId: 'custrecord_zastro_lights_note_line_field'
    });

    var useCustomPricelevel = configRecord.getValue({
        fieldId: 'custrecord_zastro_lights_use_pricelevel'
    });

    for (var i = 0; i < childObjects.length; i++){
        var line = childObjects[i];

        var isPlaceholderItem = line['placeholder_item'];

        sale.selectNewLine({
            sublistId: 'item',
        });

        sale.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: line['netsuite_item_id']
        });

        sale.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: line['quantity']
        });

        if (useCustomPricelevel && !isPlaceholderItem) {
            sale.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'price',
                value: -1
            });
            
            sale.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: line['selling_price']
            });    
        }

        if (isPlaceholderItem) {
            //Set description for placeholder
            let productName = line['purchasedescription'];
            let mfrNumber = line['custitem_manufacturer_number'];
            let itemDescription = '[' + mfrNumber + '] ' + productName;
            sale.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'description',
                value: itemDescription
            });

            sale.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'price',
                value: -1
            });
            
            sale.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: line['selling_price']
            });   
        }

        if (lineNoteFieldId && line['sale_line_notes']) {
            sale.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: lineNoteFieldId,
                value: line['sale_line_notes']
            });
        }

        if (lineHouseFieldId && line['line_location']) {
            sale.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: lineHouseFieldId,
                value: line['line_location']
            });
        }

        sale.commitLine({sublistId: 'item'});
    }

    log.debug('BEFORE_SAVE_SALE', '');
    var saleId = sale.save({
        enableSourcing: true,
        ignoreMandatoryFields: true
    });
    log.debug('SAVED_SALE_ID', saleId);
    return saleId;
}


function findOrder(tranid) {
    var saleSearch = search.create({
        type: "salesorder",
        filters:
        [
            ["tranid", "is", tranid]
        ],
        columns:
        [
            search.createColumn({
                name: "internalid",
            })
        ]
    });

    var internalId;

    saleSearch.run().each(function(result){
        internalId = result.getValue({
            name: 'internalid',
        });

        return false;
    });

    return internalId;
}


function findProduct(manufacturerNumber) {
    log.debug('Product Search');
    var productSearch = search.create({
        type: "item",
        filters:
        [
            ["name", "is", manufacturerNumber]
        ],
        columns:
        [
            search.createColumn({
                name: "internalid",
            })
        ]
    });

    var internalId;

    productSearch.run().each(function(result){
        internalId = result.getValue({
            name: 'internalid',
        });

        return false;
    });

    return internalId;
}


function findParentObjects(configRecord) {
    log.debug('FINDING_PARENT_OBJECTS', 'Finding Parent Objects');

    var scriptObj = runtime.getCurrentScript();
    var parentObjectSearch = search.create({
        type: "customrecord_parent_api_object",
        filters:
        [
            ["custrecord_sale", "anyof", ["@NONE@"]],
            'AND',
            ['isinactive', 'is', false],
            'AND',
            ['custrecord_zastro_lights_created_wl', 'is', false]
        ],
        columns:
        [
            search.createColumn({
                name: "internalid",
            }),
            search.createColumn({
                name: "custrecord_firstname",
            }),
            search.createColumn({
                name: "custrecord_lastname",
            }),
            search.createColumn({
                name: "custrecord_email",
            }),
            search.createColumn({
                name: "custrecord_salesperson",
            }),
            search.createColumn({
                name: "custrecord_zastro_lights_sp_link",
            }),
            search.createColumn({
                name: "custrecord_store_location",
            }),
            search.createColumn({
                name: "custrecord_comment",
            }),
            search.createColumn({
                name: "custrecord_wishlist_name",
            }),
            search.createColumn({
                name: "custrecord_transaction_type",
            }),
            search.createColumn({
                name: "custrecord_customer_id",
            }),
            search.createColumn({
                name: "custrecord_shipping_city",
            }),
            search.createColumn({
                name: "custrecord_shipping_state",
            }),
            search.createColumn({
                name: "custrecord_shipping_zip",
            }),
            search.createColumn({
                name: "custrecord_shipping_address",
            }),
            search.createColumn({
                name: "custrecord_billing_address",
            }),
            search.createColumn({
                name: "custrecord_billing_city",
            }),
            search.createColumn({
                name: "custrecord_billing_state",
            }),
            search.createColumn({
                name: "custrecord_billing_zip",
            })
        ]
    });

    var res = [];

    parentObjectSearch.run().each(function(result){
        if (scriptObj.getRemainingUsage() < 120) {
            log.debug('PARENT_LIST_TOO_MANY_CREATE', 'Get Remaining Usage too low');
            return [];
        }

        var dict = {
            'parent_id': result.getValue({name: 'internalid'}),
            'firstname': result.getValue({name: 'custrecord_firstname'}),
            'lastname': result.getValue({name: 'custrecord_lastname'}),
            'email': result.getValue({name: 'custrecord_email'}),
            'salesperson': result.getValue({name: 'custrecord_salesperson'}),
            'salesperson_link': result.getValue({name: 'custrecord_zastro_lights_sp_link'}),
            'store_location': result.getValue({name: 'custrecord_store_location'}),
            'comment': result.getValue({name: 'custrecord_comment'}),
            'phone': result.getValue({name: 'custrecord_phone'}),
            'wishlist_name': result.getValue({name: 'custrecord_wishlist_name'}),
            'transaction_type': result.getValue({name: 'custrecord_transaction_type'}),
            'customer_id': result.getValue({name: 'custrecord_customer_id'}),
            'shipping_city': result.getValue({name: 'custrecord_shipping_city'}),
            'shipping_state': result.getValue({name: 'custrecord_shipping_state'}),
            'shipping_zip': result.getValue({name: 'custrecord_shipping_zip'}),
            'shipping_address': result.getValue({name: 'custrecord_shipping_address'}),
            'billing_address': result.getValue({name: 'custrecord_billing_address'}),
            'billing_city': result.getValue({name: 'custrecord_billing_city'}),
            'billing_state': result.getValue({name: 'custrecord_billing_state'}),
            'billing_zip': result.getValue({name: 'custrecord_billing_zip'}),
        }

        log.debug('BUILDING_DATA_FOR_PARENT', dict);

        var updateValues = {};

        if (!dict['customer_id']) {
            log.debug('PARENT_NO_CUSTOMER_ID', '');

            let newCustomerId;
            let customerCreateObject;
            customerCreateObject = {
                'First Name': dict['firstname'],
                'Last Name': dict['lastname'],
                'Billing Address': dict['billing_address'],
                'Billing City': dict['billing_city'],
                'Billing State': dict['billing_state'],
                'Billing Zip': dict['billing_zip'],
                'Phone': dict['phone'],
                'Email': dict['email']
            };

            log.debug('GET_OR_CREATE_CUSTOMER', '');
            newCustomerId = restletModel.getOrCreateCustomer(configRecord, customerCreateObject);
            if (!newCustomerId) {
                log.debug('COULD_NOT_GET_OR_CREATE_CUSTOMER_ID', customerCreateObject);
                return true;
            }

            updateValues['custrecord_customer_id'] = newCustomerId;

            dict['customer_id'] = newCustomerId;
        }

        if (!dict['salesperson_link'] && dict['salesperson']) {
            var salesPerson = dict['salesperson'];
            log.debug('PARENT_SALESPERSON', salesPerson);

            var salesPersonId = null;
            if (salesPerson && salesPerson != 'undefined') {
                salesPersonId = findSalespersonId(salesPerson);
                log.debug('SALESPERSON_ID', salesPersonId);

                if (salesPersonId) {
                    updateValues['custrecord_zastro_lights_sp_link'] = salesPersonId;
                    dict['salesperson_link'] = salesPersonId;
                }
            }
        }

        if (Object.keys(updateValues).length > 0) {
            record.submitFields({
                type: 'customrecord_parent_api_object',
                id: dict['parent_id'],
                values: updateValues,
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields : true
                }
            });
        }

        res.push(dict);
        return true;
    });

    return res;
}


function findChildObjects(configRecord, parentId) {
    log.debug('PARENT_ID', parentId);
    var wishlistItems = [];
    var itemIds = [];
    var wishlistItemSearch = search.create({
        type: "customrecord_child_api_object",
        filters:
            [
                ["custrecord_parent_object", "is", parentId]
            ],
        columns:
            [
                "custrecord_manufacturer_name",
                "custrecord_cost_2",
                "custrecord_wishlist_import_quantity",
                "custrecord_voltage",
                "custrecord_product_name",
                "custrecord_manufacturer_number",
                "custrecord_selling_price",
                "custrecord_price",
                "custrecord_product_url",
                "custrecord_netsuite_item_id",
                "custrecord_notes",
                "custrecord_room_location",
                "custrecord_collection",
                "custrecord_length",
                "custrecord_width",
                "custrecord_height",
                "custrecord_zwe_bulbs_included",
                "custrecord_number_bulbs",
                "custrecord_max_wattage",
                "custrecord_bulb_base",
                "custrecord_light_source",
                "custrecord_color_temperature",
                "custrecord_cri",
                "custrecord_fan_airflow",
                "custrecord_blade_qty",
                "custrecord_light_kit",
                "custrecord_is_placeholder_item",
                "internalid",
            ]
    });

    wishlistItemSearch.run().each(function (result) {
        var wishlistItem = {
            'custitem_manufacturer_name': result.getValue({name: 'custrecord_manufacturer_name'}),
            'cost': result.getValue({name: 'custrecord_cost_2'}),
            'custitem_voltage': result.getValue({name: 'custrecord_voltage'}),
            'salesdescription': result.getValue({name: 'custrecord_product_name'}),
            'itemid': result.getValue({name: 'custrecord_manufacturer_number'}),
            'selling_price': result.getValue({name: 'custrecord_selling_price'}),
            'custitem_list_price': result.getValue({name: 'custrecord_price'}),
            'custitem_product_url': result.getValue({name: 'custrecord_product_url'}),
            'quantity': result.getValue({name: 'custrecord_wishlist_import_quantity'}),
            'netsuite_item_id': result.getValue({name: 'custrecord_netsuite_item_id'}),
            'sale_line_notes': result.getValue({name: 'custrecord_notes'}),
            'line_location': result.getValue({name: 'custrecord_room_location'}),
            'custitem_collection': result.getValue({name: 'custrecord_collection'}),
            'custitem_length': result.getValue({name: 'custrecord_length'}),
            'custitem_width': result.getValue({name: 'custrecord_width'}),
            'custitem_height': result.getValue({name: 'custrecord_height'}),
            'custitem_bulbs_included': result.getValue({name: 'custrecord_zwe_bulbs_included'}),
            'custitem_number_of_bulbs':result.getValue({name: 'custrecord_number_bulbs'}),
            'custitem_max_wattage': result.getValue({name: 'custrecord_max_wattage'}),
            'custitem_bulb_base': result.getValue({name: 'custrecord_bulb_base'}),
            'custitem_light_source': result.getValue({name: 'custrecord_light_source'}),
            'custitem_color_temperature': result.getValue({name: 'custrecord_color_temperature'}),
            'custitem_cri': result.getValue({name: 'custrecord_cri'}),
            'custitem_fan_airflow': result.getValue({name: 'custrecord_fan_airflow'}),
            'custitem_blade_qty': result.getValue({name: 'custrecord_blade_qty'}),
            'custitem_light_kit': result.getValue({name: 'custrecord_light_kit'}),
            'child_id': result.getValue({name: 'internalid'}),
            'purchasedescription': result.getValue({name: 'custrecord_product_name'}),
            'placeholder_item': result.getValue({name: 'custrecord_is_placeholder_item'})
        }

        wishlistItems.push(wishlistItem);

        var netsuiteItemId = result.getValue({name: 'custrecord_netsuite_item_id'});
        if (netsuiteItemId) {
            itemIds.push(netsuiteItemId);
        }

        return true;
    });

    var activateInactiveItemsConfig = configRecord.getValue({
        fieldId: 'custrecord_zastro_lights_activate_items'
    });

    if (itemIds.length > 0 && activateInactiveItemsConfig) {
        findAndResetInactiveItems(itemIds);
    }

    return wishlistItems;
}


function findAndResetInactiveItems(netsuiteIds) {
    var itemSearch = search.create({
        type: "item",
        filters:
            [
                ["internalid", "anyof", netsuiteIds],
                'AND',
                ["isinactive", "is", true]
            ],
        columns:
            [
                "internalid"
            ]
    });

    itemSearch.run().each(function (result) {
        itemId = result.getValue({name: 'internalid'});
        var item = record.load({type: 'inventoryitem', id: itemId});
        item.setValue({fieldId: 'isinactive', value: false});
        item.save();

        return true;
    });

    return true;
}


function findVendorMappingId(vendorName) {
    var vendorId;
    var vendorSearch = search.create({
        type: "vendor",
        filters:
            [
                ["custrecord_lights_america_name", "is", vendorName]
            ],
        columns:
            [
                "internalid"
            ]
    });

    vendorSearch.run().each(function (result) {
        vendorId = result.getValue({name: 'internalid'});
        return false;
    });

    return vendorId;
}


function findSalespersonId(salesPerson) {
    log.debug('FINDING_SALESPERSON', salesPerson);
    var salesPersonId;

    var salesPersonSearch = search.create({
        type: "employee",
        filters:
            [
                ["entityid", "is", salesPerson],
                'AND',
                ["supportrep", "is", true],
            ],
        columns:
            [
                "internalid"
            ]
    });

    salesPersonSearch.run().each(function (result) {
        salesPersonId = result.getValue({name: 'internalid'});
        return false;
    });

    return salesPersonId;
}


function findVendorId(vendorName) {
    var resultVendorId;
    var vendorSearch = search.create({
        type: "vendor",
        filters:
            [
                ["entityid", "is", vendorName]
            ],
        columns:
            [
                "internalid"
            ]
    });

    vendorSearch.run().each(function (result) {
        resultVendorId = result.getValue({name: 'internalid'});
        return false;
    });

    return resultVendorId;
}


function getLightsWishlistConfig() {
    var configSearch = search.create({
        type: "customrecord_zastro_lights_wishlist_cfg",
        filters:
        [
            ["isinactive","isnot", 'T']
        ],
        columns:
        [
            search.createColumn({
                name: "internalid",
            })
        ]
    });

    var internalId = '';
    configSearch.run().each(function(result){
        internalId = result.getValue({
            name: 'internalid',
        });

        return false;
    });

    var configRecord = record.load({
        type: 'customrecord_zastro_lights_wishlist_cfg',
        id: internalId
    });

    return configRecord;
}


return {
    execute: execute,
};
}
);