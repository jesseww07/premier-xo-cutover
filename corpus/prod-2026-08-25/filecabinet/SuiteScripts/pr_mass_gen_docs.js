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
            try {
                var custRec = context.newRecord
                var id = custRec.id
                log.debug(id)
                var returnChildren = getArray(id)
                log.debug('returnChildren', returnChildren)
                var arrayCount = getCount(id)
                log.debug('arrayCount', arrayCount)
                var returnIFULS = buildFulfillments(returnChildren, arrayCount)
                log.debug('returnIFULS', returnIFULS)
            }
            catch (e) {
                log.debug('failure in eaches', e)
            }
        }
        const buildFulfillments = (returnChildren, arrayCount) => {
            //log.debug('presort', returnChildren)
            returnChildren.sort((a, b) => (a.so > b.so) ? 1 : -1)
            //log.debug('postsort', returnChildren)
            log.debug('arrayCount', arrayCount)
            for (var x = 0; x < arrayCount.length; x++) {
                var salesOrdInt = arrayCount[x]
                var sendArray = new Array()
                for (var i = 0; i < returnChildren.length; i++) {
                    if (salesOrdInt == returnChildren[i].so) {
                        var soPush = returnChildren[i]
                        sendArray.push(soPush)
                    }
                }
                if (sendArray.length > 0) {
                    var returnFulfillment = createFulfillment(sendArray)
                }
            }
        }
        const createFulfillment = (sendArray) => {
            sendArray.sort((a, b) => (a.item > b.item) ? 1 : -1)
            log.debug('sendArray', sendArray)
            var soID = sendArray[0].so
            var objRecord = record.transform({
                fromType: 'salesorder',
                fromId: soID,
                toType: 'itemfulfillment',
                isDynamic: true,
            });
            var numLines = objRecord.getLineCount({
                sublistId: 'item'
            });
            //log.debug('numLines', numLines)
            if (numLines > 0) {
                var indexCount = Number(numLines) - 1
                log.debug('indexCount', indexCount)
                for (var l = 0; l <= indexCount; l++) {
                    var ordItem = objRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: l
                    })
                    var ordRoom = objRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pr_room_location',
                        line: l
                    })
                    var isMatch = false
                    var sendIndex = 0
                    var lastIndex = sendArray.length - 1
                    var lineArray = new Array()
                    for (var x = 0; x <= lastIndex; x++) {
                        var matchItem = sendArray[x].item
                        var matchRoom = sendArray[x].room

                        if ((Number(matchItem) == Number(ordItem)) && (matchRoom == ordRoom)) {
                            isMatch = true
                            sendIndex = x
                            var correctItem = matchItem
                            log.debug('index match', sendIndex + ' || ' + lastIndex)
                            lineArray.push(sendArray[x])
                        }
                    }
                    if (isMatch) {
                        log.audit('item match', correctItem + ' || ' + ordItem)
                        log.audit('lineArray',lineArray)
                    }

                    if (isMatch == false) {
                        objRecord.selectLine({
                            sublistId: 'item',
                            line: l
                        });
                        objRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive',
                            value: false
                        })
                        objRecord.commitLine({
                            sublistId: 'item'
                        });
                    }
                    else {
                        objRecord.selectLine({
                            sublistId: 'item',
                            line: l
                        });
                        objRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'itemreceive',
                            value: true
                        })
                        objRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: Number(sendArray[sendIndex].lineQty)
                        })
                        var isSet = objRecord.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'inventorydetailset'
                        })
                        log.debug('Number(sendArray[sendIndex].lineQty', Number(sendArray[sendIndex].lineQty))

                        var subrec = objRecord.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail'
                        });
                        var subrecnumLines = subrec.getLineCount({
                            sublistId: 'inventoryassignment'
                        });
                        log.debug('subrecnumLines', subrecnumLines)
                        if (Number(subrecnumLines) > 0) {
                            log.debug('nuffun')
                        }
                        else {
                            for(var j=0;j<lineArray.length;j++){
                                subrec.selectNewLine({
                                    sublistId: 'inventoryassignment'
                                });
    
                                subrec.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'binnumber',
                                    value: lineArray[j].bin
                                });
                                log.debug('set qty', lineArray[j].qty)
                                subrec.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'quantity',
                                    value: Number(lineArray[j].qty)
                                });
                                subrec.commitLine({
                                    sublistId: 'inventoryassignment'
                                });
                            }
                        }


                        objRecord.commitLine({
                            sublistId: 'item',
                        });
                        continue
                    }
                }
            }
            // var rec = objRecord.save()
            // log.debug('rec',rec)
        }


        const getCount = (id) => {
            var returnArray = new Array()
            var customrecord_build_created_woSearchObj = search.create({
                type: "customrecord_pr_mass_iful_child",
                filters:
                    [
                        ["custrecord_iful_parent_doc", "anyof", id]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            join: "CUSTRECORD_PR_MASS_SO",
                            summary: "GROUP"
                        }),
                        search.createColumn({
                            name: "custrecord_iful_parent_doc",
                            summary: "GROUP"
                        })
                    ]
            });
            var searchResultCount = customrecord_build_created_woSearchObj.runPaged().count;
            log.debug("customrecord_build_created_woSearchObj result count", searchResultCount);
            customrecord_build_created_woSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var soID = result.getValue({
                    name: 'internalid',
                    join: 'CUSTRECORD_PR_MASS_SO',
                    summary: search.Summary.GROUP
                })
                log.debug('soID', soID)
                returnArray.push(soID)
                return true;
            });

            return returnArray

        }
        const getArray = (id) => {
            var returnArray = new Array()
            var customrecord_build_created_woSearchObj = search.create({
                type: "customrecord_pr_mass_iful_child",
                filters:
                    [
                        ["custrecord_iful_parent_doc", "anyof", id]
                    ],
                columns:
                    [
                        "custrecord_pr_mass_so",
                        "custrecord_pr_mass_item",
                        "custrecord_pr_mass_bin",
                        "custrecord_pr_mass_qty",
                        "custrecord_pr_mass_line_qty",
                        "custrecord_mass_room_loc"
                    ]
            });
            var searchResultCount = customrecord_build_created_woSearchObj.runPaged().count;
            log.debug("customrecord_build_created_woSearchObj result count", searchResultCount);
            customrecord_build_created_woSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var so = result.getValue({
                    name: 'custrecord_pr_mass_so'
                })
                var item = result.getValue({
                    name: 'custrecord_pr_mass_item'
                })
                var bin = result.getValue({
                    name: 'custrecord_pr_mass_bin'
                })
                var qty = result.getValue({
                    name: 'custrecord_pr_mass_qty'
                })
                var lineQty = result.getValue({
                    name: 'custrecord_pr_mass_line_qty'
                })
                var room = result.getValue({
                    name: 'custrecord_mass_room_loc'
                })
                var returnObj = new Object()
                returnObj.so = so
                returnObj.item = item
                returnObj.bin = bin
                returnObj.qty = qty
                returnObj.lineQty = lineQty
                returnObj.room = room
                returnArray.push(returnObj)
                return true;
            });
            return returnArray
        }

        return {
            onAction: onAction
        };

    });
