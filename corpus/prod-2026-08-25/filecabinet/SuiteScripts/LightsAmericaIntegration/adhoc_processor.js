/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define([
    'N/format',
    'N/log',
    'N/record',
    'N/runtime',
    'N/search',
    'N/task',
    'N/util',
    'N/file',
    'SuiteScripts/LightsAmericaIntegration/Templates/customer_item_mapping_carolina_lanterns.js',
    'SuiteScripts/LightsAmericaIntegration/Model/item.js'
    ],
 /**
  * @param {format} format
  * @param {log} log
  * @param {record} record
  * @param {runtime} runtime
  * @param {search} search
  * @param {task} task
  * @param {util} util
  */
 function (format, log, record, runtime, search, task, util, file, customerTemplate, itemModel) {

     function getInputData() {
        var configRecord = itemModel.getLightsConfig();
        var virtualWarehouseItemId = configRecord.getValue({fieldId: 'custrecord_virtual_warehouse_placeholder'});

        var estimateSearchObj = search.create({
           type: "estimate",
           filters:
           [
              ["mainline","any",""], 
              "AND", 
              ["type","anyof","Estimate"], 
              "AND", 
              ["status","anyof","Estimate:A"], 
              "AND", 
              ["item","anyof", virtualWarehouseItemId]
           ],
           columns:
           [
              search.createColumn({
                 name: "internalid",
                 summary: "GROUP",
              })
           ]
        });

        estimateSearchObj.run().each(function(result){
           // .run().each has a limit of 4,000 results
            var quoteId = result.getValue({name: 'internalid', summary: 'GROUP'});
            updateOneQuote(quoteId, configRecord);
           return true;
        });


     }


     function map(context) {
        return true;
     }


     const updateOneQuote = (transactionInternalId, configRecord) => {
        try {
            var virtualWarehouseItemId = configRecord.getValue({fieldId: 'custrecord_virtual_warehouse_placeholder'});
            var manufacturerMappingTable = itemModel.getStoredManufacturerMapingTable();

            var transaction = record.load({
                type: 'estimate',
                id: transactionInternalId,
                isDynamic: true
            });

            //Look at all of the items on the transaction. Replace the item with the created item
            var lineCount = transaction.getLineCount({sublistId: 'item'});
            for (var i = 0; i < lineCount; i++) {
                var netsuiteItemId = transaction.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                }).toString();

                if (netsuiteItemId != virtualWarehouseItemId) {
                    continue;
                }

                var lightsMfrId = transaction.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_la_item_link',
                    line: i
                });


                if (!lightsMfrId) {
                    continue;
                }

                var customerFieldMapping = customerTemplate.getCustomItemFieldMapping();

                var catalogItem = record.load({
                    type: 'customrecord_zastro_lights_items',
                    id: lightsMfrId
                });

                var itemId = itemModel.createOneItemRecord(configRecord, manufacturerMappingTable, customerFieldMapping, catalogItem, true);

                catalogItem.setValue({fieldId: 'custrecord_lights_linked_item', value: itemId});
                catalogItem.save();

                //Get the existing values of the line
                transaction.selectLine({sublistId: 'item', line: i});
                var isTaxable = transaction.getCurrentSublistValue({sublistId: 'item', fieldId: 'istaxable'});
                var qty = transaction.getCurrentSublistValue({sublistId: 'item', fieldId: 'quantity'});
                var rate = transaction.getCurrentSublistValue({sublistId: 'item', fieldId: 'rate'});
                var amount = transaction.getCurrentSublistValue({sublistId: 'item', fieldId: 'amount'});
                var imageUrl = transaction.getCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_idlwd_vend_item_link'});
                var uniqueId = transaction.getCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_lights_unique_id'});
                var description = transaction.getCurrentSublistValue({sublistId: 'item', fieldId: 'description'});

                transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'item', value: itemId, fireSlavingSync: true});
                transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'unitconversionrate', value: 1});
                transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'istaxable', value: true});
                transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: qty});
               // transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'price', value: '-1'});
                transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: rate});
                transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: amount});
                transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_idlwd_vend_item_link', value: imageUrl});
                transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_lights_unique_id', value: uniqueId});
                transaction.setCurrentSublistValue({sublistId: 'item', fieldId: 'description', value: description});
                transaction.commitLine({sublistId: 'item'});
            }

            transaction.save({ignoreMandatoryFields: true});
        }

        catch (err) {
            log.error('AN_ERROR_OCCURRED_SAVING_TRANSACTION');
            log.error(err.name, err.message);
        }
     }


     return {
         getInputData: getInputData,
         map: map,
     };

 });