/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/file', 'N/render', 'N/task', 'N/runtime', 'N/error', 'SuiteScripts/Third-Party-Applications/custom_library.js'],
    function (log, serverWidget, record, search, url, redirect, file, render, task, runtime, error, module) {

        function onRequest(context) {

            if (context.request.method === 'GET') {
                var paramPull = context.request.parameters.custom_id;

                var inbdRec = record.load({ type: 'inboundshipment', id: paramPull });
                var extDocNo = inbdRec.getValue({ fieldId: 'externaldocumentnumber' });
                log.debug('ext_doc_number', extDocNo);

                let form2 = serverWidget.createForm({
                    title: `Update ESDs for Shipment ${extDocNo}`
                });

                var estId = form2.addField({
                    id: 'custpage_venid',
                    label: 'Ven ID',
                    type: serverWidget.FieldType.TEXT,
                });
                estId.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                estId.defaultValue = paramPull;

                form2.addButton({ id: 'custpage_select_all',  label: 'Select All',   functionName: 'selectAllCheckboxes' });
                form2.addButton({ id: 'custpage_confirm_all', label: 'Confirm All',  functionName: 'confirmAllCheckboxes' });
                form2.clientScriptModulePath = 'SuiteScripts/gl_cl_inbd_esd_helper.js';

                let sublist = form2.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Items Waiting to Arrive'
                });

                sublist.addField({ id: 'custpage_select', label: 'Select', type: serverWidget.FieldType.CHECKBOX });

                let brand = sublist.addField({ id: 'custpage_brand', label: 'Vendor', type: serverWidget.FieldType.TEXT });
                brand.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                sublist.addField({ id: 'custpage_doc',      label: 'PO#',          type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_date_ack', label: 'PO Ack Date',  type: serverWidget.FieldType.TEXT });

                let docid = sublist.addField({ id: 'custpage_docid', label: 'PO ID', type: serverWidget.FieldType.TEXT });
                docid.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                sublist.addField({ id: 'custpage_item',        label: 'Item',                     type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_qty',         label: 'Quantity',                 type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_qtyreceived', label: 'Quantity Received',        type: serverWidget.FieldType.TEXT });
                sublist.addField({ id: 'custpage_qtywaiting',  label: 'Quantity Waiting Shipment',type: serverWidget.FieldType.TEXT });

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

                sublist.addField({ id: 'custpage_order_info', label: 'Order Info', type: serverWidget.FieldType.TEXT });

                let key = sublist.addField({ id: 'custpage_key', label: 'Line Key', type: serverWidget.FieldType.TEXT });
                key.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                // ── PHASE 1: Collect all CSO records linked to this inbound shipment ─
                var csoRows = []; // { poId, lineUniqueKey }

                var csoSearch = search.create({
                    type: 'customrecord_consolidated_special_order',
                    filters: [
                        ['custrecord_inbound_shipment',        'anyof', paramPull], 'AND',
                        ['isinactive',                         'is',    'F'],        'AND',
                        ['custrecord_special_consolidated_linked', 'is', 'T']
                    ],
                    columns: [
                        search.createColumn({ name: 'custrecord_special_consolidated_po',  label: 'Purchase Order' }),
                        search.createColumn({ name: 'custrecord_consolidated_po_unique',   label: 'Unique ID PO' })
                    ]
                });

                var csoCount = csoSearch.runPaged({ pageSize: 1000 }).count;
                log.audit('CSO result count', csoCount);

                csoSearch.run().each(function (r) {
                    var poId       = r.getValue('custrecord_special_consolidated_po');
                    var lineKey    = r.getValue('custrecord_consolidated_po_unique');
                    if (poId && lineKey) {
                        csoRows.push({ poId: poId, lineKey: lineKey });
                    }
                    return true;
                });

                // ── PHASE 2: Collect all PO line transaction data in bulk ─────────
                // Build a map of lineKey → transaction result by running one search
                // per unique PO ID, filtering to just the relevant line keys.
                // Group line keys by PO to minimize search count.
                var poLineMap = {}; // poId → [lineKey, ...]
                csoRows.forEach(function (row) {
                    if (!poLineMap[row.poId]) poLineMap[row.poId] = [];
                    poLineMap[row.poId].push(row.lineKey);
                });

                var allLineKeys = csoRows.map(function (r) { return r.lineKey; });
                var transactionMap = {}; // lineKey → result values object

                var uniquePoIds = Object.keys(poLineMap);
                log.debug('Unique PO IDs to query', uniquePoIds.length);

                // Run one transaction search per PO (already scoped to specific line keys)
                // This replaces the per-row inner transactionSearchObj pattern entirely.
                uniquePoIds.forEach(function (poId) {
                    var keys = poLineMap[poId];
                    try {
                        search.create({
                            type: 'transaction',
                            filters: [
                                ['mainline',      'is',      'F'],           'AND',
                                ['internalid',    'anyof',   poId],          'AND',
                                ['lineuniquekey', 'anyof',   keys],          'AND',
                                ['type',          'anyof',   'PurchOrd'],    'AND',
                                ['taxline',       'is',      'F'],           'AND',
                                ['shipping',      'is',      'F'],           'AND',
                                ['formulanumeric: CASE WHEN NVL({quantity},0)>NVL({quantityshiprecv},0) THEN 1 ELSE 0 END', 'greaterthan', '0'], 'AND',
                                ['closed',        'is',      'F']
                            ],
                            columns: ['mainname', 'item', 'tranid', 'quantity', 'quantityshiprecv', 'lineuniquekey', 'internalid']
                        }).run().each(function (r) {
                            var k = r.getValue('lineuniquekey');
                            if (k) {
                                transactionMap[k] = {
                                    internalid:       r.getValue('internalid'),
                                    mainname:         r.getText('mainname'),
                                    item:             r.getText('item'),
                                    tranid:           r.getValue('tranid'),
                                    quantity:         Number(r.getValue('quantity'))         || 0,
                                    quantityshiprecv: Number(r.getValue('quantityshiprecv')) || 0
                                };
                            }
                            return true;
                        });
                    } catch (e) {
                        log.error(`Transaction search failed for PO ${poId}`, e);
                    }
                });

                log.debug('Transaction map entries', Object.keys(transactionMap).length);

                // ── PHASE 3: Batch lookup - existing ESD/tracking/carrier ────────────
                // OR-chain required — custrecord_consolidated_po_unique is a text field.
                var existingDataMap = {}; // lineKey → { esd, tracking, carrier }
                if (allLineKeys.length > 0) {
                    try {
                var edFilters = [];
allLineKeys.forEach(function (k, i) {
    if (i > 0) edFilters.push('OR');
    edFilters.push(['custrecord_consolidated_po_unique', 'is', k]);
});
// Append the AND conditions after the OR group
edFilters.push('AND', ['isinactive', 'is', 'F']);
edFilters.push('AND', ['custrecord_special_consolidated_linked', 'is', 'T']);

                        search.create({
                            type: 'customrecord_consolidated_special_order',
                            filters: edFilters,
                            columns: [
                                'custrecord_consolidated_po_unique',
                                'custrecord_esd',
                                'custrecord_tracking',
                                'custrecord_carrier'
                            ]
                        }).run().each(function (r) {
                            var k = r.getValue('custrecord_consolidated_po_unique');
                            if (k) {
                                existingDataMap[k] = {
                                    esd:      r.getValue('custrecord_esd'),
                                    tracking: r.getValue('custrecord_tracking'),
                                    carrier:  r.getValue('custrecord_carrier')
                                };
                            }
                            return true;
                        });
                    } catch (e) {
                        log.error('Batch existing data lookup failed', e);
                    }
                }

                log.debug('Existing data map entries', Object.keys(existingDataMap).length);

                // ── PHASE 4: Batch lookup - inbound text (SO, sales rep, ack date, PO ref) ──
                // OR-chain required — custrecord_consolidated_po_unique is a text field.
                var inboundTextMap = {}; // lineKey → { inboundName, poAck, so, salesRep, poNum }
                if (allLineKeys.length > 0) {
                    try {
                        var ibtKeyFilters = [];
                        allLineKeys.forEach(function (k, i) {
                            if (i > 0) ibtKeyFilters.push('OR');
                            ibtKeyFilters.push(['custrecord_consolidated_po_unique', 'is', k]);
                        });
                        var ibtFilters = [
                            '(', ...ibtKeyFilters, ')', 'AND',
                            ['isinactive',                             'is', 'F'], 'AND',
                            ['custrecord_special_consolidated_linked', 'is', 'T']
                        ];

                        search.create({
                            type: 'customrecord_consolidated_special_order',
                            filters: ibtFilters,
                            columns: [
                                'custrecord_consolidated_po_unique',
                                search.createColumn({ name: 'externaldocumentnumber', join: 'CUSTRECORD_INBOUND_SHIPMENT' }),
                                search.createColumn({ name: 'otherrefnum',            join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO' }),
                                search.createColumn({ name: 'custrecord_mli_ack_date',join: 'CUSTRECORD_INBOUND_SHIPMENT' }),
                                search.createColumn({ name: 'tranid',                 join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO' }),
                                search.createColumn({ name: 'salesrep',               join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO' })
                            ]
                        }).run().each(function (r) {
                            var k = r.getValue('custrecord_consolidated_po_unique');
                            if (k) {
                                inboundTextMap[k] = {
                                    inboundName: r.getValue({ name: 'externaldocumentnumber', join: 'CUSTRECORD_INBOUND_SHIPMENT' }),
                                    poAck:       r.getValue({ name: 'custrecord_mli_ack_date', join: 'CUSTRECORD_INBOUND_SHIPMENT' }),
                                    so:          r.getValue({ name: 'tranid',                  join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO' }),
                                    salesRep:    r.getText({  name: 'salesrep',                join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO' }),
                                    poNum:       r.getValue({ name: 'otherrefnum',             join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_SO' })
                                };
                            }
                            return true;
                        });
                    } catch (e) {
                        log.error('Batch inbound text lookup failed', e);
                    }
                }

                log.debug('Inbound text map entries', Object.keys(inboundTextMap).length);

                // ── PHASE 5: Build sublist rows ───────────────────────────────────
                var ctr = 0;
                csoRows.forEach(function (row) {
                    var lineKey = row.lineKey;
                    var tx      = transactionMap[lineKey];

                    // Skip lines that didn't pass the transaction filter
                    // (e.g. fully received lines, count=0 results)
                    if (!tx) return;

                    var ed  = existingDataMap[lineKey]  || { esd: null, tracking: null, carrier: null };
                    var ibt = inboundTextMap[lineKey]   || { inboundName: null, poAck: null, so: null, salesRep: null, poNum: null };

                    var qtyWaiting = tx.quantity - tx.quantityshiprecv;

                    try {
                        sublist.setSublistValue({ id: 'custpage_docid',      line: ctr, value: tx.internalid || ' ' });
                        sublist.setSublistValue({ id: 'custpage_brand',      line: ctr, value: tx.mainname   || ' ' });
                        sublist.setSublistValue({ id: 'custpage_item',       line: ctr, value: tx.item       || ' ' });
                        sublist.setSublistValue({ id: 'custpage_qty',        line: ctr, value: String(tx.quantity) });
                        sublist.setSublistValue({ id: 'custpage_qtyreceived',line: ctr, value: String(tx.quantityshiprecv) });
                        sublist.setSublistValue({ id: 'custpage_qtywaiting', line: ctr, value: String(qtyWaiting) });
                        sublist.setSublistValue({ id: 'custpage_key',        line: ctr, value: lineKey });
                        sublist.setSublistValue({ id: 'custpage_doc',        line: ctr, value: ibt.inboundName || tx.tranid || ' ' });
                        sublist.setSublistValue({ id: 'custpage_date_ack',   line: ctr, value: ibt.poAck || ' ' });
                        sublist.setSublistValue({ id: 'custpage_order_info', line: ctr, value: ((ibt.so || '') + ' ' + (ibt.salesRep || '')).trim() || ' ' });

                        if (ed.esd)      sublist.setSublistValue({ id: 'custpage_esd',      line: ctr, value: ed.esd });
                        if (ed.tracking) sublist.setSublistValue({ id: 'custpage_tracking', line: ctr, value: ed.tracking });
                        if (ed.carrier)  sublist.setSublistValue({ id: 'custpage_carrier',  line: ctr, value: ed.carrier });

                        ctr++;
                    } catch (e) {
                        log.error(`Sublist row ${ctr} failed (lineKey: ${lineKey})`, e);
                        // skip bad row, continue
                    }
                });

                form2.addSubmitButton('Save');
                context.response.writePage(form2);

            } else {
                // ── POST ──────────────────────────────────────────────────────────
                var payload = [];
                var requestCount = context.request.getLineCount({ group: 'sublist' });
                log.debug('requestCount in post', requestCount);

                var lineSelected = false;
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
                        lineSelected = true;
                    }
                }

                if (!lineSelected) {
                    var selectLineError = error.create({
                        name: 'SELECT_LINE_ERROR',
                        message: 'Please select at least one PO line item to update.',
                        notifyOff: true
                    });
                    log.debug('Error Code: ' + selectLineError.name);
                    throw selectLineError.message;
                }

                log.debug('payload', payload);

                payload.forEach(function (item) {
                    var result = sendWriteBack(item);
                    setEsdDate(item);
                    log.debug('sendWriteBack result', result);
                });

                context.response.write('<script>window.close();</script>');
            }
        }

        // ── WRITE BACK: PO line fields ────────────────────────────────────────────
        const sendWriteBack = (payload) => {
            log.debug('sendWriteBack payload', JSON.stringify(payload));
            try {
                var po = record.load({ type: 'purchaseorder', id: payload.id, isDynamic: true });
                var lineCount = po.getLineCount({ sublistId: 'item' });
                log.debug('PO lineCount', lineCount);

                for (var x = 0; x < lineCount; x++) {
                    var uniqueId = po.getSublistValue({ sublistId: 'item', fieldId: 'lineuniquekey', line: x });
                    if (uniqueId == payload.key) {
                        log.debug('Match found at line', x);
                        po.selectLine({ sublistId: 'item', line: x });

                        if (payload.esd) {
                            try {
                                po.setCurrentSublistValue({ sublistId: 'item', fieldId: 'expectedreceiptdate', value: new Date(payload.esd) });
                                log.debug('ESD set', payload.esd);
                            } catch (e) { log.error('Error setting ESD', e); }
                        }
                        if (payload.carrier) {
                            try {
                                po.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_pr_vendor_provided_carrier', value: payload.carrier });
                                log.debug('Carrier set', payload.carrier);
                            } catch (e) { log.error('Error setting carrier', e); }
                        }
                        if (payload.tracking) {
                            try {
                                po.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_pr_vendor_provided_tracking', value: payload.tracking });
                                log.debug('Tracking set', payload.tracking);
                            } catch (e) { log.error('Error setting tracking', e); }
                        }

                        po.commitLine({ sublistId: 'item' });
                        log.debug('Line committed');
                    }
                }

                var saved = po.save();
                log.audit('PO saved', saved);
                return saved;
            } catch (e) {
                log.error('sendWriteBack error', e);
                throw e;
            }
        };

        // ── WRITE BACK: Consolidated special order record + inbound shipment ─────
        const setEsdDate = (payload) => {
            try {
                log.debug('setEsdDate key', payload.key);

                var results = search.create({
                    type: 'customrecord_consolidated_special_order',
                    filters: [
                        ['custrecord_consolidated_po_unique',      'is', payload.key], 'AND',
                        ['isinactive',                             'is', 'F'],          'AND',
                        ['custrecord_special_consolidated_linked', 'is', 'T']
                    ],
                    columns: ['internalid']
                }).run().getRange({ start: 0, end: 1 });

                if (!results || results.length === 0) {
                    log.error('setEsdDate', 'No CSO record found for key: ' + payload.key);
                    return;
                }

                var consolidatedId = results[0].getValue('internalid');
                log.debug('CSO record id', consolidatedId);

                var csoRec = record.load({ type: 'customrecord_consolidated_special_order', id: consolidatedId });

                if (payload.esd)      csoRec.setValue({ fieldId: 'custrecord_esd',      value: new Date(payload.esd) });
                if (payload.tracking) csoRec.setValue({ fieldId: 'custrecord_tracking', value: payload.tracking });
                if (payload.carrier)  csoRec.setValue({ fieldId: 'custrecord_carrier',  value: payload.carrier });

                var inbound = csoRec.getValue({ fieldId: 'custrecord_inbound_shipment' });
                var savedId = csoRec.save();
                log.debug('CSO record saved', savedId);

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
                    log.debug('Inbound ESD updated', key);
                } else {
                    log.debug('writeToInbound', 'Line not found for key: ' + key);
                }
            } catch (e) {
                log.error('writeToInbound error', e);
            }
        };

        return { onRequest: onRequest };
    });