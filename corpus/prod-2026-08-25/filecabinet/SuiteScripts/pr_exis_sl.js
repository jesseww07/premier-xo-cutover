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
var filterArray = [];
            var vendor = context.request.parameters.custom_id
            log.debug('vendor', vendor);
            var ordLoc = context.request.parameters.loc_id
            var getFilter = context.request.parameters.custpage_selected_phx; //After the client script fieldchanged (Redirect)
            log.debug('phx_filter', getFilter);
            var getFilter1 = context.request.parameters.custpage_selected_sdl; //After the client script fieldchanged (Redirect)
            log.debug('sdl_filter', getFilter1);
            var getFilter2 = context.request.parameters.custpage_selected_tuc; //After the client script fieldchanged (Redirect)
            log.debug('tuc_filter', getFilter2);
            log.debug('ordLoc',ordLoc)
            if(ordLoc == 8){
               var locText = 'PHX'
            }
            else if(ordLoc == 6){
               var locText = 'SDL'
            }
            else if(ordLoc == 3){
               var locText = 'TUC'
            }
            else{
               var locText = ' '
            }
            var returnValues = getLocationValue(vendor)
            var pVal = 0
            var tVal = 0
            var sVal = 0
            if(returnValues.length>0){
               for(var j=0;j<returnValues.length;j++){
                   var arrLoc = returnValues[j].loc
                   if(arrLoc == 8){
                       pVal = returnValues[j].total
                   }
                   else if(arrLoc == 6){
                       sVal = returnValues[j].total 
                   }
                   else if(arrLoc == 3){
                       tVal = returnValues[j].total
                   }
               }
            }
            log.debug('start?', vendor);
            var form2 = serverWidget.createForm({
                title: `${locText} Order Items`
            });
            log.debug('form?')
            form2.clientScriptFileId = 217244;
            var locSelectPhx = form2.addField({
               id: 'custpage_selected_phx',
               label: 'Filter PHX',
               type: serverWidget.FieldType.CHECKBOX,
           });
           var locSelectSdl = form2.addField({
               id: 'custpage_selected_sdl',
               label: 'Filter SDL',
               type: serverWidget.FieldType.CHECKBOX,
           });
           var locSelectTuc = form2.addField({
               id: 'custpage_selected_tuc',
               label: 'Filter TUC',
               type: serverWidget.FieldType.CHECKBOX,
           });
           var locAll = form2.addField({
            id: 'custpage_selected_all',
            label: 'Filter All',
            type: serverWidget.FieldType.CHECKBOX,
        });
        if (getFilter && getFilter1 && getFilter2) {
            locSelectPhx.defaultValue = 'F';
            filterArray.push(8);
            locSelectSdl.defaultValue = 'F';
            filterArray.push(6);
            locSelectTuc.defaultValue = 'F';
            filterArray.push(3);
            locAll.defaultValue = 'T';
        } else if (getFilter || getFilter1 || getFilter2) {
           if (getFilter) { //if getFilter has a value then set defaultValue
            locSelectPhx.defaultValue = 'T';
            filterArray.push(8);
        }
        if (getFilter1) { //if getFilter1 has a value then set defaultValue
            locSelectSdl.defaultValue = 'T';
            filterArray.push(6);
        }
        if (getFilter2) { //if getFilter2 has a value then set defaultValue
            locSelectTuc.defaultValue = 'T';
            filterArray.push(3);
        }
    } else {
        if (ordLoc == 8) {
            locSelectPhx.defaultValue = 'T';
            filterArray.push(8);
        } else if (ordLoc == 6) {
            locSelectSdl.defaultValue = 'T';
            filterArray.push(6);
        } else if (ordLoc == 3) {
            locSelectSdl.defaultValue = 'T';
            filterArray.push(6);
        }
    }
        //    form2.addButton({
        //     id: "filter",
        //     label: "Filter",
        //     functionName: "executeRecurring('" + filterForClient + "')",
        //   });
        //   form2.addButton({
        //     id: "filter",
        //     label: "Filter",
        //     functionName: "executeRecurring('" + context + "')",
        //   });
           var hide = form2.addField({
               id: 'custpage_hide',
               label: 'Original Location',
               type: serverWidget.FieldType.TEXT,
           });
           hide.defaultValue = ordLoc;
           hide.updateDisplayType({
               displayType: serverWidget.FieldDisplayType.HIDDEN
           });
           var hide2 = form2.addField({
               id: 'custpage_hidetwo',
               label: 'Original Vendor',
               type: serverWidget.FieldType.TEXT,
           });
           hide2.defaultValue = vendor;
           hide2.updateDisplayType({
               displayType: serverWidget.FieldDisplayType.HIDDEN
           });
   
           var pTot = form2.addField({
               id: 'custpage_selected_phx_unordered',
               label: 'Current PHX Unordered Value',
               type: serverWidget.FieldType.TEXT,
           });
           pTot.defaultValue = pVal;
           var sTot = form2.addField({
               id: 'custpage_selected_sdl_unordered',
               label: 'Current SDL Unordered Value',
               type: serverWidget.FieldType.TEXT,
           });
           sTot.defaultValue = sVal;
           var tTot = form2.addField({
               id: 'custpage_selected_tuc_unordered',
               label: 'Current TUC Unordered Value',
               type: serverWidget.FieldType.TEXT,
           });
           tTot.defaultValue = tVal;
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
            var ordLocation = sublist.addField({
               id: 'custpage_loc',
               label: 'Item',
               type: serverWidget.FieldType.TEXT,
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
                label: 'Vendor',
                type: serverWidget.FieldType.TEXT,
            });
            var parentID = sublist.addField({
                id: 'custpage_parent_id',
                label: 'Vendor ID',
                type: serverWidget.FieldType.TEXT,
            });
            var itemID = sublist.addField({
                id: 'custpage_item_id',
                label: 'Item ID',
                type: serverWidget.FieldType.TEXT,
            });
            var uniqueId = sublist.addField({
                id: 'custpage_unique',
                label: 'Unique ID',
                type: serverWidget.FieldType.TEXT,
            });
            var poID = sublist.addField({
                id: 'custpage_po_id',
                label: 'PO ID',
                type: serverWidget.FieldType.TEXT,
            });


            
            var ctr = 0;
            var blank = ' '

            // var payload = getQuery(vendor)
            // log.debug('payload',payload)
            // log.debug('payload len',payload.length)
            // for(var x=0;x<payload.length;x++){
                if (filterArray.length > 0) {
            var customrecord_consolidated_special_orderSearchObj = search.create({
                type: "customrecord_consolidated_special_order",
                filters:
                    [
                        ["custrecord_special_consolidated_linked", "is", "F"],
                        "AND",
                        ["custrecord_special_consolidated_vendor", "anyof", vendor],
                        "AND",
                        ["formulanumeric: CASE WHEN {custrecord_special_consolidated_item.othervendor}={custrecord_special_consolidated_item.vendor} THEN 1 ELSE 0 END","equalto","1"],
                        "AND",
                        ["custrecord_special_consolidated_so.mainline", "is", "T"],
                        "AND",
                        stringFieldAnyOf('custrecord_special_consolidated_sl.custrecord_pr_vendor_sl_loc', filterArray)
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "id",
                            sort: search.Sort.ASC
                        }),
                        "custrecord_special_consolidated_item",
                        "custrecord_special_consolidated_room",
                        "custrecord_special_consolidated_po",
                        "custrecord_special_consolidated_so",
                        search.createColumn({
                            name: "custrecord_pr_vendor_sl_loc",
                            join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SL",
                            label: "Location"
                         }),
                        "custrecord_special_consolidated_key",
                        search.createColumn({
                            name: "formulatext",
                            formula: "CASE WHEN {othervendor}={vendor} THEN {vendor} ELSE NULL END",
                            label: "Formula (Text)"
                         }),
                        search.createColumn({
                            name: "vendorcostentered",
                            join: "CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM"
                        }),
                        "custrecord_special_consolidated_qty",
                        "custrecord_special_consolidated_vendor",
                        search.createColumn({
                            name: "entity",
                            join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO"
                        }),
                        "custrecord_consolidated_po_unique"
                    ]
            });
        } 
        // else {
        //     var customrecord_consolidated_special_orderSearchObj = search.create({
        //         type: "customrecord_consolidated_special_order",
        //         filters:
        //             [
        //                 ["custrecord_special_consolidated_linked", "is", "F"],
        //                 "AND",
        //                 ["custrecord_special_consolidated_vendor", "anyof", vendor],
        //                 "AND",
        //                 ["formulanumeric: CASE WHEN {custrecord_special_consolidated_item.othervendor}={custrecord_special_consolidated_item.vendor} THEN 1 ELSE 0 END","equalto","1"],
        //                 "AND",
        //                 ["custrecord_special_consolidated_so.mainline", "is", "T"],
        //                 "AND",
        //                 ['custrecord_special_consolidated_sl.custrecord_pr_vendor_sl_loc', 'anyof', ordLoc]
        //             ],
        //         columns:
        //             [
        //                 search.createColumn({
        //                     name: "id",
        //                     sort: search.Sort.ASC
        //                 }),
        //                 "custrecord_special_consolidated_item",
        //                 "custrecord_special_consolidated_room",
        //                 "custrecord_special_consolidated_po",
        //                 "custrecord_special_consolidated_so",
        //                 search.createColumn({
        //                     name: "custrecord_pr_vendor_sl_loc",
        //                     join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SL",
        //                     label: "Location"
        //                  }),
        //                 "custrecord_special_consolidated_key",
        //                 search.createColumn({
        //                     name: "formulatext",
        //                     formula: "CASE WHEN {othervendor}={vendor} THEN {vendor} ELSE NULL END",
        //                     label: "Formula (Text)"
        //                  }),
        //                 search.createColumn({
        //                     name: "vendorcostentered",
        //                     join: "CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM"
        //                 }),
        //                 "custrecord_special_consolidated_qty",
        //                 "custrecord_special_consolidated_vendor",
        //                 search.createColumn({
        //                     name: "entity",
        //                     join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO"
        //                 }),
        //                 "custrecord_consolidated_po_unique"
        //             ]
        //     }); 
        // }
            var searchResultCount = customrecord_consolidated_special_orderSearchObj.runPaged().count;
            log.debug("customrecord_consolidated_special_orderSearchObj result count", searchResultCount);
            customrecord_consolidated_special_orderSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var item = result.getText({
                    name: 'custrecord_special_consolidated_item'
                })
                var itemId = result.getValue({
                    name: 'custrecord_special_consolidated_item'
                })
                var id = result.getValue({
                    name: 'id'
                })
                var room = result.getValue({
                    name: 'custrecord_special_consolidated_room'
                })
                var po = result.getText({
                    name: 'custrecord_special_consolidated_po'
                })
                var loc = result.getText({
                   name: 'custrecord_pr_consol_ord_loc',
                   join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SL'
               })
                var poid = result.getValue({
                    name: 'custrecord_special_consolidated_po'
                })
                var so = result.getText({
                    name: 'custrecord_special_consolidated_so'
                })
                var key = result.getValue({
                    name: 'custrecord_special_consolidated_key'
                })
                var qty = result.getValue({
                    name: 'custrecord_special_consolidated_qty'
                })
                var vendor = result.getText({
                    name: 'custrecord_special_consolidated_vendor'
                })
                var venId = result.getValue({
                    name: 'custrecord_special_consolidated_vendor'
                })
                var customer = result.getText({
                    join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO',
                    name: 'entity'
                })
                var venprice = result.getValue({
                    join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM',
                    name: 'vendorcostentered'
                })
                var unique = result.getValue({
                    name: 'custrecord_consolidated_po_unique'
                })

                var returnObj = new Object()
                returnObj.item = item
                returnObj.itemId = itemId
                returnObj.id = id
                returnObj.room = room
                returnObj.po = po
                returnObj.poid = poid
                returnObj.so = so
                returnObj.key = key
                returnObj.qty = qty
                returnObj.vendor = vendor
                returnObj.customer = customer
                returnObj.venprice = venprice
                returnObj.venId = venId
                returnObj.unique = unique
                returnObj.loc = loc
                //returnArr.push(returnObj)


                try {
                    sublist.setSublistValue({
                        id: 'custpage_item',
                        line: ctr,
                        value: returnObj.item
                    });
                }
                catch (eee) {
                    log.debug('eee i', eee)
                    sublist.setSublistValue({
                        id: 'custpage_item',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                    sublist.setSublistValue({
                        id: 'custpage_po_id',
                        line: ctr,
                        value: returnObj.poid
                    });
                }
                catch (eee) {
                    log.debug('eee i', eee)
                    sublist.setSublistValue({
                        id: 'custpage_po_id',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                   sublist.setSublistValue({
                       id: 'custpage_loc',
                       line: ctr,
                       value: returnObj.loc
                   });
               }
               catch (eee) {
                   log.debug('eee i', eee)
                   sublist.setSublistValue({
                       id: 'custpage_loc',
                       line: ctr,
                       value: blank
                   });
               }
                
                try {
                    sublist.setSublistValue({
                        id: 'custpage_unique',
                        line: ctr,
                        value: returnObj.unique
                    });
                }
                catch (eee) {
                    log.debug('eee i', eee)
                    sublist.setSublistValue({
                        id: 'custpage_unique',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                    sublist.setSublistValue({
                        id: 'custpage_item_id',
                        line: ctr,
                        value: returnObj.itemId
                    });
                }
                catch (eee) {
                    log.debug('eee i', eee)
                    sublist.setSublistValue({
                        id: 'custpage_item_id',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                    sublist.setSublistValue({
                        id: 'custpage_qty',
                        line: ctr,
                        value: returnObj.qty
                    });
                }
                catch (eee) {
                    log.debug('eee q', eee)
                    sublist.setSublistValue({
                        id: 'custpage_qty',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                    sublist.setSublistValue({
                        id: 'custpage_child',
                        line: ctr,
                        value: returnObj.id
                    });
                }
                catch (eee) {
                    log.debug('eee c', eee)
                    sublist.setSublistValue({
                        id: 'custpage_child',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                    sublist.setSublistValue({
                        id: 'custpage_parent',
                        line: ctr,
                        value: returnObj.vendor
                    });
                }
                catch (eee) {
                    log.debug('eee p', eee)
                    sublist.setSublistValue({
                        id: 'custpage_parent',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                    sublist.setSublistValue({
                        id: 'custpage_parent_id',
                        line: ctr,
                        value: returnObj.vendor
                    });
                }
                catch (eee) {
                    log.debug('eee id', eee)
                    sublist.setSublistValue({
                        id: 'custpage_parent_id',
                        line: ctr,
                        value: blank
                    });
                }

                try {
                    sublist.setSublistValue({
                        id: 'custpage_cust',
                        line: ctr,
                        value: returnObj.customer
                    });
                }
                catch (eee) {
                    log.debug('eee cus', eee)
                    sublist.setSublistValue({
                        id: 'custpage_cust',
                        line: ctr,
                        value: blank
                    });
                }
                log.debug('end loop iteration', ctr)
                ctr++
                log.debug('after loop iteration', ctr)
                return true;
                //return true;
            });
            // log.debug('in loop',x)
            // .run().each has a limit of 4,000 results






            form2.addSubmitButton()
            context.response.writePage(form2);
        }
        else {
            //log.audit('generatingId', generatingID)
            var custArray = [];

            var requestCount = context.request.getLineCount({
                group: 'sublist'
            });
            var origloc = context.request.parameters.custpage_hide
            var origVen = context.request.parameters.custpage_hidetwo
            log.debug('context.request', context.request)
            log.debug('context.request.parameters', context.request.parameters)
            log.debug('origloc', origloc)
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
                    var recId = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_child',
                        line: x
                    })
                    var vendorId = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_parent_id',
                        line: x
                    })
                    var itemId = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_item_id',
                        line: x
                    })
                    var itemQty = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_qty',
                        line: x
                    })
                    var unique = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_unique',
                        line: x
                    })
                    var poid = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_po_id',
                        line: x
                    })

                    
                    var returnObj = new Object()
                    returnObj.recId = recId
                    returnObj.vendorId = vendorId
                    returnObj.itemId = itemId
                    returnObj.itemQty = itemQty
                    returnObj.unique = unique
                    returnObj.poid = poid
                    returnObj.origloc = origloc
                    returnObj.origVen = origVen
                    custArray.push(returnObj)
                }
            }
            log.debug('custArray', custArray);
            // log.debug('debug', context.request.parameters);
            if (custArray) {
                var returnPO = createConsolidatePO(custArray)
                var returnChild = markChildLinked(custArray,returnPO)
                redirect.toRecord({
                    type: record.Type.INBOUND_SHIPMENT,
                    id: returnPO
                })
            }


            // redirect.toRecord({
            //     type: 'customrecord_zastro_po_consolid',
            //     id: returnedHoldDoc
            // });
        }


    }
    const getLocationValue = (vendor) => {
       var returnArr = new Array()
       var customrecord_consolidated_vendor_selectSearchObj = search.create({
           type: "customrecord_consolidated_vendor_select",
           filters:
           [
              ["custrecord_vendor_select_vendor","anyof",vendor]
           ],
           columns:
           [
              search.createColumn({
                 name: "id",
                 sort: search.Sort.ASC
              }),
              "custrecord_pr_vendor_sl_loc",
              "custrecord_unordered_totals_stored"
           ]
        });
        var searchResultCount = customrecord_consolidated_vendor_selectSearchObj.runPaged().count;
        log.debug("customrecord_consolidated_vendor_selectSearchObj result count",searchResultCount);
        customrecord_consolidated_vendor_selectSearchObj.run().each(function(result){
           // .run().each has a limit of 4,000 results
           var returnObj = new Object
           returnObj.loc = result.getValue({name:'custrecord_pr_vendor_sl_loc'})
           returnObj.total = result.getValue({name:'custrecord_unordered_totals_stored'})
           returnArr.push(returnObj)
           return true;
        });
        return returnArr
    }
    const markChildLinked = (arr, inb) => {
        for(var x=0;x<arr.length;x++){
            var custRec = record.load({
                type:'customrecord_consolidated_special_order',
                id:arr[x].recId,
                isDynamic:true
            })
            custRec.setValue({
                fieldId:'custrecord_inbound_shipment',
                value:inb
            })
            custRec.setValue({
                fieldId:'custrecord_special_consolidated_linked',
                value:true
            })
            custRec.save()
        }
    }

    const createConsolidatePO = (custArray) => {
        log.debug('custArray',custArray)
        if(custArray.length>0){
            var inboundShipment = record.create({
                type: record.Type.INBOUND_SHIPMENT,
                isDynamic: true
            });
            inboundShipment.setValue({
               fieldId:'custrecord_pr_location_inb',
               value:custArray[0].origloc
            })
            inboundShipment.setValue({
               fieldId:'custrecord_pr_inb_ven',
               value:custArray[0].origVen
            })
            for(var x=0;x<custArray.length;x++){
                inboundShipment.selectNewLine({
                    sublistId: 'items'
                });
                inboundShipment.setCurrentSublistValue({
                    sublistId: 'items',
                    fieldId: 'purchaseorder',
                    value: custArray[x].poid
                });
                inboundShipment.setCurrentSublistValue({
                    sublistId: 'items',
                    fieldId: 'shipmentitem',
                    value: custArray[x].unique
                });
                inboundShipment.commitLine({
                    sublistId: 'items'
                });
            }
            var inboundShipmentId = inboundShipment.save();
            return inboundShipmentId
        }
    }

    function stringFieldAnyOf(fieldId, listOfValues) {
        var result = [];
        if (listOfValues.length > 0) {
            for (var i = 0; i < listOfValues.length; i++) {
                result.push([fieldId, 'anyof', listOfValues[i]]);
                result.push('or');
            }
            result.pop(); // remove the last 'or'
        }
        log.debug('result', result);
        return result;
    }

    return {
        onRequest: onRequest
    };
});



// var purchaseOrder = record.load({
//     type: record.Type.PURCHASE_ORDER,
//     id: 1718,
//     isDynamic: true
// });
// var itemLineCount = purchaseOrder.getLineCount({
//     sublistId: 'item'
// });
// for (var i = 1; i <= itemLineCount; i++) {
//     inboundShipment.selectNewLine({
//         sublistId: 'items'
//     });
//     inboundShipment.setCurrentSublistValue({
//         sublistId: 'items',
//         fieldId: 'purchaseorder',
//         value: purchaseOrder.getId()
//     });
//     inboundShipment.setCurrentSublistValue({
//         sublistId: 'items',
//         fieldId: 'shipmentitem',
//         value: purchaseOrder.getSublistValue({
//             sublistId: 'item',
//             fieldId: 'lineuniquekey',
//             line: i
//         })
//     });
//     inboundShipment.commitLine({
//         sublistId: 'items'
//     });
// }
// var inboundShipmentId = inboundShipment.save();

// var inboundShipmentUpdate = record.load({
//     type: record.Type.INBOUND_SHIPMENT,
//     id: inboundShipmentId,
//     isDynamic: true
// });
// inboundShipmentUpdate.setValue({
//     fieldId: 'shipmentstatus',
//     value: 'inTransit'
// });
// inboundShipmentUpdate.setValue({
//     fieldId: 'externaldocumentnumber',
//     value: 'EDN645'
// });
// inboundShipmentUpdate.setValue({
//     fieldId: 'expectedshippingdate',
//     value: new Date('8/2/2017')
// });
// inboundShipmentUpdate.selectLine({
//     sublistId: 'items',
//     line: 1
// });
// inboundShipmentUpdate.setCurrentSublistValue({
//     sublistId: 'items',
//     fieldId: 'receivinglocation',
//     value: 6
// });
// inboundShipmentUpdate.setCurrentSublistValue({
//     sublistId: 'items',
//     fieldId: 'quantityexpected',
//     value: 1
// });
// inboundShipmentUpdate.setCurrentSublistValue({
//     sublistId: 'items',
//     fieldId: 'expectedrate',
//     value: 10.5
// });
// inboundShipmentUpdate.commitLine({
//     sublistId: 'items'
// });
// var recId = inboundShipmentUpdate.save();

// var takeOwnership = record.load({
//     type: record.Type.BULK_OWNERSHIP_TRANSFER,
//     id: inboundShipmentId,
//     isDynamic: true
// });
// takeOwnership.selectLine({
//     sublistId: 'items',
//     line: 2
// });
// takeOwnership.setCurrentSublistValue({
//     sublistId: 'items',
//     fieldId: 'process',
//     value: 'F'
// });
// takeOwnership.commitLine({
//     sublistId: 'items'
// });
// var recId2 = takeOwnership.save();

// var bulkReceive = record.load({
//     type: record.Type.RECEIVE_INBOUND_SHIPMENT,
//     id: inboundShipmentId,
//     isDynamic: true
// });
// bulkReceive.selectLine({
//     sublistId: 'receiveitems',
//     line: 2
// });
// bulkReceive.setCurrentSublistValue({
//     sublistId: 'receiveitems',
//     fieldId: 'quantitytobereceived',
//     value: 1
// });
// bulkReceive.commitLine({
//     sublistId: 'receiveitems'
// });
// var recId3 = bulkReceive.save(); 