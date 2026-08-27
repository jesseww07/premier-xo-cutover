"""XO Cutover reference sweep - grep the prod corpus for target scriptids.

Scans corpus/<snapshot>/filecabinet and corpus/<snapshot>/objects for every
target in data/sweep_targets.csv using word-boundary-safe matching (a scriptid
must NOT be followed by [a-z0-9_], so custitem_la_width does not match
custitem_la_width_diameter).

Outputs (deterministic, cross-platform - CI regenerates and diffs them):
  data/reference_matrix_raw.csv      one row per (target, file) with hit count
  data/reference_matrix_summary.csv  one row per target: total hits, file count, surfaces
"""
import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

from common import CORPUS, DATA, SNAPSHOT

CORPORA = {
    'filecabinet': CORPUS / 'filecabinet',
    'objects': CORPUS / 'objects',
}
TARGETS_CSV = DATA / 'sweep_targets.csv'
OUT_RAW = DATA / 'reference_matrix_raw.csv'
OUT_SUMMARY = DATA / 'reference_matrix_summary.csv'

TEXT_EXT = {'.js', '.xml', '.html', '.ftl', '.txt', '.json', '.ss', '.csv', '.ts', '.md', ''}
MAX_BYTES = 5 * 1024 * 1024


def load_targets():
    with open(TARGETS_CSV, encoding='utf-8-sig') as fh:
        return [(r['scriptid'].strip().lower(), r['category'].strip())
                for r in csv.DictReader(fh) if r['scriptid'].strip()]


def build_regex(targets):
    ids = sorted((t[0] for t in targets), key=len, reverse=True)
    return re.compile('(' + '|'.join(re.escape(i) for i in ids) + r')(?![a-z0-9_])', re.IGNORECASE)


def iter_files():
    for corpus, root in CORPORA.items():
        if not root.is_dir():
            print(f'WARNING: corpus missing: {root}', file=sys.stderr)
            continue
        for p in sorted(root.rglob('*')):
            if not p.is_file() or p.suffix.lower() not in TEXT_EXT or p.stat().st_size > MAX_BYTES:
                continue
            yield corpus, p, p.relative_to(root).as_posix()


def main():
    targets = load_targets()
    cat = dict(targets)
    rx = build_regex(targets)
    hits = defaultdict(lambda: defaultdict(int))
    surfaces = defaultdict(set)
    nfiles = 0
    for corpus, p, rel in iter_files():
        nfiles += 1
        text = p.read_text(encoding='utf-8', errors='replace')
        for m in rx.finditer(text):
            t = m.group(1).lower()
            hits[t][f'{corpus}:{rel}'] += 1
            surfaces[t].add(corpus)
    print(f'Scanned {nfiles} files in snapshot {SNAPSHOT}')

    with open(OUT_RAW, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh, lineterminator='\n')
        w.writerow(['scriptid', 'category', 'file', 'hits'])
        for t in sorted(hits):
            for f, c in sorted(hits[t].items(), key=lambda kv: (-kv[1], kv[0])):
                w.writerow([t, cat.get(t, ''), f, c])

    with open(OUT_SUMMARY, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh, lineterminator='\n')
        w.writerow(['scriptid', 'category', 'total_hits', 'file_count', 'surfaces'])
        for t, _c in targets:
            w.writerow([t, cat.get(t, ''), sum(hits[t].values()), len(hits[t]), '+'.join(sorted(surfaces[t]))])
    print(f'Wrote {OUT_RAW.name} and {OUT_SUMMARY.name}')


if __name__ == '__main__':
    main()
