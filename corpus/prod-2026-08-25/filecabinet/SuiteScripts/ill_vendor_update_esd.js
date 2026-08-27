/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search'],
    function (log, serverWidget, record, search) {

        function onRequest(context) {
            if (context.request.method === 'GET') {
                var paramPull = context.request.parameters.custom_id;

                var venRec = record.load({ type: 'vendor', id: paramPull });
                var venName = venRec.getValue({ fieldId: 'companyname' });

                let form = serverWidget.createForm({
                    title: `Update ${venName}'s ESDs`
                });

                var estId = form.addField({
                    id: 'custpage_venid',
                    label: 'Ven ID',
                    type: serverWidget.FieldType.TEXT,
                });
                estId.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                estId.defaultValue = paramPull;

                let sublist = form.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Items Waiting to Arrive'
                });

                sublist.addField({ id: 'custpage_select', label: 'Select', type: serverWidget.FieldType.CHECKBOX });
                sublist.addField({ id: 'custpage_brand', label: 'Vendor', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_doc', label: 'PO#', type: serverWidget.FieldType.TEXT });

                let docid = sublist.addField({ id: 'custpage_docid', label: 'PO ID', type: serverWidget.FieldType.TEXT });
                docid.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                sublist.addField({ id: 'custpage_item', label: 'Item', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_qty', label: 'Quantity', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_qtyreceived', label: 'Quantity Received', type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_qtywaiting', label: 'Quantity Waiting Shipment', type: serverWidget.FieldType.TEXT });

                let esd = sublist.addField({ id: 'custpage_esd', label: 'ESD', type: serverWidget.FieldType.DATE });
                esd.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

                let tracking = sublist.addField({ id: 'custpage_tracking', label: 'Tracking Number', type: serverWidget.FieldType.TEXT });
                tracking.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

                let carrier = sublist.addField({
                    id: 'custpage_carrier',
                    label: 'Ship Carrier',
                    type: serverWidget.FieldType.SELECT,
                    source: 'customlist_zas_tracking_carrier'
                });
                carrier.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

                let keyField = sublist.addField({ id: 'custpage_key', label: 'Line Key', type: serverWidget.FieldType.TEXT });
                keyField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                // ── PHASE 1: Collect all PO line results ──────────────────────────────
                var rawResults = [];
                var lineKeys = [];

                var transactionSearch = search.create({
                    type: 'transaction',
                    filters: [
                        ['mainline', 'is', 'F'], 'AND',
                        ['name', 'anyof', paramPull], 'AND',
                        ['type', 'anyof', 'PurchOrd'], 'AND',
                        ['taxline', 'is', 'F'], 'AND',
                        ['shipping', 'is', 'F'], 'AND',
                        ['formulanumeric: CASE WHEN NVL({quantity},0)>NVL({quantityshiprecv},0) THEN 1 ELSE 0 END', 'greaterthan', '0'], 'AND',
                        ['closed', 'is', 'F']
                    ],
                    columns: ['mainname', 'item', 'tranid', 'quantity', 'quantityshiprecv', 'expectedreceiptdate', 'lineuniquekey', 'internalid']
                });

                transactionSearch.run().each(function (result) {
                    var k = result.getValue('lineuniquekey');
                    if (k) lineKeys.push(k);
                    rawResults.push(result);
                    return true;
                });

                log.debug('Vendor ESD Suitelet', `Collected ${rawResults.length} PO lines, ${lineKeys.length} valid keys`);

                // ── PHASE 2: Batch lookup across all consolidated records ─────────────
                // custrecord_consolidated_po_unique is a free-text field — anyof does not
                // work on text fields. Build an OR-chain filter instead.
                var consolidatedMap = {};
                if (lineKeys.length > 0) {
                    try {
                        var csoFilters = [];
                        lineKeys.forEach(function (k, i) {
                            if (i > 0) csoFilters.push('OR');
                            csoFilters.push(['custrecord_consolidated_po_unique', 'is', k]);
                        });

                        search.create({
                            type: 'customrecord_consolidated_special_order',
                            filters: csoFilters,
                            columns: [
                                'custrecord_consolidated_po_unique',
                                'custrecord_esd',
                                'custrecord_tracking',
                                'custrecord_carrier',
                                'custrecord_special_consolidated_ref'
                            ]
                        }).run().each(function (r) {
                            var k = r.getValue('custrecord_consolidated_po_unique');
                            if (k) {
                                consolidatedMap[k] = {
                                    esd:      r.getValue('custrecord_esd'),
                                    tracking: r.getValue('custrecord_tracking'),
                                    carrier:  r.getValue('custrecord_carrier'),
                                    poRefNum: r.getValue('custrecord_special_consolidated_ref')
                                };
                            }
                            return true;
                        });
                    } catch (e) {
                        log.error('Batch consolidated lookup failed', e);
                    }
                }

                log.debug('Vendor ESD Suitelet', `Consolidated map has ${Object.keys(consolidatedMap).length} entries`);

                // ── PHASE 3: Build sublist rows ───────────────────────────────────────
                var ctr = 0;
                rawResults.forEach(function (result) {
                    try {
                        var lineKey = result.getValue('lineuniquekey');
                        var cd = consolidatedMap[lineKey] || { esd: null, tracking: null, carrier: null, poRefNum: null };

                        var qty     = Number(result.getValue('quantity'))         || 0;
                        var qtyRecv = Number(result.getValue('quantityshiprecv')) || 0;

                        sublist.setSublistValue({ id: 'custpage_docid',      line: ctr, value: result.getValue('internalid') || ' ' });
                        sublist.setSublistValue({ id: 'custpage_brand',      line: ctr, value: result.getText('mainname')    || ' ' });
                        sublist.setSublistValue({ id: 'custpage_item',       line: ctr, value: result.getText('item')        || ' ' });
                        sublist.setSublistValue({ id: 'custpage_qty',        line: ctr, value: String(qty) });
                        sublist.setSublistValue({ id: 'custpage_qtyreceived',line: ctr, value: String(qtyRecv) });
                        sublist.setSublistValue({ id: 'custpage_qtywaiting', line: ctr, value: String(qty - qtyRecv) });
                        sublist.setSublistValue({ id: 'custpage_key',        line: ctr, value: lineKey || ' ' });
                        sublist.setSublistValue({ id: 'custpage_doc',        line: ctr, value: cd.poRefNum || ' ' });

                        if (cd.esd)      sublist.setSublistValue({ id: 'custpage_esd',      line: ctr, value: cd.esd });
                        if (cd.tracking) sublist.setSublistValue({ id: 'custpage_tracking', line: ctr, value: cd.tracking });
                        if (cd.carrier)  sublist.setSublistValue({ id: 'custpage_carrier',  line: ctr, value: cd.carrier });

                        ctr++;
                    } catch (e) {
                        log.error(`Sublist row ${ctr} failed (lineKey: ${result.getValue('lineuniquekey')})`, e);
                        // skip bad row, continue
                    }
                });

                form.addSubmitButton('Save');
                context.response.writePage(form);

            } else {
                // ── POST ──────────────────────────────────────────────────────────────
                var requestCount = context.request.getLineCount({ group: 'sublist' });
                var payload = [];

                for (var x = 0; x < requestCount; x++) {
                    var selected = context.request.getSublistValue({ group: 'sublist', name: 'custpage_select', line: x });
                    if (selected === 'T') {
                        payload.push({
                            key:      context.request.getSublistValue({ group: 'sublist', name: 'custpage_key',      line: x }),
                            esd:      context.request.getSublistValue({ group: 'sublist', name: 'custpage_esd',      line: x }),
                            tracking: context.request.getSublistValue({ group: 'sublist', name: 'custpage_tracking', line: x }),
                            carrier:  context.request.getSublistValue({ group: 'sublist', name: 'custpage_carrier',  line: x }),
                            id:       context.request.getSublistValue({ group: 'sublist', name: 'custpage_docid',    line: x })
                        });
                    }
                }

                if (payload.length > 0) {
                    payload.forEach(function (item) {
                        sendWriteBack(item);
                        setEsdDate(item);
                    });
                    context.response.write('<script>window.close();</script>');
                }
            }
        }

        // ── WRITE BACK: PO line fields ────────────────────────────────────────────
        const sendWriteBack = (payload) => {
            try {
                var po = record.load({ type: 'purchaseorder', id: payload.id, isDynamic: true });
                var lineCount = po.getLineCount({ sublistId: 'item' });

                for (var x = 0; x < lineCount; x++) {
                    if (po.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: x }) == payload.key) {
                        po.selectLine({ sublistId: 'item', line: x });
                        if (payload.esd)      po.setCurrentSublistValue({ sublistId: 'item', fieldId: 'expectedreceiptdate',            value: new Date(payload.esd) });
                        if (payload.carrier)  po.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_pr_vendor_provided_carrier',  value: payload.carrier });
                        if (payload.tracking) po.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_pr_vendor_provided_tracking', value: payload.tracking });
                        po.commitLine({ sublistId: 'item' });
                    }
                }
                po.save();
            } catch (e) {
                log.error('sendWriteBack error', e);
            }
        };

        // ── WRITE BACK: Consolidated special order record + inbound shipment ─────
        const setEsdDate = (payload) => {
            try {
                var results = search.create({
                    type: 'customrecord_consolidated_special_order',
                    filters: [['custrecord_consolidated_po_unique', 'is', payload.key]],
                    columns: ['internalid', 'custrecord_inbound_shipment']
                }).run().getRange({ start: 0, end: 1 });

                if (!results || results.length === 0) return;

                var csoRec = record.load({
                    type: 'customrecord_consolidated_special_order',
                    id: results[0].getValue('internalid')
                });

                if (payload.esd)      csoRec.setValue({ fieldId: 'custrecord_esd',      value: new Date(payload.esd) });
                if (payload.tracking) csoRec.setValue({ fieldId: 'custrecord_tracking', value: payload.tracking });
                if (payload.carrier)  csoRec.setValue({ fieldId: 'custrecord_carrier',  value: payload.carrier });

                var inbound = csoRec.getValue({ fieldId: 'custrecord_inbound_shipment' });
                csoRec.save();

                if (inbound && payload.esd) {
                    writeToInbound(inbound, payload.esd, payload.key);
                }
            } catch (e) {
                log.error('setEsdDate error', e);
            }
        };

        // ── WRITE BACK: Inbound shipment line ESD ────────────────────────────────
        const writeToInbound = (inbound, esd, key) => {
            try {
                var inbRec = record.load({ type: 'inboundshipment', id: inbound, isDynamic: true });
                var lineIndex = inbRec.findSublistLineWithValue({ sublistId: 'items', fieldId: 'shipmentitem', value: key });

                if (lineIndex !== -1) {
                    inbRec.selectLine({ sublistId: 'items', line: lineIndex });
                    inbRec.setCurrentSublistValue({ sublistId: 'items', fieldId: 'custrecord_inbound_esd', value: new Date(esd) });
                    inbRec.commitLine({ sublistId: 'items' });
                    inbRec.save();
                }
            } catch (e) {
                log.error('writeToInbound error', e);
            }
        };

        return { onRequest: onRequest };
    });