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
            var scriptObj = runtime.getCurrentScript();
            //log.debug('Deployment Id: ' + scriptObj.deploymentId);
            if (scriptObj.deploymentId == 'customdeploy1') {
                var mySearch = search.load({
                    id: 'customsearch421'
                })
            }
            // else if (scriptObj.deploymentId == 'customdeploy2') {
            //     var mySearch = search.load({
            //         id: 'customsearch422'
            //     })
            // }

            return mySearch
        }

        function map(context) {
            try {
                let result = JSON.parse(context.value);
                // let soId = result.id
                //log.debug('result', result)
                let lightAmerItemFile = idParser(result, 'internalid.file')
                //log.debug('lightAmerItemFile', lightAmerItemFile)

                var fileObj = file.load({
                    id: lightAmerItemFile
                });
                var fileContents = fileObj.getContents();
                //log.debug('fileContents', fileContents);
                //return

                var delimiter = ",";
                var dataArray = CSVToArray(fileContents, delimiter);
                //log.debug('dataArray', dataArray)

                if (dataArray.length > 0) {
                    for (var xx = 1; xx < dataArray.length; xx++) {
                        var dataDisplay = dataArray[xx]
                        var dataDisplayString = dataDisplay.toString();
                        var dataDisplaySplit = dataDisplayString.split(',');
                        //log.debug('line', dataDisplaySplit)
                        //log.debug('line.len', dataDisplaySplit.length)


                        // var sku = dataDisplaySplit[0]
                        // var manufacturer_name = dataDisplaySplit[1]
                        // var manufacturer_number = dataDisplaySplit[2]
                        // var upc = dataDisplaySplit[3]
                        // var cost = dataDisplaySplit[4]
                        // var price = dataDisplaySplit[5]
                        // var list_price = dataDisplaySplit[6]
                        // var product_name = dataDisplaySplit[7]
                        // var collection = dataDisplaySplit[8]
                        // var designer = dataDisplaySplit[9]
                        // var manufacturer_finish = dataDisplaySplit[10]
                        // var manufacturer_glass = dataDisplaySplit[11]
                        // var crystal = dataDisplaySplit[12]
                        // var notes = dataDisplaySplit[13]
                        // var width = dataDisplaySplit[14]
                        // var height = dataDisplaySplit[15]
                        // var length = dataDisplaySplit[16]
                        // var weight = dataDisplaySplit[17]
                        // var extension = dataDisplaySplit[18]
                        // var chain = dataDisplaySplit[19]
                        // var wire = dataDisplaySplit[20]
                        // var bulbs_included = dataDisplaySplit[21]
                        // var number_of_bulbs = dataDisplaySplit[22]
                        // var max_wattage = dataDisplaySplit[23]
                        // var bulb_type = dataDisplaySplit[24]
                        // var bulb_base = dataDisplaySplit[25]
                        // var light_source = dataDisplaySplit[26]
                        // var light_output = dataDisplaySplit[27]
                        // var color_temperature = dataDisplaySplit[28]
                        // var cri = dataDisplaySplit[29]
                        // var dimmable = dataDisplaySplit[30]
                        // var beam_spread = dataDisplaySplit[31]
                        // var rated_average_life = dataDisplaySplit[32]
                        // var voltage = dataDisplaySplit[33]
                        // var fan_airflow = dataDisplaySplit[34]
                        // var fan_electricity_use = dataDisplaySplit[35]
                        // var airflow_efficiency = dataDisplaySplit[36]
                        // var blade_pitch = dataDisplaySplit[37]
                        // var blade_span = dataDisplaySplit[38]
                        // var blade_type = dataDisplaySplit[39]
                        // var blade_finish = dataDisplaySplit[40]
                        // var blade_qty = dataDisplaySplit[41]
                        // var reverse_air = dataDisplaySplit[42]
                        // var fan_speeds = dataDisplaySplit[43]
                        // var light_kit = dataDisplaySplit[44]
                        // var fan_control = dataDisplaySplit[45]
                        // var fan_downrod = dataDisplaySplit[46]
                        // var product_url = dataDisplaySplit[47]
                        // var material = dataDisplaySplit[48]
                        // var country_of_origin = dataDisplaySplit[49]
                        // var safety_listing = dataDisplaySplit[50]
                        // var safety_rating = dataDisplaySplit[51]
                        // var energy_star = dataDisplaySplit[52]
                        // var ada = dataDisplaySplit[53]
                        // var dark_sky = dataDisplaySplit[54]
                        // var manufacturer_warranty = dataDisplaySplit[55]
                        // var intro_date = dataDisplaySplit[56]
                        // var spec_sheet = dataDisplaySplit[57]
                        // var instructions = dataDisplaySplit[58]
                        // var parts_diagram = dataDisplaySplit[59]
                        // var image = dataDisplaySplit[60]
                        // var shipped_via = dataDisplaySplit[61]
                        // var drop_ship = dataDisplaySplit[62]
                        // var carton_volume = dataDisplaySplit[63]
                        // var dimensional_weight = dataDisplaySplit[64]
                        // var active = dataDisplaySplit[65]

                        var sku = dataDisplaySplit[0]
var manufacturer_name = dataDisplaySplit[1]
var manufacturer_number = dataDisplaySplit[2]
var upc = dataDisplaySplit[3]
var cost = dataDisplaySplit[4]
var price = dataDisplaySplit[5]
var list_price = dataDisplaySplit[6]
var product_name = dataDisplaySplit[7]
var description = dataDisplaySplit[8]
var collection = dataDisplaySplit[9]
var designer = dataDisplaySplit[10]
var manufacturer_finish = dataDisplaySplit[11]
var manufacturer_glass = dataDisplaySplit[12]
var crystal = dataDisplaySplit[13]
var notes = dataDisplaySplit[14]
var width = dataDisplaySplit[15]
var height = dataDisplaySplit[16]
var length = dataDisplaySplit[17]
var weight = dataDisplaySplit[18]
var extension = dataDisplaySplit[19]
var chain = dataDisplaySplit[20]
var wire = dataDisplaySplit[21]
var bulbs_included = dataDisplaySplit[22]
var number_of_bulbs = dataDisplaySplit[23]
var max_wattage = dataDisplaySplit[24]
var bulb_type = dataDisplaySplit[25]
var bulb_base = dataDisplaySplit[26]
var light_source = dataDisplaySplit[27]
var light_output = dataDisplaySplit[28]
var color_temperature = dataDisplaySplit[29]
var cri = dataDisplaySplit[30]
var dimmable = dataDisplaySplit[31]
var beam_spread = dataDisplaySplit[32]
var rated_average_life = dataDisplaySplit[33]
var voltage = dataDisplaySplit[34]
var fan_airflow = dataDisplaySplit[35]
var fan_electricity_use = dataDisplaySplit[36]
var airflow_efficiency = dataDisplaySplit[37]
var blade_pitch = dataDisplaySplit[38]
var blade_span = dataDisplaySplit[39]
var blade_type = dataDisplaySplit[40]
var blade_finish = dataDisplaySplit[41]
var blade_qty = dataDisplaySplit[42]
var reverse_air = dataDisplaySplit[43]
var fan_speeds = dataDisplaySplit[44]
var light_kit = dataDisplaySplit[45]
var fan_control = dataDisplaySplit[46]
var fan_downrod = dataDisplaySplit[47]
var product_url = dataDisplaySplit[48]
//log.debug('product_url',product_url)
var material = dataDisplaySplit[49]
var country_of_origin = dataDisplaySplit[50]
var safety_listing = dataDisplaySplit[51]
var safety_rating = dataDisplaySplit[52]
var energy_star = dataDisplaySplit[53]
var ada = dataDisplaySplit[54]
var dark_sky = dataDisplaySplit[55]
var manufacturer_warranty = dataDisplaySplit[56]
var intro_date = dataDisplaySplit[57]
var spec_sheet = dataDisplaySplit[58]
var instructions = dataDisplaySplit[59]
var parts_diagram = dataDisplaySplit[60]
var image = dataDisplaySplit[61]
var shipped_via = dataDisplaySplit[62]
var drop_ship = dataDisplaySplit[63]
var carton_volume = dataDisplaySplit[64]
var dimensional_weight = dataDisplaySplit[65]
var active = dataDisplaySplit[66]
var uniqueID = dataDisplaySplit[67]

                        var inputObject = new Object()
                        inputObject.sku = sku
                        inputObject.manufacturer_name = manufacturer_name
                        inputObject.manufacturer_number = manufacturer_number
                        inputObject.upc = upc
                        inputObject.cost = cost
                        inputObject.price = price
                        inputObject.list_price = list_price
                        inputObject.product_name = product_name
                        inputObject.description = description
                        inputObject.collection = collection
                        inputObject.designer = designer
                        inputObject.manufacturer_finish = manufacturer_finish
                        inputObject.manufacturer_glass = manufacturer_glass
                        inputObject.crystal = crystal
                        inputObject.notes = notes
                        inputObject.width = width
                        inputObject.height = height
                        inputObject.length = length
                        inputObject.weight = weight
                        inputObject.extension = extension
                        inputObject.chain = chain
                        inputObject.wire = wire
                        inputObject.bulbs_included = bulbs_included
                        inputObject.number_of_bulbs = number_of_bulbs
                        inputObject.max_wattage = max_wattage
                        inputObject.bulb_type = bulb_type
                        inputObject.bulb_base = bulb_base
                        inputObject.light_source = light_source
                        inputObject.light_output = light_output
                        inputObject.color_temperature = color_temperature
                        inputObject.cri = cri
                        inputObject.dimmable = dimmable
                        inputObject.beam_spread = beam_spread
                        inputObject.rated_average_life = rated_average_life
                        inputObject.voltage = voltage
                        inputObject.fan_airflow = fan_airflow
                        inputObject.fan_electricity_use = fan_electricity_use
                        inputObject.airflow_efficiency = airflow_efficiency
                        inputObject.blade_pitch = blade_pitch
                        inputObject.blade_span = blade_span
                        inputObject.blade_type = blade_type
                        inputObject.blade_finish = blade_finish
                        inputObject.blade_qty = blade_qty
                        inputObject.reverse_air = reverse_air
                        inputObject.fan_speeds = fan_speeds
                        inputObject.light_kit = light_kit
                        inputObject.fan_control = fan_control
                        inputObject.fan_downrod = fan_downrod
                        inputObject.product_url = product_url
                        inputObject.material = material
                        inputObject.country_of_origin = country_of_origin
                        inputObject.safety_listing = safety_listing
                        inputObject.safety_rating = safety_rating
                        inputObject.energy_star = energy_star
                        inputObject.ada = ada
                        inputObject.dark_sky = dark_sky
                        inputObject.manufacturer_warranty = manufacturer_warranty
                        inputObject.intro_date = intro_date
                        inputObject.spec_sheet = spec_sheet
                        inputObject.instructions = instructions
                        inputObject.parts_diagram = parts_diagram
                        inputObject.image = image
                        inputObject.shipped_via = shipped_via
                        inputObject.drop_ship = drop_ship
                        inputObject.carton_volume = carton_volume
                        inputObject.dimensional_weight = dimensional_weight
                        inputObject.active = active
                        inputObject.uniqueID = uniqueID

                        //log.debug('inputObject', inputObject)
                        //log.debug('inputObject2', inputObject2)

                        // var objArray = new Array()
                        // objArray.push(inputObject)
                        // objArray.push(inputObject2)
                        var scriptObj = runtime.getCurrentScript();
                        //log.debug('Deployment Id: ' + scriptObj.deploymentId);
                        if (scriptObj.deploymentId == 'customdeploy1') {
                            context.write(inputObject)
                        }
                        else if (scriptObj.deploymentId == 'customdeploy2') {
                            context.write(inputObject2)
                        }
                    }
                    //return
                    var scriptObj = runtime.getCurrentScript();
                    //log.debug('Deployment Id: ' + scriptObj.deploymentId);
                    if (scriptObj.deploymentId == 'customdeploy1') {
                        fileObj.folder = 392;
                        var fileId = fileObj.save();
                        //log.error('fileId - deploy 1', fileId)
                    }
                    // else if (scriptObj.deploymentId == 'customdeploy2') {
                    //     fileObj.folder = 392;
                    //     var fileId = fileObj.save();
                    //     log.error('fileId - deploy 2', fileId)
                    // }
                }

            }
            catch (e) {
                log.error('COULD NOT COMPLETE MAPPING', e)
            }

        }

        function reduce(context) {
            //log.debug('context', context)
            var getKey = context.key
            var parsedKey = JSON.parse(getKey)

            //log.debug('parsedKey', parsedKey)

            var uniqueID = parsedKey.uniqueID
            //log.debug('uniqueID', uniqueID)
            var returnedItemID = findItemInternal(uniqueID)
            //log.debug('returnedItemID', returnedItemID)
            if (returnedItemID) {
                //log.debug('off to run edit')
                var type = 'edit'
                runEdit(parsedKey, returnedItemID, type)
            }
            else {
                if (parsedKey.active == 'Yes') {
                    //log.debug('off to run create')
                    var type = 'create'
                    runEdit(parsedKey, returnedItemID, type)
                }
                else {
                    //log.debug('parsedKey.active', parsedKey.active)
                }
            }
            return
        }

        const findItemInternal = (objName) => {
            try {
                log.debug('objName', objName)
                var returnedID = ''
                var itemSearchObj = search.create({
                    type: "item",
                    filters:
                        [
                            ["custitem_la_unique_id", "is", objName]
                        ],
                    columns:
                        [
                            "internalid"
                        ]
                });
                var searchResultCount = itemSearchObj.runPaged().count;
                //log.debug("itemSearchObj result count", searchResultCount);
                itemSearchObj.run().each(function (result) {
                    // .run().each has a limit of 4,000 results
                    var itemInternalID = result.getValue({
                        name: 'internalid'
                    })
                    returnedID = itemInternalID
                    return true;
                });
                return returnedID
            }
            catch (e) {
                log.debug('e in find ID', e)
            }
        }

        const runEdit = (parsedKey, returnedItemID, type) => {
            try {
                //log.debug('type', type)
                if (type == 'edit') {
                    var invItem = record.load({
                        type: 'inventoryitem',
                        id: returnedItemID,
                        isDynamic: true
                    });
                }
                else if (type == 'create') {
                    var invItem = record.create({
                        type: 'inventoryitem',
                        isDynamic: true
                    });
                }
                else {
                    return
                }
                var scriptObj = runtime.getCurrentScript();
                //log.debug('Deployment Id: ' + scriptObj.deploymentId);
                if (scriptObj.deploymentId == 'customdeploy1') {
                    //log.debug('parsedKey', parsedKey)
                    var getInternalIDKey = internalIDKey()
                    //log.debug('getInternalIDKey', getInternalIDKey)
                    var getValueKey = valueIDKey()
                    //log.debug('getValueKey', getValueKey)
                }
                else if (scriptObj.deploymentId == 'customdeploy2') {
                    //log.debug('parsedKey', parsedKey)
                    var getInternalIDKey = internalIDKey2()
                    //log.debug('getInternalIDKey', getInternalIDKey)
                    var getValueKey = valueIDKey2()
                    //log.debug('getValueKey', getValueKey)
                }
                for (var x = 0; x < getInternalIDKey.length; x++) {
                    //log.debug('getInternalIDKey[x]', getInternalIDKey[x])
                    var keyValue = getValueKey[x]

                    var valueDrop = parsedKey[`${keyValue}`]
                    //log.debug('valueDrop', valueDrop)

                    if (valueDrop == 'Yes') {
                        valueDrop = true
                    }
                    else if (valueDrop == 'No') {
                        valueDrop = false
                    }
                    if (keyValue == 'manufacturer_number') {
                        invItem.setValue({
                            fieldId: 'itemid',
                            value: valueDrop
                        })
                    }
                    else if (keyValue == 'description') {
                        //log.debug('we are in', valueDrop)
                        invItem.setValue({
                            fieldId: 'purchasedescription',
                            value: valueDrop
                        })
                        invItem.setValue({
                            fieldId: 'salesdescription',
                            value: valueDrop
                        })
                        invItem.setValue({
                            fieldId: 'description',
                            value: valueDrop
                        })
                    }
                    else if (keyValue == 'active') {
                        if(valueDrop == true){
                            valueDrop = false
                        }
                        else{
                            valueDrop = true
                        }
                        invItem.setValue({
                            fieldId: 'isinactive',
                            value: valueDrop
                        })
                    }
                    else if (keyValue == 'price') {
                        var selectLine = invItem.selectLine({
                            sublistId: 'price1',
                            line: 0
                        });
                        invItem.setCurrentSublistValue({
                            sublistId: 'price1',
                            fieldId: 'price_1_',
                            value: valueDrop
                        });
                        invItem.commitLine({
                            sublistId: 'price1'
                        })
                    }
                    else if (getInternalIDKey[x] == 'custitem_la_bulbs_included') {
                        //log.debug('getInternalIDKey[x]', getInternalIDKey[x])
                        //log.debug('valueDrop', valueDrop)
                    }
                    else {
                        invItem.setValue({
                            fieldId: getInternalIDKey[x],
                            value: valueDrop
                        })
                    }
                    if (parsedKey.active == 'No') {
                        var today = new Date()
                        invItem.setValue({
                            fieldId: 'custitem_la_inactive_date_stamp',
                            value: today
                        })
                    }
                }
                if (type == 'edit') {
                    var manufacturerName = parsedKey.manufacturer_name
                    var vendorID = retrieveVendorID(manufacturerName)
                    //log.debug('vendorID', vendorID)
                    if (vendorID != 'none') {
                        var priceUpdated = updateVendorPrice(invItem, parsedKey, vendorID)
                    }
                    try{
                        var savedItem = invItem.save()
                        log.audit('savedItem - EDIT', savedItem)
                    }
                    catch(e){
                        log.debug('e on item save', e)
                    }
       
                }
                else {
                    var savedItem = requiredCreateField(invItem, parsedKey)
                    log.audit('savedItem - CREATE', savedItem)
                }


            }
            catch (e) {
                log.debug('e', e)
            }
        }

        const requiredCreateField = (invItem, parsedKey) => {
            // invItem.setValue({
            //     fieldId: 'itemid',
            //     value: parsedKey.manufacturerNumber
            // })
            //need vendor
            //need sell
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
            // invItem.setValue({
            //     fieldId: 'incomeaccount',
            //     value: 54
            // })
            // invItem.setValue({
            //     fieldId: 'cogsaccount',
            //     value: 212
            // })
            // invItem.setValue({
            //     fieldId: 'assetaccount',
            //     value: 211
            // })
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
            var manufacturerName = parsedKey.manufacturer_name
            var vendorID = retrieveVendorID(manufacturerName)
            //log.debug('vendorID', vendorID)
            if (vendorID != 'none') {
                var priceUpdated = updateVendorPrice(invItem, parsedKey, vendorID)
            }
            try{
                var savedItem = invItem.save()
                log.debug('savedItem', savedItem)
                return savedItem
            }
            catch(e){
                log.debug('e on item save NEW ', e)
                return ''
            }
      
        }

        const updateVendorPrice = (invItem, parsedKey, vendor) => {
            var itemRate = parsedKey.cost
            var count = invItem.getLineCount({
                sublistId: 'itemvendor'
               });
               //log.debug('itemvendor', count)
               if(count > 0){
                //log.debug('in over zero', parsedKey)
                var lineNum = invItem.selectLine({
                    sublistId: 'itemvendor',
                    line: 0
                   });
                // invItem.setCurrentSublistValue({
                //     sublistId: 'itemvendor',
                //     fieldId: 'vendor',
                //     value: vendor
                // })
                // invItem.setCurrentSublistValue({
                //     sublistId: 'itemvendor',
                //     fieldId: 'preferredvendor',
                //     value: true
                // })
                invItem.setCurrentSublistValue({
                    sublistId: 'itemvendor',
                    fieldId: 'purchaseprice',
                    value: itemRate
                })
                invItem.commitLine({
                    sublistId: 'itemvendor'
                })
               }
               else{
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
               }
            
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
            //log.debug("vendorSearchObj result count", searchResultCount);
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
                //log.debug("customrecord_manufacturer_mappingSearchObj result count", searchResultCount);
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
                    //log.error('WE HAVE NO VENDOR ID FOR THIS', manufacturerNo)
                    return 'none'
                }
            }

        }

        const CSVToArray = (strData, strDelimiter) => {
            strDelimiter = (strDelimiter || `",`);
            var objPattern = new RegExp(
                (
                    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
                    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
                    "([^\"\\" + strDelimiter + "\\r\\n]*))"
                ),
                "gi"
            );
            var arrData = [[]];
            var arrMatches = null;
            while (arrMatches = objPattern.exec(strData)) {
                var strMatchedDelimiter = arrMatches[1];
                if (
                    strMatchedDelimiter.length &&
                    (strMatchedDelimiter != strDelimiter)
                ) {
                    arrData.push([]);
                }
                if (arrMatches[2]) {
                    var strMatchedValue = arrMatches[2].replace(
                        new RegExp("\"\"", "g"),
                        "\""
                    );
                } else {
                    var strMatchedValue = arrMatches[3];
                }
                arrData[arrData.length - 1].push(strMatchedValue);
            }
            return (arrData);
        }

        const idParser = (result, startPoint) => {

            let newResult = JSON.stringify(result)
            let n = newResult.search(startPoint)
            let subResult = newResult.substring(n, newResult.length)
            //log.debug('subresult', subResult)
            var id = idScanner(subResult)
            return id
        }

        const idScanner = (subResult) => {
            let hitNumber = false
            let idMaker = new Array()
            for (let i = 0; i < subResult.length; i++) {
                if (subResult[i] == '0' || subResult[i] == '1' || subResult[i] == '2' || subResult[i] == '3' || subResult[i] == '4' ||
                    subResult[i] == '5' || subResult[i] == '6' || subResult[i] == '7' || subResult[i] == '8' || subResult[i] == '9') {
                    idMaker.push(subResult[i])
                    if (!hitNumber) {
                        hitNumber = true
                    }
                }
                else {
                    if (hitNumber) {
                        break
                    }
                    continue
                }
            }
            let parsedId = Number(idMaker.join(''))
            //log.debug('parsedId', parsedId)
            return parsedId
        }

        const valueIDKey = () => {
            var valueArray = [
                'sku',
                'manufacturer_name',
                'manufacturer_number',
                'upc',
                'cost',
                'price',
                'list_price',
                'product_name',
                'description',
                'collection',
                'designer',
                'manufacturer_finish',
                'manufacturer_glass',
                'crystal',
                'notes',
                'width',
                'height',
                'length',
                'weight',
                'extension',
                'chain',
                'wire',
                'bulbs_included',
                'number_of_bulbs',
                'max_wattage',
                'bulb_type',
                'bulb_base',
                'light_source',
                'light_output',
                'color_temperature',
                'cri',
                'dimmable',
                'beam_spread',
                'rated_average_life',
                'voltage',
                'fan_airflow',
                'fan_electricity_use',
                'airflow_efficiency',
                'blade_pitch',
                'blade_span',
                'blade_type',
                'blade_finish',
                'blade_qty',
                'reverse_air',
                'fan_speeds',
                'light_kit',
                'fan_control',
                'fan_downrod',
                'product_url',
                'material',
                'country_of_origin',
                'safety_listing',
                'safety_rating',
                'energy_star',
                'ada',
                'dark_sky',
                'manufacturer_warranty',
                'intro_date',
                'spec_sheet',
                'instructions',
                'parts_diagram',
                'image',
                'shipped_via',
                'drop_ship',
                'carton_volume',
                'dimensional_weight',
                'active',
                'uniqueID' 
            ]
            return valueArray
        }



        const internalIDKey = () => {
            var keyArray = [
                'custitem_la_sku',
                'custitem_la_manufacturer_name',
                'custitem_la_manufacturer_number',
                'custitem_la_upc',
                'custitem_la_cost',
                'custitem_la_price',
                'custitem_la_list_price',
                'custitem_la_product_name',
                'description',
                'custitem_la_collection',
                'custitem_la_designer',
                'custitem_la_manufacturer_finish',
                'custitem_la_manufacturer_glass',
                'custitem_la_crystal',
                'custitem_la_notes',
                'custitem_la_width_/_diameter',
                'custitem_la_height',
                'custitem_la_length',
                'custitem_la_weight',
                'custitem_la_extension',
                'custitem_la_chain',
                'custitem_la_wire',
                'custitem_la_bulbs_included',
                'custitem_la_number_of_bulbs',
                'custitem_la_max_wattage',
                'custitem_la_bulb_type',
                'custitem_la_bulb_base',
                'custitem_la_light_source',
                'custitem_la_light_output',
                'custitem_la_color_temperature',
                'custitem_la_cri',
                'custitem_la_dimmable',
                'custitem_la_beam_spread',
                'custitem_la_rated_average_life',
                'custitem_la_voltage',
                'custitem_la_fan_airflow',
                'custitem_la_fan_electricity_use',
                'custitem_la_airflow_efficiency',
                'custitem_la_blade_pitch',
                'custitem_la_blade_span',
                'custitem_la_blade_type',
                'custitem_la_blade_finish',
                'custitem_la_blade_qty',
                'custitem_la_reverse_air',
                'custitem_la_fan_speeds',
                'custitem_la_light_kit',
                'custitem_la_fan_control',
                'custitem_la_fan_downrod',
                'custitem_la_product_url',
                'custitem_la_material',
                'custitem_la_country_of_origin',
                'custitem_la_safety_listing',
                'custitem_la_safety_rating',
                'custitem_la_energy_star',
                'custitem_la_ada',
                'custitem_la_dark_sky',
                'custitem_la_manufacturer_warranty',
                'custitem_la_intro_date',
                'custitem_la_spec_sheet',
                'custitem_la_instructions',
                'custitem_la_parts_diagram',
                'custitem_la_image',
                'custitem_la_shipped_via',
                'custitem_la_drop_ship',
                'custitem_la_carton_volume',
                'custitem_la_dimensional_weight',
                'custitem_la_active?',
                'custitem_la_unique_id'
            ]
            return keyArray
        }


        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            //        summarize: summarize
        };

    });
