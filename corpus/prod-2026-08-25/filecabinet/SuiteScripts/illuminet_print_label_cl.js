/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
  * @NModuleScope Public
 */
 define(['N/format', 'N/https', 'N/record', 'N/runtime', 'N/search', 'N/url', 'N/xml', 'N/currentRecord'],
 function(format, https, record, runtime, search, url, xml, currentRecord) {
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
         var loc = thisRecord.getValue({
             fieldId:'location'
         })
         log.debug('loc',loc)
         var output = url.resolveScript({
              scriptId: 'customscript_mag_sl_print_label_form',
              deploymentId: 'customdeploy_mag_sl_print_label_form',
              returnExternalUrl: false
             });
         console.log('output', output)
         let userObj = runtime.getCurrentUser()
         console.log('userobj', userObj)
         let preference = userObj.getPreference('language')
         window.open(output + '&custom_id=' + thisRecord.id + '&loc=' + loc + '&type=' + thisRecord.type);
     }
 
     return {
         pageInit: pageInit,
         openSuitelet: openSuitelet
     };
     
 });
 