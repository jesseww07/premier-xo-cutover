/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util', 'N/runtime', 'N/task'],
/**
 * @param {log} log
 * @param {record} record
 * @param {search} search
 * @param {util} util
 */
function(log, record, search, util, runtime, task) {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */

    function execute(scriptContext) {
        var scriptObj = runtime.getCurrentScript();
        var remainingUsage = 10000;
        var item = record.load({type: 'inventoryitem', id: 767474});
        regularPrice = 4.99;
        var price_sublist = 'price1';
        item.selectLineItem(price_sublist, '1'); // Price Level
        item.setCurrentLineItemMatrixValue(price_sublist, 'price', 1, regularPrice); // First Qty break
        item.setCurrentLineItemMatrixValue(price_sublist, 'price_1_', 1, regularPrice); // First Qty break
        item.commitLineItem(price_sublist);

        item.save();

        return true;


    }


    return {
        execute: execute
    };
    
});
