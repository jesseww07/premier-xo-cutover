/**
 * @NApiVersion 2.1
 * @NScriptType workflowactionscript
 */
define(['N/record', 'N/search', 'N/ui', 'N/ui/dialog', 'N/runtime'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {ui} ui
     * @param {dialog} dialog
     * @param {runtime} runtime
     */
    function (record, search, ui, dialog, runtime) {

        /**
         * Definition of the Suitelet script trigger point.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @Since 2016.1
         */
        function onAction(context) {
            try {
                var bin = context.newRecord
                var id = bin.id
                log.debug(id)

                
                //THIS WILL BE ON CREATE ON TYPE BIN
                var binNumber = bin.getValue({
                    fieldId: 'binnumber'
                });
              log.debug('binNumber', binNumber)
                var location = bin.getValue({
                    fieldId: 'location'
                });
              log.debug('location', location)
                if (location != 9) {

                    //create new bin record

                    var newBin = record.create({
                        type: 'bin',
                        isDynamic: true
                    });
				log.debug('newBin', newBin)
                    //set up > company > locations
                    //grab the name
                    //concat it with SI - 
                    var newName = 'SI - ' + binNumber
                    newBin.setValue({
                        fieldId: 'binnumber',
                        value: newName
                    })
                    newBin.setValue({
                        fieldId: 'location',
                        value: 9
                    })
                    newBin.save()

                    //set the location as stored inventory
                    //sabe
                }





            }
            catch (e) {
                log.debug('failure in eaches', e)
            }
        }



        return {
            onAction: onAction
        };

    });