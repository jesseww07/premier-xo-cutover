"""Produce data/XO_Search_Cleanup_List.csv: every saved search that references a
retiring target, with its title, so each can be fixed or inactivated before the
field/record is inactivated (tracker Phase 5).

Solupay/Versapay is a separate vendor workstream and is deliberately NOT in the
retiring set (scope decision 2026-08-25).
"""
import csv
import re
from collections import defaultdict

from common import CORPUS, DATA

SS_DIR = CORPUS / 'objects' / 'savedsearch'
OUT = DATA / 'XO_Search_Cleanup_List.csv'

RETIRING = {
    'custitem_la_sku', 'custitem_la_unique_id', 'custitem_lights_sku',
    'custitem_la_list_price', 'custitem_la_manufacturer_name', 'custitem_la_spec_sheet',
    'custitem_la_manufacturer_finish', 'custitem_la_manufacturer_number',
    'custitem_la_shipped_via', 'custitem_la_fan_airflow', 'custitem_zastro_image_url',
    'customrecord_zastro_lights_items', 'customrecord_zastro_la_data_dump',
    'customrecord_la_csv_row', 'customrecord_manufacturer_mapping',
}


def title_of(path):
    xml = path.read_text(encoding='utf-8', errors='replace')
    m = re.search(r'<definitionname>(.*?)</definitionname>', xml, re.DOTALL) or \
        re.search(r'<name>(.*?)</name>', xml, re.DOTALL)
    return m.group(1).strip() if m else '?'


def main():
    refs = defaultdict(set)
    with open(DATA / 'reference_matrix_raw.csv', encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh):
            if r['file'].startswith('objects:savedsearch/') and r['scriptid'] in RETIRING:
                refs[r['file'].split('/')[-1]].add(r['scriptid'])

    rows = [(fname[:-4], title_of(SS_DIR / fname), ', '.join(sorted(targets)))
            for fname, targets in sorted(refs.items())]
    with open(OUT, 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.writer(fh, lineterminator='\n')
        w.writerow(['search_scriptid', 'search_title', 'retiring_targets_referenced'])
        w.writerows(rows)
    print(f'Wrote {OUT.name}: {len(rows)} searches need cleanup')


if __name__ == '__main__':
    main()
