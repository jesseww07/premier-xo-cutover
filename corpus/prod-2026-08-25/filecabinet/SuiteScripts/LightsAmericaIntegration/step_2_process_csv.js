/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/format', 'N/log', 'N/record', 'N/search', 'N/task', 'N/file'],
    /**
     * @param {format} format
     * @param {log} log
     * @param {record} record
     * @param {search} search
     * @param {task} task
     * @param {file} file
     */
    function (format, log, record, search, task, file) {

        function execute(scriptContext) {
            var configRecord = getLightsConfig();
            var processingFolderId = configRecord.getValue({fieldId: 'custrecord_zastro_lights_process_folder'});
            var processedFolderId = configRecord.getValue({fieldId: 'custrecord_zastro_lights_processed_id'});

            if (!processingFolderId || !processedFolderId) {
                log.error('FOLDER_CONFIG_INVALID', 'Please ensure both a processing and processed folder are set');
            }

            var folderSearchObj = search.create({
                type: "folder",
                filters:
                [
                   ["internalidnumber", "equalto", processingFolderId]
                ],
                columns:
                [
                   search.createColumn({
                      name: "internalid",
                      join: "file",
                      label: "Internal ID"
                   })
                ]
             });

             folderSearchObj.run().each(function(result){
                var fileId = result.getValue({
                    name: 'internalid',
                    join: 'file'
                });

                var fileObj = file.load({
                    id: fileId
                });
    
                var fileName = fileObj.name;
    
                var today = new Date();
    
                var importTask = task.create({
                    taskType: task.TaskType.CSV_IMPORT,
                    mappingId: 'custimport_zastro_lights_importer',
                    importFile: fileObj,
                    name: fileName + "_" + today
                });

                log.debug('CREATED_IMPORTED_TASK', importTask);

                try {
                    var csvImportTaskId = importTask.submit();
                    log.debug('CSV IMPORT TASK ID', csvImportTaskId);

                    fileObj.folder = processedFolderId;
                    fileObj.save();
                }
    
                catch (err) {
                    log.debug('ERROR_SUBMITTING_TASK', 'Could not submit CSV import task.');
                    log.debug(err.code, err.message);
                }
                // .run().each has a limit of 4,000 results
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
