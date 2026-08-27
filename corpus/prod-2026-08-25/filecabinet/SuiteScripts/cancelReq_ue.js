/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/log'], function(log) {

  /**
   * beforeSubmit event handler.
   * This function iterates through the item sublist on a Sales Order.
   * If the field "createpo" equals 'SpecOrd' and "custcol_zas_linked_so_rec" is not null/empty,
   * then it retrieves additional values (item, quantity, and the sales order internal id)
   * and sets the field "custcol_pl_so_cancelreq" to a Suitelet URL that includes those values as parameters.
   *
   * @param {Object} context - The context object containing the new record.
   */
  function beforeSubmit(context) {
    var soRecord = context.newRecord;
    var lineCount = soRecord.getLineCount({ sublistId: 'item' });
    log.debug('lineCount', lineCount);

    // Retrieve the sales order internal id.
    // Note: For a new record, the id may not be available until after submission.
    var soId = soRecord.id;
    log.debug('Sales Order ID', soId);

    // Iterate over each line in the "item" sublist
    for (var i = 0; i < lineCount; i++) {
      // Get the value from the createpo field on this line
      var createpoValue = soRecord.getSublistValue({
        sublistId: 'item',
        fieldId: 'createpo',
        line: i
      });
      log.debug('createpoValue on line ' + i, createpoValue);

      // Get the value from the custcol_zas_linked_so_rec field on this line
      var linkedSOValue = soRecord.getSublistValue({
        sublistId: 'item',
        fieldId: 'custcol_zas_linked_so_rec',
        line: i
      });
      log.debug('linkedSOValue on line ' + i, linkedSOValue);

      // Check if createpoValue equals 'SpecOrd' and linkedSOValue is not null/empty.
      if (createpoValue === 'SpecOrd' && linkedSOValue != null && linkedSOValue !== '') {
        log.debug('Line ' + i + ' meets both conditions');
        try {
          // Retrieve additional values: item and quantity from this line
          var itemValue = soRecord.getSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            line: i
          });
          var itemText = soRecord.getSublistText({
              sublistId: 'item',
              fieldId: 'item',
              line: i
            });
          var quantityValue = soRecord.getSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            line: i
          });
          log.debug('Line ' + i + ' itemValue', itemValue);
          log.debug('Line ' + i + ' quantityValue', quantityValue);

          // Build the Suitelet URL with the additional parameters
          var suiteletUrl = 'https://7513000.app.netsuite.com/app/site/hosting/scriptlet.nl?script=2829&deploy=1' +
            '&item=' + encodeURIComponent(itemValue) +
            '&quantity=' + encodeURIComponent(quantityValue) +
            '&cso=' + encodeURIComponent(linkedSOValue) +
            '&itemtext=' + encodeURIComponent(itemText) +
            '&soid=' + encodeURIComponent(soId);
          log.debug('Suitelet URL for line ' + i, suiteletUrl);

          // Set the custcol_pl_so_cancelreq field with the constructed URL
          soRecord.setSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_pl_so_cancelreq',
            line: i,
            value: suiteletUrl
          });
        } catch(e) {
          log.error('Error setting URL on line ' + i, e);
        }
      } else {
        log.debug('Line ' + i + ' does not meet both conditions');
      }
    }
  }

  return {
    beforeSubmit: beforeSubmit
  };

});
