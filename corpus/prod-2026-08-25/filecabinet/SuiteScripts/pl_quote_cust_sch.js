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
            try {
                var returnArray = runSearch()
                log.debug('returnArray', returnArray)
                if (returnArray.length > 0) {
                    var foundCustomer;
                    for (var x = 0; x < returnArray.length; x++) {
                        var custToCheck = returnArray[x].cust
                        log.debug('custToCheck', custToCheck)
                        var docId = returnArray[x].id
                        log.debug('docId', docId)
                        var returnCust = checkCustomer(custToCheck)
                        log.debug('returnCust', returnCust)
                        if (!returnCust) {
                            var returnCreated = createCustomer(custToCheck)
                            foundCustomer = returnCreated
                        }
                        else{
                            foundCustomer = returnCust
                        }
                        var quoteCust = record.submitFields({
                            type: 'customrecord_pr_quote_parent',
                            id: docId,
                            values: {
                                'custrecord_pr_customer_list': foundCustomer
                            }
                        });
                    }
                }
            }
            catch (e) {
                log.debug('e', e)
            }
        }
        const runSearch = () => {
            var returnArray = new Array()
            var customrecord_pr_quote_parentSearchObj = search.create({
                type: "customrecord_pr_quote_parent",
                filters:
                    [
                        ["custrecord_pr_customer_text", "isnotempty", ""],
                        "AND",
                        ["custrecord_pr_customer_list", "anyof", "@NONE@"]
                    ],
                columns:
                    [
                        "internalid",
                        "custrecord_pr_customer_text"
                    ]
            });
            var searchResultCount = customrecord_pr_quote_parentSearchObj.runPaged().count;
            log.debug("customrecord_pr_quote_parentSearchObj result count", searchResultCount);
            customrecord_pr_quote_parentSearchObj.run().each(function (result) {
                var id = result.getValue({
                    name: 'internalid'
                })
                log.debug('id', id);
                var cust = result.getValue({
                    name: 'custrecord_pr_customer_text'
                })
                log.debug('cust', cust);

                var returnObj = new Object()
                log.debug('here')
                returnObj.id = id
                log.debug('here2')
                returnObj.cust = cust
                log.debug('here3')
                returnArray.push(returnObj)
                log.debug('here4')
                return true;
            });
            return returnArray
        }
        const checkCustomer = (custToCheck) => {
            var returnId;
            var customerSearchObj = search.create({
                type: "customer",
                filters:
                    [
                        ["entityid", "is", custToCheck]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "entityid",
                            sort: search.Sort.ASC
                        }),
                        "internalid"
                    ]
            });
            var searchResultCount = customerSearchObj.runPaged().count;
            log.debug("customerSearchObj result count", searchResultCount);
            customerSearchObj.run().each(function (result) {
                var id = result.getValue({
                    name: "internalid"
                })
                returnId = id
                return true;
            });
            return returnId
        }
        const createCustomer = (custToCheck) => {
            log.debug('in record create')
            var customer = record.create({
                type: 'customer',
                isDynamic: true
            })
            customer.setValue({
                fieldId: 'isperson',
                value: 'F'
            })
            customer.setValue({
                fieldId: 'companyname',
                value: custToCheck
            })
            customer.setValue({
                fieldId: 'subsidiary',
                value: 2
            })
            var savedCustomer = customer.save({
                ignoreMandatoryFields: true
              });
            return savedCustomer
        }
        return {
            execute: execute
        };

    });