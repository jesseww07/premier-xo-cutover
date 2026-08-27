/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], function (record, log) {

    function afterSubmit(context) {
        try {
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                return;
            }

            const remove = context.newRecord.getValue('custrecord_mli_remove_from_queue');
            if (!remove) return;

            const recordId = context.newRecord.id;
            log.debug('Kill Queue UE - inactivating record', recordId);

            var custRec = record.load({
                type: 'customrecord_consolidated_special_order',
                id:   recordId
            });
            custRec.setValue({ fieldId: 'isinactive',                             value: true });
            custRec.setValue({ fieldId: 'custrecord_special_consolidated_linked', value: true });
            var saved = custRec.save();
            log.debug('Kill Queue UE - record inactivated', saved);

        } catch (e) {
            log.error('Error in afterSubmit', e.message);
        }
    }

    return { afterSubmit };
});