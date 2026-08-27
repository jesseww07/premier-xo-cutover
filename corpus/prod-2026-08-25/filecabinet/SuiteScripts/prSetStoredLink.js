/**
 * API Version 2.1
 * Support Ticket:
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      3/30/23       Alex Gjorvad                       Scheduled
 * 
 *          Script Functionality
 * This script sets the "Stored Sales Order" field on the original sales order that is
 * linked to the corresponding stored sales order.  This could not be set via NetSuite's
 * standard CSV import because values for mandatory fields are missing on the original
 * sales orders.
 * 
 */
/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/runtime', 'N/record', 'N/task', 'N/file', 'N/email'],
    function (search, runtime, record, task, file, email) {

        function execute(scriptContext) {
            var errorArray = [];
            //Name of Folder: Stored Sales Orders
            //Name of File: pr_set_stored_so.csv
            var fileObj = file.load({
                id: 203118
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
                var origSalesOrder = recordArraySplit[0];
                log.debug('orig_sales_order', origSalesOrder);
                var storedSalesOrder = recordArraySplit[2];
                log.debug('stored_so', storedSalesOrder);
                var id = record.submitFields({
                    type: record.Type.SALES_ORDER,
                    id: origSalesOrder,
                    values: {
                        custbody_abe_so: storedSalesOrder
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields : true
                    }
                });
                log.debug('so_id', id);
            }
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