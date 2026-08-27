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
        const getDeliveryContents = (id) => {
            var returnArray = new Array()
            var customrecord_stored_inventory_contentsSearchObj = search.create({
                type: "customrecord_stored_inventory_contents",
                filters:
                    [
                        ["custrecord_pr_delivery_record", "anyof", id]
                    ],
                columns:
                    [
                        "custrecord_stored_bin",
                        "custrecord_contents_customer",
                        "custrecord_stored_item",
                        "custrecord_stored_qty",
                        "custrecord_contents_sales_order",
                        "custrecord_so_delivery_date",
                        "custrecord_contents_customer",
                        "custrecord_pr_si_room"
                    ]
            });
            var searchResultCount = customrecord_stored_inventory_contentsSearchObj.runPaged().count;
            log.debug("customrecord_stored_inventory_contentsSearchObj result count", searchResultCount);
            customrecord_stored_inventory_contentsSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var bin = result.getText({
                    name: 'custrecord_stored_bin'
                })
                var customer = result.getText({
                    name: 'custrecord_contents_customer'
                })
                var item = result.getText({
                    name: 'custrecord_stored_item'
                })
                var itemId = result.getValue({
                    name: 'custrecord_stored_item'
                })
                var qty = result.getValue({
                    name: 'custrecord_stored_qty'
                })
                var salesOrd = result.getText({
                    name: 'custrecord_contents_sales_order'
                })
                log.debug('salesOrd', salesOrd)
                if (!salesOrd) {
                    salesOrd = ''
                }
                var id = result.getValue({
                    name: 'custrecord_contents_sales_order'
                })
                var date = result.getValue({
                    name: 'custrecord_so_delivery_date'
                })
                var room = result.getValue({
                    name: 'custrecord_pr_si_room'
                })
                var returnInfo = getAdditionalInfo(id, itemId)

                var returnObject = new Object()
                returnObject.bin = returner(bin)
                returnObject.customer = returner(customer)
                returnObject.item = returner(item)
                returnObject.qty = qty
                returnObject.salesOrd = salesOrd
                returnObject.date = date
                returnObject.room = returner(room)
                returnObject.shipAddress = returner(returnInfo.shipAddress)
                returnObject.otherrefnum = returner(returnInfo.otherrefnum)
                returnObject.shipdate = returner(returnInfo.shipdate)
                returnObject.shipmethod = returner(returnInfo.shipMethod)
                returnObject.description = returner(returnInfo.desc)

                returnArray.push(returnObject)
                return true;
            });
            return returnArray
        }
        const getAdditionalInfo = (id, itemId) => {
            var itemType = search.lookupFields({
                type: 'inventoryitem',
                id: itemId,
                columns: ['salesdescription']
            })
            var desc = itemType.salesdescription
            log.debug('desc', desc)
            try {
                var salesOrd = record.load({
                    type: 'salesorder',
                    id: id
                })
                var shipMethod = salesOrd.getText({
                    fieldId: 'shipmethod'
                })
                var shipdate = salesOrd.getValue({
                    fieldId: 'shipdate'
                })
                formatShipdate = format.format({
                    value: shipdate,
                    type: format.Type.DATE
                });
                var otherrefnum = salesOrd.getValue({
                    fieldId: 'otherrefnum'
                })
                var shipAddress = salesOrd.getValue({
                    fieldId: 'shipaddress'
                })
                var returnObj = new Object()
                returnObj.desc = desc
                returnObj.shipMethod = shipMethod
                returnObj.shipdate = formatShipdate
                returnObj.otherrefnum = returner(otherrefnum)
                returnObj.shipAddress = returner(shipAddress)
                return returnObj
            }
            catch (e) {
                log.debug('e in add info', e)

                var returnObj = new Object()
                returnObj.desc = desc
                returnObj.shipMethod = ''
                returnObj.shipdate = ''
                returnObj.otherrefnum = ''
                returnObj.shipAddress = ''
                return returnObj
            }
        }

        const generateXml = (id, locale, recordType) => {
            var instPay = search.lookupFields({
                type: 'customrecord_pr_delivery_record',
                id: id,
                columns: ['custrecord_pr_deliver_instructions']
            })
            log.debug("instPay", instPay)
            var instructions = instPay.custrecord_pr_deliver_instructions
            var header = 'Packing Slip'
            let today = format.format({
                value: new Date(),
                type: format.Type.DATE
            });
            var record = getDeliveryContents(id)
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

            // xml += `<td style="width: 20%; padding-left: -2">`
            // xml += `<p style="text-align: left; font-family: NotoSans, NotoSansCJKsc, sans-serif; font-size: 10px">`

            // xml += `<b>Deliver To: </b><br /> ${record[0].shipAddress}</p>`
            // xml += `</td>`

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
            // xml += `<macro id="nlheader2">`
            // xml += `<table style="width: 100%; font-size: 10pt;">`
            // xml += `<tr>`
            // xml += `<td style="width: 20%; padding-right: -10px; align: right; text-align: right">`
            // xml += `<img src="${logo}" style="align: right; width: 150px; height:70px" />`
            // xml += `</td>`
            // xml += `<td align="center" style="width: 60%; padding: 0;"><span style="font-size: 28pt;">Delivery Slip </span></td>`


            // xml += `<td style="width: 20%;">`
            // xml += `<p style="align: right; text-align: right">`
            // xml += `SO#${record[0].salesOrd}</p>`
            // xml += `</td>`
            // xml += `</tr>`
            // xml += `<tr>`

            // xml += `<td style="width: 20%; padding-left: -2">`
            // xml += `<p style="text-align: left; font-family: NotoSans, NotoSansCJKsc, sans-serif; font-size: 10px">`

            // xml += `<b>Deliver To: </b><br /> ${record[0].shipAddress}</p>`
            // xml += `</td>`

            // xml += `<td style="width: 60%;">`
            // xml += `<p style="align: center; text-align: left"></p>`
            // xml += `</td>`
            // xml += `<td style="width: 20%;">`
            // xml += `<p style="align: right; text-align: right"><strong>Date:</strong> ${today}`
            // xml += `</p>`
            // xml += `</td>`
            // xml += `</tr>`
            // xml += `</table>`
            // xml += `<table style="position: absolute; width: 80%; left: 50; top: 50; padding-left: 100">`
            // xml += `<tr>`
            // xml += `<td colspan="3" style="font-size: 8pt; padding: 6px 0 2px; font-weight: bold; color: #333333;">`
            // xml += `</td>`
            // xml += `<td colspan="3" style="font-size: 8pt; padding: 6px 0 2px; font-weight: bold; color: #333333;">`
            // xml += `</td>`

            // xml += `</tr>`
            // xml += `<tr>`
            // xml += `<td class="address" colspan="3" style="padding-left: 0;"></td>`
            // xml += `<td class="address" colspan="3" style="padding-left: 0"></td>`

            // xml += `</tr>`
            // xml += `</table>`
            // xml += `</macro>`
            var timestamp = new Date().toLocaleString()
                    log.debug('timestamp',timestamp)
             xml += `<macro id="nlfooter">`
             xml += `<table class="footer" style="width: 100%;">`
             xml += `<tr>`
             xml += `<td align="right">`
             xml += `<pagenumber /> of `
             xml += `<totalpages /> <br/> ${timestamp}`
             xml += `</td>`
             xml += `</tr>`
             xml += `</table>`
             xml += `</macro>`
             xml += `<macro id="nlfooter2">`
             xml += `<table class="footer" style="width: 100%;">`
             xml += `<tr>`
             xml += `<td align="right">`
             xml += `<pagenumber /> of `
             xml += `<totalpages /> <br/> ${timestamp}`
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

            xml += `<body header="nlheader" header-height="9%" footer="nlfooter" footer-height="20pt" padding="0.5in 0.5in 0.5in 0.5in" size="Letter">`


            xml += `<table align="center" class="body" style="width: 100%; margin-top: 5px;">`
            xml += `<tr>`
            xml += `<td colspan="3"></td><td colspan="10" style="font-size: 18px; align: center">${record[0].customer}</td><td colspan="3"></td>`
            xml += `</tr>`

            xml += `</table>`
            //      xml += `<table class="body" style="width: 100%; margin-top: 10px;">`
            //      xml += `<tr>`
            //     xml += `<th align="center">Delivery Record</th>`
            //      xml += `<th align="center">Ship Via</th>`
            //      xml += `<th align="center">Estimated <br /> Ship Date</th>`
            //      xml += `<th align="center">Sales Rep</th>`

            //      xml += `</tr>`
            //      xml += `<tr>`
            // xml += `<td>${id}</td>`
            //      xml += `<td>${record[0].shipmethod}</td>`
            //      xml += `<td>${record[0].shipdate}</td>`
            //         xml += `<td></td>`

            //      xml += `</tr>`
            //      xml += `</table>`

            xml += `<table class="itemtable" style="width: 100%; margin-top: 10px;">`

            xml += `<thead>`
            xml += `<tr>`
            xml += `<th colspan="13">Product SKU <br /> Description</th>`
            xml += `<th colspan="5">Room Location</th>`
            xml += `<th colspan="5">Bin</th>`
            xml += `<th colspan="5">Qty.</th>`
            // xml += `<th colspan="5">Sales Order</th>`
            //  xml += `<th colspan="3">Initials</th>`

            xml += `</tr>`

            xml += `</thead>`

            for (var x = 0; x < record.length; x++) {
                // xml += "<tr style='background-color: ${((item_index % 2) == 0) ? string('white', '#e3e3e3')}'>"
                xml += `<tr>`
                xml += `<td colspan="13"><span class="itemname">${returner(record[x].item)}</span><br />${record[x].description}</td>`
                xml += `<td style="line-height: 150%" colspan="5">${record[x].room}</td>`
                xml += `<td style="line-height: 150%" colspan="5">${record[x].bin}</td>`

                xml += `<td style="line-height: 150%" colspan="5">${record[x].qty}</td>`
                // xml += `<td style="line-height: 150%" colspan="5">${record[x].salesOrd}</td>`

                //  xml += `<td style="line-height: 150%; border: 1px solid black; align: right;" colspan="3"></td>`
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



