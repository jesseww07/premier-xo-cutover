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
                    title: 'Results SO Component Requirement'
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
                var roomLoc = sublist.addField({
                    id: 'custpage_room',
                    label: 'Room Location',
                    type: serverWidget.FieldType.TEXT,
                });
                var check = sublist.addField({
                    id: 'custpage_selected',
                    label: 'Select',
                    type: serverWidget.FieldType.CHECKBOX,
                });
                var amount = sublist.addField({
                    id: 'custpage_amount',
                    label: 'Amount to Deliver',
                    type: serverWidget.FieldType.TEXT,
                });
                amount.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
                var itemID = sublist.addField({
                    id: 'custpage_itemid',
                    label: 'Item ID',
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
                                name: 'custrecord_contents_customer',
                                operator: search.Operator.ANYOF,
                                values: docCustomer
                            }),
                            //search.createFilter({
                              //  name: 'custrecord_customer_info',
                                //join: 'custrecord_parent_record',
                           //     operator: search.Operator.ANYOF,
                          //      values: docCustomer
                         //   }),
                          
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
                                name: "custrecord_pr_si_room",
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
                    //var docDate = result.getValue('trandate')

                    sublist.setSublistValue({
                        id: 'custpage_qty',
                        line: ctr,
                        value: result.getValue('custrecord_stored_qty')
                    });


                    //var poNum = result.getValue('otherrefnum')
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_bin',
                            line: ctr,
                            value: result.getText('custrecord_stored_bin')
                        });
                    }
                    catch{
                        //    sublist.setSublistValue({
                        //        id: 'custpage_bin',
                        //        line: ctr,
                        //        value: result.getValue('custrecord_stored_bin')
                        //    });
                    }

                    try {
                        sublist.setSublistValue({
                            id: 'custpage_room',
                            line: ctr,
                            value: result.getValue('custrecord_pr_si_room')
                        });
                    }
                    catch{
                        // sublist.setSublistValue({
                        //     id: 'custpage_room',
                        //     line: ctr,
                        //     value: result.getValue('custrecord_pr_si_room')
                        // });
                    }




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
                var setWindow = "window.open('" + suiteletUrl + "')";
                //form2.addButton("custpage_redirect", "Redirect", setWindow);
             //   form2.addButton({
              //      id: 'custpage_redirect',
             //       label: 'Print Packing Slip',
//functionName: setWindow
              //  });
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
                log.debug('requestCount', requestCount)
                for (var x = 0; x < requestCount; x++) {
                    var selected = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_selected',
                        line: x
                    })
                    log.debug('selected', selected)
                    if (selected == 'T') {
                        var lineID = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_internalid',
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
                        var amount = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_amount',
                            line: x
                        })
                        var arrayObject = new Object()
                        arrayObject.lineID = lineID
                        arrayObject.item = item
                        arrayObject.qty = qty
                        arrayObject.binNumber = ''
                        arrayObject.amount = amount
                        custArray.push(arrayObject)
                    }
                }


                var paramObj = new Object()
                paramObj.array = custArray
                var suiteletURL = url.resolveScript({
                    scriptId: 'customscript155',
                    deploymentId: 'customdeploy1',
                    params: paramObj
                });
                //redirect.redirect({ url: suiteletURL });

                log.debug('custArray', custArray);
                log.debug('debug', context.request.parameters);
                var deliveryRecord = createDeliveryRecord()
                redirect.toRecord({
                    type: 'customrecord_pr_delivery_record',
                    id: deliveryRecord
                });
                if (custArray.length > 0) {
                    for (var k = 0; k < custArray.length; k++) {
                        var id = custArray[k].lineID
                        var lineAmount = custArray[k].amount
                        var lineQty = custArray[k].qty
                        submittedDeliver = markDelivered(id, deliveryRecord, lineAmount, lineQty)

                    }
                    //var createAdjumentOut = adjustInvOut(custArray)
                }
               // var getXML = generateXml()
                //var pdfFile = render.xmlToPdf({

                 //   xmlString: getXML

              //  });
                // var fileObj = file.create({
                //     name: `testfile.pdf`,
                //     fileType: file.Type.PDF,
                //     contents: pdfFile,
                //     description: 'This is a test pdf file.',
                //     folder: 364,
                //     isOnline: true
                // });
                //var fileId = fileObj.save();

              //  pdfFile.name = 'Test123.pdf';
             //   pdfFile.folder = 364;
             //   var fileId = pdfFile.save();
             //   log.debug('fileId', fileId)



                //response.write('The following internal ids have been selected:' + " " + custArray);
            }


        }

        const createDeliveryRecord = () => {
            var deliveryRecord = record.create({
                type: 'customrecord_pr_delivery_record',
                isDynamic: true,
            })
            var returnedID = deliveryRecord.save()
            return returnedID
        }

        const adjustInvOut = (itemArray) => {
            log.debug('itemArray', itemArray)
            var invAdj = record.create({
                type: 'inventoryadjustment',
                isDynamic: true,
            })

            invAdj.setValue({
                fieldId: 'adjlocation',
                value: 7,
            });
            invAdj.setValue({
                fieldId: 'account',
                value: 57,
            });

            for (let i = 0; i < itemArray.length; i++) {
                var ordItem = itemArray[i].item
                var ordQty = itemArray[i].qty
                var binNumber = itemArray[i].binNumber


                invAdj.selectNewLine({
                    sublistId: 'inventory'
                });
                invAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'item',
                    value: ordItem
                });
                var turnNegative = Number(ordQty) * -1
                invAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'adjustqtyby',
                    value: turnNegative
                });
                invAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'location',
                    value: 7
                });
                invAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'unitcost',
                    value: 0.00
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
                    value: binNumber
                });
                subrec.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'quantity',
                    value: turnNegative
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
            return savedAdjustment
        }

        const generateXml = () => {
            var locale = ''
            var header = 'Packing Slip'
            var custRec = record.load({
                type: 'customrecord_stored_inv_delivery',
                id: 3
            });
            var doc = custRec.getText({
                fieldId: 'custrecord_linked_iful'
            })
            var docID = custRec.getValue({
                fieldId: 'custrecord_linked_iful'
            })
            var today = new Date()

            var fulfillment = record.load({
                type: 'itemfulfillment',
                id: docID
            });
            var shipAddr = fulfillment.getValue({
                fieldId: 'shipaddress'
            })
            var numLines = fulfillment.getLineCount({
                sublistId: 'item'
            })

            var test = 'test'
            var bcod = 12345
            var xml = `<?xml version="1.0"?><!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">`
            xml += '<pdf>'
            xml += '<head>'
            xml += '<link name="NotoSans" type="font" subtype="truetype" src="${nsfont.NotoSans_Regular}" src-bold="${nsfont.NotoSans_Bold}" src-italic="${nsfont.NotoSans_Italic}" src-bolditalic="${nsfont.NotoSans_BoldItalic}" bytes="2" />'
            if (locale == "zh_CN") {
                xml += '<link name="NotoSansCJKsc" type="font" subtype="opentype" src="${nsfont.NotoSansCJKsc_Regular}" src-bold="${nsfont.NotoSansCJKsc_Bold}" bytes="2" />'
            }
            else if (locale == "zh_TW") {
                xml += '<link name="NotoSansCJKtc" type="font" subtype="opentype" src="${nsfont.NotoSansCJKtc_Regular}" src-bold="${nsfont.NotoSansCJKtc_Bold}" bytes="2" />'
            }
            else if (locale == "ja_JP") {
                xml += '<link name="NotoSansCJKjp" type="font" subtype="opentype" src="${nsfont.NotoSansCJKjp_Regular}" src-bold="${nsfont.NotoSansCJKjp_Bold}" bytes="2" />'
            }
            else if (locale == "ko_KR") {
                xml += '<link name="NotoSansCJKkr" type="font" subtype="opentype" src="${nsfont.NotoSansCJKkr_Regular}" src-bold="${nsfont.NotoSansCJKkr_Bold}" bytes="2" />'
            }
            else if (locale == "th_TH") {
                xml += '<link name="NotoSansThai" type="font" subtype="opentype" src="${nsfont.NotoSansThai_Regular}" src-bold="${nsfont.NotoSansThai_Bold}" bytes="2" />'
            }
            xml += '<style type="text/css">* {'
            if (locale == "zh_CN") {
                xml += 'font-family: NotoSans, NotoSansCJKsc, sans-serif;'
            }
            else if (locale == "zh_TW") {
                xml += 'font-family: NotoSans, NotoSansCJKtc, sans-serif;'
            }
            else if (locale == "ja_JP") {
                xml += 'font-family: NotoSans, NotoSansCJKjp, sans-serif;'
            }
            else if (locale == "ko_KR") {
                xml += 'font-family: NotoSans, NotoSansCJKkr, sans-serif;'
            }
            else if (locale == "th_TH") {
                xml += 'font-family: NotoSans, NotoSansThai, sans-serif;'
            }
            else {
                xml += 'font-family: NotoSans, sans-serif;'
            }
            xml += '}</style >'
            xml += `<macrolist>`
            xml += `<macro id="nlheader">`
            xml += `<table class="header" style="width: 100%;"><tr>`
            var image = returner('https://tstdrv2379072.app.netsuite.com/core/media/media.nl?id=133&c=TSTDRV2379072&h=AijDp9iMEITl0waUvLVeNiuAmEnKIYto_83XprosDbhIC_55')
            xml += `<td rowspan="6" style="padding: 0px, 0px, 0px, -30px;"><img src="${image}" style="height: 100px;
        width: 210px; display: block;" /></td>`
            xml += `<td rowspan="5" style="padding: 0; font-size: 10px; text-align: right; align: right"><span style="color: #e6390e; font-size: 22pt; text-align: right; align: right"><b>${header}</b></span><br/><p style="padding: 0; font-size: 12px; text-align: right; align: right">`
            xml += `<b>Document #:</b> ${doc}<br/><b>Date:</b> ${today}</p></td>`
            xml += `</tr>`
            xml += `</table>`
            xml += `</macro>`
            xml += `<macro id="nlfooter">`
            xml += `<table class="footer" style="width: 100%;"><tr>`
            xml += `<td><barcode codetype="code128" showtext="true" value="${docID}"/></td>`
            xml += `<td align="right"><pagenumber/> of <totalpages/></td>`
            xml += `</tr></table>`
            xml += `</macro>`
            xml += `</macrolist>`
            xml += `<style type="text/css">`
            xml += `table {`
            xml += `font-size: 9pt;`
            xml += `table-layout: fixed;`
            xml += `}`
            xml += `th {`
            xml += `font-weight: bold;`
            xml += `font-size: 8pt;`
            xml += `vertical-align: middle;`
            xml += `padding: 5px 6px 3px;`
            xml += `background-color: #e3e3e3;`
            xml += `color: #333333;`
            xml += `}`
            xml += `td {`
            xml += `padding: 4px 6px;`
            xml += `}`
            xml += `td p { align:left }`
            xml += `b {`
            xml += `font-weight: bold;`
            xml += `color: #333333;`
            xml += `}`
            xml += `table.header td {`
            xml += `padding: 0;`
            xml += `font-size: 10pt;`
            xml += `}`
            xml += `table.footer td {`
            xml += `padding: 0;`
            xml += `font-size: 8pt;`
            xml += `}`
            xml += `table.itemtable th {`
            xml += `padding-bottom: 10px;`
            xml += `padding-top: 10px;`
            xml += `}`
            xml += `table.body td {`
            xml += `padding-top: 2px;`
            xml += `}`
            xml += `td.addressheader {`
            xml += `font-size: 8pt;`
            xml += `padding-top: 6px;`
            xml += `padding-bottom: 2px;`
            xml += `}`
            xml += `td.address {`
            xml += `padding-top: 0;`
            xml += `}`
            xml += `span.title {`
            xml += `font-size: 28pt;`
            xml += `}`
            xml += `span.number {`
            xml += `font-size: 16pt;`
            xml += `}`
            xml += `span.itemname {`
            xml += `font-weight: bold;`
            xml += `line-height: 150%;`
            xml += `}`
            xml += `hr {`
            xml += ` width: 100%;`
            xml += ` color: #d3d3d3;`
            xml += `background-color: #d3d3d3;`
            xml += `height: 1px;`
            xml += `}`
            xml += `</style>`
            xml += `</head>`
            xml += `<body header="nlheader" header-height="10%" footer="nlfooter" footer-height="20pt" padding="0.5in 0.5in 0.5in 0.5in" size="Letter">`
            xml += `<table style="width: 100%; margin-top: 10px;"><tr>`
            xml += `</tr>`
            xml += `<tr>`
            xml += `<td class="addressheader"><b>Ship Address</b></td>`
            xml += `</tr>`
            xml += `<tr>`
            xml += `<td class="address">${shipAddr}</td>`
            xml += `</tr></table>`
            xml += `<table class="body" style="width: 100%; margin-top: 10px;"><tr>`
            xml += `<th>Shipping Method</th>`
            xml += `<th>PO #</th>`
            xml += `<th>Sales Order</th>`
            xml += `</tr>`
            xml += `<tr>`
            xml += `<td>${test}</td>`
            xml += `<td>${test}</td>`
            xml += `<td>${test}</td>`
            xml += `</tr></table>`

            xml += `<table class="itemtable" style="width: 100%; margin-top: 10px;">`
            var row = 0
            xml += `<thead>`
            xml += `<tr>`
            xml += `<th colspan="4">Item</th>`
            xml += `<th>Bin(s)</th>`
            xml += `<th>Quantity</th>`

            xml += `</tr>`
            xml += `</thead>`
            for (var i = 0; i < numLines; i++) {
                var itemText = fulfillment.getSublistText({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                })
                var ordQty = fulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                })
                var ordRate = fulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: i
                })
                var detailAvailable = fulfillment.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'inventorydetailavail',
                    line: i
                })
                var subrec = fulfillment.getSublistSubrecord({
                    sublistId: 'item',
                    fieldId: 'inventorydetail',
                    line: i
                });
                var subNum = subrec.getLineCount({
                    sublistId: 'inventoryassignment'
                });
                for (var d = 0; d < subNum; d++) {
                    var binNumber = subrec.getSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'binnumber',
                        line: d
                    });
                }
                xml += `<tr>`
                xml += `<td colspan="4"><span class="itemname">${itemText}</span><br />${test}</td>`
                xml += `<td>${binNumber}</td>`
                xml += `<td>${ordQty}</td>`

                row++
                xml += `</tr>`
            }
            xml += `</table>`

            xml += `</body>`
            xml += `</pdf>`
            return xml

        }

        function returner(word) {
            word = word.replace(/&/g, "&amp;")
            word = word.replace(/</g, "&lt;")
            word = word.replace(/>/g, "&gt;")
            word = word.replace(/'/g, "&#39;")
            word = word.replace(/"/g, "&quot;");
            return word
        }

        const markDelivered = (id, deliveryRecord, lineAmount, lineQty) => {
            log.debug('in mark delivered', lineAmount + ' --- ' + lineQty)
            var today = new Date()
            if (Number(lineAmount) < Number(lineQty)) {
                try{
                    log.debug('in split transaction')
                    // record.submitFields({
                    //     type: 'customrecord_stored_inventory_contents',
                    //     id: id,
                    //     values: {
                    //         custrecord_stored_qty: lineAmount
                    //     },
                    // });
                    var origLoad = record.load({
                        type:'customrecord_stored_inventory_contents',
                        id:id,
                        isDynamic:true
                    })
                    origLoad.setValue({
                        fieldId: 'custrecord_stored_qty',
                        value: lineAmount
                    })
                    var cloneQty = Number(lineQty) - Number(lineAmount)
                    log.debug('cloneQty',cloneQty)
                    var objRecord = record.copy({
                        type: 'customrecord_stored_inventory_contents',
                        id: id,
                        isDynamic: true,
                    });
                    objRecord.setValue({
                        fieldId: 'custrecord_stored_qty',
                        value: cloneQty
                    })
    
                    var newSplit = objRecord.save()
                    log.error('newSplit', newSplit)
    
                    // record.submitFields({
                    //     type: 'customrecord_stored_inventory_contents',
                    //     id: id,
                    //     values: {
                    //         custrecord_delivered: true
                    //     },
                    // });
                    origLoad.setValue({
                        fieldId: 'custrecord_delivered',
                        value: true
                    })
                    // record.submitFields({
                    //     type: 'customrecord_stored_inventory_contents',
                    //     id: id,
                    //     values: {
                    //         custrecord_date_delivered: today
                    //     },
                    // });
                    origLoad.setValue({
                        fieldId: 'custrecord_date_delivered',
                        value: today
                    })
                    // record.submitFields({
                    //     type: 'customrecord_stored_inventory_contents',
                    //     id: id,
                    //     values: {
                    //         custrecord_pr_delivery_record: deliveryRecord
                    //     },
                    // });
                    origLoad.setValue({
                        fieldId: 'custrecord_pr_delivery_record',
                        value: deliveryRecord
                    })
                    origLoad.setValue({
                        fieldId: 'custrecord_pr_st_delivered_qty',
                        value: lineQty
                    })
                    origLoad.save()
                }
                catch(y){
                    log.debug('y',y)
                }
            }
            else {
                var origLoad = record.load({
                    type:'customrecord_stored_inventory_contents',
                    id:id,
                    isDynamic:true
                })
                // record.submitFields({
                //     type: 'customrecord_stored_inventory_contents',
                //     id: id,
                //     values: {
                //         custrecord_delivered: true
                //     },
                // });
                origLoad.setValue({
                    fieldId: 'custrecord_delivered',
                    value: true
                })
                // record.submitFields({
                //     type: 'customrecord_stored_inventory_contents',
                //     id: id,
                //     values: {
                //         custrecord_date_delivered: today
                //     },
                // });
                origLoad.setValue({
                    fieldId: 'custrecord_date_delivered',
                    value: today
                })
                // record.submitFields({
                //     type: 'customrecord_stored_inventory_contents',
                //     id: id,
                //     values: {
                //         custrecord_pr_delivery_record: deliveryRecord
                //     },
                // });
                origLoad.setValue({
                    fieldId: 'custrecord_pr_delivery_record',
                    value: deliveryRecord
                })
                origLoad.setValue({
                    fieldId: 'custrecord_pr_st_delivered_qty',
                    value: lineQty
                })
                origLoad.save()
            }
        }


        return {
            onRequest: onRequest
        };
    });