/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
 define(['N/ui/dialog', 'N/currentRecord', 'N/log', 'N/record', 'N/url'], function(dialog, currentRecord, log, record, url) {

    function pageInit(context) {
        // Required entry point function (even if not used)
    }

    function openVendorRefPopup() {
        var rec = currentRecord.get();
        var recId = rec.id
        log.debug('Function Triggered', 'openVendorRefPopup() called');

        // Fallback Prompt (Use this to confirm NetSuite’s dialog is the issue)
        let vendorRefNum = window.prompt('Enter Vendor Reference Number:');
        
        if (vendorRefNum) {
            log.debug('User Input', vendorRefNum);
            try{
                var inbounder = record.load({type:'inboundshipment',id:recId})
                inbounder.setValue({
                    fieldId: 'custrecord_mli_ack_date', // Replace with actual field ID
                    value: new Date()
                });
                inbounder.setValue({
                    fieldId: 'custrecord_ref_no', // Replace with actual field ID
                    value: vendorRefNum
                });
    
                var sav = inbounder.save()
              
                log.debug('REC SAVE',sav)

                // // Properly reload the record using NetSuite's URL module
                // var reloadUrl = url.resolveRecord({
                //     recordType: 'inboundshipment',
                //     recordId: recId,
                //     isEditMode: false
                // });

                // window.location.href = reloadUrl; // Redirect to refreshed page


              window.location.reload(true);
              
            }catch(e){
                log.error('e',e)
            }
      
            return
            var sav = rec.save().then(function() {
                log.debug('REC SAVE',sav)
                location.reload();
            }).catch(function(error) {
                log.error('Save Error', error);
                dialog.alert({ title: 'Error', message: error.message });
            });
        }
    }

    return {
        pageInit: pageInit,
        openVendorRefPopup: openVendorRefPopup
    };
});