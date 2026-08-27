/*
 * To protect against version incompatibility, this script includes the @NApiVersion tag.
 * custom_library.js
 * @NApiVersion 2.1
 */


define([ 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/ui/serverWidget', 'N/render' , 'N/email', 'N/encode'], function (log, record, runtime, search, serverWidget, render, email, encode) {

    /**
     * Adds a "Printout" tab to the form and embeds a PDF preview using PDF.js.
     * Converts a transaction PDF file to Base64 and renders all pages in an iFrame-like scrollable viewer.
     * Displays an error message on the form if rendering fails.
     * */
    const generatePrintPreview = (originatingID, form, doc, record, pdfFile) => {
        log.error('originatingID', originatingID);

        try {
            // Convert to Base64 for embedding
            let pdfBinary = pdfFile.getContents();
            let pdfBase64 = encode.convert({
                string: pdfBinary,
                inputEncoding: encode.Encoding.BASE_64,
                outputEncoding: encode.Encoding.BASE_64
            });

            let pdfDataUrl = 'data:application/pdf;base64,' + pdfBase64;

            // Add a tab for Printout
            let printoutTab = form.addTab({
                id: 'custpage_printout_tab',
                label: 'Printout'
            });

            // Add Field to Display PDF in an iFrame with PDF.js
            let htmlField = form.addField({
                id: 'custpage_html_printout',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Transaction Printout',
                container: 'custpage_printout_tab'
            });

            // Embed the PDF using PDF.js viewer with vertical stacking, centered alignment, borders, and space between pages
            htmlField.defaultValue = `
                <div id="pdf-viewer" style="width: 100%; height: 600px; overflow-y: scroll; display: flex; flex-direction: column; align-items: center;"></div>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js"></script>
                <script>
                    let pdfDataUrl = "${pdfDataUrl}";
                    let pdfViewer = document.getElementById('pdf-viewer');
        
                    pdfjsLib.getDocument(pdfDataUrl).promise.then(function(pdf) {
                        let totalPages = pdf.numPages;
                        // Render all pages one below the other, center aligned with borders
                        for (let i = 1; i <= totalPages; i++) {
                            pdf.getPage(i).then(function(page) {
                                let scale = 1.5;
                                let viewport = page.getViewport({ scale: scale });
                                let canvas = document.createElement('canvas');
                                
                                // Set border and spacing between pages
                                canvas.style.display = 'block';
                                canvas.style.marginBottom = '20px';  // Space between pages
                                canvas.style.border = '2px solid black';  // Border around each page
                                pdfViewer.appendChild(canvas);  // Append the canvas for each page
        
                                let context = canvas.getContext('2d');
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
        
                                // Center canvas horizontally within the parent div
                                canvas.style.marginLeft = 'auto';
                                canvas.style.marginRight = 'auto';
        
                                page.render({ canvasContext: context, viewport: viewport });
                            });
                        }
                    });
                </script>`;
        } catch (e) {
            log.error({ title: 'Error Rendering Transaction', details: e });

            form.addField({
                id: 'custpage_error_message',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Error'
            }).defaultValue = 'Error rendering Transaction: ' + e.message;
        }
    };

    /**
     * * Retrieves transaction data (Estimate or Sales Order) using a saved search.
     *  * Returns an object with transaction ID and customer details (first name, last name, company name).
     */
    function getTransactionData(recId) {
        let transactionData = {};

        try {
            let estSearch = search.create({
                type: "transaction",
                filters: [
                    ["type","anyof","Estimate", "SalesOrd"],
                    "AND",
                    ["internalidnumber","equalto", recId],
                    "AND",
                    ["mainline","is","T"],
                    "AND",
                    ["shipping","is","F"],
                    "AND",
                    ["taxline","is","F"]
                ],
                columns: [
                    "tranid",
                    "type",
                    search.createColumn({ name: "firstname", join: "customer" }),
                    search.createColumn({ name: "lastname", join: "customer" }),
                    search.createColumn({ name: "companyname", join: "customer" })
                ]
            });

            let resultSet = estSearch.run().getRange({ start: 0, end: 1 });

            if (resultSet.length > 0) {
                let result = resultSet[0];
                let entityId = result.getValue({ name: 'tranid' });
                let firstName = result.getValue({ name: "firstname", join: "customer" })
                let lastName = result.getValue({ name: "lastname", join: "customer" })
                let companyName = result.getValue({ name: "companyname", join: "customer" })
                let tranType = result.getValue({ name: "type"})
                if(tranType === "SalesOrd"){
                    transactionData['transaction@title'] = "Sales Order";
                }else{
                    transactionData['transaction@title'] = tranType;
                }
                transactionData['transaction.tranId'] = entityId;
                transactionData['transaction.entity.companyname'] = companyName;
                transactionData['transaction.entity.firstname'] = firstName;
                transactionData['transaction.entity.lastname'] = lastName;
                transactionData['companyInformation.companyName'] = "Graham's Lighting, Inc";
            }
        } catch (e) {
            log.error('Error fetching transaction data via search', e.message);
        }

        log.debug('Transaction data', transactionData);
        return transactionData;
    }


    /**
     * Replaces placeholders in a template string with corresponding values from the transaction data.
     * Placeholders follow the format: ${transaction.key} or ${transaction.entity.key}.
     * */
    function replacePlaceholders(template, data) {
        log.debug('replacePlaceholders - Template:', template);
        log.debug('replacePlaceholders - Data:', JSON.stringify(data));

        return template.replace(/\$\{([\w@.]+)\}/g, function (match, key) {
            log.debug('Matched placeholder:', match);
            log.debug('Lookup key:', key);
            log.debug('Available keys:', Object.keys(data));

            let value = data[key]; // Use key directly
            log.debug('Replacement value:', value);

            if (value === null || value === undefined || value === '') {
                log.debug('Removing placeholder due to empty value:', match);
                return '';
            }
            return value;
        });
    }



    /**
     * Generates a PDF from a transaction and emails it to selected recipients.
     **/
    function generatePdf(data, emailBody, emailSubject, selectedEmails, originatingID, doc, transactionForm, custId, emailSender) {
        log.error('data', data);

        let userId
        if(emailSender){
            userId = emailSender
        } else{
            userId = runtime.getCurrentUser().id;
        }

        let pdfFile = render.transaction({
            entityId: Number(originatingID), //internal ID of the transaction
            printMode: render.PrintMode.PDF, // Has 3 options, (HTML, PDF, DEFULT)
            inCustLocale: true,
        });

        // Send email to the selected recipients with PDF attachment
        email.send({
            author: userId,
            recipients: selectedEmails,
            subject: emailSubject,
            body: emailBody,
            attachments: [pdfFile],
            relatedRecords: {
                transactionId: originatingID,
                entityId: custId
            }

        });
    }

    /**
     * Escapes HTML special characters in a given string to prevent rendering issues or XSS.
     * Returns an empty string if input is null, undefined, or falsy.
     **/
    function returner(word) {
        if (word) {
            word = word.replace(/&/g, "&amp;")
            word = word.replace(/</g, "&lt;")
            word = word.replace(/>/g, "&gt;")
            word = word.replace(/'/g, "&#39;")
            word = word.replace(/"/g, "&quot;");
        }
        else {
            word = ''
        }
        if (word == null || word == 'undefined') {
            word = ''
        }
        return word
    }

    const proveExceedLimit = (searchObject) => {

        let searchResults = [];
        // Governance: Search.runPaged() - 5 units
        const pagedData = searchObject.runPaged({pageSize: 1000});

        pagedData.pageRanges.forEach((pageRange) => {
            // Governance: PagedData.fetch() - 5 units
            searchResults = searchResults.concat(pagedData.fetch({index: pageRange.index}).data);
        });

        return searchResults;
    }


    return {
        generatePrintPreview: generatePrintPreview,
        generatePdf: generatePdf,
        getTransactionData: getTransactionData,
        replacePlaceholders: replacePlaceholders,
        returner: returner,
        proveExceedLimit: proveExceedLimit
    };

});