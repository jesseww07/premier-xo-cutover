define(['N/log', 'N/ui', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/render', 'N/email'], function (log, ui, serverWidget, record, search, url, redirect, render, email) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    var exports = {};
    function beforeLoad(context) {
        try {
            log.debug('context', context)
            let currentRecord = context.newRecord
            log.debug('currentRecord.id', currentRecord.id)
            if (currentRecord.id) {
                var name = currentRecord.getValue({fieldId:'shipmentnumber'})
                AddSublist(context, currentRecord.id, name)
            }
        }
        catch (e) {
            log.debug('e', e)
        }
    }
    const getAffiliates = (id) => {
        var returnArr = new Array()
        
        var transactionSearchObj = search.create({
            type: "transaction",
            filters:
                [
                    ["type", "anyof", "CashSale", "CustInvc"],
                    "AND",
                    ["createdfrom", "anyof", id],
                    "AND",
                    ["mainline", "is", "T"]
                ],
            columns:
                [
                    "internalid"
                ]
        });
        var searchResultCount = transactionSearchObj.runPaged().count;
        log.debug("transactionSearchObj result count", searchResultCount);
        transactionSearchObj.run().each(function (result) {
            // .run().each has a limit of 4,000 results

            returnArr.push(result.getValue({ name: 'internalid' }))
            return true;
        });
        if (returnArr.length>0){
            returnArr.push(id)
        }
        return returnArr
    }
    const getSecondLevelAffiliates = (id) => {
        log.debug('WHATS IN RUN 2', id)
        var returnArr = new Array()
        var transactionSearchObj = search.create({
            type: "transaction",
            filters:
                [
                    // ["type", "anyof", "CashSale", "CustInvc"],
                    // "AND",
                    ["type","anyof","CashRfnd","RtnAuth","CardRfnd","CustCred","CustRfnd"], 
                    "AND", 
                    ["createdfrom", "anyof", id],
                    "AND",
                    ["mainline", "is", "T"]
                ],
            columns:
                [
                    "internalid"
                ]
        });
        var searchResultCount = transactionSearchObj.runPaged().count;
        log.debug("transactionSearchObj result count", searchResultCount);
        transactionSearchObj.run().each(function (result) {
            // .run().each has a limit of 4,000 results
            returnArr.push(result.getValue({ name: 'internalid' }))
            return true;
        });
        return returnArr
    }
    const getItems = (docArr,relatedRec) => {
        log.debug('docArr',docArr)
        var returnArr = new Array()
        var transactionSearchObj = search.create({
            type: "transaction",
            filters:
                [
                    ["type", "anyof", "RtnAuth", "CustCred"],
                    "AND",
                    ["createdfrom", "anyof", docArr],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"], 
      "AND", 
      ["accounttype","anyof","Income"]
                ],
            columns:
                [
                    "trandate",
                    "tranid",
                    "type",
                    "createdfrom",
                    "item",
                    "quantity",
                    "rate",
                    "internalid",
                    "status",
                  "accounttype"
                ]
        });
        var searchResultCount = transactionSearchObj.runPaged().count;
        log.debug("transactionSearchObj result count", searchResultCount);
        transactionSearchObj.run().each(function (result) {
            // .run().each has a limit of 4,000 results
            var returnObj = new Object()
            returnObj.date = result.getValue({ name: 'trandate' })
            var int = result.getValue({ name: 'internalid' })
            log.debug('int',int)
            log.debug('related red',relatedRec)
            returnObj.doc = int
            returnObj.docText = result.getValue({ name: 'tranid' })
            returnObj.type = result.getValue({ name: 'type' })
            returnObj.createdfrom = result.getText({ name: 'createdfrom' })
            returnObj.createdid= result.getValue({ name: 'createdfrom' })
            //returnObj.createdfrom = '-'
            returnObj.item = result.getText({ name: 'item' })
            returnObj.qty = result.getValue({ name: 'quantity' })
            returnObj.rate = result.getValue({ name: 'rate' })
            returnObj.status = result.getValue({ name: 'status' })
                      returnObj.type = result.getValue({ name: 'accounttype' })
            returnArr.push(returnObj)
            return true;
        });
      log.audit('returnArr',returnArr)
        return returnArr
    }
    const getData = (id) => {
        var docArr = new Array()
        var customrecord_consolidated_special_orderSearchObj = search.create({
            type: "customrecord_consolidated_special_order",
            filters:
            [
               ["custrecord_inbound_shipment","anyof",id], 
               "AND", 
               ["custrecord_special_consolidated_po.mainline","is","T"]
            ],
            columns:
            [
               search.createColumn({
                  name: "trandate",
                  join: "CUSTRECORD_SPECIAL_CONSOLIDATED_PO"
               }),
               search.createColumn({
                  name: "tranid",
                  join: "CUSTRECORD_SPECIAL_CONSOLIDATED_PO"
               }),
               search.createColumn({
                  name: "statusref",
                  join: "CUSTRECORD_SPECIAL_CONSOLIDATED_PO"
               }),
               search.createColumn({
                  name: "type",
                  join: "CUSTRECORD_SPECIAL_CONSOLIDATED_PO"
               }),
               search.createColumn({
                  name: "createdfrom",
                  join: "CUSTRECORD_SPECIAL_CONSOLIDATED_PO"
               }),
               "custrecord_special_consolidated_item",
               "custrecord_special_consolidated_qty",
               "custrecord_consol_item_rate"
            ]
         });
         var searchResultCount = customrecord_consolidated_special_orderSearchObj.runPaged().count;
         log.debug("customrecord_consolidated_special_orderSearchObj result count",searchResultCount);
         customrecord_consolidated_special_orderSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var returnObj = new Object()
            returnObj.date = result.getValue({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_PO', name: 'trandate' })
            returnObj.doc = result.getValue({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_PO', name: 'tranid' })
            returnObj.docText =result.getText({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_PO', name: 'tranid' })
            returnObj.createdfrom = result.getText({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_PO', name: 'createdfrom' })
            returnObj.createdid = result.getValue({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_PO', name: 'createdfrom' })
            returnObj.item = result.getText({ name: 'custrecord_special_consolidated_item' })
            returnObj.qty = result.getValue({ name: 'custrecord_special_consolidated_qty' })
            returnObj.rate = result.getValue({ name: 'custrecord_consol_item_rate' })
            returnObj.status = result.getValue({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_PO', name: 'statusref' })
            returnObj.type = result.getValue({ join: 'CUSTRECORD_SPECIAL_CONSOLIDATED_PO', name: 'type' })
            docArr.push(returnObj)
            return true;
         });
         
        return docArr
    }
    const getIRData = (name) => {
        var docArr = new Array()
        var itemreceiptSearchObj = search.create({
            type: "itemreceipt",
            filters:
            [
               ["type","anyof","ItemRcpt"], 
               "AND", 
               ["mainline","is","F"], 
               "AND", 
               ["datecreated","within","today"], 
               "AND", 
               ["shipmentnumber","anyof",name]
            ],
            columns:
            [
               "trandate",
               "tranid",
               "item",
               "quantity",
               search.createColumn({
                  name: "binnumber",
                  join: "inventoryDetail"
               }),
               search.createColumn({
                  name: "quantity",
                  join: "inventoryDetail"
               }),
               "shipmentnumber"
            ]
         });
         var searchResultCount = itemreceiptSearchObj.runPaged().count;
         log.debug("itemreceiptSearchObj result count",searchResultCount);
         itemreceiptSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
            var returnObj = new Object()
            returnObj.date = result.getValue({ name: 'trandate' })
            returnObj.doc = result.getValue({ name: 'tranid' })
            returnObj.docText =result.getText({ name: 'tranid' })
            returnObj.item = result.getText({ name: 'item' })
            returnObj.qty = result.getValue({ name: 'quantity' })
            returnObj.bin = result.getText({ name: 'binnumber', join:'inventoryDetail' })
            docArr.push(returnObj)
            return true;
         });
         
        return docArr
    }
    function AddSublist(Context, id, name) {
        log.debug('hi adding sublist')
        //create a custom tab to hold our Batch Approver Details
        var tab = Context.form.addTab({ id: 'custpage_related_records', label: 'Related Records' });


        // add the custom SUBLST to the TAB
        var objSublist = Context.form.addSublist({
            id: 'custpage_sublist_1',
            type: serverWidget.SublistType.LIST,
            label: 'List of All Affiliated Records',
            tab: 'custpage_related_records'
        });
        objSublist.addField({
            id: 'custpage_date',
            label: 'Date',
            type: serverWidget.FieldType.TEXT,
        });
        objSublist.addField({
            id: 'custpage_doc',
            label: 'Document #',
            type: serverWidget.FieldType.TEXT
        });
        objSublist.addField({
            id: 'custpage_status',
            label: 'Status',
            type: serverWidget.FieldType.TEXT,
        });
        objSublist.addField({
            id: 'custpage_type',
            label: 'Type',
            type: serverWidget.FieldType.TEXT,
        });
        objSublist.addField({
            id: 'custpage_createdfrom',
            label: 'Created From',
            type: serverWidget.FieldType.TEXT,
        });
        objSublist.addField({
            id: 'custpage_item',
            label: 'Item',
            type: serverWidget.FieldType.TEXT,
        });
        objSublist.addField({
            id: 'custpage_qty',
            label: 'Quantity',
            type: serverWidget.FieldType.TEXT,
        });
        objSublist.addField({
            id: 'custpage_rate',
            label: 'Rate',
            type: serverWidget.FieldType.TEXT,
        });

        var objSublistSearch = getData(id)
        log.debug('objSublistSearch',objSublistSearch)
        if (objSublistSearch) {
            ctr = 0
            var blank = '-'
            log.audit('objSublistSearch',objSublistSearch)
            for (var x = 0; x < objSublistSearch.length; x++) {
                var currentRecRead = objSublistSearch[x].doc
        
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_date',
                        line: ctr,
                        value: objSublistSearch[x].date
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_date',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_doc',
                        line: ctr,
                        value: objSublistSearch[x].doc
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_doc',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_type',
                        line: ctr,
                        value: objSublistSearch[x].type
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_type',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_createdfrom',
                        line: ctr,
                        value: objSublistSearch[x].createdfrom
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_createdfrom',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_item',
                        line: ctr,
                        value: objSublistSearch[x].item
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_item',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_qty',
                        line: ctr,
                        value: Math.abs(objSublistSearch[x].qty)
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_qty',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_rate',
                        line: ctr,
                        value: objSublistSearch[x].rate
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_rate',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_status',
                        line: ctr,
                        value: objSublistSearch[x].status
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_status',
                        line: ctr,
                        value: blank
                    });
                }
                ctr++
            }
        }











        var tabTwo = Context.form.addTab({ id: 'custpage_receipts', label: 'Item Receipts Created Today' });

        // add the custom SUBLST to the TAB
        var objSublist = Context.form.addSublist({
            id: 'custpage_sublist_2',
            type: serverWidget.SublistType.LIST,
            label: 'List of All Affiliated Records',
            tab: 'custpage_receipts'
        });
        objSublist.addField({
            id: 'custpage_date',
            label: 'Date',
            type: serverWidget.FieldType.TEXT,
        });
        objSublist.addField({
            id: 'custpage_doc',
            label: 'Document #',
            type: serverWidget.FieldType.TEXT
        });
        objSublist.addField({
            id: 'custpage_item',
            label: 'Item',
            type: serverWidget.FieldType.TEXT,
        });
        objSublist.addField({
            id: 'custpage_qty',
            label: 'Quantity',
            type: serverWidget.FieldType.TEXT,
        });
        objSublist.addField({
            id: 'custpage_bin',
            label: 'Bin',
            type: serverWidget.FieldType.TEXT,
        });

        var objSublistSearch = getIRData(name)
        log.debug('objSublistSearch',objSublistSearch)
        if (objSublistSearch) {
            ctr = 0
            var blank = '-'
            log.audit('objSublistSearch',objSublistSearch)
            for (var x = 0; x < objSublistSearch.length; x++) {
                var currentRecRead = objSublistSearch[x].doc
        
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_date',
                        line: ctr,
                        value: objSublistSearch[x].date
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_date',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_doc',
                        line: ctr,
                        value: objSublistSearch[x].doc
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_doc',
                        line: ctr,
                        value: blank
                    });
                }
              
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_item',
                        line: ctr,
                        value: objSublistSearch[x].item
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_item',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_qty',
                        line: ctr,
                        value: Math.abs(objSublistSearch[x].qty)
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_qty',
                        line: ctr,
                        value: blank
                    });
                }
                try {
                    objSublist.setSublistValue({
                        id: 'custpage_bin',
                        line: ctr,
                        value: objSublistSearch[x].bin
                    });
                }
                catch (eee) {
                    objSublist.setSublistValue({
                        id: 'custpage_bin',
                        line: ctr,
                        value: blank
                    });
                }
               
                ctr++
            }
        }
    }


    exports.beforeLoad = beforeLoad;
    return exports;
});

