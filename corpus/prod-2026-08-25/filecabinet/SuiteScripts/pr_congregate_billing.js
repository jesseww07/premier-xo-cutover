/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
 define(['N/record', 'N/log'], function (record, log) {
    function beforeSubmit(context) {
      try{
          if (context.type === context.UserEventType.DELETE){
            return;
          } 

        var poRecord = context.newRecord;
        var inboundLinks = new Set(); // Using a Set to ensure uniqueness
        var inboundTexts = new Set();
        var lineCount = poRecord.getLineCount({ sublistId: 'item' });

        for (var i = 0; i < lineCount; i++) {
            var inboundValue = poRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_pr_inbound_link',
                line: i
            });

            if (inboundValue) {
                inboundLinks.add(inboundValue);
            }
            var inboundText = poRecord.getSublistText({
                sublistId: 'item',
                fieldId: 'custcol_pr_inbound_link',
                line: i
            });
        
            if (inboundText) {
                inboundTexts.add(inboundText);
            }
        }

        // Convert Set back to an Array for multi-select field

        var uniqueInboundArray = Array.from(inboundLinks);
        var uniqueInboundString = Array.from(inboundTexts).join(',');
        log.debug('uniqueInboundString', uniqueInboundString);
        log.debug('uniqueInboundArray',uniqueInboundArray)

        // Update the multi-select field
        poRecord.setValue({
            fieldId: 'custbody_zas_affiliated_inbounds',
            value: uniqueInboundArray
        });
        poRecord.setValue({
            fieldId: 'custbody_po_inb_present',
            value: uniqueInboundString
        });
      }
      catch(e){
        log.error('e',e)
      }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
