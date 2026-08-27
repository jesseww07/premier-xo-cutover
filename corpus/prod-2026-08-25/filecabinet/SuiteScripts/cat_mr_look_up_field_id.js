/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/file', 'N/search','N/runtime','N/record'], (file, search, runtime, record) => {

        const getInputData = (inputContext) => {
            return search.create({
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

        }



        const map = (context) => {

            const value = JSON.parse(context.value);
            const scriptName = value.values.name;
            const scriptId = value.values.scriptid;
            const scriptType = value.values.scripttype.value;
            const scriptFile = value.values.scriptfile.value;
            // Load the script file content
            const fileContent = loadScriptContent(scriptFile);
            log.debug('fileContent',fileContent)

            const fieldToSearch = runtime.getCurrentScript().getParameter({name: 'custscript_field_to_search'})
            log.debug('fieldToSearch',fieldToSearch)


            // Check if the script content contains the field ID
            if (fileContent && fileContent.indexOf(fieldToSearch) !== -1) {
                const scriptObj = {
                    ScriptName: scriptName,
                    ScriptId: scriptId,
                    ScriptType: scriptType
                }
                log.debug('Script Found', scriptObj);
                context.write({
                    key: 1,
                    value: scriptObj
                })
            }
            else {
                log.debug('DOESNT INCLUDE')
            }

        }


        const reduce = (context) => {
            let recordHolderId;
            let newArr = []
            // This is telling the summarize stage that the reduce phase did run and there is atleast one value.
            // If there are no scripts found, reduce phase will never run because no context was written in the
            // map stage.
            context.write({
                key: '1',
                value: 1
            });
            for (let i=0; i<context.values.length; i++){
                if (context.values[i]){
                    newArr.push(JSON.parse(context.values[i]))
                }
            }
            log.debug('newArr',newArr)
            search.create({
                type: "customrecord_cat_lookup_field_script_hol",
                filters: [],
                columns: ["scriptid"]
            }).run().each(result => recordHolderId = result.id)
            if (recordHolderId) {
                record.submitFields({
                    type: 'customrecord_cat_lookup_field_script_hol',
                    id: recordHolderId,
                    values: {
                        custrecord_script_fields: JSON.stringify(newArr)
                    }
                })
            }
            else {
                const newHolder = record.create({
                    type: 'customrecord_cat_lookup_field_script_hol'
                })
                newHolder.setValue({fieldId: 'custrecord_script_fields',value: JSON.stringify(newArr)})
                newHolder.save()
            }

        }

        /**
         * Function to load the content of a script file.
         * @param {number} scriptFileId - The internal ID of the script file.
         * @returns {string} - The content of the script file.
         */
        function loadScriptContent(scriptFileId) {
            try {
                let fileObj = file.load({ id: scriptFileId });
                return fileObj.getContents();
            } catch (e) {
                // Ignore errors related to file loading
                return null;
            }
        }

        const summarize = (context) => {
            log.debug('summarizeContext',context)
            let didRun = false
            // Check to see if reduce phase ran. If it never ran, the custom record never updated.
            // If reduce phase didn't run, update custom record to be empty
            context.output.iterator().each(function(key, value) {
                didRun = true
                return true
            });
            log.debug('DID RUN',didRun)
            let recordHolderId;
            if (!didRun){
                log.debug('in here')
                search.create({
                    type: "customrecord_cat_lookup_field_script_hol",
                    filters: [],
                    columns: ["scriptid"]
                }).run().each(result => recordHolderId = result.id)
                if (recordHolderId) {
                    record.submitFields({
                        type: 'customrecord_cat_lookup_field_script_hol',
                        id: recordHolderId,
                        values: {
                            custrecord_script_fields: JSON.stringify([])
                        }
                    })
                }
                else {
                    const newHolder = record.create({
                        type: 'customrecord_cat_lookup_field_script_hol'
                    })
                    newHolder.setValue({fieldId: 'custrecord_script_fields',value: JSON.stringify([])})
                    newHolder.save()
                }

            }

        }



        return {getInputData, map,reduce,summarize}

    });
