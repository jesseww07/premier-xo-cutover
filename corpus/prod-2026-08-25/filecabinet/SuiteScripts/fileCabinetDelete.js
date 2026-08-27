/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util', 'N/https', 'N/file'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {util} util
     */
    function (log, record, search, util, https, file) {

        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        function execute(context) {

            var folderSearchObj = search.create({
                type: "folder",
                filters:
                [
                   ["internalidnumber","equalto","447197"]
                ],
                columns:
                [
                   search.createColumn({
                      name: "internalid",
                      join: "file"
                   })
                ]
             });
             var searchResultCount = folderSearchObj.runPaged().count;
             log.debug("folderSearchObj result count",searchResultCount);
             folderSearchObj.run().each(function(result){

                 let fileId = result.getValue({
                    name: "internalid",
                    join: "file"
                 })
                
                try {
                    // file.delete({
                    //     id: fileId
                    //    });
                     var fileObj = file.load({
                 id: fileId
             });
             
             fileObj.folder = 447196
             fileId = fileObj.save();
                }
                catch (e) {
                    log.debug('e', e)
                }

                return true;
             }); 
                
        }
    

        return {
            execute: execute
        };

    });