/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/file', 'N/render', ['N/format']],
    function (log, serverWidget, record, search, url, redirect, file, render, format) {
        function onRequest(context) {

            if (context.request.method === 'GET') {
                var completedArr = new Array()

                var checking = context.request.parameters
                //log.debug('checking', checking)
                var originitatingID = context.request.parameters.custom_id
                ////log.debug('originitatingID', originitatingID)
                var loadRec = record.load({
                    type: 'customrecord_pl_rec_summary',
                    id: originitatingID,
                    isDynamic: true
                });
                var date = loadRec.getText({
                    fieldId: 'custrecordpl_rec_sum_date'
                })
                //log.debug('date', date)

                var location = loadRec.getValue({
                    fieldId: 'custrecordcustrecordpl_rec_sum_location'
                })
                //log.debug('location', location)

                var returnArray = getIr(date, location)
                //come back as array
                // returnObj.id = id
                // returnObj.tran = tran
                // returnObj.po = po
                // returnObj.consolidated = consolidated
                for (var x = 0; x < returnArray.length; x++) {
                    //log.audit('pre get re', returnArray[x])
                    var returnItems = getRecItems(returnArray[x])
                    log.debug('returnItems',returnItems)
                    //[{"items":"550452","quantity":1,"ir":null,"created":"46830","createdText":"Return Authorization #RMA175"}]
                    //now we have IR, Item, Qty, CF in this array/obj rel
                    //find the the consolidated
                    for (var y = 0; y < returnItems.length; y++) {
                        log.debug('returnItems[y',returnItems[y])
                        try {
                            //log.debug('in the try')
                            var fieldLookUp = search.lookupFields({
                                type: 'purchaseorder',
                                id: returnItems[y].created,
                                columns: ['custbody_zastro_po_source']
                            });
                            var consolId = fieldLookUp.custbody_zastro_po_source[0].value
                            //log.debug('fieldLookUp', fieldLookUp)
                            //log.debug('consolId', consolId)
                            var analyzeItem = returnItems[y].items
                            var finalReturn = getConsolidated(analyzeItem, consolId)
                            for(var z=0;z<finalReturn.length;z++){
                                var completedObject = new Object()
                                completedObject.ir = returnArray[x].tran
                                completedObject.purchOrd = returnArray[x].po
                                completedObject.recQ = returnItems[y].quantity.toFixed(0)
                                completedObject.item = finalReturn[z].itemName
                                completedObject.qty = finalReturn[z].qty
                                completedObject.consol = finalReturn[z].consol
                                completedObject.so = finalReturn[z].so
                                completedObject.cust = finalReturn[z].customer
                                completedArr.push(completedObject)
                            }
                            
                        }
                        catch (e) {
                            //log.error('error after lookup', e)
                            var completedObject = new Object()
                            completedObject.ir = returnArray[x].tran
                            completedObject.purchOrd = returnArray[x].po
                            completedObject.recQ = returnItems[y].quantity.toFixed(0)
                            completedObject.item = null
                            completedObject.qty = null
                            completedObject.consol = null
                            completedObject.so = null
                            completedObject.cust = null
                            completedArr.push(completedObject)
                        }
                    }




                }
                log.audit('completedArr',completedArr)
                if(completedArr.length>0){
                    pageRender(completedArr,context)
                }
                //log.debug('returnArray', returnArray)
            }
        }

        const pageRender = (finalArr, context) => {

            var form2 = serverWidget.createForm({
                title: 'Item Overview Report'
            });
            var sublist = form2.addSublist({
                id: 'sublist',
                type: serverWidget.SublistType.LIST,
                label: 'Open Order Summary'
            });

        
            var itemReceipt = sublist.addField({
                id: 'custpage_loc',
                label: 'Item Receipt',
                type: serverWidget.FieldType.TEXT,
            });
            var qty = sublist.addField({
                id: 'custpage_qtyrec',
                label: 'Qty Received',
                type: serverWidget.FieldType.TEXT,
            });
            var crefr = sublist.addField({
                id: 'custpage_po',
                label: 'Created From',
                type: serverWidget.FieldType.TEXT,
            });
   
    
            var item = sublist.addField({
                id: 'custpage_item',
                label: 'Item',
                type: serverWidget.FieldType.TEXT,
            });
            
        

            var consolidated = sublist.addField({
                id: 'custpage_consolidated',
                label: 'Consolidated PO',
                type: serverWidget.FieldType.TEXT,
            });
            var customer = sublist.addField({
                id: 'custpage_entity',
                label: 'Customer',
                type: serverWidget.FieldType.TEXT,
            });

            var doc = sublist.addField({
                id: 'custpage_doc',
                label: "Sales Order",
                type: serverWidget.FieldType.TEXT,
            });
            var qty = sublist.addField({
                id: 'custpage_qty',
                label: 'Qty Ordered',
                type: serverWidget.FieldType.TEXT,
            });


            for (var ctr = 0; ctr < finalArr.length; ctr++) {
                var netsuiteSiteUrl = 'https://system.na1.netsuite.com';

                var domain = url.resolveDomain({
                    hostType: url.HostType.APPLICATION
                });

                var blank = ' '
              
                try {
                    sublist.setSublistValue({
                        id: 'custpage_doc',
                        line: ctr,
                        value: finalArr[ctr].so
                    });
                }
                catch (e) {
                    //log.debug('loc', e)
                    sublist.setSublistValue({
                        id: 'custpage_doc',
                        line: ctr,
                        value: ' '
                    });
                }
                try {
                    sublist.setSublistValue({
                        id: 'custpage_qty',
                        line: ctr,
                        value: finalArr[ctr].qty
                    });
                }
                catch (e) {
                    sublist.setSublistValue({
                        id: 'custpage_qty',
                        line: ctr,
                        value: 0
                    });
                }
      
                try {
                    sublist.setSublistValue({
                        id: 'custpage_entity',
                        line: ctr,
                        value: finalArr[ctr].cust
                    });
                }
                catch (e) {
                    sublist.setSublistValue({
                        id: 'custpage_entity',
                        line: ctr,
                        value: blank
                    });
                }


                try {
                    sublist.setSublistValue({
                        id: 'custpage_item',
                        line: ctr,
                        value: finalArr[ctr].item
                    });
                }
                catch (e) {
                    sublist.setSublistValue({
                        id: 'custpage_item',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                    sublist.setSublistValue({
                        id: 'custpage_loc',
                        line: ctr,
                        value: finalArr[ctr].ir
                    });
                }
                catch (e) {
                    sublist.setSublistValue({
                        id: 'custpage_loc',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                    sublist.setSublistValue({
                        id: 'custpage_consolidated',
                        line: ctr,
                        value: finalArr[ctr].consol
                    });
                }
                catch (e) {
                    sublist.setSublistValue({
                        id: 'custpage_consolidated',
                        line: ctr,
                        value: blank
                    });
                }
                //log.error('finalArr[ctr].purchOrd',finalArr[ctr])
                try {
                    sublist.setSublistValue({
                        id: 'custpage_po',
                        line: ctr,
                        value: finalArr[ctr].purchOrd
                    });
                }
                catch (e) {
                    //log.error('e on set PO', e)
                    sublist.setSublistValue({
                        id: 'custpage_po',
                        line: ctr,
                        value: blank
                    });
                }
                //log.error('pre e on qty rec',finalArr[ctr])
                try {
                    sublist.setSublistValue({
                        id: 'custpage_qtyrec',
                        line: ctr,
                        value: finalArr[ctr].recQ
                    });
                }
                catch (e) {
                    //log.error('e on qty rec',e)
                    sublist.setSublistValue({
                        id: 'custpage_qtyrec',
                        line: ctr,
                        value: blank
                    });
                }


                // try {
                //     sublist.setSublistValue({
                //         id: 'custpage_date',
                //         line: ctr,
                //         value: result.getValue({ name: 'trandate' })
                //     });
                // }
                // catch (e) {
                //     sublist.setSublistValue({
                //         id: 'custpage_date',
                //         line: ctr,
                //         value: blank
                //     });
                // }


                // ctr++
            }
            form2.addSubmitButton('Save')
            context.response.writePage(form2);

            return true;

        };

        const getConsolidated = (drilldownItem, itemRecFromArr) => {
            try {
                var retArr = new Array()
                var returnObj = new Object()
                //log.debug('in get consolidated-items', drilldownItem)
                //log.debug('in get consolidated-PO', itemRecFromArr)
                var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
                    type: "customrecord_zastro_unconsolidated_items",
                    filters:
                        [
                            ["custrecord_zastro_item_name", "anyof", drilldownItem],
                            "AND",
                            ["custrecord_zastro_po_item_list", "anyof", itemRecFromArr]
                        ],
                    columns:
                        [
                            "custrecord_zastro_item_name",
                            "custrecord_zastro_so_no",
                            "custrecord_zastro_customer",
                            "custrecord_zastro_qty",
                            "custrecord_zastro_po_item_list",
                            search.createColumn({
                                name: "custrecord_zastro_po_no",
                                join: "CUSTRECORD_ZASTRO_PO_ITEM_LIST"
                            })
                        ]
                });
                var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
                //log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count", searchResultCount);
                customrecord_zastro_unconsolidated_itemsSearchObj.run().each(function (result) {

                    var itemName = result.getText({
                        name: 'custrecord_zastro_item_name',
                    })
                    //log.debug('itemName', itemName)
                    var so = result.getText({
                        name: 'custrecord_zastro_so_no',
                    })
                    //log.debug('so', so)
                    var customer = result.getText({
                        name: 'custrecord_zastro_customer',
                    })
                    //log.debug('customer', customer)
                    var qty = result.getValue({
                        name: 'custrecord_zastro_qty',
                    })
                    //log.debug('qty', qty)
                    var consol = result.getValue({
                        name: 'custrecord_zastro_po_item_list',
                    })
                    //log.debug('consol', consol)
                    var po = result.getValue({ join: 'CUSTRECORD_ZASTRO_PO_ITEM_LIST', name: 'custrecord_zastro_po_no' })
                    //log.debug('po', po)


                    returnObj.itemName = itemName
                    returnObj.so = so
                    returnObj.customer = customer
                    returnObj.qty = qty
                    returnObj.consol = consol
                    returnObj.po = po
                    retArr.push(returnObj)
                    return true;
                });
            }
            catch (e) {
                return
            }
            return retArr;
        }

        const getRecItems = (taco) => {
            //log.debug('taco', taco)
            var returnItemArray = new Array()
            var loadedRec = record.load({
                type: 'itemreceipt',
                id: taco.id,
                isDynamic: true
            })
            var createdFrom = loadedRec.getValue({
                fieldId: 'createdfrom'
            })
            var createdFromText = loadedRec.getText({
                fieldId: 'createdfrom'
            })


            var numLines = loadedRec.getLineCount({
                sublistId: 'item'
            })
            //log.debug('numLines', numLines)

            if (numLines > 0) {

                for (var x = 0; x < numLines; x++) {
                  

                    var items = loadedRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: x
                    });
                    //log.debug('items', items)
                    var quantity = loadedRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: x
                    });
                    //log.debug('quantity', quantity)
                    // log.audit('vendor', vendor)
                    if(items){
                        var returnObj = new Object()
                        returnObj.items = items;
                        returnObj.quantity = quantity;
                        returnObj.ir = taco.tran;
                        returnObj.created = createdFrom
                        returnObj.createdText = createdFromText
                        returnItemArray.push(returnObj)
                    }
                }
            }
            return returnItemArray

            //get all the items
        }

        const getIr = (date, location) => {
            //log.debug('in get ir', 'in get ir')
            var returnArray = new Array()
            var itemreceiptSearchObj = search.create({

                type: "itemreceipt",
                filters:
                    [
                        ["trandate", "on", date],
                        "AND",
                        ["mainline", "is", "T"],
                        "AND",
                        ["type", "anyof", "ItemRcpt"],
                        "AND",
                        ["taxline", "is", "F"],
                        "AND",
                        ["shipping", "is", "F"],
                        "AND",
                        ["location", "anyof", location]
                    ],
                columns:
                    [
                        "tranid",
                        "item",
                        "quantity",
                        "createdfrom",
                        search.createColumn({
                            name: "custbody_zastro_po_source",
                            join: "createdFrom"
                        }),
                        "account",
                        "custbody_link_lsa",
                        "internalid",
                    ]
            });
            //log.debug('in search', 'in search')
            var searchResultCount = itemreceiptSearchObj.runPaged().count;
            //log.debug('searchResultCount', searchResultCount);
            itemreceiptSearchObj.run().each(function (result) {
                var returnObj = new Object()
                // .run().each has a limit of 4,000 results
                var id = result.getValue({
                    name: 'internalid',
                })
                var tran = result.getValue({
                    name: 'tranid',
                })
                var po = result.getText({
                    name: 'createdfrom',
                })
                var consolidated = result.getValue({ join: 'createdFrom', name: 'custbody_zastro_po_source' })

                //log.debug('po', po)
                //log.debug('consolidated', consolidated)
                returnObj.id = id
                returnObj.tran = tran
                returnObj.po = po
                returnObj.consolidated = consolidated
                returnArray.push(returnObj)
                return true;
            });


            return returnArray
        }


        return {
            onRequest: onRequest
        };
    });