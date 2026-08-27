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
             id: 'customsearch421'
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
             var dataPull = CSVParser().parse(fileContents);
             var dataArray = dataPull.data
             log.debug('dataArray', dataArray);
             if (dataArray.length > 0) {
                 for (var xx = 1; xx < dataArray.length; xx++) {
                     var dataDisplay = dataArray[xx]
                     var dataDisplayString = dataDisplay.toString();
                     var dataDisplaySplit = dataDisplayString.split(',');
                     var sku = dataDisplaySplit[0]
                     var manufacturer_name = dataDisplaySplit[1]
                     var manufacturer_number = dataDisplaySplit[2]
                     var upc = dataDisplaySplit[3]
                     var cost = dataDisplaySplit[4]
                     var price = dataDisplaySplit[5]
                     var list_price = dataDisplaySplit[6]
                     var product_name = dataDisplaySplit[7]
                     var description = dataDisplaySplit[8]
                     var collection = dataDisplaySplit[9]
                     var designer = dataDisplaySplit[10]
                     var manufacturer_finish = dataDisplaySplit[11]
                     var manufacturer_glass = dataDisplaySplit[12]
                     var crystal = dataDisplaySplit[13]
                     var notes = dataDisplaySplit[14]
                     var width = dataDisplaySplit[15]
                     var height = dataDisplaySplit[16]
                     var length = dataDisplaySplit[17]
                     var weight = dataDisplaySplit[18]
                     var extension = dataDisplaySplit[19]
                     var chain = dataDisplaySplit[20]
                     var wire = dataDisplaySplit[21]
                     var bulbs_included = dataDisplaySplit[22]
                     var number_of_bulbs = dataDisplaySplit[23]
                     var max_wattage = dataDisplaySplit[24]
                     var bulb_type = dataDisplaySplit[25]
                     var bulb_base = dataDisplaySplit[26]
                     var light_source = dataDisplaySplit[27]
                     var light_output = dataDisplaySplit[28]
                     var color_temperature = dataDisplaySplit[29]
                     var cri = dataDisplaySplit[30]
                     var dimmable = dataDisplaySplit[31]
                     var beam_spread = dataDisplaySplit[32]
                     var rated_average_life = dataDisplaySplit[33]
                     var voltage = dataDisplaySplit[34]
                     var fan_airflow = dataDisplaySplit[35]
                     var fan_electricity_use = dataDisplaySplit[36]
                     var airflow_efficiency = dataDisplaySplit[37]
                     var blade_pitch = dataDisplaySplit[38]
                     var blade_span = dataDisplaySplit[39]
                     var blade_type = dataDisplaySplit[40]
                     var blade_finish = dataDisplaySplit[41]
                     var blade_qty = dataDisplaySplit[42]
                     var reverse_air = dataDisplaySplit[43]
                     var fan_speeds = dataDisplaySplit[44]
                     var light_kit = dataDisplaySplit[45]
                     var fan_control = dataDisplaySplit[46]
                     var fan_downrod = dataDisplaySplit[47]
                     var product_url = dataDisplaySplit[48]
                     log.debug('product_url', product_url)
                     var material = dataDisplaySplit[49]
                     var country_of_origin = dataDisplaySplit[50]
                     var safety_listing = dataDisplaySplit[51]
                     var safety_rating = dataDisplaySplit[52]
                     var energy_star = dataDisplaySplit[53]
                     var ada = dataDisplaySplit[54]
                     var dark_sky = dataDisplaySplit[55]
                     var manufacturer_warranty = dataDisplaySplit[56]
                     var intro_date = dataDisplaySplit[57]
                     var spec_sheet = dataDisplaySplit[58]
                     var instructions = dataDisplaySplit[59]
                     var parts_diagram = dataDisplaySplit[60]
                     var image = dataDisplaySplit[61]
                     var shipped_via = dataDisplaySplit[62]
                     var drop_ship = dataDisplaySplit[63]
                     var carton_volume = dataDisplaySplit[64]
                     var dimensional_weight = dataDisplaySplit[65]
                     var active = dataDisplaySplit[66]
                     var uniqueID = dataDisplaySplit[67]
                     var inputObject = new Object()
                     inputObject.sku = sku
                     inputObject.manufacturer_name = manufacturer_name
                     inputObject.manufacturer_number = manufacturer_number
                     inputObject.upc = upc
                     inputObject.cost = cost
                     inputObject.price = price
                     inputObject.list_price = list_price
                     inputObject.product_name = product_name
                     inputObject.description = description
                     inputObject.collection = collection
                     inputObject.designer = designer
                     inputObject.manufacturer_finish = manufacturer_finish
                     inputObject.manufacturer_glass = manufacturer_glass
                     inputObject.crystal = crystal
                     inputObject.notes = notes
                     inputObject.width = width
                     inputObject.height = height
                     inputObject.length = length
                     inputObject.weight = weight
                     inputObject.extension = extension
                     inputObject.chain = chain
                     inputObject.wire = wire
                     inputObject.bulbs_included = bulbs_included
                     inputObject.number_of_bulbs = number_of_bulbs
                     inputObject.max_wattage = max_wattage
                     inputObject.bulb_type = bulb_type
                     inputObject.bulb_base = bulb_base
                     inputObject.light_source = light_source
                     inputObject.light_output = light_output
                     inputObject.color_temperature = color_temperature
                     inputObject.cri = cri
                     inputObject.dimmable = dimmable
                     inputObject.beam_spread = beam_spread
                     inputObject.rated_average_life = rated_average_life
                     inputObject.voltage = voltage
                     inputObject.fan_airflow = fan_airflow
                     inputObject.fan_electricity_use = fan_electricity_use
                     inputObject.airflow_efficiency = airflow_efficiency
                     inputObject.blade_pitch = blade_pitch
                     inputObject.blade_span = blade_span
                     inputObject.blade_type = blade_type
                     inputObject.blade_finish = blade_finish
                     inputObject.blade_qty = blade_qty
                     inputObject.reverse_air = reverse_air
                     inputObject.fan_speeds = fan_speeds
                     inputObject.light_kit = light_kit
                     inputObject.fan_control = fan_control
                     inputObject.fan_downrod = fan_downrod
                     inputObject.product_url = product_url
                     inputObject.material = material
                     inputObject.country_of_origin = country_of_origin
                     inputObject.safety_listing = safety_listing
                     inputObject.safety_rating = safety_rating
                     inputObject.energy_star = energy_star
                     inputObject.ada = ada
                     inputObject.dark_sky = dark_sky
                     inputObject.manufacturer_warranty = manufacturer_warranty
                     inputObject.intro_date = intro_date
                     inputObject.spec_sheet = spec_sheet
                     inputObject.instructions = instructions
                     inputObject.parts_diagram = parts_diagram
                     inputObject.image = image
                     inputObject.shipped_via = shipped_via
                     inputObject.drop_ship = drop_ship
                     inputObject.carton_volume = carton_volume
                     inputObject.dimensional_weight = dimensional_weight
                     inputObject.active = active
                     inputObject.uniqueID = uniqueID
                     //   log.debug('inputObject', inputObject)
                     var scriptObj = runtime.getCurrentScript();
                     //    log.debug('Deployment Id: ' + scriptObj.deploymentId);
                     context.write(inputObject)
                 }
                 // var scriptObj = runtime.getCurrentScript();
                 // log.debug('Deployment Id: ' + scriptObj.deploymentId);

           fileObj.folder = 392;
                 var fileId = fileObj.save();
                 log.error('fileId - deploy 1', fileId)
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

         //  log.debug('parsedKey', parsedKey)

         var uniqueID = parsedKey.uniqueID
         var returnedItemID = findItemInternal(uniqueID)
         if (returnedItemID) {
             var returnRec = runEditCustom(parsedKey, returnedItemID)
         }
         else {
             var returnRec = runCreateCustom(parsedKey)
         }

         return
     }
     const runCreateCustom = (parsedKey) => {
         try {
             var getInternalIDKey = internalIDKey()
             var getValueKey = valueIDKey()
             var custRec = record.create({
                 type: 'customrecord_zastro_la_data_dump'
             })
             for (var x = 0; x < getInternalIDKey.length; x++) {
                 var keyValue = getValueKey[x]
                 var valueDrop = parsedKey[`${keyValue}`]
                 //  log.debug('keyValue',keyValue)
                 //  log.debug('getInternalIDKey[x]',getInternalIDKey[x])
                 //  log.debug('valueDrop',valueDrop)
                 custRec.setValue({
                     fieldId: getInternalIDKey[x],
                     value: valueDrop
                 })
             }
             var rec = custRec.save()
             return rec
         }
         catch (e) {
             log.error('e on cust cre', e)
         }
     }

     const runEditCustom = (parsedKey, returnedItemID) => {
         try {
             var getInternalIDKey = internalIDKey()
             var getValueKey = valueIDKey()
             var custRec = record.load({
                 type: 'customrecord_zastro_la_data_dump',
                 id: returnedItemID
             })
             for (var x = 0; x < getInternalIDKey.length; x++) {
                 var keyValue = getValueKey[x]
                 var valueDrop = parsedKey[`${keyValue}`]
                 custRec.setValue({
                     fieldId: getInternalIDKey[x],
                     value: valueDrop
                 })
             }
             var rec = custRec.save()
             return rec
         }
         catch (e) {
             log.error('e on cust edit', e)
         }
     }

     const findItemInternal = (objName) => {
         try {
             //  log.debug('objName', objName)
             var returnedID = ''
             var itemSearchObj = search.create({
                 type: "customrecord_zastro_la_data_dump",
                 filters:
                     [
                         ["custrecord_zas_unique_id", "is", objName]
                     ],
                 columns:
                     [
                         "internalid"
                     ]
             });
             var searchResultCount = itemSearchObj.runPaged().count;
             //    log.debug("itemSearchObj result count", searchResultCount);
             itemSearchObj.run().each(function (result) {
                 // .run().each has a limit of 4,000 results
                 var itemInternalID = result.getValue({
                     name: 'internalid'
                 })
                 returnedID = itemInternalID
                 return true;
             });
             return returnedID
         }
         catch (e) {
             log.debug('e in find ID', e)
         }
     }

     const idParser = (result, startPoint) => {

         let newResult = JSON.stringify(result)
         let n = newResult.search(startPoint)
         let subResult = newResult.substring(n, newResult.length)
         //  log.debug('subresult', subResult)
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

     const valueIDKey = () => {
         var valueArray = [
             'sku',
             'manufacturer_name',
             'manufacturer_number',
             'upc',
             'cost',
             'price',
             'list_price',
             'product_name',
             'description',
             'collection',
             'designer',
             'manufacturer_finish',
             'manufacturer_glass',
             'crystal',
             'notes',
             'width',
             'height',
             'length',
             'weight',
             'extension',
             'chain',
             'wire',
             'bulbs_included',
             'number_of_bulbs',
             'max_wattage',
             'bulb_type',
             'bulb_base',
             'light_source',
             'light_output',
             'color_temperature',
             'cri',
             'dimmable',
             'beam_spread',
             'rated_average_life',
             'voltage',
             'fan_airflow',
             'fan_electricity_use',
             'airflow_efficiency',
             'blade_pitch',
             'blade_span',
             'blade_type',
             'blade_finish',
             'blade_qty',
             'reverse_air',
             'fan_speeds',
             'light_kit',
             'fan_control',
             'fan_downrod',
             'product_url',
             'material',
             'country_of_origin',
             'safety_listing',
             'safety_rating',
             'energy_star',
             'ada',
             'dark_sky',
             'manufacturer_warranty',
             'intro_date',
             'spec_sheet',
             'instructions',
             'parts_diagram',
             'image',
             'shipped_via',
             'drop_ship',
             'carton_volume',
             'dimensional_weight',
             'active',
             'uniqueID'
         ]
         return valueArray
     }



     const internalIDKey = () => {
         var keyArray = [
             'custrecord_zas_lightsamerica_sku',
             'custrecord_zas_manufacturer_name',
             'custrecord_zas_manufacturer_number',
             'custrecord_zas_upc',
             'custrecord_zas_cost',
             'custrecord_zas_regular_price',
             'custrecord_zas_list_price',
             'custrecord_zas_product_name',
             'custrecord_zas_description',
             'custrecord_zas_collection',
             'custrecord_zas_designer',
             'custrecord_zas_manufacturer_finish',
             'custrecord_zas_manufacturer_glass',
             'custrecord_zas_crystal',
             'custrecord_zas_notes',
             'custrecord_zas_width__diameter',
             'custrecord_zas_height',
             'custrecord_zas_length',
             'custrecord_zas_weight',
             'custrecord_zas_extension',
             'custrecord_zas_chain',
             'custrecord_zas_wire',
             'custrecord_zas_bulbs_included',
             'custrecord_zas_number_of_bulbs',
             'custrecord_zas_max_wattage',
             'custrecord_zas_bulb_type',
             'custrecord_zas_bulb_base',
             'custrecord_zas_light_source',
             'custrecord_zas_light_output',
             'custrecord_zas_color_temperature',
             'custrecord_zas_cri',
             'custrecord_zas_dimmable',
             'custrecord_zas_beam_spread',
             'custrecord_zas_rated_average_life',
             'custrecord_zas_voltage',
             'custrecord_zas_fan_airflow',
             'custrecord_zas_fan_electricity_use',
             'custrecord_zas_airflow_efficiency',
             'custrecord_zas_blade_pitch',
             'custrecord_zas_blade_span',
             'custrecord_zas_blade_type',
             'custrecord_zas_blade_finish',
             'custrecord_zas_blade_qty',
             'custrecord_zas_reverse_air',
             'custrecord_zas_fan_speeds',
             'custrecord_zas_light_kit',
             'custrecord_zas_fan_control',
             'custrecord_zas_fan_downrod',
             'custrecord_zas_product_url',
             'custrecord_zas_material',
             'custrecord_zas_country_of_origin',
             'custrecord_zas_safety_listing',
             'custrecord_zas_safety_rating',
             'custrecord_zas_energy_star',
             'custrecord_zas_ada',
             'custrecord_zas_dark_sky',
             'custrecord_zas_manufacturer_warranty',
             'custrecord_zas_intro_date',
             'custrecord_zas_spec_sheet',
             'custrecord_zas_instructions',
             'custrecord_zas_parts_diagram',
             'custrecord_zas_image',
             'custrecord_zas_shipped_via',
             'custrecord_zas_drop_ship',
             'custrecord_zas_carton_volume',
             'custrecord_zas_dimensional_weight',
             'custrecord_zas_active',
             'custrecord_zas_unique_id'
         ]
         return keyArray
     }

     function CSVParser() { function e(r, n) { if (Array.isArray(r)) { var i = []; return r.forEach(function (t) { "object" == typeof t ? i.push(e(t.file, t.config)) : i.push(e(t, n)) }), i } var i = { data: [], errors: [] }; if (!/(\.csv|\.txt)$/.test(r)) return i.errors.push({ type: "", code: "", message: "Unsupported file type.", row: "" }), i; try { var a = fs.readFileSync(r).toString(); return t(a, n) } catch (s) { return i.errors.push(s), i } } function t(e, t) { var r = a(t), i = new n(r), s = i.parse(e); return f(r.complete) && r.complete(s), s } function r(e, t) { function r() { "object" == typeof t && ("string" == typeof t.delimiter && 1 == t.delimiter.length && -1 == l.BAD_DELIMITERS.indexOf(t.delimiter) && (o = t.delimiter), ("boolean" == typeof t.quotes || t.quotes instanceof Array) && (f = t.quotes), "string" == typeof t.newline && (d = t.newline)) } function n(e) { if ("object" != typeof e) return []; var t = []; for (var r in e) t.push(r); return t } function i(e, t) { var r = ""; "string" == typeof e && (e = JSON.parse(e)), "string" == typeof t && (t = JSON.parse(t)); var n = e instanceof Array && e.length > 0, i = !(t[0] instanceof Array); if (n) { for (var s = 0; s < e.length; s++)s > 0 && (r += o), r += a(e[s], s); t.length > 0 && (r += d) } for (var f = 0; f < t.length; f++) { for (var l = n ? e.length : t[f].length, u = 0; l > u; u++) { u > 0 && (r += o); var p = n && i ? e[u] : u; r += a(t[f][p], u) } f < t.length - 1 && (r += d) } return r } function a(e, t) { if ("undefined" == typeof e || null === e) return ""; e = e.toString().replace(/"/g, '""'); var r = "boolean" == typeof f && f || f instanceof Array && f[t] || s(e, l.BAD_DELIMITERS) || e.indexOf(o) > -1 || " " == e.charAt(0) || " " == e.charAt(e.length - 1); return r ? '"' + e + '"' : e } function s(e, t) { for (var r = 0; r < t.length; r++)if (e.indexOf(t[r]) > -1) return !0; return !1 } var f = !1, o = ",", d = "\r\n"; if (r(), "string" == typeof e && (e = JSON.parse(e)), e instanceof Array) { if (!e.length || e[0] instanceof Array) return i(null, e); if ("object" == typeof e[0]) return i(n(e[0]), e) } else if ("object" == typeof e) return "string" == typeof e.data && (e.data = JSON.parse(e.data)), e.data instanceof Array && (e.fields || (e.fields = e.data[0] instanceof Array ? e.fields : n(e.data[0])), e.data[0] instanceof Array || "object" == typeof e.data[0] || (e.data = [e.data])), i(e.fields || [], e.data || []); throw "exception: Unable to serialize unrecognized input" } function n(e) { function t() { if (E && m && (p("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to '" + l.DefaultDelimiter + "'"), m = !1), e.skipEmptyLines) for (var t = 0; t < E.data.length; t++)1 == E.data[t].length && "" == E.data[t][0] && E.data.splice(t--, 1); return r() && n(), a() } function r() { return e.header && 0 == w.length } function n() { if (E) { for (var e = 0; r() && e < E.data.length; e++)for (var t = 0; t < E.data[e].length; t++)w.push(E.data[e][t]); E.data.splice(0, 1) } } function a() { if (!E || !e.header && !e.dynamicTyping) return E; for (var t = 0; t < E.data.length; t++) { for (var r = {}, n = 0; n < E.data[t].length; n++) { if (e.dynamicTyping) { var i = E.data[t][n]; "true" == i || "TRUE" === i ? E.data[t][n] = !0 : "false" == i || "FALSE" === i ? E.data[t][n] = !1 : E.data[t][n] = u(i) } e.header && (n >= w.length ? (r.__parsed_extra || (r.__parsed_extra = []), r.__parsed_extra.push(E.data[t][n])) : r[w[n]] = E.data[t][n]) } e.header && (E.data[t] = r, n > w.length ? p("FieldMismatch", "TooManyFields", "Too many fields: expected " + w.length + " fields but parsed " + n, t) : n < w.length && p("FieldMismatch", "TooFewFields", "Too few fields: expected " + w.length + " fields but parsed " + n, t)) } return e.header && E.meta && (E.meta.fields = w), E } function o(t) { for (var r, n, a, s = [",", "    ", "|", ";", l.RECORD_SEP, l.UNIT_SEP], f = 0; f < s.length; f++) { var o = s[f], d = 0, u = 0; a = void 0; for (var p = new i({ delimiter: o, preview: 10 }).parse(t), c = 0; c < p.data.length; c++) { var h = p.data[c].length; u += h, "undefined" != typeof a ? h > 1 && (d += Math.abs(h - a), a = h) : a = h } u /= p.data.length, ("undefined" == typeof n || n > d) && u > 1.99 && (n = d, r = o) } return e.delimiter = r, { successful: !!r, bestDelimiter: r } } function d(e) { e = e.substr(0, 1048576); var t = e.split("\r"); if (1 == t.length) return "\n"; for (var r = 0, n = 0; n < t.length; n++)"\n" == t[n][0] && r++; return r >= t.length / 2 ? "\r\n" : "\r" } function u(e) { var t = g.test(e); return t ? parseFloat(e) : e } function p(e, t, r, n) { E.errors.push({ type: e, code: t, message: r, row: n }) } var c, h, m, g = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i, y = this, v = 0, b = !1, w = [], E = { data: [], errors: [], meta: {} }; if (f(e.step)) { var x = e.step; e.step = function (n) { if (E = n, r()) t(); else { if (t(), 0 == E.data.length) return; v += n.data.length, e.preview && v > e.preview ? h.abort() : x(E, y) } } } this.parse = function (r) { if (e.newline || (e.newline = d(r)), m = !1, !e.delimiter) { var n = o(r); n.successful ? e.delimiter = n.bestDelimiter : (m = !0, e.delimiter = l.DefaultDelimiter), E.meta.delimiter = e.delimiter } var a = s(e); return e.preview && e.header && a.preview++, c = r, h = new i(a), E = h.parse(c), t(), !f(e.complete) || b || y.streamer && !y.streamer.finished() || e.complete(E), b ? { meta: { paused: !0 } } : E || { meta: { paused: !1 } } }, this.pause = function () { b = !0, h.abort(), c = c.substr(h.getCharIndex()) }, this.resume = function () { b = !1, h = new i(e), h.parse(c), b || (y.streamer && !y.streamer.finished() ? y.streamer.resume() : f(e.complete) && e.complete(E)) }, this.abort = function () { h.abort(), f(e.complete) && e.complete(E), c = "" } } function i(e) { e = e || {}; var t = e.delimiter, r = e.newline, n = e.comments, i = e.step, a = e.preview, s = e.fastMode; if (("string" != typeof t || 1 != t.length || l.BAD_DELIMITERS.indexOf(t) > -1) && (t = ","), n === t) throw "Comment character same as delimiter"; n === !0 ? n = "#" : ("string" != typeof n || l.BAD_DELIMITERS.indexOf(n) > -1) && (n = !1), "\n" != r && "\r" != r && "\r\n" != r && (r = "\n"); var f = 0, o = !1; this.parse = function (e) { function l() { return w.push(e.substr(f)), v.push(w), f = c, y && p(), u() } function d(t) { v.push(w), w = [], f = t, O = e.indexOf(r, f) } function u(e) { return { data: v, errors: b, meta: { delimiter: t, linebreak: r, aborted: o, truncated: !!e } } } function p() { i(u()), v = [], b = [] } if ("string" != typeof e) throw "Input must be a string"; var c = e.length, h = t.length, m = r.length, g = n.length, y = "function" == typeof i; f = 0; var v = [], b = [], w = []; if (!e) return u(); if (s) { for (var E = e.split(r), x = 0; x < E.length; x++)if (!n || E[x].substr(0, g) != n) { if (y) { if (v = [E[x].split(t)], p(), o) return u() } else v.push(E[x].split(t)); if (a && x >= a) return v = v.slice(0, a), u(!0) } return u() } for (var D = e.indexOf(t, f), O = e.indexOf(r, f); ;)if ('"' != e[f]) if (n && 0 === w.length && e.substr(f, g) === n) { if (-1 == O) return u(); f = O + m, O = e.indexOf(r, f), D = e.indexOf(t, f) } else if (-1 !== D && (O > D || -1 === O)) w.push(e.substring(f, D)), f = D + h, D = e.indexOf(t, f); else { if (-1 === O) break; if (w.push(e.substring(f, O)), d(O + m), y && (p(), o)) return u(); if (a && v.length >= a) return u(!0) } else { var A = f; for (f++; ;) { var A = e.indexOf('"', A + 1); if (-1 === A) return b.push({ type: "Quotes", code: "MissingQuotes", message: "Quoted field unterminated", row: v.length, index: f }), l(); if (A === c - 1) return w.push(e.substring(f, A).replace(/""/g, '"')), v.push(w), y && p(), u(); if ('"' != e[A + 1]) { if (e[A + 1] == t) { w.push(e.substring(f, A).replace(/""/g, '"')), f = A + 1 + h, D = e.indexOf(t, f), O = e.indexOf(r, f); break } if (e.substr(A + 1, m) === r) { if (w.push(e.substring(f, A).replace(/""/g, '"')), d(A + 1 + m), D = e.indexOf(t, f), y && (p(), o)) return u(); if (a && v.length >= a) return u(!0); break } } else A++ } } return l() }, this.abort = function () { o = !0 }, this.getCharIndex = function () { return f } } function a(e) { "object" != typeof e && (e = {}); var t = s(e); return ("string" != typeof t.delimiter || 1 != t.delimiter.length || l.BAD_DELIMITERS.indexOf(t.delimiter) > -1) && (t.delimiter = o.delimiter), "\n" != t.newline && "\r" != t.newline && "\r\n" != t.newline && (t.newline = o.newline), "boolean" != typeof t.header && (t.header = o.header), "boolean" != typeof t.dynamicTyping && (t.dynamicTyping = o.dynamicTyping), "number" != typeof t.preview && (t.preview = o.preview), "function" != typeof t.step && (t.step = o.step), "function" != typeof t.complete && (t.complete = o.complete), "boolean" != typeof t.skipEmptyLines && (t.skipEmptyLines = o.skipEmptyLines), "boolean" != typeof t.fastMode && (t.fastMode = o.fastMode), t } function s(e) { if ("object" != typeof e) return e; var t = e instanceof Array ? [] : {}; for (var r in e) t[r] = s(e[r]); return t } function f(e) { return "function" == typeof e } var o = { delimiter: "", newline: "", header: !1, dynamicTyping: !1, preview: 0, step: void 0, comments: !1, complete: void 0, skipEmptyLines: !1, fastMode: !1 }, l = {}; return l.parse = t, l.parseFiles = e, l.unparse = r, l.RECORD_SEP = String.fromCharCode(30), l.UNIT_SEP = String.fromCharCode(31), l.BYTE_ORDER_MARK = "\ufeff", l.BAD_DELIMITERS = ["\r", "\n", '"', l.BYTE_ORDER_MARK], l.DefaultDelimiter = ",", l.Parser = i, l.ParserHandle = n, l }


     return {
         getInputData: getInputData,
         map: map,
         reduce: reduce,
         //        summarize: summarize
     };

 });

