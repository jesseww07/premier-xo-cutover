/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/search', 'N/record'],
function(serverWidget, search, record) {
    
    function onRequest(context) {
        if (context.request.method === 'GET') {
            
            var form = serverWidget.createForm({
                title: 'Emergency Lock Cleanup - Sales Orders'
            });
            
            form.addSubmitButton({
                label: 'Unlock All Locked Sales Orders'
            });
            
            try {
                var lockSearch = search.create({
                    type: 'salesorder',
                    filters: [
                        ['custbody_record_locked', 'is', 'T']
                    ],
                    columns: ['internalid', 'tranid']
                });
                
                var resultCount = lockSearch.runPaged().count;
                
                form.addField({
                    id: 'custpage_info',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Info'
                }).defaultValue = '<b>Found ' + resultCount + ' locked Sales Orders</b><br/><br/>Click Submit to unlock them all.';
                
            } catch (e) {
                form.addField({
                    id: 'custpage_error',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Error'
                }).defaultValue = '<b style="color:red;">ERROR: ' + e.message + '</b>';
            }
            
            context.response.writePage(form);
            
        } else {
            // POST - do the unlock
            try {
                var unlocked = 0;
                var failed = 0;
                var concurrency = 0;
                
                var lockSearch = search.create({
                    type: 'salesorder',
                    filters: [['custbody_record_locked', 'is', 'T']],
                    columns: ['internalid', 'tranid']
                });
                
                lockSearch.run().each(function(result) {
                    try {
                        var recId = result.getValue('internalid');
                        
                        record.submitFields({
                            type: 'salesorder',
                            id: recId,
                            values: {
                                custbody_record_locked: false,
                                custbody_locked_by: null,
                                custbody_locked_date: null
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });
                        unlocked++;
                    } catch (e) {
                        if (e.message && e.message.indexOf('has been changed') > -1) {
                            concurrency++;
                        } else {
                            log.error('Unlock failed for ' + result.getValue('internalid'), e.message);
                            failed++;
                        }
                    }
                    return true;
                });
                
                var form = serverWidget.createForm({
                    title: 'Cleanup Complete'
                });
                
                form.addField({
                    id: 'custpage_result',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Result'
                }).defaultValue = '<b style="color:green;">Successfully unlocked ' + unlocked + ' Sales Orders!</b><br/>' +
                                  (concurrency > 0 ? '<b style="color:orange;">Skipped ' + concurrency + ' (being edited)</b><br/>' : '') +
                                  (failed > 0 ? '<b style="color:red;">Failed: ' + failed + '</b>' : '');
                
                context.response.writePage(form);
                
            } catch (e) {
                var form = serverWidget.createForm({
                    title: 'Error'
                });
                
                form.addField({
                    id: 'custpage_error',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Error'
                }).defaultValue = '<b style="color:red;">ERROR: ' + e.message + '</b>';
                
                context.response.writePage(form);
            }
        }
    }
    
    return {
        onRequest: onRequest
    };
});