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


     const runSearch = (id) => {
         var returnArray = new Array()
         var transactionSearchObj = search.create({
            type: "transaction",
            filters:
            [
               ["internalidnumber","equalto",id], 
               "AND", 
               ["mainline","is","F"], 
               "AND", 
               ["shipping","is","F"], 
               "AND", 
               ["taxline","is","F"], 
               "AND", 
               ["item.type","anyof","InvtPart","Kit"]
            ],
            columns:
            [
               search.createColumn({
                  name: "entityid",
                  join: "customer"
               }),
               search.createColumn({
                  name: "parent",
                  join: "customer"
               }),
               "item",
               search.createColumn({
                  name: "displayname",
                  join: "item"
               }),
               "custcol_pr_room_location"
            ]
         });
         var searchResultCount = transactionSearchObj.runPaged().count;
         log.debug("transactionSearchObj result count",searchResultCount);
         transactionSearchObj.run().each(function(result){
            // .run().each has a limit of 4,000 results
    
             var customer = result.getValue({
                name: "entityid",
                join: "customer"
             })
             if (customer) {
                customer = customer.replace(/&/g, '&amp;');
            }
            let sploot = customer.split(":")[1]
            log.audit('sploot',sploot)
             var item = result.getText({
                 name: 'item'
             })
            
             if (item) {
                item = item.replace(/&/g, '&amp;');
            }
           
             var roomLocation = result.getValue({
                 name: 'custcol_pr_room_location'
             })
            //  if (roomLocation == ''){
            //      let room = getRoom(id, soId, itemId)
            //      log.audit('room location object', room)
            //      roomLocation = room.room
            //  }
             if (roomLocation) {
                roomLocation = roomLocation.replace(/&/g, '&amp;');
            }
             
           
            
            var displayName = result.getValue({
                name: "displayname",
                join: "item"
             })
             log.debug('display name',displayName)
             var parent = result.getText({
                name: "parent",
                join: "customer"
             })
             log.debug('parent name',parent)
             var parent = returner(parent)
             log.debug('returned parent name',parent)
             var returnObj = new Object()
             returnObj.customer = customer
             returnObj.sploot = sploot
             returnObj.item = item
             returnObj.roomLocation = roomLocation
            

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
                 xml += '<td style="font-size: 25px;" align="center">' + searchArray[x].sploot + '</td>'
                 xml += '</tr>'
                 xml += '<tr>'
                 xml += '<td style="font-size: 25px;" align="center">Product Number:</td>'
                 xml += '</tr>'
                 xml += '<tr>'
           if (searchArray[x].item.length < 25){
                 xml += '<td style="font-size: 25px;" align="center"><b>' + searchArray[x].item + '</b></td>'
           }
           else{
             xml += '<td style="font-size: 25px;" align="center"><b>' + searchArray[x].item + '</b></td>'
           }
                 xml += '</tr>'
                 xml += '<tr>'
                 xml += '<td style="font-size: 25px;" align="center">NetSuite Product Code: <b>' + searchArray[x].displayName + '</b></td>'
                 xml += '</tr>'
                 xml += '<tr>'
                 xml += '<td style="font-size:25px" align="center">Mark Type:</td>'
                 xml += '</tr>'
                 xml += '<tr>'
                 xml += '<td style="font-size:25px" align="center"> <b>'+ searchArray[x].roomLocation +'</b></td>'
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
