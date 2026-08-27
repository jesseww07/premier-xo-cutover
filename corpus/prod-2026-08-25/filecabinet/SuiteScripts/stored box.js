/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

define(['N/record', 'N/log'], function(record, log) {

  function afterSubmit(context) {
    var salesOrder = context.newRecord;

    try {
      // Check if this is a create event
      if (context.type !== context.UserEventType.CREATE) {
        return;
      }

      var locationId = salesOrder.getValue({ fieldId: 'location' });
      log.debug('Sales Order Location', locationId);

      // Only proceed if the location is "Stored Inventory" (internal ID 9)
      if (locationId != 9) {
        return;
      }

      var customerId = salesOrder.getValue({ fieldId: 'entity' });
      if (!customerId) {
        log.debug('No customer found on Sales Order.');
        return;
      }

      log.debug('Updating customer', customerId);

      // Load the customer record and update the checkbox
      var customerRecord = record.load({
        type: record.Type.CUSTOMER,
        id: customerId,
        isDynamic: false
      });

      var alreadyChecked = customerRecord.getValue('custentity_stored_customer');
      if (!alreadyChecked) {
         customerRecord.setValue({
          fieldId: 'custentity_stored_customer',
          value: true
           });
           }


      customerRecord.save({
        ignoreMandatoryFields: true
      });

      log.debug('Customer updated with stored inventory flag.');

    } catch (e) {
      log.error('Error updating customer record for stored inventory flag', e);
    }
  }

  return {
    afterSubmit: afterSubmit
  };

});
