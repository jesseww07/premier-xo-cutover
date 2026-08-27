/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/search', 'N/util'],
/**
 * @param {log} log
 * @param {record} record
 * @param {search} search
 * @param {util} util
 */
function(log, record, search, util) {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(context) {

    	search.load({
    		id: 'customsearch599'
    	}).run().each( function (result) {
    		log.debug(result)
    		var internalId = result.id
            log.debug('internalid', internalId)
            var customer;
    		var customrecord_stored_inventory_contentsSearchObj = search.create({
                type: "customrecord_stored_inventory_contents",
                filters:
                [
                   ["custrecord_pr_delivery_record","anyof",internalId]
                ],
                columns:
                [
                   search.createColumn({
                      name: "custrecord_contents_customer",
                      summary: "GROUP"
                   })
                ]
             });
             var searchResultCount = customrecord_stored_inventory_contentsSearchObj.runPaged().count;
             log.debug("customrecord_stored_inventory_contentsSearchObj result count",searchResultCount);
             customrecord_stored_inventory_contentsSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var cust = result.getValue({
                    name: 'custrecord_contents_customer',
                  	summary: search.Summary.GROUP
                })
                customer = cust
                return true;
             });
             var deliveryRec = record.load({
                 type:'customrecord_pr_delivery_record',
                 id:internalId
             })
             deliveryRec.setValue({
                 fieldId:'custrecord_si_cust_delivery',
                 value: customer
             })
             var save = deliveryRec.save()
             log.debug('save',save)
    		return true
    	})
    }

    return {
        execute: execute
    };
    
});
