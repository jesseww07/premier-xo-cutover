/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/runtime', 'N/search', 'N/task'],
    /**
     * @param {log} log
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {task} task
     */
    function (log, record, runtime, search, task) {

        function getInputData() {
            try {

                var laItemSearch = search.create({
                    type: "customrecord_zastro_lights_items",
                    filters:
                    [
                       ["custrecord_processor_hash_2","isempty",""]
                    ],
                    columns:
                    [
                       search.createColumn({
                          name: "id",
                          sort: search.Sort.ASC,
                       })
                    ]
                 });
                 var searchResultCount = laItemSearch.runPaged().count;
                 log.debug("customrecord_zastro_lights_itemsSearchObj result count",searchResultCount);
    
                if (!searchResultCount) {
                    log.debug('There are no search results');
                }
                //This is the 10,000 limit
          /*       var overallLimit = 1440;
                 var limit = 240;
                 var count = 0;
                 var overallCount = 0; */

                 var overallLimit = 1440;
                 var limit = 120;
                 var count = 0;
                 var overallCount = 0;
    
                 var hashId = generateHasId();
                 var hashRecord = record.create({type: 'customrecord_zastro_la_processor_queue'});
                 hashRecord.setValue({fieldId: 'name', value: hashId});
                 hashRecord.setValue({fieldId: 'custrecord_processor_start_date', value: new Date()});
                 var hashRecordId = hashRecord.save();
    
                 laItemSearch.run().each(function(result){
                    // .run().each has a limit of 4,000 results

                    if (overallCount >= overallLimit) {
                        log.debug('Overall limit reached');
                        return false;
                    }
    
                    if (count >= limit) {
                        log.debug('Count is greater than limit');
                        existingHashRecord = record.load({type: 'customrecord_zastro_la_processor_queue', id: hashRecordId});
                        existingHashRecord.setValue({fieldId: 'custrecord_processor_record_count', value: count - 1});
                        existingHashRecord.setValue({fieldId: 'custrecord_processor_status', value: 2});
                        existingHashRecord.save();
    
                        hashId = generateHasId();
                        var hashRecord = record.create({type: 'customrecord_zastro_la_processor_queue'});
                        hashRecord.setValue({fieldId: 'name', value: hashId});
                        hashRecord.setValue({fieldId: 'custrecord_processor_start_date', value: new Date()});
                        hashRecordId = hashRecord.save();
                        count = 0;
                        
                    }
    
                    var internalId = result.getValue({name: 'id'});
                    var lightsItem = record.load({type: 'customrecord_zastro_lights_items', id: internalId});
                    lightsItem.setValue({fieldId: 'custrecord_processor_hash_2', value: hashId});
                    lightsItem.setValue({fieldId: 'custrecord_processor_hash_2_date', value: new Date()});
                    lightsItem.save();

                    count += 1;
                    overallCount += 1;
                    return true;
                 });

                 existingHashRecord = record.load({type: 'customrecord_zastro_la_processor_queue', id: hashRecordId});
                 existingHashRecord.setValue({fieldId: 'custrecord_processor_record_count', value: count});
                 existingHashRecord.setValue({fieldId: 'custrecord_processor_status', value: 2});
                 existingHashRecord.save();

                 log.debug('Rescheduling');
                 var mrTask = task.create({taskType: task.TaskType.MAP_REDUCE});
                 log.debug('Created Task');
                 var deploymentId = runtime.getCurrentScript().deploymentId;
                 newDeploymentMap = {
                     'customdeploy2': 'customdeploy1',
                     'customdeploy1': 'customdeploy2'
                 };
     
                 try {
                     mrTask.scriptId = 'customscript_zastro_la_gen_queue';
                     mrTask.deploymentId = newDeploymentMap[deploymentId];
                     var mrTaskId = mrTask.submit();
                 }
     
                 catch (err) {
                     log.debug(err.code, err.message);
                 }

            }
            
            catch(err) {
                log.debug(err.code, err.message);
            }

            var mySearch = new Array();
            var newObj = new Object();
            newObj.dummy = 'data';
            mySearch.push(newObj);
            return mySearch;
        }


        function generateHasId() {
            var hashId = '';
            var characters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
            var charactersLength = characters.length;
            for (var i = 0; i < 20; i++) {
               hashId += characters.charAt(Math.floor(Math.random() * charactersLength));
            }

            return hashId;
        }


        function map(context) {
            return true;
        }


        return {
            getInputData: getInputData,
            map: map,
            //reduce: reduce,
            //        summarize: summarize
        };

    });
