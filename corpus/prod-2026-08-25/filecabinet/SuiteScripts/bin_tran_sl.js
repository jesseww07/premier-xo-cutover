/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/file', 'N/render'],
    function (log, serverWidget, record, search, url, redirect, file, render) {
        function onRequest(context) {
            //try {

            var objClass = {};

            if (context.request.method === 'GET') {
                var checking = context.request.parameters
                var originitatingID = context.request.parameters.custom_id
                log.debug('aaaachecking', checking);
                log.debug('originitatingID', originitatingID);
                var delimiter = /\u0005/;


                var custRec = record.load({
                    type: 'customrecord_stored_inv_delivery',
                    id: originitatingID
                });
                var docCustomer = custRec.getValue({
                    fieldId: 'custrecord_customer_info'
                })

                var form2 = serverWidget.createForm({
                    title: 'Results Available Stored Inventory'
                });

                var sublist = form2.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Open Stored items'
                });
                var addf = sublist.addField({
                    id: 'view',
                    label: 'View',
                    type: serverWidget.FieldType.URL,
                    source: null
                }).linkText = 'VIEW'

                var editf = sublist.addField({
                    id: 'edit',
                    label: 'Edit',
                    type: serverWidget.FieldType.URL,
                    source: null
                }).linkText = 'EDIT';

                var internalId = sublist.addField({
                    id: 'custpage_internalid',
                    label: 'ID',
                    type: serverWidget.FieldType.TEXT,
                });
                var soNum = sublist.addField({
                    id: 'custpage_so',
                    label: 'Sales Order',
                    type: serverWidget.FieldType.TEXT,
                });
                var trayName = sublist.addField({
                    id: 'custpage_item',
                    label: 'Item',
                    type: serverWidget.FieldType.TEXT,
                });
                var trayLocation = sublist.addField({
                    id: 'custpage_qty',
                    label: 'Quantity',
                    type: serverWidget.FieldType.TEXT,
                });
                var currentBin = sublist.addField({
                    id: 'custpage_bin',
                    label: 'Bin Number',
                    type: serverWidget.FieldType.TEXT,
                });
                var check = sublist.addField({
                    id: 'custpage_selected',
                    label: 'Select',
                    type: serverWidget.FieldType.CHECKBOX,
                });
                var selectBin = sublist.addField({
                    id: 'custpage_new_bin',
                    label: 'New Bin',
                    type: serverWidget.FieldType.SELECT,
                    source: 'bin'
                });
                var selectQty = sublist.addField({
                    id: 'custpage_new_qty',
                    label: 'Qty to Move',
                    type: serverWidget.FieldType.TEXT
                });
                var itemid = sublist.addField({
                    id: 'custpage_itemid',
                    label: 'Item',
                    type: serverWidget.FieldType.TEXT,
                });
                selectBin.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
                selectQty.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });



                var results = [];
                var netsuiteSiteUrl = 'https://system.na1.netsuite.com';
                var ctr = 0;
                var domain = url.resolveDomain({
                    hostType: url.HostType.APPLICATION
                });
                var itemSearchObj = search.create({
                    type: "customrecord_stored_inventory_contents",
                    filters:
                        [
                            search.createFilter({
                                name: 'custrecord_delivered',
                                operator: search.Operator.IS,
                                values: ['F']
                            }),
                            search.createFilter({
                                name: 'custrecord_customer_info',
                                join: 'custrecord_parent_record',
                                operator: search.Operator.ANYOF,
                                values: docCustomer
                            }),
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "internalid",
                            }),
                            search.createColumn({
                                name: "custrecord_stored_item",
                            }),
                            search.createColumn({
                                name: "custrecord_stored_qty",
                            }),
                            search.createColumn({
                                name: "custrecord_stored_bin",
                            }),
                            search.createColumn({
                                name: "custrecord_contents_sales_order",
                            }),
                            
                        ]
                });

                log.debug('Search_OBJ', itemSearchObj);
                var searchResultCount = itemSearchObj.runPaged().count;
                log.debug("itemSearchObj result count", searchResultCount);
                itemSearchObj.run().each(function (result) {
                    //log.debug('result', result);

                    var viewUrl = url.resolveRecord({
                        recordType: 'customrecord_stored_inventory_contents',
                        recordId: result.id,
                        isEditMode: false
                    });

                    var editUrl = url.resolveRecord({
                        recordType: 'customrecord_stored_inventory_contents',
                        recordId: result.id,
                        isEditMode: true
                    });

                    sublist.setSublistValue({
                        id: 'view',
                        line: ctr,
                        value: 'https://' + domain + viewUrl
                    });

                    sublist.setSublistValue({
                        id: 'edit',
                        line: ctr,
                        value: 'https://' + domain + editUrl
                    });
                    sublist.setSublistValue({
                        id: 'custpage_internalid',
                        line: ctr,
                        value: result.getValue('internalid')
                    });
                    sublist.setSublistValue({
                        id: 'custpage_so',
                        line: ctr,
                        value: result.getText('custrecord_contents_sales_order')
                    });
                    sublist.setSublistValue({
                        id: 'custpage_item',
                        line: ctr,
                        value: result.getText('custrecord_stored_item')
                    });
                    sublist.setSublistValue({
                        id: 'custpage_itemid',
                        line: ctr,
                        value: result.getValue('custrecord_stored_item')
                    });
                    sublist.setSublistValue({
                        id: 'custpage_itemid',
                        line: ctr,
                        value: result.getValue('custrecord_stored_item')
                    });
                    //var docDate = result.getValue('trandate')
                  
                        sublist.setSublistValue({
                            id: 'custpage_qty',
                            line: ctr,
                            value: result.getValue('custrecord_stored_qty')
                        });
                    
                    
                    //var poNum = result.getValue('otherrefnum')
                 
                        sublist.setSublistValue({
                            id: 'custpage_bin',
                            line: ctr,
                            value: result.getText('custrecord_stored_bin')
                        });
                    

                    ctr++
                    //}
                    return true;
                });
                log.debug('results', results);
                var suiteletUrl = url.resolveScript({
                    scriptId: 'customscript155',
                    deploymentId: 'customdeploy1',
                    returnExternalUrl: false
                });
             
                form2.addSubmitButton('Save')
                context.response.writePage(form2);

            }
            else {
                var checking = context.request.parameters
                var originitatingID = context.request.parameters.custom_id
                log.debug('in post aaaachecking', checking);
                log.debug('originitatingID', originitatingID);
                var custArray = [];
                var requestCount = context.request.getLineCount({
                    group: 'sublist'
                });
                log.debug('requestCount',requestCount)
                for (var x = 0; x < requestCount; x++) {
                    var selected = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_selected',
                        line: x
                    })
                    log.debug('selected',selected)
                    if (selected == 'T') {
                        var lineID = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_internalid',
                            line: x
                        })
                        var originalBin = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_bin',
                            line: x
                        })
                        var newBin = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_new_bin',
                            line: x
                        })
                        var item = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_itemid',
                            line: x
                        })
                        var qty = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_qty',
                            line: x
                        })
                        var qtyToMove = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_new_qty',
                            line: x
                        })
                    
                        var arrayObject = new Object()
                        arrayObject.item = item
                        arrayObject.newBin = newBin
                        arrayObject.originalBin = originalBin
                        arrayObject.qty = qty
                        arrayObject.qtyToMove = qtyToMove
                        arrayObject.id = lineID
                        custArray.push(arrayObject)
                    }
                }
            
                log.debug('custArray', custArray);
                log.debug('debug', context.request.parameters);
                if(custArray.length > 0){
                    var deliveryRecord = createBinTransfer(custArray)
                    var editedRecord = editContentRecord(custArray)
                }


                redirect.toRecord({
                    type : 'bintransfer',
                    id : deliveryRecord
                   });
             
    
            }


        }
        const splitCustRecord = (info) => {
            var objRecord = record.copy({
                type: 'customrecord_stored_inventory_contents',
                id: info.id,
                isDynamic: true,
               });
               objRecord.setValue({
                   fieldId: 'custrecord_stored_qty',
                   value: info.qtyToMove
               })
               objRecord.setValue({
                fieldId: 'custrecord_stored_bin',
                value: info.newBin
            })
            var splitRecord = objRecord.save()
            return splitRecord
        }

        const editContentRecord = (custArray) => {
            for(var x=0; x<custArray.length;x++){
                if(custArray[x].qty != custArray[x].qtyToMove){
                    var leftQty = Number(custArray[x].qty) - Number(custArray[x].qtyToMove)
                    //we need to split the document
                    var custRec = record.load({
                        type: 'customrecord_stored_inventory_contents',
                        id: custArray[x].id
                    })
                    custRec.setValue({
                        fieldId: 'custrecord_stored_qty',
                        value: leftQty
                    })
                    var splitRecord = splitCustRecord(custArray[x])
                }
                else{
                    var custRec = record.load({
                        type: 'customrecord_stored_inventory_contents',
                        id: custArray[x].id
                    })
                    custRec.setValue({
                        fieldId: 'custrecord_stored_bin',
                        value: custArray[x].newBin
                    })
                }
                custRec.save()
            }
            return
        }

        const createBinTransfer = (custArray) => {
            var binTran = record.create({
                type: 'bintransfer',
                isDynamic: true,
            })
            binTran.setValue({
                fieldId: 'location',
                value: 9
            })
            for(var x=0; x<custArray.length; x++){
                log.debug('custArray[x].newBin',custArray[x].newBin)
                log.debug('custArray[x].originalBin',custArray[x].originalBin)
                log.debug('custArray[x].qty',custArray[x].qty)
                log.debug('custArray[x].qtyToMove',custArray[x].qtyToMove)
                log.debug('custArray[x].item',custArray[x].item)
                binTran.selectNewLine({
                    sublistId: 'inventory'
                });
                binTran.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'item',
                    value: custArray[x].item
                });
                binTran.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'quantity',
                    value: custArray[x].qtyToMove
                });
                var subrec = binTran.getCurrentSublistSubrecord({
                    sublistId: 'inventory',
                    fieldId: 'inventorydetail'
                });
                subrec.selectNewLine({
                    sublistId: 'inventoryassignment'
                });
         
                if(custArray[x].originalBin == 'Unassigned'){
                    var useBin = 2
            }
            else{
                var useBin = getBinID(custArray[x].originalBin)
            }
            log.debug('useBin',useBin)
            log.debug('custArray[x].newBin',custArray[x].newBin)
                subrec.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'binnumber',
                    value: useBin
                });
                subrec.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'tobinnumber',
                    value: custArray[x].newBin
                });
                subrec.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'quantity',
                    value: custArray[x].qtyToMove
                });
                subrec.commitLine({
                    sublistId: 'inventoryassignment'
                });
           
                binTran.commitLine({
                    sublistId: 'inventory'
                })
                var docNum = binTran.save()
                return docNum
            }
           
        }

        const getBinID = (name) => {
            var returnId = ''
            var binSearchObj = search.create({
                type: "bin",
                filters:
                [
                   ["binnumber","is",name], 
                   "AND", 
                   ["location","anyof","9"]
                ],
                columns:
                [
                   "internalid"
                ]
             });
             var searchResultCount = binSearchObj.runPaged().count;
             log.debug("binSearchObj result count",searchResultCount);
             binSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var binname = result.getValue({
                    name: 'internalid'
                })
                returnId = binname
                return true;
             });
             return returnId
        }
    

        function returner(word){
            word = word.replace(/&/g, "&amp;")
            word = word.replace(/</g, "&lt;")
            word = word.replace(/>/g, "&gt;")
            word = word.replace(/'/g, "&#39;")
            word = word.replace(/"/g, "&quot;");
            return word
            }



        return {
            onRequest: onRequest
        };
    });