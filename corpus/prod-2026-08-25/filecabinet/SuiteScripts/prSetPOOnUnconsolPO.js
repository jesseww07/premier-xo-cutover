/**
 * API Version 2.1
 * Generating PO Issues
 * Ticket 3397
 * 
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      2/13/24       Alex Gjorvad                       Scheduled
 * 
 *          Script Functionality
 * This script sets the PO # field (custrecord_zastro_po_no) and/or the Consolidated checkbox (custrecord_zastro_is_consolidated)
 * on the Unconsolidate Purchase Order record (customrecord_zastro_po_consolid) if either field was not set when the "Generate PO"
 * button was clicked on the Unconsolidated Purchase Order record.  This occurred on multiple occasions on 2/9/24 and was the
 * impetus for this script.
 */
/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {util} util
     */
    function (log, record, search, util) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(context) {
            //Name of search: Zastro - Set PO on Unconsolidated PO Record (Do Not Delete)
            //ID: customsearch1143
            var purchaseorderSearchObj = search.load({ id: "1143", type: "transaction" });
            purchaseorderSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                log.debug('result', JSON.stringify(result));
                var unconsolidatedPO = result.getValue({
                    name: 'custbody_zastro_po_source',
                });
                var loadUnconsolidated = record.load({
                    type: 'customrecord_zastro_po_consolid',
                    id: unconsolidatedPO,
                    isDynamic: true
                });
                var poNumber = loadUnconsolidated.getValue({
                    fieldId: 'custrecord_zastro_po_no'
                });
                log.debug('po_number', poNumber);
                if (!poNumber) {
                    var poId = result.getValue({
                        name: 'internalid',
                    });
                    log.debug('po_id', poId);
                    loadUnconsolidated.setValue({
                        fieldId: 'custrecord_zastro_po_no',
                        value: poId
                    });
                }
                var consolidated = loadUnconsolidated.getValue({
                    fieldId: 'custrecord_zastro_is_consolidated'
                });
                if (!consolidated) {
                    loadUnconsolidated.setValue({
                        fieldId: 'custrecord_zastro_is_consolidated',
                        value: true
                    })
                }
                var saveUnconsolidated = loadUnconsolidated.save();
                log.debug('unconsolidated_PO_was_saved', saveUnconsolidated);
                return true;
            });

        }



        return {
            execute: execute
        };

    });