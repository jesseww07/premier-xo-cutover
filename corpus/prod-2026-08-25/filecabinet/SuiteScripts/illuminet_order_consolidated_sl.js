/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect'],
    function (log, serverWidget, record, search, url, redirect) {

        const cleanVal = (val) => {
            if (val === null || val === undefined) return '';
            var str = String(val);
            if (str.indexOf('ScriptNullObjectAdapter') > -1) return '';
            return str;
        };

        function onRequest(context) {
            var vendor = context.request.parameters.custom_id;
            
            if (context.request.method === 'GET') {
                if (!vendor) {
                    context.response.write('<h1>Error</h1><p>A Vendor ID must be provided.</p>');
                    return;
                }
                var form2 = serverWidget.createForm({ title: 'Order Items' });
                form2.clientScriptModulePath = "SuiteScripts/illuminet_current_order_amt.js";
                
                makeFirstSublist(form2, vendor);
                makeSecondSublist(form2, vendor);
                makeThirdSublist(form2);
                
                form2.addSubmitButton();
                context.response.writePage(form2);
            } else {
                var getParam = context.request.parameters.custpage_ven;
                var custArray = [];
                var custArrayThree = [];
                var sendRedirect = false;
                var returnPO;
                var requestCount = context.request.getLineCount({ group: 'sublist' });
                
                for (var x = 0; x < requestCount; x++) {
                    var selected = context.request.getSublistValue({ group: 'sublist', name: 'custpage_selected', line: x });
                    if (selected === 'T') {
                        var returnObj = {
                            recId:    context.request.getSublistValue({ group: 'sublist', name: 'custpage_child',       line: x }),
                            vendorId: context.request.getSublistValue({ group: 'sublist', name: 'custpage_parent_id',  line: x }),
                            itemId:   context.request.getSublistValue({ group: 'sublist', name: 'custpage_item_id',    line: x }),
                            itemQty:  context.request.getSublistValue({ group: 'sublist', name: 'custpage_qty',        line: x }),
                            unique:   context.request.getSublistValue({ group: 'sublist', name: 'custpage_unique',     line: x }),
                            poid:     context.request.getSublistValue({ group: 'sublist', name: 'custpage_po_id',      line: x }),
                            addQty:   context.request.getSublistValue({ group: 'sublist', name: 'custpage_additional', line: x }),
                            cust:     context.request.getSublistValue({ group: 'sublist', name: 'custpage_cust',       line: x })
                        };
                        custArray.push(returnObj);
                    }
                }
                
                if (custArray.length > 0) {
                    returnPO = createConsolidatePO(custArray, getParam);
                    if (returnPO) { sendRedirect = true; }
                    markChildLinked(custArray, returnPO);
                    const vendorId = getId(returnPO);
                    var useId = vendorId[0];
                    var inbounder = record.load({ type: 'inboundshipment', id: returnPO });
                    inbounder.setValue({ fieldId: 'custrecord_zas_inbound_vendor', value: useId });
                    inbounder.save();
                    
                    var extraArr = custArray.filter(obj => Number(obj.addQty) > 0).map(obj => ({
                        venId:   obj.vendorId,
                        itemId:  obj.itemId,
                        itemQty: obj.addQty
                    }));
                    if (extraArr.length > 0) {
                        var returnROPPO   = createReOrderPO(extraArr);
                        var returnInbound = addReorderPointInbound(returnPO, returnROPPO);
                        createDataRecords(extraArr, returnROPPO, returnInbound);
                    }
                }
                
                var requestCountThree = context.request.getLineCount({ group: 'sublistthree' });
                if (requestCountThree < 0) requestCountThree = 0;
                for (var i = 0; i < requestCountThree; i++) {
                    var item = context.request.getSublistValue({ group: 'sublistthree', name: 'custpage_item', line: i });
                    if (item || item != null) {
                        var returnObjThree = {
                            itemId:  context.request.getSublistValue({ group: 'sublistthree', name: 'custpage_item',     line: i }),
                            itemQty: context.request.getSublistValue({ group: 'sublistthree', name: 'custpage_quantity', line: i }),
                        };
                        custArrayThree.push(returnObjThree);
                    }
                }
                
                if (custArrayThree.length > 0) {
                    var returnROPPO2 = createReOrderPO2(custArrayThree, getParam);
                    createDataRecords2(custArrayThree, returnROPPO2, getParam);
                }
                
                triggerEditOfParent(getParam);
                if (sendRedirect) {
                    redirect.redirect({
                        url: `/app/accounting/transactions/shipping/inboundshipment/inboundshipment.nl?id=${returnPO}`
                    });
                } else {
                    redirect.redirect({
                        url: '/app/common/search/searchresults.nl?searchid=2318'
                    });
                }
            }
        }

        const triggerEditOfParent = (getParam) => {
            var returnId;
            var searchObj = search.create({
                type: "customrecord_consolidated_vendor_select",
                filters: [["custrecord_vendor_select_vendor", "anyof", getParam]],
                columns: ["internalid"]
            });
            searchObj.run().each(result => {
                returnId = result.getValue('internalid');
                return true;
            });
            if (returnId) {
                try {
                    var recObj = record.load({ type: 'customrecord_consolidated_vendor_select', id: returnId });
                    var tot    = recObj.getValue('custrecord_unordered_totals');
                    recObj.setValue('custrecord_unordered_totals_stored', tot);
                    recObj.save();
                } catch (e) {
                    log.error('Error on vendor refresh', e);
                }
            }
            return returnId;
        };

        const createDataRecords = (custArray, returnROPPO, returnInbound) => {
            if (custArray) {
                custArray.forEach(obj => {
                    var specialReq = record.create({ type: 'customrecord_consolidated_special_order' });
                    specialReq.setValue('custrecord_special_consolidated_po',     returnROPPO);
                    specialReq.setValue('custrecord_special_consolidated_item',   obj.itemId);
                    specialReq.setValue('custrecord_special_consolidated_vendor', obj.venId);
                    specialReq.setValue('custrecord_special_consolidated_qty',    obj.itemQty);
                    specialReq.setValue('custrecord_consol_item_rate',            obj.itemCost);
                    specialReq.setValue('custrecord_special_consolidated_so',     617375);
                    specialReq.save();
                });
            }
        };

        const createDataRecords2 = (custArray, returnROPPO, vendor) => {
            if (custArray) {
                custArray.forEach(obj => {
                    var specialReq = record.create({ type: 'customrecord_consolidated_special_order' });
                    specialReq.setValue('custrecord_special_consolidated_po',     returnROPPO);
                    specialReq.setValue('custrecord_special_consolidated_item',   obj.itemId);
                    specialReq.setValue('custrecord_special_consolidated_vendor', vendor);
                    specialReq.setValue('custrecord_special_consolidated_qty',    obj.itemQty);
                    specialReq.setValue('custrecord_special_consolidated_so',     617375);
                    specialReq.save();
                });
            }
        };

        const addReorderPointInbound = (inboundMade, returnROPPO) => {
            var returnData = getInboundFeedData(returnROPPO);
            if (returnData.length > 0) {
                var inboundShipment = inboundMade
                    ? record.load({ type: record.Type.INBOUND_SHIPMENT, id: inboundMade, isDynamic: true })
                    : record.create({ type: record.Type.INBOUND_SHIPMENT, isDynamic: true });
                if (!inboundMade) {
                    var inboundName = Number(getDocumentName()[0]) + 1;
                    inboundShipment.setValue('externaldocumentnumber', inboundName);
                    inboundShipment.setValue('shipmentstatus', 'inTransit');
                }
                returnData.forEach(data => {
                    inboundShipment.selectNewLine({ sublistId: 'items' });
                    inboundShipment.setCurrentSublistValue('items', 'purchaseorder', data.poid);
                    inboundShipment.setCurrentSublistValue('items', 'shipmentitem',  data.unique);
                    inboundShipment.commitLine({ sublistId: 'items' });
                });
                return inboundShipment.save();
            }
        };

        const getInboundFeedData = (returnROPPO) => {
            var purchaseorderSearchObj = search.create({
                type: "purchaseorder",
                filters: [
                    ["type",       "anyof", "PurchOrd"],
                    "AND", ["cogs",     "is", "F"],
                    "AND", ["taxline",  "is", "F"],
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
                    poid:   result.getValue('internalid')
                });
                return true;
            });
            return returnArr;
        };

        const createReOrderPO2 = (ropArr, vendor) => {
            try {
                var purchOrd = record.create({ type: 'purchaseorder', isDynamic: true });
                purchOrd.setValue('entity',   vendor);
                purchOrd.setValue('location', 8);
                ropArr.forEach(obj => {
                    purchOrd.selectNewLine('item');
                    purchOrd.setCurrentSublistValue('item', 'item',     obj.itemId);
                    purchOrd.setCurrentSublistValue('item', 'quantity', obj.itemQty);
                    purchOrd.setCurrentSublistValue('item', 'location', 8);
                    purchOrd.commitLine('item');
                });
                return purchOrd.save();
            } catch (e) {
                log.error('createReOrderPO2', e);
            }
        };

        const createReOrderPO = (ropArr) => {
            try {
                var purchOrd = record.create({ type: 'purchaseorder', isDynamic: true });
                purchOrd.setValue('entity',   ropArr[0].venId);
                purchOrd.setValue('location', 8);
                ropArr.forEach(obj => {
                    purchOrd.selectNewLine('item');
                    purchOrd.setCurrentSublistValue('item', 'item',     obj.itemId);
                    purchOrd.setCurrentSublistValue('item', 'quantity', obj.itemQty);
                    purchOrd.setCurrentSublistValue('item', 'location', 8);
                    purchOrd.commitLine('item');
                });
                return purchOrd.save();
            } catch (e) {
                log.error('createReOrderPO', e);
            }
        };

        const makeFirstSublist = (form2, vendor) => {
            const vendorField = form2.addField({ id: 'custpage_ven', label: 'Vendor ID', type: serverWidget.FieldType.TEXT });
            vendorField.defaultValue = vendor;
            var vendorText = 'Unknown Vendor';
            try {
                if (vendor) {
                    var venRec = record.load({ type: 'vendor', id: vendor });
                    vendorText = cleanVal(venRec.getValue({ fieldId: 'entityid' })) || 'Unknown Vendor';
                }
            } catch (e) {
                log.error('Vendor Record Error', 'Could not load vendor ID: ' + vendor);
            }
            const vendorName = form2.addField({ id: 'custpage_ventext', label: 'Vendor Name', type: serverWidget.FieldType.TEXT });
            vendorName.defaultValue = vendorText;
            
            var unorderedAmt = getTotals(vendor) || 0;
            const unOrdered = form2.addField({ id: 'custpage_unordered', label: 'Unordered Totals', type: serverWidget.FieldType.TEXT });
            unOrdered.defaultValue = String(unorderedAmt);
            
            form2.addField({ id: 'custpage_total', label: 'Selected Totals', type: serverWidget.FieldType.TEXT });
            const sublist = form2.addSublist({ id: 'sublist', type: serverWidget.SublistType.LIST, label: 'Special Order Requests' });
            sublist.addField({ id: 'custpage_selected', label: 'Select', type: serverWidget.FieldType.CHECKBOX });
            sublist.addMarkAllButtons();
            
            const fields = [
                { id: 'custpage_item',        label: 'Item',                type: serverWidget.FieldType.TEXT },
                { id: 'custpage_image',       label: 'Image',               type: serverWidget.FieldType.TEXT },
                { id: 'custpage_qty',         label: 'Qty',                 type: serverWidget.FieldType.TEXT },
                { id: 'custpage_cust',        label: 'Customer',            type: serverWidget.FieldType.TEXT },
                { id: 'custpage_cost',        label: 'Cost',                type: serverWidget.FieldType.TEXT },
                { id: 'custpage_so',          label: 'Sales Order',         type: serverWidget.FieldType.TEXT },
                { id: 'custpage_salesrep',    label: 'Sales Rep',           type: serverWidget.FieldType.TEXT },
                { id: 'custpage_parent',      label: 'Vendor',              type: serverWidget.FieldType.TEXT },
                { id: 'custpage_on',          label: 'On Hand',             type: serverWidget.FieldType.TEXT },
                { id: 'custpage_avail',       label: 'Available',           type: serverWidget.FieldType.TEXT },
                { id: 'custpage_po_date',     label: 'SO Date',             type: serverWidget.FieldType.TEXT },
                { id: 'custpage_loc',         label: 'Location',            type: serverWidget.FieldType.TEXT },
                { id: 'custpage_prjmgr',      label: 'Project Coordinator', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_class',       label: 'Class',               type: serverWidget.FieldType.TEXT },
                { id: 'custpage_cancelqueue', label: 'Cancel',              type: serverWidget.FieldType.TEXT },
            ];
            fields.forEach(field => sublist.addField({ id: field.id, label: field.label, type: field.type }));
            
            const hiddenFields = [
                { id: 'custpage_parent_id', label: 'Vendor ID' },
                { id: 'custpage_item_id',   label: 'Item ID'   },
                { id: 'custpage_unique',    label: 'Unique ID' },
                { id: 'custpage_po_id',     label: 'PO ID'     },
                { id: 'custpage_child',     label: 'Child ID'  },
            ];
            hiddenFields.forEach(field => sublist.addField({ id: field.id, label: field.label, type: serverWidget.FieldType.TEXT }));
            
            setFirstSublist(sublist, vendor);
        };

        const makeSecondSublist = (form2, vendor) => {
            const sublistTwo = form2.addSublist({ id: 'sublisttwo', type: serverWidget.SublistType.LIST, label: 'Backordered and Reorder Point' });
            let entry = sublistTwo.addField({ id: 'custpage_toorder', label: 'T/O', type: serverWidget.FieldType.FLOAT });
            entry.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
            
            const fields = [
                { id: 'custpage_partnum',   label: 'Part Number', type: serverWidget.FieldType.TEXT },
                { id: 'custpage_rate',      label: 'Item Rate',   type: serverWidget.FieldType.TEXT },
                { id: 'custpage_available', label: 'A/V',         type: serverWidget.FieldType.TEXT },
                { id: 'custpage_stock',     label: 'Stock',       type: serverWidget.FieldType.TEXT },
                { id: 'custpage_onorder',   label: 'O/O',         type: serverWidget.FieldType.TEXT },
                { id: 'custpage_backorder', label: 'B/O',         type: serverWidget.FieldType.TEXT },
            ];
            fields.forEach(field => {
                const newField = sublistTwo.addField({ id: field.id, label: field.label, type: field.type });
                if (field.inline) { newField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE }); }
            });
            
            const hiddenFields = [
                { id: 'custpage_itemid2',   label: 'Item ID'   },
                { id: 'custpage_vendorid2', label: 'Vendor ID' }
            ];
            hiddenFields.forEach(field => {
                const hiddenField = sublistTwo.addField({ id: field.id, label: field.label, type: serverWidget.FieldType.TEXT });
                hiddenField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
            });
            
            setSecondSublist(sublistTwo, vendor);
        };

        const getTotals = (vendor) => {
            var returnVal = 0;
            try {
                var customrecord_consolidated_vendor_selectSearchObj = search.create({
                    type: "customrecord_consolidated_vendor_select",
                    filters: [
                        ["custrecord_vendor_select_vendor", "anyof", vendor],
                        "AND",
                        ["isinactive", "is", "F"]
                    ],
                    columns: ["custrecord_unordered_totals_stored"]
                });
                customrecord_consolidated_vendor_selectSearchObj.run().each(function (result) {
                    var res = cleanVal(result.getValue({ name: 'custrecord_unordered_totals_stored' }));
                    returnVal = res || 0;
                    return true;
                });
            } catch (e) {
                log.error('getTotals error', e);
            }
            return returnVal;
        };

        const makeThirdSublist = (form2) => {
            const sublistThree = form2.addSublist({ id: 'sublistthree', type: serverWidget.SublistType.INLINEEDITOR, label: 'Add Items' });
            sublistThree.addField({ id: 'custpage_item',     label: 'Item',     type: serverWidget.FieldType.SELECT, source: 'item' });
            sublistThree.addField({ id: 'custpage_quantity', label: 'Quantity', type: serverWidget.FieldType.INTEGER });
        };

        const setFirstSublist = (sublist, vendor) => {
            let ctr   = 0;
            let blank = ' ';
            
            let customRecordSearch;
            try {
                customRecordSearch = search.create({
                    type: "customrecord_consolidated_special_order",
                    filters: [
                        ["custrecord_special_consolidated_linked",         "is",    "F"],
                        "AND",
                        ["custrecord_special_consolidated_vendor",         "anyof", vendor],
                        "AND",
                        ["custrecord_special_consolidated_so.mainline",    "is",    "T"],
                        "AND",
                        ["custrecord_special_consolidated_po.mainline",    "is",    "T"],
                        "AND",
                        ["isinactive",                                     "is",    "F"],
                        "AND",
                        ["custrecord_mli_remove_from_queue",               "is",    "F"]
                    ],
                    columns: [
                        search.createColumn({ name: "id", sort: search.Sort.ASC }),
                        "internalid",
                        "custrecord_special_consolidated_item",
                        "custrecord_special_consolidated_room",
                        "custrecord_special_consolidated_po",
                        "custrecord_special_consolidated_so",
                        "custrecord_special_consolidated_key",
                        search.createColumn({ name: "custitem_la_image",            join: "CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM" }),
                        "custrecord_special_consolidated_qty",
                        "custrecord_special_consolidated_vendor",
                        search.createColumn({ name: "entity",                       join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO" }),
                        search.createColumn({ name: "custbody_project_coordinator", join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO" }),
                        "custrecord_consolidated_po_unique",
                        search.createColumn({ name: "salesrep",                     join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO" }),
                        'custrecord_consol_item_rate',
                        search.createColumn({ name: "trandate",                     join: "CUSTRECORD_SPECIAL_CONSOLIDATED_PO" }),
                        search.createColumn({ name: "location",                     join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO" }),
                        search.createColumn({ name: "class",                        join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO" })
                    ]
                });
            } catch (searchCreateErr) {
                log.error('setFirstSublist search.create failed', searchCreateErr);
                return;
            }

            let allRecordResults = [];
            let uniqueItemIds = [];

            customRecordSearch.run().each(result => {
                allRecordResults.push(result);
                let currentItemId = cleanVal(result.getValue({ name: 'custrecord_special_consolidated_item' }));
                if (currentItemId && uniqueItemIds.indexOf(currentItemId) === -1) {
                    uniqueItemIds.push(currentItemId);
                }
                return true;
            });

            let itemFieldsMap = {};
            if (uniqueItemIds.length > 0) {
                for (let i = 0; i < uniqueItemIds.length; i += 500) {
                    let chunk = uniqueItemIds.slice(i, i + 500);
                    let bulkItemSearch = search.create({
                        type: "item",
                        filters: [
                            ["inventorylocation", "anyof", "1"],
                            "AND",
                            ["internalid", "anyof", chunk]
                        ],
                        columns: [
                            "locationreorderpoint",
                            "locationpreferredstocklevel",
                            "locationquantityavailable",
                            "locationquantityonhand"
                        ]
                    });
                    
                    bulkItemSearch.run().each(res => {
                        itemFieldsMap[res.id] = {
                            min:   cleanVal(res.getValue('locationreorderpoint')) || '0',
                            max:   cleanVal(res.getValue('locationpreferredstocklevel')) || '0',
                            avail: cleanVal(res.getValue('locationquantityavailable')) || '0',
                            on:    cleanVal(res.getValue('locationquantityonhand')) || '0'
                        };
                        return true;
                    });
                }
            }

            allRecordResults.forEach(result => {
                try {
                    const item        = cleanVal(result.getText({ name: 'custrecord_special_consolidated_item' }));
                    const itemId      = cleanVal(result.getValue({ name: 'custrecord_special_consolidated_item' }));
                    const returnField = itemFieldsMap[itemId] || { min: '0', max: '0', avail: '0', on: '0' };
                    const id          = cleanVal(result.getValue({ name: 'id' }));
                    const internalId  = cleanVal(result.getValue({ name: 'internalid' }));
                    
                    const po          = cleanVal(result.getText({ name: 'custrecord_special_consolidated_po' }));
                    const poid        = cleanVal(result.getValue({ name: 'custrecord_special_consolidated_po' }));
                    const so          = cleanVal(result.getText({ name: 'custrecord_special_consolidated_so' }));
                    const soId        = cleanVal(result.getValue({ name: 'custrecord_special_consolidated_so' }));
                    
                    const qty         = cleanVal(result.getValue({ name: 'custrecord_special_consolidated_qty' }));
                    const vendorText  = cleanVal(result.getText({ name: 'custrecord_special_consolidated_vendor' }));
                    const venId       = cleanVal(result.getValue({ name: 'custrecord_special_consolidated_vendor' }));
                    const customer    = cleanVal(result.getText({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO', name: 'entity' }));
                    
                    const salesRep    = cleanVal(result.getText({ name: "salesrep", join: "CUSTRECORD_SPECIAL_CONSOLIDATED_SO" }));
                    const cost        = cleanVal(result.getValue('custrecord_consol_item_rate'));
                    const poDate      = cleanVal(result.getValue({ name: "trandate", join: "CUSTRECORD_SPECIAL_CONSOLIDATED_PO" }));
                    const soLocation  = cleanVal(result.getText({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO', name: 'location' }));
                    const prjCoor     = cleanVal(result.getText({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO', name: 'custbody_project_coordinator' }));
                    const ordClass    = cleanVal(result.getText({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO', name: 'class' }));
                    
                    var tag = cleanVal(result.getValue({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM', name: 'custitem_la_image' }));
                    if (!tag) {
                        tag = 'https://7513000.app.netsuite.com/core/media/media.nl?id=874485&c=7513000&h=YOUR_PROD_HASH';
                    }
                    const image  = `<img src="${tag}" style="max-width:100px; display: block; margin: auto;">`;
                    const unique = cleanVal(result.getValue({ name: 'custrecord_consolidated_po_unique' }));
                    
                    if (poid && vendor && internalId) {
                        let suiteletUrl = '';
                        try {
                            suiteletUrl = url.resolveScript({
                                scriptId:     'customscript_pl_killqueue',
                                deploymentId: 'customdeploy1',  // ← verify this in Customization > Scripting > Script Deployments
                                params: {
                                    test: internalId,
                                    vend: vendor
                                }
                            });
                        } catch (urlErr) {
                            log.error('URL Generation Error', `Failed to generate URL for ID ${internalId}: ${urlErr}`);
                        }

                        // target="_self" keeps the cancel inside the current NetSuite session
                        let cancelLink = suiteletUrl ? `<a href="${suiteletUrl}" target="_self">Cancel</a>` : 'N/A';
                        
                        let baseUrl   = 'https://7513000.app.netsuite.com';
                        let itemValue = itemId ? `<a href="${baseUrl}/app/common/item/item.nl?id=${itemId}" target="_blank">${item}</a>` : blank;
                        let soValue   = soId   ? `<a href="${baseUrl}/app/accounting/transactions/salesord.nl?id=${soId}&whence=" target="_blank">${so}</a>` : blank;
                        
                        const fieldMap = [
                            { id: 'custpage_item',        value: itemValue         },
                            { id: 'custpage_image',       value: image             },
                            { id: 'custpage_po_id',       value: poid              },
                            { id: 'custpage_unique',      value: unique            },
                            { id: 'custpage_item_id',     value: itemId            },
                            { id: 'custpage_qty',         value: qty               },
                            { id: 'custpage_child',       value: internalId        },
                            { id: 'custpage_parent',      value: vendorText        },
                            { id: 'custpage_parent_id',   value: venId             },
                            { id: 'custpage_cust',        value: customer          },
                            { id: 'custpage_so',          value: soValue           },
                            { id: 'custpage_avail',       value: returnField.avail },
                            { id: 'custpage_on',          value: returnField.on    },
                            { id: 'custpage_salesrep',    value: salesRep          },
                            { id: 'custpage_cost',        value: cost              },
                            { id: 'custpage_po_date',     value: poDate            },
                            { id: 'custpage_loc',         value: soLocation        },
                            { id: 'custpage_prjmgr',      value: prjCoor           },
                            { id: 'custpage_class',       value: ordClass          },
                            { id: 'custpage_cancelqueue', value: cancelLink        },
                        ];
                        
                        fieldMap.forEach(field => {
                            try {
                                let safeValue = blank;
                                if (field.value !== null && field.value !== undefined && field.value !== '') {
                                    safeValue = String(field.value);
                                }
                                sublist.setSublistValue({ id: field.id, line: ctr, value: safeValue });
                            } catch (err) {
                                sublist.setSublistValue({ id: field.id, line: ctr, value: blank });
                            }
                        });
                        ctr++;
                    }
                } catch (rowErr) {
                    log.error('Row error in setFirstSublist', rowErr);
                }
            });
        };

        const setSecondSublist = (sublistTwo, vendor) => {
            var ctr   = 0;
            var blank = 0;
            var inventoryitemSearchObj = search.create({
                type: "inventoryitem",
                filters: [
                    ["type",                        "anyof",       "InvtPart"],
                    "AND",
                    ["inventorylocation",           "noneof",      "@NONE@","16","2","9","5","15"],
                    "AND",
                    ["vendor",                      "anyof",       vendor],
                    "AND",
                    ["locationquantitybackordered", "greaterthan", "0"],
                    "AND",
                    ["ispreferredvendor",           "is",          "T"]
                ],
                columns: [
                    search.createColumn({ name: "itemid",                      summary: "GROUP" }),
                    search.createColumn({ name: "internalid",                  summary: "GROUP" }),
                    search.createColumn({ name: "locationquantityavailable",   summary: "SUM"   }),
                    search.createColumn({ name: "locationquantityonorder",     summary: "SUM"   }),
                    search.createColumn({ name: "locationquantitybackordered", summary: "SUM"   }),
                    search.createColumn({ name: "locationreorderpoint",        summary: "SUM"   }),
                    search.createColumn({ name: "vendor",                      summary: "GROUP" }),
                    search.createColumn({ name: "locationpreferredstocklevel", summary: "SUM"   }),
                    search.createColumn({ name: "vendorcost",                  summary: "GROUP" })
                ]
            });
            inventoryitemSearchObj.run().each(function (result) {
                var item       = cleanVal(result.getValue({ name: "itemid",                      summary: "GROUP" }));
                var itemId     = cleanVal(result.getValue({ name: "internalid",                  summary: "GROUP" }));
                var locAvail   = cleanVal(result.getValue({ name: "locationquantityavailable",   summary: "SUM"   }));
                var locOnOrder = cleanVal(result.getValue({ name: "locationquantityonorder",     summary: "SUM"   }));
                var locBack    = cleanVal(result.getValue({ name: "locationquantitybackordered", summary: "SUM"   }));
                var vendorId   = cleanVal(result.getValue({ name: "vendor",                      summary: "GROUP" }));
                var locStock   = cleanVal(result.getValue({ name: "locationpreferredstocklevel", summary: "SUM"   }));
                var venCost    = cleanVal(result.getValue({ name: "vendorcost",                  summary: "GROUP" }));
                
                safelySetSublistValue(sublistTwo, 'custpage_partnum',   ctr, item,       blank);
                safelySetSublistValue(sublistTwo, 'custpage_rate',      ctr, venCost,    blank);
                safelySetSublistValue(sublistTwo, 'custpage_available', ctr, locAvail,   blank);
                safelySetSublistValue(sublistTwo, 'custpage_stock',     ctr, locStock,   blank);
                safelySetSublistValue(sublistTwo, 'custpage_onorder',   ctr, locOnOrder, blank);
                safelySetSublistValue(sublistTwo, 'custpage_backorder', ctr, locBack,    blank);
                safelySetSublistValue(sublistTwo, 'custpage_vendorid2', ctr, vendorId,   blank);
                safelySetSublistValue(sublistTwo, 'custpage_itemid2',   ctr, itemId,     blank);
                
                ctr++;
                return true;
            });
        };

        const safelySetSublistValue = (sublist, id, line, value, blank) => {
            try {
                if (value !== null && value !== undefined && value !== '') {
                    sublist.setSublistValue({ id: id, line: line, value: String(value) });
                } else {
                    sublist.setSublistValue({ id: id, line: line, value: String(blank) });
                }
            } catch (e) {
                log.debug('Error setting safely sublist value', e);
            }
        };

        const markChildLinked = (arr, inb) => {
            for (var x = 0; x < arr.length; x++) {
                var recObj = record.load({ type: 'customrecord_consolidated_special_order', id: arr[x].recId });
                recObj.setValue({ fieldId: 'custrecord_inbound_shipment',            value: inb  });
                recObj.setValue({ fieldId: 'custrecord_special_consolidated_linked', value: true });
                recObj.save({
                    enableSourcing:        false,
                    ignoreMandatoryFields: true
                });
            }
        };

        const getDocumentName = () => {
            let finalID = '';
            var customrecord_mli_inbound_redirectorSearchObj = search.create({
                type: "customrecord_mli_inbound_redirector",
                filters: [
                    ["custrecord_pre_standalone_po", "is", "F"]
                ],
                columns: [
                    search.createColumn({ name: "name", summary: "MAX" })
                ]
            });
            customrecord_mli_inbound_redirectorSearchObj.run().each(function (result) {
                finalID = cleanVal(result.getValue({ name: 'name', summary: 'MAX' }));
                return true;
            });
            return finalID;
        };

        const createConsolidatePO = (custArray, getParam) => {
            if (!custArray || custArray.length === 0) return null;
            const inboundShipment = record.create({ type: record.Type.INBOUND_SHIPMENT, isDynamic: true });
            inboundShipment.setValue({ fieldId: 'shipmentstatus', value: 'inTransit' });
            const returnName  = getDocumentName();
            const inboundName = Number(returnName) + 1;
            const noDec       = inboundName.toFixed(0);
            inboundShipment.setValue({ fieldId: 'externaldocumentnumber',      value: noDec     });
            inboundShipment.setValue({ fieldId: 'custrecord_mli_inbound_vendor', value: getParam });
            
            custArray.forEach(cust => {
                try {
                    inboundShipment.selectNewLine({ sublistId: 'items' });
                    inboundShipment.setCurrentSublistValue({ sublistId: 'items', fieldId: 'purchaseorder',            value: cust.poid   });
                    inboundShipment.setCurrentSublistValue({ sublistId: 'items', fieldId: 'shipmentitem',             value: cust.unique });
                    inboundShipment.setCurrentSublistValue({ sublistId: 'items', fieldId: 'custrecord_pr_inbound_so', value: cust.cust   });
                    inboundShipment.commitLine({ sublistId: 'items' });
                } catch (e) {
                    log.error('Error processing item', e);
                }
            });
            
            var rec = inboundShipment.save();
            try {
                var inboundShipmentRecord = record.load({ type: 'inboundshipment', id: rec });
                var redirectRec = record.create({ type: 'customrecord_mli_inbound_redirector' });
                redirectRec.setValue({ fieldId: 'name',                      value: noDec });
                redirectRec.setValue({ fieldId: 'custrecord_mli_redirect_to', value: rec  });
                var redirRecSave = redirectRec.save();
                inboundShipmentRecord.setValue({ fieldId: 'custrecord_mli_redirect_record', value: redirRecSave });
                try {
                    inboundShipmentRecord.save({
                        enableSourcing:        true,
                        ignoreMandatoryFields: true
                    });
                    return rec;
                } catch (e) {
                    return rec;
                }
            } catch (e) {
                return rec;
            }
        };

        const getId = (id) => {
            let array = [];
            var customrecord_consolidated_special_orderSearchObj = search.create({
                type: "customrecord_consolidated_special_order",
                filters: [
                    ["custrecord_inbound_shipment.internalidnumber", "equalto", id]
                ],
                columns: ["custrecord_special_consolidated_vendor"]
            });
            customrecord_consolidated_special_orderSearchObj.run().each(function (result) {
                var vend = cleanVal(result.getValue('custrecord_special_consolidated_vendor'));
                array.push(vend);
                return true;
            });
            return array;
        };

        return {
            onRequest: onRequest
        };
    });