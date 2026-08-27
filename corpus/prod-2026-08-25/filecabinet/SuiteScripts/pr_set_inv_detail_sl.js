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

                var paramItem = context.request.parameters.item_id
                var paramParent = context.request.parameters.parent_id
                var paramQty = context.request.parameters.quantity_id
                var childID = context.request.parameters.child_id
                var locID = context.request.parameters.loc_id
                var soID = context.request.parameters.so_id




                log.debug('start?')
                var form2 = serverWidget.createForm({
                    title: 'Set Inventory Detail'
                });
              
                var sublist = form2.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Bin Totals'
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

                var fulfill = sublist.addField({
                    id: 'custpage_avail',
                    label: 'Quantity Available',
                    type: serverWidget.FieldType.TEXT,
                });
                var fulfill = sublist.addField({
                    id: 'custpage_fillqty',
                    label: 'Quantity To Fulfill',
                    type: serverWidget.FieldType.TEXT,
                });
                fulfill.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

                var bin = sublist.addField({
                    id: 'custpage_bin',
                    label: 'Bin Selection',
                    type: serverWidget.FieldType.TEXT,
                    //source: 'bin'
                });
                var bin = sublist.addField({
                    id: 'custpage_binid',
                    label: 'Bin ID',
                    type: serverWidget.FieldType.TEXT,
                    //source: 'bin'
                });
                var source = sublist.addField({
                    id: 'custpage_child',
                    label: 'Source',
                    type: serverWidget.FieldType.TEXT,
                    //source: 'bin'
                });

                var salesO = sublist.addField({
                    id: 'custpage_soid',
                    label: 'SO ID',
                    type: serverWidget.FieldType.TEXT,
                    //source: 'bin'
                });
                //bin.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
    

                var ctr = 0;

                log.debug('here?')

                    var inventorybalanceSearchObj = search.create({
                        type: "inventorybalance",
                        filters:
                            [
                                ["available", "greaterthan", "0"],
                                "AND",
                                ["item", "anyof", paramItem], 
                                "AND", 
                                ["location","anyof",locID]
                            ],
                        columns:
                            [
                                search.createColumn({
                                    name: "item",
                                    sort: search.Sort.ASC
                                }),
                                "binnumber",
                                "location",
                                "inventorynumber",
                                "onhand",
                                "available"
                            ]
                    });
        

                log.debug('Search_OBJ', inventorybalanceSearchObj);
                var searchResultCount = inventorybalanceSearchObj.runPaged().count;
                log.debug("inventorybalanceSearchObj result count", searchResultCount);
                inventorybalanceSearchObj.run().each(function (result) {
                    log.debug('result', result);
                    var item = result.getText('item')
                    var bin = result.getText('binnumber')
                    var binID = result.getValue('binnumber')
                    var avail = result.getValue('available')
                    if(!avail || avail == ''){
                        avail = 0
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_item',
                            line: ctr,
                            value: item
                        });
                    }
                    catch (e) {
                        log.debug('e item',e)
                        sublist.setSublistValue({
                            id: 'custpage_item',
                            line: ctr,
                            value: result.getValue('item')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_bin',
                            line: ctr,
                            value: bin
                        });
                    }
                    catch (e) {
                        log.debug('e bin',e)
                        sublist.setSublistValue({
                            id: 'custpage_bin',
                            line: ctr,
                            value: result.getValue('binnumber')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_binid',
                            line: ctr,
                            value: binID
                        });
                    }
                    catch (e) {
                        log.debug('e bin',e)
                        sublist.setSublistValue({
                            id: 'custpage_binid',
                            line: ctr,
                            value: result.getValue('binnumber')
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_avail',
                            line: ctr,
                            value: avail
                        });
                    }
                    catch (e) {
                        log.debug('e avail',e)
                        sublist.setSublistValue({
                            id: 'custpage_avail',
                            line: ctr,
                            value: result.getValue('available')
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_child',
                            line: ctr,
                            value: childID
                        });
                    }
                    catch (e) {
                        log.debug('e avail',e)
                        sublist.setSublistValue({
                            id: 'custpage_child',
                            line: ctr,
                            value: childID
                        });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_soid',
                            line: ctr,
                            value: soID
                        });
                    }
                    catch (e) {
                        log.debug('e avail',e)
                        sublist.setSublistValue({
                            id: 'custpage_soid',
                            line: ctr,
                            value: soID
                        });
                    }

                    ctr++
                    return true;
                });
                form2.addSubmitButton()
                context.response.writePage(form2);
            }
            else {
                //log.audit('generatingId', generatingID)
                var custArray = [];
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
                        var binId = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_binid',
                            line: x
                        })
                        var qty = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_fillqty',
                            line: x
                        })
                        var child = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_child',
                            line: x
                        })
                        var salesOrd = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_soid',
                            line: x
                        })


                        var lineObject = new Object()
                        lineObject.bin = binId
                        lineObject.qty = qty
                        lineObject.child = child
                        lineObject.salesOrd = salesOrd
                        custArray.push(lineObject)
                    }
                }
                if(custArray.length > 0){
                    if(custArray.length == 1){
                        var id = record.submitFields({
                            type: 'customrecord_pr_mass_iful_child',
                            id: custArray[0].child,
                            values: {
                                'custrecord_pr_mass_bin': custArray[0].bin
                            }
                        });
                    }
                    else{
                        for(var s=0;s<custArray.length;s++){
                            if(s==0){
                                var id = record.submitFields({
                                    type: 'customrecord_pr_mass_iful_child',
                                    id: custArray[s].child,
                                    values: {
                                        'custrecord_pr_mass_bin': custArray[s].bin
                                    }
                                });
                                var id = record.submitFields({
                                    type: 'customrecord_pr_mass_iful_child',
                                    id: custArray[s].child,
                                    values: {
                                        'custrecord_pr_mass_qty': custArray[s].qty
                                    }
                                });
                            }
                            else{
                                var objRecord = record.copy({
                                    type: 'customrecord_pr_mass_iful_child',
                                    id: custArray[s].child,
                                    isDynamic: true,
                                });
                                objRecord.setValue({
                                    fieldId: 'custrecord_pr_mass_bin',
                                    value: custArray[s].bin
                                })
                                objRecord.setValue({
                                    fieldId: 'custrecord_pr_mass_qty',
                                    value: custArray[s].qty
                                })
                                var newSplit = objRecord.save()
                            }
                        }
                    }
                }
              context.response.write("<script>window.close();</script>");
            }


        }

        return {
            onRequest: onRequest
        };
    });



