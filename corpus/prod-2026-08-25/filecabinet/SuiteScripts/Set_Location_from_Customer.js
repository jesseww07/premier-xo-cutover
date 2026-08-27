/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/search'], function(search) {
    
    function fieldChanged(context) {
        var currentRecord = context.currentRecord;
        var fieldId = context.fieldId;
        
        // When customer field changes
        if (fieldId === 'entity') {
            var customerId = currentRecord.getValue({ fieldId: 'entity' });
            
            if (customerId) {
                // Look up customer's location
                var customerData = search.lookupFields({
                    type: search.Type.CUSTOMER,
                    id: customerId,
                    columns: ['custentity_pr_location']
                });
                
                var location = customerData.custentity_pr_location;
                
                if (location && location[0]) {
                    // Set the location field
                    currentRecord.setValue({
                        fieldId: 'location',
                        value: location[0].value
                    });
                }
            }
        }
    }
    
    return {
        fieldChanged: fieldChanged
    };
});