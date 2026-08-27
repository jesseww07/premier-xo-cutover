/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define([
    'N/ui/serverWidget',
    'N/record',
    'N/url',
    'N/search',
    'N/runtime',
    'N/render',
], function (serverWidget, record, url, search, runtime, render) {

    function onRequest(context) {
        if (context.request.method == 'GET') {
            var soId = context.request.parameters.soId;

           // var soId = 502636
            var soRec = record.load({
                type: record.Type.SALES_ORDER,
                id: soId,
                isDynamic: false
            });

            var customerId = soRec.getValue('entity');
            var parentId = findParent(customerId)
            if (!parentId) {
                return
            }


            var orderItems = fetchCurrentItems(soId);
            var storedQuantities = fetchStoredQuantities(orderItems, parentId);


            var form = serverWidget.createForm({
                title: 'Sales Order: Storage Evaluation'
            });

            var idStore = form.addField({
                id: 'custpage_soid',
                type: serverWidget.FieldType.TEXT,
                label: 'Sales Order ID'
            })

            idStore.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            idStore.defaultValue = soId

            form.addField({
                id: 'custpage_modal_html',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Image Lightbox'
            }).defaultValue = ''
            + '<div id="imgModal" '
            + '     style="display:none;'
            + '            position:fixed;'
            + '            top:0; left:0;'
            + '            width:100%; height:100%;'
            + '            background:rgba(0,0,0,0.8);'
            + '            text-align:center;'
            + '            z-index:10000;"'
            + '     onclick="document.getElementById(\'imgModal\').style.display=\'none\'">'
            + '  <img id="modalImg" '
            + '       style="max-width:90%; max-height:90%; margin-top:4%;" />'
            + '</div>'
            + '<script>'
            + '  function showImage(src) {'
            + '    var m = document.getElementById("modalImg");'
            + '    m.src = src;'
            + '    document.getElementById("imgModal").style.display = "block";'
            + '  }'
                + '</script>';


            form.addField({
                id: 'custpage_so_date',
                type: serverWidget.FieldType.DATE,
                label: 'Date'
            }).defaultValue = soRec.getValue('trandate');

            form.addField({
                id: 'custpage_doc_number',
                type: serverWidget.FieldType.TEXT,
                label: 'Document Number'
            }).defaultValue = soRec.getValue('tranid');

            form.addField({
                id: 'custpage_po_number',
                type: serverWidget.FieldType.TEXT,
                label: 'PO Number'
            }).defaultValue = soRec.getValue('otherrefnum');

            form.addField({
                id: 'custpage_sales_rep',
                type: serverWidget.FieldType.TEXT,
                label: 'Project Coordinator'
            }).defaultValue = soRec.getText('custbody_project_coordinator');

            // form.addField({
            //     id: 'custpage_ship_date',
            //     type: serverWidget.FieldType.DATE,
            //     label: 'Ship Date'
            // }).defaultValue = soRec.getValue('shipdate');


            var sublist = form.addSublist({
                id: 'custpage_item_sublist',
                type: serverWidget.SublistType.LIST,
                label: 'Items'
            });

            sublist.addField({
                id: 'custpage_item',
                type: serverWidget.FieldType.TEXT,
                label: 'Item'
            });
            sublist.addField({
                id: 'custpage_vendorname',
                type: serverWidget.FieldType.TEXT,
                label: 'Vendor Name'
            });
            sublist.addField({
                id: 'custpage_qty',
                type: serverWidget.FieldType.FLOAT,
                label: 'Quantity'
            });
            sublist.addField({
                id: 'custpage_qty_committed',
                type: serverWidget.FieldType.FLOAT,
                label: 'Qty Committed'
            });
            sublist.addField({
                id: 'custpage_qty_shipped',
                type: serverWidget.FieldType.FLOAT,
                label: 'Qty Shipped'
            });
            sublist.addField({
                id: 'custpage_qty_remaining',
                type: serverWidget.FieldType.FLOAT,
                label: 'Qty Remaining'
            });
            var specialFld = sublist.addField({
                id: 'custpage_special_order',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Special Order'
            });
            specialFld.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });
            sublist.addField({
                id: 'custpage_qty_stored',
                type: serverWidget.FieldType.FLOAT,
                label: 'Qty In Stored'
            });
            var detailFld = sublist.addField({
                id: 'custpage_thumb',
                type: serverWidget.FieldType.URL,
                label: 'Evaluate Stored'
            });
            detailFld.linkText = 'View Details';
            var uniqueKey = sublist.addField({
                id: 'custpage_key',
                type: serverWidget.FieldType.TEXT,
                label: 'Key'
            });
            uniqueKey.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            var itemId = sublist.addField({
                id: 'custpage_itemid',
                type: serverWidget.FieldType.TEXT,
                label: 'Item ID'
            });
            itemId.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });
            var qty = sublist.addField({
                id: 'custpage_qtyreq',
                type: serverWidget.FieldType.FLOAT,
                label: 'Requesting Quantity'
            });
            qty.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.ENTRY
            });
            sublist.addField({
                id: 'custpage_submit',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Select for Reallocation'
            });
            var payload = sublist.addField({
                id: 'custpage_payload',
                type: serverWidget.FieldType.TEXTAREA,
                label: 'Payload'
            });
            payload.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.HIDDEN
            });






            form.addTab({
                id: 'custpage_tab_print',
                label: 'Print Output'
            }); render.PrintMode.PDF



            var renderer = render.create();
            renderer.setTemplateByScriptId('CUSTTMPL_102_7513000_455'); // Ensure this template exists

            const salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: soId
            });
            renderer.addRecord('record', salesOrder);

            // Render as PDF
            var pdfFile = renderer.renderAsPdf();

            // Convert to Base64 for embedding
            var pdfBase64 = pdfFile.getContents();
            var pdfDataUrl = 'data:application/pdf;base64,' + pdfBase64;

            // Add Field to Display PDF in an iFrame
            form.addField({
                id: 'custpage_html_printout',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Sales Order Printout',
                container: 'custpage_tab_print'
            }).defaultValue =
                '<iframe src="' + pdfDataUrl + '" style="width: 100%; height: 600px; border: none;"></iframe>';



            var lineCount = soRec.getLineCount({ sublistId: 'item' });
            for (var i = 0; i < lineCount; i++) {
                var itemName = soRec.getSublistText({ sublistId: 'item', fieldId: 'item', line: i });
                var itemId = soRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                var qty = soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                var qtyCommitted = soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantitycommitted', line: i }) || 0;
                var qtyShipped = soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantityfulfilled', line: i }) || 0;
                var specialOrder = soRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_zastro_unconsolidated_item', line: i });
                var lineKey = soRec.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: i });
                var venCode = soRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_vendor_code', line: i }) || '-'
                var qtyRemaining = Number(qty) - Number(qtyShipped) - Number(qtyCommitted)
                var storedQty = getStoredQuantity(itemId, storedQuantities);
                var detailArray = filterByItemId(storedQuantities, itemId)

                sublist.setSublistValue({ id: 'custpage_item', line: i, value: itemName });
                sublist.setSublistValue({ id: 'custpage_itemid', line: i, value: itemId });
                sublist.setSublistValue({ id: 'custpage_qty', line: i, value: qty.toString() });
                sublist.setSublistValue({ id: 'custpage_qty_committed', line: i, value: qtyCommitted.toString() });
                sublist.setSublistValue({ id: 'custpage_qty_shipped', line: i, value: qtyShipped.toString() });
                sublist.setSublistValue({ id: 'custpage_special_order', line: i, value: specialOrder ? 'T' : 'F' });
                sublist.setSublistValue({ id: 'custpage_qty_stored', line: i, value: storedQty.toString() });
                sublist.setSublistValue({ id: 'custpage_key', line: i, value: lineKey });
                sublist.setSublistValue({ id: 'custpage_qty_remaining', line: i, value: qtyRemaining });
                sublist.setSublistValue({ id: 'custpage_vendorname', line: i, value: venCode });



                var json = JSON.stringify(detailArray);
                var encoded = encodeURIComponent(json);

                sublist.setSublistValue({ id: 'custpage_payload', line: i, value: json });

                var detailUrl = url.resolveScript({
                    scriptId: 'customscript_pr_stored_reallocator',    // change these
                    deploymentId: 'customdeploy_pr_stored_reallocator',
                    params: {
                        soId: soId,       // if you still need to know the SO
                        data: encoded     // your JSON payload
                    }
                });

                // 2) set the raw URL
                sublist.setSublistValue({
                    id: 'custpage_thumb',
                    line: i,
                    value: detailUrl
                });
            }
            form.addSubmitButton({
                label: 'Save'
            });
            context.response.writePage(form);
        }
        else {
            var req = context.request;
            var soId = Number(req.parameters.custpage_soid);
            var currentUser = runtime.getCurrentUser().id;
            var toCreate = [];

            var lineCount = req.getLineCount('custpage_item_sublist');
            for (var i = 0; i < lineCount; i++) {
                var isSelected = req.getSublistValue(
                    'custpage_item_sublist',
                    'custpage_submit',
                    i
                );
                var qtyReq = Number(req.getSublistValue(
                    'custpage_item_sublist',
                    'custpage_qtyreq',
                    i
                ));
                if (isSelected == 'T' && Number(qtyReq) > 0) {
                    var payloadEnc = req.getSublistValue(
                        'custpage_item_sublist',
                        'custpage_payload',
                        i
                    );
                    log.debug('payloadEnc', payloadEnc)
                    var detailArr = JSON.parse(decodeURIComponent(payloadEnc));
                    var item = req.getSublistValue(
                        'custpage_item_sublist',
                        'custpage_itemid',
                        i
                    );
                   var key = req.getSublistValue(
                        'custpage_item_sublist',
                        'custpage_key',
                        i
                    );

                  
                    toCreate.push({ detail: detailArr, item: item, qtyReq: qtyReq, key: key });
                }
            }
            var createdIds = [];
            toCreate.forEach(function (r) {
                var rec = record.create({ type: 'customrecord_pr_stored_reallocation', isDynamic: false });
                log.debug('JSON.stringify(r.detail)', JSON.stringify(r.detail))
                var htmlData = getRendered(JSON.stringify(r.detail))
                log.debug('htmlData', htmlData)
                rec.setValue({ fieldId: 'custrecord_pr_stored_reallocation_supply', value: htmlData });
                rec.setValue({ fieldId: 'custrecord_pr_stored_reallocation_qty', value: r.qtyReq });
                rec.setValue({ fieldId: 'custrecord_pr_stored_reallocation_so', value: soId });
                rec.setValue({ fieldId: 'custrecord_pr_stored_reallocation_user', value: currentUser });
                rec.setValue({ fieldId: 'custrecord_pr_stored_reallocation_item', value: r.item });
      rec.setValue({ fieldId: 'custrecord_pr_stored_reallocation_key', value: r.key });
              
                createdIds.push(rec.save());
            });

            var form = serverWidget.createForm({ title: 'Reallocation Submitted' });
            form.addField({
                id: 'custpage_confirm',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Confirmation'
            }).defaultValue =
                '<p>Created ' + createdIds.length + ' record(s): ' +
                createdIds.join(', ') + '</p>';
            context.response.writePage(form);
        }
    }

    function getRendered(data) {
        var arr = JSON.parse(decodeURIComponent(data));

        var html = '';

        // Header
        html += '<h2 style="margin:0 0 12px 0; font-size:16px;">Stored Quantity Details</h2>';

        // Table open
        html += '<table style="border-collapse:collapse; width:100%; max-width:600px; margin-bottom:1em;">';

        // Column headers
        html += '<tr>';
        ['Date', 'Entity', 'Doc#', 'PO #', 'Item', 'Qty', 'Committed'].forEach(function (col) {
            html += '<th style="background:#EEE; border:1px solid #CCC; padding:6px; text-align:left; font-weight:bold;">'
                + col
                + '</th>';
        });
        html += '</tr>';

        // Data rows
        arr.forEach(function (r) {
            html += '<tr>';
            html += '<td style="border:1px solid #CCC; padding:6px;">' + r.trandate + '</td>';
            html += '<td style="border:1px solid #CCC; padding:6px;">' + r.entityText + '</td>';
            html += '<td style="border:1px solid #CCC; padding:6px;">' + r.docNum + '</td>';
            html += '<td style="border:1px solid #CCC; padding:6px;">' + r.otherrefnum + '</td>';
            html += '<td style="border:1px solid #CCC; padding:6px;">' + r.itemText + '</td>';
            html += '<td style="border:1px solid #CCC; padding:6px; text-align:right;">' + r.quantity + '</td>';
            html += '<td style="border:1px solid #CCC; padding:6px; text-align:right;">' + r.quantitycommitted + '</td>';
            html += '</tr>';
        });

        // Table close
        html += '</table>';

        return html;
    }


    function filterByItemId(arr, itemId) {
        var matches = [];
        for (var i = 0; i < arr.length; i++) {
            // loose compare in case itemId comes in as string vs number
            if (arr[i].item == itemId) {
                matches.push(arr[i]);
            }
        }
        return matches;
    }

    function fetchCurrentItems(soId) {
        var returnArr = new Array()
        var salesorderSearchObj = search.create({
            type: "salesorder",
            filters:
                [
                    ["mainline", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"],
                    "AND",
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["internalidnumber", "equalto", soId]
                ],
            columns:
                [
                    search.createColumn({
                        name: "item",
                        summary: "GROUP"
                    })
                ]
        });
        var searchResultCount = salesorderSearchObj.runPaged().count;
        log.debug("salesorderSearchObj result count", searchResultCount);
        salesorderSearchObj.run().each(function (result) {
            // .run().each has a limit of 4,000 results
            var res = result.getValue({ name: 'item', summary: 'GROUP' })
            returnArr.push(res)
            return true;
        });
        return returnArr
    }
    function fetchStoredQuantities(orderItems, parentId) {
        var returnArr = new Array()
        var salesorderSearchObj = search.create({
            type: "salesorder",
            filters:
                [
                    ["mainline", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"],
                    "AND",
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["location", "anyof", "9"],
                    "AND",
                    ["item", "anyof", orderItems],
                    "AND",
                    ["quantitycommitted", "greaterthan", "0"],
                    "AND",
                    [["customermain.parent", "anyof", parentId], "OR", ["name", "anyof", parentId]]
                ],
            columns:
                [
                    "item",
                    "quantity",
                    "quantitycommitted",
                    "entity",
                    "trandate",
                    "tranid",
                    "otherrefnum"
                ]
        });
        var searchResultCount = salesorderSearchObj.runPaged().count;
        log.debug("salesorderSearchObj result count", searchResultCount);
        salesorderSearchObj.run().each(function (result) {
            // .run().each has a limit of 4,000 results
            var returnObj = new Object()
            returnObj.item = result.getValue({ name: 'item' })
            returnObj.itemText = result.getText({ name: 'item' })
            returnObj.quantity = result.getValue({ name: 'quantity' })
            returnObj.quantitycommitted = result.getValue({ name: 'quantitycommitted' })
            returnObj.entity = result.getValue({ name: 'entity' })
            returnObj.entityText = result.getText({ name: 'entity' })
            returnObj.docNum = result.getValue({ name: 'tranid' })
            returnObj.trandate = result.getValue({ name: 'trandate' })
            returnObj.otherrefnum = result.getValue({ name: 'otherrefnum' })
            returnArr.push(returnObj)
            return true;
        });
        return returnArr
    }
    function findParent(customerId) {
        var returnVal;
        var customerSearchObj = search.create({
            type: "customer",
            filters:
                [
                    ["internalidnumber", "equalto", customerId]
                ],
            columns:
                [
                    "parent"
                ]
        });
        var searchResultCount = customerSearchObj.runPaged().count;
        log.debug("customerSearchObj result count", searchResultCount);
        customerSearchObj.run().each(function (result) {
            // .run().each has a limit of 4,000 results
            var res = result.getValue({ name: 'parent' })
            returnVal = res
            return true;
        });
        return returnVal
    }
    function getStoredQuantity(itemId, storedArray) {
        var totalQty = 0
        for (var j = 0; j < storedArray.length; j++) {
            if (storedArray[j].item === itemId) {
                totalQty += Number(storedArray[j].quantitycommitted);
            }
        }
        return totalQty;
    }

    return {
        onRequest: onRequest
    };
});


