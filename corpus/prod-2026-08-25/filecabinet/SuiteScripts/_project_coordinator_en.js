define(['N/record'], function(record) {
    function beforeLoad(context) {
        if (context.type !== context.UserEventType.CREATE) {
            return;
        }

        var salesOrderRecord = context.newRecord;
        var customerId = salesOrderRecord.getValue('entity');

        if (customerId) {
            var customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: customerId
            });

            var projectCoordinator = customerRecord.getValue('custentity_project_coordinator'); // Replace with your custom field ID

            if (projectCoordinator) {
                salesOrderRecord.setValue({
                    fieldId: 'custbody_project_coordinator', // Replace with your custom body field ID on sales order
                    value: projectCoordinator
                });
            }
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
