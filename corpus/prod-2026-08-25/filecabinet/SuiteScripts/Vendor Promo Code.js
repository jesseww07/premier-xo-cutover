/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/search', 'N/log'], (record, search, log) => {
  
  const DISCOUNT_ITEM_ID = 1352036;

  function beforeSubmit(context) {
    if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) return;

    const po = context.newRecord;
    const vendorId = po.getValue({ fieldId: 'entity' });
    const promoCode = po.getValue({ fieldId: 'custbody_vendor_promo_code' });

    if (!promoCode || !vendorId) return;

    // Search for matching promo
    const promoSearch = search.create({
      type: 'customrecord_vendor_promo_code',
      filters: [
        ['custrecord_vendorpromo_code', 'is', promoCode],
        'AND',
        ['custrecord_vendorpromo_vendor', 'anyof', vendorId],
        'AND',
        ['custrecord_vendorpromo_active', 'is', true],
        'AND',
        [
          ['custrecord_vendorpromo_start', 'onorbefore', 'today'], 'OR', ['custrecord_vendorpromo_start', 'isempty', null]
        ],
        'AND',
        [
          ['custrecord_vendorpromo_end', 'onorafter', 'today'], 'OR', ['custrecord_vendorpromo_end', 'isempty', null]
        ]
      ],
      columns: [
        'custrecord_vendorpromo_discount',
        'custrecord_vendorpromo_minpurchase'
      ]
    });

    const promoResult = promoSearch.run().getRange({ start: 0, end: 1 })[0];
    if (!promoResult) {
      log.audit('Promo Code', `No matching promo for code "${promoCode}" and vendor ${vendorId}`);
      return;
    }

    const discountPct = parseFloat(promoResult.getValue('custrecord_vendorpromo_discount')) || 0;
    const minPurchase = parseFloat(promoResult.getValue('custrecord_vendorpromo_minpurchase')) || 0;
    
    // Calculate PO total
    const lineCount = po.getLineCount({ sublistId: 'item' });
    let subtotal = 0;

    for (let i = 0; i < lineCount; i++) {
      const amount = parseFloat(po.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i })) || 0;
      const itemType = po.getSublistValue({ sublistId: 'item', fieldId: 'itemtype', line: i });

      if (itemType !== 'Discount') {
        subtotal += amount;
      }
    }

    log.debug('Subtotal', subtotal);
    log.debug('Min Required', minPurchase);

    if (subtotal < minPurchase) {
      log.audit('Promo Skipped', `Subtotal $${subtotal} is less than min required $${minPurchase}`);
      return;
    }

    // Apply discount line
    const discountAmount = -(subtotal * (discountPct / 100)).toFixed(2);
    const nextLine = po.getLineCount({ sublistId: 'item' });

    po.insertLine({ sublistId: 'item', line: nextLine });
    po.setSublistValue({
      sublistId: 'item',
      fieldId: 'item',
      line: nextLine,
      value: DISCOUNT_ITEM_ID
    });
    po.setSublistValue({
      sublistId: 'item',
      fieldId: 'rate',
      line: nextLine,
      value: discountAmount
    });
    po.setSublistValue({
      sublistId: 'item',
      fieldId: 'description',
      line: nextLine,
      value: `Vendor Promo Applied: ${promoCode}`
    });

    log.audit('Promo Applied', `Discount of $${discountAmount} added for promo "${promoCode}"`);
  }

  return { beforeSubmit };
});
