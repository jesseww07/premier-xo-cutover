import re
SRC = r'C:\Users\JesseWampole\dev\xo-cutover-acp\src\Objects\custform_217_7513000_136.xml'   # gen_form output: tab renamed, labels synced, xo fields inserted, strips applied
MANIFEST = open(r'C:\Users\JesseWampole\dev\xo-cutover-acp\src\manifest.xml', encoding='utf-8').read()
RELABEL_OBJS = ['custitem_la_image','custitem_la_product_url','custitem_la_safety_listing','custitem_la_safety_rating',
    'custitem_la_bulb_type','custitem_la_upc','custitem_la_color_temperature','custitem_la_light_output','custitem7','custitem_la_max_wattage']
XO_OBJS = ['custitem_xo_umap','custitem_xo_backorder_date','custitem_xo_in_stock','custitem_xo_order_multiple','custitem_xo_order_minimum',
    'custitem_xo_last_changed','custitem_xo_availability_changed','custitem_xo_catalog_changed','custitem_xo_price_changed',
    'custitem_xo_vendor_disc_cost','custitem_xo_cost_w_shipping','custitem_xo_kelvin_bucket','custitem_xo_lumens_bucket',
    'custitem_xo_wattage_bucket','custitem_xo_voltage_bucket','custitem_xo_keywords','custitem_xo_prop65','custitem_xo_prop65_desc',
    'custitem_xo_title20','custitem_xo_title24']
x = open(SRC, encoding='utf-8').read()
x = x.replace('scriptid="custform_217_7513000_136"', 'scriptid="custform_xo_item_base"', 1)
x = re.sub(r'<name>[^<]*</name>', '<name>XO Item Form</name>', x, count=1)
x = re.sub(r'<recordType>\w+</recordType>', '<recordType>INVENTORYITEM</recordType>', x, count=1)
import os, glob
for f in glob.glob(r'C:\Users\JesseWampole\dev\xo-form-test\src\Objects\*.xml'): os.remove(f)
open(r'C:\Users\JesseWampole\dev\xo-form-test\src\Objects\custform_xo_item_base.xml', 'w', encoding='utf-8').write(x)
extra = ''.join(f'      <object>{o}</object>\n' for o in RELABEL_OBJS + XO_OBJS)
man = MANIFEST.replace('    <objects>\n', '    <objects>\n' + extra, 1).replace('xo-cutover-acp', 'xo-form-test')
open(r'C:\Users\JesseWampole\dev\xo-form-test\src\manifest.xml', 'w', encoding='utf-8').write(man)
print('variant H: NEW form custform_xo_item_base "XO Item Form", recordType INVENTORYITEM,', x.count('scriptid=custitem_xo_'), 'xo entries,', len(x), 'bytes')
