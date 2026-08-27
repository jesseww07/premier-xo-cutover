/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */

//first script

//load a search
//loop all items in search
//check if item is in stock
//if item is not in stock AND if its an assembly load all of its components. For example, load BOM revision record
//keep looping those components and if assembly loop its components and repeat, could be 5 records deep
//for every single component, pick up available quantity, amount on order, backordered quantity, available to be made, expected to be made, component quantity
//if amount on order is greater than zero, pull every PO, the amount of that item thats being ordered and when that PO is expected to arrive
//then take all that info and dump it into a custom record

//second script

//take every single custom record in the system and delete it.

//third script

//loop through all of the information  created in first script
//look at every single one, run a search, show me all custom records with this selling item and this SO number. If every component says 'available to build' then mark as released
//once released we need to take every component and quantity that needs to be used and for  future things that will be released, subtract that from what's on hand
define(['N/log', 'N/query', 'N/record', 'N/runtime', 'N/search', 'N/util', 'N/format'],
    /**
     * @param {log} log
     * @param {query} query
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {util} util
     */
    function (log, query, record, runtime, search, util, format) {
        let consumedArray = []

        /**
         * Marks the beginning of the Map/Reduce process and generates input data.
         *
         * @typedef {Object} ObjectRef
         * @property {number} id - Internal ID of the record instance
         * @property {string} type - Record type id
         *
         * @return {Array|Object|Search|RecordRef} inputSummary
         * @since 2015.1
         */


        function getInputData() {
            var p = runtime.getCurrentScript()
            var salesId = p.getParameter({
                name: 'custscript_so_id'
            });
            var transactionSearchObj = search.create({
                type: "transaction",
                filters:
                    [
                        ["internalid", "anyof", salesId],
                        "AND",
                        ["mainline", "is", "F"],
                        "AND",
                        ["taxline", "is", "F"],
                        "AND",
                        ["cogs", "is", "F"],
                        "AND",
                        ["shipping", "is", "F"]
                    ],
                columns:
                    [
                        search.createColumn({ name: "tranid", label: "Document Number" }),
                        search.createColumn({ name: "entity", label: "Name" }),
                        search.createColumn({ name: "shipaddress", label: "Shipping Address" }),
                        search.createColumn({ name: "memomain", label: "Memo (Main)" }),
                        search.createColumn({ name: "location", label: "Location" }),
                        search.createColumn({ name: "custcol_zastro_unconsolidated_item", label: "Unconsolidated Item" }),
                        search.createColumn({ name: "custcol_zastro_unconsolidated_no", label: "Consolidated PO" }),
                        search.createColumn({ name: "custcolcustcol_zastro_from_showroom", label: "Allocate From Showroom" }),
                        search.createColumn({ name: "item", label: "Item" }),
                        search.createColumn({ name: "quantity", label: "Quantity" }),
                        search.createColumn({ name: "custcol_pr_room_location", label: "Room Location" }),
                        search.createColumn({ name: "custcolcustcol_zastro_vendor", label: "Preferred Vendor" }),
                        search.createColumn({ name: "custcol_zastro_purchase_price", label: "Purchase Price" }),
                        search.createColumn({ name: "linesequencenumber", label: "Line Sequence Number" }),
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({
                            name: "formulatext",
                            formula: "{lineuniquekey}",
                            label: "Formula (Text)"
                        })
                    ]
            });
            return transactionSearchObj
        }

        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        //	
        //	var compMultiplier = new Object()
        //	compMultiplier.soQty = soQty
        //	compMultiplier.layer1 = soQty * bomQuantity
        //	compMultiplier.layer2 = compMultiplier.layer1 * bomQuantity
        //	compMultiplier.layer3 = compMultiplier.layer2 * bomQuantity
        //	compMultiplier.layer4 = compMultiplier.layer3 * bomQuantity
        //	compMultiplier.layer5 = compMultiplier.layer4 * bomQuantity
        function map(context) {
            try {
                var result = JSON.parse(context.value)
                log.debug('result', result)
                var soNo = result.values.tranid;
                log.debug('so_no', soNo);
                var soInternal = result.values.internalid.value
                log.debug('so_internal', soInternal);
                var entity = result.values.entity.value;
                log.debug('entity', entity);
                var shipAddress = result.values.shipaddress;
                log.debug('ship_address', shipAddress);
                var project = result.values.memomain;
                log.debug('project', project);
                var soLocation = result.values.location.value;
                log.debug('so_location', soLocation)
                var specialProduct = result.values.custcol_zastro_unconsolidated_item;
                log.debug('special_product', specialProduct);
                if (specialProduct == 'T' || specialProduct == true) {
                    var consolDoc = result.values.custcol_zastro_unconsolidated_no
                    log.debug('consol_doc', consolDoc)
                    var allocatedFromShow = result.values.custcol_zastro_from_showroom;
                    log.debug('allocatedFromShow', allocatedFromShow)
                    if (!consolDoc) {
                        var soItem = result.values.item.value;
                        log.debug('so_item', soItem);
                        var soQty = result.values.quantity;
                        log.debug('so_qty', soQty);
                        var roomLocation = result.values.custcolcustcol_zastro_room_location;
                        log.debug('room_location', roomLocation);
                        var targetVendor = result.values.custcolcustcol_zastro_vendor.value;
                        log.debug('target_vendor', targetVendor);
                        if (targetVendor) {
                            var purchasePrice = result.values.custcol_zastro_purchase_price;
                            log.debug('purchase_price', purchasePrice);
                            log.debug('running returnedParent')
                            if (targetVendor == 2731 ||
                                targetVendor == 2732 ||
                                targetVendor == 2733 ||
                                targetVendor == 2734 ||
                                targetVendor == 2735 ||
                                targetVendor == 2736 ||
                                targetVendor == 2737 ||
                                targetVendor == 2738 ||
                                targetVendor == 2739 ||
                                targetVendor == 2740 ||
                                targetVendor == 2741 ||
                                targetVendor == 2742 ||
                                targetVendor == 2743 ||
                                targetVendor == 2744 ||
                                targetVendor == 2745) {
                                soLocation = 8
                            }
                            if (soLocation == 4) {
                                soLocation = 8
                            }
                            var returnedParent = runConsolidatedSearch(targetVendor, soLocation)
                            log.debug('returnedParent', returnedParent)
                            if (returnedParent) {
                                // var toCreate = false
                                var docAlteration = returnedParent
                            }
                            else {
                                //var toCreate = true
                                var docAlteration = runAlterationsOnParent(targetVendor, soLocation)
                            }
                            var payload = new Object()
                            payload.soItem = soItem
                            payload.soQty = soQty
                            payload.soLocation = soLocation
                            payload.roomLocation = roomLocation
                            payload.soInternal = soInternal
                            payload.entity = entity
                            payload.shipAddress = shipAddress
                            payload.project = project
                            payload.purchasePrice = purchasePrice
                            log.debug('payload', payload)

                            var returnedLineLevel = createConsolidatedItemDoc(payload, docAlteration);
                            var soId = result.values.internalid.value
                            var searchUniqueKey = result.values.formulatext;
                            context.write({
                                key: searchUniqueKey,
                                value: docAlteration
                            });
                        }
                    }
                }
            }
            catch (e) {
                log.error('Could not complete mapping', e)

            }

        }

        const createConsolidatedItemDoc = (payload, docAlteration) => {
            var lineDoc = record.create({
                type: 'customrecord_zastro_unconsolidated_items',
                isDynamic: true
            });
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_po_item_list',
                value: docAlteration
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_item_name',
                value: payload.soItem
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_qty',
                value: payload.soQty
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_location_home',
                value: payload.roomLocation
            })
            lineDoc.setValue({
                fieldId: 'xxxxx',
                value: payload.soLocation
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_so_no',
                value: payload.soInternal
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_customer',
                value: payload.entity
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_ship_address',
                value: payload.shipAddress
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_project',
                value: payload.project
            })
            lineDoc.setValue({
                fieldId: 'custrecord_zastro_print_on_label',
                value: true
            })
            var submitNewCustom = lineDoc.save()
            return submitNewCustom
        }

        const runAlterationsOnParent = (targetVendor, soLocation) => {
            var today = new Date()
            //if (toCreate == true) {
            var parentRec = record.create({
                type: 'customrecord_zastro_po_consolid',
                isDynamic: true
            });
            parentRec.setValue({
                fieldId: 'custrecord_zastr_date',
                value: today
            })
            parentRec.setValue({
                fieldId: 'custrecord_zastro_vendor',
                value: targetVendor
            })
            parentRec.setValue({
                fieldId: 'custrecord_ill_location',
                value: soLocation
            })
            var createdDoc = parentRec.save()
            return createdDoc
            //}
        }

        const runConsolidatedSearch = (targetVendor, soLocation) => {
            log.debug('soLocation', soLocation)
            var returnID
            var customrecord_zastro_po_consolidSearchObj = search.create({
                type: "customrecord_zastro_po_consolid",
                filters:
                    [
                        ["custrecord_zastro_vendor", "anyof", targetVendor],
                        "AND",
                        ["custrecord_zastro_is_consolidated", "is", "F"],
                        "AND",
                        ["custrecord_ill_location", "anyof", soLocation],
                        "AND",
                        ["custrecord_pr_consol_hold_order", "is", "F"],
                        "AND",
                        ["isinactive", "is", "F"]
                    ],
                columns:
                    [
                        "internalid"
                    ]
            });
            var searchResultCount = customrecord_zastro_po_consolidSearchObj.runPaged().count;
            log.debug("customrecord_zastro_po_consolidSearchObj result count", searchResultCount);
            customrecord_zastro_po_consolidSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var internalID = result.getValue({
                    name: 'internalid'
                })
                returnID = internalID
                return true;
            });
            return returnID
        }

        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        function reduce(context) {

        }


        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        function summarize(context) {
            var p2 = runtime.getCurrentScript()
            var salesId2 = p2.getParameter({
                name: 'custscript_so_id'
            });
            var salesOrd = record.load({
                type: record.Type.SALES_ORDER,
                id: salesId2,
                isDynamic: true
            });
            var lineCount = salesOrd.getLineCount({
                sublistId: 'item'
            });
            log.debug('sales_id', salesId2)
            if (lineCount > 0) {
                context.output.iterator().each(function (key, value) {
                    for (var i = 0; i < lineCount; i++) {
                        var lineUniqueKey = salesOrd.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'lineuniquekey',
                            line: i
                        });
                        if (key == lineUniqueKey) {
                            log.debug('key, value', key + ' - ' + value)
                            log.debug('line_unique_key', lineUniqueKey);
                            var unconsolColumn = salesOrd.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_zastro_unconsolidated_no',
                                line: i
                            });
                            if (unconsolColumn == null || unconsolColumn == '') {
                                var lineNum = salesOrd.selectLine({
                                    sublistId: 'item',
                                    line: i
                                });
                                salesOrd.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_zastro_unconsolidated_no',
                                    value: value,
                                    ignoreFieldChange: true
                                });
                                salesOrd.commitLine({
                                    sublistId: 'item'
                                });
                                break;
                            }
                        }
                    }
                    return true;
                });
            }
            var saveSO = salesOrd.save();
            log.debug('save_so', saveSO);
            // log.debug('summary', context.output);
            // //var summaryResult = JSON.parse(summary[0].key);
            // log.debug('summary_result', summaryContext.output);
        }


        const idParser = (result, startPoint) => {

            let newResult = JSON.stringify(result)
            let n = newResult.search(startPoint)
            let subResult = newResult.substring(n, newResult.length)
            log.debug('subresult', subResult)
            var id;
            if (startPoint == 'trandate' || startPoint == 'duedate') {
                id = idScanner(subResult)
                stringId = String(id)
                log.debug(id)
                n = newResult.search(id)
                let increment1 = Number(stringId.length)
                subResult = newResult.substring(n + increment1, newResult.length)
                log.debug('increment 1', increment1)
                var id2 = idScanner(subResult)
                stringId2 = String(id2)
                let increment2 = Number(stringId2.length)
                log.debug(id2)
                n = newResult.search(id2)
                subResult = newResult.substring(n + increment2, newResult.length)
                var id3 = idScanner(subResult)
                log.debug(id3)
                id = id + '/' + id2 + '/' + id3
                id = String(id)

            }
            else {
                id = idScanner(subResult)
            }
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
            log.debug('parsedId', parsedId)
            return parsedId
        }


        return {
            getInputData: getInputData,
            map: map,
            //        reduce: reduce,
            summarize: summarize
        };

    });