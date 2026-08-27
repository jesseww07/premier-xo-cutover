/**
 * pr_sl_adv_email.js
 *
 * Emails the vendor Purchase Order document for an inbound shipment.
 *
 * CHANGED: the header data, line data, preflight and rendering now come from
 * illuminet_po_data_lib -- the same module the print Suitelet uses -- so the
 * emailed PDF and the printed PDF are byte-for-byte the same document. All of
 * the local getInboundData / getPOData / getPOSum / sortByItem / returner
 * duplication is gone; this file no longer knows anything about the template's
 * data contract and cannot drift from it again.
 *
 * UNCHANGED: the email form, the email-template dropdown and placeholder
 * substitution, the recipient sublist, the PDF preview tab and the success
 * page all behave exactly as deployed.
 *
 * ALSO CHANGED, deliberately:
 *   - Preflight now gates the email the same way it gates the print. Errors
 *     block with the shared blocking page and a &force=T escape hatch;
 *     warnings render as a banner on the form. Previously the email path had
 *     no gate at all, so anything the print path refused to print could still
 *     be emailed to the vendor.
 *   - Render -> send -> THEN stamp. The old order stamped
 *     custrecord_zas_po_email_stamp and custrecord_inbound_email_sent before
 *     rendering, so a render or send failure left the shipment marked as
 *     emailed when no vendor ever received it.
 *   - Template ID comes from poLib.TEMPLATE_ID, not the
 *     custscript_pr_po_pdf_temp deployment parameter. Two Suitelets pointing
 *     at a template by two different mechanisms is the same class of drift
 *     this refactor exists to kill. The parameter is now unused.
 *
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/record', 'N/email', 'N/ui/serverWidget', 'N/search', 'N/log', 'N/runtime', 'N/url', './illuminet_po_data_lib'],
function (record, email, serverWidget, search, log, runtime, url, poLib) {

    const STAMP_FIELD = 'custrecord_zas_po_email_stamp';
    const SENT_FLAG_FIELD = 'custrecord_inbound_email_sent';

    // Internal IDs of the email templates offered in the dropdown.
    const EMAIL_TEMPLATE_IDS = [4];

    function onRequest(context) {
        if (context.request.method === 'GET') {
            handleGet(context);
        } else {
            handlePost(context);
        }
    }

    // =====================================================================
    // GET -- build the compose form
    // =====================================================================
    function handleGet(context) {
        const params = context.request.parameters;
        const inboundShipmentId = params.inboundShipmentId;
        const recordType = params.recordType;
        const force = params.force === 'T';

        if (!inboundShipmentId) {
            context.response.write(poLib.buildErrorHtml('Missing Inbound Shipment ID.'));
            return;
        }

        // Data + preflight + totals, all from the shared document layer.
        const doc = poLib.buildDocument(inboundShipmentId, force);

        if (doc.lines.length === 0) {
            context.response.write(poLib.buildErrorHtml(
                'No purchase order lines found on inbound shipment ' + inboundShipmentId + '.'));
            return;
        }

        // Hard errors block the compose form entirely unless &force=T, so a
        // document the print Suitelet would refuse to print cannot be emailed.
        if (doc.preflight.errors.length > 0 && !force) {
            context.response.write(poLib.buildPreflightHtml(
                doc.preflight,
                inboundShipmentId,
                buildForceUrl(inboundShipmentId, recordType),
                'emailed to the vendor'
            ));
            return;
        }

        const shipmentInfo = getShipmentInfo(inboundShipmentId);

        const form = serverWidget.createForm({ title: 'Email Purchase Order' });
        form.clientScriptModulePath = './pr_email_inbound_helper.js';

        // Hidden: the shipment being emailed.
        const shipmentField = form.addField({
            id: 'custpage_record_id',
            type: serverWidget.FieldType.TEXT,
            label: 'Inbound Shipment ID'
        });
        shipmentField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
        shipmentField.defaultValue = inboundShipmentId;

        // Hidden: carries the force decision through to the POST, so a user
        // who consciously forced past preflight is not re-blocked on send.
        const forceField = form.addField({
            id: 'custpage_force',
            type: serverWidget.FieldType.TEXT,
            label: 'Force'
        });
        forceField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
        forceField.defaultValue = force ? 'T' : 'F';

        // Non-blocking preflight findings, surfaced rather than swallowed.
        if (doc.preflight.warnings.length > 0 || (force && doc.preflight.errors.length > 0)) {
            form.addField({
                id: 'custpage_preflight_banner',
                type: serverWidget.FieldType.INLINEHTML,
                label: ' '
            }).defaultValue = buildWarningBanner(doc.preflight, force);
        }

        // PDF preview tab -- the exact file that will be attached.
        const pdfFile = poLib.generatePdf(doc.lines, doc.inboundData, poLib.TEMPLATE_ID);
        generatePrintPreview(form, pdfFile);

        const external = form.addField({
            id: 'custpage_est_doc',
            type: serverWidget.FieldType.TEXT,
            label: 'Document Number'
        });
        external.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
        external.defaultValue = shipmentInfo.shipmentNumber;

        // --- Email template dropdown ---------------------------------------
        const dropdownField = form.addField({
            id: 'custpage_email_templates',
            type: serverWidget.FieldType.SELECT,
            label: 'Email Templates'
        });
        dropdownField.addSelectOption({ value: '', text: 'Select an Email Template' });

        const transactionData = getTransactionData(inboundShipmentId);
        const templateData = {};

        EMAIL_TEMPLATE_IDS.forEach(function (templateId) {
            try {
                const emailTemplate = record.load({ type: 'emailtemplate', id: templateId });
                const name = emailTemplate.getValue({ fieldId: 'name' });

                templateData[templateId] = {
                    content: replacePlaceholders(emailTemplate.getValue({ fieldId: 'content' }), transactionData),
                    subject: replacePlaceholders(emailTemplate.getValue({ fieldId: 'subject' }), transactionData)
                };

                dropdownField.addSelectOption({ value: templateId, text: name });
            } catch (e) {
                log.error({
                    title: 'Error loading email template with ID ' + templateId,
                    details: e
                });
            }
        });

        form.addField({
            id: 'custpage_template_data',
            type: serverWidget.FieldType.LONGTEXT,
            label: 'Template Data'
        }).updateDisplayType({
            displayType: serverWidget.FieldDisplayType.HIDDEN
        }).defaultValue = JSON.stringify(templateData);

        form.addField({
            id: 'custpage_email_subject',
            type: serverWidget.FieldType.TEXT,
            label: 'Email Subject'
        });

        form.addFieldGroup({ id: 'custpage_group1', label: 'Option Group' });

        const recordTypeSl = form.addField({
            id: 'custpage_recordtype',
            type: serverWidget.FieldType.TEXT,
            label: 'Record Type'
        });
        recordTypeSl.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
        recordTypeSl.defaultValue = recordType;

        form.addField({
            id: 'custpage_email_body',
            type: serverWidget.FieldType.RICHTEXT,
            label: 'Email Body'
        });

        // --- Recipient sublist ---------------------------------------------
        const emailSublist = form.addSublist({
            id: 'custpage_email_sublist',
            type: serverWidget.SublistType.INLINEEDITOR,
            label: 'Email Addresses'
        });
        emailSublist.addField({
            id: 'custpage_email_select',
            type: serverWidget.FieldType.CHECKBOX,
            label: 'Select'
        });
        emailSublist.addField({
            id: 'custpage_name',
            type: serverWidget.FieldType.TEXT,
            label: 'Name'
        });
        emailSublist.addField({
            id: 'custpage_company',
            type: serverWidget.FieldType.TEXT,
            label: 'Company'
        });
        emailSublist.addField({
            id: 'custpage_email_address',
            type: serverWidget.FieldType.EMAIL,
            label: 'Email Address'
        });

        const emails = getEmailAddresses(inboundShipmentId);
        const seenEmails = {};
        let index = 0;

        emails.forEach(function (emailObj) {
            if (seenEmails[emailObj.email]) return;

            emailSublist.setSublistValue({ id: 'custpage_name', line: index, value: emailObj.name });
            emailSublist.setSublistValue({ id: 'custpage_company', line: index, value: emailObj.company });
            emailSublist.setSublistValue({ id: 'custpage_email_address', line: index, value: emailObj.email });

            seenEmails[emailObj.email] = true;
            index++;
        });

        form.addSubmitButton({ label: 'Send Email' });
        context.response.writePage(form);
    }

    // =====================================================================
    // POST -- render, send, then stamp
    // =====================================================================
    function handlePost(context) {
        const req = context.request;
        const inboundShipmentId = req.parameters.custpage_record_id;
        const recordType = req.parameters.custpage_recordtype;
        const subject = req.parameters.custpage_email_subject;
        const body = req.parameters.custpage_email_body;
        const force = req.parameters.custpage_force === 'T';

        if (!inboundShipmentId) {
            context.response.write(poLib.buildErrorHtml('Missing Inbound Shipment ID.'));
            return;
        }

        const selectedEmails = [];
        const lineCount = req.getLineCount({ group: 'custpage_email_sublist' });
        for (let i = 0; i < lineCount; i++) {
            const isSelected = req.getSublistValue({
                group: 'custpage_email_sublist',
                name: 'custpage_email_select',
                line: i
            });
            if (isSelected === 'T') {
                selectedEmails.push(req.getSublistValue({
                    group: 'custpage_email_sublist',
                    name: 'custpage_email_address',
                    line: i
                }));
            }
        }

        if (selectedEmails.length === 0) {
            context.response.write(poLib.buildErrorHtml(
                'No recipients were selected. Go back and tick at least one email address before sending.'));
            return;
        }

        // Rebuild from the shared layer rather than trusting anything posted
        // back from the browser.
        const doc = poLib.buildDocument(inboundShipmentId, force);

        if (doc.lines.length === 0) {
            context.response.write(poLib.buildErrorHtml(
                'No purchase order lines found on inbound shipment ' + inboundShipmentId + '.'));
            return;
        }

        // Re-gate on POST: the GET form can be stale, and nothing should reach
        // a vendor that preflight rejects.
        if (doc.preflight.errors.length > 0 && !force) {
            context.response.write(poLib.buildPreflightHtml(
                doc.preflight,
                inboundShipmentId,
                buildForceUrl(inboundShipmentId, recordType),
                'emailed to the vendor'
            ));
            return;
        }

        const pdfFile = poLib.generatePdf(doc.lines, doc.inboundData, poLib.TEMPLATE_ID);
        pdfFile.name = 'premierlighting_PO' + inboundShipmentId + '.pdf';

        const shipmentInfo = getShipmentInfo(inboundShipmentId);

        email.send({
            author: runtime.getCurrentUser().id,
            recipients: selectedEmails,
            subject: subject,
            body: body,
            attachments: [pdfFile],
            relatedRecords: { entityId: shipmentInfo.vendorId }
        });

        // Stamp LAST. A render or send failure must not leave the shipment
        // marked as emailed when no vendor received anything.
        try {
            const values = {};
            values[STAMP_FIELD] = new Date();
            values[SENT_FLAG_FIELD] = true;
            record.submitFields({
                type: 'inboundshipment',
                id: inboundShipmentId,
                values: values
            });
        } catch (e) {
            log.error('PO email stamp failed', e);
        }

        const form = serverWidget.createForm({ title: ' ' });
        form.addField({
            id: 'custpage_success_msg',
            type: serverWidget.FieldType.INLINEHTML,
            label: ' '
        }).defaultValue = `
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px;">
                <div style="width: 80px; height: 80px; background-color: green; border-radius: 50%;
                            display: flex; align-items: center; justify-content: center;">
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12l4 4L19 7"></path>
                    </svg>
                </div>
                <div style="color: green; font-size: 18px; font-weight: bold; margin-top: 10px;">
                    The PO email has been successfully sent.
                </div>
            </div>
        `;
        context.response.writePage(form);
    }

    // =====================================================================
    // FORM HELPERS
    // =====================================================================

    /**
     * Re-entry URL that skips the preflight gate. Mirrors the print
     * Suitelet's force escape hatch.
     */
    function buildForceUrl(inboundShipmentId, recordType) {
        const self = url.resolveScript({
            scriptId: runtime.getCurrentScript().id,
            deploymentId: runtime.getCurrentScript().deploymentId,
            returnExternalUrl: false
        });
        return self +
            '&inboundShipmentId=' + inboundShipmentId +
            (recordType ? '&recordType=' + encodeURIComponent(recordType) : '') +
            '&force=T';
    }

    /**
     * Non-blocking banner for preflight findings that did not stop the send,
     * plus the errors themselves when the user has forced past them.
     */
    function buildWarningBanner(preflight, force) {
        let html = '<div style="border:1px solid #d3a017; background:#fdf6e3; padding:12px 16px; margin:10px 0;">';

        if (force && preflight.errors.length > 0) {
            html += '<div style="color:#922C2C; font-weight:bold; margin-bottom:6px;">' +
                'Forced past ' + preflight.errors.length + ' blocking error(s):</div><ul style="margin:0 0 10px 18px;">';
            preflight.errors.forEach(function (e) { html += '<li>' + e + '</li>'; });
            html += '</ul>';
        }

        if (preflight.warnings.length > 0) {
            html += '<div style="font-weight:bold; margin-bottom:6px;">' +
                preflight.warnings.length + ' warning(s) on this purchase order:</div><ul style="margin:0 0 0 18px;">';
            preflight.warnings.forEach(function (w) { html += '<li>' + w + '</li>'; });
            html += '</ul>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Adds a "Printout" tab and embeds the rendered PDF via PDF.js.
     * The file passed in is the same one that gets attached to the email.
     */
    function generatePrintPreview(form, pdfFile) {
        try {
            const pdfDataUrl = 'data:application/pdf;base64,' + pdfFile.getContents();

            form.addTab({ id: 'custpage_printout_tab', label: 'Printout' });

            form.addField({
                id: 'custpage_html_printout',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Transaction Printout',
                container: 'custpage_printout_tab'
            }).defaultValue = `
                <div id="pdf-viewer" style="width: 100%; height: 600px; overflow-y: scroll; display: flex; flex-direction: column; align-items: center;"></div>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js"></script>
                <script>
                    let pdfDataUrl = "${pdfDataUrl}";
                    let pdfViewer = document.getElementById('pdf-viewer');

                    pdfjsLib.getDocument(pdfDataUrl).promise.then(function(pdf) {
                        let totalPages = pdf.numPages;
                        for (let i = 1; i <= totalPages; i++) {
                            pdf.getPage(i).then(function(page) {
                                let scale = 1.5;
                                let viewport = page.getViewport({ scale: scale });
                                let canvas = document.createElement('canvas');

                                canvas.style.display = 'block';
                                canvas.style.marginBottom = '20px';
                                canvas.style.border = '2px solid black';
                                pdfViewer.appendChild(canvas);

                                let context = canvas.getContext('2d');
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;

                                canvas.style.marginLeft = 'auto';
                                canvas.style.marginRight = 'auto';

                                page.render({ canvasContext: context, viewport: viewport });
                            });
                        }
                    });
                </script>
            `;
        } catch (e) {
            log.error({ title: 'Error rendering PDF preview', details: e });

            form.addField({
                id: 'custpage_error_message',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Error'
            }).defaultValue = 'Error rendering Transaction: ' + e.message;
        }
    }

    // =====================================================================
    // LOOKUPS
    // =====================================================================

    /**
     * Shipment number (for the Document Number field) and vendor internal ID
     * (for email relatedRecords) in a single lookup, replacing a full
     * record.load plus a separate search.
     */
    function getShipmentInfo(inboundShipmentId) {
        const info = { shipmentNumber: '', vendorId: '' };

        try {
            const fields = search.lookupFields({
                type: 'inboundshipment',
                id: inboundShipmentId,
                columns: ['shipmentnumber', 'custrecord_mli_inbound_vendor']
            });

            info.shipmentNumber = fields.shipmentnumber || '';

            const vendor = fields.custrecord_mli_inbound_vendor;
            if (vendor && vendor.length > 0) {
                info.vendorId = vendor[0].value;
            }
        } catch (e) {
            log.error('Unable to look up inbound shipment ' + inboundShipmentId, e);
        }

        return info;
    }

    /**
     * Vendor email plus every contact email on that vendor.
     */
    function getEmailAddresses(inboundShipmentId) {
        const emails = [];
        if (!inboundShipmentId) return emails;

        search.create({
            type: 'inboundshipment',
            filters: [['internalid', 'anyof', inboundShipmentId]],
            columns: [
                search.createColumn({ name: 'companyname', join: 'vendor' }),
                search.createColumn({ name: 'internalid', join: 'vendor' }),
                search.createColumn({ name: 'email', join: 'vendor' }),
                search.createColumn({ name: 'entityid', join: 'vendor' })
            ]
        }).run().each(function (result) {
            const vendorId = result.getValue({ name: 'internalid', join: 'vendor' });
            const vendorEmail = result.getValue({ name: 'email', join: 'vendor' });

            if (vendorEmail) {
                emails.push({
                    name: result.getValue({ name: 'entityid', join: 'vendor' }),
                    email: vendorEmail,
                    company: result.getValue({ name: 'companyname', join: 'vendor' })
                });
            }

            search.create({
                type: 'contact',
                filters: [['vendor.internalid', 'anyof', vendorId]],
                columns: ['entityid', 'email', 'company']
            }).run().each(function (contact) {
                const contactEmail = contact.getValue({ name: 'email' });
                if (contactEmail) {
                    emails.push({
                        name: contact.getValue({ name: 'entityid' }),
                        email: contactEmail,
                        company: contact.getValue({ name: 'company' })
                    });
                }
                return true;
            });

            return true;
        });

        return emails;
    }

    // =====================================================================
    // EMAIL TEMPLATE PLACEHOLDERS
    //
    // These drive the email BODY only. The PDF's data contract belongs
    // entirely to illuminet_po_data_lib -- do not add PDF fields here.
    // =====================================================================
    function getTransactionData(inboundShipmentId) {
        const transactionData = {};

        try {
            const resultSet = search.create({
                type: 'inboundshipment',
                filters: [['internalidnumber', 'equalto', inboundShipmentId]],
                columns: [
                    'custrecord_mli_inbound_vendor',
                    search.createColumn({ name: 'firstname', join: 'vendor' }),
                    search.createColumn({ name: 'lastname', join: 'vendor' }),
                    search.createColumn({ name: 'companyname', join: 'vendor' }),
                    search.createColumn({ name: 'internalid', join: 'vendor' })
                ]
            }).run().getRange({ start: 0, end: 1 });

            if (resultSet.length > 0) {
                const result = resultSet[0];
                transactionData['transaction.tranId'] = result.getValue({ name: 'custrecord_mli_inbound_vendor' });
                transactionData['transaction.entity'] = result.getText({ name: 'custrecord_mli_inbound_vendor' });
                transactionData['transaction.entity.companyname'] = result.getValue({ name: 'companyname', join: 'vendor' });
                transactionData['transaction.entity.firstname'] = result.getValue({ name: 'firstname', join: 'vendor' });
                transactionData['transaction.entity.lastname'] = result.getValue({ name: 'lastname', join: 'vendor' });
            }
        } catch (e) {
            log.error('Error fetching transaction data via search', e.message);
        }

        return transactionData;
    }

    function replacePlaceholders(template, data) {
        if (!template) return '';

        return template.replace(/\$\{transaction\.(\w+(\.\w+)*)\}/g, function (match, field) {
            const value = data['transaction.' + field];
            return (value === null || value === undefined || value === '') ? '' : value;
        });
    }

    return {
        onRequest: onRequest
    };
});