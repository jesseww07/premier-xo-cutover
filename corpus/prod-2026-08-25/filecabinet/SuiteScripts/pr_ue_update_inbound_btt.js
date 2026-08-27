/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([], function () {
    function beforeLoad(context) {
        // Only add the button in VIEW mode to avoid cluttering EDIT mode
        if (context.type !== context.UserEventType.VIEW) return;
        
        let thisRecord = context.newRecord;
        if (!thisRecord.id) return;

        // No need to load the record. context.form is natively available.
        context.form.addButton({
            id: "custpage_pricing",
            label: "Adjustment",
            functionName: "openSuitelet"
        });

        context.form.clientScriptModulePath = "SuiteScripts/updateInbound_cl.js";
    }

    return {
        beforeLoad: beforeLoad
    };
});