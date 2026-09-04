#!/usr/bin/env python3
"""Capture a representative XO response set the moment the token lands (build-plan task 2).

    python scripts/capture_fixtures.py --vendor 3249 --count 50

Writes tests/fixtures/live_delta_flat.json  (StandardData p, FileData/ImageData n - the shape the
relay uses), live_delta_p.json (everything p, string form), live_single_product.json, and
live_field_inventory.json (every key seen, with a sample value) for scripts/field_audit.py.

Read-only: uses XOClient, which can only GET. Responses contain no secrets; the token is not written.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from xo_relay.settings import Settings  # noqa: E402
from xo_relay.xo.client import XOClient  # noqa: E402
from xo_relay.run_delta import load_fields  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vendor", help="XO VendorID to sample (one vendor keeps the set coherent)")
    ap.add_argument("--count", type=int, default=50)
    ap.add_argument("--since", default=None, help="also capture a lastMod delta, e.g. -7days")
    args = ap.parse_args()

    s = Settings.from_env()
    fields, flat = load_fields("full_catalog")
    client = XOClient(s.xo_database_name, s.xo_access_token, rate_limit_rps=min(s.xo_rate_limit_rps, 5))

    rows_flat = client.get_products_page(get_all=True, vendor=args.vendor, fields=fields, limit=args.count, flat_format=flat)
    (OUT / "live_delta_flat.json").write_text(json.dumps(rows_flat, indent=2), encoding="utf-8")
    rows_p = client.get_products_page(get_all=True, vendor=args.vendor, fields=fields, limit=args.count, flat_format="p")
    (OUT / "live_delta_p.json").write_text(json.dumps(rows_p, indent=2), encoding="utf-8")
    if rows_flat:
        pid = rows_flat[0].get("XOItemID")
        single = client.get_product(str(pid), fields=fields, flat_format=flat)
        (OUT / "live_single_product.json").write_text(json.dumps(single, indent=2), encoding="utf-8")
    if args.since:
        d = client.get_products_page(sort="none", last_mod=args.since, fields=fields, limit=args.count, flat_format=flat)
        (OUT / "live_lastmod_sample.json").write_text(json.dumps(d, indent=2), encoding="utf-8")

    inventory: dict[str, str] = {}
    for r in rows_flat + rows_p:
        for k, v in r.items():
            if k not in inventory and v not in (None, "", [], {}):
                inventory[k] = json.dumps(v)[:200]
    (OUT / "live_field_inventory.json").write_text(json.dumps(inventory, indent=2, sort_keys=True), encoding="utf-8")

    print(f"captured {len(rows_flat)} products; {len(inventory)} distinct keys -> {OUT}")
    print("requests:", [(h.status, h.rows, round(h.elapsed_s, 2)) for h in client.history])
    print("next: python scripts/field_audit.py tests/fixtures/live_field_inventory.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
