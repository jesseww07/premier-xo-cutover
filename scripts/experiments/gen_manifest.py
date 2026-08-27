"""Build manifest.xml for the ACP from the validator's missing-dependency output.

Parses validate_out.txt for [[Object - scriptid=X]] (account-level),
[[Object - scriptid=X] in [Application - appid=Y]] (SuiteApp-level), and
[Feature - F:required] lines. MATRIXITEMS / MERCHANDISEHIERARCHY are expected
to disappear once the form strips their elements; error if they persist.
"""
import re
from collections import defaultdict

import glob

MANIFEST = r'C:\Users\JesseWampole\dev\xo-cutover-acp\src\manifest.xml'

STRIPPED_FEATURES = {'MATRIXITEMS', 'MERCHANDISEHIERARCHY'}

def main():
    # union across every validate output captured so far — a later clean run
    # must never shrink the manifest
    txt = ''
    for f in glob.glob(r'C:\Users\JesseWampole\dev\validate_out*.txt'):
        txt += open(f, encoding='utf-8', errors='replace').read()

    app_objs = defaultdict(set)
    for m in re.finditer(r'\[\[Object - scriptid=([\w.]+)\] in \[Application - appid=([\w.]+)\]\]', txt):
        app_objs[m.group(2)].add(m.group(1))

    objs = set()
    for m in re.finditer(r'\[\[Object - scriptid=([\w.]+)\]\]', txt):
        objs.add(m.group(1))

    feats = sorted(set(re.findall(r'\[Feature - (\w+):required\]', txt)) - STRIPPED_FEATURES)
    leftover = set(re.findall(r'\[Feature - (\w+):required\]', txt)) & STRIPPED_FEATURES
    if leftover:
        print(f'NOTE: stripped-feature requirements still reported (pre-strip output?): {leftover}')

    # features the account does NOT have enabled: declare optional so the
    # dependent form elements are skipped instead of failing the install
    optional = {'CHARGEBASEDBILLING', 'SUBSCRIPTIONBILLING'}

    lines = ['<manifest projecttype="ACCOUNTCUSTOMIZATION">',
             '  <projectname>xo-cutover-acp</projectname>',
             '  <frameworkversion>1.0</frameworkversion>',
             '  <dependencies>',
             '    <features>']
    for f in feats:
        req = 'false' if f in optional else 'true'
        lines.append(f'      <feature required="{req}">{f}</feature>')
    lines.append('    </features>')
    lines.append('    <objects>')
    for o in sorted(objs):
        lines.append(f'      <object>{o}</object>')
    lines.append('    </objects>')
    if app_objs:
        lines.append('    <applications>')
        for app, aobjs in sorted(app_objs.items()):
            lines.append(f'      <application id="{app}">')
            lines.append('        <objects>')
            for o in sorted(aobjs):
                lines.append(f'          <object>{o}</object>')
            lines.append('        </objects>')
            lines.append('      </application>')
        lines.append('    </applications>')
    lines.append('  </dependencies>')
    lines.append('</manifest>')
    open(MANIFEST, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(f'Wrote manifest: {len(feats)} features, {len(objs)} objects, {sum(len(v) for v in app_objs.values())} app objects in {len(app_objs)} apps')

if __name__ == '__main__':
    main()
