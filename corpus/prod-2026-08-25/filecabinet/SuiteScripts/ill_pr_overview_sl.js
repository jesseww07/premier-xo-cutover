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

                // try {
                //     var grabAttr = record.load({
                //         type: 'customrecord_di_build_record',
                //         id: getParam,
                //         isDynamic: true,
                //     })

                // }
                // catch (e) {
                //     var attribute = ''
                // }

                log.debug('start?')
                var form2 = serverWidget.createForm({
                    title: 'Project Item Overview'
                });
                log.debug('form?')
                //form2.clientScriptModulePath = "SuiteScripts/pr_mass_iful_client_call.js";




                var sublist = form2.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Items'
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

                var item = sublist.addField({
                    id: 'custpage_doc',
                    label: 'Sales Order',
                    type: serverWidget.FieldType.TEXT,
                });

                var item = sublist.addField({
                    id: 'custpage_ship',
                    label: 'Exp Ship Date',
                    type: serverWidget.FieldType.TEXT,
                });


                // var qty = sublist.addField({
                //     id: 'custpage_desc',
                //     label: 'Project Phase',
                //     type: serverWidget.FieldType.TEXT,
                // });

                var qtyFul = sublist.addField({
                    id: 'custpage_room',
                    label: 'Room Location',
                    type: serverWidget.FieldType.TEXT,
                });

                var qtyFul = sublist.addField({
                    id: 'custpage_qty',
                    label: 'Quantity Ordered',
                    type: serverWidget.FieldType.TEXT,
                });

                var date = sublist.addField({
                    id: 'custpage_commit',
                    label: 'Quantity Committed',
                    type: serverWidget.FieldType.TEXT,
                });

                var build = sublist.addField({
                    id: 'custpage_shipped',
                    label: 'Quantity Shipped',
                    type: serverWidget.FieldType.TEXT,
                });

                var build = sublist.addField({
                    id: 'custpage_billed',
                    label: 'Quantity Billed',
                    type: serverWidget.FieldType.TEXT,
                });

                var fulfill = sublist.addField({
                    id: 'custpage_fillqty',
                    label: 'Quantity To Fulfill',
                    type: serverWidget.FieldType.TEXT,
                });
                fulfill.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

                // var bin = sublist.addField({
                //     id: 'custpage_bin',
                //     label: 'Bin Selection',
                //     type: serverWidget.FieldType.SELECT,
                //     source: 'bin'
                // });
                // bin.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });


                var idd = sublist.addField({
                    id: 'custpage_id',
                    label: 'Internal',
                    type: serverWidget.FieldType.TEXT,
                });
                var idd = sublist.addField({
                    id: 'custpage_entity',
                    label: 'Entity',
                    type: serverWidget.FieldType.TEXT,
                });
                var idd = sublist.addField({
                    id: 'custpage_itemid',
                    label: 'Item ID',
                    type: serverWidget.FieldType.TEXT,
                });
                var idd = sublist.addField({
                    id: 'custpage_loc',
                    label: 'Location ID',
                    type: serverWidget.FieldType.TEXT,
                });
                var idd = sublist.addField({
                    id: 'custpage_soid',
                    label: 'SO ID',
                    type: serverWidget.FieldType.TEXT,
                });
                 var lineKey = sublist.addField({
                    id: 'custpage_line',
                    label: 'Line ID',
                    type: serverWidget.FieldType.TEXT,
                });



                var ctr = 0;

                log.debug('here?')
                var salesorderSearchObj = search.create({
                    type: "salesorder",
                    filters:
                        [
                            ["name", "anyof", getParam],
                            "AND",
                            ["type", "anyof", "SalesOrd"],
                            "AND",
                            ["status", "anyof", "SalesOrd:D", "SalesOrd:A", "SalesOrd:B", "SalesOrd:E"],
                            "AND",
                            ["mainline", "is", "F"],
                            "AND",
                            ["taxline", "is", "F"],
                            "AND",
                            ["shipping", "is", "F"],
                            "AND",
                            ["formulanumeric: CASE WHEN {quantity} > {quantityshiprecv} THEN 1 ELSE 0 END", "greaterthan", "0"], 
      "AND", 
      ["quantitycommitted","greaterthan","0"], 
      "AND", 
      ["formulanumeric: CASE WHEN {quantity} > NVL({quantitypicked},0) THEN 1 ELSE 0 END","greaterthan","0"]
                        ],
                    columns:
                        [
                            "entity",
                            "trandate",
                            "tranid",
                            "tranid",
                            "shipdate",
                            "item",
                            "quantity",
                            "quantitybilled",
                            "quantitycommitted",
                            "quantityshiprecv",
                            "rate",
                            "amount",
                            "custcol_pr_room_location",
                            "memo",
                            "location",
                          "lineuniquekey",
                            // search.createColumn({
                            //     name: "custcol6",
                            //     sort: search.Sort.ASC
                            //  }),
                            "internalid",
                            search.createColumn({
                                name: "formulatext",
                                formula: "{quantitycommitted}"
                            })
                        ]
                });

                log.debug('Search_OBJ', salesorderSearchObj);
                var searchResultCount = salesorderSearchObj.runPaged().count;
                log.debug("salesorderSearchObj result count", searchResultCount);
                salesorderSearchObj.run().each(function (result) {
                    //log.debug('result', result);
                    sublist.setSublistValue({
                        id: 'custpage_internalid',
                        line: ctr,
                        value: result.id
                    });
                    var blank = 0
                    var itemDrop = result.getValue({
                        name: 'item'
                    })
                    try {
                        sublist.setSublistText({
                            id: 'custpage_item',
                            line: ctr,
                            value: result.getText('item')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_item',
                            line: ctr,
                            value: result.getText('item')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_doc',
                            line: ctr,
                            value: result.getValue('tranid')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_doc',
                            line: ctr,
                            value: result.getText('tranid')
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_soid',
                            line: ctr,
                            value: result.getValue('internalid')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_soid',
                            line: ctr,
                            value: result.getText('internalid')
                        });
                    }

                    try {
                        sublist.setSublistText({
                            id: 'custpage_ship',
                            line: ctr,
                            value: result.getText('shipdate')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_ship',
                            line: ctr,
                            value: result.getText('shipdate')
                        });
                    }

                    //var setOptions = filterBinOptions(sublist,bin,itemDrop)



                    try {
                        sublist.setSublistValue({
                            id: 'custpage_bin',
                            line: ctr,
                            value: result.getText('custcol6')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_bin',
                            line: ctr,
                            value: result.getValue('custcol6')
                        });
                    }
                  
                     try {
                        sublist.setSublistValue({
                            id: 'custpage_line',
                            line: ctr,
                            value: result.getValue('lineuniquekey')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_line',
                            line: ctr,
                            value: result.getValue('lineuniquekey')
                        });
                    }


                    try {
                        sublist.setSublistValue({
                            id: 'custpage_room',
                            line: ctr,
                            value: result.getValue('custcol_pr_room_location')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_room',
                            line: ctr,
                            value: result.getText('custcol_pr_room_location')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_qty',
                            line: ctr,
                            value: result.getValue('quantity')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_qty',
                            line: ctr,
                            value: result.getValue('quantity')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_commit',
                            line: ctr,
                            value: result.getValue('quantitycommitted')
                        });
                    }
                    catch (e) {
                        log.error('e comm', e)
                        sublist.setSublistValue({
                            id: 'custpage_commit',
                            line: ctr,
                            value: blank
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_shipped',
                            line: ctr,
                            value: result.getValue('quantityshiprecv')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_shipped',
                            line: ctr,
                            value: result.getValue('quantityshiprecv')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_billed',
                            line: ctr,
                            value: result.getValue('quantitybilled')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_billed',
                            line: ctr,
                            value: result.getText('quantitybilled')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_id',
                            line: ctr,
                            value: result.getValue('internalid')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_id',
                            line: ctr,
                            value: result.getText('internalid')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_entity',
                            line: ctr,
                            value: result.getValue('entity')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_entity',
                            line: ctr,
                            value: result.getText('entity')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_itemid',
                            line: ctr,
                            value: result.getValue('item')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_itemid',
                            line: ctr,
                            value: result.getValue('item')
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_loc',
                            line: ctr,
                            value: result.getValue('location')
                        });
                    }
                    catch (e) {
                        sublist.setSublistValue({
                            id: 'custpage_loc',
                            line: ctr,
                            value: result.getValue('location')
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
                var ordArray = [];
                var printer = context.request.parameters.custpage_print;
                var take2 = context.request.parameters.entryformquerystring;
                log.audit('take2', take2)
                var dropFirst = take2.replace('script=357&deploy=1&compid=7586874&custom_id=', '')
                var dropLast = dropFirst.replace('&lang=en_US&type=customrecord_di_build_record', '')
                log.audit('dropLast', dropLast)
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
                        var lineDoc = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_id',
                            line: x
                        })
                        var lineItem = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_itemid',
                            line: x
                        })

                        var lineRoom = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_room',
                            line: x
                        })
                        var lineQty = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_fillqty',
                            line: x
                        })
                        var customer = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_entity',
                            line: x
                        })
                        var location = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_loc',
                            line: x
                        })
                        var salesOrd = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_soid',
                            line: x
                        })


                        var lineObject = new Object()
                        lineObject.item = lineItem
                        lineObject.qty = lineQty
                        lineObject.room = lineRoom
                        lineObject.doc = lineDoc
                        lineObject.customer = customer
                        lineObject.location = location
                        lineObject.salesOrd = salesOrd


                        custArray.push(lineObject)
                    }
                }
                log.debug('ordArray.length', ordArray.length);
                log.debug('custArray', custArray);
                // log.debug('debug', context.request.parameters);
                if (custArray.length > 0) {

                    try {
                        var returnFulfillment = createCustom(custArray)
                    }
                    catch (eee) {
                        log.debug('eee', eee)
                    }


                }
            }


        }


        const createCustom = (ordArray) => {
            var parentDoc = record.create({
                type: 'customrecord_pr_mass_iful_parent'
            })
            parentDoc.setValue({
                fieldId: 'custrecord_iful_parent_customer',
                value: ordArray[0].customer
            })
            var parent = parentDoc.save()
            for (var x = 0; x < ordArray.length; x++) {
                var childDoc = record.create({
                    type: 'customrecord_pr_mass_iful_child'
                })
                childDoc.setValue({
                    fieldId: 'custrecord_iful_parent_doc',
                    value: parent
                })
                childDoc.setValue({
                    fieldId: 'custrecord_pr_mass_item',
                    value: ordArray[x].item
                })
                childDoc.setValue({
                    fieldId: 'custrecord_pr_mass_qty',
                    value: ordArray[x].qty
                })
                childDoc.setValue({
                    fieldId: 'custrecord_pr_mass_line_qty',
                    value: ordArray[x].qty
                })
                childDoc.setValue({
                    fieldId: 'custrecord_pr_mass_loc',
                    value: ordArray[x].location
                })
                  childDoc.setValue({
                    fieldId: 'custrecord_mass_room_loc',
                    value: ordArray[x].room
                })
                childDoc.setValue({
                    fieldId: 'custrecord_pr_mass_so',
                    value: ordArray[x].salesOrd
                })
                var child = childDoc.save()

                var hyperlink = `https://7513000.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=828&deploy=1&compid=7513000&h=15757d8450f85b2ead0b&item_id=${ordArray[x].item}&parent_id=${parent}&quantity_id=${ordArray[x].qty}&child_id=${child}&loc_id=${ordArray[x].location}&so_id=${ordArray[x].salesOrd}`
                var id = record.submitFields({
                    type: 'customrecord_pr_mass_iful_child',
                    id: child,
                    values: {
                        'custrecord_pr_mass_set_detail': hyperlink
                    }
                });
                // childDoc.setValue({
                //     fieldId: 'custrecord_pr_mass_set_detail',
                //     value: hyperlink
                // })
            }
            redirect.toRecord({
                type: 'customrecord_pr_mass_iful_parent',
                id: parent
            });
        }

        return {
            onRequest: onRequest
        };
    });




