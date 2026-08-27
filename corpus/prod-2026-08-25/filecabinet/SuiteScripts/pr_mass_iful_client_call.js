/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord', 'N/search'], (currentRecord, search) => {


    let thisRecord;
    const pageInit = (context) => {

        console.log('context',context)
        var t = currentRecord.get()
        console.log('t',t)
        var sublist = assistant.getSublist({
            id : 'custpage_bin'
        });
        sublist.addSelectOption({
            value : 'a',
            text : 'Albert'
        });
        // var options = objField.getSelectOptions({
        //     filter : 'C',
        //     operator : 'startswith'
        // });
  
            // // Set all Location sublist fields to include only available
            // thisRecord = currentRecord.get();
            // // var mut = new MutationObserver((mutations, mut) => {
            // //     console.log(1)
            // //     const bins = filterBinOptions()
            // //     console.log(bins)
            // //     removeSelectOption(bins)
            // //     console.log(3)
    
            // // });
            // const observer = new MutationObserver(list => {
            //     console.log('mutation list', list);
            // });
            //     console.log(1)
            //     const bins = filterBinOptions()
            //     console.log(bins)
            //     removeSelectOption(bins)
            //     console.log(3)
            // // observer.observe(document.querySelector(`input[name="custpage_bin1"]`),{
            //     observer.observe(document.querySelector(`input[name="sublist_custpage_bin_display"]`),{
                
            //     'attributes': true
            // });
    
    
    
        






        //Set all Location sublist fields to include only available
        // console.log('loaded')
        // thisRecord = currentRecord.get();
        // console.log(thisRecord)
        // var mut = new MutationObserver((thisRecord) => {
        //     console.log('1')
        //     const bins = filterBinOptions()
        //     console.log('2')
        //     removeSelectOption(bins)
        //     console.log('3')

        // });

        // const observer = new MutationObserver(list => {
        //     console.log('mutation list', list);
        // });
        // console.log('1')
        // const bins = filterBinOptions()
        // console.log('2')
        // removeSelectOption(bins)
        // console.log('3')
        // observer.observe(document.body, {
        //     attributes: true,
        //     childList: true,
        //     subtree: true
        // });

        //log.debug(observer)
        // observer.observe(document.querySelector(`input[name="bin_display"]`), {
        //     'attributes': true
        // });
    }

    // const pageInit = () => {
    //     const targetNode = document.querySelector(`input[name="bin_display"]`)
    //     console.log('targetNode',targetNode)
    //     // Options for the observer (which mutations to observe)
    //     const config = { attributes: true, childList: true, subtree: true };
    //     console.log('config',config)
    //     // Callback function to execute when mutations are observed
    //     const callback = (mutationList, observer) => {
    //         for (const mutation of mutationList) {
    //             if (mutation.type === 'childList') {
    //                 console.log('A child node has been added or removed.');
    //             } else if (mutation.type === 'attributes') {
    //                 console.log(`The ${mutation.attributeName} attribute was modified.`);
    //             }
    //         }
    //     };
    //     console.log('here?')
    //     const observer = new MutationObserver(callback);
    //     console.log('observer',observer)
    //     observer.observe(targetNode, config);
    // }

    const filterBinOptions = () => {
        var returnArr = new Array()
        var inventorybalanceSearchObj = search.create({
            type: "inventorybalance",
            filters:
                [
                    ["available", "greaterthan", "0"],
                    "AND",
                    ["item", "anyof", 554398]
                ],
            columns:
                [
                    search.createColumn({
                        name: "item",
                        sort: search.Sort.ASC
                    }),
                    "binnumber",
                    "location",
                    "inventorynumber",
                    "onhand",
                    "available"
                ]
        });
        var searchResultCount = inventorybalanceSearchObj.runPaged().count;
        log.debug("inventorybalanceSearchObj result count", searchResultCount);
        inventorybalanceSearchObj.run().each(function (result) {
    
            var bin = result.getText({
                name: 'binnumber'
            })
            var binId = result.getValue({
                name: 'binnumber'
            })
            var avail = result.getValue({
                name: 'available'
            })
            var binString = `${bin} (${avail})`
            returnArr.push(binId)
            return true;
        });
        return returnArr
    }

    const removeSelectOption = (arr, includesNewButton) => {
        jQuery('.dropdownInput').children().each((index, element) => {
            if (!includesNewButton && index > 5) {
                if (arr.includes(element.innerText)) element.style.display = 'block'
                else element.style.display = 'none'
            }
        });
    }


    return { pageInit };

});