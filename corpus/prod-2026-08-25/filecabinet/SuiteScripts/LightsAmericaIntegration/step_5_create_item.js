/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define([
    'N/log',
    'N/record',
    'N/runtime',
    'N/search',
    'N/task',
    'N/email',
    'SuiteScripts/LightsAmericaIntegration/Templates/customer_item_mapping_carolina_lanterns.js',
    'SuiteScripts/LightsAmericaIntegration/Model/item.js'
],
    /**
     * @param {log} log
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {task} task
     */
    function (log, record, runtime, search, task, email, customerTemplate, itemModel) {

        function getInputData() {
            var scriptObj = runtime.getCurrentScript();
            var remainingUsage = 10000;

            var deploymentId = scriptObj.deploymentId;
            var configRecord = itemModel.getLightsConfig();

            //Deployment 1 will submit execution of other deployments as processor threads
            if (deploymentId == 'customdeploy1') {
                scheduleNextThreadTask('customdeploy2', false);
                scheduleNextThreadTask('customdeploy3', false);
                return true;
            }

            var queueName = runtime.getCurrentScript().getParameter({name: 'custscript_queue_thread_hash_id'});
            var queueId = runtime.getCurrentScript().getParameter({name: 'custscript_queue_thread_queue_id'});

            if (!queueName) {
                log.error('PROCESSOR_THREAD_HAS_NO_QUEUE_HASH');
                return false;
            }

            if (!queueId) {
                log.error('PROCESSOR_THREAD_HAS_NO_QUEUE_ID');
                return false;
            }

            log.debug('PROCESSOR_THREAD_STARTING', queueName);

            //Execution past this point is for the processor thread
             var itemQueueSearch = search.create({
                type: "customrecord_zastro_lights_items",
                filters:
                [
                   ["custrecord_processor_hash_2", "is", queueName]
                ],
                columns:
                [
                   search.createColumn({
                      name: "id",
                      sort: search.Sort.ASC,
                   }),
                ]
             });

             var customerFieldMapping = customerTemplate.getCustomItemFieldMapping();
             var manufacturerMappingTable = itemModel.getStoredManufacturerMapingTable();

             itemQueueSearch.run().each(function(result){
                // .run().each has a limit of 4,000 results
                try {
                    var lightsItemId = result.getValue({name: 'id'});
                    var lightsItem = record.load({
                        type: 'customrecord_zastro_lights_items',
                        id: lightsItemId
                    });

                    var netsuiteItemId = lightsItem.getValue({fieldId: 'custrecord_lights_linked_item'});
                    var legacyLookupMethod = lightsItem.getValue({fieldId: 'custrecord_legacy_lookup_method'});
                    if (legacyLookupMethod) {
                        netsuiteItemId = itemModel.mergeOneItemRecord(configRecord, manufacturerMappingTable, customerFieldMapping, lightsItem, false);
                        if (netsuiteItemId) {
                            lightsItem.setValue({fieldId: 'custrecord_lights_linked_item', value: netsuiteItemId});
                        }
                    }

                    else if (netsuiteItemId) {
                        netsuiteItemId = itemModel.updateOneItemRecord(netsuiteItemId, configRecord, manufacturerMappingTable, customerFieldMapping, lightsItem);
                    }

                    else {
                        netsuiteItemId = itemModel.createOneItemRecord(configRecord, manufacturerMappingTable, customerFieldMapping, lightsItem, false);

                        if (netsuiteItemId) {
                            lightsItem.setValue({fieldId: 'custrecord_lights_linked_item', value: netsuiteItemId});
                        }
    
                        else {
                            log.error('NO_ITEM_ID_RETURNED');
                            //TODO: Indicate some error status/reporting
                        }
                    }

                    lightsItem.save();
                }

                catch (err) {
                    //This condition likely happens during parallel processing of the same item
                    if (err.name == 'RCRD_HAS_BEEN_CHANGED') {
                        log.debug('RCRD_HAS_BEEN_CHANGED', 'Continue');
                        return true;
                    }

                    else {
                        log.error('EXCEPTION_CREATING_ITEM');
                        log.error(err.name, err.message);
                        return false;
                    }
                }

                return true;

            });

            var queueRecord = record.load({type: 'customrecord_zastro_la_processor_queue', id: queueId});
            queueRecord.setValue({fieldId: 'custrecord_processor_status', value: 4});
            queueRecord.save();

            log.debug('COMPLETED_QUEUE_RESCHEDULING');
             var deploymentId = runtime.getCurrentScript().deploymentId;

             //The object mapping of deployment records ensures a different deployment is scheduled
             primaryDeploymentMap = {
                 'customdeploy2': 'customdeploy3',
                 'customdeploy3': 'customdeploy2',
                 'customdeploy4': 'customdeploy5',
                 'customdeploy5': 'customdeploy4'
             };

             var newDeploymentId = primaryDeploymentMap[deploymentId];

             scheduleNextThreadTask(newDeploymentId, true);
             return true;
        }
    

        function scheduleNextThreadTask(deploymentId, reschedule) {
            //This is the second layer of protection for thread safe
            //This random pause will ensure if two runners start at exactly the same moment, both jobs will receive a different queue record
            //var randomInterval = Math.floor(Math.random() * 8);
            //pause(randomInterval);

            log.debug('RESCHEDULING_TASK_QUEUE');

            var processorQueueSearch = search.create({
                type: "customrecord_zastro_la_processor_queue",
                filters:
                [
                    ["custrecord_processor_status","anyof","2"], 
                    "AND", 
                    ["custrecord_adhoc_processor","is","F"]
                 ],
                columns:
                [
                   search.createColumn({
                      name: "internalid",
                   }),
                ]
             });

             var queueName = false;
             var queueId = false;

             processorQueueSearch.run().each(function(result){
                // .run().each has a limit of 4,000 results
                queueId = result.getValue({name: 'internalid'});

                return false;
             });

            if (!queueId) {
                log.error('SCHEDULING_ERROR_NO_NEXT_QUEUE_ID');
                return false;
            }

            //Load the queue parent and set its status as processing
            var queueRecord = record.load({type: 'customrecord_zastro_la_processor_queue', id: queueId, isDynamic: true});
            queueName = queueRecord.getValue({fieldId: 'name'});
            var currentQueueStatus = queueRecord.getValue({fieldId: 'custrecord_processor_status'});

            //This could happen if another thread grabbed a task after it was searched but before it was updated. If this happens, allow recursion to find the next one.
            if (currentQueueStatus == 3) {
                log.error('QUEUE_STATUS_CHANGED_BEFORE_PROCESSING');
                return scheduleNextThreadTask(deploymentId, reschedule);
            }

            queueRecord.setValue({fieldId: 'custrecord_processor_status', value: 3});
            queueRecord.save();

            if (!queueName) {
                log.error('QUEUE_NAME_EMPTY');
                return false;
            }

             try {
                var mrTask = task.create({taskType: task.TaskType.MAP_REDUCE});
                 mrTask.scriptId = 'customscript_zastro_la_step_5';
                 mrTask.deploymentId = deploymentId;
                 mrTask.params = {custscript_queue_thread_hash_id: queueName, custscript_queue_thread_queue_id: queueId};
                 var mrTaskId = mrTask.submit();
                 return mrTaskId;
             }
 
             catch (err) {
                if (reschedule) {
                    log.error('ERROR_RESCHEDULING_TASK');
                    log.error(err.name, err.message);

                    secondaryDeploymentMap = {
                        'customdeploy2': 'customdeploy4',
                        'customdeploy3': 'customdeploy5',
                        'customdeploy4': 'customdeploy2',
                        'customdeploy5': 'customdeploy3'
                    };

                    try {
                        var mrRescheduleTask = task.create({taskType: task.TaskType.MAP_REDUCE});
                        mrRescheduleTask.scriptId = 'customscript_zastro_la_step_5';
                        mrRescheduleTask.deploymentId = secondaryDeploymentMap[deploymentId];
                        mrRescheduleTask.params = {custscript_queue_thread_hash_id: queueName, custscript_queue_thread_queue_id: queueId};
                        var mrTaskId = mrRescheduleTask.submit();
                        return mrTaskId;
                    }
        
                    catch (err) {
                        log.error('ERROR_RESCHEDULING_TASK_ALTERNATE');
                        log.error(err.code, err.message);
                        return false;
                    }
                }

                else {
                    log.error('ERROR_SCHEDULING_TASK');
                    log.error(err.name, err.message);
                    return false;
                }
             }
        }


        function rescheduleThreadTask(deploymentId, reschedule) {
            log.debug('RESCHEDULING_EXISTING_TASK_QUEUE');

            var scriptObj = runtime.getCurrentScript();
            var deploymentId = scriptObj.deploymentId;
            var queueName = runtime.getCurrentScript().getParameter({name: 'custscript_queue_thread_hash_id'});
            var queueId = runtime.getCurrentScript().getParameter({name: 'custscript_queue_thread_queue_id'});

             try {
                var mrTask = task.create({taskType: task.TaskType.MAP_REDUCE});
                 mrTask.scriptId = 'customscript_zastro_la_step_5';
                 mrTask.deploymentId = deploymentId;
                 mrTask.params = {custscript_queue_thread_hash_id: queueName, custscript_queue_thread_queue_id: queueId};
                 var mrTaskId = mrTask.submit();
                 return mrTaskId;
             }
 
             catch (err) {
                if (reschedule) {
                    log.error('ERROR_RESCHEDULING_TASK');
                    log.error(err.name, err.message);

                    secondaryDeploymentMap = {
                        'customdeploy2': 'customdeploy4',
                        'customdeploy3': 'customdeploy5',
                        'customdeploy4': 'customdeploy2',
                        'customdeploy5': 'customdeploy3'
                    };

                    try {
                        var mrRescheduleTask = task.create({taskType: task.TaskType.MAP_REDUCE});
                        mrRescheduleTask.scriptId = 'customscript_zastro_la_step_5';
                        mrRescheduleTask.deploymentId = secondaryDeploymentMap[deploymentId];
                        mrRescheduleTask.params = {custscript_queue_thread_hash_id: queueName, custscript_queue_thread_queue_id: queueId};
                        var mrTaskId = mrRescheduleTask.submit();
                        return mrTaskId;
                    }
        
                    catch (err) {
                        log.error('ERROR_RESCHEDULING_TASK_ALTERNATE');
                        log.error(err.code, err.message);
                        return false;
                    }
                }

                else {
                    log.error('ERROR_SCHEDULING_TASK');
                    log.error(err.name, err.message);
                    return false;
                }
             }
        }

        function map(context) {
            return false;
        }



        return {
            getInputData: getInputData,
            map: map,
        };

    });
