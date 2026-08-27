 /**
 * Generate PO
 *
 * Created, Maintained, and Owned By by Zastro LLC
 *
 * Version    Date            Author           Remarks
 * 1.00       01 April 2020     Kingman  Douglass  
 * 
 * Script 2 of 6
 * On Click on button, generates PO of all unconsolidated line items
 *
 */



function beforeLoad_addButton(type, form) {
    form.setScript('customscript288');
    form.addButton('custpage_consol_po', 'Create PO', 'onclick_callAlert()');
    nlapiLogExecution('debug', 'CLICK')
} 

function onclick_callAlert(){
//on the click on the button

  nlapiLogExecution('debug', 'opened')
    var id = nlapiGetRecordId()
    nlapiLogExecution('debug', 'id', id)
    var loadCust = nlapiLoadRecord('customrecord_zastro_po_consolid', id)
    var vendorNo = loadCust.getFieldValue('custrecord_zastro_vendor')
    if(vendorNo){
        nlapiLogExecution('debug', 'about to search')
        var filters = new Array;
        filters[0] = new nlobjSearchFilter('custrecord_zastro_po_item_list', null, 'is', id)
        filters[1] = new nlobjSearchFilter('custrecord_zastro_is_consolidated_on_po', null, 'is', 'F')
        var columns = new Array;
        columns[0] = new nlobjSearchColumn('custrecord_zastro_item_name', null, 'group')
        columns[1] = new nlobjSearchColumn('custrecord_zastro_qty', null, 'sum')
        columns[2] = new nlobjSearchColumn('custrecord_zastro_item_purchase_price', null, 'group')
        columns[3] = new nlobjSearchColumn('custrecord_zastro_so_no', null, 'max')
        columns[4] = new nlobjSearchColumn('custrecord_zastro_customer', null, 'group')
        var recordSearch = nlapiSearchRecord('customrecord_zastro_unconsolidated_items', null, filters, columns);
        nlapiLogExecution('debug', 'recordSearch.length', recordSearch.length)
        if (recordSearch){
            var newPO = nlapiCreateRecord('purchaseorder')
            newPO.setFieldValue('entity', vendorNo)

            var today = new Date();
            var dd = today.getDate();
            var mm = today.getMonth()+1;
            var yyyy = today.getFullYear();
            today = mm+'/'+dd+'/'+yyyy;

            newPO.setFieldValue('trandate', today)
            newPO.setFieldValue('custbody_zastro_po_source', id)
           newPO.setFieldValue('employee', 5)
          
            for(i=0; i<recordSearch.length; i++){
                rsID = recordSearch[i];
                rsCols = rsID.getAllColumns()
                rsItem = rsID.getValue(rsCols[0])
                rsQty = rsID.getValue(rsCols[1])
                rsPrice = rsID.getValue(rsCols[2])
                rsSO = rsID.getValue(rsCols[3])
                rsCust = rsID.getValue(rsCols[4])
            
        
                
                newPO.selectNewLineItem('item')
                newPO.setCurrentLineItemValue('item', 'item', rsItem)
                newPO.setCurrentLineItemValue('item', 'quantity', rsQty)
                //HERE I SHOULD MAYBE GO BACK AND DROP IN ARRAYS
                // newPO.setCurrentLineItemValue('item', 'custcol_fil_sales_order_no', rsSO)
                // newPO.setCurrentLineItemValue('item', 'custcol_fil_po_customer', rsCust)
                newPO.commitLineItem('item')
            
                
        }
          try{
                    var submitPO = nlapiSubmitRecord(newPO)
          }
          catch(e){
              nlapiLogExecution('debug', 'PO e', JSON.stringify(e))
            nlapiLogExecution('debug', 'PO e', e)
          }

        nlapiLogExecution('debug', 'PO created', submitPO)
        }
        else{
            alert('There is no vendor linked')
        }
        nlapiLogExecution('debug', 'search 2')
        var filtersTwo = new Array;
        filtersTwo[0] = new nlobjSearchFilter('custrecord_zastro_po_item_list', null, 'is', id)
        filtersTwo[1] = new nlobjSearchFilter('custrecord_zastro_is_consolidated_on_po', null, 'is', 'F')
        var columnsTwo = new Array;
        columnsTwo[0] = new nlobjSearchColumn('internalid')
        
        var recordSearchTwo = nlapiSearchRecord('customrecord_zastro_unconsolidated_items', null, filtersTwo, columnsTwo);
        nlapiLogExecution('debug', 'recordSearchTwo.length', recordSearchTwo.length)
        if (recordSearchTwo){
            for(k=0; k<recordSearchTwo.length; k++){
                rs2ID = recordSearchTwo[k];
                rs2Cols = rs2ID.getAllColumns()
                rs2Internal = rs2ID.getValue(rs2Cols[0])
            
                nlapiLogExecution('debug', 'am i here', rs2Internal)

                //nlapiSubmitField('customrecord_zastro_unconsolidated_items', rs2Internal, 'custrecord_zastro_is_consolidated_on_po', 'T')
                var loadSubRecord = nlapiLoadRecord('customrecord_zastro_unconsolidated_items', rs2Internal)
                loadSubRecord.setFieldValue('custrecord_zastro_is_consolidated_on_po', 'T')
                nlapiLogExecution('debug', 'marked consolidated')
                nlapiSubmitRecord(loadSubRecord)
            }
        }
        var setPO = loadCust.setFieldValue('custrecord_zastro_po_no', submitPO)
        try{
            var filtersThree = new Array;
            filtersThree[0] = new nlobjSearchFilter('custrecord_zastro_po_item_list', null, 'is', id)
            filtersThree[1] = new nlobjSearchFilter('custrecord_zastro_is_consolidated_on_po', null, 'is', 'F')
            var columnsThree = new Array;
            columnsThree[0] = new nlobjSearchColumn('internalid')
            
            var recordSearchThree = nlapiSearchRecord('customrecord_zastro_unconsolidated_items', null, filtersThree, columnsThree);
            if (recordSearchThree.length > 0){
                nlapiLogExecution('debug', 'exists')
            }
        }
        catch(e){
            nlapiLogExecution('debug', 'e', e)
            loadCust.setFieldValue('custrecord_zastro_is_consolidated', 'T')
        }
        var submit = nlapiSubmitRecord(loadCust)
        nlapiLogExecution('debug', 'done')
    } 
//}
// catch(e){
//   nlapiLogExecution('debug', 'e', JSON.stringify(e))
// }
   
}