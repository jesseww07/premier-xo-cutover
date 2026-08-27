/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 *@NScriptType Suitelet
 */
 define(['N/log', 'N/ui/serverWidget', 'N/record', 'N/search', 'N/url', 'N/redirect', 'N/format', 'N/file', 'N/sftp', 'N/email','N/task','N/render', 'N/http',],
 function (log, serverWidget, record, search, url, redirect, format, file, sftp, email, task, render, http) {
     function onRequest(context) {


         if (context.request.method === 'GET') {
             var checking = context.request.parameters
             log.debug('checking', checking);

            
             var getFilter1 = context.request.parameters.custpage_filter_customer; //After the client script fieldchanged (Redirect) this parameter will be available
             var getFilter2 = context.request.parameters.custpage_filter_location; //After the client script fieldchanged (Redirect) this parameter will be available

             log.debug('start?')
             var form = serverWidget.createForm({
                 title: 'Print Showroom Tags'
             });
             log.debug('form?')
             form.clientScriptFileId = 236111; //Attach client script to the suitelet

            
             var filterCustomer = form.addField({
                 id: 'custpage_filter_customer',
                 type: serverWidget.FieldType.SELECT,
                 label: 'Vendor',
                 source: 'vendor',
                 //container: 'filter_group'
             });
           
             log.debug('customer_filter', getFilter1);

             var filterLocation = form.addField({
                id: 'custpage_filter_location',
                type: serverWidget.FieldType.SELECT,
                label: 'Location',
                source: 'location',
                //container: 'filter_group'
            });
          
            log.debug('location_filter', getFilter2);

            
             if (getFilter1) { //if getFilter1 has a value then set defaultValue
                
                 filterCustomer.defaultValue = getFilter1;
             }
             if (getFilter2) { //if getFilter1 has a value then set defaultValue
                
                filterLocation.defaultValue = getFilter2;
            }

             

             var sublist = form.addSublist({
                 id: 'sublist',
                 type: serverWidget.SublistType.LIST,
                 label: 'Select Items to Print'
             });
             sublist.addMarkAllButtons();

             var check = sublist.addField({
                 id: 'custpage_selected',
                 label: 'Select',
                 type: serverWidget.FieldType.CHECKBOX,
             });


             var internalId = sublist.addField({
                 id: 'custpage_internalid',
                 label: 'InternalID',
                 type: serverWidget.FieldType.TEXT,
             });

             var description = sublist.addField({
                 id: 'custpage_description',
                 label: 'Description',
                 type: serverWidget.FieldType.TEXT,
             });

             var price = sublist.addField({
                 id: 'custpage_price',
                 label: 'Price',
                 type: serverWidget.FieldType.TEXT,
             });

             var itemName = sublist.addField({
                 id: 'custpage_itemname',
                 label: 'Item',
                 type: serverWidget.FieldType.TEXT,
             });

             var vendor = sublist.addField({
                 id: 'custpage_vendor',
                 label: 'Vendor',
                 type: serverWidget.FieldType.TEXT,
             });


             var ctr = 0;

             

             var itemSearchObj = search.create({
                type: "item",
                filters:
                [
                    ["locationquantityavailable","greaterthan","0"], 
                    // "AND", 
                    // ["inventorylocation","anyof","5","2","7"], 
                   
                 ],
                columns:
                [
                   search.createColumn({
                      name: "itemid",
                      sort: search.Sort.ASC
                   }),
                   "salesdescription",
                   "baseprice",
                   "vendor",
                   "internalid",
                   "inventorylocation"
                ]
             });

             if (!getFilter1) {
                 log.debug('bbbbbbbb', 'get_filter_present');
                 itemSearchObj.filters.push(
                  myFilter = search.createFilter({
                         name: "vendor",
                         operator: search.Operator.ANYOF,
                         values: 124
                     }));
             }
             else {
                itemSearchObj.filters.push(
                    myFilter = search.createFilter({
                           name: "vendor",
                           operator: search.Operator.ANYOF,
                           values: getFilter1
                       }));
             }
             if (getFilter2) {
                log.debug('get_filter_location');
                itemSearchObj.filters.push(
                 myFilter2 = search.createFilter({
                        name: "inventorylocation",
                        operator: search.Operator.ANYOF,
                        values: getFilter2
                    }));
            }

             var searchResultCount = itemSearchObj.runPaged().count;
             log.debug("itemSearchObj result count",searchResultCount);
             itemSearchObj.run().each(function(result){
            
                 var blank = ' '
                 
                 var intId = result.getValue('internalid')
                 log.debug('intId', intId)

                 sublist.setSublistValue({
                    id: 'custpage_select',
                    line: ctr,
                    value: 'T'
                });

                 try {
                     sublist.setSublistValue({
                         id: 'custpage_internalid',
                         line: ctr,
                         value: intId
                     });
                 }
                 catch (eee) {
                     sublist.setSublistValue({
                         id: 'custpage_internalid',
                         line: ctr,
                         value: intId
                     });
                 }

                 try {
                     sublist.setSublistValue({
                         id: 'custpage_description',
                         line: ctr,
                         value: result.getValue('salesdescription')
                     });
                 }
                 catch (eee) {
                     sublist.setSublistValue({
                         id: 'custpage_description',
                         line: ctr,
                         value: blank
                     });
                 }

                 try {
                     sublist.setSublistValue({
                         id: 'custpage_price',
                         line: ctr,
                         value: result.getValue('baseprice')
                     });
                 }
                 catch (eee) {
                     sublist.setSublistValue({
                         id: 'custpage_price',
                         line: ctr,
                         value: blank
                     });
                 }
                 try {
                    sublist.setSublistValue({
                        id: 'custpage_itemname',
                        line: ctr,
                        value: result.getValue({
                            name: "itemid",
                         })
                    });
                }
                catch (eee) {
                    sublist.setSublistValue({
                        id: 'custpage_itemname',
                        line: ctr,
                        value: blank
                    });
                }try {
                    sublist.setSublistValue({
                        id: 'custpage_vendor',
                        line: ctr,
                        value: result.getText('vendor')
                    });
                }
                catch (eee) {
                    sublist.setSublistValue({
                        id: 'custpage_vendor',
                        line: ctr,
                        value: blank
                    });
                }

                 ctr++
                 //}
                 return true;
             });


             form.addSubmitButton()
             context.response.writePage(form);
         }
         else {

             log.debug('in post')
            
             var custArray = [];
             
             var requestCount = context.request.getLineCount({
                 group: 'sublist'
             });
             log.debug('requestCount', requestCount)
             for (var x = 0; x < requestCount; x++) {
                 var selected = context.request.getSublistValue({
                     group: 'sublist',
                     name: 'custpage_selected',
                     line: x
                 })
                 log.debug('selected', selected)
                 if (selected == 'T') {
                     var id = context.request.getSublistValue({
                         group: 'sublist',
                         name: 'custpage_internalid',
                         line: x
                     })

                          var desc = context.request.getSublistValue({
                              group: 'sublist',
                              name: 'custpage_description',
                              line: x
                          })
                   
                          var price = context.request.getSublistValue({
                              group: 'sublist',
                              name: 'custpage_price',
                              line: x
                          })
                          var item = context.request.getSublistValue({
                              group: 'sublist',
                              name: 'custpage_itemname',
                              line: x
                          })
                          var vendor = context.request.getSublistValue({
                              group: 'sublist',
                              name: 'custpage_vendor',
                              line: x
                          })
                     
                    

                          var returnObj = new Object()
                     
                          returnObj.id = id
                          returnObj.desc = desc
                          returnObj.price = price
                          returnObj.item = item
                          returnObj.vendor = vendor
                     
                     custArray.push(returnObj)
                    
                 }
             }
             log.debug('custArray', custArray);
            

             if (custArray.length > 0) {
                 log.debug('custArray',custArray)
                 log.debug('custArray length',custArray.length)
                let xmlString = generateXml(custArray)
                log.debug('xml string', xmlString)
                context.response.renderPdf({ xmlString: xmlString });            
             }
             
         }
     }

     const generateXml = (items) => {
        var xml = `<?xml version="1.0"?><!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">`
       xml += `<pdf>`
       xml += `<head>`
       xml += `<style type="text/css">`
       xml += `table {`
       xml += `font-size: 9pt;`
       xml += `table-layout: fixed;`
       xml += `width: 100%;`
       xml += `}`
       xml += `th {`
       xml += `font-weight: bold;`
       xml += `font-size: 8pt;`
       xml += `vertical-align: middle;`
       xml += `padding: 5px 6px 3px;`
       xml += `background-color: #e3e3e3;`
       xml += `color: #333333;`
       xml += `padding-bottom: 10px;`
       xml += `padding-top: 10px;`
       xml += `}`
       xml += `td {`
       xml += `padding: 4px 6px;`
       xml += `font-size: 23px;`
       xml += `}`
       xml += `b {`
       xml += `font-weight: bold;`
       xml += `color: #333333;`
       xml += `}`
       xml += `</style>`
       xml += `</head>`
       xml += `<body padding="0.15in 0.0015in 0.0015in 0.0015in" size="Letter">`
       xml += `<table>`
       
       for (let x = 0; x < items.length; x++){
         
               if (x%2==0){
                   if (x +1 < items.length){
        xml += `<tr>`
       xml += `<td padding="0.15in 0.15in 0.0015in 0.15in" align="center" valign="middle" style="max-width:408px; min-width:408px; width: 408px; max-height:320px; min-height:320px; height: 320px;">`
       xml += `Item:`
       xml += `${items[x].item}<br/><br/>${returner(items[x].desc)}<br/><br/>Price:`
       xml += `$${items[x].price}<br/>Vendor: ${items[x].vendor}</td>`
       xml += `<td padding="0.15in 0.15in 0.0015in 0.15in" align="center" valign="middle" style="max-width:408px; min-width:408px; width: 408px; max-height:320px; min-height:320px; height: 320px;">`
       xml += `Item:`
       xml += `${items[x+1].item}<br/><br/>${returner(items[x+1].desc)}<br/><br/>Price:`
       xml += `$${items[x+1].price}<br/>Vendor: ${items[x+1].vendor}</td>`
       xml += `</tr>`
               }
               else {
                xml += `<tr>`
                xml += `<td padding="0.15in 0.15in 0.0015in 0.15in" align="center" valign="middle" style="max-width:408px; min-width:408px; width: 408px; max-height:320px; min-height:320px; height: 320px;">`
                xml += `Item:`
                xml += `${items[x].item}<br/><br/>${returner(items[x].desc)}<br/><br/>Price:`
                xml += `$${items[x].price}<br/>Vendor: ${items[x].vendor}</td>`
                xml += `<td padding="0.15in 0.15in 0.0015in 0.15in" align="center" valign="middle" style="max-width:408px; min-width:408px; width: 408px; max-height:320px; min-height:320px; height: 320px;"></td>`
                xml += `</tr>`
               }
           }
        }
       xml += `</table>`
       xml += `</body>`
       xml += `</pdf>`
        
        return xml
    }

     function returner(word) {
         word = word.replace(/&/g, "&amp;")
         // word = word.replace(/</g, "&lt;")
         // word = word.replace(/>/g, "&gt;")
         // word = word.replace(/'/g, "&#39;")
         word = word.replace(/,/g, "");
         return word
     }
    
     

     return {
         onRequest: onRequest
     };
 });
 