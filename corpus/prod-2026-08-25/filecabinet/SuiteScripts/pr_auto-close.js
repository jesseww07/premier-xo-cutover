/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {ui} ui
     * @param {dialog} dialog
     * @param {runtime} runtime
     */
    function (record, search, ui, dialog, runtime) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(context) {
            try{
                var salesOrd = context.newRecord
                var id = salesOrd.id
                log.debug(id)
                var createdFromOpp = salesOrd.getValue({
                    fieldId: 'custbody_apx_created_from_opp'
                });
                var salesOrdStatus = salesOrd.getValue({
                    fieldId: 'status'
                });
                log.debug('salesOrdStatus', salesOrdStatus)
                log.debug('createdFromOpp',createdFromOpp)
                if(createdFromOpp){
                    var customrecord2SearchObj = search.create({
                        type: "customrecord2",
                        filters:
                        [
                           ["custrecord_sark_opportunity","anyof",createdFromOpp]
                        ],
                        columns:
                        [
                           "custrecord_sark_created_quote"
                        ]
                     });
                     var searchResultCount = customrecord2SearchObj.runPaged().count;
                     log.debug("customrecord2SearchObj result count",searchResultCount);
                     customrecord2SearchObj.run().each(function(result){
                        // .run().each has a limit of 4,000 results
                        additionalQuoID = result.getValue({
                            name: 'custrecord_sark_created_quote'
                        })
                        var quoteClosed = processesQuote(additionalQuoID)
                        log.debug('quoteClosed',quoteClosed)
                        return true;
                     });
                     var opportunityProcessed = processOpportunity(createdFromOpp)
                     log.debug('opportunityProcessed', opportunityProcessed)
                }
            }
            catch(e){
                log.debug('failure in eaches')
            }
        }

        const processOpportunity = (createdFromOpp) => {
            var loadOpportunity = record.load({
                type: 'opportunity',
                id: createdFromOpp
            });
            var entityStatus = loadOpportunity.getValue({
                fieldId: 'entitystatus'
            });
            var docStatus = loadOpportunity.getValue({
                fieldId: 'status'
            });
            log.debug('createdFromOpp', createdFromOpp)
            log.debug('entityStatus', entityStatus)
            log.debug('docStatus', docStatus)
            if(docStatus != 'Processed'){
                loadOpportunity.setValue({
                    fieldId: 'entitystatus',
                    value: 13
                });
                loadOpportunity.save()
                return 'Changed'
            }
            else{
                return 'No Change Needed'
            }
        }

        const processesQuote = (additionalQuoID) => {
            var loadNewQuote = record.load({
                type: 'estimate',
                id: additionalQuoID
            });
            var additionalQuoStatus = loadNewQuote.getValue({
                fieldId: 'status'
            });
            log.debug('additionalQuoStatus', additionalQuoStatus)
            if(additionalQuoStatus != 'Processed'){
                loadNewQuote.setValue({
                    fieldId: 'entitystatus',
                    value: 14
                });
                loadNewQuote.save()
                return 'Changed'
            }
            else{
                return 'No Change Needed'
            }
        }

        return {
            onAction: onAction
        };

    });
