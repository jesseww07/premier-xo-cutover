"""Generate the SDF ACP field objects under sdf/xo-cutover-acp/src/Objects.

Relabels: copies the current prod XML from the corpus snapshot and patches only
<label> (+ <help>). Fields whose label is already correct are NOT included
(deploy replaces whole objects; minimal set minimizes drift risk).

New fields: authored from a template matching the prod field shape
(inventory-only, itemsubtype BOTH, same spec subtab as the LA fields).

Entry forms are NOT in the ACP: SDF cannot deploy this account's inventory-item
entry form (proven 2026-08-25, 8 variants) - see docs/XO_Sweep_Findings.md 4a.
"""
import re

from common import ACP_OBJECTS, CORPUS

FIELD_CORPUS = CORPUS / 'objects' / 'itemcustomfield'
SUBTAB = '[scriptid=custtab_25_t2379072_560]'

# scriptid -> (new label, help text)
RELABELS = {
    'custitem_la_image': ('Primary Image', 'Primary product image. XO source: Image Path. Gallery images 1-15 live in XO.'),
    'custitem_la_product_url': ('Item URL', 'XO item URL for internal staff lookup. XO source: Item URL (relative path - pipeline prepends XO domain).'),
    'custitem_la_safety_listing': ('Safety Rating', 'Safety certification (ETL/UL). NOTE: field content was always the safety listing despite the old label. XO source: Extra-Safety Rating.'),
    'custitem_la_safety_rating': ('Location Rating', 'Location rating (Damp/Wet/Dry). NOTE: field content was always the location rating despite the old label. XO source: Extra-Location Rating.'),
    'custitem_la_bulb_type': ('Bulb Type', 'XO source: Extra-Bulb Type (XO prefixes light source, e.g. "LED B10.5").'),
    'custitem_la_upc': ('UPC / GTIN', 'XO ships GTIN-14 with leading zeros. Store as-is; strip leading zeros only for comparison.'),
    'custitem_la_color_temperature': ('Kelvin', 'XO source: Extra-Kelvin.'),
    'custitem_la_light_output': ('Lumens', 'XO source: Extra-Initial Lumens.'),
    'custitem7': ('XO Item ID', 'XO permanent numeric item identity. Source: ItemID column (NOT XOItemID, which is Excel-mangled in the export).'),
    'custitem_la_max_wattage': ('Wattage', 'Exact wattage. XO source: Extra-Bulb Wattage with units stripped ("60 W" -> 60). Kept per 2026-08-25 decision (543,145 rows) - 21st surviving LA field.'),
}

# scriptid -> (label, fieldtype, help)
NEW_FIELDS = [
    ('custitem_xo_umap', 'XO UMAP', 'CURRENCY', 'XO UMAP pricing tier. (Labeled XO UMAP to avoid collision with legacy custitem_la_umap label.)'),
    ('custitem_xo_backorder_date', 'Back Order Date', 'DATE', 'Manufacturer back-order date from XO. Informational; inventory does not sync.'),
    ('custitem_xo_in_stock', 'XO In Stock', 'INTEGER', 'Manufacturer stock from XO. Informational only; inventory intentionally does not sync.'),
    ('custitem_xo_order_multiple', 'Order Multiple', 'INTEGER', 'XO purchasing constraint.'),
    ('custitem_xo_order_minimum', 'Order Minimum', 'INTEGER', 'XO purchasing constraint.'),
    ('custitem_xo_last_changed', 'XO Last Changed', 'DATE', 'XO change-date quartet: any change.'),
    ('custitem_xo_availability_changed', 'XO Availability Changed', 'DATE', 'XO change-date quartet: availability.'),
    ('custitem_xo_catalog_changed', 'XO Catalog Changed', 'DATE', 'XO change-date quartet: catalog data.'),
    ('custitem_xo_price_changed', 'XO Price Changed', 'DATE', 'XO change-date quartet: pricing.'),
    ('custitem_xo_vendor_disc_cost', 'Vendor Discounted Cost', 'CURRENCY', 'XO cost family. Item Cost itself lands in native cost.'),
    ('custitem_xo_cost_w_shipping', 'Cost With Shipping', 'CURRENCY', 'XO cost family.'),
    ('custitem_xo_kelvin_bucket', 'Kelvin Bucket', 'TEXT', 'Normalized facet bucket. XO source: Standard-Kelvin.'),
    ('custitem_xo_lumens_bucket', 'Lumens Bucket', 'TEXT', 'Normalized facet bucket. XO source: Standard-Lumens.'),
    ('custitem_xo_wattage_bucket', 'Wattage Bucket', 'TEXT', 'Normalized facet bucket. XO source: Standard-Wattage ("60w" -> strip units).'),
    ('custitem_xo_voltage_bucket', 'Voltage Bucket', 'TEXT', 'Normalized facet bucket. XO source: Standard-Voltage.'),
    ('custitem_xo_keywords', 'XO Keywords', 'TEXTAREA', 'Search keywords from XO.'),
    ('custitem_xo_prop65', 'Prop 65', 'TEXT', 'CA Prop 65 flag, stored raw from XO (no transform risk).'),
    ('custitem_xo_prop65_desc', 'Prop 65 Description', 'TEXTAREA', 'CA Prop 65 warning text from XO.'),
    ('custitem_xo_title20', 'Title 20', 'TEXT', 'CA Title 20 compliance, stored raw from XO.'),
    ('custitem_xo_title24', 'Title 24', 'TEXT', 'CA Title 24 compliance, stored raw from XO.'),
]

TEMPLATE = '''<itemcustomfield scriptid="{scriptid}">
  <accesslevel>2</accesslevel>
  <appliestogroup>F</appliestogroup>
  <appliestoinventory>T</appliestoinventory>
  <appliestokit>F</appliestokit>
  <appliestononinventory>F</appliestononinventory>
  <appliestoothercharge>F</appliestoothercharge>
  <appliestopricelist>F</appliestopricelist>
  <appliestoservice>F</appliestoservice>
  <appliestospecificitems>F</appliestospecificitems>
  <appliestosubplan>F</appliestosubplan>
  <applyformatting>F</applyformatting>
  <checkspelling>F</checkspelling>
  <defaultchecked>F</defaultchecked>
  <displaytype>NORMAL</displaytype>
  <encryptatrest>F</encryptatrest>
  <fieldtype>{fieldtype}</fieldtype>
  <globalsearch>F</globalsearch>
  <help>{help}</help>
  <includechilditems>F</includechilditems>
  <isformula>F</isformula>
  <ismandatory>F</ismandatory>
  <isparent>F</isparent>
  <itemsubtype>BOTH</itemsubtype>
  <label>{label}</label>
  <searchlevel>2</searchlevel>
  <showhierarchy>F</showhierarchy>
  <showinlist>F</showinlist>
  <storevalue>T</storevalue>
  <subtab>{subtab}</subtab>
</itemcustomfield>
'''

# elements the SDF validator rejects at Premier (features not enabled / newer UI-only fields)
STRIP = ['ismatrixoption', 'aidescription', 'enabletextenhance', 'itemmatrix',
         'ismhitemattribute', 'appliestovendor', 'appliestopartner']


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def main():
    ACP_OBJECTS.mkdir(parents=True, exist_ok=True)
    expected = set()

    for sid, (label, help_text) in RELABELS.items():
        xml = (FIELD_CORPUS / f'{sid}.xml').read_text(encoding='utf-8')
        xml = re.sub(r'<label>.*?</label>', f'<label>{esc(label)}</label>', xml, count=1, flags=re.DOTALL)
        xml = re.sub(r'<help>.*?</help>', f'<help>{esc(help_text)}</help>', xml, count=1, flags=re.DOTALL)
        for el in STRIP:
            xml = re.sub(rf'\s*<{el}>.*?</{el}>', '', xml, flags=re.DOTALL)
        (ACP_OBJECTS / f'{sid}.xml').write_text(xml, encoding='utf-8', newline='\n')
        expected.add(f'{sid}.xml')
        print('relabel:', sid, '->', label)

    for sid, label, ftype, help_text in NEW_FIELDS:
        xml = TEMPLATE.format(scriptid=sid, label=esc(label), fieldtype=ftype, help=esc(help_text), subtab=SUBTAB)
        (ACP_OBJECTS / f'{sid}.xml').write_text(xml, encoding='utf-8', newline='\n')
        expected.add(f'{sid}.xml')
        print('new:', sid, f'({ftype})')

    # remove anything stale so the ACP is exactly what this script defines
    for p in ACP_OBJECTS.glob('*.xml'):
        if p.name not in expected:
            p.unlink()
            print('removed stale object:', p.name)
    print('ACP objects:', len(list(ACP_OBJECTS.glob('*.xml'))))


if __name__ == '__main__':
    main()
