/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * 
 * Script: Rename Purchase Order for Specials
 * Purpose: Prepends "IPO" or "DSPO" to PO numbers when created from Sales Orders
 * 
 * UPDATED: Added duplicate tranid check to prevent issues when an IPO number
 * already exists (e.g., from manual creation). If the target IPO number is 
 * already in use, the script will skip renaming and log an audit message.
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {
    var exports = {};

    // Vendor IDs to exclude from renaming
    const EXCLUDED_VENDORS = [
        "2731", "2732", "18154", "2733", "2734", "2735", "20669",
        "2736", "19693", "18312", "2737", "2738", "20684", "2739",
        "2740", "2741", "2742", "2743", "24564", "2744", "2745", "19218"
    ];

    /**
     * Checks if a PO with the given tranid already exists
     * @param {string} tranid - The transaction ID to check
     * @returns {boolean} - True if tranid already exists
     */
    function tranidExists(tranid) {
        var existingPO = search.create({
            type: search.Type.PURCHASE_ORDER,
            filters: [
                ['tranid', 'is', tranid],
                'AND',
                ['mainline', 'is', 'T']
            ],
            columns: ['internalid']
        }).run().getRange({ start: 0, end: 1 });

        return existingPO.length > 0;
    }

    function afterSubmit(context) {
        try {
            var curLoad = context.newRecord;

            if (!curLoad.id) {
                return;
            }

            var thisRecord = record.load({
                type: curLoad.type,
                id: curLoad.id,
                isDynamic: true
            });

            log.debug('current_record', curLoad.id);

            var tranNum = thisRecord.getValue({ fieldId: 'tranid' });
            var vendorId = thisRecord.getValue({ fieldId: 'entity' });

            // Skip excluded vendors
            if (EXCLUDED_VENDORS.indexOf(String(vendorId)) !== -1) {
                log.debug('Skipped - Excluded Vendor', 'Vendor ID: ' + vendorId);
                return;
            }

            // Skip if already processed
            var autoRun = thisRecord.getValue({ fieldId: 'custbody_po_auto_ran' });
            if (autoRun === true) {
                log.debug('Skipped - Already Processed', 'custbody_po_auto_ran is true');
                return;
            }

            // Skip if automation disabled
            var disable = thisRecord.getValue({ fieldId: 'custbody_disable_automation' });
            if (disable === true) {
                log.debug('Skipped - Automation Disabled', 'custbody_disable_automation is true');
                return;
            }

            var createdFrom = thisRecord.getValue({ fieldId: 'createdfrom' });
            var custForm = thisRecord.getValue({ fieldId: 'customform' });

            log.debug('createdFrom', createdFrom);

            if (!createdFrom) {
                log.debug('Skipped - No Created From', 'PO was not created from another transaction');
                return;
            }

            // Determine the new name based on custom form
            var newName;
            if (custForm == '168' || custForm == 168) {
                newName = 'DSPO' + tranNum;
            } else {
                newName = 'IPO' + tranNum;
            }

            // NEW: Check if the target tranid already exists
            if (tranidExists(newName)) {
                log.audit('Skipped Rename - Duplicate', 
                    'Cannot rename PO ' + curLoad.id + ' to "' + newName + '" because that tranid already exists. ' +
                    'Original tranid "' + tranNum + '" will be preserved.');
                
                // Still mark as processed to prevent repeated attempts
                thisRecord.setValue({
                    fieldId: 'custbody_po_auto_ran',
                    value: true
                });
                thisRecord.save();
                return;
            }

            log.debug('new_name', newName);

            thisRecord.setValue({
                fieldId: 'tranid',
                value: newName
            });
            thisRecord.setValue({
                fieldId: 'custbody_po_auto_ran',
                value: true
            });

            thisRecord.save();

            log.audit('PO Renamed Successfully', 'PO ' + curLoad.id + ': ' + tranNum + ' → ' + newName);

        } catch (e) {
            log.error('Error in afterSubmit', e);
        }
    }

    exports.afterSubmit = afterSubmit;
    return exports;
});