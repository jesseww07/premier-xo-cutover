define(['N/format', 'N/https', 'N/record', 'N/runtime', 'N/search', 'N/url', 'N/xml', 'N/currentRecord'],
/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
/**
 * @param {config} config
 * @param {format} format
 * @param {https} https
 * @param {record} record
 * @param {redirect} redirect
 * @param {render} render
 * @param {runtime} runtime
 * @param {search} search
 * @param {task} task
 * @param {url} url
 * @param {xml} xml
 */
function(format, https, record, runtime, search, url, xml, currentRecord) {
     
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(context) {
        console.log('fired!')

    }
 
    function openSuitelet(context){
        let thisRecord;

        try{
            thisRecord = currentRecord.get()
        }
        catch(e){
            thisRecord = context.currentRecord
        }
        let loc = thisRecord.getValue({
            fieldId:'location'
        });

        log.debug('location', location);

        let output = url.resolveScript({
            scriptId: 'customscript_pl_set_commit_so_item_sl',
            deploymentId: 'customdeploy_pl_set_commit_so_item_sl',
            returnExternalUrl: false
            });

        console.log('output', output);

        let userObj = runtime.getCurrentUser();

        console.log('userobj', userObj);

        let preference = userObj.getPreference('language');

        window.open(output + '&custom_id=' + thisRecord.id + '&loc=' + loc + '&type=' + thisRecord.type);
    }

    return {
        pageInit: pageInit,
        openSuitelet: openSuitelet

    };
    
});
 