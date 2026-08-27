/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/runtime', 'N/ui/message', 'N/format', 'N/ui/serverWidget'], 
(record, runtime, message, format, serverWidget) => {
    
    function beforeLoad(context) {
        try {
            // CRITICAL: Only apply locking for actual user interface interactions
            const executionContext = runtime.executionContext;
            
            // Only apply locking in USER_INTERFACE context
            if (executionContext !== runtime.ContextType.USER_INTERFACE) {
                log.debug('Skipping Lock Logic', {
                    context: executionContext,
                    reason: 'Not a user interface interaction'
                });
                return;
            }
            
            const form = context.form;
            const newRecord = context.newRecord;
            const userId = runtime.getCurrentUser().id;
            const mode = context.type;
            
            if (mode !== context.UserEventType.VIEW && 
                mode !== context.UserEventType.EDIT) {
                return;
            }
            
            // Only run on Commercial Class (ID = 2)
            const recordClass = newRecord.getValue({ fieldId: 'class' });
            if (recordClass != '2') {
                log.debug('Skipping Lock Logic', {
                    recordId: newRecord.id,
                    recordClass: recordClass,
                    reason: 'Not Commercial class'
                });
                return;
            }
            
            const isLocked = newRecord.getValue({ fieldId: 'custbody_record_locked' });
            const lockedBy = newRecord.getValue({ fieldId: 'custbody_locked_by' });
            const lockedByText = newRecord.getText({ fieldId: 'custbody_locked_by' });
            const lockedDate = newRecord.getValue({ fieldId: 'custbody_locked_date' });
            
            log.debug('Before Load - Lock Status', {
                recordId: newRecord.id,
                recordType: newRecord.type,
                mode: mode,
                isLocked: isLocked,
                lockedBy: lockedBy,
                currentUser: userId,
                executionContext: executionContext
            });
            
            // EDIT MODE LOGIC
            if (mode === context.UserEventType.EDIT) {
                
                // SCENARIO 1: Record is NOT locked
                if (!isLocked) {
                    
                    // TIME-CHECK: Prevent re-locking after Save and Continue Editing
                    const lastModifiedBy = newRecord.getValue({ fieldId: 'lastmodifiedby' });
                    const lastModified = newRecord.getValue({ fieldId: 'lastmodifieddate' });
                    
                    if (lastModifiedBy == userId && lastModified) {
                        try {
                            const lastModifiedDate = new Date(lastModified);
                            const now = new Date();
                            const timeSinceModified = now - lastModifiedDate;
                            const thresholdMs = 15000;
                            
                            if (timeSinceModified < thresholdMs) {
                                log.debug('Skipping Re-Lock', {
                                    recordId: newRecord.id,
                                    userId: userId,
                                    timeSinceModified: timeSinceModified + 'ms'
                                });
                                
                                form.addPageInitMessage({
                                    type: message.Type.INFORMATION,
                                    title: 'Edit Session Continued',
                                    message: 'Continuing your edit session.',
                                    duration: 5000
                                });
                                
                                return;
                            }
                        } catch (dateError) {
                            log.debug('Date Parse Warning', dateError.message);
                        }
                    }
                    
                    // ACQUIRE LOCK
                    log.audit('Acquiring Lock', {
                        recordId: newRecord.id,
                        userId: userId
                    });
                    
                    try {
                        record.submitFields({
                            type: newRecord.type,
                            id: newRecord.id,
                            values: {
                                custbody_record_locked: true,
                                custbody_locked_by: userId,
                                custbody_locked_date: new Date()
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true,
                                disableTriggers: true
                            }
                        });
                        
                        log.debug('Lock Acquired - Setting Refresh Flag', newRecord.id);
                        
                        // Add hidden field to trigger client-side refresh
                        const refreshField = form.addField({
                            id: 'custpage_needs_refresh',
                            type: serverWidget.FieldType.TEXT,
                            label: 'Needs Refresh'
                        });
                        refreshField.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        });
                        refreshField.defaultValue = 'T';
                        
                        form.addPageInitMessage({
                            type: message.Type.CONFIRMATION,
                            title: 'Acquiring Lock',
                            message: 'Locking record, please wait...',
                            duration: 2000
                        });
                        
                    } catch (e) {
                        log.error('Lock Acquisition Failed', {
                            recordId: newRecord.id,
                            error: e.message,
                            stack: e.stack
                        });
                        throw new Error('Unable to acquire lock. Please try again. Error: ' + e.message);
                    }
                }
                
                // SCENARIO 2: Record IS locked by ANOTHER user
                else if (isLocked && lockedBy && lockedBy != userId) {
                    log.audit('Lock Conflict', {
                        recordId: newRecord.id,
                        attemptedBy: userId,
                        lockedBy: lockedBy,
                        lockedByName: lockedByText
                    });
                    
                    let formattedDate = 'unknown time';
                    if (lockedDate) {
                        try {
                            formattedDate = format.format({
                                value: new Date(lockedDate),
                                type: format.Type.DATETIMETZ
                            });
                        } catch (e) {
                            formattedDate = String(lockedDate);
                        }
                    }
                    
                    const errorMsg = 'This record is currently locked for editing by ' + 
                                   (lockedByText || 'another user') + 
                                   ' since ' + formattedDate + 
                                   '. Please try again later.';
                    
                    throw new Error(errorMsg);
                }
                
                // SCENARIO 3: Record IS locked by CURRENT user (after refresh)
                else if (isLocked && lockedBy == userId) {
                    log.debug('User Editing Own Locked Record', {
                        recordId: newRecord.id,
                        userId: userId
                    });
                    
                    form.addPageInitMessage({
                        type: message.Type.CONFIRMATION,
                        title: 'Record Locked',
                        message: 'This record is locked for your editing session. Other users cannot edit until you save.',
                        duration: 10000
                    });
                }
            }
            
            // VIEW MODE LOGIC
            if (mode === context.UserEventType.VIEW) {
                
                if (isLocked && lockedBy && lockedBy != userId) {
                    log.debug('View Mode - Record Locked by Another User', {
                        recordId: newRecord.id,
                        lockedBy: lockedBy,
                        viewingUser: userId
                    });
                    
                    try {
                        form.removeButton({ id: 'edit' });
                    } catch (e) {
                        log.debug('Edit Button Removal', e.message);
                    }
                    
                    let formattedDate = 'unknown time';
                    if (lockedDate) {
                        try {
                            formattedDate = format.format({
                                value: new Date(lockedDate),
                                type: format.Type.DATETIMETZ
                            });
                        } catch (e) {
                            formattedDate = String(lockedDate);
                        }
                    }
                    
                    form.addPageInitMessage({
                        type: message.Type.WARNING,
                        title: 'Record Locked',
                        message: 'This record is currently being edited by ' + 
                               (lockedByText || 'another user') + 
                               ' since ' + formattedDate + 
                               '. Editing is temporarily disabled.'
                    });
                }
                
                else if (isLocked && lockedBy == userId) {
                    log.debug('View Mode - Record Locked by Current User', {
                        recordId: newRecord.id,
                        userId: userId
                    });
                    
                    form.addPageInitMessage({
                        type: message.Type.INFORMATION,
                        title: 'Active Lock',
                        message: 'You have an active lock on this record. Click Edit to continue.',
                        duration: 8000
                    });
                }
            }
            
        } catch (e) {
            log.error('beforeLoad Error', {
                message: e.message,
                stack: e.stack,
                recordId: context.newRecord ? context.newRecord.id : 'unknown',
                recordType: context.newRecord ? context.newRecord.type : 'unknown',
                mode: context.type
            });
            throw e;
        }
    }
    
    function afterSubmit(context) {
        try {
            // Allow afterSubmit to run in all contexts (UI and Suitelet)
            // We want to unlock regardless of how the save happened
            
            if (context.type !== context.UserEventType.EDIT) {
                return;
            }
            
            const rec = context.newRecord;
            
            // Only run on Commercial Class (ID = 2)
            const recordClass = rec.getValue({ fieldId: 'class' });
            if (recordClass != '2') {
                log.debug('Skipping Unlock Logic', {
                    recordId: rec.id,
                    recordClass: recordClass,
                    reason: 'Not Commercial class'
                });
                return;
            }
            
            const currentUser = runtime.getCurrentUser().id;
            const isLocked = rec.getValue({ fieldId: 'custbody_record_locked' });
            const lockedBy = rec.getValue({ fieldId: 'custbody_locked_by' });
            
            log.debug('After Submit - Lock Check', {
                recordId: rec.id,
                recordType: rec.type,
                isLocked: isLocked,
                lockedBy: lockedBy,
                currentUser: currentUser,
                executionContext: runtime.executionContext
            });
            
            if (isLocked && lockedBy && lockedBy == currentUser) {
                log.audit('Unlocking Record After Save', {
                    recordId: rec.id,
                    recordType: rec.type,
                    userId: currentUser
                });
                
                record.submitFields({
                    type: rec.type,
                    id: rec.id,
                    values: {
                        custbody_record_locked: false,
                        custbody_locked_by: null,
                        custbody_locked_date: null
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true,
                        disableTriggers: true
                    }
                });
                
                log.debug('Record Unlocked Successfully', rec.id);
            }
            
        } catch (e) {
            log.error('Unlock Failed in afterSubmit', {
                recordId: context.newRecord ? context.newRecord.id : 'unknown',
                recordType: context.newRecord ? context.newRecord.type : 'unknown',
                error: e.message,
                stack: e.stack
            });
        }
    }
    
    return {
        beforeLoad: beforeLoad,
        afterSubmit: afterSubmit
    };
});