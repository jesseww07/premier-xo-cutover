"""Shared repo paths for the XO cutover scripts. Everything is relative to the
repo root so the same scripts run on any machine and in CI."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DATA = REPO / 'data'
DOCS = REPO / 'docs'
SDF_ACP = REPO / 'sdf' / 'xo-cutover-acp'
ACP_OBJECTS = SDF_ACP / 'src' / 'Objects'

# Newest snapshot folder under corpus/ (named prod-YYYY-MM-DD)
_snapshots = sorted(p for p in (REPO / 'corpus').iterdir() if p.is_dir() and p.name.startswith('prod-'))
if not _snapshots:
    raise SystemExit('no corpus snapshot found under corpus/prod-YYYY-MM-DD')
CORPUS = _snapshots[-1]
SNAPSHOT = CORPUS.name
