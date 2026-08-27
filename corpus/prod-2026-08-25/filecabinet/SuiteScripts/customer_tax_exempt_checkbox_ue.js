/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
define(['N/record', 'N/log'], function(record, log) {

    function afterSubmit(context) {
        // Only run on Create or Edit to avoid unnecessary overhead
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        var customer = context.newRecord;
        var customerId = customer.id;
        var taxExempt = false;

        try {
            var lineCount = customer.getLineCount({ sublistId: 'taxregistration' });
            log.debug('AfterSubmit Check', 'Customer ID: ' + customerId + ' | Line Count: ' + lineCount);

            for (var i = 0; i < lineCount; i++) {
                var exemptStatus = customer.getSublistValue({
                    sublistId: 'taxregistration',
                    fieldId: 'custpage_taxreg_entityexemptstatus',
                    line: i
                });

                log.debug('Line ' + i, 'Status: ' + exemptStatus);

                if (exemptStatus === 'T' || exemptStatus === true) {
                    taxExempt = true;
                    break;
                }
            }

            // Update the record field explicitly
            record.submitFields({
                type: record.Type.CUSTOMER,
                id: customerId,
                values: {
                    'custentity_tax_exempt_checkbox': taxExempt
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.debug('Success', 'Updated Tax Exempt Checkbox to: ' + taxExempt);

        } catch (e) {
            log.error('Error in afterSubmit', e.message);
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});