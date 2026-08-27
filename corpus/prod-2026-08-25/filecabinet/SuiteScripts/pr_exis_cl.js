/**
* @NApiVersion 2.1
* @NScriptType ClientScript
* @NModuleScope SameAccount
*/
define(['N/record', 'N/ui/dialog', 'N/search', 'N/ui/message', 'N/url', 'N/log'],
  function (record, dialog, search, message, url, log) {
    function changeFilter(scriptContext) {
      var currentRecord = scriptContext.currentRecord;
      if (scriptContext.fieldId == 'custpage_selected_phx' || scriptContext.fieldId == 'custpage_selected_sdl' || scriptContext.fieldId == 'custpage_selected_tuc' || scriptContext.fieldId == 'custpage_selected_all') {
        log.debug('aaaaaaaa', 'aaaaaaaa');
        var params = {}
        var vendor = currentRecord.getValue({ //gets value from the Suitelet filter field
          fieldId: 'custpage_hidetwo'
        });
        log.debug('vendor', vendor);
        if (vendor) {
          params.custom_id = vendor
        }
        console.log('vendor', vendor);
        var location = currentRecord.getValue({ //gets value from the Suitelet filter field
          fieldId: 'custpage_hide'
        });
        console.log('location', location);
        if (location) {
          params.loc_id = location
        }
        var phxLocation = currentRecord.getValue({ //gets value from the Suitelet filter field
          fieldId: 'custpage_selected_phx'
        });
        console.log('phx_location', phxLocation);
        //log.debug('phx_location', phxLocation);
        if (phxLocation) {
          params.custpage_selected_phx = phxLocation;
        }
        var sdlLocation = currentRecord.getValue({ //gets value from the Suitelet filter field
          fieldId: 'custpage_selected_sdl'
        });
        if (sdlLocation) {
          params.custpage_selected_sdl = sdlLocation;
        }
        log.debug('sdl_location', sdlLocation);
        var tucLocation = currentRecord.getValue({ //gets value from the Suitelet filter field
          fieldId: 'custpage_selected_tuc'
        });
        if (tucLocation) {
          params.custpage_selected_tuc = tucLocation;
        }
        var allLocation = currentRecord.getValue({ //gets value from the Suitelet filter field
          fieldId: 'custpage_selected_all'
        });
        if (allLocation) {
          params.custpage_selected_phx = phxLocation;
          params.custpage_selected_sdl = sdlLocation;
          params.custpage_selected_tuc = tucLocation;
        }
        var suiteUrl = url.resolveScript({
          scriptId: 'customscript_pr_consol_sl',
          deploymentId: 'customdeploy1',
          // set the script Id and the deployment Id for the suitelet you want to pass the value to.           
          params: params
        });
        console.log(suiteUrl);
        window.location.href = suiteUrl;
      }
    }
    return {
      fieldChanged: changeFilter
    };
  });
