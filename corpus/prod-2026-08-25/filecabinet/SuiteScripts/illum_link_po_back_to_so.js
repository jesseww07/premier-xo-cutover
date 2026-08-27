/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {ui} ui
     * @param {dialog} dialog
     * @param {runtime} runtime
     */
    function (record, search, ui, dialog, runtime) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(context) {
            var consolidatedPO = context.newRecord
            var id = consolidatedPO.id
            var createPO = consolidatedPO.getValue({
                fieldId: 'custrecord_zastro_po_no'
            })
            var returnSuccess = getApplicableOrders(id, createPO)
            if(returnSuccess == 'success'){
                consolidatedPO.setValue({
                    fieldId: 'custrecord_illuminet_link_bridged',
                    value: true
                })
                //consolidatedPO.save()
            }
            else{
                log.error('issue on consol: ', id)
            }

        }
        const getApplicableOrders = (id, createPO) => {
            var salesOrdArray = new Array()
            var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
                type: "customrecord_zastro_unconsolidated_items",
                filters:
                    [
                        ["custrecord_zastro_is_consolidated_on_po", "is", "T"],
                        "AND",
                        ["custrecord_zastro_po_item_list", "anyof", id]
                    ],
                columns:
                    [
                        "custrecord_zastro_so_no"
                    ]
            });
            var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
            log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count", searchResultCount);
            customrecord_zastro_unconsolidated_itemsSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var salesOrd = result.getValue({
                    name: 'custrecord_zastro_so_no'
                })
                var toAdd = checkIndex(salesOrd, salesOrdArray)
                if (toAdd >= 0) {
                    log.debug('in array already', salesOrd)
                }
                else {
                    salesOrdArray.push(salesOrd)
                }
                return true;
            });
            if (salesOrdArray.length > 0) {
                var submittedSO = markSalesOrd(id, createPO, salesOrdArray)
                log.debug('submittedSO',submittedSO)
                if(submittedSO == true){
                    return 'success'
                }
                else{
                    return 'fail'
                }
            }
        }
        const markSalesOrd = (id, createPO, salesOrdArray) => {
            var globalChange = false
            for (var x = 0; x < salesOrdArray.length; x++) {
                var appliedChange = false
                var objRecord = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesOrdArray[x],
                    isDynamic: true,
                });
                var numLines = objRecord.getLineCount({
                    sublistId: 'item'
                });
                for (var i = 0; i < numLines; i++) {
                    var consolPO = objRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_zastro_unconsolidated_no',
                        line: i
                    });
                    log.debug('consolPO',consolPO + ' - LINE: ' + i)
                    log.debug('id',id + ' - LINE: ' + i)
                    if (consolPO == id) {
                        log.debug('in comp')
                        var lineNum = objRecord.selectLine({
                            sublistId: 'item',
                            line: i
                        });
                        objRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_illuminet_linked_po',
                            value: createPO,
                            ignoreFieldChange: true
                        });
                        objRecord.commitLine({
                            sublistId: 'item'
                        });
                        appliedChange = true
                        globalChange = true
                    }
                }
                if (appliedChange == true) {
                    var saved = objRecord.save()
                    log.debug('saved',saved)
                }
            }
            if(globalChange == true){
                log.debug('globalChange',globalChange)
                return true
            }
            else{
                log.debug('globalChange',globalChange)
                return false
            }
        }
        const checkIndex = (salesOrd, salesOrdArray) => {
            for (var i = 0; i < salesOrdArray.length; i++) {
                log.debug('salesOrdArray[i]', salesOrdArray[i])
                log.debug(' in check array salesOrd', salesOrd)
                if (salesOrdArray[i] === salesOrd) {
                    return i;
                }
            }
        }

        return {
            onAction: onAction
        };

    });
