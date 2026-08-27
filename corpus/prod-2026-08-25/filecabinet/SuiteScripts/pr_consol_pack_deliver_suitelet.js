/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/config', 'N/https', 'N/log', 'N/record', 'N/render', 'N/runtime', 'N/search', 'N/url', 'N/format'],
    /**
     * @param {config} config
     * @param {https} https
     * @param {log} log
     * @param {record} record
     * @param {render} render
     * @param {runtime} runtime
     * @param {search} search
     * @param {url} url
     * @param {format} format
     */
    function (config, https, log, record, render, runtime, search, url, format) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} context
         * @param {ServerRequest} context.request - Encapsulation of the incoming request
         * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
         * @Since 2015.2
         */
        function onRequest(context) {
            var id = context.request.parameters.custom_id;
            var param = context.request.parameters;
            var locale = context.request.parameters.lang;
            var recordType = context.request.parameters.type;
            log.debug('test', id)
            log.debug('lang', param)
            var xmlString = generateXml(id, locale, recordType);
            context.response.renderPdf({ xmlString: xmlString });

        }

        const generateXml = (id, locale, recordType) => {
            var custRec = record.load({
                type: 'customrecord_sa_consolidated_packing',
                id: id
            })
            var ordArray = custRec.getValue({
                fieldId: 'custrecord_sa_consolidated_iful'
            })
            if (ordArray) {
                var itemArray = new Array()
                for (var a = 0; a < ordArray.length; a++) {
                    var ifulId = ordArray[a]
                    var fulfillment = record.load({
                        type: 'itemfulfillment',
                        id: ifulId
                    })
                    var createdFrom = fulfillment.getValue({
                        fieldId: 'createdfrom'
                    })
                    var createdText = fulfillment.getText({
                        fieldId: 'createdfrom'
                    })
                    var cust = fulfillment.getValue({
                        fieldId: 'entity'
                    })

                    // var shipAddress = fulfillment.getText({
                    //     fieldId: 'shipaddr1'
                    // })
                    // var shipAddress2 = fulfillment.getText({
                    //     fieldId: 'shipaddr2'
                    // })
                    // var shipCity = fulfillment.getText({
                    //     fieldId: 'shipcity'
                    // })
                    // var shipState = fulfillment.getText({
                    //     fieldId: 'shipstate'
                    // })
                    // var shipZip = fulfillment.getText({
                    //     fieldId: 'shipzip'
                    // })

                    var shipSub = fulfillment.getSubrecord({
                        fieldId: 'shippingaddress'
                    });
            
                    var shipAddress = shipSub.getValue('addr1')
                    var shipAddress2 = shipSub.getValue('addr2')
                    var shipCity = shipSub.getValue('city')
                    var shipState = shipSub.getValue('state')
                    var shipZip = shipSub.getValue('zip')
                    
                    var bodyObject = getSalesOrderBodyInfo(createdFrom)
                    var numLines = fulfillment.getLineCount({
                        sublistId: 'item'
                    })
                    var logo = returner('https://7513000.app.netsuite.com/core/media/media.nl?id=2460&c=7513000&h=TpDmhUs5PXkSV313hioo0g6WHy7yzRpZ-z8hTt8zeczeP9mJ')
                    var formatDate = new Date()
                    var today = format.format({
                        value:formatDate,
                        type: format.Type.DATE
                    })
                    if (numLines) {
                        for (var n = 0; n < numLines; n++) {
                            var item = fulfillment.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: n
                            })
                            var itemText = fulfillment.getSublistText({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: n
                            })
                            var qty = fulfillment.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line: n
                            })
                            var qtyShipped = fulfillment.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantityfulfilled',
                                line: n
                            })
                            var desc = fulfillment.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'description',
                                line: n
                            })
                            var roomLocation = fulfillment.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_room_location',
                                line: n
                            })
                            var subrec = fulfillment.getSublistSubrecord({
                                sublistId: 'item',
                                fieldId: 'inventorydetail',
                                line: n
                            });
                            var subNum = subrec.getLineCount({
                                sublistId: 'inventoryassignment'
                            });
                            var invDetailFormat = ''
                            for (var d = 0; d < subNum; d++) {
                                var issue = subrec.getSublistText({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'issueinventorynumber',
                                    line: d
                                });
                                var bin = subrec.getSublistText({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'binnumber',
                                    line: d
                                });
                                if (invDetailFormat) {
                                    invDetailFormat += '<br/>' + issue + '(' + bin + ')'
                                }
                                else {
                                    invDetailFormat += issue + '(' + bin + ')'
                                }

                                // var receipt = subrec.getSublistValue({
                                //     sublistId: 'inventoryassignment',
                                //     fieldId: 'receiptinventorynumber',
                                //     line: d
                                // });
                                log.debug('issue', issue)
                                //log.debug('receipt', receipt)
                            }
                            var returnedSOInfo = getSalesOrderInfo(createdFrom, item)

                            var remainingQty = Number(qty)
                            if (remainingQty > 0) {
                                // var arrayIndex = checkIndex(item, itemArray)
                                // if (arrayIndex) {

                                //     var extractQuantity = itemArray[arrayIndex].remainingQty
                                //     log.debug('itemArray', itemArray + ' : Item - ' + item + ' @ qty of ' + remainingQty + ' -- Existing Qty: ' + extractQuantity)
                                //     var newQty = Number(extractQuantity) + Number(remainingQty)
                                //     var itemObject = new Object()
                                //     itemObject.itemId = item
                                //     itemObject.quantity = newQty
                                //     itemObject.item = itemText
                                //     itemObject.quantityOrdered = returnedSOInfo.soQuantity
                                //     itemObject.quantityRemaining = returnedSOInfo.soRemaining
                                //     itemObject.description = returner(desc)
                                //     itemObject.inventoryNumber = returner(invDetailFormat)
                                //     itemObject.soText = returner(createdText)

                                //     compArray.splice(arrayIndex, 1, itemObject);
                                // }
                                // else {
                                    var itemObject = new Object()
                                    itemObject.itemId = (item)
                                    itemObject.quantity = (remainingQty)
                                    itemObject.item = returner(itemText)
                                    itemObject.description = desc
                                    itemObject.inventoryNumber = returner(invDetailFormat)
                                    itemObject.soText = returner(createdText)
                                    itemObject.roomLocation = returner(roomLocation)
                                    itemArray.push(itemObject)
                                //}
                            }

                        }
                    }
                }
                if (itemArray) {
          

                    var xml = `<?xml version="1.0"?>`
                    xml += `<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">`
                    xml += `<pdf>`
                
                    xml += `<head>`
        
                    xml += `<macrolist>`
                    xml += `<macro id="nlheader">`
                    xml += `<table style="width: 100%; font-size: 10pt;">`
                    xml += `<tr>`
                    xml += `<td style="width: 20%; padding-top: -15px; padding-right: -1px; align: right; text-align: right">`
                    xml += `<img src="${logo}" style="align: right; width: 150px; height:70px" />`
        
                    xml += `</td>`
                    xml += `<td align="center" style="width: 60%; padding: 0;"><span style="font-size: 28pt;">Consolidated Delivery Slip</span></td>`
             
                
                    xml += `<td style="width: 20%;">`
                    xml += `<p style="align: right; text-align: right">`
                    xml += `${createdFrom}</p>`
                    xml += `</td>`
                    xml += `</tr>`
                    xml += `<tr>`
                
                    xml += `<td style="width: 20%; padding-left: -2">`
                    xml += `<p style="text-align: left; font-family: NotoSans, NotoSansCJKsc, sans-serif; font-size: 10px">`
                    var shipAddress = shipSub.getValue('addr1')
                    var shipAddress2 = shipSub.getValue('addr2')
                    var shipCity = shipSub.getValue('city')
                    var shipState = shipSub.getValue('state')
                    var shipZip = shipSub.getValue('zip')
                    if(shipAddress2){
                        xml += `<b>Deliver To: </b><br /> ${shipAddress}<br/>${shipAddress2}<br/>${shipCity} ${shipState} ${shipZip}</p>`
                    }
                    else{
                        xml += `<b>Deliver To: </b><br /> ${shipAddress}<br/>${shipCity} ${shipState} ${shipZip}</p>`
                    }
                    xml += `</td>`
                
                    xml += `<td style="width: 60%;">`
                    xml += `<p style="align: center; text-align: left"></p>`
                    xml += `</td>`
                    xml += `<td style="width: 20%;">`
                    xml += `<p style="align: right; text-align: right"><strong>Date:</strong> ${today}`
                    xml += `</p>`
                    xml += `</td>`
                    xml += `</tr>`
                    xml += `</table>`
                    xml += `<table style="position: absolute; width: 80%; left: 50; top: 50; padding-left: 100">`
                    xml += `<tr>`
                    xml += `<td colspan="3" style="font-size: 8pt; padding: 6px 0 2px; font-weight: bold; color: #333333;">`
                    xml += `</td>`
                    xml += `<td colspan="3" style="font-size: 8pt; padding: 6px 0 2px; font-weight: bold; color: #333333;">`
                    xml += `</td>`
                
                    xml += `</tr>`
                    xml += `<tr>`
                    xml += `<td class="address" colspan="3" style="padding-left: 0;"></td>`
                    xml += `<td class="address" colspan="3" style="padding-left: 0"></td>`
                
                    xml += `</tr>`
                    xml += `</table>`
                    xml += `</macro>`
                    xml += `<macro id="nlheader2">`
                    xml += `<table style="width: 100%; font-size: 10pt;">`
                    xml += `<tr>`
                    xml += `<td style="width: 20%; padding-right: -10px; align: right; text-align: right">`
                    xml += `<img src="${logo}" style="align: right; width: 150px; height:70px" />`
                    xml += `</td>`
                    xml += `<td align="center" style="width: 60%; padding: 0;"><span style="font-size: 28pt;">Delivery Slip </span></td>`
         
                
                    xml += `<td style="width: 20%;">`
                    xml += `<p style="align: right; text-align: right">`
                    xml += `${createdFrom}</p>`
                    xml += `</td>`
                    xml += `</tr>`
                    xml += `<tr>`
                
                    xml += `<td style="width: 20%; padding-left: -2">`
                    xml += `<p style="text-align: left; font-family: NotoSans, NotoSansCJKsc, sans-serif; font-size: 10px">`
                    if(shipAddress2){
                        xml += `<b>Deliver To: </b><br /> ${shipAddress}<br/>${shipAddress2}<br/>${shipCity} ${shipState} ${shipZip}</p>`
                    }
                    else{
                        xml += `<b>Deliver To: </b><br /> ${shipAddress}<br/>${shipCity} ${shipState} ${shipZip}</p>`
                    }
                    xml += `</td>`
                
                    xml += `<td style="width: 60%;">`
                    xml += `<p style="align: center; text-align: left"></p>`
                    xml += `</td>`
                    xml += `<td style="width: 20%;">`
                    xml += `<p style="align: right; text-align: right"><strong>Date:</strong> ${today}`
                    xml += `</p>`
                    xml += `</td>`
                    xml += `</tr>`
                    xml += `</table>`
                    xml += `<table style="position: absolute; width: 80%; left: 50; top: 50; padding-left: 100">`
                    xml += `<tr>`
                    xml += `<td colspan="3" style="font-size: 8pt; padding: 6px 0 2px; font-weight: bold; color: #333333;">`
                    xml += `</td>`
                    xml += `<td colspan="3" style="font-size: 8pt; padding: 6px 0 2px; font-weight: bold; color: #333333;">`
                    xml += `</td>`
                
                    xml += `</tr>`
                    xml += `<tr>`
                    xml += `<td class="address" colspan="3" style="padding-left: 0;"></td>`
                    xml += `<td class="address" colspan="3" style="padding-left: 0"></td>`
                
                    xml += `</tr>`
                    xml += `</table>`
                    xml += `</macro>`
                    xml += `<macro id="nlfooter">`
                    xml += `<table class="footer" style="width: 100%;">`
                    xml += `<tr>`
                    xml += `<td>`
                    xml += `<barcode codetype="code128" showtext="true" value="${createdFrom}" />`
                    xml += `</td>`
                    xml += `<td align="right">`
                    xml += `<pagenumber /> of `
                    xml += `<totalpages />`
                    xml += `<br/>`
                    var today = new Date().toLocaleString()
                    log.debug('today',today)
                    xml += `<${today} />`
                    xml += `</td>`
                    xml += `</tr>`
                    xml += `</table>`
                    xml += `</macro>`
                    xml += `<macro id="nlfooter2">`
                    xml += `<table class="footer" style="width: 100%;">`
                    xml += `<tr>`
                    xml += `<td>`
                    xml += `<barcode codetype="code128" showtext="true" value="${createdFrom}" />`
                    xml += `</td>`
                    xml += `<td align="right">`
                    xml += `<pagenumber /> of`
                    xml += `<totalpages />`
                    xml += `</td>`
                    xml += `</tr>`
                    xml += `</table>`
                    xml += `</macro>`
                    xml += `</macrolist>`
                    xml += `<style type="text/css">`
                    xml += `* {`
                    xml += `}`
                
                    xml += `table {`
                    xml += `font-size: 9pt;`
                    xml += `table-layout: fixed;`
                    xml += `}`
                
                    xml += `th {`
                    xml += `font-weight: bold;`
                    xml += `font-size: 8pt;`
                    xml += `vertical-align: middle;`
                    xml += `padding: 5px 6px 3px;`
                    xml += `background-color: #A9A9A9;`
                    xml += `color: #333333;`
                    xml += `}`
                
                    xml += `td {`
                    xml += `padding: 4px 6px;`
                    xml += `}`
                
                    xml += `td p {`
                    xml += `align: left`
                    xml += `}`
                
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
                    xml += `font-size: 7pt;`
                    xml += `}`
                
                    xml += `table.itemtable th {`
                    xml += `padding-bottom: 10px;`
                    xml += `padding-top: 10px;`
                    xml += `}`
                
                    xml += `table.body td {`
                    xml += `padding-top: 2px;`
                    xml += `}`
                
                    xml += `td.addressheader {`
                    xml += `font-size: 7pt;`
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
                    xml += `width: 100%;`
                    xml += `color: #d3d3d3;`
                    xml += `background-color: #d3d3d3;`
                    xml += `height: 1px;`
                    xml += `}`
                    xml += `</style>`
                    xml += `</head>`
                
                    xml += `<body header="nlheader" header-height="12%" footer="nlfooter" footer-height="20pt" padding="0.5in 0.5in 0.5in 0.5in" size="Letter">`
        
                
                    xml += `<table align="center" class="body" style="width: 100%; margin-top: 5px;">`
                    xml += `<tr>`
                    xml += `<td colspan="3"></td><td colspan="15" style="font-size: 18px; align: center">Customer: ${bodyObject.cust}</td><td colspan="3"></td>`
                    xml += `</tr>`
        
                    xml += `</table>`
                    xml += `<table class="body" style="width: 100%; margin-top: 10px;">`
                    xml += `<tr>`
                         xml += `<th align="center">Delivery Record</th>`
                    xml += `<th align="center">Ship Via</th>`
                    xml += `<th align="center">Estimated <br /> Ship Date</th>`
                    xml += `<th align="center">Sales Rep</th>`
                
                    xml += `</tr>`
                    xml += `<tr>`
             xml += `<td>${id}</td>`
                    xml += `<td>${bodyObject.shipMethod}</td>`
                    var formatShip = new Date(bodyObject.shipDate)
                    var shippingDate = format.format({
                        value:formatShip,
                        type: format.Type.DATE
                    })
                    xml += `<td>${shippingDate}</td>`
                
                
                    xml += `</tr>`
                    xml += `</table>`
        
                    xml += `<table class="itemtable" style="width: 100%; margin-top: 10px;">`
        
                    xml += `<thead>`
                    xml += `<tr>`
                    xml += `<th colspan="13">Product SKU <br /> Description</th>`
                    xml += `<th colspan="5">Room Location</th>`
                    xml += `<th colspan="5">Bin</th>`
                    xml += `<th colspan="5">Qty.</th>`
        
                    xml += `<th colspan="5">Sales Order</th>`
            
                    xml += `</tr>`
                
                    xml += `</thead>`
              
                for(var x=0;x<itemArray.length;x++){
                    // xml += "<tr style='background-color: ${((item_index % 2) == 0) ? string('white', '#e3e3e3')}'>"
                    xml += `<tr>`
                    xml += `<td colspan="13"><span class="itemname">${itemArray[x].item}</span><br />${itemArray[x].description}</td>`
                    xml += `<td style="line-height: 150%" colspan="5">${itemArray[x].roomLocation}</td>`
                    xml += `<td style="line-height: 150%" colspan="5">${itemArray[x].inventoryNumber}</td>`
                
                    xml += `<td style="line-height: 150%" colspan="5">${itemArray[x].quantity}</td>`
        
                    xml += `<td style="line-height: 150%" colspan="5">${itemArray[x].soText}</td>`
                    xml += `</tr>`
                }
        
                    xml += `</table>`
            
                
                
                    xml += `<br /><br />`
                    
                                xml += `</table>`
   xml += `<table>`
   xml += `<tr>`
        xml += `<td style="line-height: 150%" colspan="5"><b>Special Instructions:</b> <br /></td>`
        xml += `</tr>`
        xml += `</table>`
            xml += `<br /><br />`
        
        xml += `<table class="itemtable" style="width: 100%; margin-top: 10px; border-width:3px; border-style:solid; border-color:#000000;">`
xml += `<thead>`
	xml += `<tr>`
     xml += ` <th colspan="6">Delivery Memo</th>`
     xml += ` </tr>`
 xml += ` </thead>`
 xml += ` <tr style="border-width:3px; border-style:solid; border-color:#000000;">`
 xml += ` <td colspan="2"> Full Name of individual accepting delivery: </td>`
  xml += `  <td colspan="4" style="border-left:3px; border-style:solid; border-color:#000000;"></td>`
    xml += `	</tr>`
  xml += ` <tr style="border-bottom:3px; border-style:solid; border-color:#000000;">`
 xml += ` <td colspan="2"> If no signature obtained description of where items left: <br/> <br/> (Remember to take photo!)</td>`
     xml += `  <td colspan="4" style="border-left:3px; border-style:solid; border-color:#000000;"></td>`
     xml += ` 	</tr>`
   xml += `  <tr rowspan="4" style="border-left:3px; border-style:solid; border-color:#000000;">`
  xml += `  <td colspan="2"> Date and Time of Delivery: <br/><br/></td>`
    xml += `   <td colspan="4" style="border-left:3px; border-style:solid; border-color:#000000;"></td>`
     xml += ` 	</tr>`
  xml += `  </table>`
                
                
                
                
                    xml += `</body>`
                    xml += `</pdf>`


                }
                return xml

            }
        }
        const getSalesOrderBodyInfo = (createdFrom) => {
            var salesOrd = record.load({
                type: 'salesorder',
                id: createdFrom
            })
            var date = salesOrd.getValue({
                fieldId: 'trandate'
            })
            var shipMethod = salesOrd.getValue({
                fieldId: 'shipmethod'
            })
            var shipDate = salesOrd.getValue({
                fieldId: 'shipdate'
            })
            var cust = salesOrd.getText({
                fieldId: 'entity'
            })
            var shipAddress = salesOrd.getValue({
                fieldId: 'shipaddr1'
            })
            var shipAddress2 = salesOrd.getValue({
                fieldId: 'shipaddr2'
            })
            var shipCity = salesOrd.getValue({
                fieldId: 'shipcity'
            })
            var shipState = salesOrd.getValue({
                fieldId: 'shipstate'
            })
            var shipZip = salesOrd.getValue({
                fieldId: 'shipzip'
            })
            var shipPhone = salesOrd.getValue({
                fieldId: 'shipphone'
            })
            var tranid = salesOrd.getValue({
                fieldId: 'tranid'
            })
            var bodyObject = new Object()
            bodyObject.date = date
            bodyObject.shipMethod = returner(shipMethod)
            bodyObject.shipAddress = returner(shipAddress)
            bodyObject.shipAddress2 = returner(shipAddress2)
            bodyObject.shipCity = (shipCity)
            bodyObject.shipState = (shipState)
            bodyObject.shipZip = (shipZip)
            bodyObject.shipPhone = (shipPhone)
            bodyObject.tranid = (tranid)
            bodyObject.shipDate = shipDate
            bodyObject.cust = returner(cust)
            return bodyObject
        }

        const getSalesOrderInfo = (createdFrom, item) => {
            var salesOrd = record.load({
                type: 'salesorder',
                id: createdFrom
            })

            var numLines = salesOrd.getLineCount({
                sublistId: 'item'
            })
            if (numLines) {
                for (var n = 0; n < numLines; n++) {
                    var lineItem = salesOrd.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: n
                    })
                    if (lineItem == item) {
                        var lineQuantity = salesOrd.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: n
                        })
                        var lineShipped = salesOrd.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantityfulfilled',
                            line: n
                        })
                        var quantityRemaining = Number(lineQuantity) - Number(lineShipped)
                        var soObject = new Object()
                        soObject.soQuantity = lineQuantity
                        soObject.soRemaining = quantityRemaining

                        return soObject
                    }
                }
            }
        }

        const checkIndex = (checkItem, compArray) => {
            for (var i = 0; i < compArray.length; i++) {
                if (compArray[i].revItem == checkItem) {
                    return i;
                }
            }
        }

        const returner = (word) => {
            log.debug('word',word)
            if(!word || word == null || word == 'null' || word == undefined || word == 'undefinded'){
                var final = ''
            }
            else{
                var newO = word.replace(/&/g, "&amp;")
                // word = word.replace(/</g, "&lt;")
                // word = word.replace(/>/g, "&gt;")
                // word = word.replace(/'/g, "&#39;")
                var final = newO.replace(/"/g, "&quot;");
            }
            return final
        }

        return {
            onRequest: onRequest
        };

    });



