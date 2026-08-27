/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @NModuleScope SameAccount
 *
 * pl_ap_grab_dashboard_pl.js
 * -----------------------------------------------------------------------------
 * Embeds the AP Genius Pre-Check Suitelet inside a dashboard portlet
 * via an iframe. The Suitelet renders live data on every load.
 *
 * SETUP:
 *   1. Deploy the Suitelet (pl_ap_grab_dashboard_sl.js).
 *   2. Put its Script ID + Deployment ID in SL_SCRIPT_ID / SL_DEPLOY_ID below.
 *      ** These MUST match the deployed Suitelet exactly, or resolveScript throws. **
 *   3. Deploy this Portlet, then add it via Personalize Dashboard > Custom Portlet.
 *
 * If anything goes wrong, render() now logs the real error (Execution Log) and
 * prints it in the portlet body instead of NetSuite's generic error page.
 * -----------------------------------------------------------------------------
 */
define(['N/url', 'N/log'], function (url, log) {

  // --- Must match the deployed Suitelet -----------------------------------
  var SL_SCRIPT_ID = 'customscript_ap_genius_precheck_sl';
  var SL_DEPLOY_ID = 'customdeploy_ap_genius_precheck_sl';
  // ------------------------------------------------------------------------

  var IFRAME_HEIGHT = 820; // px

  function render(params) {
    var portlet = params.portlet;
     portlet.title = ' '
            
    try {
      var src = url.resolveScript({
        scriptId: SL_SCRIPT_ID,
        deploymentId: SL_DEPLOY_ID,
        returnExternalUrl: false
      });

      portlet.html =
        '<div style="margin:0 0 8px 2px;font:12px/1 sans-serif">' +
          '<a href="' + src + '" target="_blank" rel="noopener" ' +
          'style="color:#36677D;text-decoration:none">Open full dashboard &#8599;</a>' +
        '</div>' +
        '<iframe src="' + src + '" ' +
        'style="width:100%;height:' + IFRAME_HEIGHT + 'px;border:0;display:block;" ' +
        'title="AP Genius Invoices to Grab"></iframe>';

    } catch (e) {
      log.error({ title: 'AP grab portlet render failed', details: e });
      portlet.html =
        '<div style="font-family:sans-serif;padding:16px;color:#9a2a00;font-size:13px;line-height:1.5">' +
          '<b>Portlet could not build the dashboard URL.</b><br>' +
          String((e && e.name) || 'Error') + ': ' +
          String((e && e.message) || e).replace(/</g, '&lt;') +
          '<br><br><span style="color:#5d7383">' +
          'Confirm SL_SCRIPT_ID (<b>' + SL_SCRIPT_ID + '</b>) and SL_DEPLOY_ID (<b>' + SL_DEPLOY_ID + '</b>) ' +
          'exactly match the deployed Suitelet, and that your role is in the Suitelet deployment\u2019s audience.' +
          '</span></div>';
    }
  }

  return { render: render };
});