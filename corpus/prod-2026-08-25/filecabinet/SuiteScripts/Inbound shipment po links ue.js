/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * @description Adds clickable PO hyperlinks to Inbound Shipment Items sublist in View mode
 *              Runs beforeLoad to modify the sublist display before rendering
 * @author Premier Lighting
 */
define(['N/record', 'N/ui/serverWidget', 'N/runtime'], function(record, serverWidget, runtime) {

    /**
     * beforeLoad entry point
     * @param {Object} context
     * @param {Record} context.newRecord - The record being loaded
     * @param {string} context.type - The trigger type (view, edit, create, etc.)
     * @param {Form} context.form - The form object
     */
    function beforeLoad(context) {
        log.debug('PO Links UE', 'beforeLoad triggered - type: ' + context.type);
        
        // Only run in View mode
        if (context.type !== context.UserEventType.VIEW) {
            log.debug('PO Links UE', 'Not VIEW mode, exiting');
            return;
        }

        try {
            var form = context.form;
            var rec = context.newRecord;
            
            log.debug('PO Links UE', 'Processing Inbound Shipment ID: ' + rec.id);

            // Get the items sublist
            var sublist = form.getSublist({ id: 'items' });
            if (!sublist) {
                log.error('PO Links UE', 'Items sublist not found on form');
                return;
            }
            
            log.debug('PO Links UE', 'Found items sublist');

            // Add a new column for the clickable PO link using URL type
            var poLinkField = sublist.addField({
                id: 'custpage_po_hyperlink',
                type: serverWidget.FieldType.URL,
                label: 'PO Link'
            });
            
            // Set link text to display
            poLinkField.linkText = 'View PO';
            
            log.debug('PO Links UE', 'Added custpage_po_hyperlink field');

            // Get line count
            var lineCount = rec.getLineCount({ sublistId: 'items' });
            log.debug('PO Links UE', 'Line count: ' + lineCount);

            if (lineCount <= 0) {
                log.debug('PO Links UE', 'No lines to process');
                return;
            }

            // Loop through lines and set the hyperlink
            for (var i = 0; i < lineCount; i++) {
                var poId = rec.getSublistValue({
                    sublistId: 'items',
                    fieldId: 'purchaseorder',
                    line: i
                });
                
                var poText = rec.getSublistText({
                    sublistId: 'items',
                    fieldId: 'purchaseorder',
                    line: i
                });

                log.debug('PO Links UE', 'Line ' + i + ': poId=' + poId + ', poText=' + poText);

                if (poId) {
                    // Build the PO URL - use relative URL for flexibility
                    var poUrl = '/app/accounting/transactions/purchord.nl?id=' + poId;
                    
                    // Set the URL value on the custom column
                    sublist.setSublistValue({
                        id: 'custpage_po_hyperlink',
                        line: i,
                        value: poUrl
                    });
                    
                    log.debug('PO Links UE', 'Set URL for line ' + i + ': ' + poUrl);
                }
            }

            log.debug('PO Links UE', 'Completed successfully');

        } catch (e) {
            log.error('PO Links UE Error', 'Message: ' + e.message + ' | Stack: ' + e.stack);
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});