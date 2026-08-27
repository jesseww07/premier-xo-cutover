/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/log', 'N/file','N/task'], function(serverWidget, search, log, file, task) {

    function onRequest(context) {
        try {
            if (context.request.method === 'GET') {
                // Create the form
                let form = serverWidget.createForm({ title: 'Field ID Script Search' });

                // Add field for user to input the field ID
                let fieldIdField = form.addField({
                    id: 'custpage_fieldid',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Field ID'
                });

                // Add submit button
                form.addSubmitButton({ label: 'Search' });

                // Display the form
                context.response.writePage(form);
            } else {
                // Handle form submission
                let fieldIdToSearch = context.request.parameters.custpage_fieldid;
                if (!fieldIdToSearch){
                    return
                }
                log.debug('Field ID to Search', fieldIdToSearch);

                // Schedule Map/Reduce Script
                const mapReduceTaskId = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_cat_mr_look_up_field_id',
                    deploymentId: 'customdeploy_cat_mr_look_up_field_id',
                    params: {
                        custscript_field_to_search: fieldIdToSearch
                    }
                }).submit()

                let isComplete = false
                do {
                    const taskStatus = task.checkStatus({
                        taskId: mapReduceTaskId
                    });
                    if (taskStatus.status === 'COMPLETE'){
                        isComplete = true
                        break

                    }
                } while (!isComplete);
                log.debug('here')

                let scriptVals;
                search.create({
                    type: "customrecord_cat_lookup_field_script_hol",
                    filters: [],
                    columns: ["custrecord_script_fields"]
                }).run().each(result => scriptVals = result.getValue({name: 'custrecord_script_fields'}))
                log.debug('SCRIPTVALS',scriptVals)

                const scripts = JSON.parse(scriptVals)
                log.debug('here')
                log.debug('scripts',scripts)







                // Perform the search for scripts
                //let scripts = searchScriptsByFieldId(fieldIdToSearch);

                // Create the results form
                let resultsForm = serverWidget.createForm({ title: 'Search Results' });

                // Add a sublist to display the results
                let sublist = resultsForm.addSublist({
                    id: 'custpage_results',
                    type: serverWidget.SublistType.LIST,
                    label: 'Scripts Containing Field ID'
                });

                // Add columns to the sublist
                sublist.addField({ id: 'scriptname', type: serverWidget.FieldType.TEXT, label: 'Script Name' });
                sublist.addField({ id: 'scriptid', type: serverWidget.FieldType.TEXT, label: 'Script ID' });
                sublist.addField({ id: 'scripttype', type: serverWidget.FieldType.TEXT, label: 'Script Type' });
                log.debug('here2')

                // Populate the sublist with search results
                scripts.forEach((script, index) => {


                    sublist.setSublistValue({ id: 'scriptname', line: index, value: script.ScriptName });
                    sublist.setSublistValue({ id: 'scriptid', line: index, value: script.ScriptId });
                    sublist.setSublistValue({ id: 'scripttype', line: index, value: script.ScriptType });
                });

                // Display the results form
                context.response.writePage(resultsForm);
            }
        } catch (e) {
            log.error({
                title: 'Error processing request',
                details: e.toString()
            });
            context.response.write('An error occurred: ' + e.message);
        }
    }

    /**
     * Function to search for scripts containing the specified field ID.
     * @param {string} fieldIdToSearch - The field ID to search for.
     * @returns {Array} - An array of objects representing scripts.
     */
    function searchScriptsByFieldId(fieldIdToSearch) {
        let scripts = [];
        try {
            let scriptSearch = search.create({
                type: 'script',
                filters: [
                    ["scripttype", "anyof", "BANKCONNECTIVITY", "BANKSTATEMENTPARSER", "BUNDLEINSTALLATION", "CLIENT", "RECORDACTION", "DATASETBUILDER", "EMAILCAPTURE", "EXAMPLE", "FICONNECTIVITY", "FIPARSER", "MAPREDUCE", "MASSUPDATE", "OCRPLUGIN", "PLATFORMEXTENSION", "PORTLET", "RESTLET", "SCHEDULED", "SDFINSTALLATION", "SCRIPTLET", "USEREVENT", "WORKBOOKBUILDER", "ACTION"],
                    'AND',
                    ["scriptid", "doesnotcontain", "bundle"]
                ],
                columns: [
                    "name",
                    "scriptid",
                    "scripttype",
                    "scriptfile"
                ]
            });

            let resultSet = scriptSearch.run();
            let results = resultSet.getRange({ start: 0, end: 1000 });

            results.forEach(function (result) {
                let scriptName = result.getValue({ name: 'name' });
                let scriptId = result.getValue({ name: 'scriptid' });
                let scriptType = result.getText({ name: 'scripttype' });
                let scriptFile = result.getValue({ name: 'scriptfile' });

                log.debug('Processing Script', { scriptName, scriptId, scriptType, scriptFile });

                if (scriptFile) {
                    let fileContent = loadScriptContent(scriptFile);

                    if (fileContent && fileContent.indexOf(fieldIdToSearch) !== -1) {
                        scripts.push({
                            name: scriptName,
                            id: scriptId,
                            type: scriptType
                        });
                    }
                } else {
                    log.error('Script File Missing', `Script ${scriptName} (${scriptId}) does not have an associated file.`);
                }
            });
        } catch (e) {
            log.error({
                title: 'Error in searchScriptsByFieldId',
                details: e.toString()
            });
        }
        return scripts;
    }

    /**
     * Function to load the content of a script file.
     * @param {number} scriptFileId - The internal ID of the script file.
     * @returns {string} - The content of the script file.
     */
    function loadScriptContent(scriptFileId) {
        try {
            if (!scriptFileId) {
                log.error('Missing File ID', 'No script file ID provided');
                return null;
            }

            let fileObj = file.load({ id: scriptFileId });
            if (fileObj) {
                return fileObj.getContents();
            } else {
                log.error('File Not Found', `No file found with ID: ${scriptFileId}`);
                return null;
            }
        } catch (e) {
            log.error({
                title: 'Error loading script file',
                details: e.toString()
            });
            return null;
        }
    }

    return {
        onRequest: onRequest
    };
});
