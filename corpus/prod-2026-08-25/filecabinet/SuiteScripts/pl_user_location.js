/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {ui} ui
     * @param {dialog} dialog
     * @param {runtime} runtime
     */
    function (record, search, ui, dialog, runtime) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(context) {
            try {
                var salesOrd = context.newRecord

                var id = salesOrd.id
                log.debug('id', id)

                var currentUser = runtime.getCurrentUser();
                log.debug('currentUser', currentUser)

                var userLocation = currentUser.location
                log.debug('userLocation', userLocation)

                salesOrd.setValue({
                    fieldId: 'custbody_pl_ordered_from_location',
                    value: userLocation,
                })
                var value = salesOrd.getValue({
 fieldId: 'custbody_pl_ordered_from_location'
});
              log.debug('value', value)
            }
            catch (e) {
                log.debug('failure in eaches', e)
            }
        }
        return {
            onAction: onAction
        };

    });