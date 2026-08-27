/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime'],
    function (record, search, ui, dialog, runtime) {

        function onAction(context) {
            try {
                var salesOrd = context.newRecord;
                var id = salesOrd.id;
                log.debug('id', id);

                var taxRate = salesOrd.getValue({ fieldId: 'custbody_robson_tax_link' });
                log.debug('taxRate', taxRate);

                var createdFrom = salesOrd.getValue({ fieldId: 'createdfrom' });
                log.debug('createdFrom', createdFrom);

                var ignore = salesOrd.getValue({ fieldId: 'custbody_robson_ignore' });
                if (ignore == true || createdFrom) {
                    return;
                }

                var taxMult = Number(taxRate) / 100;
                var numLines = salesOrd.getLineCount({ sublistId: 'item' });
                log.debug('numLines', numLines);

                // FIX: declare accumulators BEFORE the loop (var is function-scoped,
                // but keep them here explicitly to avoid any block-scope confusion)
                var taxFinal = 0;
                var custTotal = 0;

                for (var x = 0; x < numLines; x++) {
                    salesOrd.selectLine({ sublistId: 'item', line: x });

                    // FIX: use !lineIgnore instead of == false
                    // custcol_ignore_rope returns "" (empty string) not false,
                    // and "" == false evaluates to false in JS
                    var lineIgnore = salesOrd.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_ignore_rope'
                    });

                    var rawAmount = salesOrd.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount'
                    });

                    // FIX: Math.abs() handles negative stored amounts
                    var amount = Math.abs(Number(rawAmount));

                    if (!lineIgnore && amount > 0) {

                        var lineMarkup = salesOrd.getCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pr_robson_markup_line'
                        });
                        if (!lineMarkup) {
                            lineMarkup = 1.28;
                        }

                        log.debug('amount', amount);

                        var revised = amount * lineMarkup;
                        var multplierTax = 1 + taxMult;
                        var revisedTax = Math.round(revised) * multplierTax;
                        var justTax = revised * taxMult;
                        log.debug('justTax', justTax);

                        taxFinal += Number(justTax);
                        custTotal += (Math.round(revised) + Number(justTax));

                        var wRound = Math.round(revised);

                        salesOrd.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_robson_amount',
                            value: wRound,
                            ignoreFieldChange: false
                        });
                        salesOrd.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_robson_amt_w_tax',
                            value: Math.ceil(revisedTax.toFixed(2)),
                            ignoreFieldChange: false
                        });

                        salesOrd.commitLine({ sublistId: 'item' });
                    }
                }

                log.debug('taxFinal', taxFinal);

                salesOrd.setValue({
                    fieldId: 'custbody_robson_tax_amount',
                    value: Math.ceil(taxFinal.toFixed(2))
                });

                var shippingMethod = salesOrd.getValue({ fieldId: 'shipmethod' });
                if (!shippingMethod) {
                    salesOrd.setValue({ fieldId: 'shipmethod', value: '955560' });
                }

                salesOrd.setValue({
                    fieldId: 'shippingcost',
                    value: Math.ceil(taxFinal.toFixed(2))
                });

                log.debug('cust_total', custTotal);
                salesOrd.setValue({
                    fieldId: 'custbody_robson_cust_subtotal',
                    value: Math.ceil(custTotal)
                });

                var backTax = Number(custTotal) - Number(taxFinal);
                var ntp = Number(backTax) * 0.75;
                log.debug('ntp', ntp);
                salesOrd.setValue({
                    fieldId: 'custbody_robson_ntp',
                    value: Math.ceil(ntp)
                });

            } catch (e) {
                log.error('failure in onAction', e);
            }
        }

        return { onAction: onAction };
    }
);