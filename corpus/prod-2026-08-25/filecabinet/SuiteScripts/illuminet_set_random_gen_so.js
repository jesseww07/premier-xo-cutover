/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

define(['N/record', 'N/search', 'N/log', 'N/format'],

    /**
     * @param {record} record
     * @param {search} search
     * @param {log} log
     * @param {format} format
     */
    function (record, search, log, format) {

        /**
         * Function definition to be triggered before record is loaded.
         * @param {Object} context
         * @param {Record} context.newRecord - New record
         * @param {Record} context.oldRecord - Old record
         * @param {string} context.type - Trigger type
         * @Since 2015.2
         */

        //   Write a script on create of a po that takes the vendor, 
        //   runs a search to find the custom record, grabs the abbrev and the last number used, 
        //   add one to the number, 
        //   write that new number back to the custom record, Concat abbr + ‘-‘ + new number

        function afterSubmit(context) {
            log.debug('context', context)
            log.debug('context type', context.type)
            let tranId = context.newRecord.id
            log.debug('tranId', tranId)
            let tranType = context.newRecord.type
            log.debug('tranType', tranType)

            if (context.type == context.UserEventType.DELETE) {
                log.debug('context.type', context.type)
                return;
            }
            let loadedRecord = record.load({
                type: tranType,
                id: tranId,
                isDynamic: false
            })
            var lineCount = loadedRecord.getLineCount({
                sublistId: 'item'
            });
            log.debug('lineCount', lineCount)
            if (lineCount > 0) {
                for (var i = 0; i < lineCount; i++) {
                    var randomGen = loadedRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_self_id',
                        line: i
                    });

                    log.debug('randomGen', randomGen)
                    if (!randomGen) {
                        let numToUse = randomGenLot()
                        log.debug('random gen num to use', numToUse)

                        loadedRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_self_id',
                            line: Number(i),
                            value: numToUse
                        });

                    }
                }
                loadedRecord.save()
            }

        }

        const randomGenLot = () => {
            var charResult = '';
            var numResult = ''
            var characters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
            var numbers = '123456789';
            var charactersLength = characters.length;
            var numbersLength = numbers.length;
            for (var i = 0; i < 5; i++) {
                charResult += characters.charAt(Math.floor(Math.random() * charactersLength));
            }
            for (var i = 0; i < 5; i++) {
                numResult += numbers.charAt(Math.floor(Math.random() * numbersLength));
            }
            var randomGen = charResult + '-' + numResult
            return randomGen
        }

        return {
            afterSubmit: afterSubmit
        }
    }

);