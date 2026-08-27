/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util', 'N/https', 'N/format'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {util} util
     */
    function (log, record, search, util, https, format) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(context) {

            search.load({
                id: 'customsearch709'
            }).run().each(function (result) {
                log.debug(result)
                var parentId = result.id
                log.debug('parentId', parentId)
                if (parentId) {
                    try {
                        const parentObj = new Object
                        var quoteParent = record.load({
                            type: 'customrecord_pr_quote_parent',
                            id: parentId,
                            isDynamic: true
                        });
                        log.debug('quoteParent', quoteParent)

                        parentObj.customer = quoteParent.getValue({
                            fieldId: 'custrecord_pr_customer_list'
                        });

                        parentObj.date = quoteParent.getValue({
                            fieldId: 'custrecord_pr_date'
                        });

                        parentObj.po = quoteParent.getValue({
                            fieldId: 'custrecord_pr_po_num'
                        });

                        parentObj.shipDate = quoteParent.getValue({
                            fieldId: 'custrecord_pr_ship_date'
                        });

                        parentObj.billAdd = quoteParent.getValue({
                            fieldId: 'custrecord_pr_billing_address_1'
                        });

                        parentObj.billCity = quoteParent.getValue({
                            fieldId: 'custrecord_pr_billing_city_1'
                        });

                        parentObj.billState = quoteParent.getValue({
                            fieldId: 'custrecord_pr_billing_state_1'
                        });

                        parentObj.billZip = quoteParent.getValue({
                            fieldId: 'custrecord_pr_billing_zip_1'
                        });

                        parentObj.shipAdd = quoteParent.getValue({
                            fieldId: 'custrecordpr_shipping_address_1'
                        });

                        parentObj.shipCity = quoteParent.getValue({
                            fieldId: 'custrecordpr_shipping_city_1'
                        });

                        parentObj.shipState = quoteParent.getValue({
                            fieldId: 'custrecord_pr_shipping_state_1'
                        });

                        parentObj.shipZip = quoteParent.getValue({
                            fieldId: 'custrecord_pr_shipping_zip_1'
                        });

                        parentObj.terms = quoteParent.getValue({
                            fieldId: 'custrecord_pr_terms'
                        });

                        parentObj.shipCountry = quoteParent.getValue({
                            fieldId: 'custrecord_pr_shipping_country'
                        });

                        parentObj.billCountry = quoteParent.getValue({
                            fieldId: 'custrecord_pr_billing_country'
                        });

                        log.debug('parentObj', parentObj)



                        var childData = getChildData(parentId)
                        log.debug('childData', childData)
                        var makeQuote = createQuote(parentObj, childData)
                    }
                    catch (e) {
                        log.debug('e', e)
                    }
                }
                else {
                    return
                }
                return true
            })
        }

        const getChildData = (parentId) => {
            var childArray = new Array()
            var customrecord_pr_quote_childSearchObj = search.create({
                type: "customrecord_pr_quote_child",
                filters:
                    [
                        ["custrecord_pl_parent", "anyof", parentId]
                    ],
                columns:
                    [
                        "internalid",
                        "custrecord_pr_child_item",
                        "custrecord_pr_child_item_text",
                        "custrecord_pr_child_quantity",
                        "custrecord_pr_child_rate",
                        "custrecord_pr_child_room_location",
                        "custrecord_pr_child_cost_est_type",
                    ]
            });
            var searchResultCount = customrecord_pr_quote_childSearchObj.runPaged().count;
            log.debug("customrecord_pr_quote_childSearchObj result count", searchResultCount);
            customrecord_pr_quote_childSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var id = result.getValue({
                    name: 'internalid'
                })
                var item = result.getValue({
                    name: 'custrecord_pr_child_item'
                })
                var itemText = result.getValue({
                    name: 'custrecord_pr_child_item_text'
                })
                var itemQty = result.getValue({
                    name: 'custrecord_pr_child_quantity'
                })
                var itemRate = result.getValue({
                    name: 'custrecord_pr_child_rate'
                })
                var roomLoc = result.getValue({
                    name: 'custrecord_pr_child_room_location'
                })
                var costEstType = result.getValue({
                    name: 'custrecord_pr_child_cost_est_type'
                })

                var returnObj = new Object()
                returnObj.id = id
                returnObj.item = item
                returnObj.itemText = itemText
                returnObj.itemQty = itemQty
                returnObj.itemRate = itemRate
                returnObj.roomLoc = roomLoc
                returnObj.costEstType = costEstType
                childArray.push(returnObj)

                return true;
            });
            log.debug('childArray', childArray)
            return childArray
        }
       
            const createQuote = (parentObj, childArray) => {
                log.debug('in create quote')
                
                var quoteRec = record.create({
                    type: 'estimate',
                    isDynamic: true
                })
                quoteRec.setValue({
                    fieldId: 'entity',
                    value: parentObj.customer
                })
                quoteRec.setValue({
                    fieldId: 'trandate',
                    value: parentObj.date
                })
                quoteRec.setValue({
                    fieldId: 'shipaddr1',
                    value: parentObj.shipAdd
                })
                quoteRec.setValue({
                    fieldId: 'shipcity',
                    value: parentObj.shipCity
                })
                quoteRec.setValue({
                    fieldId: 'shipzip',
                    value: parentObj.shipZip
                })
                quoteRec.setValue({
                    fieldId: 'billaddr1',
                    value: parentObj.billAdd
                })
                quoteRec.setValue({
                    fieldId: 'billcity',
                    value: parentObj.billCity
                })
                quoteRec.setValue({
                    fieldId: 'billzip',
                    value: parentObj.billZip
                })

                for (var x = 0; x < childArray.length; x++) {
                    log.debug('in set item loop')
                    quoteRec.selectNewLine({
                        sublistId: 'item'
                    });
                    quoteRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: childArray[x].item
                    });
                    quoteRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: childArray[x].itemQty
                    });

                    quoteRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: childArray[x].itemRate
                    });

                    quoteRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'costestimatetype_display',
                        value: childArray[x].costEstType
                    });

                    quoteRec.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pr_room_location',
                        value: childArray[x].roomLoc
                    });

                    quoteRec.commitLine({
                        sublistId: 'item'
                    });
                }
                var rec = quoteRec.save({
                    ignoreMandatoryFields: true
                })
                return rec
            }
        
        // catch (e) {
        //     log.debug('e', e)
        // }

        return {
            execute: execute
        };

    });