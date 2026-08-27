/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/email', 'N/runtime', 'N/log', 'N/url', 'N/search'], function(record, email, runtime, log, url, search) {

    // ─────────────────────────────────────────────────────────────────────────
    //  ROUTING CONFIG — this is the only block you need to edit to change
    //  who gets alerted. Add a person to PEOPLE, then reference them by class.
    // ─────────────────────────────────────────────────────────────────────────

    var PEOPLE = {
        delilah: 'delilah@shoppremier.com',
        kassie:  'kassie@northsidelighting.com',
        ted:     'Ted@shoppremier.com',
        azuri:   'AzuriR@shoppremier.com',
        jesse:   'jessew@shoppremier.com'
    };

    // Keyed by Class internal ID (Setup > Company > Classifications).
    // Any class NOT listed here falls through to FALLBACK_RECIPIENTS and is
    // logged as an AUDIT entry, so a flag is never silently dropped.
    //
    // Deliberately unrouted:
    //   3 = Employee         — shouldn't produce drop ship sales orders
    //   7 = Administrative   — shouldn't produce drop ship sales orders
    var CLASS_ROUTING = {
        1: { name: 'Retail',              to: [PEOPLE.kassie, PEOPLE.ted, PEOPLE.azuri] },
        2: { name: 'Commercial',          to: [PEOPLE.delilah, PEOPLE.kassie, PEOPLE.ted, PEOPLE.azuri] },
        4: { name: 'Property Management', to: [PEOPLE.kassie, PEOPLE.ted, PEOPLE.delilah, PEOPLE.azuri] },
        5: { name: 'Tier Premier',        to: [PEOPLE.kassie, PEOPLE.delilah, PEOPLE.ted, PEOPLE.azuri] },
        6: { name: 'Robson Communities',  to: [PEOPLE.kassie, PEOPLE.delilah, PEOPLE.ted, PEOPLE.azuri] },
        9: { name: 'E-Commerce',          to: [PEOPLE.delilah, PEOPLE.kassie, PEOPLE.ted, PEOPLE.azuri] }
    };

    var FALLBACK_RECIPIENTS = [PEOPLE.jesse]; // safety net for unrouted classes
    var CC_RECIPIENTS       = [PEOPLE.jesse];
    var EMAIL_AUTHOR        = 15383;          // purchasing@shoppremier.com

    // ─────────────────────────────────────────────────────────────────────────

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function toBool(v) {
        // Normalize checkbox values from various contexts: true/false, 'T'/'F', 'true'/'false'
        if (v === true || v === false) return v;
        if (v === 'T' || v === 'true' || v === 'TRUE' || v === '1') return true;
        return false;
    }

    function buildCheckedMap(rec) {
        var map = {};
        var lineCount = rec.getLineCount({ sublistId: 'item' }) || 0;

        for (var i = 0; i < lineCount; i++) {
            var isChecked = toBool(rec.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_dropship_needed',
                line: i
            }));
            if (isChecked) {
                var luk = rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'lineuniquekey',
                    line: i
                }) || ('idx_' + i); // fallback (shouldn't be needed, but safe)
                map[luk] = true;
            }
        }
        return map;
    }

    /**
     * Returns the real document number for a sales order.
     * On CREATE, afterSubmit's newRecord still carries the pre-save placeholder
     * ("To Be Generated"), because the number is assigned during the commit.
     * The record IS committed by the time afterSubmit runs, so a lookup on the
     * saved record returns the assigned number. Costs 1 governance unit, and
     * only on CREATE — EDIT sends short-circuit before the lookup.
     */
    function resolveDocumentNumber(rec, soId) {
        var tranid = rec.getValue({ fieldId: 'tranid' });

        if (tranid && tranid.toLowerCase().indexOf('to be generated') === -1) {
            return tranid;
        }

        try {
            var looked = search.lookupFields({
                type: search.Type.SALES_ORDER,
                id: soId,
                columns: ['tranid']
            });
            if (looked && looked.tranid) return looked.tranid;
        } catch (lookupErr) {
            log.error('Could not resolve tranid via lookup for SO ID ' + soId, lookupErr.toString());
        }

        return tranid || ('ID ' + soId);
    }

    function afterSubmit(context) {
        // Only run on create and edit
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) {
            return;
        }

        var newRecord = context.newRecord;
        var oldRecord = context.oldRecord || null;

        try {
            var soId = context.newRecord.id;
            var ueType = context.type;

            // Build maps of "checked lines" using lineuniquekey to avoid index issues
            var newCheckedMap = buildCheckedMap(newRecord);
            var shouldNotify = false;

            if (ueType === context.UserEventType.CREATE) {
                // On creation, notify if ANY line is checked
                shouldNotify = Object.keys(newCheckedMap).length > 0;
                log.debug('CREATE: checked line keys', Object.keys(newCheckedMap));
            } else {
                // EDIT: only notify if a line became newly checked
                var oldCheckedMap = oldRecord ? buildCheckedMap(oldRecord) : {};
                var newlyCheckedKeys = [];
                for (var key in newCheckedMap) {
                    if (!oldCheckedMap[key]) newlyCheckedKeys.push(key);
                }
                shouldNotify = newlyCheckedKeys.length > 0;
                log.debug('EDIT: newly-checked line keys', newlyCheckedKeys);
            }

            if (shouldNotify) {
                log.debug('Proceeding with email notification for SO ID', soId);

                var salesOrderClass = newRecord.getValue({ fieldId: 'class' });
                var classId = parseInt(salesOrderClass, 10);

                var route = CLASS_ROUTING[classId] || null;
                var recipientEmail;
                var className;

                if (route) {
                    recipientEmail = route.to;
                    className = route.name;
                } else {
                    log.audit('Drop Ship alert — class not in routing table', {
                        soId: soId,
                        classId: salesOrderClass
                    });
                    recipientEmail = FALLBACK_RECIPIENTS; // so a flag is never missed
                    // Unrouted class: fall back to whatever the record says it is
                    className = newRecord.getText({ fieldId: 'class' }) || '';
                }

                log.debug('Class routing', { classId: classId, className: className, recipients: recipientEmail });

                if (recipientEmail && recipientEmail.length) {
                    var documentNumber = resolveDocumentNumber(newRecord, soId);
                    var accountId = runtime.accountId;
                    var salesOrderURL = 'https://' + accountId + '.app.netsuite.com' +
                        url.resolveRecord({
                            recordType: record.Type.SALES_ORDER,
                            recordId: soId,
                            isEditMode: false
                        });

                    // "... flagged on Retail Sales Order 187307." — the space is part of the
                    // prefix so an unknown class degrades to "... on Sales Order 187307."
                    // Two prefixes: the subject is plain text, the body is HTML. Sharing one
                    // escaped string would put a literal "&amp;" in the subject line.
                    var classPrefixText = className ? className + ' ' : '';
                    var classPrefixHtml = className ? escapeHtml(className) + ' ' : '';

                    // Subject format changed 2026-08-20: class now leads the SO number so the
                    // Outlook list view is scannable. Old subjects (151 messages before this
                    // date) read 'Drop Ship Item Newly Flagged on SO: <num>' — to query both,
                    // search the message table for LIKE 'Drop Ship%Flagged%'.
                    var emailSubject = 'Drop Ship Flagged — ' + classPrefixText + 'SO ' + documentNumber;
                    var emailBody = 'A drop ship item has been newly flagged on ' + classPrefixHtml +
                        'Sales Order <a href="' + salesOrderURL + '">' + documentNumber + '</a>.' +
                        '<br><br>Please review the order for necessary actions.';

                    email.send({
                        author: EMAIL_AUTHOR,
                        recipients: recipientEmail,
                        cc: CC_RECIPIENTS,
                        subject: emailSubject,
                        body: emailBody,
                        relatedRecords: {
                            transactionId: soId // files the message on the SO's Communication tab
                        }
                    });

                    log.audit('Email Notification Sent',
                        'Drop Ship newly flagged alert for SO: ' + documentNumber +
                        ' sent to ' + recipientEmail + ' (CC: ' + CC_RECIPIENTS + ')'
                    );
                } else {
                    log.audit('Email Skipped (No Recipient)',
                        'No recipient matched class ID: ' + salesOrderClass +
                        ' for SO ID: ' + soId
                    );
                }
            } else {
                log.debug('Notification Not Required', 'No qualifying newly-checked lines for SO ID: ' + soId);
            }

        } catch (e) {
            log.error({
                title: 'Drop Ship Alert Failed for SO ID: ' + (context.newRecord ? context.newRecord.id : 'UNKNOWN'),
                details: e.toString() + (e.getStackTrace ? ('\nStack: ' + e.getStackTrace().join('\n')) : '')
            });
        }
    }

    return {
        afterSubmit: afterSubmit
    };
});