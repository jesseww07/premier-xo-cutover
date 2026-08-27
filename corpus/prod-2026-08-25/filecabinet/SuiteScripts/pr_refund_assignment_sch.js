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
            var returnArray = getRefundArray()
            log.debug('returnArray', returnArray)
            if (returnArray.length > 0) {
                for (var x = 0; x < returnArray.length; x++) {
                    var refundID = returnArray[x]
                    var returnStatus = evaluateRefund(refundID)
                    log.debug('returnStatus', returnStatus)
                }
            }
        }
        const evaluateRefund = (refundID) => {
            log.debug('refundID', refundID)
            var custRef = record.load({
                type: 'customerrefund',
                id: refundID,
                isDynamic: true
            })
            var numLines = custRef.getLineCount({
                sublistId: 'apply'
            });
            if (numLines > 0) {
                for (var i = 0; i < numLines; i++) {
                    custRef.selectLine({
                        sublistId: 'apply',
                        line: i
                    });
                    var transactionAmt = custRef.getCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'amount'
                    });
                    var transactionId = custRef.getCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'internalid'
                    });
                    var transactionType = custRef.getCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'trantype'
                    });
                    var returnedSalesOrd = findAffiliatedSO(transactionAmt, transactionId, transactionType)
                    custRef.commitLine({
                        sublistId: 'apply',
                    });
                }
                return 'Link Applied, Record Saved'
            }
            else {
                custRef.setValue({
                    fieldId: ''
                })
                custRef.save()
                return 'No Change, Record Saved'
            }

        }
        const findAffiliatedSO = (transactionAmt, transactionId, transactionType) => {
            log.debug('transactionAmt', transactionAmt)
            log.debug('transactionId', transactionId)
            log.debug('transactionType', transactionType)
            var useType = typeRefTable(transactionType)
            log.debug('useType', useType)
            if (useType == 'depositapplication') {
                var transactionId = tierFive(transactionId)
                log.debug('tierfive', transactionId)
                var firstCreated = search.lookupFields({
                    type: 'customerdeposit',
                    id: transactionId,
                    columns: ['createdfrom']
                });
                log.debug('firstCreated', firstCreated)
                var dotIn = firstCreated.createdfrom
                log.debug('dotIn', dotIn)
                var indexIn = dotIn[0]
                log.debug('indexIn', indexIn)
                var createdFromID = indexIn.value
                //log.debug('SALES ORDER createdFromID index value', createdFromID)
               
                log.debug('SALES ORDER????', createdFromID)
            
                //HERE WE GET TO THE SO
                
                var id = record.submitFields({
                    type: 'salesorder',
                    id: createdFromID,
                    values: {
                        'custbody_pr_refunded_deposits': transactionAmt
                    }
                });
            }
            else {

                var firstCreated = search.lookupFields({
                    type: useType,
                    id: transactionId,
                    columns: ['createdfrom']
                });
                log.debug('firstCreated', firstCreated)
                var createdFromID = firstCreated.createdfrom[0].value
                log.debug('createdFromID', createdFromID)
                log.debug('entering useType check or else', useType)
                //at this point it can either be a RMA or a Inv or a CS
                if (useType == 'customerdeposit') {

                    var salesOrder = search.lookupFields({
                        type: 'customerdeposit',
                        id: createdFromID,
                        columns: ['createdfrom']
                    });
                    log.debug('salesOrder', salesOrder)
                    var salesOrderID = salesOrder.createdfrom
                    log.debug('salesOrderID', salesOrderID)
                }
                else {
                    var runTierOne = tierOne(createdFromID)
                    log.debug('runTierOne.docLoaded', runTierOne.docLoaded)
                    if (runTierOne.docLoaded == 'invoice' || runTierOne.docLoaded == 'cashsale') {
                        var runTierThree = tierFour(createdFromID)
                    }
                    else if (runTierOne.docLoaded == 'returnauthorization') {
                        var runTierTwo = tierTwo(createdFromID)
                        log.debug('runTierTwo',runTierTwo)
                        //HERE WE GET THE INVOICE/CASH SALE AND JUST NEED FINAL LINK
                        var loadedAndSet = sendThrough(runTierTwo,transactionAmt)
                    }
                    else if (runTierOne.docLoaded == 'creditmemo') {
                        var runTierThree = tierThree(createdFromID)
                    }
                    else {
                        log.debug('ooof')
                    }

                }
            }



        }

        const sendThrough = (runTierTwo,transactionAmt) => {
            log.debug('in sendthou',runTierTwo)
            var cfID = runTierTwo.createdFrom
            log.debug('in cfID',cfID)
        
            var id = record.submitFields({
                type: 'salesorder',
                id: cfID,
                values: {
                    'custbody_pr_refunded_deposits': transactionAmt
                }
            });
            return 'success'

        }
        const tierOne = (createdFromID) => {
            var docLoaded;
            try {
                var objRec = record.load({
                    type: 'returnauthorization',
                    id: createdFromID,
                    isDynamic: true
                })
                docLoaded = 'returnauthorization'
            }
            catch (one) {
                try {
                    var objRec = record.load({
                        type: 'creditmemo',
                        id: createdFromID,
                        isDynamic: true
                    })
                    docLoaded = 'creditmemo'
                }
                catch (two) {
                    try {
                        var objRec = record.load({
                            type: 'invoice',
                            id: createdFromID,
                            isDynamic: true
                        })
                        docLoaded = 'invoice'
                    }
                    catch (three) {
                        var objRec = record.load({
                            type: 'cashsale',
                            id: createdFromID,
                            isDynamic: true
                        })
                        docLoaded = 'cashsale'
                    }
                }

            }
            log.debug('docLoaded', docLoaded)
            var secondCreated = objRec.getValue({
                fieldId: 'createdfrom'
            })
            var returnObject = new Object()
            returnObject.docLoaded = docLoaded
            returnObject.createdFrom = secondCreated
            return returnObject
        }
        const tierTwo = (createdFromID) => {
            //returnauth
            log.debug('load rma',createdFromID)
            var docLoaded;
            try {
                var objRec = record.load({
                    type: 'returnauthorization',
                    id: createdFromID,
                    isDynamic: true
                })
                docLoaded = 'returnauthorization'
            }
            catch (two) {
                log.debug('two', two)
            }
            log.debug('docLoaded', docLoaded)
            var secondCreated = objRec.getValue({
                fieldId: 'createdfrom'
            })
            try {
                var objRec = record.load({
                    type: 'invoice',
                    id: secondCreated,
                    isDynamic: true
                })
                docLoaded = 'invoice'
            }
            catch (three) {
                var objRec = record.load({
                    type: 'cashsale',
                    id: secondCreated,
                    isDynamic: true
                })
                docLoaded = 'cashsale'
            }
            log.debug('docLoaded', docLoaded)
            var thirdCreated = objRec.getValue({
                fieldId: 'createdfrom'
            })
            var returnObject = new Object()
            returnObject.docLoaded = docLoaded
            returnObject.createdFrom = thirdCreated
            return returnObject
        }
        const tierThree = (createdFromID) => {
            //credit memo
            var docLoaded;
            try {
                var objRec = record.load({
                    type: 'creditmemo',
                    id: createdFromID,
                    isDynamic: true
                })
                docLoaded = 'creditmemo'
            }
            catch (three) {

            }
            var creditCreated = objRec.getValue({
                fieldId: 'createdfrom'
            })
            var returnAuth = record.load({
                type: 'returnauthorization',
                id: creditCreated,
                isDynamic: true
            })
            var returnCreated = returnAuth.getValue({
                fieldId: 'createdfrom'
            })
            try {
                var objRecTwo = record.load({
                    type: 'invoice',
                    id: returnCreated,
                    isDynamic: true
                })
                docLoaded = 'invoice'
            }
            catch (three) {
                var objRecTwo = record.load({
                    type: 'cashsale',
                    id: returnCreated,
                    isDynamic: true
                })
                docLoaded = 'cashsale'
            }
            log.debug('docLoaded', docLoaded)
            var secondCreated = objRecTwo.getValue({
                fieldId: 'createdfrom'
            })
            var returnObject = new Object()
            returnObject.docLoaded = docLoaded
            returnObject.createdFrom = secondCreated
            return returnObject
        }
        const tierFour = (createdFromID) => {
            //inv
            var docLoaded;
            try {
                var objRec = record.load({
                    type: 'salesorder',
                    id: createdFromID,
                    isDynamic: true
                })
                docLoaded = 'salesorder'
            }
            catch (three) {
                log.debug('three', three)
            }
            log.debug('docLoaded', docLoaded)
            var secondCreated = objRec.getValue({
                fieldId: 'createdfrom'
            })
            var returnObject = new Object()
            returnObject.docLoaded = docLoaded
            returnObject.createdFrom = secondCreated
            return returnObject
        }
        const tierFive = (createdFromID) => {
            //deposit
            var docLoaded;
            try {
                var objRec = record.load({
                    type: 'depositapplication',
                    id: createdFromID,
                    isDynamic: true
                })
                docLoaded = 'depositapplication'
            }
            catch (three) {
                log.debug('three', three)
            }
            var depo = objRec.getValue({
                fieldId: 'deposit'
            })
            return depo
        }
        const getRefundArray = () => {
            var returnArray = new Array()
            var customerrefundSearchObj = search.create({
                type: "customerrefund",
                filters:
                    [
                        ["mainline", "is", "T"],
                        "AND",
                        ["type", "anyof", "CustRfnd"],
                        "AND",
                        ["custbody_pr_automation_ran", "is", "F"],
                        "AND",
                        ["internalidnumber", "equalto", "42735"]
                    ],
                columns:
                    [
                        "internalid",
                    ]
            });
            var searchResultCount = customerrefundSearchObj.runPaged().count;
            log.debug("customerrefundSearchObj result count", searchResultCount);
            customerrefundSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                var id = result.getValue({
                    name: 'internalid'
                })
                returnArray.push(id)
                return true;
            });
            return returnArray
        }
        const typeRefTable = (transactionType) => {
            var returnType;
            if (transactionType == 'CustCred') {
                returnType = 'creditmemo'
            }
            else if (transactionType == 'DepAppl') {
                returnType = 'depositapplication'
            }
            else {
                returnType = 'NONE'
            }
            return returnType
        }

        return {
            execute: execute
        };

    });
