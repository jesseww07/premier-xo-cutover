define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime', 'N/task'],
/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
/**
 * @param {record} record
 * @param {search} search
 * @param {ui} ui
 * @param {dialog} dialog
 * @param {runtime} runtime
 * @param {task} task
 */
    function (record, search, ui, dialog, runtime, task) {

        function onAction(context) {
            try {
                log.debug('in onAction');

                let thisRecord = context.newRecord;
                let recId = thisRecord.id;
                
                log.debug('recId', recId);

                let invAdjRec = record.load({
                    type: 'inventoryadjustment',
                    id: recId,
                    isDynamic: true
                });

                let lineCount = invAdjRec.getLineCount({
                    sublistId: 'inventory'
                });
                log.debug('lineCount', lineCount);

                let itemArray = getItems(invAdjRec, lineCount);
                log.debug('itemArray', itemArray);

                let customer = invAdjRec.getValue({
                    fieldId: 'customer'
                });

                let storedSO = getStoredSO(customer);
                log.debug('storedSO', storedSO);

                let savedStoredSORec;
                let newSavedStoredSO;

                if (storedSO) {
                    savedStoredSORec = addItemsToStoredSO(storedSO, itemArray);
                    log.debug('savedStoredSORec', savedStoredSORec);
                }
                else if (!storedSO && customer) {
                    newSavedStoredSO = createNewStoredSO(customer, itemArray);
                    log.debug('newSavedStoredSO', newSavedStoredSO);

                    invAdjRec.setValue({
                        fieldId: 'custbody_abe_so',
                        value: newSavedStoredSO
                    });
                }
                invAdjRec.save();
                
                
            }
            catch (error) {
                log.debug('failure in onAction', error);
            }
        }



        const getItems = (invAdjRec, lineCount) => {
            log.debug('in getItems');

            let itemArray = [];

            for (let i = 0; i < lineCount; i++) {
                let itemObj = {};

                let item = invAdjRec.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'item',
                    line: i
                });
                let itemName = invAdjRec.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'item_display',
                    line: i
                });
                let itemQty = invAdjRec.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'adjustqtyby',
                    line: i
                });
                let itemLocation = invAdjRec.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'location',
                    line: i
                });
                let itemLocationDisplay = invAdjRec.getSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'location_display',
                    line: i
                });

                itemObj.item = item;
                itemObj.itemName = itemName;
                itemObj.itemQty = itemQty;
                itemObj.itemLocation = itemLocation;
                itemObj.itemLocationDisplay = itemLocationDisplay;

                itemArray.push(itemObj);
            }
            return itemArray

        }



        const getStoredSO = (customer) => {
            log.debug('in getStoredSO', customer);

            let soId;

            let salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                [
                   ["customform","anyof","174"], 
                   "AND", 
                   ["type","anyof","SalesOrd"], 
                   "AND", 
                   ["mainline","is","T"], 
                   "AND", 
                   ["name","anyof",customer]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"})
                ]
             });
             let searchResultCount = salesorderSearchObj.runPaged().count;
             log.debug("salesorderSearchObj result count",searchResultCount);
             salesorderSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results

                soId = result.getValue({
                    name: 'internalid'
                });

                return true;
             });
             
             /*
             salesorderSearchObj.id="customsearch1679427546465";
             salesorderSearchObj.title="Find Stored SO by Customer (copy)";
             var newSearchId = salesorderSearchObj.save();
             */
            return soId;
        }



        const addItemsToStoredSO = (storedSO, itemArray) => {
            log.debug('in addItemsToStoredSO', storedSO);

            let storedSORec = record.load({
                type: 'salesorder',
                id: storedSO,
                isDynamic: true
            });

            for (let j = 0; j < itemArray.length; j++) {
                let selectLine = storedSORec.selectNewLine({
                    sublistId: 'item'
                });

                storedSORec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: itemArray[j].item
                });
                storedSORec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: itemArray[j].itemQty
                });
                storedSORec.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    value: 0
                });
                storedSORec.commitLine({
                    sublistId: 'item'
                });
            }

            let saveRec = storedSORec.save();
            return saveRec;


        }



    const createNewStoredSO = (customer, itemArray) => {
        log.debug('in createNewStoredSO');

        let location = itemArray[0].itemLocation;
        log.debug('location', location);

        let newStoredSORec = record.create({
            type: 'salesorder',
            isDynamic: true
        });

        newStoredSORec.setValue({
            fieldId: 'customform',
            value: 174
        });
        newStoredSORec.setValue({
            fieldId: 'entity',
            value: customer
        });
        newStoredSORec.setValue({
            fieldId: 'location',
            value: location
        });
        // newStoredSORec.setValue({
        //     fieldId: 'class',
        //     value: itemArray[0].soClass
        // });

        for (let k = 0; k < itemArray.length; k++) {
            newStoredSORec.selectNewLine({
                sublistId: 'item'
            });
            newStoredSORec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: itemArray[k].item
            });
            newStoredSORec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: itemArray[k].itemQty
            });
            newStoredSORec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                value: 0
            });
            newStoredSORec.commitLine({
                sublistId: 'item'
            });
        }

        let saveRec = newStoredSORec.save();
        return saveRec;

    }
        


        return {
            onAction: onAction
        };

 });


 
