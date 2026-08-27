/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util', 'N/https'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {util} util
     */
    function (log, record, search, util,https) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(context) {
            try {
                var returnObj = getResponseData()
                var parse = JSON.parse(returnObj.body)
                log.debug('parse',parse)
                var orderArray = new Array()
                var objLength = parse.length
                log.debug('objLength',objLength)
                var lastIndex = parse[objLength-1]
                log.debug('lastIndex',lastIndex)
                return true
            }
            catch (e) {
                return true
            }
        }

        const getResponseData = (quote, rev) => {
            var headerObj = {
                name: 'Accept-Language',
                value: 'en-us',
                connection: 'keep-alive',
                Accept: '*/*',
                Authorization: 'API-Token a55343d89e24a49f273dc1ba5d888ba58325ef46'
            }
    
            var sendUrl = `https://api.paperlessparts.com/orders/public/new`
            log.debug('sendurl', sendUrl)
            let response = https.get({
                url: sendUrl,
                headers: headerObj
            })
            log.debug('response', response)
            return response
        }

        return {
            execute: execute
        };

    });
