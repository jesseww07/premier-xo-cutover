/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
 define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/runtime'],
    function (log, serverWidget, record, search, runtime) {
        function onRequest(context) {
            if (context.request.method === 'GET') {
                var inboundShipmentId = context.request.parameters.inbound_shipment_id;

                var formObj = serverWidget.createForm({
                    title: 'Update Item Pricing on Order'
                });

                // Add client script
                formObj.clientScriptFileId = 1000088;

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
                    id: 'custpage_selected',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Selected'
                });

                sublist.addField({
                    id: 'custpage_item',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
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
                        sublist.setSublistValue({
                            id: 'custpage_int',
                            line: index,
                            value: result.getValue('internalid')
                        });

                        sublist.setSublistValue({
                            id: 'custpage_item',
                            line: index,
                            value: result.getText('custrecord_special_consolidated_item')
                        });

                        sublist.setSublistValue({
                            id: 'custpage_item_rate',
                            line: index,
                            value: result.getValue('custrecord_consol_item_rate') || 0
                        });

                        sublist.setSublistValue({
                            id: 'custpage_current_item_rate',
                            line: index,
                            value: result.getValue({ name: 'vendorcost', join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM' }) || 0
                        });

                        sublist.setSublistValue({
                            id: 'custpage_qty',
                            line: index,
                            value: result.getValue('custrecord_special_consolidated_qty') || 0
                        });

                        sublist.setSublistValue({
                            id: 'custpage_vendor_cost',
                            line: index,
                            value: result.getValue({ name: 'vendorcost', join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM' }) || 0
                        });

                        sublist.setSublistValue({
                            id: 'custpage_po',
                            line: index,
                            value: result.getText('custrecord_special_consolidated_po') || ''
                        });

                        sublist.setSublistValue({
                            id: 'custpage_vendor',
                            line: index,
                            value: result.getText('custrecord_special_consolidated_vendor') || ''
                        });

                        sublist.setSublistValue({
                            id: 'custpage_pouniquekey',
                            line: index,
                            value: result.getValue('custrecord_consolidated_po_unique') || 0
                        });
                    });
                }

                formObj.addSubmitButton();
                context.response.writePage(formObj);

            } else if (context.request.method === 'POST') {
                let isOnchange = context.request.parameters.is_onchange;
                log.audit('isOnchange', isOnchange)
         
                if (isOnchange === 'true') {
                 
                        //Return only JSON data to the client
                        let percent = context.request.parameters.custpage_promopercent;
                        log.debug('!!!!!percent',percent)
                        let inbound = context.request.parameters.custpage_inboundid;
                        log.debug('!!!!!inbound',inbound)
                        return updateList(inbound,context,percent);
                
                }

                var lineCount = context.request.getLineCount({ group: 'custpage_search_items' });
                log.debug('lineCount',lineCount)
                for (var i = 0; i < lineCount; i++) {
                    var isSelected = context.request.getSublistValue({
                        group: 'custpage_search_items',
                        name: 'custpage_selected',
                        line: i
                    });
                    var cancelLine = context.request.getSublistValue({
                        group: 'custpage_search_items',
                        name: 'custpage_cancel',
                        line: i
                    });
                    
                    if (isSelected === 'T') {
                        var customRecordId = context.request.getSublistValue({
                            group: 'custpage_search_items',
                            name: 'custpage_int',
                            line: i
                        });
                        
                        var updatedRate = context.request.getSublistValue({
                            group: 'custpage_search_items',
                            name: 'custpage_vendor_cost',
                            line: i
                        });
    
                        if (customRecordId && updatedRate) {
                            try {
                                // record.submitFields({
                                //     type: 'customrecord_consolidated_special_order',
                                //     id: customRecordId,
                                //     values: {
                                //         custrecord_consol_item_rate: updatedRate
                                //     }
                                // });

                                let loadedRecord = record.load({
                                    type: 'customrecord_consolidated_special_order',
                                    id: customRecordId,
                                    isDynamic: true
                                })
                                loadedRecord.setValue({
                                    fieldId: 'custrecord_consol_item_rate',
                                    value: updatedRate
                                })
                                loadedRecord.setValue({
                                    fieldId: 'custrecord_mli_consol_adjust_price',
                                    value: true
                                })
                                loadedRecord.save()


                                log.debug('Updated Record', `ID: ${customRecordId}, New Rate: ${updatedRate}`);
                            } catch (error) {
                                log.error('Error Updating Record', error.message);
                            }
                        }
                   
                            // if (customRecordId && cancelLine) {
                            //     try {
                            //         // record.submitFields({
                            //         //     type: 'customrecord_consolidated_special_order',
                            //         //     id: customRecordId,
                            //         //     values: {
                            //         //         custrecord_mli_cancel_line: cancelLine
                            //         //     }
                            //         // });

                            //         let loadedRecord = record.load({
                            //             type: 'customrecord_consolidated_special_order',
                            //             id: customRecordId,
                            //             isDynamic: true
                            //         })
                            //         loadedRecord.setValue({
                            //             fieldId: 'custrecord_mli_cancel_line',
                            //             value: cancelLine
                            //         })
                            //         loadedRecord.save()

                            //         log.debug('Updated Record', `ID: ${customRecordId}, Cancel Reason: ${cancelLine}`);
                            //     } catch (error) {
                            //         log.error('Error Updating Record', error.message);
                            //     }
                            // }
                        
                    }
              

                }
    
                context.response.write('Records updated successfully.');
            }
            
        }



        const updateList = (inbound,context,percent) => {
      let usePercent = percent / 100
      log.debug('usePercent',usePercent)
            var customSearch = search.create({
                type: "customrecord_consolidated_special_order",
                filters: [
                    ["custrecord_inbound_shipment", "anyof", inbound]
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
                    "internalid"
                ]
            });
   
            let searchResults = [];
            customSearch.run().each((result) => {
                   
            let prePromo = result.getValue({ name: 'vendorcost', join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM' })
            log.debug('prePromo',prePromo)
            let toSubtract = prePromo * usePercent
            log.debug('toSubtract',toSubtract)
            let withPromo = prePromo - toSubtract
                        searchResults.push({
                            custpage_int: result.getValue('internalid'),
                            custpage_item: result.getText('custrecord_special_consolidated_item'),
                            custpage_item_rate: result.getValue('custrecord_consol_item_rate') || '',
                            custpage_current_item_rate: result.getValue({ name: 'vendorcost', join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM' }) || '',
                            custpage_qty: result.getValue('custrecord_special_consolidated_qty') || '',
                            custpage_vendor_cost: parseFloat(withPromo.toFixed(2)),
                           // custpage_vendor_cost: result.getValue({ name: 'vendorcost', join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_ITEM' }) || '',
                            custpage_po: result.getText('custrecord_special_consolidated_po') || '',
                            custpage_vendor: result.getText('custrecord_special_consolidated_vendor') || '',
                        });
                        return true;
                    });
                    log.debug('searchResults.l', searchResults.length)
                    log.debug('searchResults', searchResults)
     
   
            // context.response.addHeader({
            //     name: 'Content-Type:',
            //     value: 'Application/json' //text/csv
            // });
            context.response.write(JSON.stringify({ results: searchResults }));
            return;
        }

        return { onRequest };
    });
