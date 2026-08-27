/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util', 'N/file', 'N/email'],
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


        //one is every day create the next instance examample
        //i.e. its 2am on Monday create the basic custom record with todays date in it


        function execute(context) {
            var newRec = buildReport()
            log.debug("newRec", newRec)
            var link = buildLink(newRec)
            var set = setLink(link, newRec)
            log.debug('done?', set)
        }

        const setLink = (link, newRec) => {
            let loadedRecord = record.load({
                type: 'customrecord_pl_rec_summary',
                id: newRec.id,
                isDynamic: true
            })
            log.debug('loadedRecord',loadedRecord)
            loadedRecord.setValue({
                fieldId: 'custrecord_pr_daily_sum_view_label',
                value: link
            })
            loadedRecord.save()
            return true
        }

        const buildLink = (newRec) => {
            var id = newRec.id
            log.debug('id', id)
            var first = 'https://7513000.app.netsuite.com/app/site/hosting/scriptlet.nl?script=829&deploy=1&compid=7513000&custom_id='
            var last = '&date=undefined&type=customrecord_pl_rec_summary'
            var url = first + id + last
            log.debug('url', url)
            return url;
        }

        const buildReport = () => {
            var today = new Date()
            var custRec = record.create({
                type: 'customrecord_pl_rec_summary',
                isDynamic: true,
            })
            custRec.setValue({
                fieldId: 'custrecordpl_rec_sum_date',
                value: today
            })
            custRec.setValue({
                fieldId: 'custrecordcustrecordpl_rec_sum_location',
                value: 8
            })
            custRec.save()
            log.debug('custRec', custRec)
            return custRec;
        }



        return {
            execute: execute
        };

    });