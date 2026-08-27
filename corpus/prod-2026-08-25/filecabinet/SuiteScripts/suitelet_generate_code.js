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
         log.debug('test', id)
         var searchArray = runSearch(id)
         var xmlString = generateXml(searchArray);
         context.response.renderPdf({ xmlString: xmlString });

     }

     const getRoom = (id, so, item) => {
        var transactionSearchObj = search.create({
            type: "transaction",
            filters:
            [
               ["mainline","is","F"], 
               "AND", 
               ["custcol_zastro_unconsolidated_no","anyof",id], 
               "AND", 
               ["internalidnumber","equalto",so], 
               "AND", 
               ["item","anyof",item]
            ],
            columns:
            [
               "custcol_pr_room_location",
               "tranid"
            ]
         });
         var searchResultCount = transactionSearchObj.runPaged().count;
         log.debug("transactionSearchObj result count",searchResultCount);
         transactionSearchObj.run().each(function(result){
             roomObj = new Object()
            var room = result.getValue({
                name: 'custcol_pr_room_location'
            })
            roomObj.room = room
            return true;
         });
         
         return roomObj
     }

//project will be the sidemark
     const runSearch = (id) => {
         var returnArray = new Array()
         var customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
             type: "customrecord_zastro_unconsolidated_items",
             filters:
             [
                ["custrecord_zastro_po_item_list","anyof",id]
             ],
             columns:
             [
                "custrecord_zastro_customer",
                "custrecord_zastro_ship_address",
                "custrecord_zastro_item_name",
                "custrecord_zastro_qty",
                "custrecord_zastro_so_no",
                "custrecord_zastro_location_home",
                "custrecord_zastro_project",
                "custrecord_zastro_project",
                //"custrecord_zastro_vendor",
                search.createColumn({
                    name: "formulatext1",
                    formula: "{custrecord_zastro_po_item_list.custrecord_zastro_vendor}"
                 }),
                search.createColumn({
                   name: "formulatext2",
                   formula: "{custrecord_zastro_po_item_list.custrecord_ill_location}"
                }),
                search.createColumn({
                   name: "displayname",
                   join: "CUSTRECORD_ZASTRO_ITEM_NAME"
                }),
                search.createColumn({
                   name: "parent",
                   join: "CUSTRECORD_ZASTRO_CUSTOMER"
                }),
             ]
          });
          var searchResultCount = customrecord_zastro_unconsolidated_itemsSearchObj.runPaged().count;
          log.debug("customrecord_zastro_unconsolidated_itemsSearchObj result count",searchResultCount);
          customrecord_zastro_unconsolidated_itemsSearchObj.run().each(function(result){
             // .run().each has a limit of 4,000 results
             var customer = result.getText({
                 name: 'custrecord_zastro_customer'
             })
             if (customer) {
                customer = customer.replace(/&/g, '&amp;');
            }
            let sploot = customer.split("-")[1]
            log.audit('sploot',sploot)
             var item = result.getText({
                 name: 'custrecord_zastro_item_name'
             })
             var itemId = result.getValue({
                name: 'custrecord_zastro_item_name'
            })
             if (item) {
                item = item.replace(/&/g, '&amp;');
            }
             var shipAddress = result.getValue({
                 name: 'custrecord_zastro_ship_address'
             })
             if (shipAddress) {
                shipAddress = shipAddress.replace(/&/g, '&amp;');
            }
             var qty = result.getValue({
                 name: 'custrecord_zastro_qty'
             })
             if (qty) {
                qty = qty.replace(/&/g, '&amp;');
            }
             var salesOrder = result.getText({
                 name: 'custrecord_zastro_so_no'
             })
             if (salesOrder) {
                salesOrder = salesOrder.replace(/&/g, '&amp;');
            }
            var soId = result.getValue({
                name: 'custrecord_zastro_so_no'
            })
            log.audit('soId',soId)
             var roomLocation = result.getValue({
                 name: 'custrecord_zastro_location_home'
             })
             if (roomLocation == ''){
                 let room = getRoom(id, soId, itemId)
                 log.audit('room location object', room)
                 roomLocation = room.room
             }
             if (roomLocation) {
                roomLocation = roomLocation.replace(/&/g, '&amp;');
            }
             var project = result.getValue({
                 name: 'custrecord_zastro_project'
             })
             if (project) {
                project = project.replace(/&/g, '&amp;');
            }
            //  var soLocation = result.getText({
            //      name: 'formulatext'
            //  })
            //  if (soLocation) {
            //     soLocation = soLocation.replace(/&/g, '&amp;');
            // }
            var vendor = result.getValue({
                name: 'formulatext1'
            });
            log.debug('vendor', vendor);
            if (vendor) {
                vendor = vendor.replace(/&/g, '&amp;');
            }
            var illLocation = result.getValue({
                name: 'formulatext2'
            })
            log.debug('ill_location', illLocation)
             if (illLocation) {
                illLocation = illLocation.replace(/&/g, '&amp;');
            }
            var displayName = result.getValue({
                name: "displayname",
                join: "CUSTRECORD_ZASTRO_ITEM_NAME"
             })
             log.debug('display name',displayName)
             var parent = result.getText({
                name: "parent",
                join: "CUSTRECORD_ZASTRO_CUSTOMER"
             })
             log.debug('parent name',parent)
             var parent = returner(parent)
             log.debug('returned parent name',parent)
             var returnObj = new Object()
             returnObj.customer = customer
             returnObj.sploot = sploot
             returnObj.item = item
             returnObj.shipAddress = shipAddress
             returnObj.qty = qty
             returnObj.salesOrder = salesOrder
             returnObj.roomLocation = roomLocation
             returnObj.project = project
             //returnObj.soLocation = soLocation
                returnObj.illLocation = illLocation
           returnObj.vendor = vendor
           returnObj.displayName = displayName
           returnObj.parent = parent
           log.debug('returnObj',returnObj)

             returnArray.push(returnObj)
             return true;
          });
          return returnArray
     }
     var image = "http://7513000.shop.netsuite.com/core/media/media.nl?id=2660&c=7513000&h=wfnd9-nkuOZXpHpn0gNviLknL6mbAahI7R0psJgoXxt38-1X"
     var replace = image.replace(/&/g, '&amp;')

     const generateXml = (searchArray) => {
        log.audit('searchArray',searchArray)
        var xml = '<pdf>'
        for (var x = 0; x < searchArray.length; x++) {

               //  xml += '<body padding="0.1in 0.2in 0.1in 0.1in" size="6in x 4in" background="' + replace + '" background-position="center">'
               xml += '<body padding="0.1in 0.2in 0.1in 0.1in" size="6in x 4in">'
                xml += '<table style="width:100%; height: 100%">'
                xml += '<tr>'
                xml += '<td style="font-size: 25px;" align="center"><b>' + searchArray[x].parent + '</b></td>'
                xml += '</tr>'
                xml += '<tr>'
                xml += '<td style="font-size: 37px;" align="center">' + searchArray[x].sploot + '</td>'
                xml += '</tr>'
                xml += '<tr>'
                xml += '<td style="font-size: 25px;" align="center">Product Number:</td>'
                xml += '</tr>'
                xml += '<tr>'
                xml += '<td style="font-size: 35px;" align="center"><b>' + searchArray[x].item + '</b></td>'
                xml += '</tr>'
                xml += '<tr>'
                if (searchArray[x].item.length < 20){
                    xml += '<td style="font-size: 37px;" align="center"><b>' + searchArray[x].displayName + '</b></td>'
              }
              else{
                xml += '<td style="font-size: 30px;" align="center"><b>' + searchArray[x].displayName + '</b></td>'
              }
                xml += '</tr>'
                xml += '<tr>'
                xml += '<td style="font-size:25px" align="center">Mark Type:</td>'
                xml += '</tr>'
                xml += '<tr>'
               if (searchArray[x].item.length < 30){
                    xml += '<td style="font-size: 37px;" align="center"><b>' + searchArray[x].roomLocation + '</b></td>'
              }
              else{
                xml += '<td style="font-size: 20px;" align="center"><b>' + searchArray[x].roomLocation + '</b></td>'
              }
                xml += '</tr>'
                xml += '</table>'
                xml += '</body>'

            
        }
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
