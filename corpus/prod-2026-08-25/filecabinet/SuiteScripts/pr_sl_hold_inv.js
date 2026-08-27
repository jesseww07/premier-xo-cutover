/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect'],
    function (log, serverWidget, record, search, url, redirect) {
        function onRequest(context) {
            //try {
            var getParam = context.request.parameters.custom_id;

            if (context.request.method === 'GET') {

                var getParam = context.request.parameters.custom_id

                try {
                    var grabAttr = record.load({
                        type: 'customrecord_zastro_po_consolid',
                        id: getParam,
                        isDynamic: true,
                    })
                    var vendor = grabAttr.getValue({
                        fieldId: 'custrecord_zastro_vendor'
                    })
                    var vendorText = grabAttr.getText({
                        fieldId: 'custrecord_zastro_vendor'
                    })
                    var location = grabAttr.getValue({
                        fieldId: 'custrecord_ill_location'
                    })
                }
                catch (e) {
                    log.debug('e', e)
                }

                log.debug('start?')
                var form2 = serverWidget.createForm({
                    title: 'Move To Hold'
                });
                log.debug('form?')



                var sublist = form2.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Items Available to be Put On Hold'
                });

    


                var check = sublist.addField({
                    id: 'custpage_selected',
                    label: 'Select',
                    type: serverWidget.FieldType.CHECKBOX,
                });



                var item = sublist.addField({
                    id: 'custpage_item',
                    label: 'Item',
                    type: serverWidget.FieldType.TEXT,
                });

                var qty = sublist.addField({
                    id: 'custpage_qty',
                    label: 'Qty',
                    type: serverWidget.FieldType.TEXT,
                });

                var cost = sublist.addField({
                    id: 'custpage_cost',
                    label: 'Cost',
                    type: serverWidget.FieldType.TEXT,
                });

                var amount = sublist.addField({
                    id: 'custpage_amount',
                    label: 'Amount',
                    type: serverWidget.FieldType.TEXT,
                });

                var qty = sublist.addField({
                    id: 'custpage_location',
                    label: 'Location',
                    type: serverWidget.FieldType.TEXT,
                });

                var cust = sublist.addField({
                    id: 'custpage_cust',
                    label: 'Customer',
                    type: serverWidget.FieldType.TEXT,
                });

                var soShip = sublist.addField({
                    id: 'custpage_ship',
                    label: 'Ship Address',
                    type: serverWidget.FieldType.TEXT,
                });

                var childID = sublist.addField({
                    id: 'custpage_child',
                    label: 'Child ID',
                    type: serverWidget.FieldType.TEXT,
                });

                var parentID = sublist.addField({
                    id: 'custpage_parent',
                    label: 'Parent ID',
                    type: serverWidget.FieldType.TEXT,
                });

                var ctr = 0;

                log.debug('here?')
                var parentDocSearch = search.create({
                    type: "customrecord_zastro_po_consolid",
                    filters:
                        [
                            search.createFilter({
                                name: 'custrecord_zastro_vendor',
                                operator: search.Operator.ANYOF,
                                values: vendor
                            }),
                            search.createFilter({
                                name: 'custrecord_zastro_is_consolidated',
                                operator: search.Operator.IS,
                                values: 'F'
                            }),
                            // search.createFilter({
                            //     name: 'custrecord_ill_location',
                            //     operator: search.Operator.NONEOF,
                            //     values: location
                            // })
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "internalid",
                            })
                        ]
                });

                log.debug('Search_OBJ', parentDocSearch);
                var searchResultCount = parentDocSearch.runPaged().count;
                log.debug("parentDocSearch result count", searchResultCount);
                parentDocSearch.run().each(function (result) {

                    var lineLevelDocSearch = search.create({
                        type: "customrecord_zastro_unconsolidated_items",
                        filters:
                            [
                                search.createFilter({
                                    name: 'custrecord_zastro_is_consolidated_on_po',
                                    operator: search.Operator.IS,
                                    values: 'F'
                                }),
                                search.createFilter({
                                    name: 'custrecord_zastro_po_item_list',
                                    operator: search.Operator.ANYOF,
                                    values: result.getValue('internalid')
                                }),
                            ],
                        columns:
                            [
                                search.createColumn({
                                    name: "custrecord_zastro_item_name",
                                    summary: "GROUP"
                                }),
                                search.createColumn({
                                    name: "custrecord_zastro_qty",
                                    summary: "SUM"
                                }),
                                search.createColumn({
                                    name: "custrecord_ill_location",
                                    join: "CUSTRECORD_ZASTRO_PO_ITEM_LIST",
                                    summary: "GROUP"
                                }),
                                search.createColumn({
                                    name: "custrecord_zastro_item_purchase_price",
                                    summary: "GROUP"
                                }),
                                search.createColumn({
                                    name: "internalid",
                                    summary: "GROUP"
                                }),
                                search.createColumn({
                                    name: "custrecord_zastro_ship_address",
                                    summary: "GROUP"
                                }),
                                search.createColumn({
                                    name: "custrecord_zastro_customer",
                                    summary: "GROUP"
                                }),

                                
                            ]
                    });

                    log.debug('lineLevelDocSearch', lineLevelDocSearch);
                    var searchResultCount = lineLevelDocSearch.runPaged().count;
                    log.debug("lineLevelDocSearch result count", searchResultCount);
                    lineLevelDocSearch.run().each(function (resultTwo) {



                        try {
                            sublist.setSublistValue({
                                id: 'custpage_item',
                                line: ctr,
                                value: resultTwo.getText({ name: 'custrecord_zastro_item_name', summary: search.Summary.GROUP })
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_item',
                                line: ctr,
                                value: resultTwo.getValue({ name: 'custrecord_zastro_item_name', summary: search.Summary.GROUP })
                            });
                        }

                        try {
                            sublist.setSublistValue({
                                id: 'custpage_qty',
                                line: ctr,
                                value: resultTwo.getValue({ name: 'custrecord_zastro_qty', summary: search.Summary.SUM })
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_qty',
                                line: ctr,
                                value: resultTwo.getValue({ name: 'custrecord_zastro_qty', summary: search.Summary.SUM })
                            });
                        }

                        try {
                            sublist.setSublistValue({
                                id: 'custpage_location',
                                line: ctr,
                                value: resultTwo.getText({ join: 'CUSTRECORD_ZASTRO_PO_ITEM_LIST', name: 'custrecord_ill_location', summary: search.Summary.GROUP })
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_location',
                                line: ctr,
                                value: resultTwo.getValue({ join: 'CUSTRECORD_ZASTRO_PO_ITEM_LIST', name: 'custrecord_ill_location', summary: search.Summary.GROUP })
                            });
                        }

                        try {
                            sublist.setSublistValue({
                                id: 'custpage_cost',
                                line: ctr,
                                value: resultTwo.getValue({ name: 'custrecord_zastro_item_purchase_price', summary: search.Summary.GROUP })
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_cost',
                                line: ctr,
                                value: resultTwo.getValue({ name: 'custrecord_zastro_item_purchase_price', summary: search.Summary.GROUP })
                            });
                        }

                        try {
                            sublist.setSublistValue({
                                id: 'custpage_child',
                                line: ctr,
                                value: resultTwo.getValue({ name: 'internalid', summary: search.Summary.GROUP })
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_child',
                                line: ctr,
                                value: resultTwo.getValue({ name: 'internalid', summary: search.Summary.GROUP })
                            });
                        }

                        try {
                            sublist.setSublistValue({
                                id: 'custpage_parent',
                                line: ctr,
                                value: result.getValue({ name: 'internalid' })
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_parent',
                                line: ctr,
                                value: result.getValue({ name: 'internalid' })
                            });
                        }

                        try {
                            sublist.setSublistValue({
                                id: 'custpage_cust',
                                line: ctr,
                                value: resultTwo.getText({ name: 'custrecord_zastro_customer', summary: search.Summary.GROUP })
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_cust',
                                line: ctr,
                                value: resultTwo.getValue({ name: 'custrecord_zastro_customer', summary: search.Summary.GROUP })
                            });
                        }

                        try {
                            sublist.setSublistValue({
                                id: 'custpage_ship',
                                line: ctr,
                                value: resultTwo.getValue({ name: 'custrecord_zastro_ship_address', summary: search.Summary.GROUP })
                            });
                        }
                        catch (eee) {
                            sublist.setSublistText({
                                id: 'custpage_ship',
                                line: ctr,
                                value: resultTwo.getText({ name: 'custrecord_zastro_ship_address', summary: search.Summary.GROUP })
                            });
                        }





                        var itemCost = resultTwo.getValue({ name: 'custrecord_zastro_item_purchase_price', summary: search.Summary.GROUP })
                        var itemQty = resultTwo.getValue({ name: 'custrecord_zastro_qty', summary: search.Summary.SUM })
                        var itemTotal = Number(itemCost) * Number(itemQty)
                        log.audit('itemCost', itemCost)
                        log.audit('itemQty', itemQty)
                        log.audit('itemTotal', itemTotal)
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_amount',
                                line: ctr,
                                value: itemTotal
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_amount',
                                line: ctr,
                                value: itemTotal
                            });
                        }
                        ctr++
                        //}
                        return true;

                    });
                    return true;
                });


                form2.addSubmitButton()
                context.response.writePage(form2);
            }
            else {
                //log.audit('generatingId', generatingID)
                var custArray = [];
                var printer = context.request.parameters.custpage_print;
                var take2 = context.request.parameters.entryformquerystring;
                log.audit('take2', take2)
                var dropFirst = take2.replace('script=298&deploy=1&compid=7513000&custom_id=', '')
                var dropLast = dropFirst.replace('&lang=en_US&type=customrecord_zastro_po_consolid', '')
                log.audit('dropLast', dropLast)
                log.audit('context.request', context.request)
                var chosenLocatioon = context.request.parameters.custpage_location
                var setVendor;
                log.debug('chosenLocatioon', chosenLocatioon)
                var requestCount = context.request.getLineCount({
                    group: 'sublist'
                });
                log.debug('requestCount', requestCount)
                for (var j = 0; j < requestCount; j++) {
                    var selected = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_selected',
                        line: j
                    })
                    log.debug('selected', selected)
                    if (selected == 'T') {
                        var parentDoc = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_parent',
                            line: j
                        })
                        var returnedVendor = runDocSearch(parentDoc, chosenLocatioon)
                        log.debug('returnedVendor', returnedVendor + 'off of ' + parentDoc)
                        if (returnedVendor) {
                            log.debug('WE MADE IT IN', returnedVendor)
                            setVendor = returnedVendor
                            //return
                        }
                    }
                }
                for (var x = 0; x < requestCount; x++) {
                    var selected = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_selected',
                        line: x
                    })
                    log.debug('selected', selected)
                    if (selected == 'T') {
                        //var parentLine = chosenLocatioon
                        var childLine = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_child',
                            line: x
                        })
                        var objLocation = new Object()
                        objLocation.vendor = setVendor
                        objLocation.childLine = childLine

                        custArray.push(objLocation)
                    }
                }
                log.debug('custArray', custArray);
                // log.debug('debug', context.request.parameters);
                if (custArray) {
                    var returnedHoldDoc = findHolds(custArray[0].vendor)
                    if(!returnedHoldDoc){
                        var newDoc = record.create({
                            type:'customrecord_zastro_po_consolid',
                            isDynamic:true
                        })
                        log.debug('custArray[0].vendor',custArray[0].vendor)
                        newDoc.setValue({
                            fieldId: 'custrecord_zastro_vendor',
                            value: custArray[0].vendor
                        })
                        newDoc.setValue({
                            fieldId: 'custrecord_pr_consol_hold_order',
                            value: true
                        })
                        var returnedHoldDoc = newDoc.save()
                    }
                    for (var c = 0; c < custArray.length; c++) {
                        var child = custArray[c].childLine
                        var parent = returnedHoldDoc
                        var customRecord = bucketHolds(parent, child)
                        log.debug('customRecord', customRecord)
                    }
                }


                redirect.toRecord({
                    type: 'customrecord_zastro_po_consolid',
                    id: returnedHoldDoc
                });
            }


        }
        const findHolds = (targetVendor) => {
            var returnID
            var customrecord_zastro_po_consolidSearchObj = search.create({
                type: "customrecord_zastro_po_consolid",
                filters:
                    [
                        ["custrecord_zastro_vendor", "anyof", targetVendor],
                        "AND",
                        ["custrecord_zastro_is_consolidated", "is", "F"],
                        "AND",
                        ["custrecord_pr_consol_hold_order", "is", "T"]
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
        const checkChildRecords = (docCheck) => {
            var newSum = 0
            //take each open one and see if anything is left
            var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
                type: "customrecord_zastro_unconsolidated_items",
                filters:
                    [
                        ["custrecord_zastro_po_item_list", "anyof", docCheck]
                    ],
                columns:
                    [
                        "internalid",
                        "custrecord_zastro_qty",
                        "custrecord_zastro_item_purchase_price"
                    ]
            });
            var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
            if (searchResultCount < 1) {
                consolidateParentDoc(docCheck)
            }
            log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count", searchResultCount);
            customrecord_zastro_unconsolidated_itemsSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var id = result.getValue({
                    name: 'internalid'
                })
                var qty = result.getValue({
                    name: 'custrecord_zastro_qty'
                })
                var cost = result.getValue({
                    name: 'custrecord_zastro_item_purchase_price'
                })
   
                var lineTotal = Number(qty) * Number(cost)
                log.debug(id,lineTotal)
                newSum += lineTotal
                return true;
            });
            var parentObj = record.load({
                type: 'customrecord_zastro_po_consolid',
                id: docCheck,
                isDynamic: true
            });
            parentObj.setValue({
                fieldId: 'custrecord_zastro_total_price',
                value: newSum
            })
            var savedParent = parentObj.save()
            return savedParent
        }

        const consolidateParentDoc = (docCheck) => {
            var parentObj = record.load({
                type: 'customrecord_zastro_po_consolid',
                id: docCheck,
                isDynamic: true
            });
            parentObj.setValue({
                fieldId: 'custrecord_zastro_is_consolidated',
                value: true
            })
            var savedParent = parentObj.save()
            return savedParent
        }

        const bucketHolds = (parent, child) => {
            log.audit('parent', parent)
            log.audit('child', child)
            var childObj = record.load({
                type: 'customrecord_zastro_unconsolidated_items',
                id: child,
                isDynamic: true
            });
            childObj.setValue({
                fieldId: 'custrecord_zastro_po_item_list',
                value: parent
            })
            var savedChild = childObj.save()
            return savedChild
        }



        const runDocSearch = (parentDoc) => {
            var parentObj = record.load({
                type: 'customrecord_zastro_po_consolid',
                id: parentDoc,
                isDynamic: true
            });
            var vendor = parentObj.getValue({
                fieldId: 'custrecord_zastro_vendor'
            })
            return vendor
        }


        return {
            onRequest: onRequest
        };
    });