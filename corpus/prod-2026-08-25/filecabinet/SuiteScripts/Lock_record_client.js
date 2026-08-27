/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord'], (currentRecord) => {
    
    function pageInit(scriptContext) {
        try {
            const rec = scriptContext.currentRecord;
            const mode = scriptContext.mode;
            
            if (mode !== 'edit') {
                return;
            }
            
            try {
                const refreshFlag = rec.getValue({ fieldId: 'custpage_needs_refresh' });
                
                if (refreshFlag === 'T') {
                    console.log('Lock acquired, reloading to sync values...');
                    
                    rec.setValue({ 
                        fieldId: 'custpage_needs_refresh', 
                        value: 'F',
                        ignoreFieldChange: true 
                    });
                    
                    window.location.reload();
                }
            } catch (e) {
                console.log('No refresh flag field found');
            }
            
        } catch (e) {
            console.error('Client Script Error', e);
        }
    }
    
    return {
        pageInit: pageInit
    };
});