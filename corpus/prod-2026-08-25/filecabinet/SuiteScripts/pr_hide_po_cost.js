function userEventBeforeLoad(type, form, request) {
    if (type == 'edit' || type == 'view') //executes the script only on view and edit mode
    {
        var form = nlapiGetFieldValue('customform')
        if(form == 153 || form == 58){
            var role = nlapiGetContext();
            var roleaccess = role.getRole(); //gets role of the current user via context api
            var currentUser = role.getUser();
            nlapiLogExecution('debug', 'currentUser', currentUser)
            if (roleaccess != '3' || currentUser != 'AMANDA HERDT') //checks whether current role has access
            {
                if (roleaccess != '3') {
                    form.getSubList('item').getField('rate').setDisplayType('hidden'); //hides unitcost field
                    form.getSubList('item').getField('amount').setDisplayType('hidden');     //hides cost field
                }
            }
        }
    }
}