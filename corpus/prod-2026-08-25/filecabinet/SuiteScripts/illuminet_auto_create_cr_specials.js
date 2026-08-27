define(['N/record', 'N/search'], function (record, search) {
  /**
   * @NApiVersion 2.1
   * @NScriptType UserEventScript
   */
  var exports = {};
  function afterSubmit(context) {
      try{
          let curLoad = context.newRecord
          if (curLoad.id) {
              let thisRecord = record.load({
                  type: curLoad.type,
                  id: curLoad.id,
                  isDynamic: true
              })
              let poID = curLoad.id
              var createdFr = thisRecord.getValue({fieldId:'createdfrom'})
              if(createdFr){
                  var res = executeProcess(createdFr,poID)
              }

          }
      }
      catch(e){
          log.debug('e',e)
      }
  }
  const executeProcess = (createdFr,poID) => {
      var searchRes = getResults(createdFr,poID)
      log.debug('searchRes', searchRes)
      if (searchRes.length > 0) {
          for (var x = 0; x < searchRes.length; x++) {
              log.debug('processing this one',searchRes[x])
              var soID = searchRes[x].soID
    
              var specialOrder = searchRes[x].specialOrder
              var uniqueKey = searchRes[x].uniqueKey

              var item = searchRes[x].item
              var vendor = searchRes[x].vendor
              var qty = searchRes[x].qty
              var selfMade = searchRes[x].selfMade
                  var room = searchRes[x].room
                      //  var notes = searchRes[x].linenotes
              //will need to add more for verifcation


              //this is the same GUESS
              var returnPOKey = updatePO(soID, specialOrder, uniqueKey, item, selfMade)
              log.debug('returnPOKey',returnPOKey)




              //this should get your updated function
              var parentId = getLinkedParent(vendor)
              if (parentId) {
                  var useId = parentId
              }
              else {
                  var useId = createLinkedParent(vendor)
              }


              var returnRec = createCustomRecord(soID, specialOrder, uniqueKey, item, returnPOKey.key, vendor, useId, qty, returnPOKey.rate, room)

              if (returnRec) {
                var returnSO = editSalesOrd(soID, selfMade, returnRec);
            }


              // //might need a few fields updated
              // var returnSO = editSalesOrd(soID,selfMade,returnRec)
          }
      }
  }

  const editSalesOrd = (soID,selfMade,returnRec) => {
      try{
          log.debug('in on so edit')
          var salesOrd = record.load({
              type:'salesorder',
              id:soID,
              isDynamic:true
          })
          var lineCount = salesOrd.getLineCount({
              sublistId: 'item'
          });
          log.debug('lineCount', lineCount)
          if (lineCount > 0) {
              for (var i = 0; i < lineCount; i++) {
                  var identifier = salesOrd.getSublistValue({
                      sublistId:'item',
                      fieldId:'custcol_self_id',
                      line:i
                  })
                  log.debug('identifier',identifier)
                  log.debug('selfMade',selfMade)
                  log.debug('returnRec',returnRec)
                  if(identifier == selfMade){
                      log.debug('should be setting!!!!')
                      salesOrd.selectLine({
                          sublistId:'item',
                          line:i
                      })
                      salesOrd.setCurrentSublistValue({
                          sublistId:'item',
                          fieldId:'custcol_zas_linked_so_rec',
                          value:returnRec
                      })
                      salesOrd.setCurrentSublistValue({
                          sublistId:'item',
                          fieldId:'custcol_special_connected',
                          value:true
                      })
                      salesOrd.commitLine({
                          sublistId:'item'
                      })
                  }
              }
          }
          salesOrd.save()
      }
      catch(e){
          log.debug('e on so edit',e)
      }
     
  }
  const createLinkedParent = (vendor) => {
      //log.error('e ven',vendor)
      var parLink = record.create({
          type: 'customrecord_consolidated_vendor_select',
          isDynamic: true
      })
      parLink.setValue({
          fieldId: 'custrecord_vendor_select_vendor',
          value: vendor
      })
      var suitLink = "https://7513000.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=2796&deploy=1&compid=7513000&ns-at=AAEJ7tMQJ6TkmxTRKXjNCSeU5ZgheaUAOZXJJNFgknVdNeFvaEY&custom_id=" + vendor
      parLink.setValue({
          fieldId: 'custrecord_vendor_select_sl',
          value: suitLink
      })
      var rec = parLink.save()
      return rec
  }
  const getLinkedParent = (vendor) => {
      try{
          var returnId;
          var venSearch = search.create({
              type: "customrecord_consolidated_vendor_select",
              filters:
                  [
                      ["custrecord_vendor_select_vendor", "anyof", vendor], 
          "AND", 
          ["isinactive", "is", "F"]
                  ],
              columns:
                  [
                      "internalid"
                  ]
          });
          var searchResultCount = venSearch.runPaged().count;
          log.debug("venSearch result count", searchResultCount);
          venSearch.run().each(function (result) {
              // .run().each has a limit of 4,000 results
              var id = result.getValue({
                  name: 'internalid'
              })
              returnId = id
              return true;
          });
          return returnId
      }
      catch(e){
         log.error('e ven',e)
          return
      }
  }
  const createCustomRecord = (soID, specialOrder, uniqueKey, item, returnPOKey, vendor, parentId,qty,poRate,room) => {
      try{
          var custRec = record.create({
              type: 'customrecord_consolidated_special_order',
              isDynamic: true
          })
          custRec.setValue({
              fieldId: 'custrecord_special_consolidated_qty',
              value: qty
          })
          custRec.setValue({
              fieldId: 'custrecord_consolidated_po_unique',
              value: returnPOKey
          })
          custRec.setValue({
              fieldId: 'custrecord_special_consolidated_vendor',
              value: vendor
          })
           custRec.setValue({
              fieldId: 'custrecord_consol_item_rate',
              value: poRate
          })
          custRec.setValue({
              fieldId: 'custrecord_special_consolidated_sl',
              value: parentId
          })
          custRec.setValue({
              fieldId: 'custrecord_special_consolidated_so',
              value: soID
          })
          custRec.setValue({
              fieldId: 'custrecord_special_consolidated_po',
              value: specialOrder
          })
          custRec.setValue({
              fieldId: 'custrecord_special_consolidated_key',
              value: uniqueKey
          })
          custRec.setValue({
              fieldId: 'custrecord_special_consolidated_item',
              value: item
          })
          custRec.setValue({
              fieldId: 'custrecord_special_consolidated_room',
              value: room
          })
          //    custRec.setValue({
          //     fieldId: 'custrecord_special_consolidated_notes',
          //     value: notes
          // })
          var rec = custRec.save()
          return rec
      }
      catch(e){
          log.debug('e on cust save',e)
          return null
      }
  
  }
  const updatePO = (soID, specialOrder, uniqueKey, checkItem, selfMade) => {
      var returnUnique = new Object()
      var purchOrd = record.load({
          type: 'purchaseorder',
          id: specialOrder,
          isDynamic: true
      })
      var lineCount = purchOrd.getLineCount({
          sublistId: 'item'
      });
      log.debug('lineCount', lineCount)
      if (lineCount > 0) {
          for (var i = 0; i < lineCount; i++) {
              purchOrd.selectLine({
                  sublistId: 'item',
                  line: i
              });
              var item = purchOrd.getCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'item'
              });
              var idCheck = purchOrd.getCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'custcol_self_id'
              });
              log.debug('idCheck',idCheck)
              log.debug('selfMade',selfMade)
              //log.debug('room',room)
              //log.debug('checkRooom',checkRooom)
              // if ((Number(item) == Number(checkItem)) && (room == checkRooom)) {
                  if (idCheck == selfMade) {
                  log.audit('IN!')
                  purchOrd.setCurrentSublistValue({
                      sublistId: 'item',
                      fieldId: 'custcol_zas_unique_key',
                      value: uniqueKey
                  });
                  var poUni = purchOrd.getCurrentSublistValue({
                      sublistId: 'item',
                      fieldId: 'lineuniquekey'
                  });
                        var poRate = purchOrd.getCurrentSublistValue({
                      sublistId: 'item',
                      fieldId: 'rate'
                  });
                  log.audit('poUni',poUni)
                  purchOrd.commitLine({
                      sublistId: 'item'
                  });
                   
                  returnUnique.key = poUni
                      returnUnique.rate = poRate
              }
          }
          var rec = purchOrd.save()
          return returnUnique
      }
      else {
          return null
      }
  }
  const getResults = (createdFr,poID) => {
      var returnArr = new Array()
      var salesorderSearchObj = search.create({
          type: "salesorder",
          filters: [
              ["type", "anyof", "SalesOrd"], // Select only Sales Orders
              "AND", ["mainline", "is", "F"], // Exclude mainline, focus on item lines
              "AND", ["item.type", "anyof", "InvtPart"], // Only inventory part items
              "AND", ["custcol_special_connected", "is", "F"], // Items not connected to a special order
              "AND", ["specialorder", "noneof", "@NONE@"], // Items with special orders
              "AND", ["custcol_zastro_unconsolidated_item", "is", "T"], // Unconsolidated items
              "AND", ["datecreated", "onorafter", "10/30/2024 12:00 am"], // Orders created after specified date
              "AND", ["status", "anyof", "SalesOrd:B", "SalesOrd:D", "SalesOrd:E"], // Open, Pending Fulfillment, or Partially Fulfilled Sales Orders
"AND", 
    ["internalidnumber","equalto",createdFr], 
    "AND", 
    ["specialorder","anyof",poID]

          ],
          columns: [
              "internalid", // Sales Order internal ID
              "trandate", "tranid", // Transaction date and ID
              "item", // Item ID
              "quantity", // Quantity ordered
              "specialorder", // Special order reference
              "custcol_special_connected", // Custom column: special connected flag
              "lineuniquekey", // Line unique key
              "line", // Line number
              "custcol_pr_room_location", // Room location custom field
              "custcolcustcol_zastro_vendor", // Vendor custom field
              "custcol_self_id", // Self-made ID custom field
              "otherrefnum", // PO#
          //   "custcol_zas_line_notes"
          ]
      });
      var searchResultCount = salesorderSearchObj.runPaged().count;
      log.debug("salesorderSearchObj result count", searchResultCount);
      salesorderSearchObj.run().each(function (result) {
          // .run().each has a limit of 4,000 results
          var soID = result.getValue({
              name: 'internalid'
          })
          var specialOrder = result.getValue({
              name: 'specialorder'
          })
          var uniqueKey = result.getValue({
              name: 'lineuniquekey'
          })
          var room = result.getValue({
              name: 'custcol_pr_room_location'
          })
          var item = result.getValue({
              name: 'item'
          })
          var vendor = result.getValue({
              name: 'custcolcustcol_zastro_vendor'
          })
          var qty = result.getValue({
              name: 'quantity'
          })
          var selfMade = result.getValue({
              name: 'custcol_self_id'
          })
          var otherrefnum = result.getValue({
              name: 'custcol_self_id'
          })
          // var linenotes = result.getValue({
          //     name: 'custcol_zas_line_notes'
          // })
        

          // soID: salesOrderID, // Sales order internal ID
          // specialOrder: result.specialorder, // Special order reference
          // uniqueKey: result.lineuniquekey, // Line unique key
          // room: result.custcol_zas_room_location, // Room location
          // item: result.item, // Item ID
          // vendor: result.custcol_zas_vendor, // Vendor ID
          // qty: result.quantity, // Quantity ordered
          // selfMade: result.custcol_zas_self_id, // Self-made ID
          // purchId: result.specialorder.value,
          // otherrefnum: result.otherrefnum


          //MIRROR UP



          var returnObj = new Object()
          returnObj.soID = soID
          returnObj.specialOrder = specialOrder
          returnObj.uniqueKey = uniqueKey
          returnObj.room = room
          returnObj.item = item
          returnObj.vendor = vendor
          returnObj.qty = qty
          returnObj.selfMade = selfMade
          returnObj.otherrefnum = otherrefnum
          //  returnObj.linenotes = linenotes
          returnArr.push(returnObj)
          return true;
      });

      return returnArr
  }


  exports.afterSubmit = afterSubmit;
  return exports;
});

