"""Normalization rules established against real XO data (handoff §7). Match by meaning, not name.

Every rule here has a test in tests/test_normalize.py. When XO data contradicts one of these,
fix the rule AND the test, and record why in relay/README.md.
"""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Iterable, Optional, Sequence

from ..xo.models import XOProduct, parse_decimal

# ---------------------------------------------------------------------- alias groups
# Coalesce order matters: first non-empty wins, so the canonical / headline figure leads.
ALIASES: dict[str, tuple[str, ...]] = {
    # case / spelling duplicates
    "number_of_bulbs": ("Extra-Number of Bulbs", "Extra-Number Of Bulbs"),
    "number_of_speeds": ("Extra-Number of Speeds", "Extra-Number Of Speeds"),
    # downrod data appears under three schemes
    "downrod_included": ("Extra-Downrod Included", "Extra-Down Rod Included"),
    "downrod_length_1": ("Extra-Downrod Length 1", "Extra-Downrod 1 Length"),
    "downrod_length_2": ("Extra-Downrod Length 2", "Extra-Downrod 2 Length"),
    "downrod_width_1": ("Extra-Downrod Width 1", "Extra-Downrod 1 Width"),
    # canonical-figure rule: headline CFM, not a slice
    "cfm_headline": ("Extra-Air Flow CFM", "Extra-CFM High", "Extra-High CFM"),
    "cfm_low": ("Extra-CFM Low", "Extra-Low CFM"),
    "cfm_per_watt": ("Extra-High CFM/Watts", "Extra-High CFM Per Watts", "Extra-CFM/Watts", "Extra-CFM Per Watts"),
    "amps": ("Extra-Amperage", "Extra-High Amps", "Extra-Amps High", "Extra-Low Amps", "Extra-Amps Low"),
    # fans: XO calls blade span "Blade Sweep"
    "blade_span": ("Extra-Blade Sweep", "Extra-Blade Span"),
    # motor reverse. NEVER include "Extra-Reversible Blades" here - that is two-sided blade finish.
    "reverse_capable": ("Extra-Reverse Capable",),
    "reversible_blades": ("Extra-Reversible Blades",),
    # chain: "Chain Included" holds lengths, not booleans
    "chain_length": ("Extra-Chain Length", "Extra-Chain Included"),
    "wire_length": ("Extra-Wire Cord Length", "Extra-Cord Length", "Extra-Wire Length"),
    # the naming inversion (NetSuite labels were fixed on the form; sources are XO's real meaning)
    "safety_rating": ("Extra-Safety Rating",),                       # ETL / UL  -> custitem_la_safety_listing
    "location_rating": ("Extra-Location Rating", "Standard-Location Rating"),  # Damp / Wet -> custitem_la_safety_rating
    "wattage": ("Extra-Bulb Wattage", "Standard-Wattage", "Extra-Total Wattage", "Extra-Max Wattage"),
    "kelvin": ("Extra-Kelvin", "Standard-Kelvin", "Extra-CCT"),
    "lumens": ("Extra-Initial Lumens", "Standard-Lumens", "Extra-Delivered Lumens"),
    "voltage": ("Extra-Voltage", "Standard-Voltage"),
    "finish_verbatim": ("Extra-Finish",),
    "finish_facet": ("Standard-Finish",),
    "material": ("Extra-Material", "Extra-Material-2"),
    "warranty": ("Extra-Warranty", "Extra-Warranty-2"),
    "light_kit": ("Extra-Light Kit Included", "Extra-Light Kit Included-2"),
    "airflow_efficiency": ("Extra-High CFM/Watts", "Extra-High/Low CFM Per Watts", "Extra-Low CFM/Watts"),
    "weight": ("Extra-Weight",),
    "ship_weight": ("Extra-Ship Weight",),
    "product_name": ("ItemName", "Item Name", "Combined Item Name"),
    "collection": ("Family", "Extra-Family"),
}

NEVER_COALESCE = (("reverse_capable", "reversible_blades"),)


def alias(product: XOProduct, group: str) -> Optional[str]:
    names = ALIASES[group]
    v = product.first(*names)
    return None if v is None else str(v)


# ---------------------------------------------------------------------- units
_NUM_RE = re.compile(
    r"""^\s*
        (?P<num>[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)   # 60 | 3,290.33 | 12.5
        \s*
        (?P<unit>[a-zA-Z°"'”″′%/-]*.*)?                      # W | V | " | ° | CFM | lbs | in.
        $""",
    re.VERBOSE,
)


def strip_units(value, *, strict: bool = False) -> Optional[str]:
    """'60 W' -> '60'; '120 V' -> '120'; '42\"' -> '42'; '3,290.33 CFM' -> '3290.33'.

    Returns None for blank. If the value has no leading number, returns the original string
    (strict=False) or None (strict=True). Never returns a float - numbers stay as text so
    NetSuite TEXT fields receive exactly what XO said, minus the unit.
    """
    if value is None:
        return None
    s = str(value).strip()
    if s == "":
        return None
    m = _NUM_RE.match(s)
    if not m:
        return None if strict else s
    num = m.group("num").replace(",", "")
    return num


def to_decimal_or_none(value) -> Optional[Decimal]:
    try:
        return parse_decimal(strip_units(value, strict=True))
    except (InvalidOperation, ValueError):
        return None


def money2(value) -> Optional[str]:
    """Decimal formatted with two places, no thousands separators. None when blank."""
    d = parse_decimal(value) if not isinstance(value, Decimal) else value
    if d is None:
        return None
    return f"{d.quantize(Decimal('0.01'))}"


# ---------------------------------------------------------------------- fans
def fan_watts(cfm, cfm_per_watt) -> Optional[Decimal]:
    """Fan electricity is amps in XO, not watts. Derive watts = CFM / (CFM per Watt)."""
    c = to_decimal_or_none(cfm)
    e = to_decimal_or_none(cfm_per_watt)
    if c is None or e is None or e == 0:
        return None
    return (c / e).quantize(Decimal("0.1"))


# ---------------------------------------------------------------------- identifiers
def gtin_store(value) -> Optional[str]:
    """Store GTIN as text, 14 digits, leading zeros intact."""
    if value in (None, ""):
        return None
    s = str(value).strip()
    if s.isdigit() and len(s) < 14:
        s = s.zfill(14)
    return s


def gtin_compare_key(value) -> Optional[str]:
    """Strip leading zeros ONLY for comparison (LA stored 12-digit UPCs)."""
    s = gtin_store(value)
    return s.lstrip("0") if s else None


def led_from_flag(value) -> Optional[str]:
    """XO Extra-LED is Yes/No; LA Light Source was the text 'LED'."""
    if value is None:
        return None
    return "LED" if str(value).strip().lower() in {"yes", "y", "true", "1"} else None


# ---------------------------------------------------------------------- urls / handles
def absolutize_url(path, base: str) -> Optional[str]:
    """`Item URL` arrives as a relative path ('/brand-minka-lavery/...'); prepend the domain.
    Full http(s) URLs pass through unchanged."""
    if path in (None, ""):
        return None
    s = str(path).strip()
    if s.lower().startswith(("http://", "https://")):
        return s
    if not base:
        return s
    return base.rstrip("/") + "/" + s.lstrip("/")


def vendor_slug(vendor_name: str) -> str:
    """Shopify handle vendor prefix. Verified 100% against 8,019 catalog rows:
    lowercase, '&' -> 'and', '.' stripped, spaces -> '-', commas and consecutive hyphens KEPT."""
    s = vendor_name.strip().lower()
    s = s.replace("&", "and")
    s = s.replace(".", "")
    s = s.replace(" ", "-")
    return s


def shopify_handle(vendor_name: Optional[str], base_item_number: Optional[str]) -> Optional[str]:
    if not vendor_name or not base_item_number:
        return None
    return f"{vendor_slug(vendor_name)}-{str(base_item_number).strip().lower()}"


# ---------------------------------------------------------------------- misc
def first_nonempty(*values):
    for v in values:
        if v not in (None, ""):
            return v
    return None
