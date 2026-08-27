/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    function execute() {
        try {
            var results = [];
            search.create({
                type: 'customrecord_consolidated_vendor_select',
                filters: [['isinactive', 'is', 'F']],
                columns: ['internalid', 'custrecord_vendor_select_vendor']
            }).run().each(result => {
                results.push({
                    id:       result.getValue('internalid'),
                    vendorId: result.getValue('custrecord_vendor_select_vendor')
                });
                return true;
            });

            log.debug('Records to update', results.length);

            results.forEach(obj => {
                try {
                    var newUrl = '/app/site/hosting/scriptlet.nl?script=customscript_illuminet_generate_master_p&deploy=customdeploy_illuminet_generate_master_p&custom_id=' + obj.vendorId;
                    record.submitFields({
                        type:   'customrecord_consolidated_vendor_select',
                        id:     obj.id,
                        values: { custrecord_sl: newUrl }  // ← verify the SL field ID
                    });
                    log.debug('Updated', 'Record ' + obj.id + ' → ' + newUrl);
                } catch (e) {
                    log.error('Failed on record ' + obj.id, e.message);
                }
            });

        } catch (e) {
            log.error('execute error', e.message);
        }
    }

    return { execute };
});