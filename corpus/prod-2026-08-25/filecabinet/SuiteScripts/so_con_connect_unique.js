/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {util} util
     */
    function (log, record, search, util) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(context) {
            var searchRes = getResults()
            log.debug('searchRes', searchRes)
            if (searchRes.length > 0) {
                for (var x = 0; x < searchRes.length; x++) {
                    var soID = searchRes[x].soID
                    var specialOrder = '111248'
                    var uniqueKey = searchRes[x].uniqueKey
                    //var room = searchRes[x].room
                    var item = searchRes[x].item
                    var vendor = searchRes[x].vendor
                    var qty = searchRes[x].qty
                    var selfMade = searchRes[x].selfMade
                    //will need to add more for verifcation
                    var returnPOKey = updatePO(soID, specialOrder, uniqueKey, item, selfMade)
                    log.debug('returnPOKey',returnPOKey)
                    var parentId = getLinkedParent(vendor)
                    if (parentId) {
                        var useId = parentId
                    }
                    else {
                        var useId = createLinkedParent(vendor)
                    }
                    //Removed room parameter
                    var returnRec = createCustomRecord(soID, specialOrder, uniqueKey, item, returnPOKey.key, vendor, parentId, qty, returnPOKey.rate)
                    var returnSO = editSalesOrd(soID,selfMade,returnRec)
                }
            }
        }
        const editSalesOrd = (soID,selfMade,returnRec) => {
            try{
                log.debug('in on so edit')
                var salesOrd = record.load({
                    type:'salesorder',
                    id:soID,
                    isDynamic:true
                })
                var lineCount = salesOrd.getLineCount({
                    sublistId: 'item'
                });
                log.debug('lineCount', lineCount)
                if (lineCount > 0) {
                    for (var i = 0; i < lineCount; i++) {
                        var identifier = salesOrd.getSublistValue({
                            sublistId:'item',
                            fieldId:'custcol_self_id',
                            line:i
                        })
                        log.debug('identifier',identifier)
                        log.debug('selfMade',selfMade)
                        log.debug('returnRec',returnRec)
                        if(identifier == selfMade){
                            log.debug('should be setting!!!!')
                            salesOrd.selectLine({
                                sublistId:'item',
                                line:i
                            })
                            salesOrd.setCurrentSublistValue({
                                sublistId:'item',
                                fieldId:'custcol_linked_so_rec',
                                value:returnRec
                            })
                            // salesOrd.setCurrentSublistValue({
                            //     sublistId:'item',
                            //     fieldId:'custcol_special_connected',
                            //     value:true
                            // })
                            salesOrd.commitLine({
                                sublistId:'item'
                            })
                        }
                    }
                }
                salesOrd.save()
            }
            catch(e){
                log.debug('e on so edit',e)
            }
           
        }
        const createLinkedParent = (vendor) => {
            log.error('e ven',vendor)
            var parLink = record.create({
                type: 'customrecord_consolidated_vendor_select',
                isDynamic: true
            })
            parLink.setValue({
                fieldId: 'custrecord_vendor_select_vendor',
                value: vendor
            })
            var suitLink = "https://tstdrv2379072.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=183&deploy=1&compid=TSTDRV2379072&h=f5256cff49e2e41f5441&custom_id=" + vendor
            parLink.setValue({
                fieldId: 'custrecord_vendor_select_sl',
                value: suitLink
            })
            var rec = parLink.save()
            return rec
        }
        const getLinkedParent = (vendor) => {
            try{
                log.error('e ven',vendor)
                var returnId;
                var venSearch = search.create({
                    type: "customrecord_consolidated_vendor_select",
                    filters:
                        [
                            ["custrecord_vendor_select_vendor", "anyof", vendor]
                        ],
                    columns:
                        [
                            "internalid"
                        ]
                });
                var searchResultCount = venSearch.runPaged().count;
                log.debug("venSearch result count", searchResultCount);
                venSearch.run().each(function (result) {
                    // .run().each has a limit of 4,000 results
                    var id = result.getValue({
                        name: 'internalid'
                    })
                    returnId = id
                    return true;
                });
                return returnId
            }
            catch(e){
                return
            }
        }
        const createCustomRecord = (soID, specialOrder, uniqueKey, item, returnPOKey, vendor, parentId,qty,poRate) => {
            try{
                var custRec = record.create({
                    type: 'customrecord_consolidated_special_order',
                    isDynamic: true
                })
                custRec.setValue({
                    fieldId: 'custrecord_special_consolidated_qty',
                    value: qty
                })
                custRec.setValue({
                    fieldId: 'custrecord_consolidated_po_unique',
                    value: returnPOKey
                })
                custRec.setValue({
                    fieldId: 'custrecord_special_consolidated_vendor',
                    value: vendor
                })
                 custRec.setValue({
                    fieldId: 'custrecord_consol_item_rate',
                    value: poRate
                })
                custRec.setValue({
                    fieldId: 'custrecord_special_consolidated_sl',
                    value: parentId
                })
                custRec.setValue({
                    fieldId: 'custrecord_special_consolidated_so',
                    value: soID
                })
                custRec.setValue({
                    fieldId: 'custrecord_special_consolidated_po',
                    value: specialOrder
                })
                custRec.setValue({
                    fieldId: 'custrecord_special_consolidated_key',
                    value: uniqueKey
                })
                custRec.setValue({
                    fieldId: 'custrecord_special_consolidated_item',
                    value: item
                })
                // custRec.setValue({
                //     fieldId: 'custrecord_special_consolidated_room',
                //     value: room
                // })
                var rec = custRec.save()
                return rec
            }
            catch(e){
                log.debug('e on cust save',e)
                return null
            }
        
        }
        const updatePO = (soID, specialOrder, uniqueKey, checkItem, selfMade) => {
            var returnUnique = new Object()
            var purchOrd = record.load({
                type: 'purchaseorder',
                id: specialOrder,
                isDynamic: true
            })
            var lineCount = purchOrd.getLineCount({
                sublistId: 'item'
            });
            log.debug('lineCount', lineCount)
            if (lineCount > 0) {
                for (var i = 0; i < lineCount; i++) {
                    purchOrd.selectLine({
                        sublistId: 'item',
                        line: i
                    });
                    var item = purchOrd.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item'
                    });
                    var idCheck = purchOrd.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_self_id'
                    });
                    log.debug('item',item)
                    log.debug('checkItem',checkItem)
                    //log.debug('room',room)
                    //log.debug('checkRooom',checkRooom)
                    // if ((Number(item) == Number(checkItem)) && (room == checkRooom)) {
                        if (idCheck == selfMade) {
                        log.audit('IN!')
                        purchOrd.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_unique_key',
                            value: uniqueKey
                        });
                        var poUni = purchOrd.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'lineuniquekey'
                        });
                              var poRate = purchOrd.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate'
                        });
                        log.audit('poUni',poUni)
                        purchOrd.commitLine({
                            sublistId: 'item'
                        });
                         
                        returnUnique.key = poUni
                            returnUnique.rate = poRate
                    }
                }
                var rec = purchOrd.save()
                return returnUnique
            }
            else {
                return null
            }
        }
        const getResults = () => {
            var returnArr = new Array()
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["mainline", "is", "F"],
                        "AND",
                        ["item.type", "anyof", "InvtPart"],
                        "AND",
                        ["custcol_special_connected", "is", "F"],
                        "AND",
                        // ["specialorder", "noneof", "@NONE@"],
                        // "AND",
                        ["custcol_zastro_unconsolidated_item", "is", "T"],
                        "AND",
                        ["internalid", "is", '111126'],
                        "AND",
                        ["datecreated", "onorafter", "01/27/2023 12:00 am"]
                    ],
                columns:
                    [
                        "internalid",
                        "trandate",
                        "tranid",
                        "item",
                        "quantity",
                        "specialorder",
                        "custcol_special_connected",
                        "lineuniquekey",
                        "line",
                        //"custcolcustcol_zastro_room_location",
                        "custcolcustcol_zastro_vendor",
                        "custcol_self_id"
                    ]
            });
            var searchResultCount = salesorderSearchObj.runPaged().count;
            log.debug("salesorderSearchObj result count", searchResultCount);
            salesorderSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var soID = result.getValue({
                    name: 'internalid'
                })
                var specialOrder = result.getValue({
                    name: 'specialorder'
                })
                var uniqueKey = result.getValue({
                    name: 'lineuniquekey'
                })
                // var room = result.getValue({
                //     name: 'custcolcustcol_zastro_room_location'
                // })
                var item = result.getValue({
                    name: 'item'
                })
                var vendor = result.getValue({
                    name: 'custcolcustcol_zastro_vendor'
                })
                var qty = result.getValue({
                    name: 'quantity'
                })
                var selfMade = result.getValue({
                    name: 'custcol_self_id'
                })


                var returnObj = new Object()
                returnObj.soID = soID
                returnObj.specialOrder = specialOrder
                returnObj.uniqueKey = uniqueKey
                //returnObj.rooom = room
                returnObj.item = item
                returnObj.vendor = vendor
                returnObj.qty = qty
                returnObj.selfMade = selfMade
                returnArr.push(returnObj)
                return true;
            });

            return returnArr
        }

        return {
            execute: execute
        };

    });