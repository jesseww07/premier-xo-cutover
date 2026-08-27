/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 *
 * ONE-TIME USE: Updates custrecord_vendor_select_sl on all active
 * customrecord_consolidated_vendor_select records to use the correct
 * internal app.netsuite.com URL instead of extforms.
 *
 * After running, set deployment status to "Not Scheduled" to prevent re-runs.
 */
define(['N/record', 'N/search', 'N/runtime', 'N/log'], function (record, search, runtime, log) {

    function execute() {
        const isSandbox = runtime.envType !== runtime.EnvType.PRODUCTION;
        const domain    = isSandbox
            ? 'https://7513000-sb1.app.netsuite.com'
            : 'https://7513000.app.netsuite.com';

        const BASE_URL = domain
            + '/app/site/hosting/scriptlet.nl'
            + '?script=customscript_illuminet_generate_master_p'
            + '&deploy=customdeploy_illuminet_generate_master_p'
            + '&custom_id=';

        log.debug('Starting SL URL update', 'Environment: ' + (isSandbox ? 'Sandbox' : 'Production') + ' | Base: ' + BASE_URL);

        let updated = 0;
        let skipped = 0;
        let errors  = 0;

        try {
            var vendorSearch = search.create({
                type:    'customrecord_consolidated_vendor_select',
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    ['custrecord_vendor_select_vendor', 'isnotempty', '']
                ],
                columns: ['internalid', 'custrecord_vendor_select_vendor']
            });

            vendorSearch.run().each(function (result) {
                // Check governance — bail out with 500 units remaining to be safe
                var remaining = runtime.getCurrentScript().getRemainingUsage();
                if (remaining < 500) {
                    log.error('Governance limit approaching', 'Stopping at record ' + result.getValue('internalid') + ' with ' + remaining + ' units remaining. Re-run to continue.');
                    return false; // stop iteration
                }

                var recId    = result.getValue('internalid');
                var vendorId = result.getValue('custrecord_vendor_select_vendor');

                if (!vendorId) {
                    log.debug('Skipping record ' + recId, 'No vendor ID');
                    skipped++;
                    return true;
                }

                try {
                    var rec    = record.load({
                        type: 'customrecord_consolidated_vendor_select',
                        id:   recId
                    });
                    var newUrl = BASE_URL + vendorId;
                    rec.setValue({ fieldId: 'custrecord_vendor_select_sl', value: newUrl });
                    rec.save({ ignoreMandatoryFields: true });
                    log.debug('Updated record ' + recId, newUrl);
                    updated++;
                } catch (e) {
                    log.error('Failed on record ' + recId, e.message);
                    errors++;
                }

                return true;
            });

        } catch (e) {
            log.error('execute error', e.message);
        }

        log.audit('SL URL Update Complete', 'Updated: ' + updated + ' | Skipped: ' + skipped + ' | Errors: ' + errors);
    }

    return { execute };
});