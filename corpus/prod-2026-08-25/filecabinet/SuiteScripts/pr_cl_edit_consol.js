/**
 * API Version 2.1
 * Wood & Conn Implementation Projects 
 * Support Ticket: 2608
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      3/5/23        Alex Gjorvad                        Client
 * 2.00      4/13/23       Alex Gjorvad     Added toFixed() Javascript
 *                                          method to PO rate to ensure that
 *                                          the rate is rounded to only two decimals.
 *          Script Functionality
 * -This script calculates the Rate field on the line item of the Purchase Order. The script executes 
 * on a user entry of the following fields:  Vendor, Item, PO price level. The script calculates the 
 * PO Rate field by matching the Item + Vendor Purchase Price; located on the Item Card/Purchasing tab/Vendor tab; 
 * multiplied by the PO Price Level Discount field.  If any of the required fields (Item, PO Price Level, Vendor) 
 * are empty, the PO Rate is set to $0.00.
 *
 */
/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/search', 'N/format', 'N/https', 'N/url', 'N/log'],

    function (currentRecord, search, format, https, url, log) {

        /**
         * Function to be executed when field is changed.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.sublistId - Sublist name
         * @param {string} scriptContext.fieldId - Field name
         * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
         * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
         *
         * @since 2015.2
         */
        function fieldChanged(context) {
            var currentRecord = context.currentRecord;
            var sublistName = context.sublistId;
            var sublistFieldName = context.fieldId;
            var line = context.line;
            //If line item field that user is editing is "Quantity"
            if (sublistName === 'item' && sublistFieldName === 'quantity') {
                var consolPO = currentRecord.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_zastro_unconsolidated_no',
                });
                console.log('consolPO', consolPO);
                if (consolPO) {
                    var quantity = currentRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity'
                    });
                    console.log('quantity', quantity);
                    if (quantity && quantity > 0) {
                        currentRecord.selectLine({
                            sublistId: 'item',
                            line: line
                        })
                        currentRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pr_qty_changed',
                            value: true
                        });
                    }
                }
            }
        }

        /**
         * Function to be executed when field is slaved.
         *
         * @param {Object} context
         * @param {Record} context.currentRecord - Current form record
         * @param {string} context.sublistId - Sublist name
         * @param {string} context.fieldId - Field name
         *
         * @since 2015.2
         */
        function validateDelete(context) {
            var currentRecord = context.currentRecord;
            var sublistName = context.sublistId;
            var soId = currentRecord.id;
            log.debug('so_id', soId);
            if (sublistName === 'item') {
                var consolPO = currentRecord.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_zastro_unconsolidated_no',
                });
                log.debug('consolPO', consolPO);
                if (consolPO) {
                    var item = currentRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item'
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
                  log.debug('')
                    if (searchResultCount > 0) {
                        var resultRange = customrecord_zastro_unconsolidated_itemsSearchObj.run().getRange({
                            start: 0,
                            end: 1
                        });
                        var consolRecord = resultRange[0].getValue({
                            name: 'internalid'
                        });
                        log.debug('consol_id', consolRecord);
                    try {
                        record.delete({
                            type: 'customrecord_zastro_unconsolidated_items',
                            id: consolRecord
                        });
                    } catch (e) {
                        log.debug('error_message_on_delete', e.message);
                    }
                    //return true;
                }
            }
        }
        return true;
    }

        return {
            fieldChanged: fieldChanged,
            validateDelete: validateDelete,
        };

    });