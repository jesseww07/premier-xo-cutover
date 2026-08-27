/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/currentRecord'], function (currentRecord) {
    function pageInit(context) {
        var currentRec = context.currentRecord;
        var selectedLines = JSON.parse(sessionStorage.getItem('selectedLines')) || {};

        for (var line in selectedLines) {
            if (selectedLines.hasOwnProperty(line)) {
                currentRec.selectLine({ sublistId: 'sublist', line: parseInt(line) });
                currentRec.setCurrentSublistValue({ sublistId: 'sublist', fieldId: 'custpage_selected', value: true });
                currentRec.commitLine({ sublistId: 'sublist' });
            }
        }
    }

    function fieldChanged(context) {
        if (context.fieldId === 'custpage_selected') {
            var currentRec = context.currentRecord;
            var line = context.line;
            var selectedLines = JSON.parse(sessionStorage.getItem('selectedLines')) || {};

            if (currentRec.getCurrentSublistValue({ sublistId: 'sublist', fieldId: 'custpage_selected' })) {
                selectedLines[line] = true;
            } else {
                delete selectedLines[line];
            }

            sessionStorage.setItem('selectedLines', JSON.stringify(selectedLines));
        }
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged
    };
});
