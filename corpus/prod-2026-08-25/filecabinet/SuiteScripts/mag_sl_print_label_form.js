/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/format', 'N/render', 'N/runtime', 'N/file'],
    function (log, serverWidget, record, search, url, redirect, format, render, runtime, file) {

        function onRequest(context) {
            if (context.request.method === 'GET') {
                let salesOrderId = context.request.parameters.custom_id;
                if (!salesOrderId) return;

                let fields = createFormFields(serverWidget);
                let sublist = fields.sublist;
                sublist.addMarkAllButtons();
                let form2 = fields.form2;

                var customerNameColumn = search.createColumn({
                    name: "formulatext",
                    formula: "{custrecord_special_consolidated_so.entity}"
                });

                var consolidatedSearch = search.create({
                    type: "customrecord_consolidated_special_order",
                    filters: [
                        ["custrecord_inbound_shipment", "anyof", salesOrderId],
                        "AND",
                        [["custrecord_special_consolidated_so", "anyof", "@NONE@"], "OR", ["custrecord_special_consolidated_so.mainline", "is", "T"]]
                    ],
                    columns: [
                        "id",                                       
                        customerNameColumn,                         
                        "custrecord_special_consolidated_item",     
                        "custrecord_special_consolidated_qty",      
                        "CUSTRECORD_SPECIAL_CONSOLIDATED_SO",       
                        "custrecord_special_consolidated_room",     
                        search.createColumn({ name: "externaldocumentnumber", join: "CUSTRECORD_INBOUND_SHIPMENT" }), 
                        search.createColumn({ name: "binnumber", join: "CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM" }),      
                        search.createColumn({ name: "upccode", join: "CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM" })        
                    ]
                });

                let ctr = 0;
                consolidatedSearch.run().each(function (result) {
                    let rawName = result.getValue(result.columns[1]);
                    let childName = rawName && rawName.includes(':') ? rawName.split(':').pop().trim() : (rawName || " ");
                    
                    let upcCode = result.getValue(result.columns[8]);
                    let prefBin = result.getValue(result.columns[7]);

                    sublist.setSublistValue({ id: 'custpage_cust_rec_id', line: ctr, value: result.id });
                    sublist.setSublistValue({ id: 'custpage_item', line: ctr, value: result.getText('custrecord_special_consolidated_item') || " " });
                    sublist.setSublistValue({ id: 'custpage_upc', line: ctr, value: upcCode|| " " });
                    sublist.setSublistValue({ id: 'custpage_cust_company', line: ctr, value: childName });
                    sublist.setSublistValue({ id: 'custpage_so', line: ctr, value: result.getText('CUSTRECORD_SPECIAL_CONSOLIDATED_SO') || " " });
                    sublist.setSublistValue({ id: 'custpage_po', line: ctr, value: result.getValue(result.columns[6]) || " " });
                    sublist.setSublistValue({ id: 'custpage_room_loc', line: ctr, value: result.getValue('custrecord_special_consolidated_room') || " " });
                    sublist.setSublistValue({ id: 'custpage_item_qty', line: ctr, value: result.getValue('custrecord_special_consolidated_qty') || " " });
                    sublist.setSublistValue({ id: 'custpage_quantity_to_print', line: ctr, value: result.getValue('custrecord_special_consolidated_qty') || " " });
                    sublist.setSublistValue({ id: 'custpage_bin', line: ctr, value: prefBin || " " });

                    ctr++;
                    return true;
                });

                form2.addSubmitButton('Print');
                context.response.writePage(form2);

            } else {
                let custArray = [];
                let requestCount = context.request.getLineCount({ group: 'sublist' });

                for (let x = 0; x < requestCount; x++) {
                    let selected = context.request.getSublistValue({ group: 'sublist', name: 'custpage_selected', line: x });
                    if (selected === 'T') {
                        let arrayObject = {};
                        arrayObject.item = returner(context.request.getSublistValue({ group: 'sublist', name: 'custpage_item', line: x }));
                        arrayObject.upcCode = returner(context.request.getSublistValue({ group: 'sublist', name: 'custpage_upc', line: x }));
                        arrayObject.so = returner(context.request.getSublistValue({ group: 'sublist', name: 'custpage_so', line: x }));
                        arrayObject.po = returner(context.request.getSublistValue({ group: 'sublist', name: 'custpage_po', line: x }));
                        arrayObject.custCompanyName = returner(context.request.getSublistValue({ group: 'sublist', name: 'custpage_cust_company', line: x }));
                        arrayObject.room = returner(context.request.getSublistValue({ group: 'sublist', name: 'custpage_room_loc', line: x }));
                        arrayObject.prefBin = returner(context.request.getSublistValue({ group: 'sublist', name: 'custpage_bin', line: x }));

                        let printCount = parseInt(context.request.getSublistValue({ group: 'sublist', name: 'custpage_quantity_to_print', line: x })) || 1;
                        for (let cc = 0; cc < printCount; cc++) {
                            custArray.push(arrayObject);
                        }
                    }
                }

                if (custArray.length > 0) {
                    let templateId = runtime.getCurrentScript().getParameter({ name: 'custscript_dnu_inbound_labels' });
                    let renderer = render.create();
                    renderer.setTemplateById({ id: templateId });
                    renderer.addCustomDataSource({ format: render.DataSource.OBJECT, alias: 'results', data: { results: custArray } });
                    context.response.writeFile({ file: renderer.renderAsPdf(), isInline: true });
                }
            }
        }

        function returner(word) {
            if (!word) return '';
            return String(word).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        }

        const createFormFields = (serverWidget) => {
            let form2 = serverWidget.createForm({ title: 'Labels to Print' });
            let sublist = form2.addSublist({ id: 'sublist', type: serverWidget.SublistType.LIST, label: 'Received Items' });
            
            sublist.addField({ id: 'custpage_selected', label: 'Select', type: serverWidget.FieldType.CHECKBOX });
            
            sublist.addField({ id: 'custpage_quantity_to_print', label: 'Qty To Print', type: serverWidget.FieldType.TEXT })
                .updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
            
            sublist.addField({ id: 'custpage_cust_rec_id', label: 'ID', type: serverWidget.FieldType.TEXT })
                .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
            
            sublist.addField({ id: 'custpage_item', label: 'Item', type: serverWidget.FieldType.TEXT });
            sublist.addField({ id: 'custpage_upc', label: 'Code', type: serverWidget.FieldType.TEXT });
            sublist.addField({ id: 'custpage_so', label: 'Sales Order', type: serverWidget.FieldType.TEXT });
            sublist.addField({ id: 'custpage_po', label: 'PO', type: serverWidget.FieldType.TEXT });
            sublist.addField({ id: 'custpage_cust_company', label: 'Job', type: serverWidget.FieldType.TEXT });
            sublist.addField({ id: 'custpage_room_loc', label: 'Mark', type: serverWidget.FieldType.TEXT });
            sublist.addField({ id: 'custpage_item_qty', label: 'Received', type: serverWidget.FieldType.TEXT });
            
            // This is the specific change to keep Bin as an entry field
            sublist.addField({ id: 'custpage_bin', label: 'Bin', type: serverWidget.FieldType.TEXT })
                .updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
            
            return { form2, sublist };
        }

        return { onRequest: onRequest };
    });