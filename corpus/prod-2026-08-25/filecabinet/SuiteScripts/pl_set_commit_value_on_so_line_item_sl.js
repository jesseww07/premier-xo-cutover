define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/file', 'N/render'],
/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
    function (log, serverWidget, record, search, url, redirect, file, render) {

        function onRequest(context) {
            if (context.request.method === 'GET') {
                let checking = context.request.parameters
                let originitatingID = context.request.parameters.custom_id

                log.debug('originating ID', originitatingID);

                let loadRec = record.load({
                    type: 'salesorder',
                    id: originitatingID,
                    isDynamic:true
                });
                
                let fields = createFormFields(serverWidget);
                let sublist = fields.sublist;
                let form2 = fields.form2;
                let selectQty = fields.selectQty;
                let domain = url.resolveDomain({
                    hostType: url.HostType.APPLICATION
                });

                let items = getItems(loadRec);
                log.debug('items', items);

                for (let i = 0; i < items.length; i++) {
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_so_id',
                            line: i,
                            value: items[i].soId
                        });
                    }
                    catch (error) {
                        log.debug('soId', error)
                        sublist.setSublistValue({
                            id: 'custpage_so_id',
                            line: i,
                            value: ' '
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_item_id',
                            line: i,
                            value: items[i].itemId
                        });
                    }
                    catch (error) {
                        log.debug('itemId', error)
                        sublist.setSublistValue({
                            id: 'custpage_item_id',
                            line: i,
                            value: ' '
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_item_name',
                            line: i,
                            value: items[i].itemName
                        });
                    }
                    catch (error) {
                        log.debug('itemName', error)
                        sublist.setSublistValue({
                            id: 'custpage_item_name',
                            line: i,
                            value: ' '
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_item_description',
                            line: i,
                            value: items[i].itemDescription
                        });
                    }
                    catch (error) {
                        log.debug('itemDescription', error)
                        sublist.setSublistValue({
                            id: 'custpage_item_description',
                            line: i,
                            value: ' '
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_qty_ordered',
                            line: i,
                            value: items[i].qtyOrdered
                        });
                    }
                    catch (error) {
                        log.debug('qtyOrdered', error)
                        sublist.setSublistValue({
                            id: 'custpage_qty_ordered',
                            line: i,
                            value: ' '
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_qty_ship',
                            line: i,
                            value: items[i].qtyShipped
                        });
                    }
                    catch (error) {
                        log.debug('qtyShipped', error)
                        sublist.setSublistValue({
                            id: 'custpage_qty_ship',
                            line: i,
                            value: ' '
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_commit_status_id',
                            line: i,
                            value: items[i].commitStatusId
                        });
                    }
                    catch (error) {
                        log.debug('commitStatusId', error)
                        sublist.setSublistValue({
                            id: 'custpage_commit_status_id',
                            line: i,
                            value: ' '
                        });
                    }
                    try {
                        sublist.setSublistValue({
                            id: 'custpage_commit_status',
                            line: i,
                            value: items[i].commitStatusText
                        });
                    }
                    catch (error) {
                        log.debug('commitStatus', error)
                        sublist.setSublistValue({
                            id: 'custpage_commit_status',
                            line: i,
                            value: ' '
                        });
                    }
                }
                
                form2.addSubmitButton('Save')
                context.response.writePage(form2);

                return true;

            }
            else{
                let returnArray = [];

                let requestCount = context.request.getLineCount({
                    group: 'sublist'
                });
                log.debug('requestCount', requestCount);

                for (let k = 0; k < requestCount; k++) {
                    let selected = context.request.getSublistValue({
                        group: 'sublist',
                        name: 'custpage_selected',
                        line: k
                    });
                    if (selected == 'T') {
                        log.debug('selected', selected);

                        let soId = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_so_id',
                            line: k
                        });
                        let itemId = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_item_id',
                            line: k
                        });
                        let itemName = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_item_name',
                            line: k
                        });
                        let itemDescription = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_item_description',
                            line: k
                        });
                        let qtyOrdered = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_qty_ordered',
                            line: k
                        });
                        let qtyShipped = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_qty_ship',
                            line: k
                        });
                        let commitStatusId = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_commit_status_id',
                            line: k
                        });
                        let commitStatusText = context.request.getSublistValue({
                            group: 'sublist',
                            name: 'custpage_commit_status',
                            line: k
                        });
                        
                        log.debug('soId', soId);
                        log.debug('itemId', itemId);
                        log.debug('itemName', itemName);
                        log.debug('itemDescription', itemDescription);
                        log.debug('qtyOrdered', qtyOrdered);
                        log.debug('qtyShipped', qtyShipped);
                        log.debug('commitStatusId', commitStatusId);
                        log.debug('commitStatusText', commitStatusText);

                        
                        let arrayObject = {};

                        arrayObject.soId = soId;
                        arrayObject.itemId = itemId;
                        arrayObject.itemName = itemName;
                        arrayObject.itemDescription = itemDescription;
                        arrayObject.qtyOrdered = qtyOrdered;
                        arrayObject.qtyShipped = qtyShipped;
                        arrayObject.commitStatusId = commitStatusId;
                        arrayObject.commitStatusText = commitStatusText;


                        log.debug('arrayObject', arrayObject);

                        returnArray.push(arrayObject);
                    }
                }
                log.debug('returnArray',returnArray);

                setCommitValues(returnArray);

            }
        }



        const createFormFields = (serverWidget) => {
            let form2 = serverWidget.createForm({
                title: 'Sales Order Item List'
            });
            let sublist = form2.addSublist({
                id: 'sublist',
                type: serverWidget.SublistType.LIST,
                label: 'Items'
            });

            sublist.addMarkAllButtons();

            let select = sublist.addField({
                id: 'custpage_selected',
                label: 'Select',
                type: serverWidget.FieldType.CHECKBOX,
            });
            let soId = sublist.addField({
                id: 'custpage_so_id',
                label: 'Sales Order ID',
                type: serverWidget.FieldType.TEXT,
            });
            let itemId = sublist.addField({
                id: 'custpage_item_id',
                label: 'Item ID',
                type: serverWidget.FieldType.TEXT,
            });
            let itemName = sublist.addField({
                id: 'custpage_item_name',
                label: 'Item Name',
                type: serverWidget.FieldType.TEXT,
            });
            let itemDescription = sublist.addField({
                id: 'custpage_item_description',
                label: 'Item Description',
                type: serverWidget.FieldType.TEXT,
            });
            let qtyOrdered = sublist.addField({
                id: 'custpage_qty_ordered',
                label: 'Quantity Ordered',
                type: serverWidget.FieldType.TEXT,
            });
            let qtyShipped = sublist.addField({
                id: 'custpage_qty_ship',
                label: 'Quantity Ship',
                type: serverWidget.FieldType.TEXT,
            });
            let commitStatusId = sublist.addField({
                id: 'custpage_commit_status_id',
                label: 'Commitment Status ID',
                type: serverWidget.FieldType.TEXT,
            });
            let commitStatus = sublist.addField({
                id: 'custpage_commit_status',
                label: 'Commitment Status',
                type: serverWidget.FieldType.TEXT,
            });
            
            return{form2, sublist}
        }



        const getItems = (loadRec) => {
            log.debug('in getItems');

            let itemArray = [];

            let lineCount = loadRec.getLineCount({
                sublistId: 'item'
            });
            log.debug('lineCount', lineCount);

            let soId = loadRec.getValue({
                fieldId: 'id'
            });
            log.debug('soId', soId);

            for (let j = 0; j < lineCount; j++) {
                let itemObject = {};
                let itemId = loadRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: j
                });
                let itemName = loadRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item_display',
                    line: j
                });
                let itemDescription = loadRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'description',
                    line: j
                });
                let qtyOrdered = loadRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: j
                });
                let qtyShipped = loadRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantityfulfilled',
                    line: j
                });
                let commitStatusText = loadRec.getSublistText({
                    sublistId: 'item',
                    fieldId: 'commitinventory',
                    line: j
                });
                let commitStatusId = loadRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'commitinventory',
                    line: j
                });

                log.debug('itemId', itemId);
                log.debug('itemName', itemName);
                log.debug('itemDescription', itemDescription);
                log.debug('qtyOrdered', qtyOrdered);
                log.debug('qtyShipped', qtyShipped);
                log.debug('commitStatusText', commitStatusText);
                log.debug('commitStatusId', commitStatusId);

                itemObject.soId = soId;
                itemObject.itemId = itemId;
                itemObject.itemName = itemName;
                itemObject.itemDescription = itemDescription;
                itemObject.qtyOrdered = qtyOrdered;
                itemObject.qtyShipped = qtyShipped;
                itemObject.commitStatusText = commitStatusText;
                itemObject.commitStatusId = commitStatusId;

                itemArray.push(itemObject);

            }

            log.debug('itemArray', itemArray);

            return itemArray;
        }



        const setCommitValues = (returnArray) => {
            log.debug('in setCommitValues');

            log.debug('returnArray in setCommitValues', returnArray);

            let soId = returnArray[0].soId;

            let salesOrder = record.load({
                type: 'salesorder',
                id: soId,
                isDynamic: true
            });

            let lineCount = salesOrder.getLineCount({
                sublistId: 'item'
            });

            for (let m = 0; m < lineCount; m++) {
                let itemId = salesOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: m
                });
                for (let n = 0; n < returnArray.length; n++) {
                    let arrayItemId = returnArray[n].itemId;

                    if (itemId == arrayItemId) {
                        log.debug('MATCH!!', m);
                        salesOrder.selectLine({
                            sublistId: 'item',
                            line: m
                        });

                        let commitValue = salesOrder.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'commitinventory',
                            line: m
                        });
                        log.debug(`line ${m} commitValue`, commitValue);

                        if (commitValue == 1) {
                            salesOrder.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'commitinventory',
                                line: m,
                                value: 3
                            });
                            salesOrder.commitLine({
                                sublistId: 'item',
                                line: m
                            });
                        }
                        else if (commitValue == 3) {
                            salesOrder.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: 'commitinventory',
                                line: m,
                                value: 1
                            });
                            salesOrder.commitLine({
                                sublistId: 'item',
                                line: m
                            });
                        }
                    }
                }
            }
            let savedRec = salesOrder.save();
            log.debug('savedRec', savedRec);

            redirect.toRecord({
                type: 'salesorder',
                id: soId,
            });

            return savedRec;
        }


     return {
         onRequest: onRequest
     };
 });