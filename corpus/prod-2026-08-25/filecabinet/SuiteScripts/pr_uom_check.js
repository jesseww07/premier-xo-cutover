/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
 define(['N/search', 'N/ui/serverWidget', 'N/log'], (search, ui, log) => {
    function beforeLoad(context) {
      if (context.type === context.UserEventType.CREATE) return;
  
      const shipmentRec = context.newRecord;
      const shipmentId = shipmentRec.id;
  
      const searchResults = [];
  log.debug('in')
      const inboundshipmentSearchObj = search.create({
        type: "inboundshipment",
        filters: [
          ["item.purchaseunit", "noneof", "@NONE@", "1", "2"],
          "AND",
          ["internalid", "anyof", shipmentId]
        ],
        columns: [
          search.createColumn({ name: "internalid", summary: "GROUP" }),
          search.createColumn({ name: "externaldocumentnumber", summary: "GROUP" }),
          search.createColumn({ name: "item", summary: "GROUP" }),
          search.createColumn({ name: "quantityexpected", summary: "SUM" }),
          search.createColumn({ name: "purchaseunit", join: "item", summary: "GROUP" })
        ]
      });
  
      inboundshipmentSearchObj.run().each(result => {
        try {
          const itemId = result.getValue({ name: 'item', summary: 'GROUP' });
          const qtyExpected = parseFloat(result.getValue({ name: 'quantityexpected', summary: 'SUM' })) || 0;
          const unitText = result.getText({ name: 'purchaseunit', join: 'item', summary: 'GROUP' });
  
          const match = unitText && unitText.match(/^(\d+)\s+PACK$/i);
          log.debug('match',match)
          if (match) {
            const multiplier = parseInt(match[1], 10);
            const remainder = qtyExpected % multiplier;
    log.debug('qtyExpected',qtyExpected)
                log.debug('multiplier',multiplier)
                log.debug('remainder',remainder)
            if (remainder !== 0) {
              const message = `Item ${itemId}: Expected qty ${qtyExpected} not divisible by multiplier ${multiplier} ("${unitText}").`;
        
  
              // Optional: Display warning on the UI
              if (context.form) {
                context.form.addField({
                  id: 'custpage_uom_warning',
                  label: '⚠ UoM Validation Warning',
                  type: ui.FieldType.INLINEHTML
                }).defaultValue = `<div style="color:red;"><b>${message}</b></div>`;
              }
            }
          }
        } catch (e) {
          log.error('Error validating line', e);
        }
        return true;
      });
    }
  
    return { beforeLoad };
  });
  