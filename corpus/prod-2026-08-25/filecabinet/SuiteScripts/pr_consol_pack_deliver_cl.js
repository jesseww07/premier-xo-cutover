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
    		 scriptId: 'customscript693',
    		 deploymentId: 'customdeploy1',
    		 returnExternalUrl: false
    		});
    	console.log('output', output)
    	let userObj = runtime.getCurrentUser()
    	console.log('userobj', userObj)
        let preference = userObj.getPreference('language')
        let customer = thisRecord.getValue({fieldId: 'custrecord_sa_consolidated_customer'})
    	window.open(output + '&custom_id=' + thisRecord.id + '&lang=' + preference + '&type=' + thisRecord.type + '&customer=' + customer);
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
