/**
 * JWW_WFA_SetPrelienFlag.js
 *
 * Workflow Action Script — attached to the "Prelien Notice - First Commercial
 * Invoice" workflow on the Invoice record, Trigger Type: After Record Submit.
 *
 * On the first Commercial-class invoice for a jobsite (customer record), flips
 * custentity_prelien_sent to true so the workflow's Alert/Send Email actions
 * never fire again for that jobsite.
 *
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/record', 'N/log'], function (record, log) {

    function onAction(context) {
        var newRecord = context.newRecord;
        var entityId = newRecord.getValue({ fieldId: 'entity' });

        if (!entityId) {
            log.debug({
                title: 'JWW_WFA_SetPrelienFlag',
                details: 'Invoice ' + newRecord.id + ' has no entity - skipping flag update.'
            });
            return;
        }

        try {
            record.submitFields({
                type: record.Type.CUSTOMER,
                id: entityId,
                values: {
                    custentity_prelien_sent: true
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.audit({
                title: 'JWW_WFA_SetPrelienFlag',
                details: 'Set custentity_prelien_sent = true on customer ' + entityId +
                    ' from invoice ' + newRecord.id
            });
        } catch (e) {
            log.error({
                title: 'JWW_WFA_SetPrelienFlag - Failed to update customer ' + entityId,
                details: e
            });
        }
    }

    return {
        onAction: onAction
    };

});
