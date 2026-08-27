/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/ui/serverWidget', 'N/search'], function(serverWidget, search) {

    function beforeLoad(context) {
        if (context.type !== context.UserEventType.VIEW) return; // Only run on View mode
        
        var form = context.form;
        var inboundShipment = context.newRecord;
        // var inboundShipmentId = context.newRecord.id; // Not strictly used in the logic for adding the tab/sublist
        var external = inboundShipment.getValue({fieldId:'externaldocumentnumber'});
        
        // --- THIS IS THE NEW MAGIC! ---
        // If externaldocumentnumber is blank, don't proceed to add the tab or search for emails.
        if (!external || external.trim() === '') {
            // You could add a log here if you want to track when this happens:
            // log.debug('Skipping Sent Email List', 'External Document Number is not populated for Inbound Shipment ID: ' + inboundShipment.id);
            return; 
        }
        // --- END OF NEW MAGIC ---
        
        // Add a new subtab
        form.addTab({
            id: 'custpage_custom_subtab',
            label: 'Sent Email List'
        });

        // Add a sublist to display search results
        var sublist = form.addSublist({
            id: 'custpage_custom_sublist',
            type: serverWidget.SublistType.LIST,
            label: 'Results',
            tab: 'custpage_custom_subtab'
        });

        // Add columns to the sublist (modify as needed)
        sublist.addField({
            id: 'custpage_col_1',
            type: serverWidget.FieldType.TEXT,
            label: 'Date'
        });

        sublist.addField({
            id: 'custpage_col_2',
            type: serverWidget.FieldType.TEXT,
            label: 'From'
        });

        sublist.addField({
            id: 'custpage_col_3',
            type: serverWidget.FieldType.TEXT,
            label: 'Subject'
        });

        sublist.addField({
            id: 'custpage_col_4',
            type: serverWidget.FieldType.TEXT,
            label: 'Recepients' // Typo: Should probably be 'Recipients'
        });

        var searchResults = getEmails(external); // This will now only be called if 'external' has a value

        // Populate sublist with search results
        if (searchResults && searchResults.length > 0) { // Good practice to check if there are results
            searchResults.forEach(function(result, index) {
                if (result.date) { // Check if properties exist before setting
                    sublist.setSublistValue({
                        id: 'custpage_col_1',
                        line: index,
                        value: result.date
                    });
                }
                if (result.from) {
                    sublist.setSublistValue({
                        id: 'custpage_col_2',
                        line: index,
                        value: result.from
                    });
                }
                if (result.subject) {
                    sublist.setSublistValue({
                        id: 'custpage_col_3',
                        line: index,
                        value: result.subject
                    });
                }
                if (result.rec) {
                    sublist.setSublistValue({
                        id: 'custpage_col_4',
                        line: index,
                        value: result.rec
                    });
                }
            });
        }
    }

    const getEmails = (external) => {
        var returnArr = new Array();
        var sentemailSearchObj = search.create({
            type: "sentemail",
            filters:
            [
                // This filter is now safer because 'external' will not be an empty string.
                ["subject","contains",external]
            ],
            columns:
            [
                search.createColumn({name: "sentdate", sort: search.Sort.DESC}), // Added sort for recent emails first
                "from",
                "subject",
                "torecipients"
            ]
        });
        // var searchResultCount = sentemailSearchObj.runPaged().count;
        // log.debug("sentemailSearchObj result count",searchResultCount); 
        // Note: If you uncomment the log.debug above, add 'N/log' to your define statement:
        // define(['N/ui/serverWidget', 'N/search', 'N/log'], function(serverWidget, search, log) { ...

        var pagedData = sentemailSearchObj.runPaged({ pageSize: 1000 }); // Use paged data for safety, though sublist has practical limits
        pagedData.pageRanges.forEach(function(pageRange){
            var myPage = pagedData.fetch({index: pageRange.index});
            myPage.data.forEach(function(result){
                var returnObj = new Object();
                returnObj.date = result.getValue({name:'sentdate'});
                returnObj.from = result.getValue(result.columns[1]); // Use column index for safety or specific name
                returnObj.subject = result.getValue({name:'subject'});
                returnObj.rec = result.getValue({name:'torecipients'});
                returnArr.push(returnObj);
                if (returnArr.length >= 200) { // Practical limit for a sublist display, adjust as needed
                    return false; // Stop processing if we have enough for display
                }
                return true;
            });
            if (returnArr.length >= 200) {
                return false; // Exit pageRanges.forEach if limit reached
            }
        });
        return returnArr;
    };

    return {
        beforeLoad: beforeLoad
    };
});