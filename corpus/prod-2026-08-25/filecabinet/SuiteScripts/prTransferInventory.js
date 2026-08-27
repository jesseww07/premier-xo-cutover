/**
 * API Version 2.1
 * Inventory Adjustments
 * Support Ticket: 2842
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      5/30/23        Alex Gjorvad                       Scheduled
 * 
 * 
 *          Script Functionality
 * This script parses a csv file provided by Premier and creates an inventory adjustment with the items that are
 * on the csv.  The purpose is to reverse previous inventory adjustments that lowered inventory quantity in the
 * Stored location and to move the new inventory to a "missing" bin and give the inventory a "Missing" status
 * so that it is not available for commitment.
 */
/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/runtime', 'N/record', 'N/task', 'N/file', 'N/email'],
    function (search, runtime, record, task, file, email) {

        function execute(scriptContext) {
            var inventoryArray = [];
            var scriptObj = runtime.getCurrentScript();
            var currentUser = runtime.getCurrentUser();
            log.debug('current_user', currentUser.id);
            var p1 = scriptObj.getParameter({
                name: 'custscript_file_id'
            });
            log.debug('p1', p1);
            var fileObj = file.load({
                id: p1
            });
            var contents = fileObj.getContents();
            log.debug('file_contents', contents);
            var delimiter = ",";
            var dataArray = CSVToArray(contents, delimiter);
            log.debug('DATA_ARRAY', dataArray);
            log.debug('DATA_ARRAY_LENGTH', dataArray.length);
            for (var i = 1; i < dataArray.length; i++) {
                log.debug('DATA_ARRAY_I', dataArray[i]);
                var recordArray = dataArray[i];
                var recordArrayString = recordArray.toString();
                var recordArraySplit = recordArrayString.split(',');
                var invAdjId = recordArraySplit[0];
                log.debug('inv_adj_id', invAdjId);
                var invItem = recordArraySplit[1];
                log.debug('inv_item', invItem);
                //Search for each item in the csv file to retrieve the item's internal id and quantity to 
                //add to the stored location
                var inventoryadjustmentSearchObj = search.create({
                    type: "inventoryadjustment",
                    filters:
                        [
                            ["type", "anyof", "InvAdjst"],
                            "AND",
                            ["location", "anyof", "9"],
                            "AND",
                            ["mainline", "is", "F"],
                            "AND",
                            ["internalid", "anyof", invAdjId],
                            "AND",
                            ["item.name", "is", invItem]
                        ],
                    columns:
                        [
                            search.createColumn({ name: "item", label: "Item" }),
                            search.createColumn({ name: "quantity", label: "Quantity" }),
                            search.createColumn({
                                name: "binnumber",
                                join: "inventoryDetail",
                                label: "Bin Number"
                            }),
                            search.createColumn({
                                name: "quantity",
                                join: "inventoryDetail",
                                label: "Quantity"
                            }),
                            search.createColumn({
                                name: "location",
                                join: "inventoryDetail",
                                label: "Location"
                            })
                        ]
                });
                var searchResultCount = inventoryadjustmentSearchObj.runPaged().count;
                log.debug("inventoryadjustmentSearchObj result count", searchResultCount);
                inventoryadjustmentSearchObj.run().each(function (result) {
                    // .run().each has a limit of 4,000 results
                    var item = result.getValue({
                        name: 'item'
                    });
                    var binNumber = result.getValue({
                        name: 'binnumber',
                        join: 'inventoryDetail'
                    });
                    var quantity = result.getValue({
                        name: 'quantity',
                        join: 'inventoryDetail'
                    });
                    var invObj = new Object();
                    invObj.item = item
                    invObj.binNumber = binNumber
                    invObj.quantity = quantity
                    inventoryArray.push(invObj)
                    return true;
                });
            }
            log.debug('inventory_array', JSON.stringify(inventoryArray));
            var newInvAdj = record.create({
                type: record.Type.INVENTORY_ADJUSTMENT,
                isDynamic: true,
            })
            //Subsidiary = Premier Lighting, LLC
            newInvAdj.setValue({
                fieldId: 'subsidiary',
                value: '2'
            });
            //Adjustment Location = Stored Inventory
            newInvAdj.setValue({
                fieldId: 'adjlocation',
                value: '9'
            })
            //Account = 53400 Cost of Goods Sold : Other Cost of Goods : Product Loss/Gain
            newInvAdj.setValue({
                fieldId: 'account',
                value: '357'
            });
            for (var q = 0; q < inventoryArray.length; q++) {
                newInvAdj.selectNewLine({
                    sublistId: 'inventory',
                });

                newInvAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'item',
                    value: inventoryArray[q].item
                });
                newInvAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'location',
                    value: '9'
                });
                newInvAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'adjustqtyby',
                    value: inventoryArray[q].quantity
                });
                newInvAdj.setCurrentSublistValue({
                    sublistId: 'inventory',
                    fieldId: 'unitcost',
                    value: 0.00
                });
                var subrec = newInvAdj.getCurrentSublistSubrecord({
                    sublistId: 'inventory',
                    fieldId: 'inventorydetail'
                });
                subrec.selectNewLine({
                    sublistId: 'inventoryassignment'
                });
                subrec.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'binnumber',
                    value: '1132'
                });
                subrec.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'inventorystatus',
                    value: '3'
                });
                subrec.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'quantity',
                    value: inventoryArray[q].quantity
                });
                subrec.commitLine({
                    sublistId: 'inventoryassignment'
                });
                newInvAdj.commitLine({
                    sublistId: 'inventory'
                });
            }
            var saveInvAdj = newInvAdj.save();
            log.debug('save_inv_adj', saveInvAdj);
        }

        // This will parse a delimited string into an array of
        // arrays. The default delimiter is the comma, but this
        // can be overriden in the second argument.
        function CSVToArray(strData, strDelimiter) {
            // Check to see if the delimiter is defined. If not,
            // then default to comma.
            strDelimiter = (strDelimiter || ",");
            // Create a regular expression to parse the CSV values.
            var objPattern = new RegExp(
                (
                    // Delimiters.
                    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
                    // Quoted fields.
                    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
                    // Standard fields.
                    "([^\"\\" + strDelimiter + "\\r\\n]*))"
                ),
                "gi"
            );
            // Create an array to hold our data. Give the array
            // a default empty first row.
            var arrData = [[]];
            // Create an array to hold our individual pattern
            // matching groups.
            var arrMatches = null;
            // Keep looping over the regular expression matches
            // until we can no longer find a match.
            while (arrMatches = objPattern.exec(strData)) {
                // Get the delimiter that was found.
                var strMatchedDelimiter = arrMatches[1];
                // Check to see if the given delimiter has a length
                // (is not the start of string) and if it matches
                // field delimiter. If id does not, then we know
                // that this delimiter is a row delimiter.
                if (
                    strMatchedDelimiter.length &&
                    (strMatchedDelimiter != strDelimiter)
                ) {
                    // Since we have reached a new row of data,
                    // add an empty row to our data array.
                    arrData.push([]);
                }
                // Now that we have our delimiter out of the way,
                // let's check to see which kind of value we
                // captured (quoted or unquoted).
                if (arrMatches[2]) {
                    // We found a quoted value. When we capture
                    // this value, unescape any double quotes.
                    var strMatchedValue = arrMatches[2].replace(
                        new RegExp("\"\"", "g"),
                        "\""
                    );
                } else {
                    // We found a non-quoted value.
                    var strMatchedValue = arrMatches[3];
                }
                // Now that we have our value string, let's add
                // it to the data array.
                arrData[arrData.length - 1].push(strMatchedValue);
            }
            // Return the parsed data.
            return (arrData);
        }

        return {
            execute: execute
        };
    });