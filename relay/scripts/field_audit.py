#!/usr/bin/env python3
"""Field-coverage audit (build-plan task 3): does the API expose everything the backend feed did?

    python scripts/field_audit.py tests/fixtures/live_field_inventory.json [--out audit.md]

Inputs
  * the API key inventory captured by scripts/capture_fixtures.py (or any fixture JSON list)
  * the backend column set: docs/LA_to_XO_Field_Mapping.csv ("XO Backend Source" + alternates)
    and docs/XO_Exclusive_Fields_To_Land.csv
  * every `source` in config/mapping.yaml and every name in config/fields.yaml

Output: a markdown report of (a) mapping sources with no API key, (b) fields.yaml names with no
API key (a 400 waiting to happen), (c) backend columns with no API counterpart, (d) API keys
nobody uses yet. Gaps are reported, never worked around silently.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from xo_relay.xo.models import canon_key  # noqa: E402
from xo_relay.transform.normalize import ALIASES  # noqa: E402

RELAY = Path(__file__).resolve().parents[1]
DOCS = RELAY.parent / "docs"


def api_keys(path: Path) -> set[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    keys: set[str] = set()
    if isinstance(data, dict):
        keys.update(data.keys())
    else:
        for row in data:
            if isinstance(row, dict):
                keys.update(row.keys())
    return keys


def backend_columns() -> set[str]:
    cols: set[str] = set()
    p = DOCS / "LA_to_XO_Field_Mapping.csv"
    if p.exists():
        for r in csv.DictReader(p.open(encoding="utf-8-sig")):
            for col in ("XO Backend Source (primary)", "XO Alternates / Facets"):
                for name in re.split(r",\s*", r.get(col, "") or ""):
                    name = re.sub(r"\s*\(.*?\)", "", name).strip()
                    if name and not name.startswith(("—", "file-", "derivable")):
                        cols.add(name)
    p = DOCS / "XO_Exclusive_Fields_To_Land.csv"
    if p.exists():
        for r in csv.DictReader(p.open(encoding="utf-8-sig")):
            for name in re.split(r"\s*/\s*|\s*\+\s*", r["XO Field / Group"]):
                if name.strip():
                    cols.add(name.strip())
    return cols


def mapping_sources() -> list[tuple[str, str]]:
    m = yaml.safe_load((RELAY / "config" / "mapping.yaml").read_text(encoding="utf-8"))
    out = []
    for c in m["netsuite"]["columns"]:
        src = c["source"]
        if src.startswith("@alias:"):
            for n in ALIASES[src[len("@alias:"):]]:
                out.append((c["header"], n))
        elif not src.startswith("@"):
            out.append((c["header"], src))
    s = m.get("shopify", {})
    out.append(("shopify.price", s.get("price_source", "WebPrice")))
    out.append(("shopify.cost", s.get("cost_source", "ItemCost")))
    return out


def fields_yaml_names() -> list[str]:
    f = yaml.safe_load((RELAY / "config" / "fields.yaml").read_text(encoding="utf-8"))
    names = []
    for g in ("identity", "change_dates", "availability", "pricing", "catalog"):
        names += [str(x).split("#")[0].strip() for x in f[g]]
    return names


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("inventory")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    keys = api_keys(Path(args.inventory))
    ck = {canon_key(k): k for k in keys}
    # group keys (StandardData etc.) expand to prefixes
    prefixes = {canon_key(k).split("-")[0] for k in keys if "-" in k}

    def present(name: str) -> str | None:
        c = canon_key(name)
        if c in ck:
            return ck[c]
        # a facet/extra lives inside a group: Extra-Bulb Type -> key ExtraData-Bulb Type
        for pre in ("standard-", "extra-", "dimension-", "important-", "variant-", "dynamic-", "identifier-"):
            if c.startswith(pre) and c in ck:
                return ck[c]
        return None

    lines = ["# XO API field-coverage audit", "", f"API keys seen: {len(keys)}", ""]
    lines.append("## 1. mapping.yaml sources with NO API key (fix before the mapping locks)")
    miss = [(h, s) for h, s in mapping_sources() if present(s) is None]
    lines += [f"- `{h}` <- `{s}`" for h, s in miss] or ["- none"]
    lines += ["", "## 2. fields.yaml names with NO API key (each one is a 400 waiting to happen)"]
    bad = [n for n in fields_yaml_names() if present(n) is None and canon_key(n) not in prefixes]
    lines += [f"- `{n}`" for n in bad] or ["- none"]
    lines += ["", "## 3. backend feed columns with NO API counterpart"]
    gaps = sorted(c for c in backend_columns() if present(c) is None)
    lines += [f"- {c}" for c in gaps] or ["- none"]
    used = {canon_key(s) for _h, s in mapping_sources()} | {canon_key(n) for n in fields_yaml_names()}
    lines += ["", "## 4. API keys not used anywhere yet"]
    lines += [f"- {k}" for k in sorted(keys) if canon_key(k) not in used] or ["- none"]
    text = "\n".join(lines) + "\n"
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    print(text)
    return 1 if miss or bad else 0


if __name__ == "__main__":
    sys.exit(main())
