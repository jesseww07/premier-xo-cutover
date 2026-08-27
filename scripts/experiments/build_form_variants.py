import re, sys
SRC = r'C:\Users\JesseWampole\dev\xo-sweep\src\Objects\entryform\custform_217_7513000_136.xml'
MANIFEST = open(r'C:\Users\JesseWampole\dev\xo-cutover-acp\src\manifest.xml', encoding='utf-8').read()
STRIPS = [
    r'      <field>\s*<id>MATRIXITEMNAMETEMPLATE</id>[\s\S]*?</field>\n',
    r'      <menuitem>\s*<id>ADDMATRIX</id>[\s\S]*?</menuitem>\n',
    r'      <menuitem>\s*<id>CREATEMATRIX</id>[\s\S]*?</menuitem>\n',
    r'    <tab>\s*<id>ITEMMERCHANDISEHIERARCHY</id>[\s\S]*?</tab>\n',
    r'\s*<subList>\s*<id>ITEMHIERARCHYVERSIONS</id>[\s\S]*?</subList>',
    r'\s*<menuitem>\s*<id>(PRINTLABEL|REMOVEMATRIXOPTIONS|UPDATEMATRIX)</id>[\s\S]*?</menuitem>',
]
PROJECT_OBJS = ['custitem_la_image','custitem_la_product_url','custitem_la_safety_listing','custitem_la_safety_rating',
    'custitem_la_bulb_type','custitem_la_upc','custitem_la_color_temperature','custitem_la_light_output','custitem7','custitem_la_max_wattage']
APP_FIELDS = ['custitem_bc_item_file_attachment', 'custitem_usr_item_category', 'custitemlastpostedtofarapp']
def block(x, tag, key):
    return re.sub(r'\s*<' + tag + r'>\s*<id>\[[^\]]*' + key + r'[^\]]*\]</id>[\s\S]*?</' + tag + '>', '', x)
def control():
    x = open(SRC, encoding='utf-8').read()
    for p in STRIPS: x = re.sub(p, '', x)
    return x
which = sys.argv[1]
x = control(); man = MANIFEST
extra = ''.join(f'      <object>{o}</object>\n' for o in PROJECT_OBJS)
man = man.replace('    <objects>\n', '    <objects>\n' + extra, 1)
if which == 'B':   # remove SuiteApp-owned field/sublist refs + applications block
    for f in APP_FIELDS: x = block(x, 'field', 'scriptid=' + f)
    x = block(x, 'subList', 'customrecord_fa_synced_items')
    man = re.sub(r'\s*<applications>[\s\S]*?</applications>', '', man)
elif which == 'D': # remove Atlas-bundle tab + sublist refs
    x = block(x, 'tab', 'custtab_atlas_core_item360')
    x = block(x, 'subList', 'custsublist_atlas_core_open_pur_by_item')
    x = block(x, 'field', 'custtab_atlas_core_item360')
    man = man.replace('      <object>custtab_atlas_core_item360</object>\n', '').replace('      <object>custsublist_atlas_core_open_pur_by_item</object>\n', '')
open(r'C:\Users\JesseWampole\dev\xo-form-test\src\Objects\custform_217_7513000_136.xml', 'w', encoding='utf-8').write(x)
open(r'C:\Users\JesseWampole\dev\xo-form-test\src\manifest.xml', 'w', encoding='utf-8').write(man.replace('xo-cutover-acp', 'xo-form-test'))
print('variant', which, len(x), 'bytes | appid refs:', len(re.findall(r'appid=', x)), '| atlas refs:', x.count('atlas_core'))
