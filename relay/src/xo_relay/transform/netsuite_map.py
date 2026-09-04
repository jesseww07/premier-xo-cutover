"""XO record -> NetSuite column set, driven by config/mapping.yaml.

One mapping serves both phases: Phase 1 emits the columns as a CSV for the saved import
map; Phase 2 sends the same values as a SuiteTalk REST body. Columns flagged `rest: false`
(sublist / price-level columns) are CSV-only until Phase 2 handles sublists explicitly.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Optional, Sequence

import yaml

from ..xo.models import XOProduct, parse_decimal, parse_int, parse_bool, parse_utc
from . import files as F
from . import normalize as N

DEFAULT_MAPPING_PATH = Path(__file__).resolve().parents[3] / "config" / "mapping.yaml"


@dataclass(frozen=True)
class Column:
    header: str
    source: str                       # XO field name, alias group ("@alias:x"), or computed ("@internal_id", ...)
    ns_field: Optional[str] = None    # script id / REST field name
    transforms: tuple[str, ...] = ()
    on: tuple[str, ...] = ("update", "add")
    groups: tuple[str, ...] = ("catalog",)
    rest: bool = True
    note: str = ""
    verify: bool = False              # API field name not yet confirmed by the field audit

    def applies(self, op: str, groups: Optional[set[str]]) -> bool:
        if op not in self.on:
            return False
        if groups is None:
            return True
        return bool(set(self.groups) & groups)


@dataclass
class MappingConfig:
    columns: list[Column]
    date_format: str = "%m/%d/%Y"
    item_url_base: str = ""
    add_defaults: dict[str, str] = field(default_factory=dict)
    vendor_map: dict[str, str] = field(default_factory=dict)
    csv_bom: bool = True
    shopify: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls, path: Path = DEFAULT_MAPPING_PATH) -> "MappingConfig":
        data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
        ns = data.get("netsuite", {})
        cols: list[Column] = []
        seen_headers: set[str] = set()
        for c in ns.get("columns", []):
            header = c["header"]
            if header in seen_headers:
                raise ValueError(f"duplicate CSV header in mapping: {header}")
            seen_headers.add(header)
            cols.append(
                Column(
                    header=header,
                    source=c["source"],
                    ns_field=c.get("ns_field"),
                    transforms=tuple(c.get("transform", []) or []),
                    on=tuple(c.get("ops") or c.get("on") or c.get(True) or ["update", "add"]),
                    groups=tuple(c.get("groups", ["catalog"])),
                    rest=bool(c.get("rest", True)),
                    note=c.get("note", ""),
                    verify=bool(c.get("verify", False)),
                )
            )
        return cls(
            columns=cols,
            date_format=ns.get("date_format", "%m/%d/%Y"),
            item_url_base=data.get("item_url_base", "") or "",
            add_defaults={str(k): str(v) for k, v in (ns.get("add_defaults", {}) or {}).items()},
            vendor_map={str(k): str(v) for k, v in (ns.get("vendor_map", {}) or {}).items()},
            csv_bom=bool(ns.get("csv_bom", True)),
            shopify=dict(data.get("shopify", {}) or {}),
            raw=data,
        )

    def headers(self, op: str, groups: Optional[set[str]] = None) -> list[str]:
        return [c.header for c in self.columns if c.applies(op, groups)]

    def unverified_sources(self) -> list[Column]:
        return [c for c in self.columns if c.verify]

    def ns_vendor(self, brand: Optional[str]) -> Optional[str]:
        """Exact NetSuite vendor name for a Shopify/XO brand (case-insensitive), None if unmapped."""
        if not brand:
            return None
        b = brand.strip().lower()
        for k, v in self.vendor_map.items():
            if k.strip().lower() == b:
                return v
        return None


# ---------------------------------------------------------------------- transforms
def _t_strip_units(v, ctx):  return N.strip_units(v)
def _t_money(v, ctx):        return N.money2(v)
def _t_int(v, ctx):
    i = parse_int(v)
    return None if i is None else str(i)
def _t_date(v, ctx):
    dt = parse_utc(v)
    return None if dt is None else dt.strftime(ctx.date_format)
def _t_datetime_iso(v, ctx):
    dt = parse_utc(v)
    return None if dt is None else dt.isoformat()
def _t_bool_tf(v, ctx):
    b = parse_bool(v)
    return None if b is None else ("T" if b else "F")
def _t_bool_yesno(v, ctx):
    b = parse_bool(v)
    return None if b is None else ("Yes" if b else "No")
def _t_gtin(v, ctx):         return N.gtin_store(v)
def _t_url(v, ctx):          return N.absolutize_url(v, ctx.item_url_base)
def _t_led(v, ctx):          return N.led_from_flag(v)
def _t_text(v, ctx):         return None if v is None else str(v)
def _t_upper(v, ctx):        return None if v is None else str(v).upper()
def _t_ns_vendor(v, ctx):    return ctx.ns_vendor(None if v is None else str(v))
def _t_discontinued_active(v, ctx):
    """XO Discontinued 0/1 -> Active T/F (inverse)."""
    b = parse_bool(v)
    return None if b is None else ("F" if b else "T")


TRANSFORMS: dict[str, Callable[[Any, "MappingConfig"], Optional[str]]] = {
    "strip_units": _t_strip_units,
    "money": _t_money,
    "int": _t_int,
    "date": _t_date,
    "datetime_iso": _t_datetime_iso,
    "bool_tf": _t_bool_tf,
    "bool_yesno": _t_bool_yesno,
    "gtin": _t_gtin,
    "url": _t_url,
    "led": _t_led,
    "text": _t_text,
    "upper": _t_upper,
    "discontinued_to_active": _t_discontinued_active,
    "ns_vendor": _t_ns_vendor,
}


# ---------------------------------------------------------------------- source resolution
def resolve_source(product: XOProduct, source: str, cfg: MappingConfig, ctx: Mapping[str, Any]) -> Any:
    if source.startswith("@alias:"):
        return N.alias(product, source[len("@alias:"):])
    if source.startswith("@"):
        name = source[1:]
        if name == "internal_id":
            return ctx.get("internal_id")
        if name == "shopify_handle":
            return N.shopify_handle(product.vendor_name, product.base_item_number)
        if name == "xo_item_id":
            return product.xo_item_id
        if name == "last_changed":
            return product.last_changed
        if name == "spec_sheet":
            return F.spec_sheet(product, base=cfg.item_url_base)
        if name == "installation_sheet":
            return F.installation_sheet(product, base=cfg.item_url_base)
        if name == "warranty_doc":
            return F.warranty_doc(product, base=cfg.item_url_base)
        if name == "primary_image":
            return F.primary_image(product, base=cfg.item_url_base)
        if name == "gallery":
            return "|".join(F.gallery(product, base=cfg.item_url_base)) or None
        if name == "fan_watts":
            w = N.fan_watts(N.alias(product, "cfm_headline"), N.alias(product, "cfm_per_watt"))
            return None if w is None else str(w)
        if name == "vendor_name":
            return product.vendor_name
        if name == "item_number":
            return product.item_number
        if name == "availability":
            return product.availability.value
        if name in ctx:
            return ctx[name]
        raise KeyError(f"unknown computed source {source!r}")
    return product.get(source)


def apply_transforms(value: Any, transforms: Sequence[str], cfg: MappingConfig) -> Optional[str]:
    v = value
    for t in transforms:
        fn = TRANSFORMS.get(t)
        if fn is None:
            raise KeyError(f"unknown transform {t!r}")
        v = fn(v, cfg)
        if v is None:
            return None
    if v is None:
        return None
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, datetime):
        return v.strftime(cfg.date_format)
    if isinstance(v, bool):
        return "T" if v else "F"
    return str(v)


# ---------------------------------------------------------------------- rows
def build_row(
    product: XOProduct,
    cfg: MappingConfig,
    *,
    op: str,
    internal_id: Optional[str] = None,
    groups: Optional[set[str]] = None,
    extra_ctx: Optional[Mapping[str, Any]] = None,
) -> dict[str, str]:
    """Ordered header -> value (strings; '' for empty). Column order = mapping order."""
    if op not in ("update", "add"):
        raise ValueError(op)
    if op == "update" and not internal_id:
        raise ValueError("update rows need an internal_id")
    ctx: dict[str, Any] = {"internal_id": internal_id}
    if extra_ctx:
        ctx.update(extra_ctx)
    row: dict[str, str] = {}
    for col in cfg.columns:
        if not col.applies(op, groups):
            continue
        raw = resolve_source(product, col.source, cfg, ctx)
        val = apply_transforms(raw, col.transforms, cfg)
        if val is None and op == "add" and col.header in cfg.add_defaults:
            val = cfg.add_defaults[col.header]
        row[col.header] = "" if val is None else val
    if op == "add":
        for header, default in cfg.add_defaults.items():
            row.setdefault(header, default)
    return row


def rest_body(row: Mapping[str, str], cfg: MappingConfig) -> dict[str, Any]:
    """Phase 2: header->value row to a SuiteTalk REST body keyed by ns_field. Skips rest:false."""
    by_header = {c.header: c for c in cfg.columns}
    body: dict[str, Any] = {}
    for header, val in row.items():
        col = by_header.get(header)
        if col is None or not col.rest or not col.ns_field or col.ns_field == "id":
            continue
        if val == "":
            continue
        body[col.ns_field] = _rest_value(val, col)
    return body


def _rest_value(val: str, col: Column) -> Any:
    if "money" in col.transforms:
        return float(Decimal(val))
    if "int" in col.transforms:
        return int(val)
    if "bool_tf" in col.transforms or "discontinued_to_active" in col.transforms:
        return val == "T"
    if "date" in col.transforms:
        # REST wants ISO dates; the CSV format is account-locale. Re-parse.
        dt = datetime.strptime(val, "%m/%d/%Y") if "/" in val else parse_utc(val)
        return dt.date().isoformat()
    return val
