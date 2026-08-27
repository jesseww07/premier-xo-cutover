/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define([], function () {

    function onAction(context) {
        var rec = context.newRecord;
        var specSheetHyper = rec.getValue({ fieldId: 'custitem_spec_sheet_link' });
        var specSheet = rec.getValue({ fieldId: 'custitem_la_spec_sheet' });

        // Only run if Hyperlink is missing AND Text is present
        if (!specSheetHyper && specSheet) {
            try {
                // 1. Clean the input (trim whitespace)
                var rawUrl = specSheet.toString().trim();
                
                // 2. Fix the Protocol (The cause of your error)
                // If it doesn't start with http/https/ftp/file, force https://
                if (!/^(http|https|ftp|file):\/\//i.test(rawUrl)) {
                    rawUrl = 'https://' + rawUrl;
                }

                // 3. Encode (Handling spaces like in your screenshot)
                var formattedSpecUrl = encodeURI(rawUrl);

                log.debug('Fixed URL', formattedSpecUrl);

                rec.setValue({
                    fieldId: 'custitem_spec_sheet_link',
                    value: formattedSpecUrl
                });
            }
            catch (e) {
                // Log it, but DO NOT CRASH. This allows the M/R script to keep going.
                log.error('WFA Skipped Bad URL', 'Item: ' + rec.id + ' Error: ' + e.message);
            }
        }
    }

    return {
        onAction: onAction
    };
});