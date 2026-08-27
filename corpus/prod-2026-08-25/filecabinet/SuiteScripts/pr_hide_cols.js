/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
 define(['N/record', 'N/runtime', 'N/ui/serverWidget', 'N/log'], function (record, runtime, serverWidget, log) {

    function beforeLoad(context) {
        let form = context.form;
        let currentUser = runtime.getCurrentUser();
        let excludedUserIds = [5, 8, 17473, 19, 39, 26, 19209];
        

        // If the current user is in the excluded list, do nothing
        if (excludedUserIds.includes(currentUser.id)) {
            log.debug('User excluded from field hiding', { userId: currentUser.id });
            return;
        }

        // Array of column fields to hide
        let columnsToHide = [
            'options',
            // 'amount',
            // 'quantity',
            'custcol_zas_unique_key',
            'custcol_zas_trigger_sch_po',
            'custcol_la_item_link',
            'custcol_self_id',
            'createpo',
            'custcol_pl_so_cancelreq',
            'custcol_zas_linked_so_rec'
        ];

        try {
            let sublist = form.getSublist({ id: 'item' });
            if (sublist) {
                columnsToHide.forEach(fieldId => {
                    let field = sublist.getField({ id: fieldId });
                    if (field) {
                        field.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                    }
                });
                log.debug('Fields have been hidden for user', { userId: currentUser.id });
            }
        } catch (error) {
            log.error('Error hiding sublist fields', error);
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
