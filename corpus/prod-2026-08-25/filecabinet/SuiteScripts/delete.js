/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {runtime} runtime
     * @param {log} log
     */
    function(record, search, runtime, log) {
        function getInputData() {
            // Loading the saved search as the data source
            return search.load({
                id: 'customsearch_la_record_delete'
            });
        }
        function map(context) {
            let result = JSON.parse(context.value);
            // Pass the Internal ID as the key to the Reduce stage
            // This ensures all instances of this ID are grouped together
            context.write({
                key: result.id,
                value: result.id
            });
        }
        function reduce(context) {
            let recordId = context.key;
            try {
                record.delete({
                    type: 'customrecord_zastro_lights_items',
                    id: recordId,
                });
                log.audit('Success', 'Deleted record: ' + recordId);
            } catch (e) {
                // Handle cases where the record might have been deleted by another process
                if (e.name === 'RCRD_DSNT_EXIST') {
                    log.audit('Skipped', 'Record ' + recordId + ' already deleted.');
                } else {
                    log.error('Delete Error', 'ID: ' + recordId + ' - ' + e.message);
                }
            }
        }
        function summarize(summary) {
            summary.mapSummary.errors.iterator().each(function(key, error) {
                log.error('Map Error for key: ' + key, error);
                return true;
            });
            summary.reduceSummary.errors.iterator().each(function(key, error) {
                log.error('Reduce Error for key: ' + key, error);
                return true;
            });
        }
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });