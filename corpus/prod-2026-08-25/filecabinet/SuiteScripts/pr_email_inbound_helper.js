/**
 * @NApiVersion 2.1
 *@NModuleScope Public
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/url', 'N/https', 'N/search', 'N/record', './Third-Party-Applications/sweetalert2.all.js'],
    function (currentRecord, url, https, search, record, Swal) {

        function pageInit(context) { }

        function fieldChanged(context) {
            let rec = currentRecord.get();
            let fieldId = context.fieldId;
            console.log("fieldId", fieldId);

            if (fieldId === 'custpage_email_templates') {

                let selectedTemplateId = rec.getValue({ fieldId: 'custpage_email_templates' });

                console.log('selectedTemplateId', selectedTemplateId);
                // Retrieve the stored template data from the hidden field
                let templateDataJSON = rec.getValue({ fieldId: 'custpage_template_data' });
                console.log('templateDataJSON', templateDataJSON);
                let templateData = templateDataJSON ? JSON.parse(templateDataJSON) : {};
                console.log('templateData', templateData);

                // Update the email body if the selected template exists
                if (selectedTemplateId && templateData[selectedTemplateId]) {
                    console.log('selectedTemplateId', selectedTemplateId);
                    rec.setValue({
                        fieldId: 'custpage_email_body',
                        value: templateData[selectedTemplateId].content
                    });
                    rec.setValue({
                        fieldId: 'custpage_email_subject',
                        value: templateData[selectedTemplateId].subject
                    })
                }
            }
        }


        function callUpdateOrder() {
            try {
                var slRecord = currentRecord.get();

                // Log the raw values first
                var rawHidePricing = slRecord.getValue({fieldId: 'custpage_hide_pricing'});
                var rawHideImage = slRecord.getValue({fieldId: 'custpage_hide_img'});
                var rawScrambledName = slRecord.getValue({fieldId: 'custpage_use_scrambled_name'});
                let sortItemBy = slRecord.getValue({fieldId: 'custpage_sort_item_by'});
                var rawIncludeDeposit = slRecord.getValue({fieldId: 'custpage_include_deposit'});
                let rawShowDiscount = slRecord.getValue({ fieldId: "custpage_show_discount"})

                console.log("Raw hidePricing value:", rawHidePricing);
                console.log("Raw hideImage value:", rawHideImage);
                console.log("Raw scrambled name value:", rawScrambledName);
                console.log("Raw sort item by value:", sortItemBy);
                console.log("Raw show discount by value:", rawShowDiscount);

                // Convert correctly based on what NetSuite actually returns
                var hidePricing = rawHidePricing === 'T' || rawHidePricing === true;
                var hideImage = rawHideImage === 'T' || rawHideImage === true;
                var scrambledName = rawScrambledName === 'T' || rawScrambledName === true;
                var includeDeposit = rawIncludeDeposit === 'T' || rawIncludeDeposit === true;
                var showDiscount = rawShowDiscount === 'T' || rawShowDiscount === true;

                console.log("Converted hidePricing:", hidePricing);
                console.log("Converted hideImage:", hideImage);
                console.log("Converted scrambled name:", scrambledName);
                console.log("Converted show Discount:", showDiscount);

                var recordType = slRecord.getValue({fieldId: 'custpage_recordtype'});
                var recordId = slRecord.getValue({fieldId: 'custpage_record_id'});
                console.log("recordType", recordType);
                console.log("recordId", recordId);
                if (recordType && recordType.toLowerCase().trim() === 'inboundshipment') {
                    console.log("inboundShipment submit field");
                    try {
                        let inboundRecord = record.load({ type: recordType, id: recordId });
                        inboundRecord.setValue({fieldId: 'custrecord_hide_pricing', value: hidePricing});
                        inboundRecord.setValue({fieldId: 'custrecord_hide_item_images', value: hideImage});
                        inboundRecord.setValue({ fieldId: 'custrecord_gl_use_scramle_name', value: scrambledName })
                        inboundRecord.save()
                        console.log("submitFields successful for inboundShipment");
                    } catch (e) {
                        console.error("submitFields ERROR (inboundShipment):", e.name, e.message);
                    }
                }
                else{
                    record.submitFields({
                        type: recordType,
                        id: recordId,
                        values: {
                            'custbody_show_pricing': hidePricing,
                            'custbody_lty_hide_images': hideImage,
                            'custbody_gl_use_scramle_name': scrambledName,
                            'custbody_gl_order_by' : sortItemBy,
                            'custbody_gl_show_discount': showDiscount,
                            'custbody_gl_include_depo' : includeDeposit
                        }
                    });
                }



                location.reload(); // Reload Suitelet after update

            } catch (e) {
                console.error('Error in callUpdateOrder:', e.message);
            }
        }

        function saveRecord(context) {
            let selectedEmails = [];
            let slRecord = currentRecord.get();
            let emailSubject = slRecord.getValue("custpage_email_subject")
            let emailBody = slRecord.getValue("custpage_email_body")
            if (!emailSubject) {
                Swal.fire({
                    title: '<strong>Email Subject Missing</strong>',
                    html: `<div>Please enter an email subject before continuing.</div>`,
                    icon: 'warning',
                    confirmButtonColor: '#FF0000',
                    confirmButtonText: 'OK'
                });

                return false; // Prevents form submission
            }

            if (!emailBody) {
                Swal.fire({
                    title: '<strong>Email Body Missing</strong>',
                    html: `<div>Please enter an email message before continuing.</div>`,
                    icon: 'warning',
                    confirmButtonColor: '#FF0000',
                    confirmButtonText: 'OK'
                });

                return false; // Prevents form submission
            }




            let lineCount = slRecord.getLineCount({ sublistId: 'custpage_email_sublist' });

            for (let i = 0; i < lineCount; i++) {
                let isSelected = slRecord.getSublistValue({
                    sublistId: 'custpage_email_sublist',
                    fieldId: 'custpage_email_select',
                    line: i
                });

                if (isSelected === true || isSelected === 'T') {
                    let email = slRecord.getSublistValue({
                        sublistId: 'custpage_email_sublist',
                        fieldId: 'custpage_email_address',
                        line: i
                    });

                    if (email) {
                        selectedEmails.push(email);
                    }
                }
            }

            if (selectedEmails.length === 0) {
                Swal.fire({
                    title: '<strong>No Email Selected!</strong>',
                    html: `<div>Please select at least one email before proceeding.</div>`,
                    icon: 'warning',
                    confirmButtonColor: '#FF0000',
                    confirmButtonText: 'CONFIRM'
                });

                return false; // Prevents form submission
            }

            return true; // Allows form submission if at least one email is selected
        }






        return {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            callUpdateOrder: callUpdateOrder,
            saveRecord: saveRecord
        };
    });