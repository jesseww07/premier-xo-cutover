/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
 define(['N/record', 'N/redirect', 'N/log'], function(record, redirect, log) {
    function beforeLoad(context) {
        try {
            // Only execute on View mode
            if (context.type !== context.UserEventType.VIEW) {
                return;
            }

            // Get the current record
            var currentRecord = context.newRecord;

            // Get the value of the custrecord_mli_redirect_to field
            var redirectToId = currentRecord.getValue({
                fieldId: 'custrecord_mli_redirect_to'
            });

            if (redirectToId) {
                log.debug('Redirecting', 'Redirecting to Inbound Shipment ID: ' + redirectToId);

                // Redirect to the Inbound Shipment record
                redirect.toRecord({
                    type: 'inboundshipment',
                    id: redirectToId
                });
            } else {
                log.error('Redirect Failed', 'Field custrecord_mli_redirect_to is empty.');
            }
        } catch (error) {
            log.error('Error in beforeLoad', error);
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
