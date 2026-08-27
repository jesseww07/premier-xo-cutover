/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {util} util
     */
    function (log, record, search, util) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(context) {


            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["custbody_pr_notice_completion_date", "isempty", ""],
                        "AND",
                        ["custbody_pr_percent_commit", "equalto", "100"],
                        "AND",
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["mainline", "is", "T"],
                        "AND",
                        ["status", "anyof", "SalesOrd:B", "SalesOrd:D", "SalesOrd:E"],
                        "AND",
                        ["systemnotes.field", "anyof", "CUSTBODY_PR_PERCENT_COMMIT"],
                        "AND",
                        ["systemnotes.newvalue", "startswith", "100"],
                        //            "AND", 
                        //   ["internalidnumber","equalto","7994"]
                    ],
                columns:
                    [
                        "internalid",
                        "trandate",
                        "tranid",
                        "entity",
                        "custbody_pr_percent_commit",
                        search.createColumn({
                            name: "date",
                            join: "systemNotes"
                        }),
                        search.createColumn({
                            name: "context",
                            join: "systemNotes"
                        }),
                        search.createColumn({
                            name: "field",
                            join: "systemNotes"
                        }),
                        search.createColumn({
                            name: "oldvalue",
                            join: "systemNotes"
                        }),
                        search.createColumn({
                            name: "newvalue",
                            join: "systemNotes"
                        })
                    ]
            });
            var searchResultCount = salesorderSearchObj.runPaged().count;
            log.debug("salesorderSearchObj result count", searchResultCount);
            salesorderSearchObj.run().each(function (result) {
                //  let today = new Date()
                //  log.debug('today', today);
                var soId = result.getValue({
                    name: 'internalid'
                })
                log.debug('soId', soId);
                var timeStamp = new Date(result.getValue({
                    name: "date",
                    join: "systemNotes"
                }))
                log.debug('timeStamp', timeStamp);
                var salesOrd = record.load({
                    type: record.Type.SALES_ORDER,
                    id: soId,
                    isDynamic: true,
                })
                log.debug('salesOrd', salesOrd);
                salesOrd.setValue({
                    fieldId: 'custbody_pr_notice_completion_date',
                    value: timeStamp
                })
                salesOrd.save({ ignoreMandatoryFields: true })

                return true;
            });



        }



        return {
            execute: execute
        };

    });