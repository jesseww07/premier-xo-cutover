"""Typed view over a raw XO product record.

The API returns JSON keyed by field name. FlatFormat flattens data groups into keys like
`StandardData-Finish`; the backend CSV feed called the same thing `Standard-Finish`. Field
lookup here is canonical (case-, space-, and prefix-insensitive) so the mapping config can
use either spelling and the field-coverage audit can confirm the real names once a token
lands. Nothing is guessed silently: `get()` returns None for a missing key.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any, Iterable, Mapping, Optional


class Availability(str, Enum):
    IN_STOCK = "in_stock"                      # InStock > 0
    IN_STOCK_QTY_UNKNOWN = "in_stock_qty_unknown"  # InStock < 0 (documented as -1; any negative)
    OUT_OF_STOCK = "out_of_stock"              # InStock == 0
    UNKNOWN = "unknown"                        # blank: no manufacturer update in > 1 week


_CANON_PREFIX = (
    ("standarddata-", "standard-"),
    ("extradata-", "extra-"),
    ("dimensiondata-", "dimension-"),
    ("importantdata-", "important-"),
    ("variantdata-", "variant-"),
    ("dynamicdata-", "dynamic-"),
    ("identifierdata-", "identifier-"),
    ("attributedata-", "attribute-"),
)


def canon_key(key: str) -> str:
    k = key.strip().lower()
    for long, short in _CANON_PREFIX:
        if k.startswith(long):
            k = short + k[len(long):]
            break
    k = k.replace(" ", "").replace("_", "")
    return k


def parse_decimal(value: Any) -> Optional[Decimal]:
    """'3,276.00' -> Decimal('3276.00'); '' / None -> None. Raises on garbage."""
    if value is None:
        return None
    if isinstance(value, bool):
        raise InvalidOperation(f"boolean is not a number: {value!r}")
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    s = str(value).strip()
    if s == "":
        return None
    s = s.replace(",", "").replace("$", "")
    return Decimal(s)


def parse_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    s = str(value).strip().replace(",", "")
    if s == "":
        return None
    return int(Decimal(s))


_TRUE = {"1", "true", "t", "yes", "y"}
_FALSE = {"0", "false", "f", "no", "n", ""}


def parse_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    s = str(value).strip().lower()
    if s in _TRUE:
        return True
    if s in _FALSE:
        return None if s == "" else False
    raise ValueError(f"not a boolean: {value!r}")


_DATE_FORMATS = ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y")


def parse_utc(value: Any) -> Optional[datetime]:
    """XO timestamps are UTC ISO-8601. Returns an aware datetime or None."""
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value).strip()
    if s.endswith("Z"):
        s2 = s[:-1] + "+00:00"
    else:
        s2 = s
    try:
        dt = datetime.fromisoformat(s2)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(s, fmt)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    raise ValueError(f"unparseable timestamp: {value!r}")


def availability_from_in_stock(in_stock: Optional[int]) -> Availability:
    if in_stock is None:
        return Availability.UNKNOWN
    if in_stock < 0:
        return Availability.IN_STOCK_QTY_UNKNOWN
    if in_stock == 0:
        return Availability.OUT_OF_STOCK
    return Availability.IN_STOCK


@dataclass
class XOProduct:
    raw: Mapping[str, Any]
    _index: dict[str, str] = field(default_factory=dict, repr=False, compare=False)

    @classmethod
    def from_api(cls, row: Mapping[str, Any]) -> "XOProduct":
        p = cls(raw=dict(row))
        p._index = {canon_key(k): k for k in p.raw.keys()}
        return p

    # ------------------------------------------------------------------ lookup
    def has(self, name: str) -> bool:
        return canon_key(name) in self._index

    def get(self, name: str, default: Any = None) -> Any:
        key = self._index.get(canon_key(name))
        if key is None:
            return default
        v = self.raw[key]
        if isinstance(v, str):
            v = v.strip()
            if v == "":
                return default
        return v

    def first(self, *names: str, default: Any = None) -> Any:
        """First non-empty value among alias names (coalesce)."""
        for n in names:
            v = self.get(n)
            if v not in (None, ""):
                return v
        return default

    def keys_with_prefix(self, prefix: str) -> list[str]:
        cp = canon_key(prefix)
        return [orig for ck, orig in self._index.items() if ck.startswith(cp)]

    # ------------------------------------------------------------------ identity
    @property
    def item_id(self) -> Optional[int]:
        """XO permanent numeric item id -> NetSuite custitem7 'XO Item ID'."""
        return parse_int(self.get("ItemID"))

    @property
    def xo_item_id(self) -> Optional[str]:
        """'{VendorID}-{VItemID}' composite. Clean over the API (mangling was a CSV/Excel artifact)."""
        v = self.get("XOItemID")
        if v is not None:
            return str(v)
        vid, vit = self.get("VendorID"), self.get("VItemID")
        if vid is not None and vit is not None:
            return f"{vid}-{vit}"
        return None

    @property
    def vendor_id(self) -> Optional[int]:
        return parse_int(self.get("VendorID"))

    @property
    def vendor_name(self) -> Optional[str]:
        v = self.first("VendorName", "Vendor Name", "Catalog")
        return str(v) if v is not None else None

    @property
    def item_number(self) -> Optional[str]:
        """Vendor's item number = Premier's SKU / NetSuite Item Name/Number."""
        v = self.first("ItemNumber", "Item Number")
        return str(v).strip() if v is not None else None

    @property
    def base_item_number(self) -> Optional[str]:
        v = self.first("BaseItemNumber", "Base Item Number")
        return str(v).strip() if v is not None else None

    @property
    def gtin(self) -> Optional[str]:
        """14-digit, leading zeros significant. Stored as-is, never as a number."""
        v = self.get("GTIN")
        if v is None:
            return None
        s = str(v).strip()
        if s.isdigit() and len(s) < 14:
            s = s.zfill(14)
        return s

    @property
    def item_name(self) -> Optional[str]:
        v = self.first("ItemName", "Item Name")
        return str(v) if v is not None else None

    # ------------------------------------------------------------------ pricing
    def money(self, *names: str) -> Optional[Decimal]:
        return parse_decimal(self.first(*names))

    @property
    def item_cost(self) -> Optional[Decimal]:
        return self.money("ItemCost", "Item Cost")

    @property
    def vendor_discounted_cost(self) -> Optional[Decimal]:
        return self.money("VendorDiscountedCost", "Vendor Discounted Cost")

    @property
    def cost_with_shipping(self) -> Optional[Decimal]:
        return self.money("CostWithShipping", "Cost With Shipping")

    @property
    def web_price(self) -> Optional[Decimal]:
        return self.money("WebPrice", "Web Price")

    @property
    def price(self) -> Optional[Decimal]:
        return self.money("Price")

    @property
    def msrp(self) -> Optional[Decimal]:
        return self.money("MSRP")

    @property
    def imap(self) -> Optional[Decimal]:
        return self.money("IMAP")

    @property
    def umap(self) -> Optional[Decimal]:
        return self.money("UMAP")

    # ------------------------------------------------------------------ availability
    @property
    def in_stock(self) -> Optional[int]:
        return parse_int(self.first("InStock", "In Stock"))

    @property
    def availability(self) -> Availability:
        return availability_from_in_stock(self.in_stock)

    @property
    def discontinued(self) -> Optional[bool]:
        return parse_bool(self.get("Discontinued"))

    @property
    def back_order_date(self) -> Optional[datetime]:
        return parse_utc(self.first("BackOrderDate", "Back Order Date"))

    @property
    def availability_changed(self) -> Optional[datetime]:
        return parse_utc(self.first("AvailabilityChangedDate", "Availability Changed Date", "Availability Changed"))

    @property
    def catalog_changed(self) -> Optional[datetime]:
        return parse_utc(self.first("CatalogChangedDate", "Catalog Changed Date", "Catalog Changed"))

    @property
    def price_changed(self) -> Optional[datetime]:
        return parse_utc(self.first("PriceChangedDate", "Price Changed Date", "Price Changed"))

    @property
    def last_changed(self) -> Optional[datetime]:
        """Max of the three change dates unless XO supplies an explicit Last Changed."""
        explicit = self.first("LastChangedDate", "Last Changed Date", "Last Changed")
        if explicit is not None:
            return parse_utc(explicit)
        dates = [d for d in (self.availability_changed, self.catalog_changed, self.price_changed) if d]
        return max(dates) if dates else None

    def change_dates_within(self, start: datetime, end: datetime) -> bool:
        """Acceptance check: at least one change date falls inside the delta window."""
        for d in (self.availability_changed, self.catalog_changed, self.price_changed):
            if d is not None and start <= d <= end:
                return True
        return False

    # ------------------------------------------------------------------ facets
    def standard(self, facet: str) -> Optional[str]:
        v = self.first(f"StandardData-{facet}", f"Standard-{facet}")
        return str(v) if v is not None else None

    def standard_values(self, facet: str) -> list[str]:
        v = self.standard(facet)
        return [s.strip() for s in v.split("|") if s.strip()] if v else []

    def extra(self, name: str) -> Optional[str]:
        v = self.first(f"ExtraData-{name}", f"Extra-{name}")
        return str(v) if v is not None else None
