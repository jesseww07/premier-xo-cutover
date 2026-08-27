/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(["N/log", "N/record", "N/search", "N/util", "N/file", "N/email"],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {util} util
     * @param {file} file
     * @param {email} email
     */
    function (log, record, search, util, file, email) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */

        function execute(context) {
            try {
                let newReportDate = buildReport();
                log.audit("newReportDate", newReportDate);
                if (newReportDate) {
                    let csvReportDataHeaders = `Item Receipt,Qty Received,Created From,Item,Consolidated PO,Customer,Sales Order,Qty Ordered,Location,Bin,Stored Sales Order\r\n`;
                    let csvReportDataBody = '';
                    let allIrDetailsCreatedToday = fetchIrDetails(newReportDate);
                    log.debug("allIrDetailsCreatedToday", allIrDetailsCreatedToday);
                    for (let key in allIrDetailsCreatedToday) {
                        let transactionLookup = search.lookupFields({
                            type: "transaction",
                            id: allIrDetailsCreatedToday[key][0].irCreatedFromId,
                            columns: ["custbody_zastro_po_source"]
                        });
                        let consolidatedPoId = transactionLookup.custbody_zastro_po_source ? transactionLookup.custbody_zastro_po_source[0] ? transactionLookup.custbody_zastro_po_source[0].value : "" : "";
                        let consolidatedPo = transactionLookup.custbody_zastro_po_source ? transactionLookup.custbody_zastro_po_source[0] ? transactionLookup.custbody_zastro_po_source[0].text : "" : "";
                        let items = [];
                        allIrDetailsCreatedToday[key].map(irDetails => {
                            items.push(irDetails.itemId)
                        });
                        log.debug("items For " + key, items)
                        if (consolidatedPoId) {
                            let unConsolidatedDetails = savedUnconsolidatePoItemsSearch(items, consolidatedPoId);
                            log.debug("unConsolidatedDetails for key" + key, unConsolidatedDetails);
                            allIrDetailsCreatedToday[key].map(eachItemInIr => {
                                let matchingsFromUnconsolidated = findAndRemoveMatchingItems(unConsolidatedDetails, eachItemInIr.irQty, eachItemInIr.itemName);
                                log.debug("matchingsFromUnconsolidated", matchingsFromUnconsolidated)
                                unConsolidatedDetails = matchingsFromUnconsolidated.updatedArray
                                matchingsFromUnconsolidated.matchingItems.length > 0 ? matchingsFromUnconsolidated.matchingItems[0].map(matchingUnconsolidated => {
                                    csvReportDataBody += `"${eachItemInIr.irNumber}","${eachItemInIr.irQty}","${eachItemInIr.irCreatedFrom}","${eachItemInIr.itemName || ""}","${consolidatedPo || ""}","${matchingUnconsolidated.customer || ""}","${matchingUnconsolidated.salesOrderText || ""}","${matchingUnconsolidated.qty || ""}","${eachItemInIr.location}","${eachItemInIr.binNumber}","${matchingUnconsolidated.storedSalesOrder || ""}"\r\n`
                                }) :
                                    csvReportDataBody += `"${eachItemInIr.irNumber}","${eachItemInIr.irQty}","${eachItemInIr.irCreatedFrom}","${eachItemInIr.itemName || ""}","${consolidatedPo || ""}","","","","${eachItemInIr.location}","${eachItemInIr.binNumber}",""\r\n`
                            });
                        } else {
                            allIrDetailsCreatedToday[key].map(allIrDetailsCreatedTodayData => {
                                csvReportDataBody += `"${allIrDetailsCreatedTodayData.irNumber}","${allIrDetailsCreatedTodayData.irQty}","${allIrDetailsCreatedTodayData.irCreatedFrom}","${allIrDetailsCreatedTodayData.itemName}",non-consolidated,none,,"${allIrDetailsCreatedTodayData.irQty}","${allIrDetailsCreatedTodayData.location}","${allIrDetailsCreatedTodayData.binNumber}",\r\n`
                            })
                        }
                    };
                    if (csvReportDataBody.length > 0) {
                        let fileObj = file.create({
                            name: `${new Date()}_rec_report.csv`,
                            fileType: file.Type.CSV,
                            contents: csvReportDataHeaders + csvReportDataBody,
                        });
                        let emailArray = emailSearch();
                        let emailTwo = emailArray.pop();
                        log.debug('pop', emailTwo);
                        buildCSV(fileObj, emailArray);
                        buildCSVDos(fileObj, emailTwo);
                    }
                }

            } catch (error) {
                log.error("Error at execution", error)
            }
        }
        const fetchIrDetails = (date) => {
            let irsCreatedTodaySearch = search.create({
                type: "itemreceipt",
                filters:
                    [
                        ["type", "anyof", "ItemRcpt"],
                        "AND",
                        ["trandate", "on", date],
                        "AND",
                        ["mainline", "is", "F"],
                        "AND",
                        ["taxline", "is", "F"],
                        "AND",
                        ["shipping", "is", "F"],
                        "AND",
                        ["cogs", "is", "F"]
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid" }),
                        search.createColumn({ name: "tranid", label: "Document Number" }),
                        search.createColumn({ name: "createdfrom", label: "Created From" }),
                        search.createColumn({ name: "item", label: "Item" }),
                        search.createColumn({ name: "location", label: "location" }),
                        search.createColumn({ name: "quantity", label: "Quantity" }),
                        search.createColumn({
                            name: "binnumber",
                            join: "inventoryDetail",
                            label: "Bin Number"
                        })
                    ]
            });
            let itemIds = [];
            let irIds = [];
            let irDetailsObject = {};
            irsCreatedTodaySearch.run().each(result => {
                let transactionQty = result.getValue({ name: "quantity" });
                let createdFromText = result.getText({ name: "createdfrom" })
                if ((createdFromText.startsWith("Transfer Order") && transactionQty > 0) || !createdFromText.startsWith("Transfer Order")) {
                    let internalID = result.getValue({ name: "internalid" });
                    let irDetailsSuObj = irDetailsObject[internalID] || []
                    let item = result.getValue({ name: "item" });

                    irDetailsSuObj.push(
                        {
                            irNumber: result.getValue({ name: "tranid" }),
                            irCreatedFrom: createdFromText,
                            irCreatedFromId: result.getValue({ name: "createdfrom" }),
                            itemId: item,
                            itemName: result.getText({ name: "item" }),
                            irQty: result.getValue({ name: "quantity" }),
                            binNumber: result.getText({ name: "binnumber", join: "inventoryDetail" }) || "",
                            internalid: internalID,
                            location: result.getText({ name: "location" }) || ""
                        }
                    );
                    irDetailsObject[internalID] = irDetailsSuObj
                    if (irIds.indexOf(internalID) == -1)
                        irIds.push(internalID);
                    itemIds.push(item);
                }
                return true;
            });
            return irDetailsObject;
        }
        const buildReport = () => {
            let today = new Date()
            let custRec = record.create({
                type: "customrecord_pl_rec_summary",
                isDynamic: true,
            });
            //Governance : 2 Units
            custRec.setValue({
                fieldId: "custrecordpl_rec_sum_date",
                value: today
            })
            custRec.setValue({
                fieldId: "custrecordcustrecordpl_rec_sum_location",
                value: 8
            })
            custRec.save();
            if (custRec.save()) {
                return custRec.getText({
                    fieldId: "custrecordpl_rec_sum_date"
                });
            }
            //Governance : 4 Units
        }
        const savedUnconsolidatePoItemsSearch = (items, purchaseorders) => {
            let customrecord_zastro_unconsolidated_itemsSearchObj = search.create({
                type: "customrecord_zastro_unconsolidated_items",
                filters:
                    [
                        search.createFilter({
                            name: 'custrecord_zastro_item_name',
                            operator: 'anyof',
                            values: items
                        }),
                        search.createFilter({
                            name: 'custrecord_zastro_po_item_list',
                            operator: 'anyof',
                            values: purchaseorders
                        }),
                        search.createFilter({
                            name: 'mainline',
                            join: 'custrecord_zastro_so_no',
                            operator: 'is',
                            values: ["T"]
                        })
                    ],
                columns:
                    [
                        search.createColumn({ name: "custrecord_zastro_item_name", label: "Item Name" }),
                        search.createColumn({ name: "custrecord_zastro_so_no", label: "Sales Order #" }),
                        search.createColumn({ name: "custbody_abe_so", join: "custrecord_zastro_so_no" }),
                        search.createColumn({ name: "custrecord_zastro_customer", label: "Customer" }),
                        search.createColumn({ name: "custrecord_zastro_qty", label: "Quantity" }),
                        search.createColumn({ name: "custrecord_zastro_po_item_list", label: "Purchase Order Consolidation" }),
                        search.createColumn({
                            name: "custrecord_zastro_po_no",
                            join: "CUSTRECORD_ZASTRO_PO_ITEM_LIST",
                            label: "PO #"
                        })
                    ]
            });
            let unconsolidatedItemsData = [];
            customrecord_zastro_unconsolidated_itemsSearchObj.run().each(result => {
                unconsolidatedItemsData.push(
                    {
                        itemName: result.getText({ name: "custrecord_zastro_item_name" }),
                        salesOrder: result.getText({ name: "custrecord_zastro_so_no" }),
                        salesOrderText: result.getText({ name: "custrecord_zastro_so_no" }),
                        storedSalesOrder: result.getText({ name: "custbody_abe_so", join: "custrecord_zastro_so_no" }),
                        customer: result.getText({ name: "custrecord_zastro_customer" }),
                        qty: result.getValue({ name: "custrecord_zastro_qty" }),
                        consolidatedpo: result.getText({ name: "custrecord_zastro_po_no", join: "CUSTRECORD_ZASTRO_PO_ITEM_LIST" })
                    }
                )
                return true
            });
            return unconsolidatedItemsData;
        }

        function findAndRemoveMatchingItems(arr, targetSum, itemName) {
            log.debug("Array in findAndRemoveMatchingItems", arr);
            log.debug("targetSum in findAndRemoveMatchingItems", targetSum);
            log.debug("itemName in findAndRemoveMatchingItems", itemName);
            // Filter only items that match the specified itemName
            const filteredItems = arr.filter(item => item.itemName === itemName);
            const results = [];
            let indicesToRemove = [];

            // Recursive function to find subsets that add up to targetSum
            function findSubset(currentSubset, currentIndex, currentSum, indexSubset) {
                if (currentSum == targetSum) {
                    results.push([...currentSubset]);
                    indicesToRemove = indexSubset;  // Store indices for the matching subset
                    return;
                }
                if (currentSum > targetSum || currentIndex === filteredItems.length) {
                    return;
                }

                const item = filteredItems[currentIndex];
                const itemQty = parseInt(item.qty);

                // Include the current item
                findSubset([...currentSubset, item], currentIndex + 1, currentSum + itemQty, [...indexSubset, currentIndex]);

                // Exclude the current item
                findSubset(currentSubset, currentIndex + 1, currentSum, indexSubset);
            }

            // Find the matching subset
            findSubset([], 0, 0, []);

            // If a subset is found, remove items at indicesToRemove from the original array
            if (indicesToRemove.length > 0) {
                indicesToRemove.sort((a, b) => b - a); // Sort indices in descending order
                indicesToRemove.forEach(index => {
                    const originalIndex = arr.findIndex(item =>
                        item.itemName == filteredItems[index].itemName &&
                        item.qty == filteredItems[index].qty &&
                        item.salesOrder == filteredItems[index].salesOrder
                    );
                    if (originalIndex !== -1) {
                        arr.splice(originalIndex, 1); // Remove the item from the original array
                    }
                });
            }

            return {
                matchingItems: results,
                updatedArray: arr
            };
        }
        const emailSearch = () => {
            let emailArray = new Array()
            // let emailArrayOne = new Array()
            let emailArrayTwo = new Array()
            let emailArrayThree = new Array()
            let ctr = 0;
            let entitygroupSearchObj = search.create({
                type: "entitygroup",
                filters:
                    [
                        ["internalidnumber", "equalto", "16812"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "email",
                            join: "groupMember"
                        }),
                        search.createColumn({
                            name: "altname",
                            join: "groupMember"
                        })
                    ]
            });
            // let searchResultCount = entitygroupSearchObj.runPaged().count;
            // log.debug("entitygroupSearchObj result count", searchResultCount);
            entitygroupSearchObj.run().each(function (result) {

                let email = result.getValue({
                    join: 'groupMember',
                    name: 'email'
                })
                // log.debug('email', email)
                ctr++
                // log.debug('counter', ctr)
                if (ctr <= 10) {
                    emailArray.push(email)
                }
                if (ctr > 10 && ctr <= 20) {
                    emailArrayTwo.push(email)
                }
                if (ctr > 20 && ctr <= 30) {
                    emailArrayThree.push(email)
                }
                return true;

            });

            emailObject = new Object()

            if (emailArrayThree.length > 0) {
                emailObject.three = emailArrayThree
            }
            else if (emailArrayTwo.length > 0) {
                emailObject.two = emailArrayTwo
            }
            else {
                emailObject.one = emailArray
            }

            emailArray.push(emailObject)
            //  log.debug('email array to return',emailArray)
            return emailArray;
        }
        const buildCSV = (fileObj, emailArray) => {
            let today = new Date()
            email.send({
                author: 8,
                recipients: emailArray,
               // recipients: 'mccoy@zastro.com',
                subject: 'Daily Receiving Report' + ' - ' + today,
                body: `Please see attached automated receiving report for ${today}`,
                attachments: [fileObj],
            });
            return true;
        }
        const buildCSVDos = (fileObj, emailArray) => {
            let today = new Date()
            email.send({
                author: 8,
                recipients: emailArray.two,
               // recipients: 'mccoy@zastro.com',
                subject: 'Daily Receiving Report' + ' - ' + today,
                body: `Please see attached automated receiving report for ${today}`,
                attachments: [fileObj],
            });
        }

        return {
            execute: execute
        };

    });