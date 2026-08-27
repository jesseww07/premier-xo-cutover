/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/format', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/util', 'N/file'],
    /**
     * @param {format} format
     * @param {log} log
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {task} task
     * @param {util} util
     * @param {file} file
     */
    function (format, log, record, runtime, search, task, util, file) {

        function getInputData() {
            var mySearch = search.load({
                id: 'customsearch422'
            })
            return mySearch
        }

        function map(context) {
            try {
                let result = JSON.parse(context.value);
                // let soId = result.id
                log.debug('result', result)
                let lightAmerItemFile = idParser(result, 'internalid.file')
                log.debug('lightAmerItemFile', lightAmerItemFile)

                var fileObj = file.load({
                    id: lightAmerItemFile
                });
                var fileContents = fileObj.getContents();
                log.debug('fileContents', fileContents);
                //return

                var delimiter = ",";
                var dataArray = CSVToArray(fileContents, delimiter);
                //log.debug('dataArray', dataArray)

                if (dataArray.length > 0) {
                    for (var xx = 1; xx < dataArray.length; xx++) {
                        var dataDisplay = dataArray[xx]
                        var dataDisplayString = dataDisplay.toString();
                        var dataDisplaySplit = dataDisplayString.split(',');
                        log.debug('line', dataDisplaySplit)
                        log.debug('line.len', dataDisplaySplit.length)


                        var intID = dataDisplaySplit[0]
                        var purch = dataDisplaySplit[9]
                        var sell = dataDisplaySplit[8]

                        var inputObject = new Object()
                        inputObject.intID = intID
                        inputObject.purch = purch
                        inputObject.sell = sell

                        log.debug('inputObject', inputObject)
                        context.write(inputObject)


                    }
                    //return

                }

            }
            catch (e) {
                log.error('COULD NOT COMPLETE MAPPING', e)
            }

        }

        function reduce(context) {
            log.debug('context', context)
            var getKey = context.key
            var parsedKey = JSON.parse(getKey)

            log.debug('parsedKey', parsedKey)

            var internal = parsedKey.intID
            var purchP = parsedKey.purch
            var sellP = parsedKey.sell
            try{
                log.debug('purchP',purchP)
                var invItem = record.load({
                    type: 'inventoryitem',
                    id: internal,
                    isDynamic: true
                })
                invItem.setValue({
                    fieldId:'cost',
                    value:purchP
                })
                var count = invItem.getLineCount({
                    sublistId: 'itemvendor'
                   });
                   log.debug('itemvendor', count)
                   if(count > 0){
                    log.debug('in over zero', parsedKey)
                    var lineNum = invItem.selectLine({
                        sublistId: 'itemvendor',
                        line: 0
                       });
                    var vend = invItem.getCurrentSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'vendor'
                    })
                    invItem.removeLine({
                        sublistId:'itemvendor',
                        line:0
                    })
                    invItem.selectNewLine({
                        sublistId: 'itemvendor'
                    });
                    invItem.setCurrentSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'vendor',
                        value: vend
                    })
                    invItem.setCurrentSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'preferredvendor',
                        value: true
                    })
                    
                    invItem.setCurrentSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'vendorcurrencyid',
                        value: 1
                    })
                    invItem.setCurrentSublistValue({
                        sublistId: 'itemvendor',
                        fieldId: 'purchaseprice',
                        value: purchP
                    })
                    invItem.commitLine({
                        sublistId: 'itemvendor'
                    })
                   }
                   var selectLine = invItem.selectLine({
                    sublistId: 'price1',
                    line: 0
                });
                invItem.setCurrentSublistValue({
                    sublistId: 'price1',
                    fieldId: 'price_1_',
                    value: sellP
                });
                invItem.commitLine({
                    sublistId: 'price1'
                })
                invItem.save()
         
            }
            catch(e){
                log.debug('e on s',e)
                
            }
      
        }

      

        const CSVToArray = (strData, strDelimiter) => {
            strDelimiter = (strDelimiter || `",`);
            var objPattern = new RegExp(
                (
                    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
                    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
                    "([^\"\\" + strDelimiter + "\\r\\n]*))"
                ),
                "gi"
            );
            var arrData = [[]];
            var arrMatches = null;
            while (arrMatches = objPattern.exec(strData)) {
                var strMatchedDelimiter = arrMatches[1];
                if (
                    strMatchedDelimiter.length &&
                    (strMatchedDelimiter != strDelimiter)
                ) {
                    arrData.push([]);
                }
                if (arrMatches[2]) {
                    var strMatchedValue = arrMatches[2].replace(
                        new RegExp("\"\"", "g"),
                        "\""
                    );
                } else {
                    var strMatchedValue = arrMatches[3];
                }
                arrData[arrData.length - 1].push(strMatchedValue);
            }
            return (arrData);
        }

        const idParser = (result, startPoint) => {

            let newResult = JSON.stringify(result)
            let n = newResult.search(startPoint)
            let subResult = newResult.substring(n, newResult.length)
            log.debug('subresult', subResult)
            var id = idScanner(subResult)
            return id
        }

        const idScanner = (subResult) => {
            let hitNumber = false
            let idMaker = new Array()
            for (let i = 0; i < subResult.length; i++) {
                if (subResult[i] == '0' || subResult[i] == '1' || subResult[i] == '2' || subResult[i] == '3' || subResult[i] == '4' ||
                    subResult[i] == '5' || subResult[i] == '6' || subResult[i] == '7' || subResult[i] == '8' || subResult[i] == '9') {
                    idMaker.push(subResult[i])
                    if (!hitNumber) {
                        hitNumber = true
                    }
                }
                else {
                    if (hitNumber) {
                        break
                    }
                    continue
                }
            }
            let parsedId = Number(idMaker.join(''))
            log.debug('parsedId', parsedId)
            return parsedId
        }



        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            //        summarize: summarize
        };

    });
