/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord'], function(currentRecord) {

    function pageInit(context){}
    function selectAllCheckboxes() {
        var rec = currentRecord.get();
        var lineCount = rec.getLineCount({ sublistId: 'sublist' }); // Replace with your actual sublist ID

        for (var i = 0; i < lineCount; i++) {
            rec.selectLine({ sublistId: 'sublist', line: i });
            rec.setCurrentSublistValue({
                sublistId: 'sublist',
                fieldId: 'custpage_select',
                value: true
            });
            rec.commitLine({ sublistId: 'sublist' });
        }
    }

    function confirmAllCheckboxes() {
        var rec = currentRecord.get();
        var lineCount = rec.getLineCount({ sublistId: 'sublist' });

        for (var i = 0; i < lineCount; i++) {
            rec.selectLine({ sublistId: 'sublist', line: i });
            rec.setCurrentSublistValue({
                sublistId: 'sublist',
                fieldId: 'custpage_confirmed',
                value: true
            });
            rec.commitLine({ sublistId: 'sublist' });
        }
    }

    return {
        pageInit: pageInit,
        selectAllCheckboxes: selectAllCheckboxes,
        confirmAllCheckboxes: confirmAllCheckboxes
    };
});
