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
            log.debug('context',context)
            var id = context.request.parameters.custom_id;
            var param = context.request.parameters;
            var locale = context.request.parameters.lang;
            var recordType = context.request.parameters.type;
            log.debug('id', id)
            log.debug('lang', param)
            var itemLines = getItems(id)
            log.debug('itemLines',itemLines)
            var xmlString = generateXml(itemLines, id, locale, recordType);
            context.response.renderPdf({ xmlString: xmlString });
        }

        const getItems = (id) => {
            var iFul = record.load({
                type: 'itemfulfillment',
                id: id,
                isDynamic: true,
            })
            log.debug('iFul', iFul);
            var lineCount = iFul.getLineCount({
                sublistId: 'item'
            })
            log.debug('lineCount', lineCount);
            var tranId = iFul.getValue({
                fieldId: 'tranid'
            })
            log.debug('tranId', tranId);
            var cust = iFul.getText({
                fieldId: 'entity'
            })
            log.debug('cust', cust);
            var pickDate = iFul.getValue({
                fieldId: 'pickeddate'
            })
            log.debug('pickDate', pickDate);
            var deliveryDate = iFul.getValue({
                fieldId: 'trandate'
            })
            log.debug('deliveryDate', deliveryDate);
            if (lineCount > 0) {
                var itemArray = new Array()
                for (var x = 0; x < lineCount; x++) {
                        var item = iFul.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pl_item_name',
                            line: x
                        })
                        log.debug('item',item)
                        var desc = iFul.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'description',
                            line: x
                        })
                        log.debug('desc',desc)
                        var room = iFul.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pr_room_location',
                            line: x
                        })
                        log.debug('room',room)
                        var quant = iFul.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: x
                        })
                        log.debug('quant',quant)
                        var refObj = new Object()
                        refObj.tranId = tranId
                        refObj.cust = cust
                        refObj.pickDate = pickDate
                        refObj.deliveryDate = deliveryDate
                        refObj.item = item
                        refObj.desc = desc
                        refObj.room = room
                        refObj.quant = quant
                        itemArray.push(refObj)
                    }
                }
                return itemArray
        }

        const generateXml = (itemLines, id, locale, recordType) => {
            var memo = search.lookupFields({
                type: 'itemfulfillment',
                id: id,
                columns: ['memo']
            })
            log.debug("memo", memo)
            var instructions = memo.memo
            log.debug('instructions',instructions)
            var header = 'Packing Slip'
            let today = format.format({
                value: new Date(),
                type: format.Type.DATE
            });
            // var record = getDeliveryContents(id)
            var logo = returner('https://7513000.app.netsuite.com/core/media/media.nl?id=2460&c=7513000&h=TpDmhUs5PXkSV313hioo0g6WHy7yzRpZ-z8hTt8zeczeP9mJ')
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
            xml += `<td align="center" style="width: 60%; padding: 0;"><span style="font-size: 18pt;">Pallet Label</span></td>`


            xml += `<td style="width: 20%;">`
            xml += `<p style="align: right; text-align: right">`
            xml += `</p>`
            xml += `</td>`
            xml += `</tr>`
            xml += `<tr>`


            xml += `<td style="width: 60%;">`
            xml += `<p style="align: center; text-align: left"></p>`
            xml += `</td>`
            xml += `<td style="width: 20%;">`
            xml += `<p style="align: right; text-align: right"><strong></strong>`
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

            xml += `<body header="nlheader" header-height="9%" footer="nlfooter" footer-height="20pt" padding="0.5in 0.5in 0.5in 0.5in" size="Letter">`


            xml += `<table align="center" class="body" style="width: 100%; margin-top: 5px;">`
            xml += `<tr>`
            xml += `<td colspan="3"></td><td colspan="10" style="font-size: 18px; align: center">${itemLines[0].cust}</td><td colspan="3"></td>`
            xml += `</tr>`

            xml += `</table>`
       
            xml += `<table class="itemtable" style="width: 100%; margin-top: 10px;">`

            xml += `<thead>`
            xml += `<tr>`
            xml += `<th colspan="13">Product SKU <br /> Description</th>`
            xml += `<th colspan="5">Room Location</th>`
            // xml += `<th colspan="5">Bin</th>`
            xml += `<th colspan="5">Qty.</th>`

            xml += `</tr>`

            xml += `</thead>`

            for (var y = 0; y < itemLines.length; y++) {
                
                xml += `<tr>`
                xml += `<td colspan="13"><span class="itemname">${returner(itemLines[y].item)}</span><br />${itemLines[y].desc}</td>`
                xml += `<td style="line-height: 150%" colspan="5">${itemLines[y].room}</td>`
                // xml += `<td style="line-height: 150%" colspan="5">${itemLines[y].bin}</td>`

                xml += `<td style="line-height: 150%" colspan="5">${itemLines[y].quant}</td>`
      
                xml += `</tr>`
            }



            xml += `</table>`
            xml += `<table>`
            xml += `<tr>`
            xml += `<td style="line-height: 150%" colspan="5"><b>Special Instructions:</b> <br />${instructions}</td>`
            xml += `</tr>`
            xml += `</table>`
            xml += `<br /><br />`
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

        return {
            onRequest: onRequest
        };

    });



