"""Generate the redesigned Inventory Part entry form for the SDF ACP.

Input   corpus/sb1-2026-08-28/objects/entryform/custform_xo_confirm.xml
        (immutable snapshot; see that folder's README - it is SB1's live
        custform_217_7513000_136 with the install-breaking duplicate Locations
        subList already stripped and SDF-normalised)

Output  sdf/xo-cutover-acp/src/Objects/custform_xo_inventory_item.xml

The layout is docs/Item_Form_Redesign.md section 3, made executable. Per findings 4a the
form must be BORN in SDF under its own scriptid - SDF cannot update the UI-created
custform_217_7513000_136 in this account.

Rules encoded here
------------------
* Every field named in LAYOUT is moved to its group, in the order written, and made
  visible (that is the point of moving it) unless it is in KEEP_HIDDEN.
* Every *custom* field NOT named in LAYOUT is hidden where it sits. Native fields not
  named are left completely alone - NetSuite's defaults are right for them.
* Tabs are ordered and labelled per TAB_ORDER / TAB_LABELS; anything not in TAB_ORDER
  is hidden.
* Nothing is deleted. Hiding is step zero of inactivating, and free to reverse.

Run `python scripts/build_form.py --report` to see what the build hides that is
visible on the form today.
"""
import argparse
import sys
import xml.etree.ElementTree as ET

from common import ACP_OBJECTS, REPO

BASE = REPO / 'corpus' / 'sb1-2026-08-28' / 'objects' / 'entryform' / 'custform_xo_confirm.xml'
OUT = ACP_OBJECTS / 'custform_xo_inventory_item.xml'

SCRIPTID = 'custform_xo_inventory_item'
FORM_NAME = 'Inventory Item'

# Tab ids as they appear in <tab><id>. Custom tabs are referenced by scriptid.
PURCH = 'ITEMINVENTORY'
SALES = 'ITEMPRICING'
SPECS = '[scriptid=custtab_25_t2379072_560]'
ACCT = 'ITEMACCOUNTING'
INTEG = '[scriptid=custtab_xo_integrations]'
RELREC = 'ITEMRELRECORDS'
COMM = 'ITEMCOMMUNICATION'
SYSINFO = 'ITEMSYSTEMINFORMATION'
MAIN = '__main__'

# Visible tabs, in the order staff should read them (section 3).
TAB_ORDER = [PURCH, SALES, SPECS, ACCT, INTEG, RELREC, COMM, SYSINFO]

TAB_LABELS = {
    PURCH: 'Purchasing / Inventory',
    SALES: 'Sales / Pricing',
    SPECS: 'Specifications',
    ACCT: 'Accounting',
    INTEG: 'Integrations',
    RELREC: 'Related Records & Analytics',
    COMM: 'Communication',
    SYSINFO: 'System Information',
}

# Field groups, in display order per container. ('scriptid', 'Label', [field specs])
# A field spec is a scriptid/native id, or (id, label) to override the form label.
# Groups whose scriptid is a NetSuite standard name (primaryinformation, ...) are
# reused; fieldgroup_xo_* are created by this build.
LAYOUT = {
    MAIN: [
        ('primaryinformation', 'Primary Information', [
            'CUSTOMFORM',
            'ITEMID',
            'custitem_la_product_name',
            'DISPLAYNAME',
            'custitem_la_upc',
            'UPCCODE',
            ('VENDORNAME', 'Vendor Code'),
            'PARENT',
            'INTERNALID',
        ]),
        ('fieldgroup_xo_catalog', 'Catalog', [
            'MANUFACTURER',
            'custitem_la_collection',
            'custitem_la_finish',
            ('custitem_atlas_style', 'XO Style'),
            'custitem_la_image',
            ('custitem_la_product_url', 'Item URL'),
        ]),
        ('classification', 'Classification', [
            'SUBSIDIARY',
            'CLASS',
            'DEPARTMENT',
            'LOCATION',
            'custitem6',
            'ISINACTIVE',
        ]),
    ],
    PURCH: [
        ('itemcostdetail', None, [
            'COST',
            'LASTPURCHASEPRICE',
            'PURCHASEDESCRIPTION',
            'COSTINGMETHOD',
            'AVERAGECOST',
            'TOTALVALUE',
            'TRACKLANDEDCOST',
            'STOCKDESCRIPTION',
            'ISDROPSHIPITEM',
            'ISSPECIALORDERITEM',
            'custitem_zastro_special_order',
            'MATCHBILLTORECEIPT',
        ]),
        ('fieldgroup_xo_availability', 'XO Availability & Ordering', [
            'custitem_xo_in_stock',
            'custitem_xo_backorder_date',
            'custitem_xo_order_minimum',
            'custitem_xo_order_multiple',
            'custitem_xo_vendor_disc_cost',
            'custitem_xo_cost_w_shipping',
        ]),
        ('fieldgroup_xo_units', 'Units', [
            'UNITSTYPE',
            'BASEUNIT',
        ]),
        ('manufacturing', None, [
            'MPN',
        ]),
        ('inventorymanagement', None, []),
        ('vendorbillmatching', None, []),
    ],
    SALES: [
        ('sales', None, []),
        ('fieldgroup_xo_map', 'MAP Pricing', [
            'custitem5',
            ('custitem_xo_umap', 'XO UMAP'),
        ]),
        ('pricing', None, []),
        ('pricingshipping', None, [
            'WEIGHT',
        ]),
    ],
    SPECS: [
        ('fieldgroup_xo_dimensions', 'Dimensions', [
            'custitem_la_width',
            'custitem_la_height',
            'custitem_la_length',
        ]),
        ('fieldgroup_xo_lighting', 'Lighting', [
            'custitem_la_bulb_type',
            ('custitem_la_bulb_base', 'Bulb Base'),
            'custitem_la_number_of_bulbs',
            'custitem_la_max_wattage',
            'custitem_la_color_temperature',
            'custitem_la_light_output',
            'custitem_la_cri',
            'custitem_la_voltage',
            'custitem_la_dimmable',
        ]),
        ('fieldgroup_xo_materials', 'Materials', [
            'custitem_la_material',
        ]),
        ('fieldgroup_xo_ratings', 'Ratings & Compliance', [
            ('custitem_la_safety_listing', 'Safety Rating'),
            ('custitem_la_safety_rating', 'Location Rating'),
            'custitem_xo_prop65',
            'custitem_xo_prop65_desc',
            'custitem_xo_title20',
            'custitem_xo_title24',
        ]),
        ('fieldgroup_xo_documents', 'Documents', [
            'custitem_spec_sheet_link',
        ]),
    ],
    ACCT: [
        ('accounts', None, []),
        ('taxtariff', None, [
            'TAXSCHEDULE',
        ]),
        ('fieldgroup_xo_tax', 'Tax', [
            'custitem_ste_taxschedule',
            'custitem_ste_item_taxitem_type',
            'custitem_ste_taxschedule_coachingtext',
            'custitem_ste_oss_taxschedule',
            'custitem_tss_non_taxable',
        ]),
    ],
    INTEG: [
        ('fieldgroup_xo_sync', 'XO Sync', [
            ('custitem7', 'XO Item ID'),
            'custitem_xo_last_changed',
            'custitem_xo_availability_changed',
            'custitem_xo_catalog_changed',
            'custitem_xo_price_changed',
            'custitem_xo_keywords',
        ]),
        ('fieldgroup_xo_shopify', 'Shopify', [
            'custitem_fa_shopify_flag',
            'custitem_shopify_store',
            'custitem_sync_shopify',
            'custitem_isonline',
            'custitem_fa_shopify_handle',
            'custitem_fa_shpfy_prodtype',
            'custitem_fa_shpfy_tags',
            'custitem_fa_shpfy_metatitl',
            'custitem_fa_shpfy_metadesc',
            'custitem_fa_shpfy_metafld',
            'custitem_fa_shpfy_reqship',
            'custitem_fa_shpfy_backords',
            'custitem_fa_shpfy_pub_at',
            'custitem_fa_shpfy_pubscope',
            'custitem_list_on_shopify_temporary_fie',
            'custitem_leaves_shopify_inventory',
        ]),
        ('fieldgroup_xo_connector', 'NetSuite Connector', [
            'custitemlastpostedtofarapp',
        ]),
    ],
    COMM: [
        ('fieldgroup_xo_files', 'Files', [
            'custitem_bc_item_file_attachment',
        ]),
    ],
}

# Moved but deliberately left hidden - homed on the form, not shown.
KEEP_HIDDEN = {
    # EU one-stop-shop schedule from the tax bundle; no US relevance at Premier.
    'custitem_ste_oss_taxschedule',
    # native identity fields that are hidden on the current form; the redesign homes
    # them but does not change that decision
    'PARENT',
    'INTERNALID',
    'DEPARTMENT',
    'LOCATION',
    'STOCKDESCRIPTION',
    'MATCHBILLTORECEIPT',
    'TRACKLANDEDCOST',
}

# Sublists that move tabs. sublist id -> destination tab id.
SUBLIST_MOVES = {
    '[scriptid=custsublist_atlas_core_sales_and_margin]': RELREC,
    '[scriptid=custsublist_atlas_core_po_3way_match]': RELREC,
    '[scriptid=custsublist_atlas_core_hist_item_sales]': RELREC,
    '[scriptid=custsublist_atlas_core_open_sales_orders]': RELREC,
    '[scriptid=custsublist_atlas_core_open_pur_by_item]': RELREC,
    '[scriptid=custsublist_atlas_core_mth_item_qty_sold]': RELREC,
    '[appid=com.netsuite.nsconnector, scriptid=customrecord_fa_synced_items.custrecord_fa_synced_item]': INTEG,
}

# Subtabs dropped from the form entirely. Setting <visible>F</visible> on ITEMMATRIX makes
# SDF reject the whole form with a bare "Internal Server Error" (bisected in SB1 2026-08-28);
# removing the element installs cleanly. Matrix items are not used at Premier.
SUBTABS_REMOVED = ['ITEMMATRIX']

# Sublists hidden on a tab that stays visible (section 3 does not list them).
SUBLISTS_HIDDEN = [
    '[scriptid=customrecord_scm_item_substitute.custrecord_scm_itemsub_parent]',
    '[scriptid=customrecord_scm_customerpartnumber.custrecord_scm_cpn_item]',
    'ITEMHIERARCHYVERSIONS',
]

FIELD_ORDER = ['id', 'label', 'visible', 'mandatory', 'displayType',
               'columnBreak', 'sameRowAsPrevious']
GROUP_ORDER = ['label', 'visible', 'showTitle', 'singleColumn', 'fields']
TAB_CHILD_ORDER = ['id', 'label', 'visible', 'fieldGroups', 'subItems']


# --------------------------------------------------------------------- helpers

def reorder(el, order):
    kids = list(el)
    for k in kids:
        el.remove(k)
    for name in order:
        for k in kids:
            if k.tag == name:
                el.append(k)
    for k in kids:
        if k.tag not in order:
            el.append(k)


def is_custom(field_id):
    return field_id.startswith('[')


def key_of(field_id):
    """'[appid=x, scriptid=custitem7]' -> 'custitem7'; 'ITEMID' -> 'ITEMID'."""
    if not is_custom(field_id):
        return field_id
    for part in field_id.strip('[]').split(','):
        part = part.strip()
        if part.startswith('scriptid='):
            return part[len('scriptid='):]
    return field_id


class Form:
    def __init__(self, path):
        self.root = ET.parse(path).getroot()
        self.fields = {}          # key -> (element, parent <fields>)
        for fields in self.root.iter('fields'):
            for f in fields:
                if f.tag == 'field':
                    self.fields[key_of(f.findtext('id'))] = (f, fields)
        self.tabs = {t.findtext('id'): t for t in self.root.find('tabs')}
        self.sublists = {}
        for parent in list(self.root.iter('subItems')) + list(self.root.iter('subLists')):
            for sl in parent:
                if sl.tag == 'subList':
                    self.sublists[sl.findtext('id')] = (sl, parent)

    # -- containers ------------------------------------------------------

    def container(self, tab_id):
        return self.root.find('mainFields') if tab_id == MAIN else self.tabs[tab_id]

    def fieldgroups_of(self, tab_id):
        c = self.container(tab_id)
        if c.tag == 'mainFields':
            return c
        fg = c.find('fieldGroups')
        if fg is None:
            fg = ET.SubElement(c, 'fieldGroups')
            reorder(c, TAB_CHILD_ORDER)
        return fg

    def group(self, tab_id, scriptid, label=None):
        """Find or create a <fieldGroup>; return its <fields> element."""
        fgs = self.fieldgroups_of(tab_id)
        for g in fgs:
            if g.tag == 'fieldGroup' and g.get('scriptid') == scriptid:
                if label is not None:
                    g.find('label').text = label
                g.find('visible').text = 'T'
                flds = g.find('fields')
                if flds is None:
                    flds = ET.SubElement(g, 'fields')
                    flds.set('position', 'MIDDLE')
                    reorder(g, GROUP_ORDER)
                return flds
        g = ET.Element('fieldGroup')
        g.set('scriptid', scriptid)
        for tag, val in (('label', label or scriptid), ('visible', 'T'),
                         ('showTitle', 'T'), ('singleColumn', 'F')):
            ET.SubElement(g, tag).text = val
        flds = ET.SubElement(g, 'fields')
        flds.set('position', 'MIDDLE')
        dfg = fgs.find('defaultFieldGroup')
        fgs.insert(list(fgs).index(dfg) if dfg is not None else len(fgs), g)
        return flds

    def order_groups(self, tab_id, scriptids):
        """Put the named groups first, in that order; keep the rest after."""
        fgs = self.fieldgroups_of(tab_id)
        groups = [g for g in fgs if g.tag == 'fieldGroup']
        named = {g.get('scriptid'): g for g in groups}
        for g in groups:
            fgs.remove(g)
        at = 0
        for sid in scriptids:
            g = named.pop(sid, None)
            if g is not None:
                fgs.insert(at, g)
                at += 1
        for g in named.values():
            fgs.insert(at, g)
            at += 1

    # -- fields ----------------------------------------------------------

    def place(self, key, target_fields, label=None, visible='T', at=None):
        """Home a field in target_fields.

        A field that is ALREADY in this group is left exactly where it sits - only its
        label and visibility change. Reordering fields inside a NetSuite-standard group
        makes SDF reject the whole form with a bare "Internal Server Error" (found by
        bisection in SB1, 2026-08-28: moving TOTALVALUE within `itemcostdetail` is enough
        to trigger it). Fields arriving from another group are inserted at `at`, so the
        layout controls order in the groups this build creates.
        """
        el, parent = self.fields[key]
        if parent is not target_fields:
            parent.remove(el)
            if at is None:
                target_fields.append(el)
            else:
                target_fields.insert(min(at, len(target_fields)), el)
            self.fields[key] = (el, target_fields)
        if label is not None:
            el.find('label').text = label
        el.find('visible').text = visible
        for tag in ('columnBreak', 'sameRowAsPrevious'):
            node = el.find(tag)
            if node is not None:
                node.text = 'F'
        reorder(el, FIELD_ORDER)
        return el

    def hide(self, key):
        el, _ = self.fields[key]
        el.find('visible').text = 'F'

    # -- sublists / tabs -------------------------------------------------

    def move_sublist(self, sublist_id, tab_id):
        el, parent = self.sublists[sublist_id]
        tab = self.tabs[tab_id]
        si = tab.find('subItems')
        if si is None:
            si = ET.SubElement(tab, 'subItems')
            reorder(tab, TAB_CHILD_ORDER)
        parent.remove(el)
        si.append(el)
        self.sublists[sublist_id] = (el, si)

    def set_tab(self, tab_id, label=None, visible=None):
        tab = self.tabs[tab_id]
        if label is not None:
            tab.find('label').text = label
        if visible is not None:
            tab.find('visible').text = visible

    def order_tabs(self, ids):
        tabs = self.root.find('tabs')
        kids = {t.findtext('id'): t for t in tabs}
        for t in list(tabs):
            tabs.remove(t)
        for tid in ids:
            if tid in kids:
                tabs.append(kids.pop(tid))
        for t in kids.values():
            tabs.append(t)


def indent(el, level=0):
    pad = '\n' + '  ' * level
    if len(el):
        if not (el.text or '').strip():
            el.text = pad + '  '
        for child in el:
            indent(child, level + 1)
        if not (el[-1].tail or '').strip():
            el[-1].tail = pad
    if level and not (el.tail or '').strip():
        el.tail = pad


# ----------------------------------------------------------------------- build

def build(report=False):
    form = Form(BASE)

    before_visible = {k: (el.findtext('visible') == 'T')
                      for k, (el, _) in form.fields.items()}

    form.root.set('scriptid', SCRIPTID)
    form.root.find('name').text = FORM_NAME
    form.root.find('inactive').text = 'F'
    form.root.find('preferred').text = 'F'

    placed = set()
    problems = []

    for tab_id, groups in LAYOUT.items():
        for scriptid, label, specs in groups:
            flds = form.group(tab_id, scriptid, label)
            at = 0
            for spec in specs:
                fid, new_label = spec if isinstance(spec, tuple) else (spec, None)
                if fid not in form.fields:
                    problems.append(f'{fid}: not on the base form - cannot place it')
                    continue
                form.place(fid, flds, label=new_label,
                           visible='F' if fid in KEEP_HIDDEN else 'T', at=at)
                at += 1
                placed.add(fid)
        form.order_groups(tab_id, [g[0] for g in groups])

    # every custom field the layout does not name is hidden where it sits
    hidden = []
    for key, (el, _) in form.fields.items():
        if key in placed or not is_custom(el.findtext('id')):
            continue
        if before_visible.get(key):
            hidden.append((key, el.findtext('label')))
        el.find('visible').text = 'F'

    # native fields the redesign explicitly drops
    for key in ('CONSUMPTIONUNIT', 'COUNTRYOFMANUFACTURE'):
        if key in form.fields:
            form.hide(key)

    for sublist_id, tab_id in SUBLIST_MOVES.items():
        if sublist_id in form.sublists:
            form.move_sublist(sublist_id, tab_id)
        else:
            problems.append(f'{sublist_id}: sublist not on the base form')
    for sublist_id in SUBLISTS_HIDDEN:
        if sublist_id in form.sublists:
            form.sublists[sublist_id][0].find('visible').text = 'F'
    for tab in form.root.iter('tab'):
        subitems = tab.find('subItems')
        for subtab in list(subitems if subitems is not None else []):
            if subtab.tag == 'subTab' and subtab.findtext('id') in SUBTABS_REMOVED:
                subitems.remove(subtab)

    for tab_id, tab in form.tabs.items():
        if tab_id in TAB_ORDER:
            form.set_tab(tab_id, label=TAB_LABELS[tab_id], visible='T')
        else:
            form.set_tab(tab_id, visible='F')
    form.order_tabs(TAB_ORDER)

    if problems:
        for p in problems:
            print('PROBLEM', p)
        return 1

    indent(form.root)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(form.root).write(OUT, encoding='utf-8', xml_declaration=False)

    visible_tabs = len(TAB_ORDER)
    hidden_tabs = len(form.tabs) - visible_tabs
    print(f'wrote {OUT.relative_to(REPO)}')
    print(f'  fields placed: {len(placed)} | custom fields hidden: '
          f'{sum(1 for k, (e, _) in form.fields.items() if is_custom(e.findtext("id")) and k not in placed)}')
    print(f'  tabs: {visible_tabs} visible, {hidden_tabs} hidden')

    if report:
        print('\nVisible on the current form, hidden by this build '
              f'({len(hidden)}):')
        for key, label in sorted(hidden):
            print(f'  {key:45s} {label}')
    return 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', action='store_true',
                    help='list custom fields this build hides that are visible today')
    sys.exit(build(**vars(ap.parse_args())))
