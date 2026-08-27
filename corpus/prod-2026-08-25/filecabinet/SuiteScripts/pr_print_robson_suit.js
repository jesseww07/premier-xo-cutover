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
        const getQuoteInfo = (id) => {
            var returnArray = new Array()
            var transactionSearchObj = search.create({
                type: "transaction",
                filters:
                [
                   ["internalidnumber","equalto",id],
                   "AND", 
                   ["mainline","is","F"], 
                   "AND", 
                   ["type","anyof","Estimate"],
                   "AND", 
                   ["taxline","is","F"], 
                   "AND", 
                   ["shipping","is","F"]
                ],
                columns:
                [
                   "trandate",
                   "tranid",
                   "location",
                   "entity",
                   "account",
                   "memo",
                   "shipdate",
                   "otherrefnum",
                   "custbody_pr_sidemark",
                   "duedate",
                   "shipmethod",
                   "terms",
                   "billaddress1",
                   "billaddress2",
                   "billcity",
                   "billstate",
                   "billzip",
                   "shipaddress1",
                   "shipaddress2",
                   "shipcity",
                   "shipstate",
                   "shipzip",
                   "item",
                   "quantity",
                   "custcol_pr_room_location",
                   "rate",
                   "amount",
                   "custbody_robson_cust_subtotal",
                   "custbody_robson_mark",
                   "custbody_robson_ntp",
                   "custbody_robson_tax_link",
                   "custbody_robson_tax_amount",
                   "custcol_robson_amount"
                ]
             });
             var searchResultCount = transactionSearchObj.runPaged().count;
             log.debug("transactionSearchObj result count",searchResultCount);
             transactionSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var itemId = result.getValue({
                    name: 'item'
                })
                log.debug('itemid',itemId)
                var desc = getAdditionalInfo(itemId)

                var date = result.getValue({
                    name: 'trandate'
                })
                var doc = result.getValue({
                    name: 'tranid'
                })
                var location = result.getText({
                    name: 'location'
                })
                var cust = result.getText({
                    name: 'entity'
                })
                var memo = result.getValue({
                    name: 'memo'
                })
                var shipDate = result.getValue({
                    name: 'shipdate'
                })
                var ponum = result.getValue({
                    name: 'otherrefnum'
                })
                var sidemark = result.getValue({
                    name: 'custbody_pr_sidemark'
                })
                var duedate = result.getValue({
                    name: 'duedate'
                })
                var shipmethod = result.getText({
                    name: 'shipmethod'
                })
                var quantity = result.getValue({
                    name: 'quantity'
                })
                var item = result.getText({
                    name: 'item'
                })
                var billzip = result.getValue({
                    name: 'billzip'
                })
                var billstate = result.getValue({
                    name: 'billstate'
                })
                var billcity = result.getValue({
                    name: 'billcity'
                })
                var billaddress2 = result.getValue({
                    name: 'billaddress2'
                })
                var billaddress1 = result.getValue({
                    name: 'billaddress1'
                })
                var shipzip = result.getValue({
                    name: 'shipzip'
                })
                var shipstate = result.getValue({
                    name: 'shipstate'
                })
                var shipcity = result.getValue({
                    name: 'shipcity'
                })
                var shipaddress2 = result.getValue({
                    name: 'shipaddress2'
                })
                var shipaddress1 = result.getValue({
                    name: 'shipaddress1'
                })
                var room = result.getValue({
                    name: 'custcol_pr_room_location'
                })
                var rate = result.getValue({
                    name: 'rate'
                })
                var amount = result.getValue({
                    name: 'custcol_robson_amount'
                })
                var sub = result.getValue({
                    name: 'custbody_robson_cust_subtotal'
                })
                var mark = result.getValue({
                    name: 'custbody_robson_mark'
                })
                var ntp = result.getValue({
                    name: 'custbody_robson_ntp'
                })
                var taxLink = result.getValue({
                    name: 'custbody_robson_tax_link'
                })
                var taxAmt = result.getValue({
                    name: 'custbody_robson_tax_amount'
                })
                var robAmount = result.getValue({
                    name: 'custbody_robson_cust_subtotal'
                })
                var returnObject = new Object()
                returnObject.itemId = returner(itemId)
                returnObject.desc = returner(desc)
                returnObject.date = returner(date)
                returnObject.doc = returner(doc)
                returnObject.location = returner(location)
                returnObject.cust = returner(cust)
                returnObject.memo = returner(memo)
                returnObject.shipDate = returner(shipDate)
                returnObject.ponum = returner(ponum)
                returnObject.sidemark = returner(sidemark)
                returnObject.duedate = returner(duedate)
                returnObject.shipmethod = returner(shipmethod)
                returnObject.quantity = returner(quantity)
                returnObject.item = returner(item)
                returnObject.billaddress1 = returner(billaddress1)
                returnObject.billaddress2 = returner(billaddress2)
                returnObject.billcity = returner(billcity)
                returnObject.billstate = returner(billstate)
                returnObject.billzip = returner(billzip)
                returnObject.shipaddress1 = returner(shipaddress1)
                returnObject.shipaddress2 = returner(shipaddress2)
                returnObject.shipcity = returner(shipcity)
                returnObject.shipstate = returner(shipstate)
                returnObject.shipzip = returner(shipzip)
                returnObject.room = returner(room)
                returnObject.rate = returner(rate)
                returnObject.amount = returner(amount)
                returnObject.sub = returner(sub)
                returnObject.mark = returner(mark)
                returnObject.ntp = returner(ntp)
                returnObject.taxAmt = returner(taxAmt)
                returnObject.taxLink = returner(taxLink)
                returnObject.robAmount = returner(robAmount)
                returnArray.push(returnObject)
                return true;
           
             });
             
             return returnArray
        }
        const getAdditionalInfo = (itemId) => {
            var itemType = search.lookupFields({
                type: 'inventoryitem',
                id: itemId,
                columns: ['salesdescription']
               })
            var desc = itemType.salesdescription
            log.debug('desc',desc)
            return desc
        }

        const generateXml = (id, locale, recordType) => {
            var record = getQuoteInfo(id)
            log.debug('record',record)
          record.sort((a, b) => (a.room > b.room) ? 1 : -1)
                      log.debug('record',record)
            let tranDate = format.format({
                value: new Date(record[0].date),
                type:  format.Type.DATE
            });
            var logo = returner('https://7513000.app.netsuite.com/core/media/media.nl?id=2460&c=7513000&h=TpDmhUs5PXkSV313hioo0g6WHy7yzRpZ-z8hTt8zeczeP9mJ')

            var xml =`<?xml version="1.0"?><!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">`
            xml+='<pdf>'
            xml+='<head>'
            xml+='<link name="NotoSans" type="font" subtype="truetype" src="${nsfont.NotoSans_Regular}" src-bold="${nsfont.NotoSans_Bold}" src-italic="${nsfont.NotoSans_Italic}" src-bolditalic="${nsfont.NotoSans_BoldItalic}" bytes="2" />'
            if (locale == "zh_CN"){
            xml+='<link name="NotoSansCJKsc" type="font" subtype="opentype" src="${nsfont.NotoSansCJKsc_Regular}" src-bold="${nsfont.NotoSansCJKsc_Bold}" bytes="2" />'
            }
            else if (locale == "zh_TW"){
            xml+='<link name="NotoSansCJKtc" type="font" subtype="opentype" src="${nsfont.NotoSansCJKtc_Regular}" src-bold="${nsfont.NotoSansCJKtc_Bold}" bytes="2" />'
            }
            else if (locale == "ja_JP"){
            xml+='<link name="NotoSansCJKjp" type="font" subtype="opentype" src="${nsfont.NotoSansCJKjp_Regular}" src-bold="${nsfont.NotoSansCJKjp_Bold}" bytes="2" />'
            }
            else if (locale == "ko_KR"){
            xml+='<link name="NotoSansCJKkr" type="font" subtype="opentype" src="${nsfont.NotoSansCJKkr_Regular}" src-bold="${nsfont.NotoSansCJKkr_Bold}" bytes="2" />'
            }
            else if (locale == "th_TH"){
            xml+='<link name="NotoSansThai" type="font" subtype="opentype" src="${nsfont.NotoSansThai_Regular}" src-bold="${nsfont.NotoSansThai_Bold}" bytes="2" />'
            }
            xml+='<style type="text/css">* {'
            if (locale == "zh_CN"){
            xml+='font-family: NotoSans, NotoSansCJKsc, sans-serif;'
            }
            else if (locale == "zh_TW"){
            xml+='font-family: NotoSans, NotoSansCJKtc, sans-serif;'
            }
            else if (locale == "ja_JP"){
            xml+='font-family: NotoSans, NotoSansCJKjp, sans-serif;'
            }
            else if (locale == "ko_KR"){
            xml+='font-family: NotoSans, NotoSansCJKkr, sans-serif;'
            }
            else if (locale == "th_TH"){
            xml+='font-family: NotoSans, NotoSansThai, sans-serif;'
            }
            else{
            xml+='font-family: NotoSans, sans-serif;'
            }
            xml+='}</style >'
            
            
            
            
            xml += `<macrolist>`
            
            xml += `<macro id="nlfooter">`
            xml += `<table class="footer" style="width: 100%;" ><tr>`
            xml += `<td><barcode codetype="code128" showtext="true" value="${record[0].doc}"/></td>`
            log.debug('record[0].location',record[0].location)
            if(record[0].location == 'PHX-DC'){
                xml += `<td class="address" colspan="8" rowspan="2" align="center" >Premier Lighting<br/>2050 South 16th Street, Suite 111 Phoenix, AZ 85034<br/>Ph: 623-907-2669 contact@shoppremier.com<br/>https://shoppremier.com</td>`
            }
            else if(record[0].location == 'TUC-WH'){
                xml += `<td class="address" colspan="8" rowspan="2" align="center">Northside Warehouse<br/>630 E. Ft. Lowell Road Tucson, AZ 85705<br/>Ph: 520-293-6111 contact@shoppremier.com<br/>https://shoppremier.com</td>`
            }
            else{
                xml += `<td class="address" colspan="8" rowspan="2" align="center" text-align="center" ><p align="center" text-align="center">`
                xml += `Premier Lighting<br/>15507 N. Scotttsdale Rd., Suite 140 Scottsdale, AZ 85254<br/>Ph: (480) 699-3534 contact@shoppremier.com<br/>https://shoppremier.com</p></td>`
            }
          


            xml += `<td align="right"><pagenumber/> of <totalpages/></td>`
            xml += `</tr></table>`
            xml += `</macro>`
            xml += `<macro id="nlheader2">`
            xml += `<table style="width: 100%; font-size: 10pt;"><tr>`
            xml += `<td rowspan="1" style="padding-top: -25px; padding-left: -10px;"><img src="${logo}" style="float: left; margin: 1px; width: 209px; height: 101px" /></td>`
            xml += `<td align="right" style="padding-top: 0px;"><span style="font-size: 20pt;"></span></td>`
            xml += `<td align="right" style="padding-top: 0px;"><span style="font-size: 24pt;">${record[0].doc}<br/>Robson Internal</span></td>`
            xml += `</tr></table>`
            xml += `</macro>`
            
          
            xml += `</macrolist>`
            
            
            
            xml +=`<style type="text/css">`
            xml +=`table {`
            xml +=`font-size: 9pt;`
            xml +=`table-layout: fixed;`
            xml +=`}`
            xml +=`th {`
            xml +=`font-weight: bold;`
            xml +=`font-size: 8pt;`
            xml +=`vertical-align: middle;`
            xml +=`padding: 5px 6px 3px;`
            xml +=`background-color: #e3e3e3;`
            xml +=`color: #333333;`
            xml +=`}`
            xml +=`td {`
            xml +=`padding: 4px 6px;`
            xml +=`}`
            xml +=`td p { align:left }`
            xml +=`b {`
            xml +=`font-weight: bold;`
            xml +=`color: #333333;`
            xml +=`}`
            xml +=`table.header td {`
            xml +=`padding: 0;`
            xml +=`font-size: 10pt;`
            xml +=`}`
            xml +=`table.footer td {`
            xml +=`padding: 0;`
            xml +=`font-size: 8pt;`
            xml +=`}`
            xml +=`table.itemtable th {`
            xml +=`padding-bottom: 10px;`
            xml +=`padding-top: 10px;`
            xml +=`}`
            xml +=`table.body td {`
            xml +=`padding-top: 2px;`
            xml +=`}`
            xml +=`td.addressheader {`
            xml +=`font-size: 8pt;`
            xml +=`padding-top: 6px;`
            xml +=`padding-bottom: 2px;`
            xml +=`}`
            xml +=`td.address {`
            xml +=`padding-top: 0;`
            xml +=`}`
            xml +=`span.title {`
            xml +=`font-size: 28pt;`
            xml +=`}`
            xml +=`span.number {`
            xml +=`font-size: 16pt;`
            xml +=`}`
            xml +=`span.itemname {`
            xml +=`font-weight: bold;`
            xml +=`line-height: 150%;`
            xml +=`}`
            xml +=`hr {`
            xml +=` width: 100%;`
            xml +=` color: #d3d3d3;`
            xml +=`background-color: #d3d3d3;`
            xml +=`height: 1px;`
            xml +=`}`
            xml +=`</style>`
            xml +=`</head>`
            
            
            
            
            xml += `<body header="nlheader2" header-height="8%" footer="nlfooter" footer-height="20pt" padding="0.5in 0.5in 0.5in 0.5in" size="Letter">`
            xml += `<table style="width: 100%;"><tr>`
            
            xml += `<td class="addressheader" colspan="5"><b>Billing Address</b></td>`
            xml += `<td class="addressheader" colspan="8"><b>Shipping Address</b></td>`
            xml += `<td class="addressheader" colspan="6"><b></b></td>`
            
            xml += `</tr>`
            xml += `<tr>`
            if(record[0].billaddress2){
                var formattedBill = `${record[0].billaddress1}<br/>${record[0].billaddress2}<br/>${record[0].billcity} ${record[0].billstate},${record[0].billzip}`
            }
            else{
                var formattedBill = `${record[0].billaddress1}<br/>${record[0].billcity} ${record[0].billstate},${record[0].billzip}`
            }
            if(record[0].shipaddress2){
                var formattedShip = `${record[0].shipaddress1}<br/>${record[0].shipaddress2}<br/>${record[0].shipcity} ${record[0].shipstate},${record[0].shipzip}`
            }
            else{
                var formattedShip = `${record[0].shipaddress1}<br/>${record[0].shipcity} ${record[0].shipstate},${record[0].shipzip}`
            }
            xml += `<td class="address" colspan="5" rowspan="2">${formattedBill}</td>`
            xml += `<td class="address" colspan="8" rowspan="2">${formattedShip}</td>`
            
            
            xml += `<td class="address" colspan="6" rowspan="2" align="left">`
            xml += `<b>Due Date: </b>${record[0].duedate}<br/>`
            xml += `<b>Document #: </b>${record[0].doc}<br/>`
            xml += `<b>PO #: </b>${record[0].ponum}<br/>`
            xml += `<b>Ship Date: </b>${record[0].shipDate}<br/>`
            xml += `<b>Ship Method: </b>${record[0].shipmethod}<br/>`
            xml += `<b>Terms: </b>${record[0].terms}<br/>`
            xml += `<b>Sidemark: </b>${record[0].sidemark}</td>`
            
            
            
            xml += `</tr>`
            xml += `</table>`
            
           xml += `<hr />`
            


            xml += `<table class="itemtable" style="width: 100%;">`
            xml += `<thead>`
            xml += `<tr>`
            
            xml += `<th colspan="10" align="left">Item</th>`
            
            xml += `<th align="left" colspan="5">Rooom Location</th>`
            xml += `<th align="left" colspan="3">Quantity</th>`
            xml += `<th align="right" colspan="4">Price</th>`
            xml += `<th align="right" colspan="4">Ext.</th>`
            
            xml += `</tr>`
            xml += `</thead>`
            var row = 1
            for(var x=0;x<record.length;x++){
                if(row % 2 == 0){
                    xml += `<tr style="background-color: white">`
                }
                else{
                    xml += `<tr style="background-color: #ededed">`
                }
                
            
                xml += `<td colspan="10" align="left"><b>  ${record[x].item}</b> <br/>${record[x].desc}</td>`
                xml += `<td align="left" colspan="5">${record[x].room}</td> `
                xml += `<td align="left" colspan="3" line-height="150%">${record[x].quantity}</td>`
                if(record[x].amount > 0){
                          var rate = Number(record[x].amount) / Number(record[x].quantity)
                var curr = rate.toFixed(2)
                }
              else{
                var curr = '0'
              }
        
                xml += `<td align="right" colspan="4">$${curr}</td>`
                xml += `<td align="right" colspan="4">$${record[x].amount}</td>`
                row++
                xml += `</tr>`
            }
            
            xml += `</table>`
  
            
            xml += `<hr />`
            xml += `<table style="page-break-inside: avoid; width: 100%; margin-top: 10px;">`
            // xml += `<#assign custTotNoTax = record.custbody_robson_cust_subtotal - record.custbody_robson_tax_amount>`
            xml += `<tr>`
            xml += `<td colspan="3">&nbsp;</td>`
            xml += `<td align="right" style="font-weight: bold; color: #333333;">Quote Total</td>`
            var quoteBackTax = Number(record[0].robAmount) - Number(record[0].taxAmt)
            xml += `<td align="right">$${quoteBackTax.toFixed(2)}</td>`
            xml += `</tr>`
            
            xml += `<tr>`
            xml += `<td colspan="3">&nbsp;</td>`
            xml += `<td align="right" style="font-weight: bold; color: #333333;">Customer Tax</td>`
            xml += `<td align="right">$${record[0].taxAmt}</td>`
            xml += `</tr>`
            
            xml += `<tr style="background-color: #e3e3e3; line-height: 200%;">`
            xml += `<td background-color="#ffffff" colspan="3">&nbsp;</td>`
            xml += `<td align="right" style="font-weight: bold; color: #333333;">Total Customer</td>`
            xml += `<td align="right">$${record[0].robAmount}</td>`
            xml += `</tr>`
            
            xml += `<tr>`
            xml += `<td colspan="3">&nbsp;</td>`
            xml += `<td align="right" style="font-weight: bold; color: #333333;">Robson Cost for NTP</td>`
            xml += `<td align="right">$${record[0].ntp}</td>`
            xml += `</tr>`
            
            
            xml += `</table>`
            
            xml += `<p style="font-size: 8pt;">`
            xml += `Stock orders may be returned within 15 days of purchase. Items must be un-installed (no wires or chain cut) and in original packaging. Displays can be returned within 15 days in original sold condition. Invoices marked FINAL SALE are non-refundable. Special Orders from PL Partners can be returned within 15 days with no penalty, all other vendors will incur a 25% restock fee for return within 15 days. Special orders are non-returnable/non-refundable 15 days from delivery. Full payment is due at time of Special Order. A $15 handling fee will be assessed for any special order under $100. PL is not liable for delayed shipments and any costs incurred by those delays. INSTALLS must be paid in full prior being scheduled. Store Credits Expire in 1 year from the invoice date. Product Damaged/Missing parts must be reported to PL within 7 days. See Sales Person for further details.`
            xml += `</p>`
            xml += `<br/>`
            xml += `<p style="font-size: 8pt;">`
            xml += `Signature ___________________________________`
            xml += `</p>`
            xml += `</body>`
            xml += `</pdf>`
            
            return xml
        }

        function returner(word) {
            if(word){
                word = word.replace(/&/g, "&amp;")
                word = word.replace(/</g, "&lt;")
                word = word.replace(/>/g, "&gt;")
                word = word.replace(/'/g, "&#39;")
                word = word.replace(/"/g, "&quot;");
            }
            else{
                word = ''
            }
            if(word == null || word == 'undefined'){
                word = ''
            }
            return word
        }

        return {
            onRequest: onRequest
        };

    });



