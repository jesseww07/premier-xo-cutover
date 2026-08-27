/**
 * API Version 2.1
 * Support Ticket:
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      4/27/23       Alex Gjorvad                       Scheduled
 * 
 *          Script Functionality
 * This script sets the "Room Location" field (custcol_pr_room_location) at the line item level of old stored sales 
 * orders that did not have this field set.
 * 
 */
/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/runtime', 'N/record', 'N/task', 'N/file', 'N/email'],
    function (search, runtime, record, task, file, email) {

        function execute(scriptContext) {
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["customform", "anyof", "174"],
                        "AND",
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["taxline", "is", "F"],
                        "AND",
                        ["shipping", "is", "F"],
                        "AND",
                        ["cogs", "is", "F"],
                        "AND",
                        ["mainline", "is", "F"],
                        "AND",
                        ["custcol_pr_room_location", "isempty", ""],
                        "AND",
                        ["internalid", "is", "106627"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            summary: "GROUP",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "tranid",
                            summary: "GROUP",
                            label: "Document Number"
                        })
                    ]
            });
            var searchResultCount = salesorderSearchObj.runPaged().count;
            log.debug("salesorderSearchObj result count", searchResultCount);
            salesorderSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var internalId = result.getValue({
                    name: 'internalid',
                    summary: search.Summary.GROUP
                });
                log.debug('sales_order_search_id', internalId);
                var inventoryadjustmentSearchObj = search.create({
                    type: "inventoryadjustment",
                    filters:
                        [
                            ["type", "anyof", "InvAdjst"],
                            "AND",
                            ["custbody_abe_so", "anyof", internalId],
                            "AND",
                            ["mainline", "is", "T"]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "Internal ID" })
                        ]
                });
                var searchResultCount2 = inventoryadjustmentSearchObj.runPaged().count;
                log.debug("inventoryadjustmentSearchObj result count", searchResultCount2);
                var invArray = [];
                inventoryadjustmentSearchObj.run().each(function (result) {
                    // .run().each has a limit of 4,000 results
                    var invAdjustment = result.getValue({
                        name: 'internalid'
                    });
                    log.debug('inv_adjust', invAdjustment);
                    invArray.push(invAdjustment);
                    return true;
                });
                log.debug('inv_array', invArray);
                var ifulItems = findIfulItems(invArray);
                if (ifulItems) {
                    var loadSalesOrder = record.load({
                        type: 'salesorder',
                        id: internalId,
                        isDynamic: true
                    })
                    var lineCount = loadSalesOrder.getLineCount('item');
                    for (var i = 0; i < ifulItems.length; i++) {
                        for (var j = 0; j < lineCount; j++) {
                            loadSalesOrder.selectLine({
                                sublistId: 'item',
                                line: j
                            });
                            var soItem = loadSalesOrder.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'item'
                            });
                            var soQty = loadSalesOrder.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity'
                            });
                            var roomLocation = loadSalesOrder.getCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_room_location'
                            });
                            if (soItem == ifulItems[i].item && soQty == ifulItems[i].quantity && !roomLocation) {
                                log.debug('match', j);
                                loadSalesOrder.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_pr_room_location',
                                    value: ifulItems[i].roomLocation
                                });
                                loadSalesOrder.commitLine({
                                    sublistId: 'item'
                                });
                            }
                        }
                    }
                }
                var soId = loadSalesOrder.save();
                log.debug('saved_stored_so', soId);
                return true;
            });
        }

        function findIfulItems(invArray) {
            var itemfulfillmentSearchObj = search.create({
                type: "itemfulfillment",
                filters:
                    [
                        ["type", "anyof", "ItemShip"],
                        "AND",
                        ["custbody_abe_ia", "anyof", invArray],
                        "AND",
                        ["custcol_pr_room_location", "isnotempty", ""]
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "item", label: "Item" }),
                        search.createColumn({ name: "quantity", label: "Quantity" }),
                        search.createColumn({ name: "custcol_pr_room_location", label: "Room Location" })
                    ]
            });
            var itemArray = []
            var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
            log.debug("itemfulfillmentSearchObj result count", searchResultCount);
            itemfulfillmentSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var ifulId = result.getValue({
                    name: 'internalid'
                });
                log.debug('iful_id', ifulId);
                var item = result.getValue({
                    name: 'item'
                });
                var quantity = result.getValue({
                    name: 'quantity'
                });
                var roomLocation = result.getValue({
                    name: 'custcol_pr_room_location'
                });
                if (roomLocation) {
                    var itemObj = new Object();
                    itemObj.item = item;
                    itemObj.quantity = quantity;
                    itemObj.roomLocation = roomLocation;
                    itemArray.push(itemObj);
                }
                return true;
            });
            log.debug('item_array', itemArray);
            return itemArray;
        }
        return {
            execute: execute
        };
    });