
   /**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util', 'N/task', 'N/url', 'N/https', 'N/file'],
/**
 * @param {log} log
 * @param {record} record
 * @param {search} search
 * @param {util} util
 * @param {task} task
 * @param {url} url
 * @param {https} https
 * @param {file} file
 */
function (log, record, search, util, task, url, https, file) {

    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(context) {
        var fileObj = file.load({
            id: 3215
           });

           var fileContents = fileObj.getContents().split(/\n|\n\r/);
           log.debug('fileContents',fileContents)
           log.debug('fileContents',fileContents.length)

           for (var i = 0; i < fileContents.length; i++) {
            var content = fileContents[i].split(',');
            var customer = content[1];
            var so = content[2];
            var subtotal = content[3];
            var taxes = content[4];
            var total = content[5];
            var paid = content[6];
            log.debug('line', content)
            try{
                var custDeposit = record.create({
                    type: 'customerdeposit',
                    isDynamic: true
                })
                custDeposit.setValue({
                    fieldId: 'customer',
                    value: customer
                })
                custDeposit.setValue({
                    fieldId: 'salesorder',
                    value: so
                })
                custDeposit.setValue({
                    fieldId: 'payment',
                    value: paid
                })
                var date = new Date('04/30/2022')
                custDeposit.setValue({
                    fieldId: 'trandate',
                    value: date
                })
                custDeposit.setValue({
                    fieldId: 'paymentmethod',
                    value: 11
                })
                var saved = custDeposit.save()
                log.debug('saved', saved)
            }
            catch(e){
                log.debug('e',e)
            }
           
           }
    }

    return {
        execute: execute
    };

});
