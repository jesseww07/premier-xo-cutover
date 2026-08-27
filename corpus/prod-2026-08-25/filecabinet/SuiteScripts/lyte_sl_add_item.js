/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
 define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect','N/runtime'],
    function (log, serverWidget, record, search, url, redirect,runtime) {
        function onRequest(context) {
            let vendor = context.request.parameters.custom_id; // vendor ID from URL parameter
            let inboundShipmentId = context.request.parameters.inbound_shipment_id;
            log.debug('inboundShipmentId ', inboundShipmentId);
            log.debug('vendor ', vendor);

            // Handle GET request (displaying the form)
            if (context.request.method === 'GET') {
                log.debug('--start--', vendor);

                // Create form for ordering items
                let form = serverWidget.createForm({
                    title: 'Add Items To Order'
                });
                let existingItems = [];

                let inboundshipmentSearchObj = search.create({
                    type: "inboundshipment",
                    filters: [
                        ["internalid", "anyof", inboundShipmentId]
                    ],
                    columns: [
                        "item"
                    ]
                });


                inboundshipmentSearchObj.run().each(function (result) {
                    let itemId = result.getValue({ name: 'item' });
                    existingItems.push(itemId);
                    return true; // Continue iterating
                });

                log.debug("Inbound Shipment Items", existingItems);

                // Build sublists in the form
                makeFirstSublist(form, vendor, inboundShipmentId, existingItems);
                makeSecondSublist(form);
                // Add submit button and write the form to the response
                form.addSubmitButton();
                context.response.writePage(form);
            }
            // Handle POST request (processing form submission)
            else {
                let getParam = context.request.parameters.custpage_ven;
                let inboundId = context.request.parameters.custpage_inbound_id;

                log.audit('getParam', getParam)
                log.audit('inboundId', inboundId)
                let custArray = [];

                // Retrieve number of lines from first sublist
                let lineCount = context.request.getLineCount({ group: 'sublist' });
                log.audit('requestCount', lineCount);

                // Loop through first sublist lines
                for (let x = 0; x < lineCount; x++) {
                    let selected = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_selected',
                        line: x
                    });
                    log.audit('selected', selected);

                    // If the line is selected, gather necessary fields
                    if (selected === 'T') {
                        let returnObj = {
                            recId: context.request.getSublistValue({ group: 'sublist', name: 'custpage_child', line: x }),
                            vendorId: context.request.getSublistValue({ group: 'sublist', name: 'custpage_parent_id', line: x }),
                            itemId: context.request.getSublistValue({ group: 'sublist', name: 'custpage_item_id', line: x }),
                            itemQty: context.request.getSublistValue({ group: 'sublist', name: 'custpage_qty', line: x }),
                            unique: context.request.getSublistValue({ group: 'sublist', name: 'custpage_unique', line: x }),
                            poid: context.request.getSublistValue({ group: 'sublist', name: 'custpage_po_id', line: x }),
                            addQty: context.request.getSublistValue({ group: 'sublist', name: 'custpage_additional', line: x })
                        };
                        custArray.push(returnObj);
                    }
                }
                log.audit('custArray', custArray);

                if (custArray.length > 0) {
                    var returnPO = createConsolidatePO(custArray, inboundId);
                    log.audit('returnPO', returnPO);

                    redirect.toRecord({
                        type: 'inboundShipment',
                        id: inboundId
                    });

                }

                let manualItems = [];
                let manualLineCount = context.request.getLineCount({ group: 'custpage_manual_sublist' });

                for (let i = 0; i < manualLineCount; i++) {
                    let itemId = context.request.getSublistValue({
                        group: 'custpage_manual_sublist',
                        name: 'custpage_manual_item',
                        line: i
                    });
                    let qty = context.request.getSublistValue({
                        group: 'custpage_manual_sublist',
                        name: 'custpage_manual_qty',
                        line: i
                    });

                    if (itemId && qty) {
                        manualItems.push({
                            itemId: itemId,
                            itemQty: qty
                        });
                    }
                }
                log.audit('custArray',custArray)
                log.audit('Manual Items', manualItems);

                if (manualItems.length > 0) {
                
               

                    var inboundMade = returnPO || false;
                  var inboundMade = inboundId
                  log.debug('inboundMade', inboundMade)
                   var returnROPPO = createReOrderPO2(manualItems, getParam);
                    log.debug('returnROPPO', returnROPPO)
                     var returnInbound = addReorderPointInbound(inboundMade, returnROPPO);
                     log.debug('returnInbound', returnInbound)
                     returnPO = returnInbound

                    //createDataRecords2(manualItems, returnROPPO, getParam);
                    createDataRecords2(manualItems, returnROPPO, getParam, inboundMade);

                   //   var returnInbound = addReorderPointInbound(inboundMade, returnROPPO);
                    log.debug('returnInbound', returnInbound)
                    returnPO = returnInbound
               }
                context.response.write(`
                    <html>
                        <body>
                            <script>
                                alert("Manual items successfully added to purchase order and inbound shipment. Please refresh the inbound shipment to reflect changes.");
                                window.location.href = '${url.resolveScript({
                                    scriptId: runtime.getCurrentScript().id,
                                    deploymentId: runtime.getCurrentScript().deploymentId,
                                    params: {
                                        custom_id: getParam,
                                        inbound_shipment_id: inboundMade
                                    }
                                })}';
                            </script>
                        </body>
                    </html>
                `);
                return;
                



            }
        }

        const createDataRecords2 = (custArray, returnROPPO, vendor, inboundShipmentId) => {
            if (custArray && returnROPPO && inboundShipmentId) {
                // Run a search to get lineuniquekeys and rates for this PO
                const lineKeyMap = {};
                const poLineSearch = search.create({
                    type: 'purchaseorder',
                    filters: [
                        ['internalid', 'anyof', returnROPPO],
                        'AND', ['mainline', 'is', 'F'],
                        'AND', ['taxline', 'is', 'F'],
                        'AND', ['shipping', 'is', 'F']
                    ],
                    columns: ['item', 'quantity', 'lineuniquekey', 'rate']
                });
        
                poLineSearch.run().each(result => {
                    const itemId = result.getValue({ name: 'item' });
                    const qty = result.getValue({ name: 'quantity' });
                    const key = result.getValue({ name: 'lineuniquekey' });
                    const rate = result.getValue({ name: 'rate' });
        
                    // Use `${itemId}_${qty}` as the composite key
                    lineKeyMap[`${itemId}_${qty}`] = { key, rate };
                    return true;
                });
        
                custArray.forEach(obj => {
                    const keyLookup = `${obj.itemId}_${obj.itemQty}`;
                    const lineKeyEntry = lineKeyMap[keyLookup] || {};
                    const lineKey = lineKeyEntry.key || null;
                    const rate = lineKeyEntry.rate || null;
        
                    const specialReq = record.create({ type: 'customrecord_consolidated_special_order' });
                    specialReq.setValue('custrecord_special_consolidated_po', returnROPPO);
                    specialReq.setValue('custrecord_special_consolidated_item', obj.itemId);
                    specialReq.setValue('custrecord_special_consolidated_vendor', vendor);
                    specialReq.setValue('custrecord_special_consolidated_qty', obj.itemQty);
                    specialReq.setValue('custrecord_inbound_shipment', inboundShipmentId);
        
                    if (rate !== null) {
                        specialReq.setValue('custrecord_consol_item_rate', rate);
                    }
        
                    if (lineKey) {
                        specialReq.setValue('custrecord_consolidated_po_unique', lineKey);
                    }
        
                    specialReq.save();
        
                    log.debug('specialReq created with inbound and linekey', {
                        itemId: obj.itemId,
                        lineKey: lineKey,
                        inbound: inboundShipmentId
                    });
                });
            }
        };
        

        // const createDataRecords2 = (custArray, returnROPPO, vendor, inboundShipmentId) => {
        //     if (custArray && returnROPPO && inboundShipmentId) {
        //         // Run a search to get lineuniquekeys for this PO
        //         const lineKeyMap = {};
        //         const poLineSearch = search.create({
        //             type: 'purchaseorder',
        //             filters: [
        //                 ['internalid', 'anyof', returnROPPO],
        //                 'AND', ['mainline', 'is', 'F'],
        //                 'AND', ['taxline', 'is', 'F'],
        //                 'AND', ['shipping', 'is', 'F']
        //             ],
        //             columns: ['item', 'quantity', 'lineuniquekey']
        //         });
        
        //         poLineSearch.run().each(result => {
        //             const itemId = result.getValue({ name: 'item' });
        //             const qty = result.getValue({ name: 'quantity' });
        //             const key = result.getValue({ name: 'lineuniquekey' });
        
        //             // Use `${itemId}_${qty}` as the composite key
        //             lineKeyMap[`${itemId}_${qty}`] = key;
        //             return true;
        //         });
        
        //         custArray.forEach(obj => {
        //             const keyLookup = `${obj.itemId}_${obj.itemQty}`;
        //             const lineKey = lineKeyMap[keyLookup] || null;
        
        //             var specialReq = record.create({ type: 'customrecord_consolidated_special_order' });
        //             specialReq.setValue('custrecord_special_consolidated_po', returnROPPO);
        //             specialReq.setValue('custrecord_special_consolidated_item', obj.itemId);
        //             specialReq.setValue('custrecord_special_consolidated_vendor', vendor);
        //             specialReq.setValue('custrecord_special_consolidated_qty', obj.itemQty);
        //             specialReq.setValue('custrecord_inbound_shipment', inboundShipmentId);
        
        //             if (lineKey) {
        //                 specialReq.setValue('custrecord_consolidated_po_unique', lineKey);
        //             }
        
        //             specialReq.save();
        //             log.debug('specialReq created with inbound and linekey', {
        //                 itemId: obj.itemId,
        //                 lineKey: lineKey,
        //                 inbound: inboundShipmentId
        //             });
        //         });
        //     }
        // };
        
        // const createDataRecords2 = (custArray, returnROPPO, vendor) => {
        //     if (custArray) {
        //         custArray.forEach(obj => {
        //             var specialReq = record.create({ type: 'customrecord_consolidated_special_order' });
        //             specialReq.setValue('custrecord_special_consolidated_po', returnROPPO);
        //             specialReq.setValue('custrecord_special_consolidated_item', obj.itemId);
        //             specialReq.setValue('custrecord_special_consolidated_vendor', vendor);
        //             specialReq.setValue('custrecord_special_consolidated_qty', obj.itemQty);
        //             //specialReq.setValue('custrecord_special_consolidated_so', 214);
        //             // specialReq.setValue('custrecord_consol_item_rate', obj.itemCost);
        //             specialReq.save();
        //             log.debug('specialReq', specialReq)
        //         });
        //     }
        // };

        const createReOrderPO2 = (ropArr, vendor) => {
            try {
                var purchOrd = record.create({ type: 'purchaseorder', isDynamic: true });
                purchOrd.setValue('entity', vendor);
                purchOrd.setValue('location', '8');
                // purchOrd.setValue('location', 1);
                purchOrd.setValue('supervisorapproval', true);
                ropArr.forEach(obj => {
                    purchOrd.selectNewLine('item');
                    purchOrd.setCurrentSublistValue('item', 'item', obj.itemId);
                    purchOrd.setCurrentSublistValue('item', 'quantity', obj.itemQty);
                    purchOrd.setCurrentSublistValue('item', 'location', '8');



                     var uom = purchOrd.getCurrentSublistValue({sublistId: 'item',fieldId: 'units'});
                    var uomText = purchOrd.getCurrentSublistValue({sublistId: 'item',fieldId: 'units_display'});
                    log.audit('uom',uom)
                    log.audit('uomText',uomText)
                    if(Number(uom)==null || Number(uom)==1 || Number(uom)==''){
                        log.audit('WE SHOULD BE GOOD',uom)
                    }
                    else{
                        purchOrd.setCurrentSublistValue({sublistId: 'item',fieldId: 'units',value:null});
                        log.audit('Changing to One',uom)
                    }

                  
                    purchOrd.commitLine('item');
                });

                return purchOrd.save({ ignoreMandatoryFields: true });
            } catch (e) {
                log.error('createReOrderPO', e);
            }
        };

        const makeSecondSublist = (form) => {
            const sublist = form.addSublist({
                id: 'custpage_manual_sublist',
                type: serverWidget.SublistType.INLINEEDITOR,
                label: 'Manually Add Items to PO'
            });

            sublist.addField({
                id: 'custpage_manual_item',
                label: 'Item',
                type: serverWidget.FieldType.SELECT,
                source: 'item'
            }).isMandatory = true;

            sublist.addField({
                id: 'custpage_manual_qty',
                label: 'Quantity',
                type: serverWidget.FieldType.INTEGER
            }).isMandatory = true;
        };



        // Create custom records for consolidated special orders
        const createDataRecords = (custArray, returnROPPO, returnInbound) => {
            if (custArray) {
                custArray.forEach(obj => {
                    var specialReq = record.create({ type: 'customrecord_consolidated_special_order' });
                    specialReq.setValue('custrecord_special_consolidated_po', returnROPPO);
                    specialReq.setValue('custrecord_special_consolidated_item', obj.itemId);
                    specialReq.setValue('custrecord_special_consolidated_vendor', obj.venId);
                    specialReq.setValue('custrecord_special_consolidated_qty', obj.itemQty);
                    // specialReq.setValue('custrecord_inbound_shipment', returnInbound);
                    specialReq.setValue('custrecord_consol_item_rate', obj.itemCost);
                    specialReq.save();
                    log.debug('specialReq', specialReq)
                });
            }
        };

        // Add inbound shipment lines from a reorder point
const addReorderPointInbound = (inboundMade, returnROPPO) => {
    log.debug('addReorderPointInbound', inboundMade);
    var returnData = getInboundFeedData(returnROPPO);
    log.debug('returnData', returnData);

    if (returnData && returnData.length > 0) {
        var inboundShipment = inboundMade
            ? record.load({ type: record.Type.INBOUND_SHIPMENT, id: inboundMade, isDynamic: true })
            : record.create({ type: record.Type.INBOUND_SHIPMENT, isDynamic: true });

        if (!inboundMade) {
            var inboundName = Number(getDocumentName()[0]) + 1;
            inboundShipment.setValue('externaldocumentnumber', inboundName);
        }

        returnData.forEach(data => {
            inboundShipment.selectNewLine({ sublistId: 'items' });
            inboundShipment.setCurrentSublistValue('items', 'purchaseorder', data.poid);
            inboundShipment.setCurrentSublistValue('items', 'shipmentitem', data.unique);
            inboundShipment.commitLine({ sublistId: 'items' });
        });

        return inboundShipment.save();
    } else {
        log.debug('addReorderPointInbound', 'No inbound data returned or empty.');
    }
};

        // Retrieve inbound feed data
        const getInboundFeedData = (returnROPPO) => {
            if(returnROPPO){
                var purchaseorderSearchObj = search.create({
                    type: "purchaseorder",
                    filters: [
                        ["type", "anyof", "PurchOrd"],
                        "AND", ["cogs", "is", "F"],
                        "AND", ["taxline", "is", "F"],
                        "AND", ["mainline", "is", "F"],
                        "AND", ["shipping", "is", "F"],
                        "AND", ["internalid", "anyof", returnROPPO]
                    ],
                    columns: ["tranid", "lineuniquekey", "internalid"]
                });

                var returnArr = [];
                purchaseorderSearchObj.run().each(result => {
                    returnArr.push({
                        unique: result.getValue('lineuniquekey'),
                        poid: result.getValue('internalid')
                    });
                    return true;
                });

                return returnArr;
            }

        };

        // Create a new Purchase Order for reorder points
        const createReOrderPO = (ropArr) => {
            try {
                var purchOrd = record.create({ type: 'purchaseorder', isDynamic: true });
                purchOrd.setValue('entity', ropArr[0].venId);

                purchOrd.setValue('location', 6);
                ropArr.forEach(obj => {
                    purchOrd.selectNewLine('item');
                    purchOrd.setCurrentSublistValue('item', 'item', obj.itemId);
                    purchOrd.setCurrentSublistValue('item', 'quantity', obj.itemQty);
                    purchOrd.commitLine('item');
                });

                return purchOrd.save();
            } catch (e) {
                log.error('createReOrderPO', e);
            }
        };
        const makeFirstSublist = (form, vendor, inboundShipmentId, existingItems) => {

            // Add a field for Vendor ID
            const vendorField = form.addField({
                id: 'custpage_ven',
                label: 'Vendor ID',
                type: serverWidget.FieldType.TEXT,
            });
            vendorField.defaultValue = vendor;
            vendorField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
            const inboundShipmentID = form.addField({
                id: 'custpage_inbound_id',
                label: 'Inbound shipment ID',
                type: serverWidget.FieldType.TEXT,
            });
            inboundShipmentID.defaultValue = inboundShipmentId
            inboundShipmentID.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });


            var venRec = record.load({ type: 'vendor', id: vendor })
            var vendorText = venRec.getValue({ fieldId: 'entityid' })
            const vendorName = form.addField({
                id: 'custpage_ventext',
                label: 'Vendor Name',
                type: serverWidget.FieldType.TEXT,
            })
            vendorName.defaultValue = vendorText;
            vendorName.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });

            // Create the sublist for special order requests
            const sublist = form.addSublist({
                id: 'sublist',
                type: serverWidget.SublistType.LIST,
                label: 'Special Order Requests'
            });

            sublist.addField({ id: 'custpage_selected', label: 'Select', type: serverWidget.FieldType.CHECKBOX })

            sublist.addMarkAllButtons(); // Add "Mark All" buttons

            // Add sublist fields
            const fields = [
                { id: 'custpage_item', label: 'Item', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_image', label: 'Image', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_qty', label: 'Qty', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_cust', label: 'Customer', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_cost', label: 'Cost', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_so', label: 'Sales Order', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_salesrep', label: 'Sales Rep', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_parent', label: 'Vendor', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_on', label: 'On Hand', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_avail', label: 'Available', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_po_date', label: 'SO Date', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_deposit_taken', label: 'Deposit Taken', type: serverWidget.FieldType.TEXT },
                //   { id: 'custpage_additional', label: 'Additional Qty to Add', type: serverWidget.FieldType.TEXT, displayType: 'ENTRY' }
            ];

            // Loop through and add each field to the sublist
            fields.forEach(field => sublist.addField({
                id: field.id,
                label: field.label,
                type: field.type,
                // source: field.source,
            }));

            // Add hidden fields
            const hiddenFields = [
                { id: 'custpage_parent_id', label: 'Vendor ID' },
                { id: 'custpage_item_id', label: 'Item ID' },
                { id: 'custpage_unique', label: 'Unique ID' },
                { id: 'custpage_po_id', label: 'PO ID' },
                { id: 'custpage_child', label: 'Child ID' },
                { id: 'custpage_inbound_id', label: 'Inbound shipment ID' },
            ];



            // Loop through and add each hidden field to the sublist
            hiddenFields.forEach(field => {
                const hiddenField = sublist.addField({
                    id: field.id,
                    label: field.label,
                    type: serverWidget.FieldType.TEXT
                });
                hiddenField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
            });

            // Set sublist data with helper function
            setFirstSublist(sublist, vendor, existingItems);
        };


        const setFirstSublist = (sublist, vendor, existingItems) => {
            let ctr = 0;
            let blank = ' ';
            log.debug('vendor and sublist', `${vendor} and ${sublist}`);

            const customRecordSearch = search.create({
                type: "customrecord_consolidated_special_order",
                filters: [
                    ["custrecord_special_consolidated_linked", "is", "F"],
                    "AND",
                    ["custrecord_special_consolidated_vendor", "anyof", vendor],
                    "AND",
                    ["custrecord_special_consolidated_so.mainline", "is", "T"],
                    "AND",
                    ["isinactive", "is", "F"],
                    "AND",
                    ["custrecord_special_consolidated_po", "noneof", "@NONE@"],
                    "AND",
                    ["custrecord_special_consolidated_item.othervendor", "anyof", vendor],
                    // "AND",
                    // ["custrecord_special_consolidated_item.internalid","noneof",existingItems]
                ],
                columns: [
                    search.createColumn({ name: "id", sort: search.Sort.ASC }),
                    "custrecord_special_consolidated_item",
                    "custrecord_special_consolidated_room",
                    "custrecord_special_consolidated_po",
                    "custrecord_special_consolidated_so",
                    "custrecord_special_consolidated_key",
                    // search.createColumn({
                    //     name: "formulatext",
                    //     formula: "CASE WHEN {othervendor}={vendor} THEN {vendor} ELSE NULL END",
                    //     label: "Formula (Text)"
                    // }),
                    search.createColumn({ name: "vendorcostentered", join: "CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM" }),
                    search.createColumn({ name: "custitem_la_image", join: "CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM" }),
                    "custrecord_special_consolidated_qty",
                    "custrecord_special_consolidated_vendor",
                    search.createColumn({ name: "entity", join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO" }),
                    "custrecord_consolidated_po_unique",
                    search.createColumn({
                        name: "salesrep",
                        join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO"
                    }),
                    'custrecord_consol_item_rate',
                    search.createColumn({
                        name: "trandate",
                        join: "CUSTRECORD_SPECIAL_CONSOLIDATED_PO"
                    }),
                    'custrecord_mli_consol_deposit'
                ]
            });

            const searchResultCount = customRecordSearch.runPaged().count;
            log.debug("Result count", searchResultCount);
            log.debug("Result customRecordSearch", customRecordSearch);

            customRecordSearch.run().each(result => {
                const item = result.getText({ name: 'custrecord_special_consolidated_item' });
                const itemId = result.getValue({ name: 'custrecord_special_consolidated_item' });
                //const returnField = getItemFields(itemId);
                const returnField = { min: 0, max: 0, avail: 0, on: 0 }
                const id = result.getValue({ name: 'id' });
                const room = result.getValue({ name: 'custrecord_special_consolidated_room' });
                const po = result.getText({ name: 'custrecord_special_consolidated_po' });
                const poid = result.getValue({ name: 'custrecord_special_consolidated_po' });
                const so = result.getText({ name: 'custrecord_special_consolidated_so' });
                const soId = result.getValue({ name: 'custrecord_special_consolidated_so' });

                const key = result.getValue({ name: 'custrecord_special_consolidated_key' });
                const qty = result.getValue({ name: 'custrecord_special_consolidated_qty' });
                const vendorText = result.getText({ name: 'custrecord_special_consolidated_vendor' });
                const venId = result.getValue({ name: 'custrecord_special_consolidated_vendor' });
                const customer = result.getText({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO', name: 'entity' });
                const venPrice = result.getValue({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM', name: 'vendorcostentered' });
                var tag = result.getValue({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM', name: 'custitem_la_image' });
                if (!tag) {
                    tag = 'https://7513000-sb1.app.netsuite.com/core/media/media.nl?id=874485&c=7513000_SB1&h=RmCKfWi0TZ5Q70Qwta-gHoK0Ad4t5hXferLzwlymxH_rkto7'
                    // tag = 'https://7513000.app.netsuite.com/core/media/media.nl?id=2460&c=7513000&h=TpDmhUs5PXkSV313hioo0g6WHy7yzRpZ-z8hTt8zeczeP9mJ'
                }

                const image = `<img src="${tag}" style="max-width:100px; display: block; margin: auto;">`
                const unique = result.getValue({ name: 'custrecord_consolidated_po_unique' });
                const salesRep = result.getText({
                    name: "salesrep",
                    join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO"
                });
                const cost = result.getValue('custrecord_consol_item_rate');
                const poDate = result.getValue({ name: "trandate", join: "CUSTRECORD_SPECIAL_CONSOLIDATED_PO" });

                const deposit = result.getValue({ name: 'custrecord_mli_consol_deposit' });
                log.debug("item ID", itemId)


                const returnObj = {
                    item,
                    itemId,
                    id,
                    room,
                    po,
                    poid,
                    so,
                    soId,
                    key,
                    qty,
                    vendor: vendorText,
                    customer,
                    venPrice,
                    venId,
                    unique,
                    image,
                    min: returnField.min,
                    max: returnField.max,
                    avail: returnField.avail,
                    on: returnField.on,
                    salesRep,
                    cost,
                    poDate,
                    deposit

                };

                let itemUrl = url.resolveRecord({
                    recordType: 'inventoryitem',
                    recordId: returnObj.itemId
                });
                let itemValue = '<a href="' + itemUrl + '" target="_blank">' + returnObj.item + '</a>'

                // Generate Sales Order URL
                let salesOrderUrl = url.resolveRecord({
                    recordType: record.Type.SALES_ORDER,
                    recordId: returnObj.soId
                });
                let soValue = '<a href="' + salesOrderUrl + '" target="_blank">' + returnObj.so + '</a>'

                const fieldMap = [
                    { id: 'custpage_item', value: itemValue },
                    { id: 'custpage_image', value: returnObj.image },
                    { id: 'custpage_po_id', value: returnObj.poid },
                    { id: 'custpage_unique', value: returnObj.unique },
                    { id: 'custpage_item_id', value: returnObj.itemId },
                    { id: 'custpage_qty', value: returnObj.qty },
                    { id: 'custpage_child', value: returnObj.id },
                    { id: 'custpage_parent', value: returnObj.vendor },
                    { id: 'custpage_parent_id', value: returnObj.vendor },
                    { id: 'custpage_cust', value: returnObj.customer },
                    { id: 'custpage_so', value: soValue },
                    { id: 'custpage_avail', value: returnField.avail },
                    { id: 'custpage_on', value: returnField.on },
                    { id: 'custpage_salesrep', value: returnObj.salesRep },
                    { id: 'custpage_cost', value: returnObj.cost },
                    { id: 'custpage_po_date', value: returnObj.poDate },
                    { id: 'custpage_deposit_taken', value: returnObj.deposit },
                ];

                fieldMap.forEach(field => {
                    try {
                        sublist.setSublistValue({
                            id: field.id,
                            line: ctr,
                            value: field.value || blank
                        });
                    } catch (err) {
                        log.debug(`Error setting value for ${field.id}`, err);
                        sublist.setSublistValue({
                            id: field.id,
                            line: ctr,
                            value: blank
                        });
                    }
                });

                log.debug('End of loop iteration', ctr);
                ctr++;

                return true; // Continue iteration
            });
        };


        const markChildLinked = (arr, inb) => {
            arr.forEach(item => {
           var recId = item.recId; // whatever your record id var is
    var inb   = inb;       // your inbound shipment value

    // 1) Load the record
    var consRec = record.load({
      type: 'customrecord_consolidated_special_order',
      id:   recId,
      isDynamic: false     // static mode is fine if you’re just setting fields
    });

    // 2) Set your fields
    consRec.setValue({
      fieldId: 'custrecord_inbound_shipment',
      value:   inb
    });
    consRec.setValue({
      fieldId: 'custrecord_special_consolidated_linked',
      value:   true
    });

    // 3) Save it (triggers all UE/BE scripts as usual)
    consRec.save({
      enableSourcing:        false,
      ignoreMandatoryFields: true
    });
            });
        };

        const getDocumentName = () => {
            let finalID = '';
            const inboundShipmentSearch = search.create({
                type: "inboundshipment",
                filters: [["externaldocumentnumber", "noneof", "EGLOMKTW24", "NaN", "PS23AIRE", "PS23METRO", "QUORUMS24"]],
                columns: [search.createColumn({ name: "externaldocumentnumber", summary: "MAX" })]
            });
            inboundShipmentSearch.run().each(result => {
                finalID = result.getValue({ name: 'externaldocumentnumber', summary: 'MAX' });
                return true; // Assuming you only need the max value
            });
            return finalID;
        };

        const createConsolidatePO = (custArray, inboundId) => {
            if (!custArray || custArray.length === 0) return null;
            log.audit("custArray", custArray)
            log.audit("inboundId", inboundId)
            try {
                const inboundShipment = record.load({ type: record.Type.INBOUND_SHIPMENT, id: inboundId, isDynamic: true });
                // const inboundShipment = record.load({ type: record.Type.INBOUND_SHIPMENT, id:inboundId });
                log.audit("inboundShipment", inboundShipment)
                // inboundShipment.setValue({ fieldId: 'shipmentstatus', value: 'inTransit' });

                //  const returnName = getDocumentName();
                //  log.debug('returnName', returnName)
                //  const inboundName = Number(returnName) + 1;
                //  const noDec = inboundName.toFixed(0);

                //  inboundShipment.setValue({ fieldId: 'externaldocumentnumber', value: noDec });


                custArray.forEach(cust => {
                    log.audit("cust.unique", cust.unique)
                    log.audit("cust.poid", cust.poid)
                    try {
                        inboundShipment.selectNewLine({ sublistId: 'items' });
                        inboundShipment.setCurrentSublistValue({ sublistId: 'items', fieldId: 'purchaseorder', value: cust.poid });
                        inboundShipment.setCurrentSublistValue({ sublistId: 'items', fieldId: 'shipmentitem', value: cust.unique });
                        inboundShipment.commitLine({ sublistId: 'items' });
                    } catch (e) {
                        log.error('Error processing item', e.message);
                    }
                });

                var rec = inboundShipment.save();
                log.audit('rec', rec)

                custArray.forEach(cust => {
                    log.audit("cust.recId", cust.recId)
                    try {




                          var consRec = record.load({
      type: 'customrecord_consolidated_special_order',
      id:   recId,
      isDynamic: false     // static mode is fine if you’re just setting fields
    });

    // 2) Set your fields
    consRec.setValue({
      fieldId: 'custrecord_inbound_shipment',
      value:   rec
    });
    consRec.setValue({
      fieldId: 'custrecord_special_consolidated_linked',
      value:   true
    });

    // 3) Save it (triggers all UE/BE scripts as usual)
    consRec.save({
      enableSourcing:        false,
      ignoreMandatoryFields: true
    });



                      
                        // record.submitFields({
                        //     type: 'customrecord_consolidated_special_order',
                        //     id: cust.recId,
                        //     values: {
                        //         'custrecord_inbound_shipment': rec,
                        //         'custrecord_special_consolidated_linked': true
                        //     }
                        // });
                    } catch (e) {
                        log.error('Error processing item', e.message);
                    }
                });

            } catch (e) {
                log.error('e', e)
            }


        };

        return {
            onRequest: onRequest
        };
    });
