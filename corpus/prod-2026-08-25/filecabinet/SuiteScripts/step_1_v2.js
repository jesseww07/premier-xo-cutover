/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/config', 'N/log', 'N/record', 'N/runtime', 'N/search', 'N/file', 'N/task', 'N/encode', 'N/https', '/SuiteScripts/PapaParse-5.0.2/papaparse.min'],
    (config, log, record, runtime, search, file, task, encode, https, Papa) => {

        const BATCH_SIZE = 600000; // Process in manageable chunks

        function getInputData() {
          try{
            log.debug('Fetching Configuration');
            const configRecord = getConfigRecord();

            if (!configRecord) {
                log.error('Config Missing', 'No configuration record found.');
                return [];
            }

            const fileUrl = configRecord.getValue({ fieldId: 'custrecord_zastro_lights_update_file_url' });
            log.debug('fileUrl',fileUrl)
            const fileContents = getFileContents(fileUrl);
            log.debug('fileContents', fileContents)
            if (!fileContents) {
                log.error('File Missing', 'No file data available.');
                return [];
            }

            // Parse the CSV using Papa Parse
            const parsedData = parseCSVWithPapa(fileContents);
            log.debug('parsedData', parsedData)
            log.debug('parsedData.length', parsedData.length)
            if (!parsedData || parsedData.length === 0) {
                log.error('Parsing Error', 'No data parsed from the file.');
                return [];
            }

            // Chunk the parsed data for processing


           

            var chunks = chunkArray(parsedData, BATCH_SIZE);
            log.debug('Total Chunks Created', chunks.length);
            for (let x = 0; x < chunks.length; x++) {
                log.debug('chunks[x]', chunks[x])
                return chunks[x]
            }

          }
          catch(e){
            log.error('error in getinput',e)
          }
        }

        function map(context) {

            log.debug('Context values in Map Stage', context.value);
            let vals = JSON.parse(context.value)
            log.debug('vals', vals)
            // let keys = Object.keys(context.value)
            // log.debug('keys',keys)
            // let values = Object.values(context.value)
            // log.debug('values',values)

            let test = vals["Manufacturer Number"]
            log.debug('test', test)
            try {
                var newRec = record.create({
                    type: 'customrecord_la_csv_row',
                    isDynamic: true
                })
                //sku
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_lightsamericasku',
                    value: vals["LightsAmerica SKU"]
                })
                //man name
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_manufacturername',
                    value: vals["Manufacturer Name"]
                })
                //man num
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_manufacturernumber',
                    value: vals["Manufacturer Number"]
                })
                //upc
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_upc',
                    value: vals["UPC"]
                })
                //cost
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_cost',
                    value: vals["Cost"]
                })
                //reg price
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_regularprice',
                    value: vals["Regular Price"]
                })
                //list price
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_listprice',
                    value: vals["List Price"]
                })
                //product name
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_productname',
                    value: vals["Product Name"]
                })
                //desc
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_description',
                    value: vals["Description"]
                })
                //collection
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_collection',
                    value: vals["Collection"]
                })
                 //designer
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_designer',
                    value: vals["Designer"]
                })

                 //manu finish
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_manufacturerfinish',
                    value: vals["Manufacturer Finish"]
                })

                 //manu glass
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_manufacturerglass',
                    value: vals["Manufacturer Glass"]
                })

                 //crystal
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_crystal',
                    value: vals["Crystal"]
                })
          
                //notes
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_notes',
                    value: vals["Notes"]
                })
             
                //width diam
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_widthdiameter',
                    value: vals["Width / Diameter"]
                })

                 //height
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_height',
                    value: vals["Height"]
                })

                 //length
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_length',
                    value: vals["Length"]
                })

                //weight
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_weight',
                    value: vals["Weight"]
                })

                 //extension
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_extension',
                    value: vals["Extension"]
                })

                //chain
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_chain',
                    value: vals["Chain"]
                })

                //wire
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_wire',
                    value: vals["Wire"]
                })
                
                //bulbs?
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_bulbsincluded',
                    value: vals["Bulbs Included?"]
                })

                //number of bulbs
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_numberofbulbs',
                    value: vals["Number of Bulbs"]
                })

                // max wattage
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_maxwattage',
                    value: vals["Max Wattage"]
                })

                // bulb type
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_bulbtype',
                    value: vals["Bulb Type"]
                })

                // bulb base
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_bulbbase',
                    value: vals["Bulb Base"]
                })

                // light source
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_lightsource',
                    value: vals["Light Source"]
                })

                // light output
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_lightoutput',
                    value: vals["Light Output"]
                })

                // color temp
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_colortemperature',
                    value: vals["Color Temperature"]
                })

                // cri
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_cri',
                    value: vals["CRI"]
                })

                // Dimmable?
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_dimmable',
                    value: vals["Dimmable?"]
                })

                // Beam Spread
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_beamspread',
                    value: vals["Beam Spread"]
                })

                // Rated Average Life
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_ratedaveragelife',
                    value: vals["Rated Average Life"]
                })

                 // Voltage
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_voltage',
                    value: vals["Voltage"]
                })

                //url
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_producturl',
                    value: vals["Product URL"]
                })

                //image
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_image',
                    value: vals["Image"]
                })
                //shipped via
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_shippedvia',
                    value: vals["Shipped Via"]
                })
                //active
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_active',
                    value: vals["Active?"]
                })
                //unique id
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_uniqueid',
                    value: vals["Unique ID"]
                })

                //material
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_material',
                    value: vals["Material"]
                })

                 //Safety Listing
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_safetylisting',
                    value: vals["Safety Listing"]
                })

                //Safety rating
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_safetyrating',
                    value: vals["Safety Rating"]
                })

                //drop ship
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_dropship',
                    value: vals["Drop Ship"]
                })
              
                //Carton Volume
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_cartonvolume',
                    value: vals["Carton Volume"]
                })


                //Dimensional Weight
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_dimensionalweight',
                    value: vals["Dimensional Weight"]
                })

                //Fan Airflow
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_fanairflow',
                    value: vals["Fan Airflow"]
                })

                //Fan Electricity Use
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_fanelectricityuse',
                    value: vals["Fan Electricity Use"]
                })

                //Airflow Efficiency
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_airflowefficiency',
                    value: vals["Airflow Efficiency"]
                })

                //Blade Pitch
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_bladepitch',
                    value: vals["Blade Pitch"]
                })

                //Blade Span
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_bladespan',
                    value: vals["Blade Span"]
                })

                //Blade Type
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_bladetype',
                    value: vals["Blade Type"]
                })

                //Blade Finish
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_bladefinish',
                    value: vals["Blade Finish"]
                })

                //Blade Qty
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_bladeqty',
                    value: vals["Blade Qty"]
                })

                //revres air
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_reverseair',
                    value: vals["Reverse Air"]
                })

                //Fan Speeds
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_fanspeeds',
                    value: vals["Fan Speeds"]
                })

                //light kit
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_lightkit',
                    value: vals["Light Kit"]
                })

                //Fan Control
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_fancontrol',
                    value: vals["Fan Control"]
                })
                
                //Fan Downrod
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_fandownrod',
                    value: vals["Fan Downrod"]
                })

                //Country of Origin
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_countryoforigin',
                    value: vals["Country of Origin"]
                })

                //Energy Star?
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_energystar',
                    value: vals["Energy Star?"]
                })

                //ADA?
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_ada',
                    value: vals["ADA?"]
                })

                //Dark Sky?
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_darksky',
                    value: vals["Dark Sky?"]
                })

                //Manufacturer Warranty
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_manufacturerwarranty',
                    value: vals["Manufacturer Warranty"]
                })

                //Intro Date
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_introdate',
                    value: vals["Intro Date"]
                })

                 //Spec Sheet
                 newRec.setValue({
                    fieldId: 'custrecord_csvrow_specsheet',
                    value: vals["Spec Sheet"]
                })

                //Instructions
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_instructions',
                    value: vals["Instructions"]
                })

                //Parts Diagram
                newRec.setValue({
                    fieldId: 'custrecord_csvrow_partsdiagram',
                    value: vals["Parts Diagram"]
                })


                var saved = newRec.save()
                // Parse the chunk back into an array of rows
                // const rows = JSON.parse(context.value);
                // log.debug('Rows in Map (First 2 Rows)', rows.slice(0, 2));

                // const configRecord = getConfigRecord();

                // if (!rows.length || !configRecord) {
                //     log.error('Data/Config Missing', 'No rows to process or configuration record is missing.');
                //     return;
                // }

                // const processingFolderId = configRecord.getValue({ fieldId: 'custrecord_processing_folder' });
                // const headers = Object.keys(rows[0]); // Extract headers from the first row
                // log.debug('Headers in Map', headers);

                // // Process rows in the chunk
                // const processedContent = rows.map(row => processRow(row)).join("\n");

                // // Save processed data to CSV
                // if (processedContent) {
                //     saveCSV(processedContent, headers, processingFolderId);
                // }
            } catch (error) {
                log.error('Map Error', error);
            }
        }


       

        function parseCSVWithPapa(fileContents) {
            try {
                const result = Papa.parse(fileContents, {
                    header: true, // Adjust as per your requirements
                    dynamicTyping: false,
                    skipEmptyLines: true
                });

                if (result.errors.length > 0) {
                    log.error('Papa Parse Errors', result.errors);
                }

                return result.data;
            } catch (error) {
                log.error('CSV Parsing Error', error);
                return [];
            }
        }

        function saveCSV(data, folderId) {
            try {
                const fileName = `Processed_${Date.now()}.csv`;
                const fileObj = file.create({
                    name: fileName,
                    fileType: file.Type.CSV,
                    contents: [headers.join(','), data].join('\n'),
                    folder: 1620
                });
                fileObj.save();
                log.audit('File Saved', `File ${fileName} saved successfully.`);
            } catch (error) {
                log.error('Save CSV Error', error);
            }
        }

        function processRow(row) {
            try {
                // Your row-specific processing logic here
                return row.map(cell => (cell !== null && cell !== undefined ? cell.toString().replace(/,/g, '') : '')).join(","); // Example: Remove commas
            } catch (error) {
                log.error('Row Processing Error', { row, error });
                return '';
            }
        }

        function getConfigRecord() {
            const searchObj = search.create({
                type: 'customrecord_zastro_lights_file_config',
                filters: [['isinactive', 'is', 'F']],
                columns: ['internalid']
            });

            let configId;
            searchObj.run().each(result => {
                configId = result.getValue('internalid');
                return false; // Only fetch the first result
            });

            if (configId) {
                return record.load({
                    type: 'customrecord_zastro_lights_file_config',
                    id: configId
                });
            }
            return null;
        }

        function getFileContents(url) {
            const resp = https.get({ url, headers: { Accept: 'application/octet-stream' } });
            const stream = resp.body;
            log.debug('stream', stream)
            const decoded = encode.convert({
                string: stream,
                inputEncoding: encode.Encoding.BASE_64,
                outputEncoding: encode.Encoding.UTF_8
            });
            log.debug('decoded', decoded)
            return decoded;
        }

        function chunkArray(array, size) {
            const result = [];
            for (let i = 0; i < array.length; i += size) {
                result.push(array.slice(i, i + size));
            }
            return result;
        }

        return {
            getInputData,
            map
        };
    }
);
