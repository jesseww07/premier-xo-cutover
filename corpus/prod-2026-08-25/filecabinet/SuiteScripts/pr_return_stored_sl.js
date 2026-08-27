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
                    type: 'customer',
                    id: originitatingID
                });
                // var docCustomer = custRec.getValue({
                //     fieldId: 'custrecord_customer_info'
                // })

                var form2 = serverWidget.createForm({
                    title: 'Remaining Stored Inventory'
                });

                var sublist = form2.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Open Stored Items'
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
                var amount = sublist.addField({
                    id: 'custpage_return',
                    label: 'Amount to Return',
                    type: serverWidget.FieldType.TEXT,
                });
                amount.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
                var itemid = sublist.addField({
                    id: 'custpage_itemid',
                    label: 'Item ID',
                    type: serverWidget.FieldType.TEXT,
                });
                var cust = sublist.addField({
                    id: 'custpage_cust',
                    label: 'Customer',
                    type: serverWidget.FieldType.TEXT,
                });
                var sell = sublist.addField({
                    id: 'custpage_sell',
                    label: 'Item Sell',
                    type: serverWidget.FieldType.TEXT,
                });
                var cost = sublist.addField({
                    id: 'custpage_cost',
                    label: 'Item Cost',
                    type: serverWidget.FieldType.TEXT,
                });
                var cost = sublist.addField({
                    id: 'custpage_binid',
                    label: 'Bin ID',
                    type: serverWidget.FieldType.TEXT,
                });
                
           
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
                                values: originitatingID
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
                            search.createColumn({
                                name: "custrecord_contents_customer",
                            }),
                            search.createColumn({
                                name: "custrecord_pr_selling_rate",
                            }),
                            search.createColumn({
                                name: "custrecord_pr_cost",
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
                        sublist.setSublistValue({
                            id: 'custpage_binid',
                            line: ctr,
                            value: result.getValue('custrecord_stored_bin')
                        });
                        sublist.setSublistValue({
                            id: 'custpage_cust',
                            line: ctr,
                            value: result.getValue('custrecord_contents_customer')
                        });
                  try{
                               sublist.setSublistValue({
                            id: 'custpage_cost',
                            line: ctr,
                            value: result.getValue('custrecord_pr_cost')
                        });
                  }
                  catch(e){
                               sublist.setSublistValue({
                            id: 'custpage_cost',
                            line: ctr,
                            value: ' '
                        });
                  }
             	try{
                         sublist.setSublistValue({
                            id: 'custpage_sell',
                            line: ctr,
                            value: result.getValue('custrecord_pr_selling_rate')
                        });
                }catch(e){
                         sublist.setSublistValue({
                            id: 'custpage_sell',
                            line: ctr,
                            value: ' '
                        });
                }
                 

                        
                        
                        

                    ctr++
                    //}
                    return true;
                });
                log.debug('results', results);
           
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
                            name: 'custpage_binid',
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
                        var custId = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_cust',
                            line: x
                        })
                        var returned = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_return',
                            line: x
                        })
                        var sell = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_sell',
                            line: x
                        })
                        var cost = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_cost',
                            line: x
                        })
                        
                    
                        var arrayObject = new Object()
                        arrayObject.item = item
                        arrayObject.originalBin = originalBin
                        arrayObject.qty = qty
                        arrayObject.id = lineID
                        arrayObject.custId = custId
                        arrayObject.returned = returned
                        arrayObject.sell = sell
                        arrayObject.cost = cost
                        custArray.push(arrayObject)
                    }
                }
            
                log.debug('custArray', custArray);
                log.debug('debug', context.request.parameters);
                if(custArray.length > 0){
                    //var returnAuth = createReturnAuth(custArray)
                    //var editedRecord = editContentRecord(custArray,returnAuth)
                    var returnAuth = 46968
                    var inventoryAdju = createInvAdjustment(custArray,returnAuth)
                }


                redirect.toRecord({
                    type : 'returnauthorization',
                    id : returnAuth
                   });
             
    
            }


        }
        const createInvAdjustment = (itemArray,returnAuth) => {
            log.debug('itemArray', itemArray)
            var invAdj = record.create({
                type: 'inventoryadjustment',
                isDynamic: true,
            })
            invAdj.setValue({
                fieldId: 'subsidiary',
                value: 2,
            });
            invAdj.setValue({
                fieldId: 'adjlocation',
                value: 9,
            });
            invAdj.setValue({
                fieldId: 'account',
                value: 235,
            });
            invAdj.setValue({
                fieldId: 'memo',
                value: 'Return From Stored',
            });

            for (let i = 0; i < itemArray.length; i++) {
                var ordItem = itemArray[i].item
                var ordQty = itemArray[i].returned
                var binNumber = itemArray[i].originalBin
                var itemCost = itemArray[i].cost
          
                    log.debug('binNumber', binNumber)
                    // var returnedBinToUse = getNewBin(binNumber)
                    var returnedBinToUse = binNumber
                    log.debug('returnedBinToUse', returnedBinToUse)
                     invAdj.selectNewLine({
                         sublistId: 'inventory'
                     });
                     invAdj.setCurrentSublistValue({
                         sublistId: 'inventory',
                         fieldId: 'item',
                         value: ordItem
                     });
                     invAdj.setCurrentSublistValue({
                         sublistId: 'inventory',
                         fieldId: 'adjustqtyby',
                         value: ordQty*-1
                     });
                     invAdj.setCurrentSublistValue({
                         sublistId: 'inventory',
                         fieldId: 'location',
                         value: 9
                     });
                     invAdj.setCurrentSublistValue({
                         sublistId: 'inventory',
                         fieldId: 'unitcost',
                         value: itemCost
                     });
     
                     var subrec = invAdj.getCurrentSublistSubrecord({
                         sublistId: 'inventory',
                         fieldId: 'inventorydetail'
                     });
                     subrec.selectNewLine({
                         sublistId: 'inventoryassignment'
                     });
                     log.debug('select line in sub', 1)
                     subrec.setCurrentSublistValue({
                         sublistId: 'inventoryassignment',
                         fieldId: 'binnumber',
                         value: returnedBinToUse
                     });
                     subrec.setCurrentSublistValue({
                         sublistId: 'inventoryassignment',
                         fieldId: 'quantity',
                         value: ordQty*-1
                     });
                     log.debug('commit line in sub - set number', 1)
                     subrec.commitLine({
                         sublistId: 'inventoryassignment'
                     });
                     log.debug('commit line - created sub', 1)
                     invAdj.commitLine({
                         sublistId: 'inventory'
                     });
                
            }
            var savedAdjustment = invAdj.save()
            log.error('savedAdjustment',savedAdjustment)
            var otherId = record.submitFields({
                type: 'returnauthorization',
                id: returnAuth,
                values: {
                    'custbody_pr_return_stored_adj': savedAdjustment
                }
            });
            return savedAdjustment
        }
        const getNewBin = (name) => {
            var returnId = ''
            var binSearchObj = search.create({
                type: "bin",
                filters:
                [
                   ["custrecord1","anyof",name]
                ],
                columns:
                [
                   search.createColumn({name: "internalid"})
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

        const editContentRecord = (custArray,returnAuth) => {
            for(var x=0; x<custArray.length;x++){
                var custRec = record.load({
                    type: 'customrecord_stored_inventory_contents',
                    id: custArray[x].id
                })
                var onHand = custRec.getValue({
                    fieldId: 'custrecord_stored_qty'
                })
                var returnQty = custArray[x].returned
 
                var newQty = Number(onHand) - Number(returnQty)
                custRec.setValue({
                    fieldId: 'custrecord_pr_return_auth',
                    value: returnAuth
                })
                custRec.setValue({
                    fieldId: 'custrecord_stored_qty',
                    value: newQty
                })
                var oldSplit = custRec.save()
                log.error('oldSplit', oldSplit)
                if(Number(newQty) > 0){
                    var objRecord = record.copy({
                        type: 'customrecord_stored_inventory_contents',
                        id: custArray[x].id,
                        isDynamic: true,
                    });
                    objRecord.setValue({
                        fieldId: 'custrecord_stored_qty',
                        value: newQty
                    })
                    var newSplit = objRecord.save()
                    log.error('newSplit',newSplit)
                }
            }
            return
        }

        const createReturnAuth = (custArray) => {
            var returnAuth = record.create({
                type: 'returnauthorization',
                isDynamic: true,
            })
            returnAuth.setValue({
                fieldId: 'entity',
                value: custArray[0].custId
            })
            returnAuth.setValue({
                fieldId: 'location',
                value: 8
            })
       
            for(var x=0; x<custArray.length; x++){
                log.debug('custArray[x].originalBin',custArray[x].originalBin)
                returnAuth.selectNewLine({
                    sublistId: 'item'
                });
                returnAuth.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: custArray[x].item
                });
                returnAuth.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: custArray[x].returned
                });
                returnAuth.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    value: custArray[x].sell
                });
           
                returnAuth.commitLine({
                    sublistId: 'item'
                })
                var docNum = returnAuth.save()
                log.error('RGA', docNum)
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