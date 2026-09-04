"""Scheduled entry point: pull the XO delta, resolve NetSuite ids, emit outputs, write a report.

    python -m xo_relay.run_delta --since -7days --targets netsuite,shopify --out out/

Sources:
  live                 XO Product API (needs XO_DATABASE_NAME, XO_ACCESS_TOKEN, whitelisted egress)
  fixture:<path.json>  a recorded/synthetic response - the whole pipeline runs offline

NetSuite id resolution:
  live                 SuiteQL via OAuth 2.0 client credentials
  fixture:<path.json>  {"by_xo_item_id": {"123": {"id": "45"}}, "by_itemid": {"SKU": {"id": "45"}}}
  none                 every record treated as unresolved (report only)

Shopify compare-at:
  live                 Admin GraphQL (SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN)
  fixture:<path.json>  {"SKU": {"price": "10.00", "compareAtPrice": null}}
  none                 skip 2e (the CSV will FAIL validation on purpose - do not import without it)
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional, Sequence

import yaml

from .settings import Settings
from .xo.client import XOClient, DEFAULT_FLAT_FORMAT
from .xo.models import XOProduct, parse_decimal
from .transform.netsuite_map import MappingConfig, DEFAULT_MAPPING_PATH
from .transform.shopify_map import ShopifyMapConfig, build_delta_rows, apply_compare_at, validate_rows
from .netsuite.query import Resolver, Resolution, norm_key, summarize
from .netsuite.write import emit_phase1
from .shopify.matrixify import write_products_csv, upload_manifest

log = logging.getLogger("xo_relay")
FIELDS_PATH = Path(__file__).resolve().parents[2] / "config" / "fields.yaml"


def load_fields(profile: str, path: Path = FIELDS_PATH) -> tuple[list[str], dict[str, str]]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    groups = data[profile]["use"]
    fields: list[str] = []
    for g in groups:
        for f in data[g]:
            name = str(f).split("#", 1)[0].strip()
            if name and name not in fields:
                fields.append(name)
    return fields, dict(data.get("flat_format", DEFAULT_FLAT_FORMAT))


# ---------------------------------------------------------------------- sources
def load_products(source: str, settings: Settings, *, since: str, profile: str) -> list[XOProduct]:
    if source.startswith("fixture:"):
        rows = json.loads(Path(source[len("fixture:"):]).read_text(encoding="utf-8"))
        if isinstance(rows, dict):
            rows = rows.get("data") or rows.get("products") or [rows]
        return [XOProduct.from_api(r) for r in rows]
    if source != "live":
        raise SystemExit(f"unknown source {source!r}")
    fields, flat = load_fields(profile)
    client = XOClient(settings.xo_database_name, settings.xo_access_token, rate_limit_rps=settings.xo_rate_limit_rps,
                      server_error_wait_s=settings.xo_server_error_wait_s, server_error_retries=settings.xo_server_error_retries)
    return list(client.delta(since=since, fields=fields, flat_format=flat))


def make_resolver(spec: str, settings: Settings) -> Optional[Resolver]:
    if spec == "none":
        return None
    if spec.startswith("fixture:"):
        data = json.loads(Path(spec[len("fixture:"):]).read_text(encoding="utf-8"))
        by_xo = {norm_key(k): v for k, v in data.get("by_xo_item_id", {}).items()}
        by_sku = {norm_key(k): v for k, v in data.get("by_itemid", {}).items()}

        def run(sql: str) -> list[dict[str, Any]]:
            table = by_xo if "custitem7 IN" in sql else by_sku
            key = "xo_item_id" if table is by_xo else "itemid"
            import re as _re
            m = _re.search(r"IN \((.*)\)", sql, _re.S)
            wanted = [s.strip().strip("'").replace("''", "'") for s in (m.group(1) if m else "").split(",") if s.strip()]
            out = []
            for w in wanted:
                hit = table.get(norm_key(w))
                if hit is None:
                    continue
                hits = hit if isinstance(hit, list) else [hit]
                for h in hits:
                    out.append({"id": str(h["id"]), key: w, "itemid": h.get("itemid", w), "isinactive": h.get("isinactive", "F")})
            return out
        return Resolver(run)
    if spec == "live":
        from .netsuite.auth import NetSuiteOAuth
        from .netsuite.query import SuiteQL
        return Resolver(SuiteQL(NetSuiteOAuth.from_settings(settings)).run)
    raise SystemExit(f"unknown resolver {spec!r}")


def make_price_lookup(spec: str, settings: Settings):
    if spec == "none":
        return None
    if spec.startswith("fixture:"):
        data = json.loads(Path(spec[len("fixture:"):]).read_text(encoding="utf-8"))

        def lookup(skus: Sequence[str]):
            out = {}
            for s in skus:
                if s in data:
                    out[s] = (parse_decimal(data[s].get("price")), parse_decimal(data[s].get("compareAtPrice")))
            return out
        return lookup
    if spec == "live":
        from .shopify.matrixify import GraphQLPriceLookup
        if not (settings.shopify_store_domain and settings.shopify_admin_token):
            raise SystemExit("SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_TOKEN not set")
        return GraphQLPriceLookup(settings.shopify_store_domain, settings.shopify_admin_token, settings.shopify_api_version)
    raise SystemExit(f"unknown price lookup {spec!r}")


# ---------------------------------------------------------------------- main
def main(argv: Optional[Sequence[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="XO Product API -> NetSuite / Shopify relay")
    ap.add_argument("--since", default="-7days", help="XO lastMod expression (default -7days)")
    ap.add_argument("--source", default="live", help="live | fixture:<path>")
    ap.add_argument("--resolver", default="live", help="live | fixture:<path> | none")
    ap.add_argument("--prices", default="live", help="live | fixture:<path> | none  (Shopify compare-at lookup)")
    ap.add_argument("--targets", default="netsuite,shopify")
    ap.add_argument("--groups", default="", help="comma list of mapping groups to write (default all)")
    ap.add_argument("--profile", default="delta", help="fields.yaml profile")
    ap.add_argument("--mapping", default=str(DEFAULT_MAPPING_PATH))
    ap.add_argument("--out", default=None)
    ap.add_argument("--stamp", default=None)
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    settings = Settings.from_env()
    out_dir = Path(args.out or settings.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = args.stamp or datetime.now().strftime("%Y-%m-%d_%H%M")
    targets = {t.strip() for t in args.targets.split(",") if t.strip()}
    groups = {g.strip() for g in args.groups.split(",") if g.strip()} or None

    cfg = MappingConfig.load(Path(args.mapping))
    if not cfg.item_url_base:
        cfg.item_url_base = settings.xo_item_url_base
    report: dict[str, Any] = {"stamp": stamp, "since": args.since, "source": args.source, "targets": sorted(targets)}

    products = load_products(args.source, settings, since=args.since, profile=args.profile)
    report["records"] = len(products)
    report["records_without_item_number"] = sum(1 for p in products if not p.item_number)
    report["records_without_item_id"] = sum(1 for p in products if p.item_id is None)
    report["availability"] = {}
    for p in products:
        report["availability"][p.availability.value] = report["availability"].get(p.availability.value, 0) + 1
    report["discontinued"] = sum(1 for p in products if p.discontinued)
    report["change_date_coverage"] = sum(1 for p in products if p.last_changed is not None)
    log.info("pulled %s records", len(products))

    # ---- NetSuite
    if "netsuite" in targets:
        resolver = make_resolver(args.resolver, settings)
        if resolver is None:
            resolutions = [Resolution(product=p, note="resolver=none") for p in products]
        else:
            resolutions = resolver.resolve(products)
        report["netsuite_resolution"] = summarize(resolutions)
        if resolver is not None:
            p1 = emit_phase1(resolutions, cfg, out_dir, stamp=stamp, groups=groups)
            report["netsuite_phase1"] = {
                "update_file": str(p1.update_path) if p1.update_path else None, "update_rows": p1.update_rows,
                "add_file": str(p1.add_path) if p1.add_path else None, "add_rows": p1.add_rows,
                "skipped": len(p1.skipped), "update_headers": p1.headers_update, "add_headers": p1.headers_add,
                "unmapped_vendors": p1.unmapped_vendors,
            }
        report["unverified_api_field_names"] = [f"{c.header} <- {c.source}" for c in cfg.unverified_sources()]

    # ---- Shopify
    if "shopify" in targets:
        scfg = ShopifyMapConfig.from_mapping(cfg.shopify)
        rows, sstats = build_delta_rows(products, scfg)
        lookup = make_price_lookup(args.prices, settings)
        ca_stats = apply_compare_at(rows, scfg, lookup) if lookup else None
        errors, warnings = validate_rows(rows, scfg, compare_at_stats=ca_stats)
        report["shopify"] = {"build": sstats, "compare_at": ca_stats, "errors": errors, "warnings": warnings}
        if not errors:
            path = write_products_csv(rows, out_dir / f"shoppremier_delta_Products_{stamp}.csv")
            report["shopify"]["file"] = str(path)
            report["shopify"]["upload"] = upload_manifest(path)
        else:
            log.error("Shopify delta NOT written: %s", errors)

    (out_dir / f"relay_report_{stamp}.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    (out_dir / f"relay_report_{stamp}.md").write_text(render_report(report), encoding="utf-8")
    print(render_report(report))
    return 1 if report.get("shopify", {}).get("errors") else 0


def render_report(r: dict[str, Any]) -> str:
    lines = [f"# XO relay run {r['stamp']}", "", f"- since: `{r['since']}`  source: `{r['source']}`  targets: {', '.join(r['targets'])}",
             f"- records: **{r['records']}**  (no ItemNumber: {r['records_without_item_number']}, no ItemID: {r['records_without_item_id']})",
             f"- availability: {r['availability']}", f"- discontinued: {r['discontinued']}",
             f"- records with a change date: {r['change_date_coverage']}"]
    if "netsuite_resolution" in r:
        lines += ["", "## NetSuite", f"- resolution: {r['netsuite_resolution']}"]
        if "netsuite_phase1" in r:
            p = r["netsuite_phase1"]
            lines += [f"- UPDATE: {p['update_rows']} rows -> {p['update_file']}", f"- ADD: {p['add_rows']} rows -> {p['add_file']}",
                      f"- skipped (ambiguous/unresolvable): {p['skipped']}",
                      f"- ADD rows with an unmapped preferred vendor: {p.get('unmapped_vendors') or 'none'}"]
        if r.get("unverified_api_field_names"):
            lines += ["- API field names still to confirm via field audit: " + "; ".join(r["unverified_api_field_names"])]
    if "shopify" in r:
        s = r["shopify"]
        lines += ["", "## Shopify (Matrixify delta)", f"- build: {s['build']}"]
        if s.get("compare_at"):
            c = dict(s["compare_at"])
            lines += [f"- compare-at: sale {c['sale']}, cleared {c['cleared']}, preserved {c['preserved']}, unchanged {c['unchanged']}, "
                      f"no_price {c['no_price']}, not_found {c['not_found']}; lookup calls {c['lookup_calls']}",
                      f"- SKUs not in Shopify: {c['skus_not_in_shopify']}", f"- suspicious drops: {c['suspicious_drops']}"]
        lines += [f"- errors: {s['errors']}", f"- warnings: {s['warnings']}"]
        if s.get("file"):
            lines += [f"- file: {s['file']}", f"- upload manifest: {s['upload']}"]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    sys.exit(main())
