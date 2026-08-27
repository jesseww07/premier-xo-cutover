/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
 define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/file', 'N/render'],
    function(log, serverWidget, record, search, url, redirect) {
      function onRequest(context) {
        try {
          if (context.request.method === 'GET') {
            var originatingID = context.request.parameters.custom_id;
            var salesOrd = null;
            var soClass = null;
            try {
              salesOrd = record.load({
                type: 'salesorder',
                id: Number(originatingID)
              });
              soClass = salesOrd.getValue({
                fieldId: 'class'
              });
            } catch (e) {
              log.error('Error loading Sales Order on GET', 'ID: ' + originatingID + ', Error: ' + e.message);
              context.response.write('Error loading Sales Order. Please try again.');
              return;
            }
            var form = serverWidget.createForm({
              title: 'Items in Stock Now'
            });

var viewUrl = url.resolveRecord({
  recordType: record.Type.SALES_ORDER,
  recordId: originatingID,
  isEditMode: false
});

form.addField({
    id: 'custpage_back_link',
    label: ' ',
    type: serverWidget.FieldType.INLINEHTML
  }).defaultValue = `
    <div style="margin-bottom:10px;">
      <a href="${viewUrl}" style="font-size:14px; font-weight:bold;">
        ← Back to Sales Order
      </a>
    </div>
  `;
            
            var sublist = generateFields(form, originatingID, soClass);
            var returnSearch = getData(originatingID);
            if (returnSearch.length > 0) {
              populateReturnFields(returnSearch, sublist);
              form.addSubmitButton('Save');
              context.response.writePage(form);
            } else {
              log.debug('No Stock Items Found', 'No unconsolidated items with stock > 0 found for SO ID: ' + originatingID);
              redirect.toRecord({
                type: 'salesorder',
                id: Number(originatingID)
              });
            }
          } else {
            var salesOrderID = context.request.parameters.custpage_so;
            var salesOrderClass = context.request.parameters.custpage_class;
            var alertAssignee = 19;
            if (Number(salesOrderClass) === 1 || Number(salesOrderClass) === 5 || Number(salesOrderClass) === 6) {
              alertAssignee = 39;
            }
            let returnArr = [];
            var requestCount = context.request.getLineCount({
              group: 'sublist'
            });
            for (var x = 0; x < requestCount; x++) {
              var lineKey = context.request.getSublistValue({
                group: 'sublist',
                name: 'custpage_key',
                line: x
              });
              var qtyRequested = context.request.getSublistValue({
                group: 'sublist',
                name: 'custpage_qtyrequested',
                line: x
              });
              var alert = context.request.getSublistValue({
                group: 'sublist',
                name: 'custpage_alert',
                line: x
              });
              var itemText = context.request.getSublistValue({
                group: 'sublist',
                name: 'custpage_item',
                line: x
              });
              var itemId = context.request.getSublistValue({
                group: 'sublist',
                name: 'custpage_itemid',
                line: x
              });
              var binInfo = context.request.getSublistValue({
                group: 'sublist',
                name: 'custpage_bins',
                line: x
              });
              if (Number(qtyRequested) > 0) {
                var returnObj = {
                  key: lineKey,
                  qty: qtyRequested,
                  item: itemText,
                  itemid: itemId,
                  binInfo: binInfo,
                  alert: alert,
                  alertAssignee: alertAssignee
                };
                returnArr.push(returnObj);
              }
            }
            if (returnArr.length > 0) {
              editSalesOrder(salesOrderID, returnArr);
              handleAlerts(salesOrderID, returnArr);
              redirect.toRecord({
                type: 'salesorder',
                id: salesOrderID
              });
            } else {
              log.debug('No Items Requested From Stock', 'No items with quantity > 0 submitted for SO ID: ' + salesOrderID);
              redirect.toRecord({
                type: 'salesorder',
                id: salesOrderID
              });
            }
          }
        } catch (e) {
          log.error('Suitelet Error in onRequest', e);
          context.response.write('An unexpected error occurred: ' + e.message);
        }
      }
  
      const handleAlerts = (salesOrderID, returnArr) => {
        try {
          var salesOrd = record.load({
            type: 'salesorder',
            id: salesOrderID
          });
          var soNumber = salesOrd.getValue({
            fieldId: 'tranid'
          });
          var customerName = salesOrd.getText({
            fieldId: 'entity'
          });
          var loc = salesOrd.getValue({
            fieldId: 'location'
          });
          let alertAssignee = null;
          let itemList = '';
          let customRecordIds = [];
          let needsAlerts = false;
          for (let i = 0; i < returnArr.length; i++) {
            let lineData = returnArr[i];
            let alertNeeded = lineData.alert;
            if (alertNeeded === true || alertNeeded === 'T') {
              needsAlerts = true;
              let reqItemId = lineData.itemid;
              let reqItemName = lineData.item;
              let binInfo = lineData.binInfo;
              if (alertAssignee === null) {
                alertAssignee = lineData.alertAssignee;
              }
              try {
                let recObj = record.create({
                  type: 'customrecord_pr_req_to_transfer'
                });
                recObj.setValue({
                  fieldId: 'custrecord_pr_transfer_rep',
                  value: alertAssignee
                });
                recObj.setValue({
                  fieldId: 'custrecord_pr_transfer_so',
                  value: salesOrderID
                });
                recObj.setValue({
                  fieldId: 'custrecord_pr_transfer_location',
                  value: loc
                });
                recObj.setValue({
                  fieldId: 'custrecord_pr_transfer_item',
                  value: reqItemId
                });
                recObj.setValue({
                  fieldId: 'custrecord_pr_transfer_bin',
                  value: binInfo
                });
                let customRecId = recObj.save();
                customRecordIds.push(customRecId);
                itemList += `• ${reqItemName} — ${binInfo}<br/>`;
              } catch (recordErr) {
                log.error('Error creating Transfer Request Record', 'Item: ' + reqItemName + ', Error: ' + recordErr.message);
              }
            }
          }
          if (needsAlerts && alertAssignee) {
            try {
              let task = record.create({
                type: record.Type.TASK
              });
              task.setValue({
                fieldId: 'title',
                value: `Transfer Request for SO #${soNumber} (${customerName})`
              });
              task.setValue({
                fieldId: 'assigned',
                value: alertAssignee
              });
              let messageLines = [];
              messageLines.push('Sales Order: ' + soNumber);
              messageLines.push('Customer: ' + customerName);
              messageLines.push('');
              messageLines.push('Items needing transfer:');
              itemList.split('<br/>').forEach(function(item) {
                if (item.trim()) {
                  messageLines.push(item);
                }
              });
              messageLines.push('');
              messageLines.push('Transfer Request Record IDs: ' + customRecordIds.join(', '));
              let taskMessage = messageLines.join('\n');
              task.setValue({
                fieldId: 'message',
                value: taskMessage
              });
              task.setValue({
                fieldId: 'status',
                value: 'NOTSTART'
              });
              task.save();
              log.audit('Task Created', 'Task assigned to ' + alertAssignee + ' for SO ' + salesOrderID + '. Record IDs: ' + customRecordIds.join(', '));
            } catch (taskErr) {
              log.error('Error creating Task record for SO ' + salesOrderID, taskErr);
            }
          } else if (needsAlerts && !alertAssignee) {
            log.warn('Task Not Created', 'No assignee determined for alert for SO ' + salesOrderID);
          } else {
            log.debug('No Alerts Needed', 'No lines were marked for transfer alerts for SO ' + salesOrderID);
          }
        } catch (e) {
          log.error('handleAlerts Function Error', e);
        }
      };
  
      const findIndexByPropertyValue = (array, property, value) => {
        for (let i = 0; i < array.length; i++) {
          if (array[i][property] === value) {
            return i;
          }
        }
        return -1;
      };
  
      const editSalesOrder = (salesOrderID, returnArr) => {
        try {
          var salesOrd = record.load({
            type: 'salesorder',
            id: salesOrderID,
            isDynamic: true
          })
          var numLines = salesOrd.getLineCount({
            sublistId: 'item'
          });
          for (var x = numLines - 1; x >= 0; x--) {
            var uniqueKey = salesOrd.getSublistValue({
              sublistId: 'item',
              fieldId: 'lineuniquekey',
              line: x
            });
            var item = salesOrd.getSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              line: x
            });
            var index = findIndexByPropertyValue(returnArr, 'key', uniqueKey)
            if (index >= 0 && Number(returnArr[index].qty) > 0) {
              var qtyFromStock = Number(returnArr[index].qty);
              log.audit('Processing line for update/split', 'Line Index: ' + x + ', Unique Key: ' + uniqueKey + ', Submitted Qty: ' + qtyFromStock);
              salesOrd.selectLine({
                sublistId: 'item',
                line: x
              });
              var originalQty = Number(salesOrd.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity'
              }));
              var originalRate = Number(salesOrd.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate'
              }));
              var originalPriceLevel = salesOrd.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'price'
              });
              var remainingQty = Number(originalQty) - Number(qtyFromStock)
              if (qtyFromStock > originalQty) {
                log.error('Invalid Quantity', 'Requested quantity exceeds original quantity for line ' + uniqueKey + '. Original Qty: ' + originalQty + ', Requested Qty: ' + qtyFromStock);
                if (remainingQty < 0) {
                  log.error('editSalesOrder Error', 'Requested quantity exceeds original quantity for line ' + uniqueKey + '. Original Qty: ' + originalQty + ', Requested Qty: ' + qtyFromStock);
                  continue;
                }
                log.error('editSalesOrder Error', 'Requested quantity exceeds original quantity for line ' + uniqueKey + '. Original Qty: ' + originalQty + ', Requested Qty: ' + qtyFromStock);
                continue;
              }
              salesOrd.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: remainingQty
              });
              salesOrd.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_zastro_unconsolidated_item',
                value: (remainingQty > 0) ? true : false
              });
              salesOrd.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_pr_dont_render',
                value: true
              });
              salesOrd.commitLine({
                sublistId: 'item'
              });
              log.audit('Original line updated', 'Line Index: ' + x + ', New Qty: ' + remainingQty);
              if (qtyFromStock > 0) {
                salesOrd.insertLine({
                  sublistId: 'item',
                  line: x + 1
                });
                salesOrd.setCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'item',
                  value: item
                });
                salesOrd.setCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'quantity',
                  value: qtyFromStock
                });
                salesOrd.setCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'price',
                  value: originalPriceLevel
                });
                salesOrd.setCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'rate',
                  value: originalRate
                });
                salesOrd.setCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'custcol_zastro_unconsolidated_item',
                  value: false
                });
                salesOrd.setCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'custcol_pr_render_qty',
                  value: originalQty
                });
                const markTypeValue = salesOrd.getSublistValue({
                  sublistId: 'item',
                  fieldId: 'custcol_pr_room_location',
                  line: x
                });
                salesOrd.setCurrentSublistValue({
                  sublistId: 'item',
                  fieldId: 'custcol_pr_room_location',
                  value: markTypeValue
                });
                salesOrd.commitLine({
                  sublistId: 'item'
                });
                log.audit('New line inserted for stock quantity', 'Line Index: ' + (x + 1) + ', Qty: ' + qtyFromStock);
              }
            }
            lastLine = item;
          }
          salesOrd.save()
          log.audit('Sales Order Saved', salesOrderID);
        } catch (e) {
          log.error('editSalesOrder Error', e);
        }
      }
  
      const generateFields = (form, originatingID, soClass) => {
        var orderField = form.addField({
          id: 'custpage_so',
          label: 'Sales Order ID',
          type: serverWidget.FieldType.TEXT,
        });
        orderField.defaultValue = originatingID;
        orderField.updateDisplayType({
          displayType: serverWidget.FieldDisplayType.HIDDEN
        });
        var classField = form.addField({
          id: 'custpage_class',
          label: 'Sales Order Class',
          type: serverWidget.FieldType.TEXT,
        });
        classField.defaultValue = soClass;
        classField.updateDisplayType({
          displayType: serverWidget.FieldDisplayType.HIDDEN
        });
        var sublist = form.addSublist({
          id: 'sublist',
          type: serverWidget.SublistType.LIST,
          label: 'Available Stock Items'
        });
        var internalIdField = sublist.addField({
          id: 'custpage_line',
          label: 'Line ID',
          type: serverWidget.FieldType.TEXT,
        });
        internalIdField.updateDisplayType({
          displayType: serverWidget.FieldDisplayType.HIDDEN
        });
        var itemField = sublist.addField({
          id: 'custpage_item',
          label: 'Item',
          type: serverWidget.FieldType.TEXT,
        });
        var itemIdField = sublist.addField({
          id: 'custpage_itemid',
          label: 'Item ID',
          type: serverWidget.FieldType.TEXT,
        });
        itemIdField.updateDisplayType({
          displayType: serverWidget.FieldDisplayType.HIDDEN
        });
        var roomField = sublist.addField({
          id: 'custpage_room',
          label: 'Type/Room',
          type: serverWidget.FieldType.TEXT,
        });
        sublist.addField({
          id: 'custpage_qty',
          label: 'Quantity Ordered',
          type: serverWidget.FieldType.TEXT,
        });
        var qtyAvailField = sublist.addField({
          id: 'custpage_qtyavail',
          label: 'Quantity Available',
          type: serverWidget.FieldType.TEXT,
        });
        var qtyRequestedField = sublist.addField({
          id: 'custpage_qtyrequested',
          label: 'Quantity From Stock',
          type: serverWidget.FieldType.TEXT,
        });
        qtyRequestedField.defaultValue = '0';
        qtyRequestedField.updateDisplayType({
          displayType: serverWidget.FieldDisplayType.ENTRY
        });
        sublist.addField({
          id: 'custpage_bins',
          label: 'Bin Details',
          type: serverWidget.FieldType.TEXT,
        });
        var keyField = sublist.addField({
          id: 'custpage_key',
          label: 'Line Unique',
          type: serverWidget.FieldType.TEXT,
        });
        keyField.updateDisplayType({
          displayType: serverWidget.FieldDisplayType.HIDDEN
        });
        var alertField = sublist.addField({
          id: 'custpage_alert',
          label: 'Alert for Transfer',
          type: serverWidget.FieldType.CHECKBOX,
        });
        return sublist
      }
  
      const getData = (originatingID) => {
        var returnArr = [];
        var salesorderSearchObj = search.create({
          type: "salesorder",
          filters: [
            ["internalidnumber", "equalto", originatingID],
            "AND",
            ["type", "anyof", "SalesOrd"],
            "AND",
            ["mainline", "is", "F"],
            "AND",
            ["taxline", "is", "F"],
            "AND",
            ["shipping", "is", "F"],
            "AND",
            ["item.quantityavailable", "greaterthan", "0"],
            "AND",
            ["custcol_zastro_unconsolidated_item", "is", "T"]
          ],
          columns: [
            search.createColumn({
              name: "internalid",
              label: "Internal ID"
            }),
            search.createColumn({
              name: "item",
              label: "Item"
            }),
            search.createColumn({
              name: "quantity",
              label: "Quantity"
            }),
            search.createColumn({
              name: "quantityavailable",
              join: "item",
              label: "Item Quantity Available"
            }),
            search.createColumn({
              name: "custcol_pr_room_location",
              label: "Room Location"
            }),
            search.createColumn({
              name: "line",
              label: "Line Number"
            }),
            search.createColumn({
              name: "lineuniquekey",
              label: "Line Unique Key"
            })
          ]
        });
        var searchResultCount = salesorderSearchObj.runPaged().count;
        log.debug("Sales Order Search Result Count", searchResultCount);
        salesorderSearchObj.run().each(function(result) {
          var itemId = result.getValue({
            name: 'item'
          })
          var itemName = result.getText({
            name: 'item'
          })
          var binPayload = checkAvailableBins(itemId)
          var availableInBins = binPayload.returnQty
          var binString = binPayload.binString
          if (Number(availableInBins) > 0) {
            var returnObj = {};
            returnObj.itemName = itemName;
            returnObj.itemId = itemId;
            returnObj.qty = result.getValue({
              name: 'quantity'
            });
            returnObj.qtyavail = availableInBins;
            returnObj.room = result.getValue({
              name: 'custcol_pr_room_location'
            });
            returnObj.line = result.getValue({
              name: 'line'
            });
            returnObj.key = result.getValue({
              name: 'lineuniquekey'
            });
            returnObj.binString = binString;
            returnArr.push(returnObj);
          }
          return true;
        });
        return returnArr;
      }
  
      const checkAvailableBins = (item) => {
        var returnQty = 0;
        var binString = '';
        var inventorybalanceSearchObj = search.create({
          type: "inventorybalance",
          filters: [
            ["available", "greaterthan", "0"],
            "AND",
            ["binnumber", "noneof", "1407", "953", "1119"],
            "AND",
            ["item", "anyof", item],
            "AND",
            ["location", "noneof", "@NONE@", "15", "9", "5", "2", "10", "16", "20", "18", "17"]
          ],
          columns: [
            search.createColumn({
              name: "available",
              label: "Available Quantity"
            }),
            search.createColumn({
              name: "binnumber",
              label: "Bin Number"
            }),
            search.createColumn({
              name: "location",
              label: "Location"
            })
          ]
        });
        var searchResultCount = inventorybalanceSearchObj.runPaged().count;
        log.debug("Inventory Balance Search Result Count for Item " + item, searchResultCount);
        inventorybalanceSearchObj.run().each(function(result) {
          var available = Number(result.getValue({
            name: 'available'
          }));
          var bin = result.getText({
            name: 'binnumber'
          });
          var location = result.getText({
            name: 'location'
          });
          returnQty += available;
          var binData = `${bin} (${available}) - ${location}`;
          if (binString.length > 0) {
            binString += '<br/>' + binData;
          } else {
            binString += binData;
          }
          return true;
        });
        var returnObj = {};
        returnObj.returnQty = returnQty;
        returnObj.binString = binString;
        return returnObj;
      };
  
      const populateReturnFields = (returnSearch, sublist) => {
        try {
          for (var ctr = 0; ctr < returnSearch.length; ctr++) {
            const currentItem = returnSearch[ctr];
            if (currentItem.line === undefined || currentItem.itemName === undefined || currentItem.key === undefined) {
              log.warn('Missing Essential Data for Sublist Line', 'Skipping population for row index: ' + ctr + ', Data: ' + JSON.stringify(currentItem));
              continue;
            }
            sublist.setSublistValue({
              id: 'custpage_line',
              line: ctr,
              value: currentItem.line || ' '
            });
            sublist.setSublistValue({
              id: 'custpage_item',
              line: ctr,
              value: currentItem.itemName || ' '
            });
            sublist.setSublistValue({
              id: 'custpage_itemid',
              line: ctr,
              value: currentItem.itemId || ' '
            });
            sublist.setSublistValue({
              id: 'custpage_qty',
              line: ctr,
              value: currentItem.qty || '0'
            });
            sublist.setSublistValue({
              id: 'custpage_qtyavail',
              line: ctr,
              value: currentItem.qtyavail || '0'
            });
            sublist.setSublistValue({
              id: 'custpage_room',
              line: ctr,
              value: currentItem.room || ' '
            });
            sublist.setSublistValue({
              id: 'custpage_key',
              line: ctr,
              value: currentItem.key || ' '
            });
            var qtyOrdered = Number(currentItem.qty);
            var qtyAvailableInBins = Number(currentItem.qtyavail);
            var defaultRequestedQty = 0;
            if (qtyOrdered > 0 && qtyAvailableInBins > 0) {
              defaultRequestedQty = Math.min(qtyOrdered, qtyAvailableInBins);
            }
            sublist.setSublistValue({
              id: 'custpage_qtyrequested',
              line: ctr,
              value: defaultRequestedQty.toString()
            });
            sublist.setSublistValue({
              id: 'custpage_bins',
              line: ctr,
              value: currentItem.binString || ' '
            });
            sublist.setSublistValue({
              id: 'custpage_alert',
              line: ctr,
              value: 'F'
            });
          }
        } catch (e) {
          log.error('Error populating sublist fields', e);
        }
        return sublist;
      }
  
      return {
        onRequest: onRequest
      };
    });