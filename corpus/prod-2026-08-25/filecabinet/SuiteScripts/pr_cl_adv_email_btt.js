/**
 * @NApiVersion 2.1
  *@NModuleScope Public
 * @NScriptType ClientScript
 */
  define(['N/url', 'N/currentRecord'], function(url, currentRecord) {
    function pageInit(context) {
    }

      function redirectToEmailPOSuitelet() {
          const recordId = currentRecord.get().id; // Get the current record ID
          const recordType = currentRecord.get().type;

          let suiteletUrl = url.resolveScript({
              scriptId: 'customscript_pr_sl_adv_email',
              deploymentId: 'customdeploy_pr_sl_adv_email'
          });

          // Append the record ID as a parameter
          window.open(suiteletUrl + '&inboundShipmentId=' + recordId + '&recordType=' + recordType, '_blank');
      }

    return {
        pageInit: pageInit,
        redirectToEmailPOSuitelet: redirectToEmailPOSuitelet,
    };
});
