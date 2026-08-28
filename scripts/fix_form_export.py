"""Make a NetSuite entry-form export deployable via SDF.

Root cause found 2026-08-28 by bisection (SB1, 30+ deploys): NetSuite's exporter emits the
Locations sublist twice under Purchasing/Inventory - once as <subList id="ITEMLOCATIONS"> and once
as <subTab id="ITEMLOCATIONS"> (the subtab carries the real content). The duplicate subList makes
the server-side install fail with the opaque "An error occurred during custom object creation/update",
even though validation passes. Removing the stray subList makes the full form deploy.

Usage:
    python scripts/fix_form_export.py <exported_form.xml> [output.xml] [--scriptid NEW_ID] [--name "New Name"]

Without --scriptid the file keeps its scriptid (an UPDATE of the existing form). Note: updating a
UI-created form still failed in SB1 even after the fix; creating a NEW form from the same content
succeeds. Prefer --scriptid to create the redesigned form fresh.
"""
import argparse
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def fix(xml_bytes):
    root = ET.fromstring(xml_bytes)
    removed = []
    tabs = root.find('tabs')
    if tabs is not None:
        for tab in tabs:
            si = tab.find('subItems')
            if si is None:
                continue
            subtab_ids = {s.findtext('id') for s in si if s.tag == 'subTab'}
            for s in list(si):
                if s.tag == 'subList' and s.findtext('id') in subtab_ids:
                    si.remove(s)
                    removed.append((tab.findtext('id'), s.findtext('id')))
    return root, removed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out', nargs='?')
    ap.add_argument('--scriptid')
    ap.add_argument('--name')
    a = ap.parse_args()
    root, removed = fix(Path(a.src).read_bytes())
    for tab, sid in removed:
        print(f'removed stray <subList id={sid}> from tab {tab}')
    if not removed:
        print('no stray subList found')
    if a.scriptid:
        root.set('scriptid', a.scriptid)
    if a.name:
        root.find('name').text = a.name
    out = Path(a.out) if a.out else Path(a.src)
    out.write_bytes(ET.tostring(root, encoding='utf-8'))
    print('wrote', out)


if __name__ == '__main__':
    sys.exit(main())
