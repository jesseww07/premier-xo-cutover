/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search'], function (record, search) {

    function getInputData() {
        var mySearch = search.load({
            id: 'customsearch_pr_update_consol_fields'
        })
        return mySearch
    }

    function map(context) {
        var result = JSON.parse(context.value);
        var recordId = result.id;
        var fieldValue = result.values.field_to_copy;

        try {
            var rec = record.load({
                type: 'customrecord_consolidated_vendor_select',
                id: recordId,
            });

            var unordered = rec.getValue({
                fieldId: 'custrecord_unordered_totals'
            });
            rec.setValue({
                fieldId: 'custrecord_unordered_totals_stored', // Replace with actual field ID
                value: unordered
            });
               var unorderedRetail = rec.getValue({
                fieldId: 'custrecord_pl_unordered_retail'
            });
            rec.setValue({
                fieldId: 'custrecord_pl_unordered_retail_stored', // Replace with actual field ID
                value: unorderedRetail
            });
               var unorderedCommercial = rec.getValue({
                fieldId: 'custrecord_pl_unordered_commercial'
            });
            rec.setValue({
                fieldId: 'custrecord_pl_unordered_commercial_store', // Replace with actual field ID
                value: unorderedCommercial
            });
            var nonStored = rec.getValue({ fieldId: 'custrecord16' }); // Free-Form Text Field
            if (!nonStored) {
                rec.setValue({ fieldId: 'custrecord15', value: null });
                log.debug('Record Updated', 'custrecord15 set to: ' + 'NULL');

            } else {
                var parsedDate = convertToDate(nonStored);
                if (parsedDate) {
                    rec.setValue({ fieldId: 'custrecord15', value: parsedDate });
                    log.debug('Record Updated', 'custrecord15 set to: ' + parsedDate);
                } else {
                    log.error('Date Conversion Failed', 'Invalid date format: ' + nonStored);
                }
            }

            rec.save();
        } catch (e) {
            log.error({ title: 'Error updating record', details: e });
        }
    }

    function reduce(context) { }

    function summarize(summary) {
        log.audit({ title: 'Map/Reduce Summary', details: summary });
    }

    function convertToDate(dateStr) {
        try {
            return new Date(dateStr); // Convert string to Date object
        } catch (e) {
            log.error('Date Parsing Error', 'Invalid date: ' + dateStr);
            return null;
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        // reduce: reduce,
        // summarize: summarize
    };
});
