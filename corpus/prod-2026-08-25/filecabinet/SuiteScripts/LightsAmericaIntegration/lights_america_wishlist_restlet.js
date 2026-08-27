/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */
 define(
    [
        'N/record', 'N/log', 'N/error', 'N/search', 'N/task'
    ],
    function (record, log, error, search, task) {
        function post(request) {
            //Create the Lights America Wishlist endpoint
            log.debug('REQUEST', request);
          if (request && request.test === 'hello') {
                return '200 - Test Connection Successful';
            }

            var configRecord = getLightsWishlistConfig();
            var parentId = createLightsWishlist(configRecord, request);
            log.debug('PARENT_ID', parentId);

            var items = request['Items'];
            for (var i = 0; i < items.length; i++){
                var item = items[i];
                var childId = createLightsWishlistItem(configRecord, item, parentId);
            }

            //Once storing custom objects is complete, trigger the scheduler indirectly to avoid permission issues.
            try {
                var schedulerRecord = record.create({
                    type: 'customrecord_zastro_api_scheduler',
                    isDynamic: true
                });

                var schedulerRecordId = schedulerRecord.save();
            }

            catch (err) {
                log.debug('ERROR_SCHEDULING_RESTLET_PROCESSOR', '');
                log.debug(err.name, err.message);
            }

            return {'result': 'success'};
        }


        function checkUndefined(stringValue) {
            if (stringValue == 'undefined') {
                return false;
            }

            return stringValue;
        }


        function getOrCreateCustomer(configRecord, object) {
            log.debug('GET_OR_CREATE_CUSTOMER', '');

            var customerId;

            var lookupEmail = configRecord.getValue({
                fieldId: 'custrecord_zastro_lights_match_email'
            });

            var lookupId = configRecord.getValue({
                fieldId: 'custrecord_zastro_lights_match_id'
            });

            var phoneAsId = configRecord.getValue({
                fieldId: 'custrecord_zastro_lights_match_phone'
            });

            var customerFallback = configRecord.getValue({
                fieldId: 'custrecord_zastro_lights_cust_fallback'
            });

            var firstName = object['First Name'];
            var lastName = object['Last Name'];
            var email = object['Email'];
            var phone = object['Phone'];

            log.debug('CUSTOMER_EMAIL', email);

            log.debug('BUILDING_IDENTIFIER', 'Checking Strategy');
            var customerIdentifier;

            //Phone number can be used as an externalid.
            if (phoneAsId && phone) {
                log.debug('PHONE_AS_ID_CONFIG', 'Configuration is set to use phone number as customer id');
                //If we match id with phone number, strip out any non digit values
                customerIdentifier = phone;
                var numberPattern = /\d+/g;
                customerIdentifier = customerIdentifier.match(numberPattern);

                if (customerIdentifier && customerIdentifier.length > 1) {
                    customerIdentifier = customerIdentifier.join('');
                }
            }

            else if (firstName) {
                log.debug('NAME_AS_ID_CONFIG', 'Configuration is defaulted to use name as id');
                if (lastName){
                    customerIdentifier = lastName + ', ' + firstName;
                }
                else {
                    customerIdentifier = firstName;
                }
            }

            else {
                log.error('NO_CUSTOMER_IDENTIFIER_STRING', 'Config does not allow phone as id and there is no firstname. Finding customer by id or creating the customer is not possible.');
            }

            log.debug('BUILT_CUSTOMER_ID', customerIdentifier);

            //1. Search by ID
            if (!customerId && lookupId && customerIdentifier) {
                log.debug('CONFIG_LOOKUP_ID', 'Configuration allows lookup by ID');
                customerId = findCustomerById(customerIdentifier);
            }

            //2. Search by Email (If Enabled)
            //If a customer is not found using id, see if an account exists with the same email
            if (!customerId && lookupEmail && email) {
                log.debug('CONFIG_LOOKUP_EMAIL', 'Configuration allows lookup by email');
                customerId = findCustomerByEmail(email);
            }

            //3. Create customer
            if (!customerId && customerIdentifier) {
                log.debug('NO_CUSTOMER_MATCH_FOUND', 'Creating a customer');
                try {
                    customerId = createCustomer(configRecord, customerIdentifier, object);
                }
        
                //4. Set error customer
                catch(err) {
                    log.error('ERROR_CREATING_CUSTOMER', '');
                    log.error(err.name, err.message);
                    if (customerFallback) {
                        customerId = customerFallback;
                    }
                }
            }

            if (!customerId && !customerIdentifier) {
                log.error('COULD_NOT_CREATE_ACCOUNT_NO_IDENTIFIER', 'Could not create a customer because no identifier was available');
            }

            return customerId;
        }


        function createLightsWishlist(configRecord, object) {
            log.debug('CREATE_LIGHTS_WISHLIST', '');

            var customerId = getOrCreateCustomer(configRecord, object);

            var wishlist = record.create({
                type: 'customrecord_parent_api_object'
            });

            wishlist.setValue({
                fieldId: 'custrecord_firstname',
                value: object['First Name']
            }).setValue({
                fieldId: 'custrecord_wishlist_name',
                value: object['Wishlist Name']
            }).setValue({
                fieldId: 'custrecord_lastname',
                value: object['Last Name']
            }).setValue({
                fieldId: 'custrecord_phone',
                value: object['Phone']
            }).setValue({
                fieldId: 'custrecord_email',
                value: object['Email']
            }).setValue({
                fieldId: 'custrecord_store_location',
                value: object['Store Location']
            }).setValue({
                fieldId: 'custrecord_comment',
                value: object['Comment']
            }).setValue({
                fieldId: 'custrecord_shipping_city',
                value: object['Shipping City']
            }).setValue({
                fieldId: 'custrecord_shipping_state',
                value: object['Shipping State']
            }).setValue({
                fieldId: 'custrecord_shipping_zip',
                value: object['Shipping Zip']
            }).setValue({
                fieldId: 'custrecord_shipping_address',
                value: object['Shipping Address']
            }).setValue({
                fieldId: 'custrecord_billing_address',
                value: object['Billing Address']
            }).setValue({
                fieldId: 'custrecord_billing_city',
                value: object['Billing City']
            }).setValue({
                fieldId: 'custrecord_billing_state',
                value: object['Billing State']
            }).setValue({
                fieldId: 'custrecord_billing_zip',
                value: object['Billing Zip']
            }).setValue({
                fieldId: 'custrecord_transaction_type',
                value: object['Trans Type']
            });

            var salesPerson = object['Sales Person'];
            if (salesPerson && salesPerson != 'undefined') {
                wishlist.setValue({
                    fieldId: 'custrecord_salesperson',
                    value: salesPerson
                });
            }

            if (customerId) {
                wishlist.setValue({
                    fieldId: 'custrecord_customer_id',
                    value: customerId
                });
            }

            var wishlistId = wishlist.save();
            return wishlistId;
        }


        function createLightsWishlistItem(configRecord, object, parentId) {
            var bulbsIncluded = object['Bulbs Included'];
            if (bulbsIncluded == 'Yes') {
                bulbsIncluded = true;
            }

            else {
                bulbsIncluded = false;
            }

            var wishlistItem = record.create({
                type: 'customrecord_child_api_object'
            });

            //TODO: Consider this being mapped with customer mapping. Maybe a target field parameter.
            //Try to maintain only 1 mapping.
            wishlistItem.setValue({
                fieldId: 'custrecord_wishlist_import_quantity', 
                value: object['Quantity']
            }).setValue({
                fieldId: 'custrecord_selling_price', 
                value: object['Selling Price']
            }).setValue({
                fieldId: 'custrecord_notes', 
                value: object['Notes']
            }).setValue({
                fieldId: 'custrecord_room_location', 
                value: object['Location']
            }).setValue({
                fieldId: 'custrecord_manufacturer_number', 
                value: object['Manufacturer Number']
            }).setValue({
                fieldId: 'custrecord_manufacturer_name', 
                value: object['Manufacturer Name']
            }).setValue({
                fieldId: 'custrecord_product_name', 
                value: object['Product Name']
            }).setValue({
                fieldId: 'custrecord_cost_2', 
                value: object['Cost']
            }).setValue({
                fieldId: 'custrecord_price', 
                value: object['Price']
            }).setValue({
                fieldId: 'custrecord_collection', 
                value: object['Collection']
            }).setValue({
                fieldId: 'custrecord_product_url', 
                value: object['Product URL']
            }).setValue({
                fieldId: 'custrecord_length', 
                value: object['Length']
            }).setValue({
                fieldId: 'custrecord_width', 
                value: object['Width']
            }).setValue({
                fieldId: 'custrecord_height', 
                value: object['Height']
            }).setValue({
                fieldId: 'custrecord_bulbs_included', 
                value: bulbsIncluded
            }).setValue({
                fieldId: 'custrecord_number_bulbs', 
                value: object['Number of Bulbs']
            }).setValue({
                fieldId: 'custrecord_max_wattage', 
                value: object['Max Wattage']
            }).setValue({
                fieldId: 'custrecord_bulb_base', 
                value: object['Bulb Base']
            }).setValue({
                fieldId: 'custrecord_light_source', 
                value: object['Light Source']
            }).setValue({
                fieldId: 'custrecord_color_temperature', 
                value: object['Color Temperature']
            }).setValue({
                fieldId: 'custrecord_cri', 
                value: object['CRI']
            }).setValue({
                fieldId: 'custrecord_voltage', 
                value: object['Voltage']
            }).setValue({
                fieldId: 'custrecord_fan_airflow', 
                value: object['Fan Airflow']
            }).setValue({
                fieldId: 'custrecord_blade_qty', 
                value: object['Blade Qty']
            }).setValue({
                fieldId: 'custrecord_light_kit', 
                value: object['Light Kit']
            }).setValue({
                fieldId: 'custrecord_parent_object', 
                value: parentId
            });

            var wishlistItemId = wishlistItem.save();
            return wishlistItemId;
        }


        function findCustomerByEmail(email) {
            var customerId;
            var customerSearch = search.create({
                type: "customer",
                filters:
                    [
                        ["email", "is", email]
                    ],
                columns:
                    [
                        "internalid"
                    ]
            });

            customerSearch.run().each(function (result) {
                customerId = result.getValue({name: 'internalid'});
                return false;
            });

            return customerId;
        }


        function findCustomerById(id) {
            var customerId;
            var customerSearch = search.create({
                type: "customer",
                filters:
                    [
                        ["entityid", "is", id]
                    ],
                columns:
                    [
                        "internalid"
                    ]
            });

            customerSearch.run().each(function (result) {
                customerId = result.getValue({name: 'internalid'});
                return false;
            });

            return customerId;
        }


        function createCustomer(configRecord, customerIdentifier, object) {

            var subsidiaryId = configRecord.getValue({
                fieldId: 'custrecord_zastro_lights_la_sub_id'
            });

            var customerFormId = configRecord.getValue({
                fieldId: 'custrecord_zastro_lights_customer_form'
            });

            var customer = record.create({
                type: 'customer',
                isDynamic: true
            });

            if (customerFormId) {
                customer.setValue({
                    fieldId: 'customform',
                    value: customerFormId
                });
            }

            //TODO: Check if allow override is checked?
            //Check if the auto generated entity id field is checked
            var autoGenerateChecked = customer.getValue({
                fieldId: 'autoname'
            });

            if (autoGenerateChecked) {
                customer.setValue({
                    fieldId: 'autoname',
                    value: false
                });
            }

            customer.setValue({
                fieldId: 'entityid',
                value: customerIdentifier
            });

            if (subsidiaryId) {
                customer.setValue({
                    fieldId: 'subsidiary',
                    value: subsidiaryId
                });
            }

            customer.setValue({
                fieldId: 'email',
                value: object['Email']
            });

            var firstName = object['First Name'];
            var lastName = object['Last Name'];

            //TODO: Define proper usage of companyname, altname
            customer.setValue({
                fieldId: 'companyname',
                value: firstName + ' ' + lastName
            });

            customer.setValue({
                fieldId: 'altname',
                value: firstName + ' ' + lastName
            });

            //TODO: Explain why this is done this way.
            if (lastName && !firstName){
                customer.setValue({
                    fieldId: 'isperson',
                    value: false
                }).setValue({
                    fieldId: 'lastname',
                    value: lastName
                });
            }

            else if (firstName && lastName) {
                customer.setValue({
                    fieldId: 'firstname',
                    value: firstName
                }).setValue({
                    fieldId: 'lastname',
                    value: lastName
                });
            }

            else {
                customer.setValue({
                    fieldId: 'firstname',
                    value: firstName
                });
            }

            customer.selectNewLine({
                sublistId: 'addressbook'
            });

            var addressSubrecord = customer.getCurrentSublistSubrecord({
                sublistId: 'addressbook',
                fieldId: 'addressbookaddress'
              });

              addressSubrecord.setValue({
                fieldId: 'country',
                value: 'US'
            }).setValue({
                fieldId: 'state',
                value: object['Billing State']
            }).setValue({
                fieldId: 'zip',
                value: object['Billing Zip']
            });

            if (object.hasOwnProperty('addressee')) {
                addressSubrecord.setValue({
                    fieldId: 'addressee',
                    value: object['First Name'] + ' ' + object['Last Name']
                });
            }

            addressSubrecord.setValue({
                fieldId: 'addr1',
                value: object['Billing Address']
            }).setValue({
                fieldId: 'city',
                value: object['Billing City']
            });

            if (object.hasOwnProperty('Phone')) {
                customer.setValue({
                    fieldId: 'phone',
                    value: object['Phone']
                });

                addressSubrecord.setValue({
                    fieldId: 'addrphone',
                    value: object['Phone']
                });
            }

            customer.commitLine({sublistId: 'addressbook'});

            var customerId = customer.save({
                enableSourcing: false,
                ignoreMandatoryFields : true
            });

            return customerId;
        }


        function getLightsWishlistConfig() {
            var configSearch = search.create({
                type: "customrecord_zastro_lights_wishlist_cfg",
                filters:
                [
                    ["isinactive","isnot", 'T']
                ],
                columns:
                [
                    search.createColumn({
                        name: "internalid",
                    })
                ]
            });
    
            var internalId = '';
            configSearch.run().each(function(result){
                internalId = result.getValue({
                    name: 'internalid',
                });
    
                return false;
            });
    
            var configRecord = record.load({
                type: 'customrecord_zastro_lights_wishlist_cfg',
                id: internalId
            });
    
            return configRecord;
        }


        return {
            post: post,
            getOrCreateCustomer: getOrCreateCustomer,
            getLightsWishlistConfig: getLightsWishlistConfig
        };
    }
);