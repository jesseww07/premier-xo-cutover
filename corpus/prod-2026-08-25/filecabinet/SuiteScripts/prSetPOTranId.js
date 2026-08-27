/**
 * API Version 2.1
 * Update Customer List on Online Form
 * Support Ticket: 2038
 *
 *          Created, Maintained, and Owned By Zastro
 *
 * Version    Date            Author           Remarks          Type
 * 1.00     12/14/22       Kingman Douglass                  User Event
 * 
 *          Script Functionality
 * This script sets dropship POs with a "DS" prefix and all other types of POs with a "REQ" prefix.
 */
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'], function (record, search) {
    var exports = {};
    function afterSubmit(context) {
        try {
            let curLoad = context.newRecord
            if (curLoad.id) {
                let thisRecord = record.load({
                    type: curLoad.type,
                    id: curLoad.id,
                    isDynamic: true
                })
                log.debug('current_record', curLoad.id);
                let tranNum = thisRecord.getValue({
                    fieldId: 'tranid'
                })
                let createdFrom = thisRecord.getValue({
                    fieldId: 'createdfrom'
                })
                if (createdFrom) {
                    let formChoice = thisRecord.getValue({
                        fieldId: 'customform'
                    });
                    log.debug('form_choice', formChoice);
                    if (formChoice == 168) {
                        //drop
                        var pref = 'DS'
                    }
                    else {
                        //special
                        var pref = 'REQ'
                        let newName = pref + tranNum
                        log.debug('new_name', newName);
                        thisRecord.setValue({
                            fieldId: 'tranid',
                            value: newName
                        })
                        thisRecord.save()
                    }
                    // let newName = pref + tranNum
                    // log.debug('new_name', newName);
                    // thisRecord.setValue({
                    // fieldId: 'tranid',
                    // value:newName
                    // })
                    // thisRecord.save()
                }
            }
        }
        catch (e) {
            log.debug('e', e)
        }
    }
    exports.afterSubmit = afterSubmit;
    return exports;
});