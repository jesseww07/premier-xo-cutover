"""Build data/XO_Reference_Matrix.csv from sweep outputs.

Merges: sweep targets (category), populated counts, grep hits (classified
pipeline vs live), script activity, sourcing references, and the handoff's
locked dispositions into one deliverable CSV.

Decision log baked in here:
  2026-08-21  handoff: 20 LA fields survive (relabel), rest retire; custitem5/7 repurpose
  2026-08-25  la_max_wattage kept (21st survivor); zastro PO-consolidation estate is
              live ops (KEEP); Solupay out of scope entirely (not a target)
"""
import csv
import re
from collections import defaultdict

from common import DATA

OUT = DATA / 'XO_Reference_Matrix.csv'

# --- classification of corpus files -----------------------------------------
LA_PIPELINE_RE = re.compile(
    r'pr_la_item_update|copy_item_ue_null_la_fields|pr_new_la_|LightsAmericaIntegration|'
    r'LA SKU|LA Sku|La_name_fix|laint_|csvRowToItemRec|step_1|step1_v2|pr_update_la_fields|'
    r'pr_new_link_custom_and_item|prem_deleteSkulessItems|delete\.js|loadThenSave', re.IGNORECASE)

# script file -> (script name, scriptid, type, active) from prod query 2026-08-25
SCRIPT_STATUS = {
    'Unified Catalog Analysis.js': ('Unified Catalog Analysis MR', 'customscript_unified_catalog_analysis_mr', 'MAPREDUCE', True),
    'cl_wf_bucket_consolidated.js': ('Bucket Consolidated PO Items v2', 'customscript325', 'ACTION', True),
    'dropship_check_ue.js': ('dropship_check_ue', 'customscriptdropship_check_ue', 'USEREVENT', True),
    'ill_vendor_update_esd.js': ('Update PO ESDs from Vendor', 'customscript2488', 'SUITELET', True),
    'illum_link_po_back_to_so.js': ('Link PO Back to Sales Order', 'customscript347', 'ACTION', True),
    'illuminet_auto_create_cr_specials.js': ('Consolidated | Auto Create CR off PO', 'customscript2811', 'USEREVENT', True),
    'illuminet_order_consolidated_sl.js': ('Generate Master Consolidated POs', 'customscript_illuminet_generate_master_p', 'SUITELET', True),
    'illuminet_special_order_data_rec.js': ('Generate Special Order Data Records MR', 'customscript_zas_generate_spcl_ord_data', 'MAPREDUCE', True),
    'item record report.js': ('Item Record Quick Report', 'customscript_item_record_quick_report', 'SCHEDULED', True),
    'lyte_sl_add_item.js': ('Inbound Shipment | Add Items', 'customscript_lyte_sl_add_item', 'SUITELET', True),
    'prCreateSalesOrderSL.js': ('Create Sales Order - SL', 'customscript_pr_create_so_sl', 'SUITELET', True),
    'prSetPOOnUnconsolPO.js': ('Set PO on Unconsolidated PO Record', 'customscript_pr_set_po_on_unconsol_po', 'SCHEDULED', False),
    'pr_change_order_approve.js': ('Approve Item Change Request', 'customscript326', 'ACTION', True),
    'pr_china_con_sl.js': ('China Consolidated SL', 'customscript696', 'SUITELET', True),
    'pr_cl_edit_consol.js': ('Mark Change to Item Quantity - Consol', 'customscript_pr_mark_change_qty_consol', 'CLIENT', False),
    'pr_client_bulb.js': ('pr_client_bulb', 'customscript314', 'CLIENT', False),
    'pr_create_consol_po.js': ('WF - 2.0 Create PO - Consolidated', 'customscript323', 'ACTION', True),
    'pr_emailCSVRecRepV2.js': ('REC REPORT V2', 'customscript1211', 'SCHEDULED', True),
    'pr_emailCSVRecRep_sch.js': ('PL Email Daily Rec Report', 'customscript_pl_email_daily_rec_rep', 'SCHEDULED', True),
    'pr_emailCSVRecRep_sch2.js': ('PL Email Daily Rec Report(On Demand)', 'customscript_pl_email_daily_rec_rep_once', 'SCHEDULED', False),
    'pr_exis_sl.js': ('Consolidate Test', 'customscript_pr_consol_sl', 'SUITELET', True),
    'pr_generate_po.js': ('Generate PO (UE)', 'customscript288', 'USEREVENT', True),
    'pr_loc_sl.js': ('Merge Location - SL', 'customscript298', 'SUITELET', True),
    'pr_loc_ue.js': ('Merge Location - UE', 'customscript299', 'USEREVENT', True),
    'pr_lock_consolidate_cl.js': ('Lock Consolidated in Client of PREMCOL', 'customscript2813', 'CLIENT', True),
    'pr_mark_consolidated.js': ('Utility | Mark All Consolidated SO', 'customscript2894', 'ACTION', True),
    'pr_rec_report_sl.js': ('Receiving Report SL Call', 'customscript829', 'SUITELET', True),
    'pr_sl_add_item.js': ('Add Items To Order SL', 'customscript_pr_sl_add_item', 'SUITELET', False),
    'pr_sl_hold_inv.js': ('Suitelet - Move to Hold', 'customscript683', 'SUITELET', True),
    'pr_sum_consolidated.js': ('Sum Totals of Unconsolidated POs', 'customscript348', 'USEREVENT', True),
    'pr_ue_edit_consol.js': ('Update Quantity on Consol', 'customscript_pr_update_qty_on_consol', 'USEREVENT', False),
    'pr_update_display.js': ('Update Display Name', 'customscript804', 'MAPREDUCE', True),
    'preGenerateSOLabels.js': ('Generate SO Labels - SL', 'customscript_pre_gen_so_labels_sl', 'SUITELET', False),
    'pre_inbd_esd_sl.js': ('Inbound Ship | Update ESD and Tracking S', 'customscript_pre_inbd_ship_update_es_sl', 'SUITELET', True),
    'premierLinkConnector_wfa.js': ('Premier Link Connector WFA', 'customscript_premier_link_connector_wfa', 'ACTION', True),
    'premier_in_arrear_po_create.js': ('In Arrear PO Creator', 'customscript2500', 'SCHEDULED', True),
    'so_con_connect_unique.js': ('Connect SO and Special Order', 'customscript_pr_connect_so_special', 'SCHEDULED', True),
    'suitelet_generate_code.js': ('Print Item Labels - Consolidation', 'customscript301', 'SUITELET', False),
    'wf_consolidate_items.js': ('WF - Consolidate Items off SO v2', 'customscript297', 'ACTION', True),
    'wf_consolidate_items_mr.js': ('Consolidate Items - MR', 'customscript_pr_consolidate_items_mr', 'MAPREDUCE', True),
}

# keep-21 / repurpose target state (handoff locked + 2026-08-25 decisions)
TARGET_STATE = {
    'custitem_la_height': ('RELABEL', 'Height', 'Height'),
    'custitem_la_product_name': ('RELABEL', 'Product Name', 'Item Name'),
    'custitem_la_collection': ('RELABEL', 'Collection', 'Family'),
    'custitem_la_image': ('RELABEL', 'Primary Image', 'Image Path'),
    'custitem_la_product_url': ('RELABEL', 'Item URL', 'Item URL (prepend XO domain)'),
    'custitem_la_number_of_bulbs': ('RELABEL', 'Number of Bulbs', 'Extra-Number of Bulbs (coalesce Of-variant)'),
    'custitem_la_bulb_base': ('RELABEL', 'Bulb Base', 'Extra-Bulb Base'),
    'custitem_la_safety_listing': ('RELABEL', 'Safety Rating', 'Extra-Safety Rating  [semantics: holds ETL/UL]'),
    'custitem_la_safety_rating': ('RELABEL', 'Location Rating', 'Extra-Location Rating  [semantics: holds Damp/Wet]'),
    'custitem_la_bulb_type': ('RELABEL', 'Bulb Type', 'Extra-Bulb Type'),
    'custitem_la_voltage': ('RELABEL', 'Voltage', 'Extra-Voltage (strip units)'),
    'custitem_la_material': ('RELABEL', 'Material', 'Extra-Material'),
    'custitem_la_finish': ('RELABEL', 'Finish', 'Extra-Finish  [backfill from la_manufacturer_finish first: 204,504 rows]'),
    'custitem_la_width': ('RELABEL', 'Width', 'Width  [backfill from la_width_diameter first: 45,816 rows]'),
    'custitem_la_length': ('RELABEL', 'Length', 'Length'),
    'custitem_la_upc': ('RELABEL', 'UPC / GTIN', 'GTIN (14-digit, keep leading zeros; zero-strip for compares)'),
    'custitem_la_color_temperature': ('RELABEL', 'Kelvin', 'Extra-Kelvin'),
    'custitem_la_light_output': ('RELABEL', 'Lumens', 'Extra-Initial Lumens'),
    'custitem_la_cri': ('RELABEL', 'CRI', 'Extra-Bulb CRI'),
    'custitem_la_dimmable': ('RELABEL', 'Dimmable', 'Extra-Bulb Dimmable'),
    'custitem_la_max_wattage': ('RELABEL', 'Wattage', 'Extra-Bulb Wattage (strip units)  [kept per 2026-08-25 decision - 21st survivor, 543,145 rows]'),
    'custitem5': ('REPURPOSE', 'IMAP', 'IMAP  [label already set; 0 populated]'),
    'custitem7': ('REPURPOSE', 'XO Item ID', 'ItemID (NOT XOItemID)  [overwrites 11,676 VendorContactId values]'),
    'custitem_atlas_style': ('REPURPOSE', 'XO Style', 'Standard-Style  [bundle-owned: relabel via UI; 167,984 rows in Atlas Style list]'),
    'custitem6': ('KEEP AS-IS', 'Is Light Bulb', 'never rename; custcol_premier_is_bulb sources from it (5,365 T)'),
    'custitem_spec_sheet_link': ('KEEP + XO-SOURCE', 'Spec Sheet Hyperlink', 'file-N-FilePath where FileDescr ~ Spec'),
}

RETIRE_NOTES = {
    'custitem_la_cost': 'pricing native: itemvendor.purchaseprice (662,590) is the record',
    'custitem_la_price': 'pricing native: duplicate of MSRP price level',
    'custitem_la_list_price': 'pricing native: MSRP price level 1 (676,596) is the record',
    'custitem_la_manufacturer_name': 'vendor table + Preferred Vendor carry this; REMAP FARAPP FIRST',
    'custitem_la_drop_ship': 'redundant with native isdropshipitem',
    'custitem_la_width_diameter': 'superseded by gen-2 la_width; BACKFILL 45,816 rows into la_width first',
    'custitem_la_manufacturer_finish': 'superseded by gen-2 la_finish; BACKFILL 204,504 rows into la_finish first',
    'custitem_la_price_changed_date': 'system notes carry price history; XO supplies change dates',
    'custitem_la_spec_sheet': 'custitem_spec_sheet_link survives; retire customworkflow59 + premier_link_connector_wfa with it',
    'custitem_la_sku': 'LA identity; List/Record -> customrecord_zastro_lights_items (retire field before record type)',
    'custitem_la_unique_id': 'LA identity (668,783) - snapshot before inactivation',
    'custitem_lights_sku': 'LA identity (332,743) - snapshot before inactivation',
    'custitem_webstore_link': 'non-LA but 0 populated and no writers - retire candidate (Jesse confirm)',
    'custitem_zastro_la_updated_at': 'LA feed timestamp (439,856) - retires with pipeline',
}

CHECKBOX_NOTES = {
    'custitem_atlas_closeout': 'checkbox: only 3 TRUE - effectively empty',
    'custitem_zastro_special_order': 'checkbox: 683,881 TRUE',
    'custitem_laitem_do_not_update': 'checkbox: 1 TRUE - effectively empty',
    'custitem6': 'checkbox: 5,365 TRUE',
}

SOURCING_REFS = {
    'custitem_la_image': 'SOURCED BY custcol_pr_prod_url (frProduct URL)',
    'custitem_la_product_url': 'SOURCED BY custcol_webstore_link (Webstore Link)',
    'custitem_spec_sheet_link': 'SOURCED BY custcol_spec_sheet (Spec Sheet)',
    'custitem6': 'SOURCED BY custcol_premier_is_bulb (Is Light Bulb)',
    'custitem_la_upc': 'FARAPP connector mapping (barcode) - remap by hand',
    'custitem_la_manufacturer_name': 'FARAPP connector mapping - remap by hand BEFORE retirement',
    'customrecord_zastro_lights_items': 'REFERENCED BY custitem_la_sku (select) + custcol_la_item_link (select, label "LA Data Dump")',
}

CATEGORY_DISPOSITION = {
    'retire_resolved': 'RETIRE (resolved)',
    'la_identity': 'RETIRE (identity)',
    'la_field': 'RETIRE',
    'la_gen2': 'RETIRE',
    'la_adjacent': 'RETIRE',
    'atlas': 'RETIRE',
    'zastro': 'RETIRE (with pipeline)',
    'farapp': 'OUT OF SCOPE (FarApp-owned)',
    'adjacent': 'OUT OF SCOPE',
    'dead_nonla': 'RETIRE CANDIDATE (confirm)',
    'zastro_rectype': 'see rectype split',
    'la_rectype': 'RETIRE (with pipeline)',
    'zastro_list': 'see list split',
    'workflow': 'see workflow audit',
    'column': 'KEEP (sourcing column)',
    'zastro_column': 'KEEP (live ops)',
    'protected': 'KEEP AS-IS',
    'repurpose': 'REPURPOSE',
    'keeper_nonla': 'KEEP + XO-SOURCE',
    'keep20': 'RELABEL',
}

OVERRIDES = {
    'custitem_zastro_special_order': 'KEEP - referenced by customworkflow35 (Set Item Defaults, ACTIVE) + 11 saved searches; 683,881 TRUE; writers retire with pipeline (new writer TBD)',
    'customrecord_zastro_po_consolid': 'KEEP - load-bearing for PO-consolidation ops (14+ live scripts, customworkflow18)',
    'customrecord_zastro_unconsolidated_items': 'KEEP - load-bearing for PO-consolidation ops (17+ live scripts)',
    'customrecord_zastro_api_scheduler': 'RETIRE (LA integration)',
    'customrecord_zastro_la_adhoc_queue': 'RETIRE (LA integration)',
    'customrecord_zastro_la_data_dump': 'RETIRE (LA integration)',
    'customrecord_zastro_la_processor_queue': 'RETIRE (LA integration)',
    'customrecord_zastro_lights_file_config': 'RETIRE (LA integration)',
    'customrecord_zastro_lights_items': 'RETIRE (LA integration) - first retire custitem_la_sku + custcol_la_item_link + rewrite/retire pr_update_display MR',
    'customrecord_zastro_lights_wishlist_cfg': 'RETIRE (LA integration)',
    'customrecord_la_csv_row': 'RETIRE (LA integration)',
    'customrecord_manufacturer_mapping': 'RETIRE (LA integration - only pipeline references)',
    'customlist_zas_tracking_carrier': 'KEEP - used by inbound-ESD flow (ill_vendor_update_esd, pre_inbd_esd_sl) + custcol_pr_vendor_provided_carrier',
    'customlist_zastro_lights_prod_action': 'RETIRE (LA integration)',
    'customlist_zastro_lights_p_status': 'RETIRE (LA integration)',
    'customlist_zastro_lights_statuses': 'RETIRE (LA integration)',
    'customworkflow59': 'RETIRE (locked) - with premier_link_connector_wfa',
    'customworkflow_la_sku_to_item': 'RETIRE (LA integration, status TESTING)',
    'customworkflow31': 'KEEP (Internal ID as Display Name) - audited',
    'customworkflow42': 'KEEP (Preferred Vendor Mandatory) - audited',
    'customworkflow35': 'KEEP (Set Item Defaults) - audited; references custitem_zastro_special_order',
}


def disposition(scriptid, category):
    if scriptid in OVERRIDES:
        return OVERRIDES[scriptid]
    if scriptid in TARGET_STATE:
        return TARGET_STATE[scriptid][0]
    return CATEGORY_DISPOSITION.get(category, '?')


def main():
    counts = {}
    with open(DATA / 'populated_counts.csv', encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh):
            counts[r['scriptid']] = int(r['populated'])

    targets = []
    with open(DATA / 'sweep_targets.csv', encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh):
            targets.append((r['scriptid'].strip().lower(), r['category'].strip()))

    live_refs = defaultdict(list)
    pipeline_count = defaultdict(int)
    surface = defaultdict(lambda: defaultdict(int))
    with open(DATA / 'reference_matrix_raw.csv', encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh):
            f = r['file']
            sid = r['scriptid']
            if f.startswith('objects:') and f.lower().endswith('/' + sid.lower() + '.xml'):
                continue  # the target's own definition file
            base = f.split('/')[-1]
            if f.startswith('filecabinet') and LA_PIPELINE_RE.search(f):
                pipeline_count[sid] += 1
            elif f.startswith('filecabinet'):
                nm, _s, _t, active = SCRIPT_STATUS.get(base, (base, '', '?', None))
                tag = 'ACTIVE' if active else ('INACTIVE' if active is False else 'status?')
                live_refs[sid].append(f'{nm} [{tag}]')
            elif f.startswith('objects:savedsearch'):
                surface[sid]['searches'] += 1
            elif f.startswith('objects:entryform'):
                surface[sid]['forms'] += 1
            elif f.startswith('objects:workflow'):
                live_refs[sid].append(f'workflow:{base[:-4]}')
            elif f.startswith('objects:advancedpdftemplate'):
                surface[sid]['pdf_templates'] += 1
            else:
                live_refs[sid].append(f'object:{base}')

    with open(OUT, 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.writer(fh, lineterminator='\n')
        w.writerow(['scriptid', 'category', 'populated', 'disposition', 'new_label', 'xo_source',
                    'live_references', 'searches', 'forms', 'pdf_templates',
                    'pipeline_refs(retire together)', 'notes'])
        for sid, cat in targets:
            label = TARGET_STATE.get(sid, ('', '', ''))[1]
            xo = TARGET_STATE.get(sid, ('', '', ''))[2]
            notes = '; '.join(x for x in (RETIRE_NOTES.get(sid, ''), CHECKBOX_NOTES.get(sid, ''),
                                          SOURCING_REFS.get(sid, '')) if x)
            w.writerow([sid, cat, counts.get(sid, ''), disposition(sid, cat), label, xo,
                        ' | '.join(sorted(set(live_refs.get(sid, [])))),
                        surface[sid]['searches'], surface[sid]['forms'], surface[sid]['pdf_templates'],
                        pipeline_count.get(sid, 0), notes])
    print('Wrote', OUT.name, f'({len(targets)} targets)')


if __name__ == '__main__':
    main()
