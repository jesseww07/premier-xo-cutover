/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
 define(['N/config', 'N/https', 'N/log', 'N/record', 'N/render', 'N/runtime', 'N/search', 'N/url'],
 /**
  * @param {config} config
  * @param {https} https
  * @param {log} log
  * @param {record} record
  * @param {render} render
  * @param {runtime} runtime
  * @param {search} search
  * @param {url} url
  */
 function (config, https, log, record, render, runtime, search, url) {

     /**
      * Definition of the Suitelet script trigger point.
      *
      * @param {Object} context
      * @param {ServerRequest} context.request - Encapsulation of the incoming request
      * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
      * @Since 2015.2
      */
     function onRequest(context) {
         var id = context.request.parameters.custom_id;
         var locale = context.request.parameters.lang;
         var recordType = context.request.parameters.type;
         log.debug('id', id)
         var searchArray = runSearch(id)
         var xmlString = generateXml(searchArray);
       log.audit('xml string',xmlString)
         context.response.renderPdf({ xmlString: xmlString });

     }
     //project will be the sidemark
     const runSearch = (id) => {
         var returnArray = new Array()
         var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
             type: search.Type.SALES_ORDER,
             filters:
                 [
                     ["internalid", "is", id],
                     "AND",
                     ["mainline", "is", "F"],
                     "AND",
                     ["shipping", "is", "F"],
                     "AND",
                     ["cogs", "is", "F"],
                     "AND",
                     ["taxline", "is", "F"]
                 ],
             columns:
                 [
                     "entity",
                     "shipaddress",
                     "item",
                     "quantity",
                     "tranid",
                     "custcol_pr_room_location",
                     "memo",
                     "location",
                     "custcolcustcol_zastro_vendor",
                 ]
         });
         var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
         log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count", searchResultCount);
         customrecord_zastro_unconsolidated_itemsSearchObj.run().each(function (result) {
             // .run().each has a limit of 4,000 results
             var customer = result.getText({
                 name: 'entity'
             })
             var retCust = returner(customer)
             var item = result.getText({
                 name: 'item'
             })
             var itemId = result.getValue({
                name: 'item'
            })
             var searchBin = binSearch(itemId)
             log.debug('bin',searchBin)
             var bin = searchBin[0]
             var shipAddress = result.getValue({
                 name: 'shipaddress'
             })
             var qty = result.getValue({
                 name: 'quantity'
             })
             var salesOrder = result.getValue({
                 name: 'tranid'
             })
             var roomLocation = result.getValue({
                 name: 'custcol_pr_room_location'
             })
             var project = result.getValue({
                 name: 'memo'
             })
             var soLocation = result.getText({
                 name: 'formulatext'
             })
             var illLocation = result.getText({
                 name: 'location'
             })
             var vendor = result.getText({
                 name: 'custcolcustcol_zastro_vendor'
             });
             var returnObj = new Object()
             returnObj.customer = retCust
             returnObj.item = item
             returnObj.bin = bin
             returnObj.shipAddress = shipAddress
             returnObj.qty = qty
             returnObj.salesOrder = salesOrder
             returnObj.roomLocation = roomLocation
             returnObj.project = project
             returnObj.soLocation = soLocation
             returnObj.illLocation = illLocation
             returnObj.vendor = vendor

             returnArray.push(returnObj)
             return true;
         });
         return returnArray
     }
     var image = "http://7513000.shop.netsuite.com/core/media/media.nl?id=2660&c=7513000&h=wfnd9-nkuOZXpHpn0gNviLknL6mbAahI7R0psJgoXxt38-1X"
     var replace = image.replace(/&/g, '&amp;')

     const binSearch = (item) =>{
         var binArray = new Array()
         log.debug('in bin search', item)
        var inventorybalanceSearchObj = search.create({
            type: "inventorybalance",
            filters:
            [
               ["item","anyof",item]
            ],
            columns:
            [
               search.createColumn({
                  name: "item",
                  sort: search.Sort.ASC
               }),
               "binnumber",
               "location",
               "status",
               "onhand",
               "available"
            ]
         });
         var searchResultCount = inventorybalanceSearchObj.runPaged().count;
         log.debug("inventorybalanceSearchObj result count",searchResultCount);
         inventorybalanceSearchObj.run().each(function(result){
            var binObj = new Object
            var binNum = result.getText({
                name: 'binnumber'
            })
            log.debug('binNum',binNum)
            binArray.push(binNum)
            return true;
         });
        return binArray
     }

     const generateXml = (searchArray) => {
         var xml = '<pdf>'
         xml += '<body margin = "-0.14in -0.6in -0.16in -0.45in">'
         xml += '<table align = "center" style="padding-top: 0px;">'
         xml += '<tr>'
         var itemCount = 0;
         var totalCount = 0;
         var cartonCount = 0;
         for (var x = 0; x < searchArray.length; x++) {
             itemCount += 1;
             totalCount += 1;
             cartonCount += 1;
        
             if (itemCount == 3) {
                 xml += '</tr>';
                 xml += '<tr>';
                 itemCount = 1;
             }
             if (totalCount == 11) {
                 xml += '</tr>';
                 xml += '</table>';
                 xml += '<pbr />';
                 xml += '<table align = "center" style="padding-top: 0px;">'
                
                 xml += '<tr>';
                 totalCount = 1;
                 itemCount = 1;
             } 
             xml += '<td>'
             if (totalCount > 2) {
                 
                 xml += '<table style="width: 4in; height: 2in; margin-top: -5px;">'
                
             } else {
                 log.debug('yyyyy_are_we_here', x);
                 xml += '<table style="width: 4in; height: 2.02in; margin-top: -5px;">'
             }
             //     xml += '<table cellpadding="0" cellspacing="0" border="0" style="width: 3.9in; height: 2in; border: 0.1px solid black; border-radius: 25px;">'
             //     }
             // // } else {
             // //     xml += '<table style="width: 3.9in; height: 3.28in; border: 0.1px solid black;">'
             // } else {
             //     if (x % 2 == 0 || x == 0) {
             //     xml += '<table cellpadding="0" cellspacing="0" border="0" style="width: 3.9in; height: 2in; border: 0.1px solid black; border-radius: 25px; margin-right: -10px;">'
             //         } else {
             //     xml += '<table cellpadding="0" cellspacing="0" border="0" style="width: 3.9in; height: 2in; border: 0.1px solid black; border-radius: 25px; margin-left: -10px;">'
             //         }
             // }
             xml += '<tr>'
             xml += '<td align="center" style="font-size: 13px; padding-bottom: 0; padding-top: 5px; width: 100%;"><b><i>' + searchArray[x].illLocation + ' - ' + searchArray[x].bin + '</i></b></td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="font-size: 13px; padding-top: 0; padding-bottom: 0; width: 100%;"><b>Item: ' + searchArray[x].item + '</b></td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="text-transform: uppercase; font-size: 13px; padding-top: 0; padding-bottom: 0; width: 100%;"><b>' + searchArray[x].customer + '</b></td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="font-size: 13px; padding-top: 0; padding-bottom: 0; width: 100%;">SideMark: ' + searchArray[x].project + '</td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="font-size: 13px; padding-top: 0; padding-bottom: 0; width: 100%;">Order: ' + searchArray[x].salesOrder + '</td>'
             xml += '</tr>'
             log.debug('search_array_room_location', searchArray[x].roomLocation.length + ' x: ' + x);
             if (searchArray[x].roomLocation.length > 62) {
                 searchArray[x].roomLocation = searchArray[x].roomLocation.substr(0,62);
             }
             if (searchArray[x].vendor != null && searchArray[x].vendor != '') {
             xml += '<tr>'
             xml += '<td style="text-transform: uppercase; font-size: 13px; padding-top: 0; padding-bottom: 0; width: 100%;"><b>' + searchArray[x].vendor + '</b></td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="font-size: 13px; padding-top: 0; padding-bottom: 0; width: 100%;">' + searchArray[x].roomLocation + '</td>'
             xml += '</tr>'
             } else {
                 xml += '<tr>'
                 xml += '<td style="font-size: 13px; padding-top: 0; padding-bottom: 0; width: 100%;">' + searchArray[x].roomLocation + '</td>'
                 xml += '</tr>'
             }
             xml += '</table>'
             xml += '</td>'
         }
         if (itemCount == 1) {
             log.debug('zzzz_do_we_get_here');
             xml += '<td>'
             xml += '<table style="width: 4in; height: 2.07in; margin-top: -5px;">'
             xml += '<tr>'
             xml += '<td align="center" style="padding-bottom: 0; padding-top: 5px; width: 100%;"></td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="padding-top: 0; padding-bottom: 0; width: 100%;"></td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="padding-top: 0; padding-bottom: 0; width: 100%;"></td>';
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="padding-top: 0; padding-bottom: 0; width: 100%;"></td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="padding-top: 0; padding-bottom: 0; width: 100%;"></td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="padding-top: 0; padding-bottom: 0; width: 100%;"></td>'
             xml += '</tr>'
             xml += '<tr>'
             xml += '<td style="padding-top: 0; padding-bottom: 0; width: 100%;"></td>'
             xml += '</tr>'
             xml += '</table>'
             xml += '</td>'
         }
         xml += '</tr>'
         xml += '</table>'
         xml += '</body>'
         xml += '</pdf>'
         return xml
     }

     function returner(word) {
         word = word.replace(/&/g, "&amp;")
         word = word.replace(/</g, "&lt;")
         word = word.replace(/>/g, "&gt;")
         word = word.replace(/'/g, "&#39;")
         word = word.replace(/"/g, "&quot;");
         return word
     }

     return {
         onRequest: onRequest
     };

 });