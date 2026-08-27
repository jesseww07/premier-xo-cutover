/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/file'],
/**
 * @param {log} log
 * @param {record} record
 * @param {search} search
 * @param {file} file
 */
function(log, record, search, file) {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */

    function execute(scriptContext) {
        var folderIds = [];
        var configRecord = getLightsConfig();
        var processingFolderId = configRecord.getValue({fieldId: 'custrecord_zastro_lights_process_folder'});
        var processedFolderId = configRecord.getValue({fieldId: 'custrecord_zastro_lights_processed_id'});

        if (processingFolderId) {
            folderIds.push(processingFolderId);
        }

        if (processedFolderId) {
            folderIds.push(processedFolderId);
        }

        if (!folderIds) {
            log.error('NO_FOLDER_ID', 'There are no Folder IDS to clean');
            return;
        }

        log.debug('FOLDER_IDS', folderIds);
        var previousItems = search.create({
            type: "folder",
            filters:
            [
                ["internalid","anyof", folderIds]
            ],
            columns:
            [
                search.createColumn({
                    name: "internalid",
                    join: 'file'
                })
            ]
        });

        var searchResultCount = previousItems.runPaged().count;
        log.debug("Items without External ID",searchResultCount);
        previousItems.run().each(function(result){
            var internalId = result.getValue({
                name: 'internalid',
                join: 'file'
            });

            if (!internalId) {
                return true;
            }

            log.debug('Internal ID', internalId);
            
            file.delete({
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
