define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/render'],
    /**
     *@NApiVersion 2.1
     *@NModuleScope Public
     *@NScriptType Suitelet
     */
    function (log, serverWidget, record, search, render) {

        const excludeBins = [1316, 1132, 293, 298, 305, 1126, 1353, 1724, 2201, 692, 697, 1145, 1619, 2, 3];

        const sanitizeString = (str) => {
            if (!str || typeof str !== 'string') return str;
            return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        };

        const generatePdf = (data, template) => {
            try {
                let renderer = render.create();
                renderer.setTemplateById({ id: +template });
                renderer.addCustomDataSource({
                    format: render.DataSource.OBJECT,
                    alias: 'results',
                    data: { results: data }
                });
                return renderer.renderAsPdf();
            } catch (e) {
                log.error('generatePdf error', { error: e.name, message: e.message });
                throw e;
            }
        };

        function onRequest(context) {
            if (context.request.method === 'GET') {
                let salesOrderId = context.request.parameters.custom_id;
                if (!salesOrderId) {
                    log.error('Missing salesOrderId');
                    return;
                }

                let form = serverWidget.createForm({ title: 'Sales Order Items for Picking' });
                form.addField({ id: 'custpage_so_internalid', label: 'so internal id', type: serverWidget.FieldType.TEXT })
                    .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN }).defaultValue = salesOrderId;

                let sublist = form.addSublist({ id: 'sublist', type: serverWidget.SublistType.LIST, label: 'Items' });
                sublist.addField({ id: 'custpage_selected', label: 'Select', type: serverWidget.FieldType.CHECKBOX });
                sublist.addField({ id: 'custpage_quantity_to_fulfill', label: 'Quantity To Fulfill', type: serverWidget.FieldType.FLOAT })
                    .updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
                sublist.addField({ id: 'custpage_so_id', label: 'Sales Order ID', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_item', label: 'Item', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_item_qty', label: 'Quantity Ordered', type: serverWidget.FieldType.INTEGER });
                sublist.addField({ id: 'custpage_qty_committed', label: 'Quantity Committed', type: serverWidget.FieldType.INTEGER });
                sublist.addField({ id: 'custpage_qty_shipped', label: 'Quantity Shipped', type: serverWidget.FieldType.INTEGER });
                sublist.addField({ id: 'custpage_qty_backordered', label: 'Quantity Backordered', type: serverWidget.FieldType.INTEGER });
                sublist.addField({ id: 'custpage_loc', label: 'Location', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_item_options', label: 'Item Options', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_item_description', label: 'Item Description', type: serverWidget.FieldType.TEXTAREA });
                sublist.addField({ id: 'custpage_item_room_location', label: 'Item Room Location', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_bins', label: 'Bins', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_ship_method', label: 'Shipping Method', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_item_id', label: 'Item ID', type: serverWidget.FieldType.TEXT })
                    .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                sublist.addField({ id: 'custpage_location_id', label: 'Location ID', type: serverWidget.FieldType.TEXT })
                    .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                // Step 1: Get all SO lines and collect unique Item/Location IDs
                let salesLines = [];
                let itemIdSet = new Set();
                let locationIdSet = new Set();

                let salesorderSearchObj = search.create({
                    type: "salesorder",
                    filters: [
                        ["type", "anyof", "SalesOrd"], "AND",
                        ["mainline", "is", "F"], "AND",
                        ["taxline", "is", "F"], "AND",
                        ["shipping", "is", "F"], "AND",
                        ["internalid", "anyof", salesOrderId], "AND",
                        ["formulanumeric: CASE WHEN {quantity} - {quantityshiprecv} > 0 THEN 1 ELSE 0 END", "greaterthan", "0"], "AND",
                        ["status", "anyof", "SalesOrd:B", "SalesOrd:D", "SalesOrd:A", "SalesOrd:E"]
                    ],
                    columns: [
                        "tranid", "item", "quantity", "quantitycommitted", "quantityshiprecv", "location", "shipmethod",
                        search.createColumn({ name: "internalid", join: "item" }),
                        "custcol_item_options",
                        search.createColumn({ name: "salesdescription", join: "item" }),
                        "custcol_pr_room_location",
                        search.createColumn({ name: "formulanumeric", formula: "{quantity} - {quantityshiprecv} - {quantitycommitted}" })
                    ]
                });

                salesorderSearchObj.run().each(function (result) {
                    let itemId = result.getValue({ name: "internalid", join: "item" });
                    let locationId = result.getValue('location');
                    if (!itemId || !locationId) return true;

                    itemIdSet.add(itemId);
                    locationIdSet.add(locationId);

                    let qty = Number(result.getValue('quantity') || 0);
                    let qtyShip = Number(result.getValue('quantityshiprecv') || 0);

                    salesLines.push({
                        doc: result.getValue('tranid'),
                        item: result.getText('item') || 'N/A',
                        itemId: itemId,
                        qty: qty,
                        qtyShip: qtyShip,
                        qtyCommit: Number(result.getValue('quantitycommitted') || 0),
                        location: result.getText('location') || 'N/A',
                        locationId: locationId,
                        shipMethod: result.getText('shipmethod') || 'N/A',
                        itemOptions: result.getValue('custcol_item_options') || 'N/A',
                        description: result.getValue({ name: "salesdescription", join: "item" }) || 'N/A',
                        roomLocation: result.getValue("custcol_pr_room_location") || 'N/A',
                        qtyBackOrdered: Number(result.getValue('formulanumeric') || 0),
                        qtyToFulfill: qty - qtyShip
                    });

                    return true;
                });

                // Step 2: Run a single search for all bin data
                let binDataMap = {};
                if (itemIdSet.size > 0) {
                    let inventorybalanceSearchObj = search.create({
                        type: "inventorybalance",
                        filters: [
                            ["item", "anyof", [...itemIdSet]], "AND",
                            ["location", "anyof", [...locationIdSet]], "AND",
                            ["binnumber", "noneof", excludeBins], "AND",
                            ["onhand", "greaterthan", 0]
                        ],
                        columns: [
                            search.createColumn({ name: "binnumber" }),
                            search.createColumn({ name: "onhand" }),
                            search.createColumn({ name: "item" }),
                            search.createColumn({ name: "location" })
                        ]
                    });

                    inventorybalanceSearchObj.run().each(result => {
                        let key = `${result.getValue('item')}_${result.getValue('location')}`;
                        if (!binDataMap[key]) binDataMap[key] = [];
                        binDataMap[key].push({
                            bin: result.getText('binnumber'),
                            onhand: +result.getValue('onhand')
                        });
                        return true;
                    });

                    // Sort each bin list descending by onhand to minimize bin splits on picking tickets
                    for (let key in binDataMap) {
                        binDataMap[key].sort((a, b) => b.onhand - a.onhand);
                    }
                }

                // Step 3: Populate the sublist
                for (let i = 0; i < salesLines.length; i++) {
                    let line = salesLines[i];
                    let binsToPick = [];
                    let totalPicked = 0;
                    let availableBins = binDataMap[`${line.itemId}_${line.locationId}`] || [];

                    for (const binInfo of availableBins) {
                        if (totalPicked >= line.qtyToFulfill) break;
                        let qtyToPickFromBin = Math.min(line.qtyToFulfill - totalPicked, binInfo.onhand);
                        if (qtyToPickFromBin > 0) {
                            binsToPick.push(`${binInfo.bin}: ${qtyToPickFromBin}`);
                            totalPicked += qtyToPickFromBin;
                        }
                    }

                    sublist.setSublistValue({ id: 'custpage_so_id', line: i, value: 'SO#' + line.doc });
                    sublist.setSublistValue({ id: 'custpage_item', line: i, value: line.item });
                    sublist.setSublistValue({ id: 'custpage_item_qty', line: i, value: line.qty });
                    sublist.setSublistValue({ id: 'custpage_qty_committed', line: i, value: line.qtyCommit });
                    sublist.setSublistValue({ id: 'custpage_qty_shipped', line: i, value: line.qtyShip });
                    sublist.setSublistValue({ id: 'custpage_qty_backordered', line: i, value: line.qtyBackOrdered });
                    sublist.setSublistValue({ id: 'custpage_loc', line: i, value: line.location });
                    sublist.setSublistValue({ id: 'custpage_item_options', line: i, value: line.itemOptions });
                    sublist.setSublistValue({ id: 'custpage_item_description', line: i, value: line.description });
                    sublist.setSublistValue({ id: 'custpage_item_room_location', line: i, value: line.roomLocation });
                    sublist.setSublistValue({ id: 'custpage_bins', line: i, value: binsToPick.length > 0 ? binsToPick.join(', ') : 'No bins found' });
                    sublist.setSublistValue({ id: 'custpage_ship_method', line: i, value: line.shipMethod });
                    sublist.setSublistValue({ id: 'custpage_item_id', line: i, value: line.itemId });
                    sublist.setSublistValue({ id: 'custpage_location_id', line: i, value: line.locationId });
                }

                form.addSubmitButton('Generate Picking Ticket');
                context.response.writePage(form);

            } else { // POST
                let custArray = [];
                let soInternalId = context.request.parameters.custpage_so_internalid;

                const soRecord = record.load({ type: 'salesorder', id: soInternalId });
                const shippingAddressSubrecord = soRecord.getSubrecord({ fieldId: 'shippingaddress' });

                const headerInfo = {
                    entity: sanitizeString(soRecord.getText('entity')),
                    attention: sanitizeString(shippingAddressSubrecord.getValue('attention')),
                    addr1: sanitizeString(shippingAddressSubrecord.getValue('addr1')),
                    city: sanitizeString(shippingAddressSubrecord.getValue('city')),
                    state: sanitizeString(shippingAddressSubrecord.getValue('state')),
                    zip: sanitizeString(shippingAddressSubrecord.getValue('zip')),
                    transactionDate: sanitizeString(soRecord.getText('trandate')),
                    shipDate: sanitizeString(soRecord.getText('shipdate')),
                    salesRep: sanitizeString(soRecord.getText('salesrep')),
                    otherRefNum: sanitizeString(soRecord.getValue('otherrefnum')),
                    shipMethod: sanitizeString(soRecord.getText('shipmethod')),
                    soId: sanitizeString(soRecord.getValue('tranid'))
                };

                let requestCount = context.request.getLineCount({ group: 'sublist' });
                for (let x = 0; x < requestCount; x++) {
                    if (context.request.getSublistValue({ group: 'sublist', name: 'custpage_selected', line: x }) !== 'T') continue;

                    let binsFromSublist = context.request.getSublistValue({ group: 'sublist', name: 'custpage_bins', line: x });
                    let itemOptions = context.request.getSublistValue({ group: 'sublist', name: 'custpage_item_options', line: x });

                    custArray.push({
                        ...headerInfo,
                        itemName: sanitizeString(context.request.getSublistValue({ group: 'sublist', name: 'custpage_item', line: x })),
                        itemDescription: sanitizeString(context.request.getSublistValue({ group: 'sublist', name: 'custpage_item_description', line: x })),
                        itemOptions: itemOptions === 'N/A' ? '' : sanitizeString(itemOptions),
                        itemRoomLocation: sanitizeString(context.request.getSublistValue({ group: 'sublist', name: 'custpage_item_room_location', line: x })),
                        qty: context.request.getSublistValue({ group: 'sublist', name: 'custpage_quantity_to_fulfill', line: x }),
                        qtyCommitted: context.request.getSublistValue({ group: 'sublist', name: 'custpage_qty_committed', line: x }),
                        qtyBackOrdered: context.request.getSublistValue({ group: 'sublist', name: 'custpage_qty_backordered', line: x }),
                        bins: binsFromSublist === 'No bins found' ? [] : binsFromSublist.split(', ')
                    });
                }

                if (custArray.length > 0) {
                    let pdfFile = generatePdf(custArray, 119);
                    context.response.writeFile({ file: pdfFile, isInline: true });
                } else {
                    context.response.write('No items were selected to generate a picking ticket.');
                }
            }
        }

        return { onRequest };
    });
