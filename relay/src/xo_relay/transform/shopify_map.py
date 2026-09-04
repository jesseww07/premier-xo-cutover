"""XO record -> Matrixify Products delta row, preserving the weekly pipeline's contract.

This replaces only Step 1 (the FTP fetch) and the shape of the input. Every downstream rule
of the scheduled `xologic-weekly-delta-import` task is kept, in the same order:
  2a  no Handle / Title / Variant Inventory Tracker columns -> Matrixify matches on Variant SKU
  2b  numeric normalization: no thousands separators anywhere numeric
  2c  negative inventory (ANY magnitude) -> 0 ; blank stays blank (Matrixify: no change)
  2d  built-to-order vendor guard: blank the qty for untracked brands
  2e  compare-at sale pricing against the store's current price (lookup injected)
  3   validation before import
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Iterable, Mapping, Optional, Protocol, Sequence

from ..xo.models import XOProduct, parse_decimal
from .normalize import money2

DEFAULT_COLUMNS: dict[str, str] = {
    "vendor": "Vendor",
    "sku": "Variant SKU",
    "qty": "Variant Inventory Qty",
    "cost": "Variant Cost",
    "price": "Variant Price",
    "command": "Command",
    "discontinued": "Variant Metafield: custom.discontinued_ [single_line_text_field]",
    "backorder_date": "Variant Metafield: custom.backorder_date [date]",
    "compare_at": "Variant Compare At Price",
}
FORBIDDEN_HEADERS = {"handle", "title", "variant inventory tracker"}
DEFAULT_BUILT_TO_ORDER = ("Hubbardton Forge", "Justice Design Group", "Hammerton")


@dataclass
class ShopifyMapConfig:
    columns: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_COLUMNS))
    price_source: str = "WebPrice"
    cost_source: str = "ItemCost"
    built_to_order_vendors: tuple[str, ...] = DEFAULT_BUILT_TO_ORDER
    suspicious_drop_pct: Decimal = Decimal("70")
    max_clear_rate_pct: Decimal = Decimal("30")

    @classmethod
    def from_mapping(cls, shopify_section: Mapping[str, Any]) -> "ShopifyMapConfig":
        cols = dict(DEFAULT_COLUMNS)
        cols.update(shopify_section.get("columns", {}) or {})
        for h in cols.values():
            if h.strip().lower() in FORBIDDEN_HEADERS:
                raise ValueError(f"{h!r} must never be in the delta (forces Handle matching / tracker flip)")
        return cls(
            columns=cols,
            price_source=shopify_section.get("price_source", "WebPrice"),
            cost_source=shopify_section.get("cost_source", "ItemCost"),
            built_to_order_vendors=tuple(shopify_section.get("built_to_order_vendors", DEFAULT_BUILT_TO_ORDER)),
            suspicious_drop_pct=Decimal(str(shopify_section.get("suspicious_drop_pct", 70))),
            max_clear_rate_pct=Decimal(str(shopify_section.get("max_clear_rate_pct", 30))),
        )

    def is_built_to_order(self, vendor: Optional[str]) -> bool:
        if not vendor:
            return False
        v = vendor.strip().lower()
        return any(v == b.strip().lower() for b in self.built_to_order_vendors)


# ---------------------------------------------------------------------- 2c: quantity
def shopify_inventory_qty(in_stock: Optional[int]) -> str:
    """Policy (Jesse, 2026-08-24): every negative -> 0 (keeps drop-ship purchasable with a sane
    display); blank -> blank (Matrixify: no change). Do not 'fix' to a positive placeholder."""
    if in_stock is None:
        return ""
    if in_stock < 0:
        return "0"
    return str(in_stock)


# ---------------------------------------------------------------------- row build
def build_delta_row(product: XOProduct, cfg: ShopifyMapConfig) -> dict[str, str]:
    c = cfg.columns
    vendor = product.vendor_name or ""
    sku = product.item_number or ""
    qty = shopify_inventory_qty(product.in_stock)
    if cfg.is_built_to_order(vendor):
        qty = ""  # 2d guard: never write a quantity onto an untracked built-to-order variant
    price = money2(product.get(cfg.price_source)) or ""
    cost = money2(product.get(cfg.cost_source)) or ""
    disc = product.discontinued
    bod = product.back_order_date
    row = {
        c["vendor"]: vendor,
        c["sku"]: sku,
        c["qty"]: qty,
        c["cost"]: cost,
        c["price"]: price,
        c["command"]: "UPDATE",
        c["discontinued"]: "" if disc is None else ("1" if disc else "0"),
        c["backorder_date"]: bod.date().isoformat() if bod else "",
    }
    return row


def build_delta_rows(products: Iterable[XOProduct], cfg: ShopifyMapConfig) -> tuple[list[dict[str, str]], dict[str, Any]]:
    rows: list[dict[str, str]] = []
    stats: dict[str, Any] = {
        "rows": 0, "negatives_normalized": 0, "negative_values": {}, "blank_qty": 0,
        "built_to_order_blanked": {}, "missing_sku": 0, "discontinued": {"1": 0, "0": 0, "": 0},
    }
    for p in products:
        row = build_delta_row(p, cfg)
        rows.append(row)
        stats["rows"] += 1
        if not row[cfg.columns["sku"]]:
            stats["missing_sku"] += 1
        stk = p.in_stock
        if stk is not None and stk < 0:
            stats["negatives_normalized"] += 1
            stats["negative_values"][str(stk)] = stats["negative_values"].get(str(stk), 0) + 1
        if cfg.is_built_to_order(p.vendor_name):
            stats["built_to_order_blanked"][p.vendor_name] = stats["built_to_order_blanked"].get(p.vendor_name, 0) + 1
        if row[cfg.columns["qty"]] == "":
            stats["blank_qty"] += 1
        stats["discontinued"][row[cfg.columns["discontinued"]]] += 1
    return rows, stats


# ---------------------------------------------------------------------- 2e: compare-at
class PriceLookup(Protocol):
    def __call__(self, skus: Sequence[str]) -> dict[str, tuple[Optional[Decimal], Optional[Decimal]]]: ...


def compare_at_value(new_price: Optional[Decimal], old_price: Optional[Decimal],
                     existing_compare_at: Optional[Decimal]) -> tuple[str, str]:
    """Return (cell_value, outcome). Outcomes: sale, cleared, preserved, unchanged, no_price, not_found.

    An EMPTY cell in a present column CLEARS the value - so 'no change' must re-write the
    existing compare-at, and empty is only ever written when we intend to clear.
    """
    def fmt(d: Optional[Decimal]) -> str:
        return "" if d is None else money2(d) or ""

    if old_price is None:
        return "", "not_found"
    if new_price is None:
        return fmt(existing_compare_at), "no_price"
    if new_price < old_price:
        cand = max([d for d in (old_price, existing_compare_at) if d is not None])
        return (fmt(cand), "sale") if cand > new_price else ("", "cleared")
    if new_price > old_price:
        return "", "cleared"
    val = existing_compare_at
    if val is not None and val <= new_price:
        val = None
    return fmt(val), "preserved" if val is not None else "unchanged"


def apply_compare_at(rows: list[dict[str, str]], cfg: ShopifyMapConfig, lookup: PriceLookup,
                     *, batch_size: int = 40) -> dict[str, Any]:
    """Mutates rows in place, appending the compare-at column to EVERY row. Returns stats."""
    sku_col, price_col, ca_col = cfg.columns["sku"], cfg.columns["price"], cfg.columns["compare_at"]
    skus = list(dict.fromkeys(r[sku_col] for r in rows if r[sku_col]))
    store: dict[str, tuple[Optional[Decimal], Optional[Decimal]]] = {}
    for i in range(0, len(skus), batch_size):
        store.update(lookup(skus[i:i + batch_size]))
    asked, got = set(skus), set(store)
    stats: dict[str, Any] = {
        "lookup_calls": (len(skus) + batch_size - 1) // batch_size if skus else 0,
        "skus_not_in_shopify": sorted(asked - got),
        "unexpected_skus_returned": sorted(got - asked),
        "sale": 0, "cleared": 0, "preserved": 0, "unchanged": 0, "no_price": 0, "not_found": 0,
        "suspicious_drops": [], "priced_rows": 0, "parse_failures": [],
    }
    for r in rows:
        sku = r[sku_col]
        raw_price = r[price_col]
        try:
            new_price = parse_decimal(raw_price) if raw_price != "" else None
        except (InvalidOperation, ValueError):
            stats["parse_failures"].append({"sku": sku, "raw": raw_price})
            r[ca_col] = ""
            continue
        old_price, existing = store.get(sku, (None, None))
        cell, outcome = compare_at_value(new_price, old_price, existing)
        # final validity: compare-at must be strictly greater than price
        if cell and new_price is not None and Decimal(cell) <= new_price:
            cell = ""
        r[ca_col] = cell
        stats[outcome] += 1
        if new_price is not None:
            stats["priced_rows"] += 1
        if outcome == "sale" and old_price and new_price is not None and old_price > 0:
            drop_pct = (old_price - new_price) / old_price * 100
            if drop_pct > cfg.suspicious_drop_pct:
                stats["suspicious_drops"].append({"sku": sku, "old": str(old_price), "new": str(new_price),
                                                  "drop_pct": str(drop_pct.quantize(Decimal('0.1')))})
    return stats


# ---------------------------------------------------------------------- 3: validation
def validate_rows(rows: Sequence[Mapping[str, str]], cfg: ShopifyMapConfig, *, compare_at_stats: Optional[Mapping[str, Any]] = None,
                  expected_min_rows: int = 1, expected_max_rows: int = 20000) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). Any error means: do not import."""
    errors: list[str] = []
    warnings: list[str] = []
    c = cfg.columns
    if not rows:
        return ["delta has zero rows"], warnings
    headers = {h.strip().lower() for h in rows[0].keys()}
    for bad in FORBIDDEN_HEADERS:
        if bad in headers:
            errors.append(f"forbidden column present: {bad}")
    if c["compare_at"] not in rows[0]:
        errors.append("compare-at column missing (2e did not run)")
    missing_sku = sum(1 for r in rows if not r.get(c["sku"]))
    if missing_sku:
        (errors if missing_sku > 5 else warnings).append(f"{missing_sku} rows have no Variant SKU")
    for r in rows:
        q = r.get(c["qty"], "")
        if q != "":
            try:
                if int(q) < 0:
                    errors.append(f"negative quantity survived for {r.get(c['sku'])}: {q}")
            except ValueError:
                errors.append(f"non-integer quantity for {r.get(c['sku'])}: {q!r}")
        for col in (c["qty"], c["cost"], c["price"], c["compare_at"]):
            v = r.get(col, "")
            if "," in v:
                errors.append(f"thousands separator in {col} for {r.get(c['sku'])}: {v!r}")
        for col in (c["cost"], c["price"]):
            v = r.get(col, "")
            if v != "":
                try:
                    Decimal(v)
                except InvalidOperation:
                    errors.append(f"unparseable {col} for {r.get(c['sku'])}: {v!r}")
        ca, pr = r.get(c["compare_at"], ""), r.get(c["price"], "")
        if ca != "" and pr != "":
            try:
                if Decimal(ca) <= Decimal(pr):
                    errors.append(f"compare-at <= price for {r.get(c['sku'])}: {ca} <= {pr}")
            except InvalidOperation:
                pass
    n = len(rows)
    if n < expected_min_rows or n > expected_max_rows:
        errors.append(f"row count {n} outside sane range [{expected_min_rows}, {expected_max_rows}]")
    if compare_at_stats:
        priced = compare_at_stats.get("priced_rows", 0)
        cleared = compare_at_stats.get("cleared", 0)
        if priced and Decimal(cleared) / Decimal(priced) * 100 > cfg.max_clear_rate_pct:
            warnings.append(f"{cleared}/{priced} priced rows clear compare-at (> {cfg.max_clear_rate_pct}%) - possible systematic price inflation; pause and review")
        if compare_at_stats.get("parse_failures"):
            errors.append(f"unparseable prices: {compare_at_stats['parse_failures'][:10]}")
        if compare_at_stats.get("suspicious_drops"):
            warnings.append(f"{len(compare_at_stats['suspicious_drops'])} drops > {cfg.suspicious_drop_pct}% flagged for a human look")
    return errors, warnings
