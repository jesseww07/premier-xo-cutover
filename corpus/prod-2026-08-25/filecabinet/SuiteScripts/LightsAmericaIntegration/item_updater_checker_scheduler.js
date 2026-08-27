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

        var previousItems = search.load({
            id: 'customsearch_zastro_lights_item_price'
        });

        previousItems.run().each(function(result){
            remainingUsage = scriptObj.getRemainingUsage();
            if (remainingUsage < 500) {
                log.debug('Scheduling Script');
                var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
                scriptTask.scriptId = 'customscript_zastro_lights_item_updater';
                scriptTask.deploymentId = 'customdeploy1';
                var scriptTaskId = scriptTask.submit();
                return false;
            }

            var internalId = result.getValue({
                name: 'internalid',
            });

            var laItem = record.load({
                type: 'customrecord_zastro_lights_items',
                id: internalId,
            });

            try {
                laItem.save();
            }

            catch (err) {
                //Something
            }

            return true;
        });
    }


    return {
        execute: execute
    };
    
});
