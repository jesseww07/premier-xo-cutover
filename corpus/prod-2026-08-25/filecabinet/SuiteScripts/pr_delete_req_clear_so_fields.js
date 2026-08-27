/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

 define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    function beforeSubmit(context) {
        log.debug('context.type',context.type)
        if (context.type !== context.UserEventType.DELETE) return;

        const oldRec = context.oldRecord;
        const poId = oldRec.id;
        const soId = oldRec.getValue({ fieldId: 'createdfrom' });
        if (!soId) return;

        try {
            const consolidatedLinks = getLinkedConsolidatedRecords(poId);
            log.debug('consolidatedLinks',consolidatedLinks)
            if (!consolidatedLinks.length) return;

            const soRec = record.load({ type: 'salesorder', id: soId, isDynamic: false });

            consolidatedLinks.forEach(link => {
                const lineIndex = soRec.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'lineuniquekey',
                    value: link.salesOrderLineKey
                });

                if (lineIndex !== -1) {
                    var currentRec =  soRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_zas_linked_so_rec',
                        line: lineIndex
                    });
                    if(Number(currentRec)!=Number(link.id)){
                        log.error('Something to Evaluate People:', `Clearing ${currentRec} off of line ${link.id} on order ${soId}, was expecting ${link.id}`)
                    }
                    soRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_zastro_unconsolidated_item',
                        line: lineIndex,
                        value: false
                    });
                    soRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_special_connected',
                        line: lineIndex,
                        value: false
                    });
                    soRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_zas_linked_so_rec',
                        line: lineIndex,
                        value: ''
                    });
                    log.debug('completed line',link)
                }
            });

            soRec.save({ ignoreMandatoryFields: true });

        } catch (e) {
            log.error('Error during PO delete cleanup', e);
        }
    }

    function getLinkedConsolidatedRecords(poId) {
        const results = [];
        const consSearch = search.create({
            type: 'customrecord_consolidated_special_order',
            filters: [['custrecord_special_consolidated_po', 'anyof', poId]],
            columns: [
                'internalid',
                'custrecord_special_consolidated_key'
            ]
        });

        consSearch.run().each(res => {
            results.push({
                id: res.getValue('internalid'),
                salesOrderLineKey: res.getValue('custrecord_special_consolidated_key')
            });
            return true;
        });

        return results;
    }

    return {
        beforeSubmit
    };
});
