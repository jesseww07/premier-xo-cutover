/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/format', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/util', 'N/file'],
    /**
     * @param {format} format
     * @param {log} log
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {task} task
     * @param {util} util
     * @param {file} file
     */
    function (format, log, record, runtime, search, task, util, file) {

        function getInputData() {

            var mySearch = search.load({
                id: 'customsearch972'
            })
            return mySearch
        }

        function map(context) {
            try {
                log.debug('context', context)
                let result = JSON.parse(context.value);
                log.debug('result', result)
                let recId = result.id
                log.debug('recId', recId)
                var itemObj = loadRec(recId)
                log.debug('item object to update item rec', itemObj)
                var updated = createItem(itemObj,recId)

            }


            catch (e) {
                log.error('COULD NOT COMPLETE MAPPING', e)
            }

        }

        const loadRec = (recId) => {
            let loadedRecord = record.load({
                type: 'customrecord_zastro_la_data_dump',
                id: recId,
                isDynamic: true
            })

            let desc = loadedRecord.getValue({
                fieldId: 'custrecord_zas_description',
            })
            let regPrice = loadedRecord.getValue({
                fieldId: 'custrecord_zas_regular_price',
            })
            let listPrice = loadedRecord.getValue({
                fieldId: 'custrecord_zas_list_price',
            })
            let cost = loadedRecord.getValue({
                fieldId: 'custrecord_zas_cost',
            })
            let image = loadedRecord.getValue({
                fieldId: 'custrecord_zas_image',
            })
            let link = loadedRecord.getValue({
                fieldId: 'custrecord_zas_product_url',
            })
            let height = loadedRecord.getValue({
                fieldId: 'custrecord_zas_height',
            })
            let weight = loadedRecord.getValue({
                fieldId: 'custrecord_zas_weight',
            })
            let extension = loadedRecord.getValue({
                fieldId: 'custrecord_zas_extension',
            })
            let length = loadedRecord.getValue({
                fieldId: 'custrecord_zas_length',
            })
            let bulbType = loadedRecord.getValue({
                fieldId: 'custrecord_zas_bulb_type',
            })
            let buldIncluded = loadedRecord.getValue({
                fieldId: 'custrecord_zas_bulbs_included',
            })
            let bulbBase = loadedRecord.getValue({
                fieldId: 'custrecord_zas_bulb_base',
            })
            let upc = loadedRecord.getValue({
                fieldId: 'custrecord_zas_upc',
            })
            let bulbNum = loadedRecord.getValue({
                fieldId: 'custrecord_zas_number_of_bulbs',
            })
            let watts = loadedRecord.getValue({
                fieldId: 'custrecord_zas_max_wattage',
            })
            let uniqueId = loadedRecord.getValue({
                fieldId: 'custrecord_zas_unique_id',
            })
            let width = loadedRecord.getValue({
                fieldId: 'custrecord_zas_width__diameter',
            })
            let price = loadedRecord.getValue({
                fieldId: 'custrecord_zas_regular_price',
            })
            let name = loadedRecord.getValue({
                fieldId: 'custrecord_zas_manufacturer_number',
            })
            let vendor = loadedRecord.getValue({
                fieldId: 'custrecord_zas_manufacturer_name',
            })



            itemObj = new Object()
            itemObj.desc = desc
            itemObj.regPrice = regPrice
            itemObj.listPrice = listPrice
            itemObj.cost = cost
            itemObj.image = image
            itemObj.link = link
            itemObj.height = height
            itemObj.weight = weight
            itemObj.extension = extension
            itemObj.length = length
            itemObj.bulbType = bulbType
            itemObj.bulbBase = bulbBase
            itemObj.upc = upc
            itemObj.bulbNum = bulbNum
            itemObj.watts = watts
            itemObj.uniqueId = uniqueId
            itemObj.width = width
            itemObj.price = price
            itemObj.name = name
            itemObj.desc = desc
            itemObj.vendor = vendor

            return itemObj
        }

        const createItem = (obj, recId) => {
            try {
                var invItem = record.create({
                    type: 'inventoryitem',
                    isDynamic: true
                });

                invItem.setValue({
                    fieldId: 'itemid',
                    value: obj.name
                })
                invItem.setValue({
                    fieldId: 'purchasedescription',
                    value: obj.desc
                })
                invItem.setValue({
                    fieldId: 'salesdescription',
                    value: obj.desc
                })
                invItem.setValue({
                    fieldId: 'description',
                    value: obj.desc
                })
                var selectLine = invItem.selectLine({
                    sublistId: 'price1',
                    line: 0
                });
                invItem.setCurrentSublistValue({
                    sublistId: 'price1',
                    fieldId: 'price_1_',
                    value: obj.price
                });
                invItem.commitLine({
                    sublistId: 'price1'
                })

                invItem.setValue({
                    fieldId: 'upccode',
                    value: obj.upc
                })
                invItem.setValue({
                    fieldId: 'custitem_la_height',
                    value: obj.height
                })
                invItem.setValue({
                    fieldId: 'custitem_la_length',
                    value: obj.length
                })
                invItem.setValue({
                    fieldId: 'custitem_la_weight_grams',
                    value: obj.weight
                })
                invItem.setValue({
                    fieldId: 'custitem_la_extension',
                    value: obj.extension
                })
                invItem.setValue({
                    fieldId: 'custitem_la_max_wattage',
                    value: obj.watts
                })
                invItem.setValue({
                    fieldId: 'custitem_la_bulb_base',
                    value: obj.bulbBase
                })
                invItem.setValue({
                    fieldId: 'custitem_la_bulb_type',
                    value: obj.bulbType
                })
                invItem.setValue({
                    fieldId: 'custitem_la_number_of_bulbs',
                    value: obj.bulbNum
                })

                invItem.setValue({
                    fieldId: 'custitem_la_image',
                    value: obj.image
                })

                invItem.setValue({
                    fieldId: 'cost',
                    value: obj.cost
                })
                invItem.setValue({
                    fieldId: 'transferprice',
                    value: obj.cost
                })

                var savedItem = requiredCreateField(invItem, obj, recId)
                log.debug('savedItem', savedItem)

            }
            catch (e) {
                log.debug('e', e)
            }
        }

        const requiredCreateField = (invItem, payload, recId) => {
            invItem.setValue({
                fieldId: 'taxschedule',
                value: 1
            })
            invItem.setValue({
                fieldId: 'includechildren',
                value: true
            })
            invItem.setValue({
                fieldId: 'custitem_zastro_special_order',
                value: true
            })
            invItem.setValue({
                fieldId: 'usebins',
                value: true
            })
            invItem.setValue({
                fieldId: 'autoleadtime',
                value: false
            })
            invItem.setValue({
                fieldId: 'autopreferredstocklevel',
                value: false
            })
            invItem.setValue({
                fieldId: 'autoreorderpoint',
                value: false
            })
            invItem.setValue({
                fieldId: 'unitstype',
                value: 1
            })
            invItem.setValue({
                fieldId: 'costestimatetype',
                value: 'PURCHPRICE'
            })
            var manufacturerName = payload.vendor
            var vendorID = retrieveVendorID(manufacturerName)
            //log.debug('vendorID', vendorID)
            if (vendorID != 'none') {
                var priceUpdated = updateVendorPrice(invItem, payload, vendorID)
            }
            try {
                var savedItem = invItem.save({ ignoreMandatoryFields: true })
                log.debug('savedItem', savedItem)
              
                record.submitFields({
                    type: 'customrecord_zastro_la_data_dump',
                    id: recId,
                    values: {
                        'custrecord_zastro_linked_item': savedItem
                    }
                });
                return savedItem
            }
            catch (e) {
                log.debug('e on item save NEW', e)
                return ''
            }

        }

        const updateVendorPrice = (invItem, parsedKey, vendor) => {
            var itemRate = parsedKey.cost
            var lineNum = invItem.selectNewLine({
                sublistId: 'itemvendor'
            });
            invItem.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'vendor',
                value: vendor
            })
            invItem.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'preferredvendor',
                value: true
            })
            invItem.setCurrentSublistValue({
                sublistId: 'itemvendor',
                fieldId: 'purchaseprice',
                value: itemRate
            })
            invItem.commitLine({
                sublistId: 'itemvendor'
            })
            return 'Done'
        }

        const retrieveVendorID = (manufacturerNo) => {
            var vendorID = ''
            var vendorSearchObj = search.create({
                type: "vendor",
                filters:
                    [
                        ["entityid", "is", manufacturerNo]
                    ],
                columns:
                    [
                        "internalid"
                    ]
            });
            var searchResultCount = vendorSearchObj.runPaged().count;
            log.debug("vendorSearchObj result count", searchResultCount);
            vendorSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var vendorInternalID = result.getValue({
                    name: 'internalid'
                })
                vendorID = vendorInternalID
                return true;
            });
            if (vendorID) {
                return vendorID
            }
            else {
                var customrecord_manufacturer_mappingSearchObj = search.create({
                    type: "customrecord_manufacturer_mapping",
                    filters:
                        [
                            ["custrecord_lights_america_name", "startswith", manufacturerNo]
                        ],
                    columns:
                        [
                            "custrecord_zastro_mm_vendor"
                        ]
                });
                var searchResultCount = customrecord_manufacturer_mappingSearchObj.runPaged().count;
                log.debug("customrecord_manufacturer_mappingSearchObj result count", searchResultCount);
                customrecord_manufacturer_mappingSearchObj.run().each(function (result) {
                    // .run().each has a limit of 4,000 results
                    var vendorInternalID = result.getValue({
                        name: 'custrecord_zastro_mm_vendor'
                    })
                    vendorID = vendorInternalID
                    return true;
                });
                if (vendorID) {
                    return vendorID
                }
                else {
                    log.error('WE HAVE NO VENDOR ID FOR THIS', manufacturerNo)
                    return 'none'
                }
            }

        }


        return {
            getInputData: getInputData,
            map: map,
            //reduce: reduce,
            //        summarize: summarize
        };

    });


