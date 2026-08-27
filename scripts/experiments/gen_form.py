"""Extend Jesse's existing "New Inventory Item Form - Xo Fields" (custform_217_7513000_136)
with the new custitem_xo_* fields and the relabels, for deployment in the ACP.

- Tab "Item Details/ LightsAmerica" -> "Item Details / XO"
- Form-level label overrides updated to match the new field labels
- 20 new custitem_xo_* field entries inserted after custitem_la_height
"""
import re

SRC = r'C:\Users\JesseWampole\dev\xo-sweep\src\Objects\entryform\custform_217_7513000_136.xml'
DST = r'C:\Users\JesseWampole\dev\xo-cutover-acp\src\Objects\custform_217_7513000_136.xml'

RELABELS = {
    'custitem_la_image': 'Primary Image',
    'custitem_la_product_url': 'Item URL',
    'custitem_la_safety_listing': 'Safety Rating',
    'custitem_la_safety_rating': 'Location Rating',
    'custitem_la_bulb_type': 'Bulb Type',
    'custitem_la_upc': 'UPC / GTIN',
    'custitem_la_color_temperature': 'Kelvin',
    'custitem_la_light_output': 'Lumens',
    'custitem_la_max_wattage': 'Wattage',
    'custitem7': 'XO Item ID',
}

NEW_FIELDS = [
    ('custitem_xo_umap', 'UMAP'),
    ('custitem_xo_backorder_date', 'Back Order Date'),
    ('custitem_xo_in_stock', 'XO In Stock'),
    ('custitem_xo_order_multiple', 'Order Multiple'),
    ('custitem_xo_order_minimum', 'Order Minimum'),
    ('custitem_xo_last_changed', 'XO Last Changed'),
    ('custitem_xo_availability_changed', 'XO Availability Changed'),
    ('custitem_xo_catalog_changed', 'XO Catalog Changed'),
    ('custitem_xo_price_changed', 'XO Price Changed'),
    ('custitem_xo_vendor_disc_cost', 'Vendor Discounted Cost'),
    ('custitem_xo_cost_w_shipping', 'Cost With Shipping'),
    ('custitem_xo_kelvin_bucket', 'Kelvin Bucket'),
    ('custitem_xo_lumens_bucket', 'Lumens Bucket'),
    ('custitem_xo_wattage_bucket', 'Wattage Bucket'),
    ('custitem_xo_voltage_bucket', 'Voltage Bucket'),
    ('custitem_xo_keywords', 'XO Keywords'),
    ('custitem_xo_prop65', 'Prop 65'),
    ('custitem_xo_prop65_desc', 'Prop 65 Description'),
    ('custitem_xo_title20', 'Title 20'),
    ('custitem_xo_title24', 'Title 24'),
]

FIELD_TMPL = '''            <field>
              <id>[scriptid={sid}]</id>
              <label>{label}</label>
              <visible>T</visible>
              <mandatory>F</mandatory>
              <displayType>NORMAL</displayType>
              <columnBreak>F</columnBreak>
              <sameRowAsPrevious>F</sameRowAsPrevious>
            </field>
'''

def main():
    xml = open(SRC, encoding='utf-8').read()

    xml = xml.replace('<label>Item Details/ LightsAmerica</label>', '<label>Item Details / XO</label>')

    # strip elements tied to features Premier lacks (MATRIXITEMS, MERCHANDISEHIERARCHY)
    for pat in [
        r'      <field>\s*<id>ITEMMATRIX</id>[\s\S]*?</field>\n',
        r'      <field>\s*<id>MATRIXITEMNAMETEMPLATE</id>[\s\S]*?</field>\n',
        r'      <menuitem>\s*<id>ADDMATRIX</id>[\s\S]*?</menuitem>\n',
        r'      <menuitem>\s*<id>CREATEMATRIX</id>[\s\S]*?</menuitem>\n',
        r'    <tab>\s*<id>ITEMMERCHANDISEHIERARCHY</id>[\s\S]*?</tab>\n',
        r'\s*<subList>\s*<id>ITEMHIERARCHYVERSIONS</id>[\s\S]*?</subList>',
        r'\s*<field>\s*<id>ITEMHIERARCHYVERSIONS</id>[\s\S]*?</field>',
        # ids not in the CLI schema (account UI newer than SDF schema)
        r'\s*<menuitem>\s*<id>PRINTLABEL</id>[\s\S]*?</menuitem>',
        r'\s*<menuitem>\s*<id>REMOVEMATRIXOPTIONS</id>[\s\S]*?</menuitem>',
        r'\s*<menuitem>\s*<id>UPDATEMATRIX</id>[\s\S]*?</menuitem>',
        r'\s*<button>\s*<id>PRINTLABEL</id>[\s\S]*?</button>',
        r'\s*<button>\s*<id>REMOVEMATRIXOPTIONS</id>[\s\S]*?</button>',
        r'\s*<button>\s*<id>UPDATEMATRIX</id>[\s\S]*?</button>',
    ]:
        xml, n = re.subn(pat, '', xml)
        print(f'stripped {n} block(s): {pat[:60]}')

    # form-level label overrides for the relabeled fields
    for sid, label in RELABELS.items():
        pat = re.compile(r'(<id>\[scriptid=' + re.escape(sid) + r'\]</id>\s*<label>).*?(</label>)', re.DOTALL)
        xml, n = pat.subn(lambda m: m.group(1) + label + m.group(2), xml)
        print(f'{sid}: {n} label override(s) -> {label}')

    # insert new field entries right after the custitem_la_height field block
    anchor = re.search(r'            <field>\s*<id>\[scriptid=custitem_la_height\]</id>[\s\S]*?</field>\n', xml)
    if not anchor:
        raise SystemExit('anchor custitem_la_height field block not found')
    insert = ''.join(FIELD_TMPL.format(sid=s, label=l) for s, l in NEW_FIELDS)
    xml = xml[:anchor.end()] + insert + xml[anchor.end():]

    open(DST, 'w', encoding='utf-8').write(xml)
    print('Wrote', DST, f'({len(xml)} bytes, {len(NEW_FIELDS)} new field entries)')

if __name__ == '__main__':
    main()
