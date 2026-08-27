/**
 * API Version 2.1
 * Partial Estimate to SO (Premier) 
 * Support Ticket: 2462
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00     12/13/22       Alex Gjorvad                       Suitelet
 * 
 *          Script Functionality
 * -This script is triggered when the "Create Sales Order" button (customscript_pr_create_so_ue) is clicked on an 
 * Estimate record.  If a related sales order does not already exist for the Estimate, then this script will create 
 * one.  If a sales order does exist, this script will add line items to the sales order.  The suitelet sublist lists 
 * all of the line items that are on the Estimate that are not already on a sales order.  By selecting line items from
 * this list, users will create or add to a sales order with those items on it.
 */
/**
*@NApiVersion 2.1
*@NModuleScope Public
*@NScriptType Suitelet
*/
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/task', 'N/error', 'N/https', 'N/redirect'],
    function (log, serverWidget, record, search, url, task, error, https, redirect) {
        function onRequest(context) {
            if (context.request.method === 'GET') {
                //Estimate internal ID can be found in the URL parameters
                var estimateId = context.request.parameters.custom_id;
                log.debug('estimate_id', estimateId);
                var form = serverWidget.createForm({
                    title: 'Create Sales Order'
                });
                var estimate = form.addField({
                    id: 'custpage_estimate',
                    type: serverWidget.FieldType.TEXT,
                    label: 'ESTIMATE',
                });
                estimate.defaultValue = estimateId;
                //Hide the Estimate internal ID so it can be used in the 'POST' method
                estimate.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                var estimateLocation = form.addField({
                    id: 'custpage_estimate_location',
                    type: serverWidget.FieldType.SELECT,
                    source: 'location',
                    label: 'ESTIMATE LOCATION',
                });
                //Hide the Estimate internal ID so it can be used in the 'POST' method
                estimateLocation.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
                var mySublist = form.addSublist({
                    id: 'custpage_est_sublist',
                    type: serverWidget.SublistType.INLINEEDITOR,
                    label: 'Estimate Lines'
                });
                mySublist.addField({
                    id: 'custpage_selected',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'SELECTED'
                });
                mySublist.addField({
                    id: 'custpage_internalid',
                    type: serverWidget.FieldType.TEXT,
                    label: 'ID'
                }).updateDisplayType({
                    displayType: 'DISABLED'
                });
                mySublist.addField({
                    id: 'custpage_item',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
                }).updateDisplayType({
                    displayType: 'DISABLED'
                });
                mySublist.addField({
                    id: 'custpage_quantity',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Quantity'
                }).updateDisplayType({
                    displayType: 'DISABLED'
                });
                mySublist.addField({
                    id: 'custpage_line',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Line'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_price_level',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Price Level',
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_rate',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Rate',
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_tax_code',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Tax Code',
                    source: 'taxitem'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_cost_estimate',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Cost Estimate'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_exclude_from_rate',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Exclude From Rate Request'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_is_taxable',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Is Taxable'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_room_location',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Room Location'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_robson_markup_line',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Robson Markup Line'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_robson_amount',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Robson Amount'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_robson_amount_tax',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Robson Amount W/ Tax'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_preferred_vendor',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Preferred Vendor',
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_purchase_price',
                    type: serverWidget.FieldType.CURRENCY,
                    label: 'Purchase Price'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_item_name',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item Name'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_prod_url',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Product URL'
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_man',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Man',
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_ignore_rope',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Ignore Robson Calc',
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_is_light_bulb',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Is Light Bulb',
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_special_order',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Is Light Bulb',
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                mySublist.addField({
                    id: 'custpage_unconsolidated_item',
                    type: serverWidget.FieldType.CHECKBOX,
                    label: 'Is Light Bulb',
                }).updateDisplayType({
                    displayType: 'HIDDEN'
                });
                var loadEstimate = record.load({
                    type: record.Type.ESTIMATE,
                    id: estimateId,
                    isDynamic: true,
                });
                var estLocation = loadEstimate.getValue({
                    fieldId: 'location'
                });
                estimateLocation.defaultValue = estLocation;
                var lineItemCount = loadEstimate.getLineCount({
                    sublistId: 'item'
                });
                log.debug('est_line_count', lineItemCount);
                var counter = 0;
                for (var i = 0; i < lineItemCount; i++) {
                    var movedToSO = loadEstimate.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pr_moved_to_so',
                        line: i
                    });
                    log.debug('moved_to_so', movedToSO);
                    //If "Moved To SO" box is already checked for the line item, do not add that line item to the 
                    //suitelet sublist.
                    if (movedToSO != true) {
                        var item = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i
                        });
                        log.debug('item', item)
                        var itemText = loadEstimate.getSublistText({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i
                        });
                        var quantity = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: i
                        });
                        var lineNumber = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'line',
                            line: i
                        });
                        log.debug('line_number', lineNumber);
                        var priceLevel = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'price',
                            line: i
                        });
                        var rate = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: i
                        });
                        var taxCode = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'taxcode',
                            line: i
                        });
                        var excludeFromRate = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'excludefromraterequest',
                            line: i
                        });
                        var isTaxable = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pr_is_taxable',
                            line: i
                        });
                        var roomLocation = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pr_room_location',
                            line: i
                        });
                        var costEstimate = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'costestimatetype',
                            line: i
                        });
                        var robsonMarkupLine = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pr_robson_markup_line',
                            line: i
                        });
                        var robsonAmount = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_robson_amount',
                            line: i
                        });
                        var robsonAmtTax = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_robson_amt_w_tax',
                            line: i
                        });
                        var preferredVendor = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcolcustcol_zastro_vendor',
                            line: i
                        });
                        var purchasePrice = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_zastro_purchase_price',
                            line: i
                        });
                        var itemName = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pl_item_name',
                            line: i
                        });
                        var prodUrl = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pr_prod_url',
                            line: i
                        });
                        var man = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pr_man',
                            line: i
                        });
                        var ignoreRobson = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_ignore_rope',
                            line: i
                        });
                        var isLightBulb = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_premier_is_bulb',
                            line: i
                        });
                        var specialOrder = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_psc_spec_order_prod',
                            line: i
                        });
                        var unconsolidateItem = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_zastro_unconsolidated_item',
                            line: i
                        });
                        var amount = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'amount',
                            line: i
                        });
                        var itemDesc = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'description',
                            line: i
                        });
                        log.debug('item_desc', itemDesc);
                        var partNumber = loadEstimate.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_part_no',
                            line: i
                        });
                        log.debug('part_no', partNumber);
                        //SET SUBLIST FIELDS ON SUITELET
                        mySublist.setSublistValue({
                            id: 'custpage_internalid',
                            line: counter,
                            value: item
                        });
                        mySublist.setSublistValue({
                            id: 'custpage_item',
                            line: counter,
                            value: itemText
                        });
                        if (quantity) {
                            mySublist.setSublistValue({
                                id: 'custpage_quantity',
                                line: counter,
                                value: quantity
                            });
                        }
                        mySublist.setSublistValue({
                            id: 'custpage_line',
                            line: counter,
                            value: lineNumber
                        });
                        if (priceLevel) {
                            mySublist.setSublistValue({
                                id: 'custpage_price_level',
                                line: counter,
                                value: priceLevel
                            });
                        }
                        if (rate) {
                            mySublist.setSublistValue({
                                id: 'custpage_rate',
                                line: counter,
                                value: rate
                            });
                        }
                        if (excludeFromRate) {
                            mySublist.setSublistValue({
                                id: 'custpage_exclude_from_rate',
                                line: counter,
                                value: excludeFromRate
                            });
                        }
                        if (taxCode) {
                            mySublist.setSublistValue({
                                id: 'custpage_tax_code',
                                line: counter,
                                value: taxCode
                            });
                        }
                        if (costEstimate) {
                            mySublist.setSublistValue({
                                id: 'custpage_cost_estimate',
                                line: counter,
                                value: costEstimate
                            });
                        }
                        if (isTaxable) {
                            mySublist.setSublistValue({
                                id: 'custpage_is_taxable',
                                line: counter,
                                value: isTaxable
                            });
                        }
                        if (roomLocation) {
                            mySublist.setSublistValue({
                                id: 'custpage_room_location',
                                line: counter,
                                value: roomLocation
                            });
                        }
                        if (robsonMarkupLine) {
                            mySublist.setSublistValue({
                                id: 'custpage_robson_markup_line',
                                line: counter,
                                value: robsonMarkupLine
                            });
                        }
                        if (robsonAmount) {
                            mySublist.setSublistValue({
                                id: 'custpage_robson_amount',
                                line: counter,
                                value: robsonAmount
                            });
                        }
                        if (robsonAmtTax) {
                            mySublist.setSublistValue({
                                id: 'custpage_robson_amount_tax',
                                line: counter,
                                value: robsonAmtTax
                            });
                        }
                        if (preferredVendor) {
                            mySublist.setSublistValue({
                                id: 'custpage_preferred_vendor',
                                line: counter,
                                value: preferredVendor
                            });
                        }
                        if (purchasePrice) {
                            mySublist.setSublistValue({
                                id: 'custpage_purchase_price',
                                line: counter,
                                value: purchasePrice
                            });
                        }
                        if (itemName) {
                            mySublist.setSublistValue({
                                id: 'custpage_item_name',
                                line: counter,
                                value: itemName
                            });
                        }
                        if (prodUrl) {
                            mySublist.setSublistValue({
                                id: 'custpage_prod_url',
                                line: counter,
                                value: prodUrl
                            });
                        }
                        if (man) {
                            mySublist.setSublistValue({
                                id: 'custpage_man',
                                line: counter,
                                value: man
                            });
                        }
                        if (ignoreRobson) {
                            mySublist.setSublistValue({
                                id: 'custpage_ignore_rope',
                                line: counter,
                                value: ignoreRobson
                            });
                        }
                        if (isLightBulb) {
                            mySublist.setSublistValue({
                                id: 'custpage_is_light_bulb',
                                line: counter,
                                value: isLightBulb
                            });
                        }
                        if (specialOrder) {
                            mySublist.setSublistValue({
                                id: 'custpage_special_order',
                                line: counter,
                                value: specialOrder
                            });
                        }
                        if (unconsolidateItem) {
                            mySublist.setSublistValue({
                                id: 'custpage_unconsolidated_item',
                                line: counter,
                                value: unconsolidateItem
                            });
                        }
                        mySublist.setSublistValue({
                            id: 'custpage_amount',
                            line: counter,
                            value: amount
                        });
                        mySublist.setSublistValue({
                            id: 'custpage_item_desc',
                            line: counter,
                            value: itemDesc
                        });
                        if (partNumber) {
                            mySublist.setSublistValue({
                                id: 'custpage_part_no',
                                line: counter,
                                value: partNumber
                            });
                        }
                        counter++
                    }
                }
                form.addSubmitButton({
                    label: 'Create Sales Order'
                });

                context.response.writePage(form);

            } else if (context.request.method === 'POST') {
                var estId = context.request.parameters.custpage_estimate;
                var estimate = record.load({
                    type: record.Type.ESTIMATE,
                    id: estId,
                    isDynamic: true,
                });
                log.debug('context.request.method_post', context.request.method);
                var estLoc = estimate.getValue({
                    fieldId: 'location'
                })
                var lineCount = context.request.getLineCount({
                    group: 'custpage_est_sublist'
                });
                log.debug('LINE_COUNT', lineCount);
                var selected;
                for (var p = 0; p < lineCount; p++) {
                    selected = context.request.getSublistValue({
                        group: 'custpage_est_sublist',
                        name: 'custpage_selected',
                        line: p
                    });
                    log.debug('selected_1', selected);
                    if (selected == 'T') {
                        break;
                    } else {
                        if (p == lineCount - 1) {
                            //If no line has been selected on the suitelet sublist, then throw an error.
                            var select_line_error = error.create({
                                name: 'SELECT_LINE_ERROR',
                                message: "Please select at least one item to add to the sales order.",
                                notifyOff: true
                            });
                            log.debug("Error Code: " + select_line_error.name);
                            throw select_line_error.message;
                        }
                    }
                }
                //Search to check for sales order created from Estimate record.
                var transactionSearchObj = search.create({
                    type: "transaction",
                    filters:
                        [
                            ["createdfrom.internalid", "anyof", estId],
                            "AND",
                            ["mainline", "is", "T"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" })
                        ]
                });
                var searchResultCount = transactionSearchObj.runPaged().count;
                var createdItemArray = [];
                //If sales order has already been created, add selected line items to sales order
                if (searchResultCount > 0) {
                    log.debug("transactionSearchObj result count", searchResultCount);
                    var searchResults = transactionSearchObj.run().getRange({
                        start: 0,
                        end: 1
                    })
                    var soInternalId = searchResults[0].getValue('internalid');
                    var salesOrderRecord = record.load({
                        type: record.Type.SALES_ORDER,
                        id: soInternalId,
                        isDynamic: true,
                    });
                    for (var a = 0; a < lineCount; a++) {
                        selected = context.request.getSublistValue({
                            group: 'custpage_est_sublist',
                            name: 'custpage_selected',
                            line: a
                        });
                        if (selected == 'T') {
                            var lineItem = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_internalid',
                                line: a
                            });
                            var lineQuantity = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_quantity',
                                line: a
                            });
                            var lineNumber = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_line',
                                line: a
                            });
                            var priceLevel = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_price_level',
                                line: a
                            });
                            var rate = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_rate',
                                line: a
                            });
                            var taxCode = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_tax_code',
                                line: a
                            });
                            var costEstimate = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_cost_estimate',
                                line: a
                            });
                            var excludeFromRate = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_exclude_from_rate',
                                line: a
                            });
                            var isTaxable = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_is_taxable',
                                line: a
                            });
                            var roomLocation = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_room_location',
                                line: a
                            });
                            var robsonMarkupLine = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_robson_markup_line',
                                line: a
                            });
                            var robsonAmount = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_robson_amount',
                                line: a
                            });
                            var robsonAmtTax = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_robson_amount_tax',
                                line: a
                            });
                            var preferredVendor = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_preferred_vendor',
                                line: a
                            });
                            var purchasePrice = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_purchase_price',
                                line: a
                            });
                            var itemName = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_item_name',
                                line: a
                            });
                            var prodUrl = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_prod_url',
                                line: a
                            });
                            var man = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_man',
                                line: a
                            });
                            var ignoreRobson = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_ignore_rope',
                                line: a
                            });
                            var isLightBulb = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_is_light_bulb',
                                line: a
                            });
                            var specialOrder = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_special_order',
                                line: a
                            });
                            var unconsolidatedItem = context.request.getSublistValue({
                                group: 'custpage_est_sublist',
                                name: 'custpage_unconsolidated_item',
                                line: a
                            });
                            //Have to change this internal id
                            if (lineItem == '818841') {
                                var newItem = record.create({
                                    type: record.Type.INVENTORY_ITEM,
                                    isDynamic: true
                                });
                                var lineAmount = context.request.getSublistValue({
                                    group: 'custpage_est_sublist',
                                    name: 'custpage_amount',
                                    line: a
                                });
                                log.debug('line_amount', lineAmount);
                                var partNumber = context.request.getSublistValue({
                                    group: 'custpage_est_sublist',
                                    name: 'custpage_part_no',
                                    line: a
                                });
                                var newItemDesc = context.request.getSublistValue({
                                    group: 'custpage_est_sublist',
                                    name: 'custpage_item_desc',
                                    line: a
                                });
                                if (!partNumber || !newItemDesc) {
                                    var new_item_error = error.create({
                                        name: 'NEW_ITEM_ERROR',
                                        message: "You must set a part number and item description to add Estimte Placeholder to sales order",
                                        notifyOff: true
                                    });
                                    log.debug("Error Code: " + new_item_error.name);
                                    throw new_item_error.message;
                                }
                                newItem.setValue({
                                    fieldId: 'itemid',
                                    value: partNumber
                                });
                                newItem.setValue({
                                    fieldId: 'salesdescription',
                                    value: newItemDesc
                                });
                                newItem.setValue({
                                    fieldId: 'taxschedule',
                                    value: '1'
                                });
                                var newItemId = newItem.save();
                                salesOrderRecord.selectNewLine({
                                    sublistId: 'item',
                                });
                                salesOrderRecord.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'item',
                                    value: newItemId
                                });
                                if (lineQuantity != null && lineQuantity) {
                                    salesOrderRecord.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'quantity',
                                        value: lineQuantity
                                    });
                                }
                                salesOrderRecord.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'amount',
                                    value: lineAmount
                                });
                            } else {
                                salesOrderRecord.selectNewLine({
                                    sublistId: 'item',
                                });
                            log.debug('zzzz_line_item', lineItem);
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                value: lineItem
                            });
                            if (lineQuantity != null && lineQuantity) {
                                salesOrderRecord.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'quantity',
                                    value: lineQuantity
                                });
                            }
                        }
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'price',
                                value: priceLevel
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'rate',
                                value: rate
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'taxcode',
                                value: taxCode
                            });
                            // salesOrderRecord.setCurrentSublistValue({
                            //     sublistId: 'item',
                            //     fieldId: 'costestimate',
                            //     value: costEstimate
                            // });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'excludefromraterequest',
                                value: excludeFromRate
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_is_taxable',
                                value: isTaxable
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_room_location',
                                value: roomLocation
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_robson_markup_line',
                                value: robsonMarkupLine
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_robson_amount',
                                value: robsonAmount
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_robson_amt_w_tax',
                                value: robsonAmtTax
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcolcustcol_zastro_vendor',
                                value: preferredVendor
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_zastro_purchase_price',
                                value: purchasePrice
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pl_item_name',
                                value: itemName
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_prod_url',
                                value: prodUrl
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_man',
                                value: man
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_ignore_rope',
                                value: ignoreRobson
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_premier_is_bulb',
                                value: isLightBulb
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_psc_spec_order_prod',
                                value: specialOrder
                            });
                            salesOrderRecord.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_zastro_unconsolidated_item',
                                value: unconsolidatedItem
                            });
                            salesOrderRecord.commitLine({
                                sublistId: 'item'
                            });
                            estimate.selectLine({
                                sublistId: 'item',
                                line: lineNumber - 1
                            });
                            estimate.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_moved_to_so',
                                value: true,
                            });
                            if (lineItem == '818841') {
                                estimate.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_pr_new_item',
                                    value: newItemId,
                                }); 
                            }
                            estimate.commitLine({
                                sublistId: 'item'
                            });
                        }
                    }
                    //If sales order has not been created, transform the Estimate into a sales order and remove all
                    //lines that were not selected on the suitelet sublist.
                } else {
                    var salesOrderRecord = record.transform({
                        fromType: record.Type.ESTIMATE,
                        fromId: estId,
                        toType: record.Type.SALES_ORDER,
                        isDynamic: true,
                    });
                    salesOrderRecord.setValue({
                        fieldId: 'custbody_pl_ordered_from_location',
                        value: estLoc
                    })
                    for (var x = lineCount - 1; x >= 0; x--) {
                        var lineItem = context.request.getSublistValue({
                            group: 'custpage_est_sublist',
                            name: 'custpage_internalid',
                            line: x
                        });
                        var lineQuantity = context.request.getSublistValue({
                            group: 'custpage_est_sublist',
                            name: 'custpage_quantity',
                            line: x
                        });
                        var lineNumber = context.request.getSublistValue({
                            group: 'custpage_est_sublist',
                            name: 'custpage_line',
                            line: x
                        });
                        selected = context.request.getSublistValue({
                            group: 'custpage_est_sublist',
                            name: 'custpage_selected',
                            line: x
                        });
                        log.debug('selected', selected);
                        if (selected == 'F') {
                            salesOrderRecord.removeLine({
                                sublistId: 'item',
                                line: x,
                            });
                            log.debug('zzzzz', 'zzzzz');
                        } else {
                            if (lineItem == '818841') {
                                var newItem = record.create({
                                    type: record.Type.INVENTORY_ITEM,
                                    isDynamic: true
                                });
                                var lineAmount = context.request.getSublistValue({
                                    group: 'custpage_est_sublist',
                                    name: 'custpage_amount',
                                    line: x
                                });
                                var partNumber = context.request.getSublistValue({
                                    group: 'custpage_est_sublist',
                                    name: 'custpage_part_no',
                                    line: x
                                });
                                var newItemDesc = context.request.getSublistValue({
                                    group: 'custpage_est_sublist',
                                    name: 'custpage_item_desc',
                                    line: x
                                });
                                if (!partNumber || !newItemDesc) {
                                    var new_item_error = error.create({
                                        name: 'NEW_ITEM_ERROR',
                                        message: "You must set a part number and item description to add Estimte Placeholder to sales order",
                                        notifyOff: true
                                    });
                                    log.debug("Error Code: " + new_item_error.name);
                                    throw new_item_error.message;
                                }
                                newItem.setValue({
                                    fieldId: 'itemid',
                                    value: partNumber
                                });
                                newItem.setValue({
                                    fieldId: 'salesdescription',
                                    value: newItemDesc
                                });
                                newItem.setValue({
                                    fieldId: 'taxschedule',
                                    value: '1'
                                });
                                var newItemId = newItem.save();
                                var newItemObj = new Object();
                                newItemObj.item = newItemId;
                                newItemObj.itemQty = lineQuantity;
                                newItemObj.itemAmt = lineAmount;
                                createdItemArray.push(newItemObj);
                            }
                            estimate.selectLine({
                                sublistId: 'item',
                                line: x
                            });
                            estimate.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_moved_to_so',
                                value: true,
                            });
                            if (lineItem == '818841') {
                                estimate.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_pr_new_item',
                                    value: newItemId,
                                }); 
                            }
                            estimate.commitLine({
                                sublistId: 'item'
                            });
                        }
                    }
                }
                var estId = estimate.save();
                log.debug('est_id', estId);
                var soId = salesOrderRecord.save();
                log.debug('saved_sales_order', soId);
                if (createdItemArray.length > 0) {
                    var soReloaded = record.load({
                        type: record.Type.SALES_ORDER,
                        id: soId,
                        isDynamic: true
                    });
                    var reloadedLineCount = soReloaded.getLineCount({
                        sublistId: 'item'
                    });
                    log.debug('reloaded_line_count', reloadedLineCount);
                    for (var j = 0; j < reloadedLineCount; j++) {
                        soReloaded.selectLine({
                            sublistId: 'item',
                            line: j
                        });
                        var reloadedItem = soReloaded.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                        });
                        if (reloadedItem == '818841') {
                            soReloaded.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                value: createdItemArray[0].item
                            });
                            soReloaded.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                value: createdItemArray[0].itemQty
                            });
                            soReloaded.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'amount',
                                value: createdItemArray[0].itemAmt
                            });
                            soReloaded.commitLine({
                                sublistId: 'item'
                            });
                        }
                    }
                    var saveSOAgain = soReloaded.save();
                }
                redirect.toRecord({
                    type: record.Type.SALES_ORDER,
                    id: soId
                })
            }
        }

        return {
            onRequest: onRequest
        };

    });