/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function (record, log) {
    function afterSubmit(context) {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        try {
            var newRecord = context.newRecord;
            var consolidatedRef = newRecord.getValue('custrecord_special_consolidated_ref');

            // If custrecord_special_consolidated_ref is already set, no action needed
            if (consolidatedRef) {
                log.debug('Skipping Update', 'custrecord_special_consolidated_ref already set: ' + consolidatedRef);
                return;
            }

            var inboundShipmentId = newRecord.getValue('custrecord_inbound_shipment');
            if (!inboundShipmentId) {
                log.debug('No Inbound Shipment', 'Skipping record update as no inbound shipment exists.');
                return;
            }

            // Load Inbound Shipment Record
            var inboundShipment = record.load({
                type: 'inboundShipment',
                id: inboundShipmentId,
                isDynamic: false
            });

            var externalDocNumber = inboundShipment.getValue('externaldocumentnumber');
            log.debug('Retrieved External Document Number', externalDocNumber);

            if (!externalDocNumber) {
                log.debug('No External Document Number', 'Skipping update since no external document number exists.');
                return;
            }

            // Update and Save the Custom Record
            record.submitFields({
                type: 'customrecord_consolidated_special_order',
                id: newRecord.id,
                values: {
                    custrecord_special_consolidated_ref: externalDocNumber
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.audit('Updated Record', `Updated custrecord_special_consolidated_ref with ${externalDocNumber} for record ID ${newRecord.id}`);

        } catch (error) {
            log.error('Error in afterSubmit', error);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});
