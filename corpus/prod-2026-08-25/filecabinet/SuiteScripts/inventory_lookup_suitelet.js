/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search'], (ui, search) => {

  const onRequest = (context) => {
    const form = ui.createForm({  
      title: ' ',
  hideNavBar: true
});


    const itemField = form.addField({
      id: 'custpage_item_input',
      type: ui.FieldType.TEXT,
      label: 'Item Name or Internal ID'
    });

    form.addSubmitButton('Search');

    if (context.request.method === 'POST') {
      const itemVal = context.request.parameters.custpage_item_input;

      const invSearch = search.create({
        type: search.Type.INVENTORY_BALANCE,
        filters: [
          ['item.internalidnumber', 'equalto', itemVal],
          'OR',
          ['item.name', 'is', itemVal]
        ],
        columns: [
          'location',
          'binnumber',
          'onhand',
          'available'
        ]
      });

      const sublist = form.addSublist({
        id: 'custpage_results',
        type: ui.SublistType.LIST,
        label: 'Inventory Results'
      });

      sublist.addField({ id: 'col_loc', label: 'Location', type: ui.FieldType.TEXT });
      sublist.addField({ id: 'col_bin', label: 'Bin', type: ui.FieldType.TEXT });
      sublist.addField({ id: 'col_onhand', label: 'On Hand', type: ui.FieldType.TEXT });
      sublist.addField({ id: 'col_avail', label: 'Available', type: ui.FieldType.TEXT });

      const results = invSearch.run().getRange({ start: 0, end: 25 });

      results.forEach((r, i) => {
        sublist.setSublistValue({ id: 'col_loc', line: i, value: r.getText('location') || '' });
        sublist.setSublistValue({ id: 'col_bin', line: i, value: r.getText('binnumber') || '' });
        sublist.setSublistValue({ id: 'col_onhand', line: i, value: r.getValue('onhand')?.toString() || '0' });
        sublist.setSublistValue({ id: 'col_avail', line: i, value: r.getValue('available')?.toString() || '0' });
      });
    }

    context.response.writePage(form);
  };

  return { onRequest };
});
