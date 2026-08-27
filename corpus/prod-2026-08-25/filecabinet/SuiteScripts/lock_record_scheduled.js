/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/format'], function(record, search, runtime, format) {
    
    function execute(context) {
        log.audit('Lock Cleanup Started', 'Commercial Sales Orders only - 60 minute timeout');
        
        try {
            var script = runtime.getCurrentScript();
            var lockTimeout = 60; // 60 minutes
            
            // Calculate cutoff datetime  
            var cutoff = new Date();
            cutoff.setMinutes(cutoff.getMinutes() - lockTimeout);
            
            log.debug('Cutoff DateTime', cutoff.toISOString());
            
            // Try DATE format (if custbody_locked_date is a DATE field, not DATETIME)
            var cutoffFormatted = format.format({
                value: cutoff,
                type: format.Type.DATE
            });
            
            log.debug('Formatted Cutoff (DATE)', cutoffFormatted);
            
            // Search for locked Commercial Sales Orders, filter by date in code
            var lockSearch = search.create({
                type: 'salesorder',
                filters: [
                    ['custbody_record_locked', 'is', 'T'],
                    'AND',
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['class', 'anyof', '2']  // Only Commercial class
                ],
                columns: ['internalid', 'tranid', 'custbody_locked_date', 'lastmodifieddate']
            });
            
            log.debug('Search created', 'About to run search for Commercial orders');
            
            var unlockedCount = 0;
            var errorCount = 0;
            var skippedCount = 0;
            var checkedCount = 0;
            
            lockSearch.run().each(function(result) {
                checkedCount++;
                
                var recId = result.getValue('internalid');
                var tranId = result.getValue('tranid');
                var lockedDate = result.getValue('custbody_locked_date');
                
                // Filter by date in code instead of in search
                if (lockedDate) {
                    try {
                        var lockDateTime = new Date(lockedDate);
                        var timeLocked = new Date() - lockDateTime;
                        var timeoutMs = lockTimeout * 60 * 1000;
                        
                        if (timeLocked < timeoutMs) {
                            // Not stale yet, skip
                            skippedCount++;
                            return true;
                        }
                    } catch (dateErr) {
                        log.debug('Date parse error', dateErr.message);
                    }
                }
                
                log.debug('Processing Stale Lock', {
                    id: recId,
                    tranId: tranId,
                    lockedDate: lockedDate
                });
                
                try {
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
                    
                    unlockedCount++;
                    log.audit('Unlocked Sales Order', recId);
                    
                } catch (e) {
                    if (e.message && e.message.indexOf('changed during save') > -1) {
                        log.debug('Concurrency Conflict', {
                            recordId: recId,
                            message: 'Will retry next cycle'
                        });
                        skippedCount++;
                    } else {
                        errorCount++;
                        log.error('Failed to Unlock', {
                            recordId: recId,
                            error: e.message
                        });
                    }
                }
                
                // Check governance
                if (script.getRemainingUsage() < 100) {
                    log.audit('Governance Threshold', 'Stopping to preserve governance');
                    return false;
                }
                
                return true;
            });
            
            log.audit('Lock Cleanup Completed', {
                recordsChecked: checkedCount,
                recordsUnlocked: unlockedCount,
                recordsSkipped: skippedCount,
                errors: errorCount
            });
            
        } catch (err) {
            log.error('Scheduled Script Error', {
                message: err.message,
                stack: err.stack
            });
        }
    }
    
    return { 
        execute: execute 
    };
});