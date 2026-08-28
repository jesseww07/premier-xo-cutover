"""Credential-free structural validation of the SDF ACP.

SuiteCloud's own `project:validate` cannot run in CI: it refuses to start unless
the authid in project.json resolves to stored credentials on that machine
(verified 2026-08-27). This check covers what can be verified without an
account, and encodes the specific traps this project hit:

  * XML must be well-formed
  * root @scriptid must match the filename
  * elements tied to features Premier does NOT have (MATRIXITEMS,
    MERCHANDISEHIERARCHY) must not be present - they reintroduce a manifest
    feature dependency and fail deployment
  * elements the SDF schema rejects (aidescription, enabletextenhance) must not
    be present
  * every [scriptid=...] reference must resolve inside the project or be
    declared in manifest.xml dependencies
  * entry forms: no subList duplicating a subTab id (breaks install); scriptid must not be UI-generated
  * field labels must be unique (NetSuite silently auto-suffixes "(2)")

Exit code 1 on any finding. Real server-side validation still happens by hand
before deployment - see README.
"""
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict

from common import ACP_OBJECTS, SDF_ACP

FORBIDDEN = {
    'itemmatrix': 'MATRIXITEMS feature not enabled at Premier',
    'ismatrixoption': 'MATRIXITEMS feature not enabled at Premier',
    'ismhitemattribute': 'MERCHANDISEHIERARCHY feature not enabled at Premier',
    'aidescription': 'not supported by the SDF schema',
    'enabletextenhance': 'not supported by the SDF schema',
}
REF_RE = re.compile(r'\[scriptid=([\w.]+)\]')


def main():
    problems = []
    manifest_path = SDF_ACP / 'src' / 'manifest.xml'
    try:
        manifest = ET.parse(manifest_path).getroot()
    except ET.ParseError as e:
        print(f'FAIL manifest.xml is not well-formed: {e}')
        return 1
    declared = {o.text.strip() for o in manifest.iter('object') if o.text}

    files = sorted(ACP_OBJECTS.rglob('*.xml'))
    if not files:
        print('FAIL no objects found in', ACP_OBJECTS)
        return 1

    in_project = {p.stem for p in files}
    labels = defaultdict(list)

    for p in files:
        try:
            root = ET.parse(p).getroot()
        except ET.ParseError as e:
            problems.append(f'{p.name}: not well-formed XML: {e}')
            continue

        if root.tag == 'entryForm':
            # the one content defect that breaks install (findings 4a): a subList duplicating a subTab id in the same tab
            tabs = root.find('tabs')
            for tab in (tabs if tabs is not None else []):
                si = tab.find('subItems')
                if si is None:
                    continue
                subtab_ids = {x.findtext('id') for x in si if x.tag == 'subTab'}
                for x in si:
                    if x.tag == 'subList' and x.findtext('id') in subtab_ids:
                        problems.append(f'{p.name}: tab {tab.findtext("id")} has <subList id={x.findtext("id")}> duplicating a subTab - '
                                        'install will fail; run scripts/fix_form_export.py')
            if re.fullmatch(r'custform_[0-9]+_[0-9]+_[0-9]+', root.get('scriptid') or ''):
                problems.append(f'{p.name}: scriptid looks UI-created - SDF cannot UPDATE UI-born forms here; deploy under a new scriptid')

        sid = root.get('scriptid')
        if sid != p.stem:
            problems.append(f'{p.name}: root scriptid "{sid}" does not match filename')

        if root.tag == 'itemcustomfield':
            for el, why in FORBIDDEN.items():
                if root.find(el) is not None:
                    problems.append(f'{p.name}: contains <{el}> - {why}')

        label = root.findtext('label')
        if label:
            labels[label.strip()].append(p.stem)

        for ref in REF_RE.findall(p.read_text(encoding='utf-8')):
            base = ref.split('.')[0]
            if base not in in_project and base not in declared:
                problems.append(f'{p.name}: references [scriptid={ref}] which is neither in the project '
                                f'nor declared in manifest.xml dependencies')

    for label, owners in sorted(labels.items()):
        if len(owners) > 1:
            problems.append(f'duplicate label "{label}" on {", ".join(owners)} - NetSuite auto-suffixes "(2)"')

    print(f'Checked {len(files)} ACP objects against {manifest_path.name} '
          f'({len(declared)} declared dependencies)')
    if problems:
        for m in problems:
            print('FAIL', m)
        print(f'\n{len(problems)} problem(s) found.')
        return 1
    print('OK - no structural problems found.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
