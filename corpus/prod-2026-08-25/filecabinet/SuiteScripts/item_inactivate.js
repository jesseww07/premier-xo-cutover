/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * ============================================================================
 * PREMIER LIGHTING - LEGACY ITEM INACTIVATION
 * ============================================================================
 *
 * Purpose: Inactivate dead legacy inventory items, cohort by cohort, with a
 *          built-in dry-run gate. Replaces the retired family-analysis /
 *          matrix-candidate Map/Reduce (Unified_Catalog_Analysis_MapReduce_v*).
 *
 * INPUT: a SAVED SEARCH (CONFIG.SAVED_SEARCH_ID). The saved search IS the
 *        candidate definition and the safety boundary — this script inactivates
 *        EXACTLY what the search returns, nothing more, nothing less.
 *
 *        The search must encode the full guard set, not just "never transacted":
 *          - itemtype = Inventory Part
 *          - isinactive = false
 *          - Transaction : Date is empty   (never on any transaction)
 *          - on hand = 0                   (NVL(quantityonhand,0) = 0)
 *          - custitem_fa_shopify_handle is empty
 *          - isdropshipitem = false
 *          - created within the cohort window (e.g. 2022 only, then 2023)
 *
 *        Cohort batching lives in the search criteria (the created-date window),
 *        so there is a single, UI-reviewable source of truth. Run 2022 first,
 *        then repoint the date window to 2023. STOP after 2023 — beyond that,
 *        never-transacted is gateway catalog, not junk, and needs a different
 *        discriminator (discontinued / junk / true-duplicate signals).
 *
 * ---------------------------------------------------------------------------
 * THE GATE
 * ---------------------------------------------------------------------------
 *   1. CONFIG.MODE = 'REPORT' (default) touches nothing. It counts the search
 *      results and writes a sample CSV to the File Cabinet. Fast (minutes).
 *   2. Confirm the count and eyeball the sample.
 *   3. ONLY THEN set CONFIG.MODE = 'EXECUTE' and re-run to inactivate.
 *      Reversible (inactivated, not deleted) — but treat EXECUTE as one-way.
 * ============================================================================
 */

define(['N/search', 'N/record', 'N/file'],
    function (search, record, file) {

        const CONFIG = {
            MODE: 'EXECUTE',                 // 'REPORT' = dry run | 'EXECUTE' = inactivate
            SAVED_SEARCH_ID: 2191,          // internal id of the inactivation saved search
                                            // REQUIRED guard on the search before EXECUTE:
                                            //   custitem_fa_shopify_handle is empty
                                            // (without it the search returns 385,947 incl.
                                            //  1,047 live-on-Shopify items; with it, 384,900)
            OUTPUT_FOLDER_ID: -15,          // File Cabinet folder for the report CSV
            SAMPLE_SIZE: 500
        };

        function getInputData() {
            log.audit('INACTIVATION START', { mode: CONFIG.MODE, search: CONFIG.SAVED_SEARCH_ID });
            // The saved search is the candidate definition AND the safety boundary.
            return search.load({ id: CONFIG.SAVED_SEARCH_ID });
        }

        function map(context) {
            const result = JSON.parse(context.value);
            const itemId = result.id;

            if (CONFIG.MODE === 'EXECUTE') {
                try {
                    record.submitFields({
                        type: record.Type.INVENTORY_ITEM,
                        id: itemId,
                        values: { isinactive: true },
                        options: { enableSourcing: false, ignoreMandatoryFields: true }
                    });
                    context.write({ key: 'INACTIVATED', value: String(itemId) });
                } catch (e) {
                    context.write({ key: 'ERROR_WRITE', value: String(itemId) + '|' + e.message });
                }
            } else {
                context.write({ key: 'CANDIDATE', value: String(itemId) });
            }
        }

        function reduce(context) {
            context.write({
                key: context.key,
                value: String(context.values.length) + '||' + context.values.slice(0, CONFIG.SAMPLE_SIZE).join(',')
            });
        }

        function summarize(summary) {
            const tally = { CANDIDATE: 0, INACTIVATED: 0, ERROR_WRITE: 0 };
            const samples = {};
            summary.output.iterator().each(function (key, value) {
                const parts = String(value).split('||');
                tally[key] = Number(parts[0]);
                samples[key] = parts[1] || '';
                return true;
            });

            const isReport = CONFIG.MODE !== 'EXECUTE';
            const headline = isReport ? tally.CANDIDATE : tally.INACTIVATED;

            let csv = 'PREMIER LEGACY ITEM INACTIVATION REPORT\n';
            csv += 'Mode,' + CONFIG.MODE + '\n';
            csv += 'Saved search,' + CONFIG.SAVED_SEARCH_ID + '\n';
            csv += 'Run timestamp,' + new Date().toISOString() + '\n';
            csv += (isReport ? 'Candidates (would inactivate)' : 'Items inactivated') + ',' + headline + '\n';
            csv += 'Write errors,' + tally.ERROR_WRITE + '\n\n';
            csv += 'Sample internal IDs (first ' + CONFIG.SAMPLE_SIZE + '):\n';
            csv += (samples[isReport ? 'CANDIDATE' : 'INACTIVATED'] || '').split(',').join('\n');
            if (tally.ERROR_WRITE) { csv += '\n\nWrite errors:\n' + (samples.ERROR_WRITE || '').split(',').join('\n'); }

            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            try {
                file.create({
                    name: 'INACTIVATION_' + CONFIG.MODE + '_' + stamp + '.csv',
                    fileType: file.Type.CSV,
                    contents: csv,
                    folder: CONFIG.OUTPUT_FOLDER_ID
                }).save();
            } catch (e) {
                log.error('Report file save failed', e.message);
            }

            log.audit('INACTIVATION COMPLETE', {
                mode: CONFIG.MODE,
                headline: (isReport ? 'WOULD inactivate ' : 'inactivated ') + headline,
                writeErrors: tally.ERROR_WRITE
            });
        }

        return { getInputData: getInputData, map: map, reduce: reduce, summarize: summarize };
    });