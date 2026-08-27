/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/record', 'N/email','N/task', 'N/redirect'],
    function (serverWidget, search, log, record, email, task, redirect) {

        function onRequest(context) {
            if (context.request.method === 'GET') {
                log.debug('GET context', context);
                let params = context.request.parameters;
                log.debug('GET params', params);

                // Retrieve parameters passed via the URL
                let item = params.item;
                let itemText = params.itemtext;
                let soId = params.soid;
                let qty = params.quantity;
                let cso = params.cso;

                log.debug('item', item);
                log.debug('soId', soId);
                log.debug('qty', qty);
                log.debug('cso', cso);

                // Retrieve CSO Data for additional info.
                let csoData = getCsoData(cso);
                log.debug('csoData', csoData);

                // Create the form to display to the user.
                var form = serverWidget.createForm({ title: 'Cancel REQ' });

                // Display-only field: Item (text)
                var itemField = form.addField({
                    id: 'custpage_item',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
                });
                itemField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                itemField.defaultValue = itemText;

                // Display-only field: Qty (number)
                var qtyField = form.addField({
                    id: 'custpage_qty',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Qty'
                });
                qtyField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                qtyField.defaultValue = qty;

                // Editable field: Qty to Cancel (number)
                var qtyCancelField = form.addField({
                    id: 'custpage_qtycancel',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Qty to Cancel'
                });

                // Hidden field: CSO id
                var hiddenCsoField = form.addField({
                    id: 'custpage_cso',
                    type: serverWidget.FieldType.TEXT,
                    label: 'CSO'
                });
                hiddenCsoField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                hiddenCsoField.defaultValue = cso;

                // Hidden field: Sales Order id
                var hiddenSoIdField = form.addField({
                    id: 'custpage_soid',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Sales Order ID'
                });
                hiddenSoIdField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                hiddenSoIdField.defaultValue = soId;

                // Hidden field: Item id
                var hiddenItemField = form.addField({
                    id: 'custpage_itemid',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item'
                });
                hiddenItemField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                hiddenItemField.defaultValue = item;

                // Hidden field: Item text
                var hiddenItemTextField = form.addField({
                    id: 'custpage_itemtext',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Item Text'
                });
                hiddenItemTextField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                hiddenItemTextField.defaultValue = itemText;

                // Hidden field: Qty value
                var hiddenQtyField = form.addField({
                    id: 'custpage_qtyvalue',
                    type: serverWidget.FieldType.INTEGER,
                    label: 'Qty'
                });
                hiddenQtyField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                hiddenQtyField.defaultValue = qty;

                // Add the submit button
                form.addSubmitButton({ label: 'Submit' });
                context.response.writePage(form);

            } else { // POST
                // Retrieve submitted values
                var qtyToCancel = context.request.parameters.custpage_qtycancel;
                var cso = context.request.parameters.custpage_cso;
                var soId = context.request.parameters.custpage_soid;
                var item = context.request.parameters.custpage_itemid;
                var itemText = context.request.parameters.custpage_itemtext;
                var qty = context.request.parameters.custpage_qtyvalue;

                log.debug('POST parameters', {
                    qtyToCancel: qtyToCancel,
                    cso: cso,
                    soId: soId,
                    item: item,
                    itemText: itemText,
                    qty: qty
                });

                // Retrieve CSO Data from custom record
                let csoData = getCsoData(cso);
                log.debug('csoData', csoData);

                // First condition: if CSO is linked, create a task record
           if (csoData.isLinked == true) {
    log.debug('isLinked == true');
    // Look up the Sales Order's class
    let fieldLookUp = search.lookupFields({
        type: 'salesorder',
        id: csoData.salesOrd,
        columns: ['class']
    });
    let soClass = fieldLookUp.class;
    let useClass = soClass[0].value;

    // Create a task record
    var taskRec = record.create({
        type: record.Type.TASK,
        isDynamic: true
    });

    let taskTitle = 'Cancel Request for Sales Order ' + csoData.salesOrdText;
    let taskMessage = 'Item: ' + itemText + ', Qty to Cancel: ' + qtyToCancel + '. Cancel request created.';

    taskRec.setValue({ fieldId: 'title', value: taskTitle });
    taskRec.setValue({ fieldId: 'message', value: taskMessage });

    // Original Assignments
    if (useClass == 2) {
        taskRec.setValue({ fieldId: 'assigned', value: 15377 }); // Commercial
    }
    else if (useClass == 1) {
        taskRec.setValue({ fieldId: 'assigned', value: 39 });    // Retail
    }

    // Save the task and trigger the standard assignment notification
    // Note: 'enableSourcing: true' helps ensure native alerts trigger
    var taskId = taskRec.save({
        enableSourcing: true,
        ignoreMandatoryFields: true
    });
    log.debug('Task created with id', taskId);

    // --- ADDED: Notify Ted (19209) via Email ---
    try {
        email.send({
            author: 17891, // Using your ID (Jesse Wampole) as the sender
            recipients: 19209, // Ted R Koliopoulous
            subject: 'NOTIFICATION: ' + taskTitle,
            body: 'A new cancel request task has been created and assigned.\n\n' + taskMessage,
            relatedRecords: {
                taskId: taskId
            }
        });
        log.debug('Notification sent to Ted (19209)');
    } catch (e) {
        log.error('Failed to notify Ted', e);
    }
}
                // Second condition: if CSO is not linked, inactivate the CSO and update the PO,
                // then update the Sales Order to clear linked info on matching line.
                else if (csoData.isLinked == false) {
                    if (Number(qtyToCancel) == Number(qty)) {
                        log.debug('isLinked == false - proceeding to inactivate CSO and update PO');
                        // Inactivate the CSO record instead of deleting it.
                        record.submitFields({
                            type: 'customrecord_consolidated_special_order',
                            id: cso,
                            values: {
                                isinactive: true
                            }
                        });
                        log.debug('CSO record inactivated', cso);

                        // Load the Purchase Order record using the internal id from the CSO data
                        let poRecord = record.load({
                            type: 'purchaseorder',
                            id: csoData.purchOrd,
                            isDynamic: true
                        });

                        let lineCount = poRecord.getLineCount({ sublistId: 'item' });
                        log.debug('PO line count', lineCount);

                        // Iterate backwards over the item sublist and remove matching lines
                        for (let i = lineCount - 1; i >= 0; i--) {
                            let lineUniqueKey = poRecord.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'lineuniquekey',
                                line: i
                            });
                            log.debug('PO Line ' + i + ' unique key', lineUniqueKey);

                            if (lineUniqueKey == csoData.poKey) {
                                poRecord.removeLine({
                                    sublistId: 'item',
                                    line: i,
                                    ignoreRecalc: true
                                });
                                log.debug('Removed PO line ' + i + ' matching poKey', csoData.poKey);
                            }
                        }

                        // Save the updated Purchase Order record
                        let poId = poRecord.save();
                        log.debug('Updated Purchase Order saved with id', poId);

                        // Now load the Sales Order record and update it:
                        let soRecord = record.load({
                            type: 'salesorder',
                            id: csoData.salesOrd,
                            isDynamic: false
                        });

                        let soLineCount = soRecord.getLineCount({ sublistId: 'item' });
                        log.debug('Sales Order line count', soLineCount);

                        // Iterate over each line to check for matching linked value
                        for (let j = 0; j < soLineCount; j++) {
                            let soLinkedVal = soRecord.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'lineuniquekey',
                                line: j
                            });
                            log.debug('Sales Order line ' + j + ' linked value', soLinkedVal);
                            if (soLinkedVal == csoData.soKey) {
                                soRecord.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_zas_linked_so_rec',
                                    line: j,
                                    value: ''
                                });
                                log.debug('Cleared linked value on Sales Order line ' + j);
                                soRecord.setSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'custcol_pl_so_cancelreq',
                                    line: j,
                                    value: ''
                                });
                                log.debug('Cleared url value on Sales Order line ' + j);

                            }
                        }

                        // Save the updated Sales Order record
                        let soUpdatedId = soRecord.save();
                        log.debug('Sales Order updated with id', soUpdatedId);
                    }
                    else if (Number(qtyToCancel) < Number(qty)) {
                      var remaining = Number(qty) - Number(qtyToCancel)
                        log.debug('cancel partial qty',remaining)
                        // {"qtyToCancel":"5","cso":"1907","soId":"","item":"550223","itemText":"WS-85624-BK","qty":"10"}
                        record.submitFields({
                            type: 'customrecord_consolidated_special_order',
                            id: cso,
                            values: {
                                custrecord_special_consolidated_qty: remaining
                            }
                        });
                        log.debug('CSO record qty changed', cso);
                        //load the CSO and change the qty
                        let loadedCso = record.load({
                            type: 'customrecord_consolidated_special_order',
                            id: cso,
                            isDynamic: true
                        });
                        let soId = loadedCso.getValue('custrecord_special_consolidated_so')
                        let soLine = loadedCso.getValue('custrecord_special_consolidated_key')
                        let poId = loadedCso.getValue('custrecord_special_consolidated_po')
                        let poLine = loadedCso.getValue('custrecord_consolidated_po_unique')
                        //load the PO, change the qty
                        let poEdit = editPo(poId, remaining, poLine)
                        log.debug('PO edited for qty', poEdit)
                        //load the SO and change the qty
                        let soEdit = editSo(soId, remaining, soLine)
                        log.debug('PO edited for qty', soEdit)

                    }
                }

                // After processing (either condition), always redirect back to the Sales Order record in view mode.
                redirect.toRecord({
                    type: 'salesorder',
                    id: csoData.salesOrd,
                    isEditMode: false
                });
            }
        }

        const editPo = (po, qty, lineKey) => {
            let poRecord = record.load({
                type: 'purchaseorder',
                id: po,
                isDynamic: true
            });

            let lineCount = poRecord.getLineCount({ sublistId: 'item' });
            log.debug('PO line count', lineCount);

            // Iterate backwards over the item sublist and remove matching lines
            for (let i = lineCount - 1; i >= 0; i--) {
                let lineUniqueKey = poRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'lineuniquekey',
                    line: i
                });
                log.debug('PO Line ' + i + ' unique key', lineUniqueKey);

                if (lineUniqueKey == lineKey) {
                    // Select the line in dynamic mode
                    poRecord.selectLine({
                        sublistId: 'item',
                        line: i
                    });
                    // Update the quantity field on the current line
                    poRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: qty
                    });
                    // Commit the changes for the current line
                    poRecord.commitLine({ sublistId: 'item' });
                    log.debug('Updated PO line ' + i + ' quantity to', qty);
                }
            }

            // Save the updated Purchase Order record
            let poId = poRecord.save();
            log.debug('Updated Purchase Order saved with id', poId);
        }

        const editSo = (so, qty, lineKey) => {
            let soRecord = record.load({
                type: 'salesorder',
                id: so,
                isDynamic: true
            });

            let lineCount = soRecord.getLineCount({ sublistId: 'item' });
            log.debug('SO line count', lineCount);

            // Iterate backwards over the item sublist and remove matching lines
            for (let i = lineCount - 1; i >= 0; i--) {
                let lineUniqueKey = soRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'lineuniquekey',
                    line: i
                });
                log.debug('PO Line ' + i + ' unique key', lineUniqueKey);

                if (lineUniqueKey == lineKey) {
                    // Select the line in dynamic mode
                    soRecord.selectLine({
                        sublistId: 'item',
                        line: i
                    });
                    // Update the quantity field on the current line
                    soRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'isspecialorderline',
                        value: false
                    });
                    // Commit the changes for the current line
                    soRecord.commitLine({ sublistId: 'item' });
                  
                }
            }

            // Save the updated Purchase Order record
            let soId = soRecord.save();
            log.debug('Updated sales Order saved with id', soId);
        }

        /**
         * Loads the consolidated special order record and returns an object
         * containing key values.
         */
        const getCsoData = (id) => {
            let loadedRecord = record.load({
                type: 'customrecord_consolidated_special_order',
                id: id,
                isDynamic: true
            });
            log.debug('loadedRecord', loadedRecord);
            let obj = {};
            obj.purchOrd = loadedRecord.getValue('custrecord_special_consolidated_po');
            obj.purchOrdText = loadedRecord.getText('custrecord_special_consolidated_po');
            obj.salesOrd = loadedRecord.getValue('custrecord_special_consolidated_so');
            obj.salesOrdText = loadedRecord.getText('custrecord_special_consolidated_so');
            obj.inbound = loadedRecord.getValue('custrecord_inbound_shipment');
            obj.soKey = loadedRecord.getValue('custrecord_special_consolidated_key');
            obj.poKey = loadedRecord.getValue('custrecord_consolidated_po_unique');
            obj.isLinked = loadedRecord.getValue('custrecord_special_consolidated_linked');
            return obj;
        };

        function waitForSeconds(seconds) {
            var start = new Date().getTime();
            var end = start;
            while (end < start + seconds * 1000) {
                end = new Date().getTime();
            }
        }

        return {
            onRequest: onRequest
        };
    });
