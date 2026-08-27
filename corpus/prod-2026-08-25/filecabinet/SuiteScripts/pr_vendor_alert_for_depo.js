define(['N/search', 'N/record', 'N/log', 'N/ui/dialog'],
    function (search, record, log, dialog) {
        /**
         * Module Description...
         *
         * @type {Object} module-name
         * @copyright 2021
         * @author  <>
         * @NApiVersion 2.1
         * @NModuleScope SameAccount
         * @NScriptType ClientScript
         */
        /**
         *
         * @gov XXX
         *
         * @param {Object} context
         * @param {CurrentRecord} context.currentRecord - The current form record
         * @param {string} context.sublistId - The internal ID of the sublist.
         * @param {string} context.fieldId - The internal ID of the field that was changed.
         * @param {string} [context.lineNum] - The index of the line if the field is in a sublist or
         *        matrix.
         * @param {string} [context.columnNum] - The index of the column if the field is in a matrix.
         */
        function fieldChanged(context) {
            try {
                let invoice = context.currentRecord;
                let invoiceId = invoice.id;
                let field = context.fieldId;
                if (field === 'entity') {
                    log.debug('invoiceId', invoiceId);
                    let customer = invoice.getValue({
                        fieldId: 'entity'
                    });
                    log.debug('customer', customer);
                    let depoResponse = getVendorDepo(customer);

                    if (depoResponse) {
                        dialog.alert({
                            title: 'Alert',
                            message: `Please note that this vendor has an open deposits on file.`
                        });
                    }
                    return true;
                }
            }
            catch (error) {
                log.error('ERROR in fieldChanged', error);
                return true;
            }
        }
        function pageInit(context) {
            try {
                let invoice = context.currentRecord;
                let invoiceId = invoice.id;
                let field = context.fieldId;

                    log.debug('invoiceId', invoiceId);
                    let customer = invoice.getValue({
                        fieldId: 'entity'
                    });
                    log.debug('customer', customer);
                    let depoResponse = getVendorDepo(customer);

                    if (depoResponse) {
                        dialog.alert({
                            title: 'Alert',
                            message: `Please note that this vendor has an open deposits on file.`
                        });
                    }
                    return true;
                
            }
            catch (error) {
                log.error('ERROR in fieldChanged', error);
                return true;
            }
        }
        const getVendorDepo = (customer) => {
            // run saved search to find Credit Memos with "Customer Aware" checked
            let hasOpen = false;
            var vendorprepaymentSearchObj = search.create({
                type: "vendorprepayment",
                filters:
                    [
                        ["type", "anyof", "VPrep"],
                        "AND",
                        ["status", "anyof", "VPrep:E", "VPrep:A", "VPrep:B"],
                        "AND",
                        ["mainline", "is", "T"],
                      "AND",
                      ["entity", "is", customer]
                    ],
                columns:
                    [
                        "internalid"
                    ]
            });
            var searchResultCount = vendorprepaymentSearchObj.runPaged().count;
            log.debug("vendorprepaymentSearchObj result count", searchResultCount);
            vendorprepaymentSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                let creditMemo = result.getValue({
                    name: 'internalid'
                });
                hasOpen = true
                return true;
            });
            return hasOpen;
        }

        return { fieldChanged: fieldChanged, pageInit: pageInit }
    });