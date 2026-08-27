/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define([
    'N/ui/serverWidget',
    'N/url',
    'N/search'
], function (serverWidget, url, search) {

    function onRequest(context) {
        var params = context.request.parameters;

        // ---- PART A: If we see our "data" param, render it and return ----
        if (params.data) {
            // decode & parse
            var arr = JSON.parse(decodeURIComponent(params.data));

            // build HTML table
            var html = ''
                + '<style>'
                + 'table { border-collapse:collapse; width:100%; }'
                + 'th,td { border:1px solid #ccc; padding:6px; }'
                + 'th { background:#eee; }'
                + '</style>'
                + '<h2>Stored Quantity Details</h2>'
                + '<table>'
                + '<tr>'
                + '<th>Date</th><th>Entity</th><th>Doc#</th><th>PO #</th>'
                + '<th>Item</th><th>Qty</th><th>Committed</th>'
                + '</tr>';

            arr.forEach(function (r) {
                html += '<tr>'
                    + '<td>' + r.trandate + '</td>'
                    + '<td>' + r.entityText + '</td>'
                    + '<td>' + r.docNum + '</td>'
                    + '<td>' + r.otherrefnum + '</td>'
                    + '<td>' + r.itemText + '</td>'
                    + '<td>' + r.quantity + '</td>'
                    + '<td>' + r.quantitycommitted + '</td>'
                    + '</tr>';
            });

            html += '</table>';

            // write a simple form with INLINEHTML
            var form = serverWidget.createForm({ title: 'Detail View' });
            form.addField({
                id: 'custpage_detail',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Details'
            }).defaultValue = html;

            context.response.writePage(form);
            return;
        }

        // ---- PART B: otherwise, render your main form + sublist ----
        if (context.request.method !== 'GET') return;

        // (your existing logic to load soRec, fetchStoredQuantities, etc.)
        var soId = Number(context.request.parameters.soId);
        var storedQuantities = fetchStoredQuantitiesForSO(soId);

        var form = serverWidget.createForm({ title: 'Sales Order Storage' });
        // … add body fields …

        var sublist = form.addSublist({
            id: 'custpage_items',
            type: serverWidget.SublistType.LIST,
            label: 'Items'
        });
        // … other columns …
        sublist.addField({
            id: 'custpage_details',
            type: serverWidget.FieldType.URL,
            label: 'View Details'
        });

        // populate sublist
        var lineCount = storedQuantities.length;
        for (var i = 0; i < lineCount; i++) {
            var rec = storedQuantities[i];

            // 1) set your item/qty columns here…

            // 2) JSON-encode just this record (or pass the whole filtered array if you like)
            var slice = [rec]; // or pass slice = storedQuantities to show all
            var json = encodeURIComponent(JSON.stringify(slice));

            // 3) build the Suitelet link with our data
            var detailUrl = url.resolveScript({
                scriptId: 'customscript_pr_stored_reallocator',
                deploymentId: 'customdeploy_pr_stored_reallocator',
                params: { data: json }
            });

            // 4) set URL + override link text
            sublist.setSublistValue({
                id: 'custpage_details',
                line: i,
                value: detailUrl
            });
            sublist.setSublistText({
                id: 'custpage_details',
                line: i,
                text: 'View Details'
            });
        }

        context.response.writePage(form);
    }

    // --- your helper that returns the array you already build in fetchStoredQuantities() ---
    function fetchStoredQuantitiesForSO(soId) {
        var arr = [];
        // ... run your search, build returnObj objects, push into arr ...
        return arr;
    }

    return { onRequest: onRequest };
});
