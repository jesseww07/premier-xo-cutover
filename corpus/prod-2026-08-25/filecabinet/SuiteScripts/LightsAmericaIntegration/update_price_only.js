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
            id: 'customsearch5551'
            //customsearch5551 is idlewood prod
        })
        return mySearch
    }

    function map(context) {
        try {
            log.debug('context', context)
            let result = JSON.parse(context.value);
            log.debug('result', result)
            let recId = result.id
            log.debug('recId', recId)
            var itemObj = loadRec(recId)
            log.debug('item object to update item rec', itemObj)
           var updated = updateItem(itemObj)

        }


        catch (e) {
            log.error('COULD NOT COMPLETE MAPPING', e)
        }

    }

    const updateItem = (obj) => {
        log.debug('updating item')
       let loadedRecord = record.load({
           type: 'inventoryitem',
           id: obj.item,
           isDynamic: true
       })
       loadedRecord.setValue({
           fieldId: 'itemid',
           value: obj.itemText
       })
       loadedRecord.setValue({
           fieldId: 'upccode',
           value: obj.upc
       })
       loadedRecord.setValue({
           fieldId: 'custitem_idlewood_height',
           value: obj.height
       })
       loadedRecord.setValue({
           fieldId: 'custitem_idlewood_item_length',
           value: obj.length
       })
       loadedRecord.setValue({
           fieldId: 'custitem_iw_weight',
           value: obj.weight
       })
       loadedRecord.setValue({
           fieldId: 'custitem_iw_extension',
           value: obj.extension
       })
       loadedRecord.setValue({
           fieldId: 'custitem_iw_max_watts',
           value: obj.watts
       })
       loadedRecord.setValue({
           fieldId: 'custitem_iw_bulb_base',
           value: obj.bulbBase
       })
       loadedRecord.setValue({
           fieldId: 'custitem_iw_bulb_type',
           value: obj.bulbType
       })
       loadedRecord.setValue({
           fieldId: 'custitemiw_num_of_bulbs',
           value: obj.bulbNum
       })
       loadedRecord.setValue({
           fieldId: 'custitem_unique_id',
           value: obj.uniqueId
       })
       loadedRecord.setValue({
           fieldId: 'custitem_idwd_vend_item_image',
           value: obj.image
       })
       loadedRecord.setValue({
           fieldId: 'custitem_idlewood_vendor_price_',
           value: obj.cost
       })

       loadedRecord.setValue({
           fieldId: 'cost',
           value: obj.cost
       })
       loadedRecord.setValue({
           fieldId: 'transferprice',
           value: obj.cost
       })
       loadedRecord.setValue({
           fieldId: 'costestimate',
           value: obj.cost
       });
       loadedRecord.setValue({
           fieldId: 'custitem_idlewood_width',
           value: obj.width
       });
       loadedRecord.selectLine({
           sublistId: 'itemvendor',
           line: 0
       });
       loadedRecord.setCurrentSublistValue({
           sublistId: 'itemvendor',
           fieldId: 'purchaseprice',
           line: 0,
           value: obj.cost
       });
       loadedRecord.commitLine({
           sublistId: 'itemvendor'
       });

       loadedRecord.save({ignoreMandatoryFields: true})
    }

    const loadRec = (recId) => {
        let loadedRecord = record.load({
            type: 'customrecord_zastro_la_data_dump',
            id: recId,
            isDynamic: true
        })
        let item = loadedRecord.getValue({
           fieldId: 'custrecord_zastro_linked_item',
       })
       log.debug('item', item)
       let itemText = loadedRecord.getText({
           fieldId: 'custrecord_zastro_linked_item',
       })
       log.debug('itemText', itemText)

        let desc = loadedRecord.getValue({
           fieldId: 'custrecord_zas_description',
       })
       log.debug('desc', desc)
       let regPrice = loadedRecord.getValue({
           fieldId: 'custrecord_zas_regular_price',
       })
       log.debug('reg price', regPrice)
       let listPrice = loadedRecord.getValue({
           fieldId: 'custrecord_zas_list_price',
       })
       log.debug('list price', listPrice)
       let cost = loadedRecord.getValue({
           fieldId: 'custrecord_zas_cost',
       })
       log.debug('cost', cost)
       let image = loadedRecord.getValue({
           fieldId: 'custrecord_zas_image',
       })
       log.debug('image', image)
       let link = loadedRecord.getValue({
           fieldId: 'custrecord_zas_product_url',
       })
       log.debug('link', link)
       let height = loadedRecord.getValue({
           fieldId: 'custrecord_zas_height',
       })
       log.debug('height', height)
       let weight = loadedRecord.getValue({
           fieldId: 'custrecord_zas_weight',
       })
       log.debug('weight', weight)
       let extension = loadedRecord.getValue({
           fieldId: 'custrecord_zas_extension',
       })
       log.debug('extension', extension)
       let length = loadedRecord.getValue({
           fieldId: 'custrecord_zas_length',
       })
       log.debug('length', length)
       let bulbType = loadedRecord.getValue({
           fieldId: 'custrecord_zas_bulb_type',
       })
       log.debug('bulbType', bulbType)
       let buldIncluded = loadedRecord.getValue({
           fieldId: 'custrecord_zas_bulbs_included',
       })
       log.debug('buldIncluded', buldIncluded)
       let bulbBase = loadedRecord.getValue({
           fieldId: 'custrecord_zas_bulb_base',
       })
       log.debug('bulbBase', bulbBase)
       let upc = loadedRecord.getValue({
           fieldId: 'custrecord_zas_upc',
       })
       log.debug('upc', upc)
       let bulbNum = loadedRecord.getValue({
           fieldId: 'custrecord_zas_number_of_bulbs',
       })
       log.debug('bulbNum', bulbNum)
       let watts = loadedRecord.getValue({
           fieldId: 'custrecord_zas_max_wattage',
       })
       log.debug('watts', watts)
       let uniqueId = loadedRecord.getValue({
           fieldId: 'custrecord_zas_unique_id',
       })
       log.debug('watts', watts)
       let width = loadedRecord.getValue({
           fieldId: 'custrecord_zas_width__diameter',
       })
       log.debug('width', width)



       itemObj = new Object ()
       itemObj.item = item
       itemObj.itemText = itemText
       itemObj.desc = desc
       itemObj.regPrice = regPrice
       itemObj.listPrice = listPrice
       itemObj.cost = cost
       itemObj.image = image
       itemObj.link = link
       itemObj.height = height
       itemObj.weight = weight
       itemObj.extension = extension
       itemObj.length = length
       itemObj.bulbType = bulbType
       itemObj.bulbBase = bulbBase
       itemObj.upc = upc
       itemObj.bulbNum = bulbNum
       itemObj.watts = watts
       itemObj.uniqueId = uniqueId
       itemObj.width = width

       return itemObj
    }

    return {
        getInputData: getInputData,
        map: map,
        //reduce: reduce,
        //        summarize: summarize
    };

});