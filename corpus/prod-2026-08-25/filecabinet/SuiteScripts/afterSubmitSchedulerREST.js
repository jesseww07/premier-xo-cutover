/**
 * API Version 2.1
 * Labels in NetSuite
 * Support Ticket: 2881
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00      7/17/23       Alex Gjorvad                      User Event
 * 
 *          Script Functionality
 */
/**
* @NApiVersion 2.1
* @NScriptType UserEventScript
*/
define(['N/record', 'N/task'],
    function (record, task) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */

        function afterSubmit(context) {
            scheduleTask();
        }


        function scheduleTask() {
             try {
                var mrTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
                 mrTask.scriptId = 'customscript_zastro_lights_wishlist_2';
                 mrTask.deploymentId = 'customdeploy1';
                 var mrTaskId = mrTask.submit();
                 return mrTaskId;
             }
 
             catch (err) {
                log.error('ERROR_RESCHEDULING_TASK');
                log.error(err.name, err.message);

                /*
                secondaryDeploymentMap = {
                    'customdeploy2': 'customdeploy4',
                    'customdeploy3': 'customdeploy5',
                    'customdeploy4': 'customdeploy2',
                    'customdeploy5': 'customdeploy3'
                };

                try {
                    var mrRescheduleTask = task.create({taskType: task.TaskType.MAP_REDUCE});
                    mrRescheduleTask.scriptId = 'customscript714';
                    mrRescheduleTask.deploymentId = secondaryDeploymentMap[deploymentId];
                    var mrTaskId = mrRescheduleTask.submit();
                    return mrTaskId;
                }

                catch (err) {
                    log.error('ERROR_RESCHEDULING_TASK_ALTERNATE');
                    log.error(err.code, err.message);
                    return false;
                }
                */
            }
        }

        return {
            afterSubmit: afterSubmit
        };

    });