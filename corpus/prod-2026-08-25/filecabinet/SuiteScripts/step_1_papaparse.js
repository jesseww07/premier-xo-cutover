/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/config', 'N/https', 'N/log', 'N/record', 'N/render', 'N/runtime', 'N/search', 'N/url', 'N/https', 'N/encode', 'N/file', 'N/task','/SuiteScripts/PapaParse-5.0.2/papaparse.js'],
    /**
     * @param {config} config
     * @param {https} https
     * @param {log} log
     * @param {record} record
     * @param {render} render
     * @param {runtime} runtime
     * @param {search} search
     * @param {url} url
     * @param {https} https
     * @param {encode} encode
     * @param {file} file
     */
    function (config, https, log, record, render, runtime, search, url, https, encode, file, task, Papa) {

        function getInputData() {
            var mySearch = new Array()
            var newObj = new Object()
            newObj.dummy = 'data'
            mySearch.push(newObj)
            return mySearch
            //dummy data being passed to map
        }

        function map(context) {
            var configRecord = getLightsConfig();
            var processingFolderId = configRecord.getValue({fieldId: 'custrecord_zastro_lights_process_folder'});
            if (!processingFolderId) {
                log.debug('NO_FILE_ID', 'Please set processing file id');
            }

            var fileLineCount = configRecord.getValue({
                fieldId: 'custrecord_file_line_count'
            });

            var fileProgressCount = configRecord.getValue({
                fieldId: 'custrecord_file_progress_count'
            });

            //TODO: Review/import
            // if ((fileProgressCount && fileLineCount) && (fileProgressCount >= fileLineCount)) {
            //     log.debug('STEP_2_START', 'Starting Step 2');
            //     // var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
            //     // scriptTask.scriptId = 'customscript_zastro_la_step_2';
            //     // scriptTask.deploymentId = 'customdeploy1';
            //     // var scriptTaskId = scriptTask.submit();
            //     return true;
            // }

            try {
                var csvContents = getResults(configRecord);
                // if (!csvContents) {
                //     log.debug('NO_NEW_FILE', 'No New File to Process');
                //     return true;
                // }
                // var parseCont = csvContents.data
                // var parseLength = parseCont.length

                // if (!csvContents) {
                //     return true;
                // }

                // var myOverridingArray = new Array
                // var lastIndex = parseCont.length - 1
                // var counter = 0
               // var peservedLineOne = ['LightsAmerica SKU','Manufacturer Name','Manufacturer Number', 'UPC',   'Cost',    'Regular Price',    'List Price',    'Product Name','Description',   'Collection',   'Designer',    'Manufacturer Finish',    'Manufacturer Glass',    'Crystal',    'Notes',    'Width / Diameter',    'Height',    'Length',    'Weight',    'Extension',    'Chain',    'Wire',    'Bulbs Included?',    'Number of Bulbs',    'Max Wattage',    'Bulb Type',    'Bulb Base',    'Light Source',    'Light Output',    'Color Temperature',    'CRI',    'Dimmable?',    'Beam Spread',    'Rated Average Life',    'Voltage',    'Fan Airflow',    'Fan Electricity Use',    'Airflow Efficiency',    'Blade Pitch',    'Blade Span',    'Blade Type',    'Blade Finish',    'Blade Qty',    'Reverse Air',    'Fan Speeds',    'Light Kit',    'Fan Control',    'Fan Downrod',    'Product URL',    'Material',    'Country of Origin',    'Safety Listing',    'Safety Rating',    'Energy Star?',    'ADA?',    'Dark Sky?',    'Manufacturer Warranty',    'Intro Date',    'Spec Sheet',    'Instructions',    'Parts Diagram',    'Image',    'Shipped Via',    'Drop Ship',    'Carton Volume',    'Dimensional Weight',    'Active?',    'Unique ID']
                // for (var x = 0; x < parseCont.length; x++) {
                //     try {
                //         //for (var x = 0; x < 10; x++) {
                //         var dataDisplaySplit = parseCont[x]
                //         counter++
                //         // if (x == 0) {
                //         //     //var peservedLineOne = dataDisplaySplit
                //         // }
                //         // if (x == lastIndex) {
                //         //     myOverridingArray.push(dataDisplaySplit)
                //         //     var returnedCSVOne = csvCreator(myOverridingArray, peservedLineOne, processingFolderId)
                //         // }
                //         // else if (counter == 10000) {
                //         //     //then we are at a stopping point
                //         //     log.debug('LINE', x)
                //         //     log.debug('counter', counter)

                //         //     try {
                //         //         var returnedCSVOne = csvCreator(myOverridingArray, peservedLineOne, processingFolderId)
                            
                //         //     }
                //         //     catch (ee) {
                //         //         log.error('ee', ee)
                //         //     }
                //         //     var myOverridingArray = new Array()
                //         //     counter = 0
                //         // }
                //         // else {
                //         //     try{
                //         //         myOverridingArray.push(dataDisplaySplit)
                //         //     }
                //         //     catch(lll){
                //         //         log.debug('lll',lll)
                //         //     }

                //         // }
                //     }
                //     catch (f) {
                //         counter++
                //         log.error('f', f)
                //         log.error('da',parseCont[x])
                //     }
                // }

            }
            catch (error) {
                log.error('COULD NOT COMPLETE MAPPING', error)
            }

            log.debug('Rescheduling Script 1');
            var mrTask = task.create({taskType: task.TaskType.MAP_REDUCE});
            log.debug('Created Task');
            var deploymentId = runtime.getCurrentScript().deploymentId;
            newDeploymentMap = {
                'customdeploy2': 'customdeploy1',
                'customdeploy1': 'customdeploy2'
            };

            try {
                mrTask.scriptId = 'customscript_zastro_la_step_1';
                mrTask.deploymentId = newDeploymentMap[deploymentId];
                var mrTaskId = mrTask.submit();
            }

            catch (err) {
                log.debug(err.code, err.message);
            }

        }


   

        const csvCreator = (arraySet, peservedLineOne, processingFolderId) => {
            try {
                var content = ''
                var stringLength = arraySet.length
                var lastIndex = Number(stringLength) - 1
                log.audit('lastIndex',lastIndex)
                log.audit('stringLength',stringLength)
                for (var x = 0; x < stringLength; x++) {
                    var lineInfo = arraySet[x]
                    var pushLine = ''
                    var lastLineIndex = Number(lineInfo.length) - 1
                    for (var b = 0; b < lineInfo.length; b++) {
                        if (lastLineIndex != b) {
                            var dropComma = lineInfo[b].replace(/,/g, '')
                          //  var dropComma = lineInfo[b]
                            pushLine += dropComma + ','
                        }
                        else {
                            var dropComma = lineInfo[b].replace(/,/g, '')
                          //var dropComma = lineInfo[b]
                            pushLine += dropComma + '\n'
                        }
                    }

                    content += pushLine
                }

                if (!content) {
                    //We don't want to create an empty file.
                    return false;
                }

                var buildCSV = peservedLineOne + '\n' + content

                var result = '';
                var characters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
                var charactersLength = characters.length;
                for (var i = 0; i < 10; i++) {
                    result += characters.charAt(Math.floor(Math.random() * charactersLength));
                }
                var fileObj = file.create({
                    name: `${result}.csv`,
                    fileType: file.Type.CSV,
                    contents: buildCSV,
                    description: 'Lights America Integration File',
                    folder: processingFolderId,
                    isOnline: true
                });
                var fileId = fileObj.save();
                return fileId
            }
            catch (e) {
                log.debug('e on file creator', e)
            }

        }


        const getResults = (configRecord) => {

            var script = runtime.getCurrentScript();

            var fileUrl = configRecord.getValue({
                fieldId: 'custrecord_zastro_lights_update_file_url'
            });

            var fileLineCount = configRecord.getValue({
                fieldId: 'custrecord_file_line_count'
            });
          log.debug('fileLineCount',fileLineCount)
            var fileProgressCount = configRecord.getValue({
                fieldId: 'custrecord_file_progress_count'
            });

            var chunkSize = configRecord.getValue({
                fieldId: 'custrecord_chunk_size'
            });

            var remainingUsage = script.getRemainingUsage();
            log.audit({
                title: 'Remaining Usage at',
                details: remainingUsage
            });

            var fileContents = useHttpsModule(fileUrl);
            log.debug('fileContents',fileContents)
            //filecontents is decoded data sream

           
            var remainingUsage2 = script.getRemainingUsage();
            log.audit({
                title: 'Remaining Usage at',
                details: remainingUsage2
            });


            let pParse = parseCSVWithPapa(fileContents)
          log.audit('pParse',pParse)
            // return pParse;

            fileContents = sanitizeData(fileContents)
            log.debug('sanitized fileContents',fileContents)
            let csvLength = fileContents.length
            log.debug('csvLength',csvLength)
            var chunked = chunkArray(fileContents)
            log.debug('chunked',chunked)

            
            var result = '';
            var characters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
            var charactersLength = characters.length;
            for (var i = 0; i < 10; i++) {
                result += characters.charAt(Math.floor(Math.random() * charactersLength));
            }
            var created = createCSVFiles(chunked,result)
//             var delimiter = ",";

//             var newArr = fileContents.split("\n");
// log.debug('newArr',newArr)
//           log.debug('newArr.length',newArr.length)
//             if (!fileLineCount) {
//                 configRecord.setValue({
//                     fieldId: 'custrecord_file_line_count',
//                     value: newArr.length
//                 });

//                 fileLineCount = newArr.length;
//             }

//             var newString = ''
//             var incrementCount = 0;
//             for (var x = fileProgressCount; x < newArr.length; x++) {
//                 if (incrementCount >= chunkSize) {
//                     break;
//                 }

//                 newString += newArr[x] + '\n';
//                 incrementCount += 1;
//             }
         
//             fileProgressCount += incrementCount;
// log.debug('fileProgressCount',fileProgressCount)
//             configRecord.setValue({
//                 fieldId: 'custrecord_file_progress_count',
//                 value: fileProgressCount
//             }).setValue({
//                 fieldId: 'custrecord_file_sync_process_status',
//                 value: 2 //In Progress
//             });

//             // if (fileProgressCount >= fileLineCount) {
//             //     log.debug('STEP_2_START', 'Starting Step 2');
//             //     // var scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
//             //     // scriptTask.scriptId = 'customscript_zastro_la_step_2';
//             //     // scriptTask.deploymentId = 'customdeploy1';

//             //     //Ensure execution of a script deployment does not halt this script
//             //     // try {
//             //     //     var scriptTaskId = scriptTask.submit();
//             //     // }

//             //     // catch(err) {
//             //     //     log.error('ERROR_SAVING_STEP_TASK', 'Error saving step 2 script execution');
//             //     //     log.error(err.name, err.message);
//             //     // }

//             //     //Reset the config values for next use
//             //     configRecord.setValue({
//             //         fieldId: 'custrecord_file_line_count',
//             //         value: 0
//             //     }).setValue({
//             //         fieldId: 'custrecord_file_progress_count',
//             //         value: 0
//             //     }).setValue({
//             //         fieldId: 'custrecord_file_last_sync_date',
//             //         value: new Date()
//             //     }).setValue({
//             //         fieldId: 'custrecord_file_sync_process_status',
//             //         value: 3 //Done
//             //     });

//             //     //Save the config because we are exiting
//             //     configRecord.save();
//             //     return false;
//             // }

//             configRecord.save();

//             // newString = newString.replaceAll('', '').replaceAll('\x11', '');;
//             // var returnContents = CSVParser().parse(newString);
//             return returnContents
        }

        

        function sanitizeData(dataArray) {
            return dataArray.map(row => {
                Object.keys(row).forEach(key => {
                    if (typeof row[key] === 'string') {
                        // Replace special characters like √©
                        row[key] = row[key].replace(/[^\w\s.,/()-]/g, ''); // Adjust regex as needed
                    }
                });
                return row;
            });
        }

        function convertArrayToCSV(dataArray) {
            if (!dataArray.length) return ''; // Return empty string for empty array
        
            // Get headers from the keys of the first object
            const headers = Object.keys(dataArray[0]);
            const csvRows = [];
        
            // Add the header row
            csvRows.push(headers.join(','));
        
            // Add each object as a CSV row
            for (const row of dataArray) {
                const values = headers.map(header => {
                    const escapedValue = (row[header] === null || row[header] === undefined) ? '' : row[header].toString();
                    return `"${escapedValue.replace(/"/g, '""')}"`; // Escape quotes and wrap in quotes
                });
                csvRows.push(values.join(','));
            }
        
            return csvRows.join('\n'); // Join rows with newline characters
        }
         
        function createCSVFiles(chunkedData, baseFileName) {
            // const fileModule = require('N/file'); // Load the file module
            const folderId = 447196; // Replace with your target folder ID in NetSuite
        
            chunkedData.forEach((chunk, index) => {
                const csvContent = convertArrayToCSV(chunk); // Convert the chunk to CSV
                const fileName = `${baseFileName}_part${index + 1}.csv`; // Construct the file name
        
                // Create the file
                const csvFile = file.create({
                    name: fileName,
                    fileType: file.Type.CSV,
                    contents: csvContent,
                    folder: folderId // Specify the folder to save the file
                });
        
                const fileId = csvFile.save(); // Save the file in NetSuite
                log.debug(`File Created: ${fileName}`, `File ID: ${fileId}`); // Log the created file information
            });
        }

        function chunkArray(dataArray, maxSize = 10000) {
            const chunkedArray = []; // Initialize the array to hold chunks
            for (let i = 0; i < dataArray.length; i += maxSize) {
                // Slice the array into chunks and push to the chunkedArray
                const chunk = dataArray.slice(i, i + maxSize);
                chunkedArray.push(chunk);
            }
            return chunkedArray; // Return the array of chunks
        }


        const useHttpsModule = (url) => {
            const resp = https.get({ url, headers: { Accept: 'application/octet-stream' } });
            const stream = resp.body;
          log.debug('stream',stream)
      
            const decoded = encode.convert({
                string: stream,
                inputEncoding: encode.Encoding.BASE_64,
                outputEncoding: encode.Encoding.UTF_8
            });
          log.debug('decoded',decoded)
          return decoded
        //   let pParse = parseCSVWithPapa(decoded)
        //   log.audit('pParse',pParse)
        //     return pParse;
        }

        

        const parseCSVWithPapa = (data) => {

            const parsedData = Papa.parse(data, {
                header: true, // Use this if the first row contains headers; otherwise set to false
                skipEmptyLines: true, // Skip empty lines
                dynamicTyping: false, // Automatically convert numeric fields to numbers
                complete: function(results) {
                    log.debug('Parsed CSV Data', results.data);
                    // You can process your parsed data here
                },
                error: function(error) {
                    log.error('Parsing Error', error.message);
                }
            });
        
            return parsedData.data; // This will contain the parsed CSV data
        }


        function getLightsConfig() {
            var configSearch = search.create({
                type: "customrecord_zastro_lights_file_config",
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
                type: 'customrecord_zastro_lights_file_config',
                id: internalId
            });

            return configRecord;
        }

        function CSVParser() {



            function e(r, n) {
                if (Array.isArray(r)) {
                    var i = []; return r.forEach(function (t) {
                        "object" == typeof t ? i.push(e(t.file, t.config)) : i.push(e(t, n))
                    }), i
                } var i = { data: [], errors: [] }; if (!/(\.csv|\.txt)$/.test(r)) return i.errors.push({ type: "", code: "", message: "Unsupported file type.", row: "" }), i; try { var a = fs.readFileSync(r).toString(); return t(a, n) } catch (s) { return i.errors.push(s), i }
            } function t(e, t) {
                var r = a(t), i = new n(r), s = i.parse(e); return f(r.complete) && r.complete(s), s
            } function r(e, t) {
                function r() {
                    "object" == typeof t && ("string" == typeof t.delimiter && 1 == t.delimiter.length && -1 == l.BAD_DELIMITERS.indexOf(t.delimiter) && (o = t.delimiter), ("boolean" == typeof t.quotes || t.quotes instanceof Array) && (f = t.quotes), "string" == typeof t.newline && (d = t.newline))
                } function n(e) {
                    if ("object" != typeof e) return []; var t = []; for (var r in e) t.push(r); return t
                } function i(e, t) {
                    var r = ""; "string" == typeof e && (e = JSON.parse(e)), "string" == typeof t && (t = JSON.parse(t)); var n = e instanceof Array && e.length > 0, i = !(t[0] instanceof Array); if (n) { for (var s = 0; s < e.length; s++)s > 0 && (r += o), r += a(e[s], s); t.length > 0 && (r += d) } for (var f = 0; f < t.length; f++) { for (var l = n ? e.length : t[f].length, u = 0; l > u; u++) { u > 0 && (r += o); var p = n && i ? e[u] : u; r += a(t[f][p], u) } f < t.length - 1 && (r += d) } return r
                } function a(e, t) {
                    if ("undefined" == typeof e || null === e) return ""; e = e.toString().replace(/"/g, '""'); var r = "boolean" == typeof f && f || f instanceof Array && f[t] || s(e, l.BAD_DELIMITERS) || e.indexOf(o) > -1 || " " == e.charAt(0) || " " == e.charAt(e.length - 1); return r ? '"' + e + '"' : e
                } function s(e, t) {
                    for (var r = 0; r < t.length; r++)if (e.indexOf(t[r]) > -1) return !0; return !1
                } var f = !1, o = ",", d = "\r\n"; if (r(), "string" == typeof e && (e = JSON.parse(e)), e instanceof Array) { if (!e.length || e[0] instanceof Array) return i(null, e); if ("object" == typeof e[0]) return i(n(e[0]), e) } else if ("object" == typeof e) return "string" == typeof e.data && (e.data = JSON.parse(e.data)), e.data instanceof Array && (e.fields || (e.fields = e.data[0] instanceof Array ? e.fields : n(e.data[0])), e.data[0] instanceof Array || "object" == typeof e.data[0] || (e.data = [e.data])), i(e.fields || [], e.data || []); log.debug("exception: Unable to serialize unrecognized input")
            } function n(e) {
                function t() {
                    if (E && m && (p("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to '" + l.DefaultDelimiter + "'"), m = !1), e.skipEmptyLines) for (var t = 0; t < E.data.length; t++)1 == E.data[t].length && "" == E.data[t][0] && E.data.splice(t--, 1); return r() && n(), a()
                } function r() {
                    return e.header && 0 == w.length
                } function n() {
                    if (E) { for (var e = 0; r() && e < E.data.length; e++)for (var t = 0; t < E.data[e].length; t++)w.push(E.data[e][t]); E.data.splice(0, 1) }
                } function a() {
                    if (!E || !e.header && !e.dynamicTyping) return E; for (var t = 0; t < E.data.length; t++) { for (var r = {}, n = 0; n < E.data[t].length; n++) { if (e.dynamicTyping) { var i = E.data[t][n]; "true" == i || "TRUE" === i ? E.data[t][n] = !0 : "false" == i || "FALSE" === i ? E.data[t][n] = !1 : E.data[t][n] = u(i) } e.header && (n >= w.length ? (r.__parsed_extra || (r.__parsed_extra = []), r.__parsed_extra.push(E.data[t][n])) : r[w[n]] = E.data[t][n]) } e.header && (E.data[t] = r, n > w.length ? p("FieldMismatch", "TooManyFields", "Too many fields: expected " + w.length + " fields but parsed " + n, t) : n < w.length && p("FieldMismatch", "TooFewFields", "Too few fields: expected " + w.length + " fields but parsed " + n, t)) } return e.header && E.meta && (E.meta.fields = w), E
                } function o(t) {
                    for (var r, n, a, s = [",", "    ", "|", ";", l.RECORD_SEP, l.UNIT_SEP], f = 0; f < s.length; f++) { var o = s[f], d = 0, u = 0; a = void 0; for (var p = new i({ delimiter: o, preview: 10 }).parse(t), c = 0; c < p.data.length; c++) { var h = p.data[c].length; u += h, "undefined" != typeof a ? h > 1 && (d += Math.abs(h - a), a = h) : a = h } u /= p.data.length, ("undefined" == typeof n || n > d) && u > 1.99 && (n = d, r = o) } return e.delimiter = r, { successful: !!r, bestDelimiter: r }
                } function d(e) {
                    e = e.substr(0, 1048576); var t = e.split("\r"); if (1 == t.length) return "\n"; for (var r = 0, n = 0; n < t.length; n++)"\n" == t[n][0] && r++; return r >= t.length / 2 ? "\r\n" : "\r"
                } function u(e) {
                    var t = g.test(e); return t ? parseFloat(e) : e
                } function p(e, t, r, n) {
                    E.errors.push({ type: e, code: t, message: r, row: n })
                } var c, h, m, g = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i, y = this, v = 0, b = !1, w = [], E = { data: [], errors: [], meta: {} }; if (f(e.step)) {
                    var x = e.step; e.step = function (n) {
                        if (E = n, r()) t(); else { if (t(), 0 == E.data.length) return; v += n.data.length, e.preview && v > e.preview ? h.abort() : x(E, y) }
                    }
                } this.parse = function (r) {
                    if (e.newline || (e.newline = d(r)), m = !1, !e.delimiter) { var n = o(r); n.successful ? e.delimiter = n.bestDelimiter : (m = !0, e.delimiter = l.DefaultDelimiter), E.meta.delimiter = e.delimiter } var a = s(e); return e.preview && e.header && a.preview++, c = r, h = new i(a), E = h.parse(c), t(), !f(e.complete) || b || y.streamer && !y.streamer.finished() || e.complete(E), b ? { meta: { paused: !0 } } : E || { meta: { paused: !1 } }
                }, this.pause = function () {
                    b = !0, h.abort(), c = c.substr(h.getCharIndex())
                }, this.resume = function () {
                    b = !1, h = new i(e), h.parse(c), b || (y.streamer && !y.streamer.finished() ? y.streamer.resume() : f(e.complete) && e.complete(E))
                }, this.abort = function () {
                    h.abort(), f(e.complete) && e.complete(E), c = ""
                }
            } function i(e) {
                e = e || {}; var t = e.delimiter, r = e.newline, n = e.comments, i = e.step, a = e.preview, s = e.fastMode; if (("string" != typeof t || 1 != t.length || l.BAD_DELIMITERS.indexOf(t) > -1) && (t = ","), n === t) log.debug("Comment character same as delimiter"); n === !0 ? n = "#" : ("string" != typeof n || l.BAD_DELIMITERS.indexOf(n) > -1) && (n = !1), "\n" != r && "\r" != r && "\r\n" != r && (r = "\n"); var f = 0, o = !1; this.parse = function (e) {
                    function l() { return w.push(e.substr(f)), v.push(w), f = c, y && p(), u() } function d(t) {
                        v.push(w), w = [], f = t, O = e.indexOf(r, f)
                    } function u(e) {
                        return { data: v, errors: b, meta: { delimiter: t, linebreak: r, aborted: o, truncated: !!e } }
                    } function p() {
                        i(u()), v = [], b = []
                    } if ("string" != typeof e) log.debug("Input must be a string"); var c = e.length, h = t.length, m = r.length, g = n.length, y = "function" == typeof i; f = 0; var v = [], b = [], w = []; if (!e) return u(); if (s) { for (var E = e.split(r), x = 0; x < E.length; x++)if (!n || E[x].substr(0, g) != n) { if (y) { if (v = [E[x].split(t)], p(), o) return u() } else v.push(E[x].split(t)); if (a && x >= a) return v = v.slice(0, a), u(!0) } return u() } for (var D = e.indexOf(t, f), O = e.indexOf(r, f); ;)if ('"' != e[f]) if (n && 0 === w.length && e.substr(f, g) === n) { if (-1 == O) return u(); f = O + m, O = e.indexOf(r, f), D = e.indexOf(t, f) } else if (-1 !== D && (O > D || -1 === O)) w.push(e.substring(f, D)), f = D + h, D = e.indexOf(t, f); else { if (-1 === O) break; if (w.push(e.substring(f, O)), d(O + m), y && (p(), o)) return u(); if (a && v.length >= a) return u(!0) } else { var A = f; for (f++; ;) { var A = e.indexOf('"', A + 1); if (-1 === A) return b.push({ type: "Quotes", code: "MissingQuotes", message: "Quoted field unterminated", row: v.length, index: f }), l(); if (A === c - 1) return w.push(e.substring(f, A).replace(/""/g, '"')), v.push(w), y && p(), u(); if ('"' != e[A + 1]) { if (e[A + 1] == t) { w.push(e.substring(f, A).replace(/""/g, '"')), f = A + 1 + h, D = e.indexOf(t, f), O = e.indexOf(r, f); break } if (e.substr(A + 1, m) === r) { if (w.push(e.substring(f, A).replace(/""/g, '"')), d(A + 1 + m), D = e.indexOf(t, f), y && (p(), o)) return u(); if (a && v.length >= a) return u(!0); break } } else A++ } } return l()
                }, this.abort = function () { o = !0 }, this.getCharIndex = function () { return f }
            } function a(e) { "object" != typeof e && (e = {}); var t = s(e); return ("string" != typeof t.delimiter || 1 != t.delimiter.length || l.BAD_DELIMITERS.indexOf(t.delimiter) > -1) && (t.delimiter = o.delimiter), "\n" != t.newline && "\r" != t.newline && "\r\n" != t.newline && (t.newline = o.newline), "boolean" != typeof t.header && (t.header = o.header), "boolean" != typeof t.dynamicTyping && (t.dynamicTyping = o.dynamicTyping), "number" != typeof t.preview && (t.preview = o.preview), "function" != typeof t.step && (t.step = o.step), "function" != typeof t.complete && (t.complete = o.complete), "boolean" != typeof t.skipEmptyLines && (t.skipEmptyLines = o.skipEmptyLines), "boolean" != typeof t.fastMode && (t.fastMode = o.fastMode), t } function s(e) { if ("object" != typeof e) return e; var t = e instanceof Array ? [] : {}; for (var r in e) t[r] = s(e[r]); return t } function f(e) {
                return "function" == typeof e
            } var o = { delimiter: "", newline: "", header: !1, dynamicTyping: !1, preview: 0, step: void 0, comments: !1, complete: void 0, skipEmptyLines: !1, fastMode: !1 }, l = {}; return l.parse = t, l.parseFiles = e, l.unparse = r, l.RECORD_SEP = String.fromCharCode(30), l.UNIT_SEP = String.fromCharCode(31), l.BYTE_ORDER_MARK = "\ufeff", l.BAD_DELIMITERS = ["\r", "\n", '"', l.BYTE_ORDER_MARK], l.DefaultDelimiter = ",", l.Parser = i, l.ParserHandle = n, l
        }



        // function CSVParser() { function e(r, n) { if (Array.isArray(r)) { var i = []; return r.forEach(function (t) { "object" == typeof t ? i.push(e(t.file, t.config)) : i.push(e(t, n)) }), i } var i = { data: [], errors: [] }; if (!/(\.csv|\.txt)$/.test(r)) return i.errors.push({ type: "", code: "", message: "Unsupported file type.", row: "" }), i; try { var a = fs.readFileSync(r).toString(); return t(a, n) } catch (s) { return i.errors.push(s), i } } function t(e, t) { var r = a(t), i = new n(r), s = i.parse(e); return f(r.complete) && r.complete(s), s } function r(e, t) { function r() { "object" == typeof t && ("string" == typeof t.delimiter && 1 == t.delimiter.length && -1 == l.BAD_DELIMITERS.indexOf(t.delimiter) && (o = t.delimiter), ("boolean" == typeof t.quotes || t.quotes instanceof Array) && (f = t.quotes), "string" == typeof t.newline && (d = t.newline)) } function n(e) { if ("object" != typeof e) return []; var t = []; for (var r in e) t.push(r); return t } function i(e, t) { var r = ""; "string" == typeof e && (e = JSON.parse(e)), "string" == typeof t && (t = JSON.parse(t)); var n = e instanceof Array && e.length > 0, i = !(t[0] instanceof Array); if (n) { for (var s = 0; s < e.length; s++)s > 0 && (r += o), r += a(e[s], s); t.length > 0 && (r += d) } for (var f = 0; f < t.length; f++) { for (var l = n ? e.length : t[f].length, u = 0; l > u; u++) { u > 0 && (r += o); var p = n && i ? e[u] : u; r += a(t[f][p], u) } f < t.length - 1 && (r += d) } return r } function a(e, t) { if ("undefined" == typeof e || null === e) return ""; e = e.toString().replace(/"/g, '""'); var r = "boolean" == typeof f && f || f instanceof Array && f[t] || s(e, l.BAD_DELIMITERS) || e.indexOf(o) > -1 || " " == e.charAt(0) || " " == e.charAt(e.length - 1); return r ? '"' + e + '"' : e } function s(e, t) { for (var r = 0; r < t.length; r++)if (e.indexOf(t[r]) > -1) return !0; return !1 } var f = !1, o = ",", d = "\r\n"; if (r(), "string" == typeof e && (e = JSON.parse(e)), e instanceof Array) { if (!e.length || e[0] instanceof Array) return i(null, e); if ("object" == typeof e[0]) return i(n(e[0]), e) } else if ("object" == typeof e) return "string" == typeof e.data && (e.data = JSON.parse(e.data)), e.data instanceof Array && (e.fields || (e.fields = e.data[0] instanceof Array ? e.fields : n(e.data[0])), e.data[0] instanceof Array || "object" == typeof e.data[0] || (e.data = [e.data])), i(e.fields || [], e.data || []); throw "exception: Unable to serialize unrecognized input" } function n(e) { function t() { if (E && m && (p("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to '" + l.DefaultDelimiter + "'"), m = !1), e.skipEmptyLines) for (var t = 0; t < E.data.length; t++)1 == E.data[t].length && "" == E.data[t][0] && E.data.splice(t--, 1); return r() && n(), a() } function r() { return e.header && 0 == w.length } function n() { if (E) { for (var e = 0; r() && e < E.data.length; e++)for (var t = 0; t < E.data[e].length; t++)w.push(E.data[e][t]); E.data.splice(0, 1) } } function a() { if (!E || !e.header && !e.dynamicTyping) return E; for (var t = 0; t < E.data.length; t++) { for (var r = {}, n = 0; n < E.data[t].length; n++) { if (e.dynamicTyping) { var i = E.data[t][n]; "true" == i || "TRUE" === i ? E.data[t][n] = !0 : "false" == i || "FALSE" === i ? E.data[t][n] = !1 : E.data[t][n] = u(i) } e.header && (n >= w.length ? (r.__parsed_extra || (r.__parsed_extra = []), r.__parsed_extra.push(E.data[t][n])) : r[w[n]] = E.data[t][n]) } e.header && (E.data[t] = r, n > w.length ? p("FieldMismatch", "TooManyFields", "Too many fields: expected " + w.length + " fields but parsed " + n, t) : n < w.length && p("FieldMismatch", "TooFewFields", "Too few fields: expected " + w.length + " fields but parsed " + n, t)) } return e.header && E.meta && (E.meta.fields = w), E } function o(t) { for (var r, n, a, s = [",", "    ", "|", ";", l.RECORD_SEP, l.UNIT_SEP], f = 0; f < s.length; f++) { var o = s[f], d = 0, u = 0; a = void 0; for (var p = new i({ delimiter: o, preview: 10 }).parse(t), c = 0; c < p.data.length; c++) { var h = p.data[c].length; u += h, "undefined" != typeof a ? h > 1 && (d += Math.abs(h - a), a = h) : a = h } u /= p.data.length, ("undefined" == typeof n || n > d) && u > 1.99 && (n = d, r = o) } return e.delimiter = r, { successful: !!r, bestDelimiter: r } } function d(e) { e = e.substr(0, 1048576); var t = e.split("\r"); if (1 == t.length) return "\n"; for (var r = 0, n = 0; n < t.length; n++)"\n" == t[n][0] && r++; return r >= t.length / 2 ? "\r\n" : "\r" } function u(e) { var t = g.test(e); return t ? parseFloat(e) : e } function p(e, t, r, n) { E.errors.push({ type: e, code: t, message: r, row: n }) } var c, h, m, g = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i, y = this, v = 0, b = !1, w = [], E = { data: [], errors: [], meta: {} }; if (f(e.step)) { var x = e.step; e.step = function (n) { if (E = n, r()) t(); else { if (t(), 0 == E.data.length) return; v += n.data.length, e.preview && v > e.preview ? h.abort() : x(E, y) } } } this.parse = function (r) { if (e.newline || (e.newline = d(r)), m = !1, !e.delimiter) { var n = o(r); n.successful ? e.delimiter = n.bestDelimiter : (m = !0, e.delimiter = l.DefaultDelimiter), E.meta.delimiter = e.delimiter } var a = s(e); return e.preview && e.header && a.preview++, c = r, h = new i(a), E = h.parse(c), t(), !f(e.complete) || b || y.streamer && !y.streamer.finished() || e.complete(E), b ? { meta: { paused: !0 } } : E || { meta: { paused: !1 } } }, this.pause = function () { b = !0, h.abort(), c = c.substr(h.getCharIndex()) }, this.resume = function () { b = !1, h = new i(e), h.parse(c), b || (y.streamer && !y.streamer.finished() ? y.streamer.resume() : f(e.complete) && e.complete(E)) }, this.abort = function () { h.abort(), f(e.complete) && e.complete(E), c = "" } } function i(e) { e = e || {}; var t = e.delimiter, r = e.newline, n = e.comments, i = e.step, a = e.preview, s = e.fastMode; if (("string" != typeof t || 1 != t.length || l.BAD_DELIMITERS.indexOf(t) > -1) && (t = ","), n === t) throw "Comment character same as delimiter"; n === !0 ? n = "#" : ("string" != typeof n || l.BAD_DELIMITERS.indexOf(n) > -1) && (n = !1), "\n" != r && "\r" != r && "\r\n" != r && (r = "\n"); var f = 0, o = !1; this.parse = function (e) { function l() { return w.push(e.substr(f)), v.push(w), f = c, y && p(), u() } function d(t) { v.push(w), w = [], f = t, O = e.indexOf(r, f) } function u(e) { return { data: v, errors: b, meta: { delimiter: t, linebreak: r, aborted: o, truncated: !!e } } } function p() { i(u()), v = [], b = [] } if ("string" != typeof e) throw "Input must be a string"; var c = e.length, h = t.length, m = r.length, g = n.length, y = "function" == typeof i; f = 0; var v = [], b = [], w = []; if (!e) return u(); if (s) { for (var E = e.split(r), x = 0; x < E.length; x++)if (!n || E[x].substr(0, g) != n) { if (y) { if (v = [E[x].split(t)], p(), o) return u() } else v.push(E[x].split(t)); if (a && x >= a) return v = v.slice(0, a), u(!0) } return u() } for (var D = e.indexOf(t, f), O = e.indexOf(r, f); ;)if ('"' != e[f]) if (n && 0 === w.length && e.substr(f, g) === n) { if (-1 == O) return u(); f = O + m, O = e.indexOf(r, f), D = e.indexOf(t, f) } else if (-1 !== D && (O > D || -1 === O)) w.push(e.substring(f, D)), f = D + h, D = e.indexOf(t, f); else { if (-1 === O) break; if (w.push(e.substring(f, O)), d(O + m), y && (p(), o)) return u(); if (a && v.length >= a) return u(!0) } else { var A = f; for (f++; ;) { var A = e.indexOf('"', A + 1); if (-1 === A) return b.push({ type: "Quotes", code: "MissingQuotes", message: "Quoted field unterminated", row: v.length, index: f }), l(); if (A === c - 1) return w.push(e.substring(f, A).replace(/""/g, '"')), v.push(w), y && p(), u(); if ('"' != e[A + 1]) { if (e[A + 1] == t) { w.push(e.substring(f, A).replace(/""/g, '"')), f = A + 1 + h, D = e.indexOf(t, f), O = e.indexOf(r, f); break } if (e.substr(A + 1, m) === r) { if (w.push(e.substring(f, A).replace(/""/g, '"')), d(A + 1 + m), D = e.indexOf(t, f), y && (p(), o)) return u(); if (a && v.length >= a) return u(!0); break } } else A++ } } return l() }, this.abort = function () { o = !0 }, this.getCharIndex = function () { return f } } function a(e) { "object" != typeof e && (e = {}); var t = s(e); return ("string" != typeof t.delimiter || 1 != t.delimiter.length || l.BAD_DELIMITERS.indexOf(t.delimiter) > -1) && (t.delimiter = o.delimiter), "\n" != t.newline && "\r" != t.newline && "\r\n" != t.newline && (t.newline = o.newline), "boolean" != typeof t.header && (t.header = o.header), "boolean" != typeof t.dynamicTyping && (t.dynamicTyping = o.dynamicTyping), "number" != typeof t.preview && (t.preview = o.preview), "function" != typeof t.step && (t.step = o.step), "function" != typeof t.complete && (t.complete = o.complete), "boolean" != typeof t.skipEmptyLines && (t.skipEmptyLines = o.skipEmptyLines), "boolean" != typeof t.fastMode && (t.fastMode = o.fastMode), t } function s(e) { if ("object" != typeof e) return e; var t = e instanceof Array ? [] : {}; for (var r in e) t[r] = s(e[r]); return t } function f(e) { return "function" == typeof e } var o = { delimiter: "", newline: "", header: !1, dynamicTyping: !1, preview: 0, step: void 0, comments: !1, complete: void 0, skipEmptyLines: !1, fastMode: !1 }, l = {}; return l.parse = t, l.parseFiles = e, l.unparse = r, l.RECORD_SEP = String.fromCharCode(30), l.UNIT_SEP = String.fromCharCode(31), l.BYTE_ORDER_MARK = "\ufeff", l.BAD_DELIMITERS = ["\r", "\n", '"', l.BYTE_ORDER_MARK], l.DefaultDelimiter = ",", l.Parser = i, l.ParserHandle = n, l }

        return {
            getInputData: getInputData,
            map: map,
            //reduce: reduce,
            //        summarize: summarize
        };

    });
