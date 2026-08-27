/**
 * API Version 2.1
 * Partial Estimate to SO (Premier) 
 * Support Ticket: 2462
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00     12/13/22       Alex Gjorvad                        Client
 * 
 *          Script Functionality
 * -This script is called when the "Create Sales Order" button (customscript_pr_create_so_ue) is clicked on an 
 * Estimate record.  This script in turn calls a suitelet script and passes the suitelet the internal id of the 
 * Estimate record.
 */
/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
  * @NModuleScope Public
 */
define(['N/format', 'N/https', 'N/record', 'N/runtime', 'N/search', 'N/url', 'N/xml', 'N/currentRecord'],
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
    	var output = url.resolveScript({
    		 scriptId: 'customscript_pr_create_so_sl',
    		 deploymentId: 'customdeploy1',
    		 returnExternalUrl: false
    		});
    	console.log('output', output);
    	let userObj = runtime.getCurrentUser()
    	console.log('userobj', userObj)
        let preference = userObj.getPreference('language')
        //thisRecord.id = internal id of Estimate record.
    	window.open(output + '&custom_id=' + thisRecord.id + '&lang=' + preference + '&type=' + thisRecord.type);
    }

    return {
        pageInit: pageInit,
        openSuitelet: openSuitelet
//        fieldChanged: fieldChanged,
//        postSourcing: postSourcing,
//        sublistChanged: sublistChanged,
//        lineInit: lineInit,
//        validateField: validateField,
//        validateLine: validateLine,
//        validateInsert: validateInsert,
//        validateDelete: validateDelete,
//        saveRecord: saveRecord
    };
    
});