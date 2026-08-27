/**
* @NApiVersion 2.1
* @NScriptType ClientScript
* @NModuleScope SameAccount
*/
define(['N/record', 'N/ui/dialog', 'N/search', 'N/ui/message', 'N/url', 'N/log'],
    function (record, dialog, search, message, url, log) {
        function changeFilter(scriptContext) {
            var currentRecord = scriptContext.currentRecord;
            
            if (scriptContext.fieldId == 'custpage_filter_customer' || scriptContext.fieldId == 'custpage_filter_location') {
                var params = {}
                log.debug('stuff')
                
                var getCust = currentRecord.getValue({ //gets value from the Suitelet filter field
                    fieldId: 'custpage_filter_customer'
                });
                if (getCust) {
                    params.custpage_filter_customer = getCust;
                }
                var getLocation = currentRecord.getValue({ //gets value from the Suitelet filter field
                    fieldId: 'custpage_filter_location'
                });
                if (getLocation) {
                    params.custpage_filter_location = getLocation;
                }
                var suiteUrl = url.resolveScript({
                    scriptId: 'customscript1101',
                    deploymentId: 'customdeploy1',
                    // set the script Id and the deployment Id for the suitelet you want to pass the value to.           
                    params: params


                });
                window.location.href = suiteUrl;
            } 
        }
        return {
            fieldChanged: changeFilter
        };
    });