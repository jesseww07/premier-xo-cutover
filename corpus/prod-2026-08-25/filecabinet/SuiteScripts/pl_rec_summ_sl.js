/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
 define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/file', 'N/render'],
 function (log, serverWidget, record, search, url, redirect, file, render) {
     function onRequest(context) {

         if (context.request.method === 'GET') {
             var checking = context.request.parameters
             var originitatingID = context.request.parameters.custom_id

             var loadRec = record.load({
                 type: 'itemreceipt',
                 id: originitatingID,
                 isDynamic:true
             });

             var returnArray = getItems(loadRec)
           

             var form2 = serverWidget.createForm({
                 title: 'Item Overview Report'
             });

             var sublist = form2.addSublist({
                 id: 'sublist',
                 type: serverWidget.SublistType.LIST,
                 label: 'Open Sales Order Summary'
             });
             // var viewUrl = sublist.addField({
             //     id: 'view',
             //     label: 'View',
             //     type: serverWidget.FieldType.URL,
             //     source: null
             // }).linkText = 'VIEW'

             // var editUrl = sublist.addField({
             //     id: 'edit',
             //     label: 'Edit',
             //     type: serverWidget.FieldType.URL,
             //     source: null
             // }).linkText = 'EDIT';

          
             var internalId = sublist.addField({
                 id: 'custpage_internalid',
                 label: 'ID',
                 type: serverWidget.FieldType.TEXT,
             });
             var doc = sublist.addField({
                 id: 'custpage_doc',
                 label: "Ship Date",
                 type: serverWidget.FieldType.TEXT,
             });
             var trayLocation = sublist.addField({
                 id: 'custpage_loc',
                 label: 'Location',
                 type: serverWidget.FieldType.TEXT,
             });
             var soNum = sublist.addField({
                 id: 'custpage_date',
                 label: 'Date',
                 type: serverWidget.FieldType.TEXT,
             });
             var trayLocation = sublist.addField({
                 id: 'custpage_entity',
                 label: 'Customer',
                 type: serverWidget.FieldType.TEXT,
             });
       
             var qtyNeeded = sublist.addField({
                 id: 'custpage_item',
                 label: 'Item',
                 type: serverWidget.FieldType.TEXT,
             });
             var vendid = sublist.addField({
                 id: 'custpage_qty',
                 label: 'Qty Ordered',
                 type: serverWidget.FieldType.TEXT,
             });
             var vendid2 = sublist.addField({
                 id: 'custpage_qtycommit',
                 label: 'Qty Committed',
                 type: serverWidget.FieldType.TEXT,
             });
             var vendid3 = sublist.addField({
                 id: 'custpage_qtyship',
                 label: 'Qty Shipped',
                 type: serverWidget.FieldType.TEXT,
             });


             var results = [];
             var netsuiteSiteUrl = 'https://system.na1.netsuite.com';
             var ctr = 0;
             var domain = url.resolveDomain({
                 hostType: url.HostType.APPLICATION
             });
             var salesorderSearchObj = search.create({
                 type: "salesorder",
                 filters:
                 [
                    ["type","anyof","SalesOrd"], 
                    "AND", 
                    ["mainline","is","F"], 
                    "AND", 
                    ["taxline","is","F"], 
                    "AND", 
                    ["shipping","is","F"], 
                    "AND", 
                    ["item","anyof",returnArray], 
                    "AND", 
                    ["formulanumeric: CASE WHEN {quantity} - {quantityshiprecv} > 0 THEN 1 ELSE 0 END","greaterthan","0"], 
                    "AND", 
                    ["status","anyof","SalesOrd:E","SalesOrd:D","SalesOrd:B","SalesOrd:A"]
                 ],
                 columns:
                 [
                    "internalid",
                    "trandate",
                    "tranid",
                    "item",
                    "quantity",
                    "quantitycommitted",
                    "quantityshiprecv",
                    "location",
                    "entity"
                 ]
              });
              var searchResultCount = salesorderSearchObj.runPaged().count;
              log.debug("salesorderSearchObj result count",searchResultCount);
              salesorderSearchObj.run().each(function(result){
      
                 var customer = result.getText('entity')
                 var date = result.getValue('trandate')
                 var location = result.getText('location')
                 var internal = result.getValue('internalid')
                 var qty = result.getValue('quantity')
                 var qtyCommit = result.getValue('quantitycommitted')
                 var qtyShip = result.getValue('quantityshiprecv')
                 var doc = result.getValue('tranid')
                 var item = result.getText('item')

                 var blank = ''
                 sublist.setSublistValue({
                     id: 'custpage_internalid',
                     line: ctr,
                     value: result.getValue('internalid')
                 });
                 // sublist.setSublistValue({
                 //     id: 'view',
                 //     line: ctr,
                 //     value: 'https://' + domain + viewUrl
                 // });

                 // sublist.setSublistValue({
                 //     id: 'edit',
                 //     line: ctr,
                 //     value: 'https://' + domain + editUrl
                 // });
                 try {
                     sublist.setSublistValue({
                         id: 'custpage_loc',
                         line: ctr,
                         value: location
                     });
                 }
                 catch (e) {
                     log.debug('loc', e)
                     sublist.setSublistValue({
                         id: 'custpage_loc',
                         line: ctr,
                         value: ' '
                     });
                 }
                 try {
                     sublist.setSublistValue({
                         id: 'custpage_doc',
                         line: ctr,
                         value: doc
                     });
                 }
                 catch (e) {
                     log.debug('loc', e)
                     sublist.setSublistValue({
                         id: 'custpage_doc',
                         line: ctr,
                         value: ' '
                     });
                 }
                 try {
                     sublist.setSublistValue({
                         id: 'custpage_qty',
                         line: ctr,
                         value: qty
                     });
                 }
                 catch (e) {
                     sublist.setSublistValue({
                         id: 'custpage_qty',
                         line: ctr,
                         value: 0
                     });
                 }
                 try {
                     sublist.setSublistValue({
                         id: 'custpage_qtycommit',
                         line: ctr,
                         value: qtyCommit
                     });
                 }
                 catch (e) {
                     sublist.setSublistValue({
                         id: 'custpage_qtycommit',
                         line: ctr,
                         value: 0
                     });
                 }
                 try {
                     sublist.setSublistValue({
                         id: 'custpage_qtyship',
                         line: ctr,
                         value: qtyShip
                     });
                 }
                 catch (e) {
                     sublist.setSublistValue({
                         id: 'custpage_qtyship',
                         line: ctr,
                         value: 0
                     });
                 }

             

                 try {
                     sublist.setSublistValue({
                         id: 'custpage_entity',
                         line: ctr,
                         value: customer
                     });
                 }
                 catch (e) {
                     sublist.setSublistValue({
                         id: 'custpage_entity',
                         line: ctr,
                         value: blank
                     });
                 }


                 try {
                     sublist.setSublistValue({
                         id: 'custpage_item',
                         line: ctr,
                         value: item
                     });
                 }
                 catch (e) {
                     sublist.setSublistValue({
                         id: 'custpage_item',
                         line: ctr,
                         value: blank
                     });
                 }
                 
                 try {
                     sublist.setSublistValue({
                         id: 'custpage_date',
                         line: ctr,
                         value: result.getValue({ name: 'trandate' })
                     });
                 }
                 catch (e) {
                     sublist.setSublistValue({
                         id: 'custpage_date',
                         line: ctr,
                         value: blank
                     });
                 }


                 ctr++
                 //}
                 return true;
             });

             form2.addSubmitButton('Save')
             context.response.writePage(form2);

         }
     }

     const getItems = (itemRec) => {
         var returnArray = new Array()
         var numLines = itemRec.getLineCount({
             sublistId: 'item'
         });
         log.debug('numLines', numLines)
         for (var x = 0; x < numLines; x++) {
             var subrec = itemRec.selectLine({
                 sublistId: 'item',
                 line: x
             });
             var item = itemRec.getCurrentSublistValue({
                 sublistId: 'item',
                 fieldId: 'item'
             });
             returnArray.push(item)
     }
     return returnArray
 }


     return {
         onRequest: onRequest
     };
 });