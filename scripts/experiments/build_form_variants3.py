import re, sys
PROD = r'C:\Users\JesseWampole\dev\xo-sweep\src\Objects\entryform\custform_217_7513000_136.xml'
SB1  = r'C:\Users\JesseWampole\dev\xo-sb1-diff\src\Objects\entryform\custform_217_7513000_136.xml'
MANIFEST = open(r'C:\Users\JesseWampole\dev\xo-cutover-acp\src\manifest.xml', encoding='utf-8').read()
STRIPS = [
    r'      <field>\s*<id>MATRIXITEMNAMETEMPLATE</id>[\s\S]*?</field>\n',
    r'      <menuitem>\s*<id>ADDMATRIX</id>[\s\S]*?</menuitem>\n',
    r'      <menuitem>\s*<id>CREATEMATRIX</id>[\s\S]*?</menuitem>\n',
    r'    <tab>\s*<id>ITEMMERCHANDISEHIERARCHY</id>[\s\S]*?</tab>\n',
    r'\s*<subList>\s*<id>ITEMHIERARCHYVERSIONS</id>[\s\S]*?</subList>',
    r'\s*<menuitem>\s*<id>(PRINTLABEL|REMOVEMATRIXOPTIONS|UPDATEMATRIX)</id>[\s\S]*?</menuitem>',
]
RELABEL_OBJS = ['custitem_la_image','custitem_la_product_url','custitem_la_safety_listing','custitem_la_safety_rating',
    'custitem_la_bulb_type','custitem_la_upc','custitem_la_color_temperature','custitem_la_light_output','custitem7','custitem_la_max_wattage']
XO_OBJS = ['custitem_xo_umap','custitem_xo_backorder_date','custitem_xo_in_stock','custitem_xo_order_multiple','custitem_xo_order_minimum',
    'custitem_xo_last_changed','custitem_xo_availability_changed','custitem_xo_catalog_changed','custitem_xo_price_changed',
    'custitem_xo_vendor_disc_cost','custitem_xo_cost_w_shipping','custitem_xo_kelvin_bucket','custitem_xo_lumens_bucket',
    'custitem_xo_wattage_bucket','custitem_xo_voltage_bucket','custitem_xo_keywords','custitem_xo_prop65','custitem_xo_prop65_desc',
    'custitem_xo_title20','custitem_xo_title24']
which = sys.argv[1]
src = SB1 if which == 'F' else PROD
x = open(src, encoding='utf-8').read()
man = MANIFEST
if which != 'E':
    for p in STRIPS: x = re.sub(p, '', x)
else:
    man = man.replace('    </features>', '      <feature required="false">MATRIXITEMS</feature>\n      <feature required="false">MERCHANDISEHIERARCHY</feature>\n    </features>')
if which == 'C':
    x = re.sub(r'<recordType>\w+</recordType>', '<recordType>INVENTORYITEM</recordType>', x)
if which == 'G':
    x = x.replace('<name>New Inventory Item Form - Xo Fields </name>', '<name>New Inventory Item Form - Xo Fields</name>')
extra = ''.join(f'      <object>{o}</object>\n' for o in RELABEL_OBJS + XO_OBJS)
man = man.replace('    <objects>\n', '    <objects>\n' + extra, 1)
open(r'C:\Users\JesseWampole\dev\xo-form-test\src\Objects\custform_217_7513000_136.xml', 'w', encoding='utf-8').write(x)
open(r'C:\Users\JesseWampole\dev\xo-form-test\src\manifest.xml', 'w', encoding='utf-8').write(man.replace('xo-cutover-acp', 'xo-form-test'))
print('variant', which, '| source:', 'SB1' if src == SB1 else 'PROD', '| recordType:', re.search(r'<recordType>(\w+)', x).group(1), '| name:', repr(re.search(r'<name>([^<]*)</name>', x).group(1)))
