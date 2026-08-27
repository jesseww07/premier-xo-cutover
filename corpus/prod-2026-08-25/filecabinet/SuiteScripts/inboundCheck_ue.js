/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record'], function(log, record) {

    /**
     * @param {Object} context
     * @param {Record} context.newRecord - The record that is being processed.
     * @param {Record} context.oldRecord - The record prior to the operation (not used in this case).
     * @param {string} context.type - The type of operation ('create', 'edit', 'delete').
     */
    function afterSubmit(context) {
        try {
            // Get the record object (this is the record being processed)
            var newRecord = context.newRecord;

            // Retrieve the value of the 'inboundshipment' field
            var inboundShipmentValue = newRecord.getValue({
                fieldId: 'inboundshipment'
            });

            // Log the value of the 'inboundshipment' field
            log.debug({
                title: 'Inbound Shipment Value',
                details: inboundShipmentValue
            });
        } catch (error) {
            log.error({
                title: 'Error in afterSubmit',
                details: error.message
            });
        }
    }

    // Return the afterSubmit function as the script entry point
    return {
        afterSubmit: afterSubmit
    };

});
