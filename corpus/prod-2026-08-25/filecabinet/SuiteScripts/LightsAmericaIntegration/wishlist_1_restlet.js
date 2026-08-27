function createObjects(request) {
    //Main call for REST
    nlapiLogExecution('DEBUG', 'REQUEST', JSON.stringify(request));
    var parentId = createParentRecord(request);
    nlapiLogExecution('DEBUG', 'PARENT_ID', parentId);
    var items = request['Items'];
    for (var i = 0; i < items.length; i++){
        var item = items[i];
        var childId = createChildRecord(item, parentId);
        nlapiLogExecution('DEBUG', 'CHILD_ID', childId);
    }

    try {
        createSchedulerRecord();
    }

    catch(err) {
        nlapiLogExecution('DEBUG', 'ERROR_SCHEDULING_ACTION');
        nlapiLogExecution('DEBUG', err.name, err.message);
    }

    return {'result': 'success'};

}


function scheduleCreateItemsAndQuotes() {
    //Scan for any new imported objects
    //Check each line item and verify the line item exists
    //If not, create the item and mark it processed
    //Eventually search for items will return none and sale can be created

    //For each quote/order
    var parentObjects = findParentObjects();
    for (var i = 0; i < parentObjects.length; i++){
        var parentObject = parentObjects[i];
        var parentId = parentObject['parent_id'];

        //Find line items
        var childObjects = findChildObjects(parentId);
        for (var ci = 0; ci < childObjects.length; ci++){
            if (nlapiGetContext().getRemainingUsage() < 120) {
                nlapiLogExecution('DEBUG', 'CANCEL_CHILD_CREATION', 'Get Remaining Usage too low');
                return;
            }
            var childObject = childObjects[ci];
            var childId = childObject['child_id'];
            var netsuiteItemId = childObject['netsuite_item_id'];
            if (netsuiteItemId) {
                continue;
            }

            //Manufacturer code used to do lookup
            var manufacturerNumber = childObject['custitem_manufacturer_number'];

            //Check if the item exists
            var itemId = findProduct(manufacturerNumber);
            if (!itemId) {
                itemId = createItem(childObject);
                nlapiLogExecution('DEBUG', 'CREATED_ITEM', itemId);
            }

            childObjects[ci]['netsuite_item_id'] = itemId;

            //Set this item is processed
            nlapiSubmitField('customrecord_child_api_object', childId, 'custrecord_netsuite_item_id', itemId);
            nlapiLogExecution('DEBUG', 'SET_CHILD_ITEM_ID', 'Item ID is set');
        }

        if (nlapiGetContext().getRemainingUsage() < 100) {
            nlapiLogExecution('DEBUG', 'CANCEL_SALE_CREATION', 'Get Remaining Usage too low');
            return;
        }

        nlapiLogExecution('DEBUG', 'CREATING_ORDER', '');
        saleId = createSalesOrder(parentObject, childObjects);
        nlapiLogExecution('DEBUG', 'CREATED_SALE', saleId);

        nlapiSubmitField('customrecord_parent_api_object', parentId, 'custrecord_sale', saleId);
    }
}


function createSchedulerRecord() {
    var schedulerRecord = nlapiCreateRecord('customrecord_zastro_api_scheduler');
    var schedulerRecordId = nlapiSubmitRecord(schedulerRecord, true, true);
}


function createItem(object) {
    nlapiLogExecution('DEBUG', 'CREATING_ITEM', '');
    var item = nlapiCreateRecord('inventoryitem');
    var keys = Object.keys(object);
    for (var i = 0; i < keys.length; i++){
        var key = keys[i];
        item.setFieldValue(key, object[key]);
        if (key == 'custitem_list_price') {
            item.setLineItemValue('price', 'price_1_', 1, object[key]);
        }

        if (key == 'custitem_manufacturer_name') {
            var vendorId = findVendorId(object[key]);
            if (!vendorId) {
                vendorId = findVendorMappingId(object[key]);
            }
            if (vendorId) {
                item.setFieldValue('vendor', vendorId);
            }
        }
    }

    var itemId = nlapiSubmitRecord(item, true, true);
    return itemId;
}


function createCustomer(object) {
    var customer = nlapiCreateRecord('customer');

    customer.setFieldValue('email', object['Email']);

    var firstName = object['First Name'];
    var lastName = object['Last Name']
    var customerIdentifier = '';

    if (firstName && lastName) {
        customerIdentifier = lastName + ', ' + firstName;
    }

    else if (firstName) {
        customerIdentifier = firstName;
    }

    else {
        customerIdentifier = lastName;
    }

    customer.setFieldValue('entityid', customerIdentifier);

    if (lastName && !firstName){
        customer.setFieldValue('isperson', 'F');
        customer.setFieldValue('lastname', lastName);
    }

    else if (firstName && lastName) {
        customer.setFieldValue('firstname', firstName);
        customer.setFieldValue('lastname', lastName);
    }

    else {
        customer.setFieldValue('firstname', firstName);
    }

    customer.selectNewLineItem('addressbook');
    //set subrecord fields
    customer.setCurrentLineItemValue('addressbook', 'country', 'US');
    customer.setCurrentLineItemValue('addressbook', 'state', object['Billing State']);
    customer.setCurrentLineItemValue('addressbook', 'zip', object['Billing Zip']);

    if (object.hasOwnProperty('addressee')) {
        customer.setCurrentLineItemValue('addressbook', 'addressee', object['First Name'] + ' ' + object['Last Name']);
    }

    customer.setCurrentLineItemValue('addressbook', 'addr1', object['Billing Address']);

    customer.setCurrentLineItemValue('addressbook', 'city', object['Billing City']);

    if (object.hasOwnProperty('Phone')) {
        customer.setFieldValue('phone', object['Phone']);
        customer.setCurrentLineItemValue('addressbook', 'addrphone', object['Phone']);
    }

    customer.commitLineItem('addressbook');

    nlapiLogExecution('DEBUG', 'firstname', customer.getFieldValue('firstname'));
    var customerId = nlapiSubmitRecord(customer, true, true);
    nlapiLogExecution('DEBUG', 'CUSTOMER_ID', customerId);
    return customerId;
}


function createSalesOrder(parentObject, childObjects) {

    var wishlistName = '';
    if (parentObject['transaction_type'] == 'wishlist') {
        var transactionType = 'estimate';
    }

    else {
        var transactionType = 'salesorder';
    }

    var sale = nlapiCreateRecord(transactionType);
    //Set title on quotes/wishlist
    if (parentObject['transaction_type'] == 'wishlist') {
        sale.setFieldValue('memo', parentObject['wishlist_name']);
    }
    //Set payment method on sales order
    else {
        sale.setFieldValue('paymentmethod', 10);
      	sale.setFieldValue('custbody_fil_ite_so', 'T');
      	sale.setFieldValue('custbody_fil_web_based_order', 'T');
    }
	//sale.setFieldValue('custrecord_cost_2',4)
    sale.setFieldValue('entity', parentObject['customer_id']);
  sale.setFieldValue('class',4)
    for (var i = 0; i < childObjects.length; i++){
        var line = childObjects[i];
            sale.selectNewLineItem('item');
                sale.setCurrentLineItemValue('item', 'item', line['netsuite_item_id']);
                sale.setCurrentLineItemValue('item', 'quantity', line['quantity']);
                sale.setCurrentLineItemValue('item', 'price', -1);
                //sale.setCurrentLineItemValue('item', 'pricelevel', -1);
                sale.setCurrentLineItemValue('item', 'rate', line['selling_price']);
                sale.setCurrentLineItemValue('item', 'custcol_cl_item_notes', line['sale_line_notes']);
                sale.setCurrentLineItemValue('item', 'custcolcustcol_zastro_room_location', line['line_location']);
            sale.commitLineItem('item');

    }

nlapiLogExecution('DEBUG', 'GOING_TO_SAVE');
    var saleId = nlapiSubmitRecord(sale, true, true);
    return saleId;
}


function createParentRecord(object) {
    var customerId;

    //TODO: This seems kind of sloppy
    var customerIdentifier;
    var lastName = object['Last Name'];
    if (lastName){
        customerIdentifier = object['Last Name'] + ', ' + object['First Name'];
    }
    else {
        customerIdentifier = object['First Name'];
    }

    //1. Search by Email
    customerId = findCustomerByEmail(object['Email']);

    //2. Search by ID
    if (!customerId) {
        customerId = findCustomerById(customerIdentifier);
    }

    //3. Create customer
    if (!customerId) {
        try {
            customerId = createCustomer(object);
        }

        //4. Set error customer
        catch(err) {
            nlapiLogExecution('DEBUG', 'ERROR_CREATING_CUSTOMER');
            nlapiLogExecution('DEBUG', err.name, err.message);
            customerId = 10101
        }
    }

    var record = nlapiCreateRecord('customrecord_parent_api_object');

    record.setFieldValue('custrecord_firstname', object['First Name']);
    record.setFieldValue('custrecord_wishlist_name', object['Wishlist Name']);
    record.setFieldValue('custrecord_lastname', object['Last Name']);
    record.setFieldValue('custrecord_phone', object['Phone']);
    record.setFieldValue('custrecord_email', object['Email']);
    record.setFieldValue('custrecord_salesperson', object['Salesperson']);
    record.setFieldValue('custrecord_store_location', object['Store Location']);
    record.setFieldValue('custrecord_wishlist_name', object['Wishlist Name']);
    record.setFieldValue('custrecord_comment', object['Comment']);
    record.setFieldValue('custrecord_shipping_city', object['Shipping City']);
    record.setFieldValue('custrecord_shipping_state', object['Shipping State']);
    record.setFieldValue('custrecord_shipping_zip', object['Shipping Zip']);
    record.setFieldValue('custrecord_shipping_address', object['Shipping Address']);
    record.setFieldValue('custrecord_billing_address', object['Billing Address']);
    record.setFieldValue('custrecord_billing_city', object['Billing City']);
    record.setFieldValue('custrecord_billing_state', object['Billing State']);
    record.setFieldValue('custrecord_billing_zip', object['Billing Zip']);
    record.setFieldValue('custrecord_transaction_type', object['Trans Type']);
    record.setFieldValue('custrecord_customer_id', customerId);

    var recordId = nlapiSubmitRecord(record);
    return recordId;
}


function createChildRecord(object, parentId) {
    var bulbsIncluded = object['Bulbs Included'];
    if (bulbsIncluded == 'Yes') {
        bulbsIncluded = 'T';
    }

    else {
        bulbsIncluded = 'F';
    }

    var record = nlapiCreateRecord('customrecord_child_api_object');
    record.setFieldValue('custrecord_quantity', object['Quantity']);
    record.setFieldValue('custrecord_selling_price', object['Selling Price']);
    record.setFieldValue('custrecord_notes', object['Notes']);
    record.setFieldValue('custrecord_room_location', object['Location']);
    record.setFieldValue('custrecord_manufacturer_number', object['Manufacturer Number']);
    record.setFieldValue('custrecord_manufacturer_name', object['Manufacturer Name']);
    record.setFieldValue('custrecord_product_name', object['Product Name']);
    record.setFieldValue('custrecord_cost_2', object['Cost']);
    record.setFieldValue('custrecord_price', object['Price']);
    record.setFieldValue('custrecord_collection', object['Collection']);
    record.setFieldValue('custrecord_product_url', object['Product URL']);
    record.setFieldValue('custrecord_length', object['Length']);
    record.setFieldValue('custrecord_width', object['Width']);
    record.setFieldValue('custrecord_height', object['Height']);
    record.setFieldValue('custrecord_bulbs_included', bulbsIncluded);
    record.setFieldValue('custrecord_number_bulbs', object['Number of Bulbs']);
    record.setFieldValue('custrecord_max_wattage', object['Max Wattage']);
    record.setFieldValue('custrecord_bulb_base', object['Bulb Base']);
    record.setFieldValue('custrecord_light_source', object['Light Source']);
    record.setFieldValue('custrecord_color_temperature', object['Color Temperature']);
    record.setFieldValue('custrecord_cri', object['CRI']);
    record.setFieldValue('custrecord_voltage', object['Voltage']);
    record.setFieldValue('custrecord_fan_airflow', object['Fan Airflow']);
    record.setFieldValue('custrecord_blade_qty', object['Blade Qty']);
    record.setFieldValue('custrecord_light_kit', object['Light Kit']);
    record.setFieldValue('custrecord_parent_object', parentId);

    var recordId = nlapiSubmitRecord(record);
    return recordId;
}


function findCustomerByEmail(email) {
    var filters = new Array();
    filters[0] = new nlobjSearchFilter('email', null, 'is', email);

    var columns = new Array();
    columns[0] = new nlobjSearchColumn('internalid', null, null);

    var search = nlapiCreateSearch('customer', filters, columns);
    var resultSet = _getPagedResults( search.runSearch() );
    var resultslength = resultSet.length;

    for (var i = 0; i < resultslength; i++ ) {
        var searchresult = resultSet[i];
        var cols = searchresult.getAllColumns();
        var internalId = searchresult.getValue(cols[0]);
        return internalId;
    }

    return false;
}


function findCustomerById(id) {
    var filters = new Array();
    filters[0] = new nlobjSearchFilter('entityid', null, 'is', id);

    var columns = new Array();
    columns[0] = new nlobjSearchColumn('internalid', null, null);

    var search = nlapiCreateSearch('customer', filters, columns);
    var resultSet = _getPagedResults( search.runSearch() );
    var resultslength = resultSet.length;

    for (var i = 0; i < resultslength; i++ ) {
        var searchresult = resultSet[i];
        var cols = searchresult.getAllColumns();
        var internalId = searchresult.getValue(cols[0]);
        return internalId;
    }

    return false;
}


function findOrder(tranid) {
    var filters = new Array();
    filters[0] = new nlobjSearchFilter('tranid', null, 'is', tranid);

    var columns = new Array();
    columns[0] = new nlobjSearchColumn('internalid', null, null);

    var search = nlapiCreateSearch('salesorder', filters, columns);
    var resultSet = _getPagedResults( search.runSearch() );
    var resultslength = resultSet.length;

    for (var i = 0; i < resultslength; i++ ) {
        var searchresult = resultSet[i];
        var cols = searchresult.getAllColumns();
        var orderId = searchresult.getValue(cols[0]);
        return orderId;

    }

    return false;
}


function findProduct(manufacturerNumber) {
    var filters = new Array();
    filters[0] = new nlobjSearchFilter('name', null, 'is', manufacturerNumber);

    var columns = new Array();
    columns[0] = new nlobjSearchColumn('internalid', null, null);

    var search = nlapiCreateSearch('item', filters, columns);
    var resultSet = _getPagedResults( search.runSearch() );
    var resultslength = resultSet.length;

    for (var i = 0; i < resultslength; i++ ) {
        var searchresult = resultSet[i];
        var cols = searchresult.getAllColumns();
        var internalId = searchresult.getValue(cols[0]);
        return internalId;
    }

    return false;
}


function findParentObjects() {
    var filters = new Array();
    filters[0] = new nlobjSearchFilter('custrecord_sale', null, 'anyof', ["@NONE@"]);
      filters[1] = new nlobjSearchFilter('isinactive', null, 'is', 'F');

    var columns = new Array();
    columns[0] = new nlobjSearchColumn('internalid', null, null);
    columns[1] = new nlobjSearchColumn('custrecord_firstname', null, null);
    columns[2] = new nlobjSearchColumn('custrecord_lastname', null, null);
    columns[3] = new nlobjSearchColumn('custrecord_email', null, null);
    columns[4] = new nlobjSearchColumn('custrecord_salesperson', null, null);
    columns[5] = new nlobjSearchColumn('custrecord_store_location', null, null);
    columns[6] = new nlobjSearchColumn('custrecord_comment', null, null);
    columns[7] = new nlobjSearchColumn('custrecord_phone', null, null);
    columns[8] = new nlobjSearchColumn('custrecord_wishlist_name', null, null);
    columns[9] = new nlobjSearchColumn('custrecord_transaction_type', null, null);
    columns[10] = new nlobjSearchColumn('custrecord_customer_id', null, null);
    columns[11] = new nlobjSearchColumn('custrecord_shipping_city', null, null);
    columns[12] = new nlobjSearchColumn('custrecord_shipping_state', null, null);
    columns[13] = new nlobjSearchColumn('custrecord_shipping_zip', null, null);
    columns[14] = new nlobjSearchColumn('custrecord_shipping_address', null, null);
    columns[15] = new nlobjSearchColumn('custrecord_billing_address', null, null);
    columns[16] = new nlobjSearchColumn('custrecord_billing_city', null, null);
    columns[17] = new nlobjSearchColumn('custrecord_billing_state', null, null);
    columns[18] = new nlobjSearchColumn('custrecord_billing_zip', null, null);

    var search = nlapiCreateSearch('customrecord_parent_api_object', filters, columns);
    var resultSet = _getPagedResults( search.runSearch() );
    var resultslength = resultSet.length;

    var res = [];
    for (var i = 0; i < resultslength; i++ ) {
        var searchresult = resultSet[i];
        var cols = searchresult.getAllColumns();
        var dict = {
            'parent_id': searchresult.getValue(cols[0]),
            'firstname': searchresult.getValue(cols[1]),
            'lastname': searchresult.getValue(cols[2]),
            'email': searchresult.getValue(cols[3]),
            'salesperson': searchresult.getValue(cols[4]),
            'store_location': searchresult.getValue(cols[5]),
            'comment': searchresult.getValue(cols[6]),
            'phone': searchresult.getValue(cols[7]),
            'wishlist_name': searchresult.getValue(cols[8]),
            'transaction_type': searchresult.getValue(cols[9]),
            'customer_id': searchresult.getValue(cols[10]),
            'shipping_city': searchresult.getValue(cols[11]),
            'shipping_state': searchresult.getValue(cols[12]),
            'shipping_zip': searchresult.getValue(cols[13]),
            'shipping_address': searchresult.getValue(cols[14]),
            'billing_address': searchresult.getValue(cols[15]),
            'billing_city': searchresult.getValue(cols[16]),
            'billing_state': searchresult.getValue(cols[17]),
            'billing_zip': searchresult.getValue(cols[18]),
        }
        res.push(dict);

    }

    return res;
}


function findChildObjects(parentId) {
    var filters = new Array();
    filters[0] = new nlobjSearchFilter('custrecord_parent_object', null, 'is', parentId);

    var columns = new Array();
    columns[0] = new nlobjSearchColumn('custrecord_manufacturer_name', null, null);
    columns[1] = new nlobjSearchColumn('custrecord_cost_2', null, null);
    columns[2] = new nlobjSearchColumn('custrecord_voltage', null, null);
    columns[3] = new nlobjSearchColumn('custrecord_product_name', null, null);
    columns[4] = new nlobjSearchColumn('custrecord_manufacturer_number', null, null);
    columns[5] = new nlobjSearchColumn('custrecord_selling_price', null, null);
    columns[6] = new nlobjSearchColumn('custrecord_price', null, null);
    columns[7] = new nlobjSearchColumn('custrecord_product_url', null, null);
    columns[8] = new nlobjSearchColumn('custrecord_quantity', null, null);
    columns[9] = new nlobjSearchColumn('custrecord_netsuite_item_id', null, null);
    columns[10] = new nlobjSearchColumn('custrecord_notes', null, null);
    columns[11] = new nlobjSearchColumn('custrecord_room_location', null, null);
    columns[12] = new nlobjSearchColumn('custrecord_collection', null, null);
    columns[13] = new nlobjSearchColumn('custrecord_length', null, null);
    columns[14] = new nlobjSearchColumn('custrecord_width', null, null);
    columns[15] = new nlobjSearchColumn('custrecord_height', null, null);
    columns[16] = new nlobjSearchColumn('custrecord_bulbs_included', null, null);
    columns[17] = new nlobjSearchColumn('custrecord_number_bulbs', null, null);
    columns[18] = new nlobjSearchColumn('custrecord_max_wattage', null, null);
    columns[19] = new nlobjSearchColumn('custrecord_bulb_base', null, null);
    columns[20] = new nlobjSearchColumn('custrecord_light_source', null, null);
    columns[21] = new nlobjSearchColumn('custrecord_color_temperature', null, null);
    columns[22] = new nlobjSearchColumn('custrecord_cri', null, null);
    columns[23] = new nlobjSearchColumn('custrecord_fan_airflow', null, null);
    columns[24] = new nlobjSearchColumn('custrecord_blade_qty', null, null);
    columns[25] = new nlobjSearchColumn('custrecord_light_kit', null, null);
    columns[26] = new nlobjSearchColumn('internalid', null, null);

    var search = nlapiCreateSearch('customrecord_child_api_object', filters, columns);
    var resultSet = _getPagedResults( search.runSearch() );
    var resultslength = resultSet.length;
    var res = [];
    var itemIds = [];

    for (var i = 0; i < resultslength; i++ ) {
        var searchresult = resultSet[i];
        var cols = searchresult.getAllColumns();
        var dict = {
            'custitem_manufacturer_name': searchresult.getValue(cols[0]),
            'cost': searchresult.getValue(cols[1]),
            'custitem_voltage': searchresult.getValue(cols[2]),
            'salesdescription': searchresult.getValue(cols[3]),
            'custitem_manufacturer_number': searchresult.getValue(cols[4]),
            'itemid': searchresult.getValue(cols[4]),
            'selling_price': searchresult.getValue(cols[5]),
            'custitem_list_price': searchresult.getValue(cols[6]),
            'custitem_product_url': searchresult.getValue(cols[7]),
            'quantity': searchresult.getValue(cols[8]),
            'netsuite_item_id': searchresult.getValue(cols[9]),
            'sale_line_notes': searchresult.getValue(cols[10]),
            'line_location': searchresult.getValue(cols[11]),
            'custitem_collection': searchresult.getValue(cols[12]),
            'custitem_length': searchresult.getValue(cols[13]),
            'custitem_width': searchresult.getValue(cols[14]),
            'custitem_height': searchresult.getValue(cols[15]),
            'custitem_bulbs_included': searchresult.getValue(cols[16]),
            'custitem_number_of_bulbs': searchresult.getValue(cols[17]),
            'custitem_max_wattage': searchresult.getValue(cols[18]),
            'custitem_bulb_base': searchresult.getValue(cols[19]),
            'custitem_light_source': searchresult.getValue(cols[20]),
            'custitem_color_temperature': searchresult.getValue(cols[21]),
            'custitem_cri': searchresult.getValue(cols[22]),
            'custitem_fan_airflow': searchresult.getValue(cols[23]),
            'custitem_blade_qty': searchresult.getValue(cols[24]),
            'custitem_light_kit': searchresult.getValue(cols[25]),
            'child_id': searchresult.getValue(cols[26]),
          'purchasedescription': searchresult.getValue(cols[3]),
        }
        res.push(dict);

        var netsuiteItemId = searchresult.getValue(cols[9]);
        nlapiLogExecution('DEBUG', netsuiteItemId);
        if (netsuiteItemId) {
            itemIds.push(netsuiteItemId);
        }
    }

    nlapiLogExecution('DEBUG', 'ITEM_IDS', itemIds);
    if (itemIds.length > 0) {
        findAndResetInactiveItems(itemIds);
    }

    return res;
}


function findAndResetInactiveItems(netsuiteIds) {
    var filters = new Array();
    filters[0] = new nlobjSearchFilter('internalid', null, 'anyof', netsuiteIds);
    filters[1] = new nlobjSearchFilter('isinactive', null, 'is', 'T');

    var columns = new Array();
    columns[0] = new nlobjSearchColumn('internalid', null, null);


    var search = nlapiCreateSearch('item', filters, columns);
    var resultSet = _getPagedResults( search.runSearch() );
    var resultslength = resultSet.length;
    for (var i = 0; i < resultslength; i++ ) {
        var searchresult = resultSet[i];
        var cols = searchresult.getAllColumns();
        var internalId = searchresult.getValue(cols[0]);
        var item = nlapiLoadRecord('inventoryitem', internalId);
        item.setFieldValue('isinactive', 'F');
        nlapiSubmitRecord(item);
    }

    return true;
}


function findVendorMappingId(vendorName) {
    var filters = new Array();
    filters[0] = new nlobjSearchFilter('custrecord_lights_america_name', null, 'is', vendorName);

    var columns = new Array();
    columns[0] = new nlobjSearchColumn('custrecord_zastro_mm_vendor', null, null);

    var search = nlapiCreateSearch('customrecord_manufacturer_mapping', filters, columns);
    var resultSet = _getPagedResults( search.runSearch() );
    var resultslength = resultSet.length;

    for (var i = 0; i < resultslength; i++ ) {
        var searchresult = resultSet[i];
        var cols = searchresult.getAllColumns();
        var internalId = searchresult.getValue(cols[0]);
        return internalId;
    }

    return false;
}


function findVendorId(vendorName) {
    var filters = new Array();
    filters[0] = new nlobjSearchFilter('entityid', null, 'is', vendorName);

    var columns = new Array();
    columns[0] = new nlobjSearchColumn('internalid', null, null);

    var search = nlapiCreateSearch('vendor', filters, columns);
    var resultSet = _getPagedResults( search.runSearch() );
    var resultslength = resultSet.length;

    for (var i = 0; i < resultslength; i++ ) {
        var searchresult = resultSet[i];
        var cols = searchresult.getAllColumns();
        var internalId = searchresult.getValue(cols[0]);
        return internalId;
    }

    return false;
}


function _getPagedResults(results) {
    var length = 0;
    var count = 0, pageSize = 700;
    var currentIndex = 0;

    var resultSet = new Array();

    do {
        searchChunk = results.getResults(currentIndex, currentIndex + pageSize);
        count = searchChunk.length;
        for ( var i = 0; i < count; i++) {
            resultSet.push(searchChunk[i]);
        }

        currentIndex += pageSize;
        length += count;
    }

    while(count == pageSize);
    return resultSet;
}