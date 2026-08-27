/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record'], function (search, record) {

    function getInputData() {
        // Load the custom search 'customsearch1490'
        return search.load({ id: 'customsearch_laitem_update' });
    }

    function map(context) {
        var searchResult = JSON.parse(context.value);
        log.debug('Search Result', searchResult);

        var csvRowUniqueId = searchResult.values.custrecord_csvrow_uniqueid;
        log.debug('CSV Row Unique ID', csvRowUniqueId);

        var zastroSearch = search.create({
            type: 'customrecord_zastro_lights_items',
            filters: [
                ['custrecord_lights_unique_id', 'equalto', csvRowUniqueId],
                'AND',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        });

        var zastroResult = zastroSearch.run().getRange({ start: 0, end: 1 });
        log.debug('Zastro Result', zastroResult);

        var laItemId = zastroResult.length > 0 ? zastroResult[0].getValue('internalid') : null;

        context.write({
            key: csvRowUniqueId,
            value: JSON.stringify({
                csvRowId: searchResult.id,
                laItemId: laItemId
            })
        });

        if (laItemId) {
            log.audit('Data Passed to Reduce', `CSV Row ID: ${searchResult.id}, Lights America Item ID: ${laItemId}`);
        } else {
            log.audit('No Match Found', `No Zastro record found for CSV Row Unique ID: ${csvRowUniqueId}`);
        }
    }

    function reduce(context) {
        var key = context.key;
        var values = context.values.map(JSON.parse);
        log.debug('Reduce Values', values);

        values.forEach(function (value) {
            var csvRowId = value.csvRowId;
            var laItemId = value.laItemId;

            var csvRecord = record.load({
                type: 'customrecord_la_csv_row',
                id: csvRowId
            });

            var laItemRecord;

            if (laItemId) {
                // Load existing Lights America item record
                laItemRecord = record.load({
                    type: 'customrecord_zastro_lights_items',
                    id: laItemId
                });
                log.audit('Existing Record Loaded', `Lights America Item ID: ${laItemId}`);
            } else {
                // Create a new Lights America item record
                laItemRecord = record.create({
                    type: 'customrecord_zastro_lights_items',
                    isDynamic: true
                });
                log.audit('New Record Created', `Creating new Lights America Item for CSV Row ID: ${csvRowId}`);
            }

            let mappings = {
                'custrecord_csvrow_lightsamericasku': 'custrecord_lights_sku',
                'custrecord_csvrow_manufacturername': 'custrecord_lights_mfr_name',
                'custrecord_csvrow_manufacturernumber': 'custrecord_lights_mfr_number',
                'custrecord_csvrow_upc': 'custrecord_lights_upc',
                'custrecord_csvrow_cost': 'custrecord_lights_cost',
                'custrecord_csvrow_regularprice': 'custrecord_lights_regular_price',
                'custrecord_csvrow_listprice': 'custrecord_lights_list_price',
                'custrecord_csvrow_productname': 'custrecord_lights_name',
                'custrecord_csvrow_description': 'custrecord_lights_description',
                'custrecord_csvrow_collection': 'custrecord_lights_collection',
                'custrecord_csvrow_designer': 'custrecord_lights_designer',
                'custrecord_csvrow_manufacturerfinish': 'custrecord_lights_mfr_finish',
                'custrecord_csvrow_manufacturerglass': 'custrecord_lights_mfr_glass',
                'custrecord_csvrow_crystal': 'custrecord_lights_crystal',
                'custrecord_csvrow_notes': 'custrecord_lights_notes',
                'custrecord_csvrow_widthdiameter': 'custrecord_lights_width_diameter',
                'custrecord_csvrow_height': 'custrecord_lights_height',
                'custrecord_csvrow_length': 'custrecord_lights_length',
                'custrecord_csvrow_weight': 'custrecord_lights_weight',
                'custrecord_csvrow_extension': 'custrecord_lights_extension',
                'custrecord_csvrow_chain': 'custrecord_lights_chain',
                'custrecord_csvrow_wire': 'custrecord_lights_wire',
                'custrecord_csvrow_bulbsincluded': 'custrecord_lights_bulbs_included',
                'custrecord_csvrow_numberofbulbs': 'custrecord_lights_no_bulbs',
                'custrecord_csvrow_maxwattage': 'custrecord_lights_max_wattage',
                'custrecord_csvrow_bulbtype': 'custrecord_lights_bulb_type',
                'custrecord_csvrow_bulbbase': 'custrecord_lights_bulb_base',
                'custrecord_csvrow_lightsource': 'custrecord_lights_light_source',
                'custrecord_csvrow_lightoutput': 'custrecord_lights_light_output',
                'custrecord_csvrow_colortemperature': 'custrecord_lights_color_temperature',
                'custrecord_csvrow_cri': 'custrecord_lights_cri',
                'custrecord_csvrow_dimmable': 'custrecord_lights_dimmable',
                'custrecord_csvrow_beamspread': 'custrecord_lights_beam_spread',
                'custrecord_csvrow_ratedaveragelife': 'custrecord_lights_rated_avg_life',
                'custrecord_csvrow_voltage': 'custrecord_lights_voltage',
                'custrecord_csvrow_producturl': 'custrecord_lights_url',
                'custrecord_csvrow_material': 'custrecord_lights_material',
                'custrecord_csvrow_safetylisting': 'custrecord_lights_safety_listing',
                'custrecord_csvrow_safetyrating': 'custrecord_lights_safety_rating',
                'custrecord_csvrow_image': 'custrecord_lights_image',
                'custrecord_csvrow_shippedvia': 'custrecord_lights_shipped_via',
                'custrecord_csvrow_dropship': 'custrecord_lights_drop_ship',
                'custrecord_csvrow_cartonvolume': 'custrecord_lights_carton_volume',
                'custrecord_csvrow_dimensionalweight': 'custrecord_lights_dimensional_weight',
                'custrecord_csvrow_active': 'custrecord_lights_active',
                'custrecord_csvrow_uniqueid': 'custrecord_lights_unique_id',
                'custrecord_csvrow_fanairflow': 'custrecord_lights_fan_airflow',
                'custrecord_csvrow_fanelectricityuse': 'custrecord_lights_fan_eltcty_use',
                'custrecord_csvrow_airflowefficiency': 'custrecord_lights_airflow_eff',
                'custrecord_csvrow_bladepitch': 'custrecord_lights_blade_pitch',
                'custrecord_csvrow_bladespan': 'custrecord_lights_blade_span',
                'custrecord_csvrow_bladetype': 'custrecord_lights_blade_type',
                'custrecord_csvrow_bladefinish': 'custrecord_lights_blade_finish',
                'custrecord_csvrow_bladeqty': 'custrecord_lights_blade_qty',
                'custrecord_csvrow_reverseair': 'custrecord_lights_reverse_air',
                'custrecord_csvrow_fanspeeds': 'custrecord_lights_fan_speeds',
                'custrecord_csvrow_lightkit': 'custrecord_lights_light_kit',
                'custrecord_csvrow_fancontrol': 'custrecord_lights_fan_control',
                'custrecord_csvrow_fandownrod': 'custrecord_lights_fan_downrod',
                'custrecord_csvrow_countryoforigin': 'custrecord_lights_country_of_origin',
                'custrecord_csvrow_energystar': 'custrecord_lights_energy_star',
                'custrecord_csvrow_ada': 'custrecord_lights_ada',
                'custrecord_csvrow_darksky': 'custrecord_lights_dark_sky',
                'custrecord_csvrow_manufacturerwarranty': 'custrecord_lights_mfr_warranty',
                'custrecord_csvrow_introdate': 'custrecord_lights_intro_date',
                'custrecord_csvrow_specsheet': 'custrecord_lights_spec_sheet',
                'custrecord_csvrow_instructions': 'custrecord_lights_instructions',
                'custrecord_csvrow_partsdiagram': 'custrecord_lights_parts_diagram',
           }

            for (var csvField in mappings) {
                var laField = mappings[csvField];
                var value = csvRecord.getValue(csvField);
                if (value) {
                    laItemRecord.setValue({
                        fieldId: laField,
                        value: value
                    });
                }
            }

            // Save the updated or new Lights America item record
          try{
            var savedId = laItemRecord.save();
            log.audit('Record Saved', `Lights America Item ID: ${savedId}`);
          }
          catch(e){
            log.error("coulndt save",e)
          }

            // Mark the CSV row as processed
            csvRecord.setValue({
                fieldId: 'custrecord_csvrow_processed_v2',
                value: true
            });
            csvRecord.save();
            log.audit('CSV Row Processed', `CSV Row ID: ${csvRowId} marked as processed.`);
        });
    }

    function summarize(summary) {
        log.audit('Summary', {
            mapErrors: summary.mapSummary.errors,
            reduceErrors: summary.reduceSummary.errors
        });
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
