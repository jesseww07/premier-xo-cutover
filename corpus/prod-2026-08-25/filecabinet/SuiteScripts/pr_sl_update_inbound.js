/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/task'],
    function (log, serverWidget, record, search, task) {
        function onRequest(context) {
            if (context.request.method === 'GET') {
                var inboundShipmentId = context.request.parameters.inbound_shipment_id;

                var formObj = serverWidget.createForm({
                    title: 'Update Item Pricing on Order'
                });

                // Add client script
                // formObj.clientScriptFileId = 874850;
                formObj.clientScriptModulePath = 'SuiteScripts/updateInboundHelper_cl.js';

                var inb = formObj.addField({
                    id: 'custpage_inbound',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Inbound ID'
                });
                inb.defaultValue = inboundShipmentId;

                var promo = formObj.addField({
                    id: 'custpage_promo',
                    type: serverWidget.FieldType.PERCENT,
                    label: 'Promo Percentage'
                });
                
                formObj.addButton({
                    id: 'custpage_mark_all',
                    label: 'Mark All',
                    functionName: 'markAllCheckboxes'
                });

                
                // Use INLINEEDITOR sublist type to ensure data is passed in POST
                var sublist = formObj.addSublist({
                    id: 'custpage_search_items',
                    type: serverWidget.SublistType.INLINEEDITOR,
                    label: 'Search Results',
                });

               

                sublist.addField({
                    id: 'custpage_item',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Item',
                    source: "item"
                }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

                sublist.addField({
                    id: 'custpage_item_rate',
                    type: serverWidget.FieldType.TEXT,
                    label: 'PO Item Rate'
                }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

                sublist.addField({
                    id: 'custpage_current_item_rate',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Current Item Rate'
                }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

                sublist.addField({
                    id: 'custpage_qty',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Quantity'
                }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

                sublist.addField({
                    id: 'custpage_selected',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Selected'
                });

                sublist.addField({
                    id: 'custpage_vendor_cost',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Updated Item Rate'
                }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

                sublist.addField({
                    id: 'custpage_po',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Purchase Order'
                }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

                sublist.addField({
                    id: 'custpage_vendor',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Vendor'
                }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });

                sublist.addField({
                    id: 'custpage_int',
                    type: serverWidget.FieldType.TEXT,
                    label: 'ID'
                }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

                // sublist.addField({
                //     id: 'custpage_cancel',
                //     type: serverWidget.FieldType.SELECT,
                //     source: 'customlist_mli_cancel_reason',
                //     label: 'Cancel Item'
                // }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });


                // sublist.addField({
                //     id: 'custpage_repbuy',
                //     type: serverWidget.FieldType.CHECKBOX,
                //     label: 'Representative Buy (testing-dont use yet)'
                // })
                // //.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

                sublist.addField({
                    id: 'custpage_pouniquekey',
                    type: serverWidget.FieldType.TEXT,
                    label: 'PO KEY'
                })
                .updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });


                if (inboundShipmentId) {
                    var customSearch = search.create({
                        type: "customrecord_consolidated_special_order",
                        filters: [
                            ["custrecord_inbound_shipment", "anyof", inboundShipmentId]
                        ],
                        columns: [
                            "custrecord_special_consolidated_item",
                            "custrecord_consol_item_rate",
                            "custrecord_special_consolidated_qty",
                            search.createColumn({
                                name: "vendorcost",
                                join: "CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM"
                            }),
                            "custrecord_special_consolidated_po",
                            "custrecord_special_consolidated_vendor",
                            "internalid",
                            "custrecord_consolidated_po_unique"
                        ]
                    });

                    var searchResults = customSearch.run().getRange({ start: 0, end: 1000 });

                    searchResults.forEach(function (result, index) {
                        let internalId =  result.getValue('internalid');
                        let item = result.getValue('custrecord_special_consolidated_item');
                        let itemRate= result.getValue('custrecord_consol_item_rate') || ''
                        let currentRate = result.getValue({ name: 'vendorcost', join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM' }) || ''
                        let qty = result.getValue('custrecord_special_consolidated_qty') || ''
                        let vendorCost = result.getValue({ name: 'vendorcost', join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM' }) || 0
                        let po = result.getText('custrecord_special_consolidated_po') || ''
                        let vendor = result.getText('custrecord_special_consolidated_vendor') || ''
                        let poUnique = result.getValue('custrecord_consolidated_po_unique') || ''

                        if(internalId) {
                            sublist.setSublistValue({
                                id: 'custpage_int',
                                line: index,
                                value: internalId
                            });
                        }
                        if(item) {
                            sublist.setSublistValue({
                                id: 'custpage_item',
                                line: index,
                                value: item
                            });
                        }

                        if(itemRate){
                            sublist.setSublistValue({
                                id: 'custpage_item_rate',
                                line: index,
                                value: itemRate
                            });
                        }

                        if(currentRate){
                            sublist.setSublistValue({
                                id: 'custpage_current_item_rate',
                                line: index,
                                value: currentRate
                            });
                        }

                        if(qty){
                            sublist.setSublistValue({
                                id: 'custpage_qty',
                                line: index,
                                value: qty
                            });
                        }

                        // if(vendorCost) {
                        //     sublist.setSublistValue({
                        //         id: 'custpage_vendor_cost',
                        //         line: index,
                        //         value: vendorCost
                        //     });
                        // }

                        if(itemRate) {
                            sublist.setSublistValue({
                                id: 'custpage_vendor_cost',
                                line: index,
                                value: itemRate
                            });
                        }
                        

                        if(po){
                            sublist.setSublistValue({
                                id: 'custpage_po',
                                line: index,
                                value: po
                            });
                        }

                        if(vendor){
                            sublist.setSublistValue({
                                id: 'custpage_vendor',
                                line: index,
                                value: vendor
                            });
                        }


                        if(poUnique){
                            sublist.setSublistValue({
                                id: 'custpage_pouniquekey',
                                line: index,
                                value: poUnique
                            });
                        }
                    });
                }

                formObj.addSubmitButton();
                context.response.writePage(formObj);
                
            } else if (context.request.method === 'POST') {
                let isOnchange = context.request.parameters.is_onchange;
         
                if (isOnchange === 'true') {
                    let percent = context.request.parameters.custpage_promopercent;
                    let inbound = context.request.parameters.custpage_inboundid;
                    return updateList(inbound, context, percent);
                }

                var lineCount = context.request.getLineCount({ group: 'custpage_search_items' });
                let inboundId = context.request.parameters.custpage_inbound;
                let updates = [];

                // Gather all selected line data
                for (var i = 0; i < lineCount; i++) {
                    var isSelected = context.request.getSublistValue({
                        group: 'custpage_search_items',
                        name: 'custpage_selected',
                        line: i
                    });
                    
                    if (isSelected === 'T') {
                        updates.push({
                            csoId: context.request.getSublistValue({ group: 'custpage_search_items', name: 'custpage_int', line: i }),
                            updatedRate: context.request.getSublistValue({ group: 'custpage_search_items', name: 'custpage_vendor_cost', line: i }),
                            poLineKey: context.request.getSublistValue({ group: 'custpage_search_items', name: 'custpage_pouniquekey', line: i })
                        });
                    }
                }
    
                if (updates.length > 0) {
                    try {
                        // Offload heavy processing to Map/Reduce
                        let mrTask = task.create({
                            taskType: task.TaskType.MAP_REDUCE,
                            scriptId: 'customscript_update_inbound_pricing_mr',
                            deploymentId: 'customdeploy_update_inbound_pricing_mr',
                            params: {
                                'custscript_mr_inbound_updates': JSON.stringify(updates),
                                'custscript_mr_inbound_id': inboundId
                            }
                        });
                        let taskId = mrTask.submit();
                        
                        log.audit('Delegated to M/R', `Task ID: ${taskId}, Updates: ${updates.length}`);
                        context.response.write(`Success! ${updates.length} records submitted for background processing. You may close this tab.`);
                    } catch (e) {
                        log.error('Task Submission Failed', e.message);
                        context.response.write('Error submitting records for processing. Please contact your administrator.');
                    }
                } else {
                    context.response.write('No records selected for update.');
                }
            }
        }

        const updateList = (inbound, context, percent) => {
            // ... [Keep your existing updateList logic here] ...
        }

        return { onRequest };
    });