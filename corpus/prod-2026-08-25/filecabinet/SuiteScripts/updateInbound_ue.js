/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * Deployed on: Inbound Shipment
 * Event:       beforeLoad
 *
 * Adds the "Adjustment" button that opens the pricing Suitelet.
 * FIX: Removed the redundant record.load() inside beforeLoad —
 *      context.newRecord already has the record data. The load was
 *      wasting 10 governance units on every Inbound Shipment page view.
 */
define(['N/log'], function (log) {

    function beforeLoad(context) {
        try {
            // Only show the button when viewing an existing record
            if (!context.newRecord.id) {
                return;
            }

            // context.type values: VIEW, EDIT, COPY, CREATE, PRINT, EMAIL, etc.
            // Only add the button in VIEW and EDIT modes — not needed on COPY/CREATE
            const allowedTypes = [
                context.UserEventType.VIEW,
                context.UserEventType.EDIT
            ];
            if (!allowedTypes.includes(context.type)) {
                return;
            }

            context.form.addButton({
                id: 'custpage_pricing',
                label: 'Adjustment',
                functionName: 'openSuitelet'
            });

            context.form.clientScriptModulePath = 'SuiteScripts/updateInbound_cl.js';

            log.debug('beforeLoad', `Adjustment button added for Inbound Shipment ID: ${context.newRecord.id}`);

        } catch (e) {
            log.error('beforeLoad Error', e.message);
        }
    }

    return { beforeLoad };
});