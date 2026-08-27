/**
 * @NApiVersion 2.0
 * @NScriptType Portlet
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget', 'N/search', 'N/runtime', 'N/url', 'N/log'], function(serverWidget, search, runtime, url, log) { // Keeping N/url is fine, even if not directly used for the problematic part

    function render(context) {
        var portlet = context.portlet;
        portlet.title = 'Item Inventory Quick Check';

        var itemIdOrName = '';
        var params = (context.request && context.request.parameters) || {};

        if (params.custpage_itemid_name) {
            itemIdOrName = params.custpage_itemid_name;
        }

        var scriptId = runtime.getCurrentScript().id;
        var deploymentId = runtime.getCurrentScript().deploymentId;

        var html = '<div style="padding:10px;">' +
                   '<label for="custpage_itemid_name">Item Name or Internal ID:</label>' +
                   '<input type="text" id="custpage_itemid_name" name="custpage_itemid_name" ' +
                   'value="' + (itemIdOrName || '') + '" style="width:80%; padding:5px; margin-left:5px;">' +
                   '<br><br>' +
                   '<button id="searchItemBtn" style="padding:8px 15px; background:#007bff; color:#fff; border:none; cursor:pointer;">Search</button>' +
                   '</div>';

        html += '<script type="text/javascript"><![CDATA[' +
                'require([], function() {' + // Ensures the script runs after the DOM is ready for the portlet
                '  function goSearch() {' +
                '    console.log("🔍 Search button clicked");' +
                '    var val = document.getElementById("custpage_itemid_name").value;' +
                '    if (!val) { alert("Please enter a value."); return; }' +

                '    // --- THIS IS THE CRUCIAL CHANGE ---' +
                '    // Get the base URL of the current page (dashboard) without any existing query parameters' +
                '    var baseUrl = window.location.href.split("?")[0];' +
                '    // Construct the new URL by appending script, deployment, and custom parameter' +
                '    var newUrl = baseUrl + "?script=' + scriptId + '&deploy=' + deploymentId + '&custpage_itemid_name=" + encodeURIComponent(val);' +
                '    window.location.href = newUrl;' +
                '    // --- END CRUCIAL CHANGE ---' +

                '  }' +
                '  var btn = document.getElementById("searchItemBtn");' +
                '  var input = document.getElementById("custpage_itemid_name");' +
                '  if (btn) btn.addEventListener("click", goSearch);' +
                '  if (input) input.addEventListener("keypress", function(e) {' +
                '    if (e.key === "Enter") { e.preventDefault(); goSearch(); }' +
                '  });' +
                '});' +
                ']]></script>';

        if (itemIdOrName) {
            html += getInventoryHtml(itemIdOrName);
        } else {
            html += '<div style="padding:10px; color:#666;">Enter an item name or ID to view inventory.</div>';
        }

        portlet.html = html;
    }

    // The getInventoryHtml function remains exactly the same as you had it.
    function getInventoryHtml(itemIdOrName) {
        var output = '';
        try {
            var itemSearch = search.create({
                type: search.Type.ITEM,
                filters: [
                    ['isinactive', search.Operator.IS, 'F'],
                    'AND',
                    ['type', search.Operator.ANYOF, ['InvtPart', 'Assembly', 'Kit', 'LotNumberedInventoryItem', 'SerializedInventoryItem', 'LotNumberedAssemblyItem', 'SerializedAssemblyItem']],
                    'AND',
                    [isNaN(parseInt(itemIdOrName)) ? 'itemid' : 'internalid',
                     isNaN(parseInt(itemIdOrName)) ? search.Operator.CONTAINS : search.Operator.ANYOF,
                     itemIdOrName]
                ],
                columns: [
                    'itemid', 'displayname', 'locationquantityonhand', 'locationquantityavailable',
                    'locationquantitycommitted', 'locationquantitybackordered', 'locationquantityintransit',
                    'locationquantityonorder', 'location', 'binnumber'
                ]
            });

            var rows = [];

            itemSearch.run().each(function(result) {
                rows.push({
                    itemName: result.getValue('itemid'),
                    displayName: result.getValue('displayname'),
                    location: result.getText('location'),
                    preferredBin: result.getText('binnumber'),
                    onHand: result.getValue('locationquantityonhand'),
                    available: result.getValue('locationquantityavailable'),
                    committed: result.getValue('locationquantitycommitted'),
                    backordered: result.getValue('locationquantitybackordered'),
                    inTransit: result.getValue('locationquantityintransit'),
                    onOrder: result.getValue('locationquantityonorder')
                });
                return true;
            });

            if (rows.length === 0) {
                return '<div style="padding:10px; color:#666;">No inventory found for that item.</div>';
            }

            output += '<h3 style="padding:0 10px;">Inventory for: ' + rows[0].itemName + '</h3>';
            output += '<div style="padding:10px; overflow-x:auto;">';
            output += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
            output += '<tr style="background:#f2f2f2;">' +
                      '<th style="border:1px solid #ccc; padding:6px;">Location</th>' +
                      '<th style="border:1px solid #ccc; padding:6px;">Bin</th>' +
                      '<th style="border:1px solid #ccc; padding:6px;">On Hand</th>' +
                      '<th style="border:1px solid #ccc; padding:6px;">Available</th>' +
                      '<th style="border:1px solid #ccc; padding:6px;">Committed</th>' +
                      '<th style="border:1px solid #ccc; padding:6px;">Backordered</th>' +
                      '<th style="border:1px solid #ccc; padding:6px;">In Transit</th>' +
                      '<th style="border:1px solid #ccc; padding:6px;">On Order</th>' +
                      '</tr>';

            rows.forEach(function(item) {
                output += '<tr>' +
                          '<td style="border:1px solid #ccc; padding:6px;">' + (item.location || 'N/A') + '</td>' +
                          '<td style="border:1px solid #ccc; padding:6px;">' + (item.preferredBin || 'N/A') + '</td>' +
                          '<td style="border:1px solid #ccc; padding:6px;">' + (item.onHand || 0) + '</td>' +
                          '<td style="border:1px solid #ccc; padding:6px;">' + (item.available || 0) + '</td>' +
                          '<td style="border:1px solid #ccc; padding:6px;">' + (item.committed || 0) + '</td>' +
                          '<td style="border:1px solid #ccc; padding:6px;">' + (item.backordered || 0) + '</td>' +
                          '<td style="border:1px solid #ccc; padding:6px;">' + (item.inTransit || 0) + '</td>' +
                          '<td style="border:1px solid #ccc; padding:6px;">' + (item.onOrder || 0) + '</td>' +
                          '</tr>';
            });

            output += '</table></div>';
        } catch (e) {
            log.error({ title: 'Inventory Portlet Error', details: e });
            output += '<div style="padding:10px; color:red;">Error: ' + e.message + '</div>';
        }

        return output;
    }

    return {
        render: render
    };
});