/**
 * API Version 1.0
 * Inventory Item configurations: Brand and Score
 * Support Ticket: 1498
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      3/22/21       Alex Gjorvad                       User Event
 * 
 *          Script Functionality
 * This script sets the Brand and Score fields on all Lot Number records that are found on the
 * Inventory Detail subrecords of Item Receipt line items.
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/util', 'N/log', 'N/search'],
    /**
     * @param {record} record
     * @param {runtime} runtime
     * @param {util} util
     * @param {log} log
     * @param {search} search
     */
    function (record, runtime, util, log, search) {
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
         */
        function beforeLoad(context) {
        }
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(context) {

        }
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(context) {
            if (context.type === context.UserEventType.EDIT || context.type === context.UserEventType.COPY) {
                log.debug('context', context);
                var salesOrder = context.newRecord;
                var soId = salesOrder.id;
                log.debug('so_internal_id', soId);
                var loadSO = record.load({
                    type: record.Type.SALES_ORDER,
                    id: soId,
                    isDynamic: true,
                });
                var lineCount = loadSO.getLineCount({
                    sublistId: 'item'
                });
                for (var i = 0; i < lineCount; i++) {
                    var lineNum = loadSO.selectLine({
                        sublistId: 'item',
                        line: i
                    });
                    var lineChanged = loadSO.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pr_qty_changed',
                    });
                    var consolPO = loadSO.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_zastro_unconsolidated_no',
                    });
                    if (lineChanged == true && consolPO) {
                        var item = loadSO.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldI: 'item',
                        });
                        var quantity = loadSO.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldI: 'quantity',
                        });
                        var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
                            type: "customrecord_zastro_unconsolidated_items",
                            filters:
                                [
                                    ["custrecord_zastro_po_item_list", "anyof", consolPO],
                                    "AND",
                                    ["custrecord_zastro_item_name", "anyof", item],
                                    "AND",
                                    ["custrecord_zastro_so_no", "anyof", soId]
                                ],
                            columns:
                                [
                                    search.createColumn({ name: "internalid", label: "Internal ID" })
                                ]
                        });
                        var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
                        log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count", searchResultCount);
                        if (searchResultCount > 0) {
                            var resultRange = customrecord_zastro_unconsolidated_itemsSearchObj.getRange({
                                start: 0,
                                end: 1
                            });
                            var consolRecord = resultRange[0].getValue({
                                name: 'internalid'
                            });
                            log.debug('console_id', consolRecord);
                            var loadConsol = record.submitFields({
                                type: 'customrecord_zastro_unconsolidated_items',
                                id: consolRecord,
                                values: {
                                    //Custom field = "Quantity"
                                    custrecord_zastro_qty: quantity
                                },
                            });
                            loadSO.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pr_qty_changed',
                                value: false
                            });
                            loadSO.commitLine({
                                sublistId: 'item',
                            });
                        }
                    }
                }
                var saveSO = loadSO.save();
                log.debug('so_saved', saveSO);
            }
        }
        return {
            //        beforeLoad: beforeLoad,
            //beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };
    });