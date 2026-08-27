/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

  function getInputData() {
    // Search Lights records missing SKU
    return search.create({
      type: 'customrecord_zastro_lights_items',
      filters: [
        ['custrecord_lights_sku', 'isempty', ''],
        'AND',
        ['isinactive', 'is', 'F'],
      ],
      columns: [
        'internalid',
        'custrecord_lights_linked_item'
      ]
    });
  }

  function map(context) {
    try {
      const result = JSON.parse(context.value);
      const recId = result.id;
      const linkedItemId = result.values.custrecord_lights_linked_item?.value;

      if (!linkedItemId) {
        log.debug('No linked item for Lights record', recId);
        return;
      }

      log.audit('Deleting linked item', { lightsId: recId, itemId: linkedItemId });

      try {
        record.delete({
          type: record.Type.INVENTORY_ITEM,
          id: linkedItemId
        });
        log.audit('Deleted item', linkedItemId);
      } catch (e) {
        log.error('Failed to delete item', { itemId: linkedItemId, message: e.message });
      }

    } catch (err) {
      log.error('MAP_ERROR', err);
    }
  }

  function reduce(context) { /* not used */ }

  function summarize(summary) {
    log.audit('Script complete', {
      inputSummary: summary.inputSummary,
      mapSummary: summary.mapSummary
    });

    summary.mapSummary.errors.iterator().each((key, error) => {
      log.error('Map Error', { key, error });
      return true;
    });
  }

  return { getInputData, map, reduce, summarize };
});
