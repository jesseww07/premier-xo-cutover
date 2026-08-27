/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
 define(['N/record'], function (record) {
    function onAction(context) {
        var currentRecord = context.newRecord;
        var sublistName = 'item'; // Adjust if necessary
        var fieldId = 'custcol_zastro_unconsolidated_item'; // Replace with the actual field ID

        var lineCount = currentRecord.getLineCount({ sublistId: sublistName });
        
        for (var i = 0; i < lineCount; i++) {
            currentRecord.selectLine({ sublistId: sublistName, line: i });
            var itemType = currentRecord.getCurrentSublistValue({
                sublistId: sublistName,
                fieldId: 'itemtype'
            });
            var prefVendor = currentRecord.getCurrentSublistText({
                sublistId: sublistName,
                fieldId: 'custcolcustcol_zastro_vendor'
            });
            var block = false
            if(prefVendor.startsWith('PREMCOL')){
                block = true
            }
            if(itemType == 'InvtPart' && !block){
                currentRecord.setCurrentSublistValue({
                    sublistId: sublistName,
                    fieldId: fieldId,
                    value: true
                });
                currentRecord.commitLine({ sublistId: sublistName });
            }
            else{
                log.debug('BLOCKED', prefVendor + '-' + itemType)
            }
        }
    }
    
    return {
        onAction: onAction
    };
});