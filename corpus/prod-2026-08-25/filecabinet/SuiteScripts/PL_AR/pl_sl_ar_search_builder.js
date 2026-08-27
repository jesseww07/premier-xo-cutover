/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * PL AR Search Builder
 * --------------------
 * Creates (or rebuilds) the AR collections saved searches that sit on top of the
 * BEI delivery layer. Run once after the SDF deploy; safe to re-run — each search
 * is deleted and recreated so this file stays the single source of truth.
 *
 * Deliberate design notes:
 *  - No summary columns anywhere. Adding a summary to one column converts the whole
 *    search to a summary search and throws INVALID_SUMMARY_SRCH when other columns
 *    lack one. Grouping is done in the dashboard portlet, not the search.
 *  - No formula-based CRITERIA. Formulas in criteria prevent index use and scan the
 *    transaction table. Formulas appear only in RESULTS columns.
 *  - Aging uses the native daysoverdue field rather than a custom date-diff formula.
 *
 * Author: Systems & Operations
 */

define(['N/search', 'N/log'], (search, log) => {

    const SEARCHES = [
        buildBilledNotDelivered,
        buildDaysToDeliver,
        buildBrokenPromises,
        buildPastDueActionRequired,
        buildDunningEligible
    ];

    // ---------------------------------------------------------------- helpers

    /**
     * Delete a saved search if it exists. search.delete throws when the id is
     * unknown, which is the only reliable existence check available here.
     */
    function dropIfExists(scriptId) {
        try {
            search.delete({ id: scriptId });
            return true;
        } catch (e) {
            return false;
        }
    }

    function persist(srch, scriptId, title) {
        dropIfExists(scriptId);
        srch.title = title;
        srch.id = scriptId;
        srch.isPublic = true;
        const internalId = srch.save();
        log.audit({ title: 'Saved search created', details: `${title} (${scriptId}) internal id ${internalId}` });
        return { scriptId, title, internalId };
    }

    // Shared criteria: the main line of an open invoice with money still on it.
    function openInvoiceBase() {
        return [
            search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: true }),
            search.createFilter({ name: 'type', operator: search.Operator.ANYOF, values: ['CustInvc'] }),
            search.createFilter({ name: 'status', operator: search.Operator.ANYOF, values: ['CustInvc:A'] }),
            search.createFilter({ name: 'amountremaining', operator: search.Operator.GREATERTHAN, values: 0 })
        ];
    }

    function col(name, opts) {
        return search.createColumn(Object.assign({ name: name }, opts || {}));
    }

    // ------------------------------------------------- 1. Billed Not Delivered

    /**
     * Invoices that exist in NetSuite but that we cannot prove were ever sent.
     * This is the exception report that has no equivalent anywhere else — it
     * catches revenue sitting still because nobody transmitted the invoice.
     */
    function buildBilledNotDelivered() {
        const filters = openInvoiceBase().concat([
            search.createFilter({ name: 'custbody_pl_delivered_date', operator: search.Operator.ISEMPTY }),
            search.createFilter({ name: 'trandate', operator: search.Operator.ONORBEFORE, values: 'today' })
        ]);

        const columns = [
            col('trandate', { label: 'Invoice Date', sort: search.Sort.ASC }),
            col('tranid', { label: 'Invoice #' }),
            col('entity', { label: 'Customer' }),
            col('duedate', { label: 'Due Date' }),
            col('amount', { label: 'Invoice Amount' }),
            col('amountremaining', { label: 'Balance' }),
            col('custbody_pl_delivery_channel', { label: 'Channel' }),
            col('custentity_pl_collection_owner', { join: 'customer', label: 'Collection Owner' }),
            col('formulanumeric', {
                formula: 'TRUNC({today}) - TRUNC({trandate})',
                label: 'Days Since Billed'
            }),
            col('email', { join: 'customer', label: 'Customer Email' })
        ];

        return persist(
            search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns }),
            'customsearch_jww_ar_billed_not_deliv',
            'JWW_AR Billed Not Delivered'
        );
    }

    // ----------------------------------------------------- 2. Days to Deliver

    /**
     * Delivery lag on invoices we did send. Separates an internal billing
     * problem from a customer payment problem. Feeds the management KPI.
     */
    function buildDaysToDeliver() {
        const filters = [
            search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: true }),
            search.createFilter({ name: 'type', operator: search.Operator.ANYOF, values: ['CustInvc'] }),
            search.createFilter({ name: 'custbody_pl_delivered_date', operator: search.Operator.ISNOTEMPTY }),
            search.createFilter({ name: 'trandate', operator: search.Operator.WITHIN, values: 'lastFiscalQuarterToDate' })
        ];

        const columns = [
            col('trandate', { label: 'Invoice Date', sort: search.Sort.DESC }),
            col('tranid', { label: 'Invoice #' }),
            col('entity', { label: 'Customer' }),
            col('custbody_pl_delivery_channel', { label: 'Channel' }),
            col('custbody_pl_delivered_date', { label: 'Delivered' }),
            col('amount', { label: 'Invoice Amount' }),
            col('formulanumeric', {
                formula: 'TRUNC({custbody_pl_delivered_date}) - TRUNC({trandate})',
                label: 'Days to Deliver'
            })
        ];

        return persist(
            search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns }),
            'customsearch_jww_ar_days_to_deliver',
            'JWW_AR Days to Deliver'
        );
    }

    // ------------------------------------------------------ 3. Broken Promises

    /**
     * Customer said they would pay by a date, the date passed, money is still owed.
     * Standard criteria only — the equivalent formula filter would scan the table.
     */
    function buildBrokenPromises() {
        const filters = openInvoiceBase().concat([
            search.createFilter({
                name: 'custbody_pl_promise_date',
                operator: search.Operator.ONORBEFORE,
                values: 'yesterday'
            })
        ]);

        const columns = [
            col('custbody_pl_promise_date', { label: 'Promised', sort: search.Sort.ASC }),
            col('tranid', { label: 'Invoice #' }),
            col('entity', { label: 'Customer' }),
            col('custentity_pl_collection_owner', { join: 'customer', label: 'Collection Owner' }),
            col('custbody_pl_promise_amount', { label: 'Promised Amount' }),
            col('amountremaining', { label: 'Balance' }),
            col('daysoverdue', { label: 'Days Overdue' }),
            col('custbody_pl_dispute_status', { label: 'Dispute Reason' })
        ];

        return persist(
            search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns }),
            'customsearch_jww_ar_broken_promises',
            'JWW_AR Broken Promises'
        );
    }

    // -------------------------------------------- 4. Past Due, Action Required

    /**
     * The collector work queue. Excludes anything deliberately suppressed so the
     * list reflects work that is actually actionable today.
     */
    function buildPastDueActionRequired() {
        const filters = openInvoiceBase().concat([
            search.createFilter({ name: 'daysoverdue', operator: search.Operator.GREATERTHAN, values: 0 }),
            search.createFilter({ name: 'custbody_pl_exclude_dunning', operator: search.Operator.IS, values: false }),
            search.createFilter({
                name: 'custentity_pl_dunning_pause',
                join: 'customer',
                operator: search.Operator.IS,
                values: false
            })
        ]);

        const columns = [
            col('amountremaining', { label: 'Balance', sort: search.Sort.DESC }),
            col('daysoverdue', { label: 'Days Overdue' }),
            col('tranid', { label: 'Invoice #' }),
            col('entity', { label: 'Customer' }),
            col('custentity_pl_collection_owner', { join: 'customer', label: 'Collection Owner' }),
            col('duedate', { label: 'Due Date' }),
            col('custbody_pl_delivered_date', { label: 'Delivered' }),
            col('custbody_pl_bei_last_sent', { label: 'Last Dunned' }),
            col('custbody_pl_promise_date', { label: 'Promised' }),
            col('custbody_pl_dispute_status', { label: 'Dispute Reason' }),
            col('formulatext', {
                formula: "CASE" +
                    " WHEN {custbody_pl_dispute_status} IS NOT NULL THEN 'Disputed'" +
                    " WHEN {custbody_pl_promise_date} IS NOT NULL AND {custbody_pl_promise_date} >= TRUNC({today}) THEN 'Promise Pending'" +
                    " WHEN {custbody_pl_delivered_date} IS NULL THEN 'Never Delivered'" +
                    " WHEN {daysoverdue} > 90 THEN '1 - Escalate'" +
                    " WHEN {daysoverdue} > 60 THEN '2 - Call'" +
                    " WHEN {daysoverdue} > 30 THEN '3 - Follow Up'" +
                    " ELSE '4 - Monitor' END",
                label: 'Action'
            })
        ];

        return persist(
            search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns }),
            'customsearch_jww_ar_past_due_action',
            'JWW_AR Past Due - Action Required'
        );
    }

    // ------------------------------------------------------ 5. Dunning Eligible

    /**
     * The reconciliation list for BEI. An invoice is eligible for a dunning email
     * only if it is past due, undisputed, not suppressed, the customer is not
     * paused — and we can prove we delivered it in the first place.
     *
     * Compare this count against what BEI's own filters select. If the two do not
     * agree, BEI's filter configuration is wrong.
     */
    function buildDunningEligible() {
        const filters = openInvoiceBase().concat([
            search.createFilter({ name: 'daysoverdue', operator: search.Operator.GREATERTHAN, values: 0 }),
            search.createFilter({ name: 'custbody_pl_exclude_dunning', operator: search.Operator.IS, values: false }),
            search.createFilter({ name: 'custbody_pl_dispute_status', operator: search.Operator.ANYOF, values: ['@NONE@'] }),
            search.createFilter({ name: 'custbody_pl_delivered_date', operator: search.Operator.ISNOTEMPTY }),
            search.createFilter({
                name: 'custentity_pl_dunning_pause',
                join: 'customer',
                operator: search.Operator.IS,
                values: false
            })
        ]);

        const columns = [
            col('entity', { label: 'Customer', sort: search.Sort.ASC }),
            col('tranid', { label: 'Invoice #' }),
            col('duedate', { label: 'Due Date' }),
            col('daysoverdue', { label: 'Days Overdue' }),
            col('amountremaining', { label: 'Balance' }),
            col('custbody_pl_bei_last_sent', { label: 'Last Dunned' }),
            col('email', { join: 'customer', label: 'Customer Email' })
        ];

        return persist(
            search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns }),
            'customsearch_jww_ar_dunning_eligible',
            'JWW_AR Dunning Eligible'
        );
    }

    // ------------------------------------------------------------------ entry

    function onRequest(context) {
        const results = [];
        const failures = [];

        SEARCHES.forEach((fn) => {
            try {
                results.push(fn());
            } catch (e) {
                log.error({ title: `Failed: ${fn.name}`, details: e });
                failures.push({ fn: fn.name, message: e.message || String(e) });
            }
        });

        const rows = results.map(r =>
            `<tr><td style="padding:6px 14px;border-bottom:1px solid #dadada">${r.title}</td>` +
            `<td style="padding:6px 14px;border-bottom:1px solid #dadada"><code>${r.scriptId}</code></td>` +
            `<td style="padding:6px 14px;border-bottom:1px solid #dadada">${r.internalId}</td></tr>`
        ).join('');

        const failRows = failures.map(f =>
            `<tr><td colspan="3" style="padding:6px 14px;color:#CA4141">${f.fn}: ${f.message}</td></tr>`
        ).join('');

        context.response.write(
            `<div style="font-family:Inter,'Segoe UI',Arial,sans-serif;color:#3d3d3d;padding:24px">` +
            `<h2 style="color:#385887;margin:0 0 4px">PL AR Search Builder</h2>` +
            `<p style="color:#676767;margin:0 0 18px">${results.length} created, ${failures.length} failed.</p>` +
            `<table style="border-collapse:collapse;font-size:13px">` +
            `<tr style="background:#385887;color:#fff"><th style="padding:8px 14px;text-align:left">Search</th>` +
            `<th style="padding:8px 14px;text-align:left">Script ID</th>` +
            `<th style="padding:8px 14px;text-align:left">Internal ID</th></tr>` +
            rows + failRows + `</table></div>`
        );
    }

    return { onRequest };
});
