/**
 * API Version 2.1
 * Partial Estimate to SO (Premier) 
 * Support Ticket: 2462
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00     12/13/22       Alex Gjorvad                       User Event
 * 
 *          Script Functionality
 * -This script creates a button on the Estimate record.  When clicked, this button opens a suitelet page
 * that allows the user to select which line items from the Estimate to add to a sales order.
 */
/**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
define(['N/record'], function (record) {
    var exports = {};
    function beforeLoad(context) {
        let thisRecord = context.newRecord
        if (thisRecord.id) {
            let loadedRecord = record.load({
                type: thisRecord.type,
                id: thisRecord.id,
                isDynamic: true
            })
            var openLines = false;
            log.debug('thisRecord', thisRecord)
            let form = loadedRecord.getValue('customform')
            log.debug('form', form)
            log.debug({
                title: 'before load triggered',
                details: context.type
            })
            var lineItemCount = loadedRecord.getLineCount({
                sublistId: 'item'
            });
            for (var i = 0; i < lineItemCount; i++) {
                //check to see if line item has already been added to the sales order.
                var movedToSalesOrder = loadedRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pr_moved_to_so',
                    line: i
                });
                log.debug('moved_to_so?', movedToSalesOrder);
                if (movedToSalesOrder == true) {
                    continue;
                } else {
                    openLines = true;
                    break;
                }
            }
            if (openLines == true) {
                //If there are line items remaining on the Estimate that are not on the sales order, then keep the
                //button visible.
                context.form.addButton({
                    id: "custpage_change_line",
                    label: "Create Sales Order",
                    functionName: "openSuitelet"
                });

                context.form.clientScriptModulePath = "SuiteScripts/prCreateSalesOrderCL.js";
            } else {
                return
            }
        }
        else {
            return
        }
    }
    exports.beforeLoad = beforeLoad;
    return exports;
});