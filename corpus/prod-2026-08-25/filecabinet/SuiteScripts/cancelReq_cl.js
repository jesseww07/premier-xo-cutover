/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/log'], function(log) {

    function pageInit(context) {
        console.log('Client script initialized.');
    }
    /**
     * Opens the Suitelet in a popup window.
     * @param {string} paramString - A query parameter string (e.g. "item=123&quantity=2&soid=456").
     */
    function openSuiteletPopup(paramString) {
      // Define the base URL for the Suitelet
      var baseUrl = 'https://7513000-sb1.app.netsuite.com/app/site/hosting/scriptlet.nl?script=2895&deploy=1';
      // Construct the full URL with parameters
      var suiteletUrl = baseUrl + '&' + paramString;
      log.debug('Opening Suitelet URL', suiteletUrl);
  
      // Open the Suitelet as a popup window.
      window.open(suiteletUrl, 'popupWindow', 'width=600,height=400,resizable=yes,scrollbars=yes');
    }
  
    return {
        pageInit:pageInit,
      openSuiteletPopup: openSuiteletPopup
    };
  
  });
  