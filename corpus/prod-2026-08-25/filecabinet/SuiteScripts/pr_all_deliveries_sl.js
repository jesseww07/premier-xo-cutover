/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/format'],
    function (log, serverWidget, record, search, url, redirect, format) {
        function onRequest(context) {
            //try {
            var generatingID = context.request.parameters.custom_id;

            if (context.request.method === 'GET') {

                var recLoa = record.load({
                    type:'customrecord_pl_rec_summary',
                    id:generatingID,
                    isDynamic:true
                })
                var date = recLoa.getValue({
                    fieldId:'custrecordpl_rec_sum_date'
                })
                log.debug('start?')
                var form2 = serverWidget.createForm({
                    title: 'All Deliveries'
                });
                log.debug('form?')

                var sublist = form2.addSublist({
                    id: 'sublist',
                    type: serverWidget.SublistType.LIST,
                    label: 'Fulfillment Details'
                });


                sublist.addField({
                    id: 'custpage_doc',
                    label: 'Document',
                    type: serverWidget.FieldType.TEXT,
                });
                sublist.addField({
                    id: 'custpage_date',
                    label: 'Date',
                    type: serverWidget.FieldType.TEXT,
                });
                sublist.addField({
                    id: 'custpage_item',
                    label: 'Item',
                    type: serverWidget.FieldType.TEXT,
                });
                sublist.addField({
                    id: 'custpage_qty',
                    label: 'Quantity',
                    type: serverWidget.FieldType.TEXT,
                });
                sublist.addField({
                    id: 'custpage_customer',
                    label: 'Customer',
                    type: serverWidget.FieldType.TEXT,
                });



       
                var returnData = getData(date)
                var ctr = 0;
                if(returnData.returnFulfillments.length>0){
                    var ifuls = returnData.returnFulfillments
                    for(var x=0;x<ifuls.length;x++){
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_doc',
                                line: ctr,
                                value: ifuls[x].doc
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_doc',
                                line: ctr,
                                value: '  '
                            });
                        }
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_date',
                                line: ctr,
                                value: ifuls[x].date
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_date',
                                line: ctr,
                                value: '  '
                            });
                        }
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_item',
                                line: ctr,
                                value: ifuls[x].item
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_item',
                                line: ctr,
                                value: '  '
                            });
                        }
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_qty',
                                line: ctr,
                                value: ifuls[x].qty
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_qty',
                                line: ctr,
                                value: '  '
                            });
                        }
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_customer',
                                line: ctr,
                                value: ifuls[x].customer
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_customer',
                                line: ctr,
                                value: '  '
                            });
                        }
                        ctr++
                    }
                }
                if(returnData.returnStored.length>0){
                    var stored = returnData.returnStored
                    for(var j=0;j<stored.length;j++){
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_doc',
                                line: ctr,
                                value: stored[j].doc
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_doc',
                                line: ctr,
                                value: '  '
                            });
                        }
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_date',
                                line: ctr,
                                value: stored[j].date
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_date',
                                line: ctr,
                                value: '  '
                            });
                        }
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_item',
                                line: ctr,
                                value: stored[j].item
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_item',
                                line: ctr,
                                value: '  '
                            });
                        }
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_qty',
                                line: ctr,
                                value: stored[j].qty
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_qty',
                                line: ctr,
                                value: '  '
                            });
                        }
                        try {
                            sublist.setSublistValue({
                                id: 'custpage_customer',
                                line: ctr,
                                value: stored[j].customer
                            });
                        }
                        catch (eee) {
                            sublist.setSublistValue({
                                id: 'custpage_customer',
                                line: ctr,
                                value: '  '
                            });
                        }
                        ctr++
                    }
                }
                form2.addSubmitButton()
                context.response.writePage(form2);
            }
        }

        const getData = (generatingID) => {
            var returnFulfillments = getIFULs(generatingID)
            var returnStored = getStoredDeliveries(generatingID)

            var dataSet = new Object()
            dataSet.returnFulfillments = returnFulfillments
            dataSet.returnStored = returnStored
            return dataSet
        }

        const getIFULs = (generatingID) => {
            log.debug('date in iful',generatingID)
            var returnArr = new Array()
            var itemfulfillmentSearchObj = search.create({
                type: "itemfulfillment",
                filters:
                [
                   ["type","anyof","ItemShip"], 
                   "AND", 
                   ["mainline","is","F"], 
                   "AND", 
                   ["accounttype","anyof","COGS"], 
                   "AND", 
                   ["status","anyof","ItemShip:C"], 
                   "AND", 
                   ["shipdate","on",generatingID]
                ],
                columns:
                [
                   "item",
                   "quantity",
                   "entity",
                   "trandate",
                   "shipdate",
                   "tranid"
                ]
             });
             var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
             log.debug("itemfulfillmentSearchObj result count",searchResultCount);
             itemfulfillmentSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var item = result.getValue({
                    name:'item'
                })
                var quantity = result.getValue({
                    name:'quantity'
                })
                var customer = result.getValue({
                    name:'entity'
                })
                var date = result.getValue({
                    name:'shipdate'
                })
                var doc = result.getValue({
                    name:'tranid'
                })

                var returnObj = new Object()
                returnObj.item = item
                returnObj.quantity = quantity
                returnObj.customer = customer
                returnObj.date = date
                returnObj.doc = doc

                returnArr.push(returnObj)
                return true;
             });
             
             return returnArr
        }
        const getStoredDeliveries = (generatingID) => {
            var returnParent = getParent(generatingID)
            var returnData = getChildData(returnParent, generatingID)
            return returnData
        }

        const getChildData = (returnParent, generatingID) => {
            var returnArr = new Array()
            var customrecord_stored_inventory_contentsSearchObj = search.create({
                type: "customrecord_stored_inventory_contents",
                filters:
                [
                   ["custrecord_pr_delivery_record","anyof",returnParent]
                ],
                columns:
                [
                   "custrecord_pr_delivery_record",
                   "custrecord_contents_customer",
                   "custrecord_stored_item",
                   "custrecord_stored_qty"
                ]
             });
             var searchResultCount = customrecord_stored_inventory_contentsSearchObj.runPaged().count;
             log.debug("customrecord_stored_inventory_contentsSearchObj result count",searchResultCount);
             customrecord_stored_inventory_contentsSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var item = result.getValue({
                    name:'custrecord_stored_item'
                })
                var qty = result.getValue({
                    name:'custrecord_stored_qty'
                })
                var customer = result.getValue({
                    name:'custrecord_contents_customer'
                })
                var doc = result.getValue({
                    name:'custrecord_pr_delivery_record'
                })

                var returnObj = new Object()
                returnObj.item = item
                returnObj.qty = qty
                returnObj.customer = customer
                returnObj.date = generatingID
                returnObj.doc = doc

                returnArr.push(returnObj)
                return true;
             });
             
            return returnArr
        }
        const getParent = (generatingID) => {
            var returnArr = new Array()
            var customrecord_pr_delivery_recordSearchObj = search.create({
                type: "customrecord_pr_delivery_record",
                filters:
                [
                   ["custrecord_pr_deliver_status","anyof","3"], 
                   "AND", 
                   ["systemnotes.field","anyof","CUSTRECORD_PR_DELIVER_STATUS"], 
                   "AND", 
                   ["systemnotes.date","on",generatingID], 
                   "AND", 
                   ["systemnotes.newvalue","startswith","Ship"]
                ],
                columns:
                [
                   "custrecord_si_cust_delivery",
                   search.createColumn({
                      name: "id",
                      sort: search.Sort.ASC
                   })
                ]
             });
             var searchResultCount = customrecord_pr_delivery_recordSearchObj.runPaged().count;
             log.debug("customrecord_pr_delivery_recordSearchObj result count",searchResultCount);
             customrecord_pr_delivery_recordSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var id = result.getValue({
                    name:'id'
                })
                returnArr.push(id)
                return true;
             });
             
             return returnArr
        }





        return {
            onRequest: onRequest
        };
    });

