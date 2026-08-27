/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/currentRecord', 'N/https', 'N/url', 'N/log'], function (currentRecord, https, url, log) {
    function fieldChanged(context) {
        if (context.fieldId === 'custpage_promo') {
            try {
                var rec = currentRecord.get();
                console.log(rec);
                var promoPercentage = rec.getValue('custpage_promo');
                console.log('promoPercentage', promoPercentage)
                var inboundId = rec.getValue('custpage_inbound');
                console.log('inboundId', inboundId)
                if (!promoPercentage) {
                    return;
                }

                //entere script details for suitelet that this is linked to
                var suiteletUrl = url.resolveScript({
                    scriptId: 'customscript_pr_sl_update_inbound',
                    deploymentId: 'customdeploy_pr_sl_update_inbound'
                });

                https.post.promise({
                    url: suiteletUrl,
                    body: {
                        is_onchange: true,
                        custpage_promopercent: promoPercentage,
                        custpage_inboundid: inboundId
                    }
                }).then(function (response) {
                    if (response.code === 200) {



                        var results = JSON.parse(response.body);
                        console.log('results', results)

                        var slRecord = currentRecord.get();
                        let existingLineCount = slRecord.getLineCount({ sublistId: 'custpage_search_items' });
                        console.log('Line Count: ' + existingLineCount);
                        let resultLines = results['results'];
                        console.log('resultLines',resultLines)


                        for (let i = existingLineCount; i >= 1; i--) {
                            console.log('Removing Line: ' + i);
                            slRecord.removeLine({
                                sublistId: 'custpage_search_items',
                                line: i - 1,
                                ignoreRecalc: true
                            });
                        }

                        // Get the POST results search data
                        if (Array.isArray(resultLines)) {

                            resultLines.forEach((line, index) => {
                                // Check if custpage_qty_committed is greater than 0

                                slRecord.selectNewLine({ sublistId: 'custpage_search_items' });

                                Object.keys(line).forEach(key => {
                                    slRecord.setCurrentSublistValue({
                                        sublistId: 'custpage_search_items',
                                        fieldId: key,
                                        value: line[key]
                                    });
                                });

                                slRecord.commitLine({ sublistId: 'custpage_search_items' });

                            });

                        } else {
                            console.error('No results found or results is not an array', resultLines);
                        }

                    } else {
                        log.error('Error Updating Sublist', response.body);
                    }
                }).catch(function (err) {
                    log.error('HTTPS POST Error', err.message);
                });
            } catch (err) {
                log.error('Field Changed Error', err.message);
            }
        }
    }


    function markAllCheckboxes() {
        var rec = currentRecord.get();
        var lineCount = rec.getLineCount({ sublistId: 'custpage_search_items' });

        for (var i = 0; i < lineCount; i++) {
            rec.selectLine({ sublistId: 'custpage_search_items', line: i });
            rec.setCurrentSublistValue({
                sublistId: 'custpage_search_items',
                fieldId: 'custpage_selected',
                value: true
            });
            rec.commitLine({ sublistId: 'custpage_search_items' });
        }
    }

    return { fieldChanged,
        markAllCheckboxes: markAllCheckboxes
    };
});
