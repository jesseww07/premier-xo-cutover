
define(['N/record', 'N/search'], function (record, search) {
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     */
    var exports = {};

    function beforeLoad(context) {
        if (context.type != 'copy') {
            return;
        }

        var itemRecord = context.newRecord;

        var laItemCopiedFieldIdsToNull = [
            'custitem_la_manufacturer_name',     //Manufacturer Name
            'custitem_la_upc',  //UPC
            'custitem_la_cost', //Cost
            'custitem_la_price',        //Regular Price
            'custitem_la_list_price',   //List Price
            'custitem_la_product_name', //Product Name
            'salesdescription',  //Description
            'custitem_la_collection',     //Collection
            'custitem_la_designer',     //Designer
            'custitem_la_finish', //Manufacturer Finish
            'custitem_la_manufacturer_glass',    //Manufacturer Glass
            'custitem_la_crystal',      //Crystal
            'custitem_la_notes',        //Notes
            'custitem_la_width',      //Width Diameter
            'custitem_la_height',     //Height
            'custitem_la_length',     //Length
            'custitem_la_weight',       //Weight
            'custitem_la_extension',    //Extension
            'custitem_la_chain',        //Chain
            'custitem_la_wire', //Wire
            'custitem_la_bulbs_included',       //Bulbs Included
            'custitem_la_number_of_bulbs',     //Number of Bulbs
            'custitem_la_max_wattage',  //Max Wattage
            'custitem_la_bulb_type',    //Bulb Type
            'custitem_la_bulb_base',    //Bulb Base
            'custitem_la_light_source', //Light Source
            'custitem_la_light_output', //Light Output
            'custitem_la_color_temperature',    //Color Temp
            'custitem_la_cri',  //CRI
            'custitem_la_dimmable',     //Dimmable
            'custitem_la_beam_spread',  //Beam Spread
            'custitem_la_rated_average_life',       //Rated Average Life
            'custitem_la_voltage',      //Voltage
            'custitem_la_fan_airflow',  //Fan Airlow
            'custitem_la_fan_electricity_use',       //Fan Electricity Use
            'custitem_la_airflow_efficiency',  //Airflow Efficiency
            'custitem_la_blade_pitch',  //Blade Pitch
            'custitem_la_blade_span',   //Blade Span
            'custitem_la_blade_type',   //Blade Type
            'custitem_la_blade_finish', //Blade Finish
            'custitem_la_blade_qty',    //Blade Qty
            'custitem_la_reverse_air',  //Reverse Air
            'custitem_la_fan_speeds',   //Fan Speeds
            'custitem_la_light_kit',    //Light Kit
            'custitem_la_fan_control',  //Fan Control
            'custitem_la_fan_downrod',  //Fan Downrod
            'custitem_la_product_url',  //Product URL
            'custitem_la_material',     //Material
            'custitem_la_country_of_origin',    //COO
            'custitem_la_safety_listing',       //Safety Listing
            'custitem_la_safety_rating',        //Safety Rating
            'custitem_la_energy_star',  //Energy Star
            'custitem_la_ada',  //ADA
            'custitem_la_dark_sky',     //Dark Sky
            'custitem_la_manufacturer_warranty', //Manu Warranty
            'custitem_la_intro_date',   //Intro Date
            'custitem_la_spec_sheet',   //Spec Sheet
            'custitem_la_instructions', //Instructions
            'custitem_la_parts_diagram',        //Parts Diagram
            'custitem_la_image',        //Image
            'custitem_la_shipped_via',  //Shipped Via
            'custitem_la_drop_ship',    //Drop Ship
            'custitem_la_carton_volume',        //Carton Volume f
            'custitem_la_dimensional_weight',   //Dim Weight
            'custitem_la_active',       //Active
            'custitem_la_unique_id',    //Unique ID
        ];

        //Iterate over the nullable fields list and set the value to null
        for (var i = 0; i < laItemCopiedFieldIdsToNull.length; i++) {
            var nullableFieldId = laItemCopiedFieldIdsToNull[i];
            log.debug('SETTING_FIELDID_TO_NULL', nullableFieldId);
            itemRecord.setValue({
                fieldId: nullableFieldId,
                value: null
            });
        }
    }

    exports.beforeLoad = beforeLoad;
    return exports;
});

