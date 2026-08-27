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



                log.debug('start?')
                var form2 = serverWidget.createForm({
                    title: 'Items to Order'
                });
                log.debug('form?')



                var sublist = form2.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Items Available to Order'
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

                var cust = sublist.addField({
                    id: 'custpage_cust',
                    label: 'Customer',
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

                var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
                    type: "customrecord_zastro_unconsolidated_items",
                    filters:
                    [
                       ["custrecord_zastro_po_item_list","anyof",getParam], 
                       "AND", 
                       ["custrecord_zastro_is_consolidated_on_po","is","F"]
                    ],
                    columns:
                    [
                       "custrecord_zastro_customer",
                       "custrecord_zastro_item_name",
                       "custrecord_zastro_project",
                       "custrecord_zastro_qty",
                       "custrecord_zastro_location_home",
                       "custrecord_zastro_so_no",
                       "internalid",
                       "custrecord_zastro_po_item_list"
                    ]
                 });
                 var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
                 log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count",searchResultCount);
                 customrecord_zastro_unconsolidated_itemsSearchObj.run().each(function(result){
                    // .run().each has a limit of 4,000 results
         
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_item',
                            line: ctr,
                            value: result.getText({ name: 'custrecord_zastro_item_name'})
                        });
                    }
                    catch (eee) {
                        sublist.setSublistValue({
                            id: 'custpage_item',
                            line: ctr,
                            value: result.getValue({ name: 'custrecord_zastro_item_name'})
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_qty',
                            line: ctr,
                            value: result.getValue({ name: 'custrecord_zastro_qty'})
                        });
                    }
                    catch (eee) {
                        sublist.setSublistValue({
                            id: 'custpage_qty',
                            line: ctr,
                            value: result.getValue({ name: 'custrecord_zastro_qty'})
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_child',
                            line: ctr,
                            value: result.getValue({ name: 'internalid'})
                        });
                    }
                    catch (eee) {
                        sublist.setSublistValue({
                            id: 'custpage_child',
                            line: ctr,
                            value: result.getValue({ name: 'internalid'})
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_parent',
                            line: ctr,
                            value: result.getValue({ name: 'custrecord_zastro_po_item_list' })
                        });
                    }
                    catch (eee) {
                        sublist.setSublistValue({
                            id: 'custpage_parent',
                            line: ctr,
                            value: result.getValue({ name: 'custrecord_zastro_po_item_list' })
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_cust',
                            line: ctr,
                            value: result.getText({ name: 'custrecord_zastro_customer'})
                        });
                    }
                    catch (eee) {
                        sublist.setSublistValue({
                            id: 'custpage_cust',
                            line: ctr,
                            value: result.getValue({ name: 'custrecord_zastro_customer'})
                        });
                    }
                    ctr++
                    //}
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
                var dropFirst = take2.replace('script=696&deploy=1&compid=7513000&custom_id=', '')
                var dropLast = dropFirst.replace('&lang=en_US&type=customrecord_zastro_po_consolid', '')
                log.audit('dropLast', dropLast)
                log.audit('context.request', context.request)
                var oldDoc = record.load({
                    type:'customrecord_zastro_po_consolid',
                    id:dropLast
                })
                var newLoc = oldDoc.getValue({
                    fieldId:'custrecord_ill_location'
                })
                var newVen = oldDoc.getValue({
                    fieldId:'custrecord_zastro_vendor'
                })
                var requestCount = context.request.getLineCount({
                    group: 'sublist'
                });
                log.debug('requestCount', requestCount)
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
                        custArray.push(childLine)
                    }
                }
                log.debug('custArray', custArray);
                // log.debug('debug', context.request.parameters);
                if (custArray) {
           
                        var newDoc = record.create({
                            type: 'customrecord_zastro_po_consolid',
                            isDynamic: true
                        })
                        //log.debug('custArray[0].vendor', custArray[0].vendor)
                        newDoc.setValue({
                            fieldId: 'custrecord_zastro_vendor',
                            value: newVen
                        })
                        newDoc.setValue({
                            fieldId: 'custrecord_ill_location',
                            value: newLoc
                        })
                        var returnedHoldDoc = newDoc.save()
                    
                    for (var c = 0; c < custArray.length; c++) {
                        var child = custArray[c]
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
                log.debug(id, lineTotal)
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