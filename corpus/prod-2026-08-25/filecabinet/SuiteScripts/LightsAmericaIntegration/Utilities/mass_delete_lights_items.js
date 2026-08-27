/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util', 'N/runtime', 'N/task'],
/**
 * @param {log} log
 * @param {record} record
 * @param {search} search
 * @param {util} util
 */
function(log, record, search, util, runtime, task) {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */

    function execute(scriptContext) {
        var scriptObj = runtime.getCurrentScript();
        var remainingUsage = 10000;

        var previousItems = search.create({
            type: "customrecord_zastro_la_processor_queue",
            filters:
            [
                ["custrecord_processor_status", "is", "2"]
            ],
            columns:
            [
                search.createColumn({
                    name: "internalid",
                })
            ]
        });

        var searchResultCount = previousItems.runPaged().count;
        log.debug("Stuck in Processing",searchResultCount);
        previousItems.run().each(function(result){
            remainingUsage = scriptObj.getRemainingUsage();
            if (remainingUsage < 500) {
                log.debug('Scheduling Script');
                var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
                scriptTask.scriptId = 'customscript_zastro_la_delete_util';
                scriptTask.deploymentId = 'customdeploy1';
                var scriptTaskId = scriptTask.submit();
                return false;
            }

            var internalId = result.getValue({
                name: 'internalid',
            });

            record.delete({
                type: 'customrecord_zastro_la_processor_queue',
                id: internalId,
            });

            return true;
        });
    }

    function getLightsConfig() {
        var configSearch = search.create({
            type: "customrecord_zastro_lights_file_config",
            filters:
            [
                ["isinactive","isnot", 'T']
            ],
            columns:
            [
                search.createColumn({
                    name: "internalid",
                })
            ]
        });

        var internalId = '';
        configSearch.run().each(function(result){
            internalId = result.getValue({
                name: 'internalid',
            });

            return false;
        });

        var configRecord = record.load({
            type: 'customrecord_zastro_lights_file_config',
            id: internalId
        });

        return configRecord;
    }

    return {
        execute: execute
    };
    
});
