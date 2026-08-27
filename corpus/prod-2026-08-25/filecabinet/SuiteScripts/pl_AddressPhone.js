/**
 * @NApiVersion 2.1
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
 function (log, record, search, util) {

     /**
      * Definition of the Scheduled script trigger point.
      *
      * @param {Object} scriptContext
      * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
      * @Since 2015.2
      */
     function execute(context) {
         

        var customerSearchObj = search.create({
            type: "customer",
            filters:
            [
               ["phone","isnotempty",""], 
               "AND", 
               ["isinactive","is","F"], 
               "AND", 
               ["address.addressphone","isempty",""]
            ],
            columns:
            [
               search.createColumn({
                  name: "entityid",
                  sort: search.Sort.ASC
               }),
               "internalid",
               "phone",
               search.createColumn({
                  name: "formulatext",
                  formula: "{address.addressinternalid}"
               }),
               search.createColumn({
                  name: "addressinternalid",
                  join: "Address"
               }),
               search.createColumn({
                  name: "address1",
                  join: "Address"
               }),
               search.createColumn({
                  name: "city",
                  join: "Address"
               }),
               search.createColumn({
                  name: "addressphone",
                  join: "Address"
               })
             ]
          });
          var searchResultCount = customerSearchObj.runPaged().count;
          log.debug("customerSearchObj result count",searchResultCount);
          customerSearchObj.run().each(function(result){
             var customerId = result.getValue({
                 name:'internalid'
             })
             log.debug('customerId', customerId);
             var customerRecord = record.load({
                 type: record.Type.CUSTOMER,
                 id: customerId,
                 isDynamic: true,
             })
             log.debug('customerRecord', customerRecord);
             var phone = customerRecord.getValue({
                 fieldId: 'phone',
             })
             log.debug('phone', phone);
             var lineCount = customerRecord.getLineCount({
                 sublistId: 'addressbook'
             });
             log.debug('address_line_count', lineCount);
             for (var i = 0; i < lineCount; i++) {
                 customerRecord.selectLine({
                     sublistId: 'addressbook',
                     line: i
                 });
                log.debug('here?')
               
                var addressSubrecord = customerRecord.getCurrentSublistSubrecord({
                    sublistId: 'addressbook',
                    fieldId: 'addressbookaddress'
                  });
                 log.debug('addressSubrecord', addressSubrecord)

                 addressSubrecord.setValue({
                    fieldId: 'addrphone',
                    value: phone
                })
                   log.debug('set phone?')
                   customerRecord.commitLine({
                    sublistId: 'addressbook'
                 });
             }
             customerRecord.save()
             // .run().each has a limit of 4,000 results
             return true;
          });
          
          /*
          customerSearchObj.id="customsearch1655833205479";
          customerSearchObj.title="Script Feed - Customer Address Pop (copy)";
          var newSearchId = customerSearchObj.save();
          */
     }



     return {
         execute: execute
     };

 });