/**
 * pl_ue_last_customer_note.js
 *
 * Mirrors a customer User Note onto stored entity fields the moment it is
 * saved, so the AR aging saved searches can reach the latest collections
 * note with a single Customer Fields join.
 *
 * Notes logged on INVOICES count too (workflow decision 07/31/2026): AR
 * tracks collections communication on the invoice as well as the customer.
 * A transaction note still carries the customer in 'entity', so both entry
 * points land here; the fields always show the latest note from anywhere.
 *
 * Replaces the scheduled map/reduce (customscript_pl_mr_last_note, now
 * inactive). An event-driven update is both simpler and faster than a sweep.
 *
 * Known trade-off: deleting a note leaves the customer fields showing the
 * deleted note until the next one is saved. Accepted for this use case.
 *
 * Backfill: re-saving an existing note (Edit > Save) runs this script, so
 * historical notes can be surfaced one-off without any batch tooling.
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/format', 'N/log'], (record, search, format, log) => {

    const CFG = {
        FLD_DATE:      'custentity_pl_last_note_date',
        FLD_AUTHOR:    'custentity_pl_last_note_author',
        FLD_TEXT:      'custentity_pl_last_note_text',
        FLD_DIRECTION: 'custentity_pl_last_note_direction',
        TEXT_MAX: 300,             // must match the field's Max Length
        AUTHOR_MAX: 100
    };

    /** Collapse all whitespace/newlines so the preview stays on one line. */
    const flatten = (s) => String(s || '').replace(/\s+/g, ' ').trim();

    /**
     * Truncate at a word boundary. Falls back to a hard cut if the last space
     * is too far left (e.g. one very long token like a URL or PO number).
     */
    const truncateAtWord = (s, max) => {
        if (s.length <= max) return s;
        const cut = s.substr(0, max - 3);
        const lastSpace = cut.lastIndexOf(' ');
        const base = (lastSpace > max * 0.6) ? cut.substr(0, lastSpace) : cut;
        return base + '...';
    };

    const afterSubmit = (ctx) => {
        if (ctx.type === ctx.UserEventType.DELETE) return;

        // Always reload rather than using ctx.newRecord: getText() throws
        // SSS_INVALID_API_USAGE on the in-flight record (texts aren't
        // hydrated in afterSubmit), and inline edit (XEDIT) delivers only
        // the changed fields anyway. A loaded record has values AND texts.
        const note = record.load({ type: record.Type.NOTE, id: ctx.newRecord.id });

        const entityId = note.getValue({ fieldId: 'entity' });
        if (!entityId) return;

        const noteDate = note.getValue({ fieldId: 'notedate' });

        // Don't let an edit to an OLDER note clobber a newer one already on
        // the customer (e.g. fixing a typo in last week's invoice note).
        // Fails open: if the comparison misbehaves, the note being saved wins.
        try {
            const stored = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: entityId,
                columns: [CFG.FLD_DATE]
            })[CFG.FLD_DATE];
            if (stored && noteDate) {
                const storedTime = format.parse({ value: stored, type: format.Type.DATETIMETZ }).getTime();
                if (storedTime > new Date(noteDate).getTime()) return;
            }
        } catch (e) {
            log.debug({ title: 'Stale-guard skipped', details: e.message });
        }

        const body = flatten(note.getValue({ fieldId: 'note' })) ||
                     flatten(note.getValue({ fieldId: 'title' }));

        try {
            record.submitFields({
                type: record.Type.CUSTOMER,
                id: entityId,
                values: {
                    [CFG.FLD_DATE]:      noteDate || null,
                    [CFG.FLD_AUTHOR]:    truncateAtWord(flatten(note.getText({ fieldId: 'author' })), CFG.AUTHOR_MAX),
                    [CFG.FLD_DIRECTION]: note.getText({ fieldId: 'direction' }) || '',
                    [CFG.FLD_TEXT]:      truncateAtWord(body, CFG.TEXT_MAX)
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });
        } catch (e) {
            // Notes can attach to vendors/employees/contacts too; those fail
            // the CUSTOMER submit and that is fine - just not our audience.
            log.debug({
                title: 'Skipped entity ' + entityId,
                details: e.name + ': ' + e.message
            });
        }
    };

    return { afterSubmit };
});
