/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
 define(['N/log'], function (log) {
    function lineInit(context) {

        let currentRecord = context.currentRecord;
      var form = currentRecord.getValue({fieldId:'customform'})
      log.debug('form',form)
      if(form == 174 || form == '174'){
         log.debug('EXITING',form)
        return
      }
        let sublistId = context.sublistId;
        log.debug('sublistId', sublistId);

        // Ensure the script only runs for the 'item' sublist
        if (sublistId !== 'item') return;

        // Fields to disable
        let fieldsToDisable = [
            'custcol_zastro_unconsolidated_item'
        ];

        // Get the lot number for the current line
           let lineVendor = currentRecord.getCurrentSublistText({
            sublistId: 'item',
            fieldId: 'custcolcustcol_zastro_vendor',
        });
     

        log.debug('lineVendor', lineVendor);

        // If a lot number exists, disable specific fields
        fieldsToDisable.forEach(function (fieldId) {
          if(lineVendor){
              if (lineVendor.startsWith('PREMCOL')) {
                try {
                    currentRecord.getCurrentSublistField({
                        sublistId: 'item',
                        fieldId: fieldId,
                    }).isDisabled = true;
                } catch (e) {
                    log.error(
                        'Error disabling field',
                        `Field ID: ${fieldId} | Error: ${e.message}`
                    );
                }
            } else {
                try {
                    currentRecord.getCurrentSublistField({
                        sublistId: 'item',
                        fieldId: fieldId,
                    }).isDisabled = false;
                } catch (e) {
                    log.error(
                        'Error enabling field',
                        `Field ID: ${fieldId} | Error: ${e.message}`
                    );
                }
            }
          }
          
        });
    }

    return {
        lineInit: lineInit,
    };
});
