/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {util} util
     */
    function (log, record, search, util) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(context) {

            search.load({
                id: 'customsearch627'
            }).run().each(function (context) {
                log.debug(context)
                var internalId = context.id
                log.debug('internalid', internalId)
                var deliveryRec = record.load({
                    type: 'customrecord_stored_inventory_contents',
                    id: internalId,
                    isDynamic: true
                });
                deliveryRec.setValue({
                    fieldId:'custrecord_delivered',
                    value:false
                })
                deliveryRec.setValue({
                    fieldId:'custrecord_date_delivered',
                    value:null
                })
                deliveryRec.save()
                return true
            })
        }


        return {
            execute: execute
        };

    });
