/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/task'], function (record, search, task) {
    var exports = {};
    function afterSubmit(context) {
        try {
            // Ensure this runs only during 'create' or 'edit'
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
                return;
            }

            const inboundShipmentId = context.newRecord.id;

            // Load the record
            const inboundShipment = record.load({
                type: 'inboundShipment',
                id: inboundShipmentId,
                isDynamic: true, 
            });

var ven =  inboundShipment.getValue({
                    fieldId: 'custrecord_mli_inbound_vendor'
                });

          if(ven){
            return
          }

            // Get the item sublist line count
            const lineCount = inboundShipment.getLineCount({
                sublistId: 'items',
            });

            const vendorId = getId(inboundShipmentId)
            log.debug('vendorId',vendorId)
            var useId = vendorId[0]
            log.debug('useId',useId)
                // Set the 'custrecord_mli_inbound_vendor' field with the retrieved value
                inboundShipment.setValue({
                    fieldId: 'custrecord_mli_inbound_vendor',
                    value: useId,
                });
          try{
                //  inboundShipment.setValue({
                //     fieldId: 'shipmentbillingstatus',
                //     value: 'FB',
                // });
             inboundShipment.setValue({
                    fieldId: 'shipmentstatus',
                    value: 'inTransit',
                });
          }
          catch(e){
            log.error('e',e)
          }

        


                // Save the record
                inboundShipment.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                });

        
            
        } catch (error) {
            log.error({
                title: 'Error in afterSubmit',
                details: error.message,
            });
        }
    }
  
const getId = (id) => {
    let array = []
    var customrecord_consolidated_special_orderSearchObj = search.create({
        type: "customrecord_consolidated_special_order",
        filters:
        [
           ["custrecord_inbound_shipment.internalidnumber","equalto",id]
        ],
        columns:
        [
           "custrecord_special_consolidated_vendor"
        ]
     });
     var searchResultCount = customrecord_consolidated_special_orderSearchObj.runPaged().count;
     log.debug("customrecord_consolidated_special_orderSearchObj result count",searchResultCount);
     customrecord_consolidated_special_orderSearchObj.run().each(function(result){
       var vend = result.getValue('custrecord_special_consolidated_vendor')
       array.push(vend)
        return true;
     });
     return array
}

    exports.afterSubmit = afterSubmit;
    return exports;
});

