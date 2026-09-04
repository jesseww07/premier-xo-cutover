from decimal import Decimal

import pytest

from xo_relay.transform import normalize as N
from xo_relay.xo.models import XOProduct


@pytest.mark.parametrize("raw,expected", [
    ("60 W", "60"), ("60w", "60"), ("120 V", "120"), ('42"', "42"), ("12°", "12"),
    ("3,290.33 CFM", "3290.33"), ("5,235 CFM", "5235"), ("4800 lm", "4800"), ("22.5\"", "22.5"),
    ("3000K", "3000"), ("", None), (None, None), ("  16 ", "16"), (16, "16"),
])
def test_strip_units(raw, expected):
    assert N.strip_units(raw) == expected


def test_strip_units_non_numeric_passthrough_unless_strict():
    assert N.strip_units("Integrated") == "Integrated"
    assert N.strip_units("Integrated", strict=True) is None


def test_money2():
    assert N.money2("3,276") == "3276.00"
    assert N.money2(Decimal("4950")) == "4950.00"
    assert N.money2("") is None


# ---------------------------------------------------------------------- coalesce / aliases
def test_number_of_bulbs_case_variants_coalesce():
    assert N.alias(XOProduct.from_api({"ExtraData-Number Of Bulbs": "3"}), "number_of_bulbs") == "3"
    assert N.alias(XOProduct.from_api({"Extra-Number of Bulbs": "5"}), "number_of_bulbs") == "5"


def test_downrod_three_schemes_coalesce():
    assert N.alias(XOProduct.from_api({"ExtraData-Downrod 1 Length": "6"}), "downrod_length_1") == "6"
    assert N.alias(XOProduct.from_api({"Extra-Downrod Length 1": "4"}), "downrod_length_1") == "4"
    assert N.alias(XOProduct.from_api({"Extra-Down Rod Included": "Yes"}), "downrod_included") == "Yes"


def test_headline_cfm_beats_slice(by_sku):
    p = by_sku["F844-BN"]
    assert N.alias(p, "cfm_headline") == "5,235 CFM"
    assert N.alias(p, "cfm_low") == "1600"


def test_blade_sweep_is_span(by_sku):
    assert N.alias(by_sku["F844-BN"], "blade_span") == "52"


def test_reversible_blades_never_coalesced_with_reverse(by_sku):
    p = by_sku["F844-BN"]
    assert N.alias(p, "reverse_capable") == "No"
    assert N.alias(p, "reversible_blades") == "Yes"
    for a, b in N.NEVER_COALESCE:
        assert not set(N.ALIASES[a]) & set(N.ALIASES[b])


def test_chain_included_holds_lengths():
    p = XOProduct.from_api({"Extra-Chain Included": "72"})
    assert N.alias(p, "chain_length") == "72"


def test_safety_location_inversion_sources(by_sku):
    p = by_sku["38259-023"]
    assert N.alias(p, "safety_rating") == "ETL Approved"      # -> custitem_la_safety_listing
    assert N.alias(p, "location_rating") == "Dry Rated"       # -> custitem_la_safety_rating
    k = by_sku["2343NI"]
    assert N.alias(k, "location_rating") == "Damp"            # falls back to the Standard facet


# ---------------------------------------------------------------------- fans
def test_fan_watts_derived_from_cfm_per_watt():
    assert N.fan_watts("5,235 CFM", "75.2") == Decimal("69.6")
    assert N.fan_watts(None, "75.2") is None
    assert N.fan_watts("100", "0") is None


# ---------------------------------------------------------------------- identifiers / urls
def test_gtin_store_and_compare():
    assert N.gtin_store("00773546304351") == "00773546304351"
    assert N.gtin_store("773546397247") == "00773546397247"
    assert N.gtin_compare_key("00773546304351") == "773546304351"


def test_led_from_flag():
    assert N.led_from_flag("Yes") == "LED" and N.led_from_flag("No") is None


def test_absolutize_url():
    assert N.absolutize_url("/brand-minka-lavery/x", "https://shoppremier.xologic.com") == "https://shoppremier.xologic.com/brand-minka-lavery/x"
    assert N.absolutize_url("https://cdn.example/x.jpg", "https://base") == "https://cdn.example/x.jpg"
    assert N.absolutize_url("/x", "") == "/x"
    assert N.absolutize_url("", "https://b") is None


@pytest.mark.parametrize("vendor,slug", [
    ("Hubbardton Forge", "hubbardton-forge"),
    ("Crystorama Lighting Group, Inc.", "crystorama-lighting-group,-inc"),
    ("Kichler & Co.", "kichler-and-co"),
    ("Minka-Aire", "minka-aire"),
    ("Modern Forms US - Fans Only", "modern-forms-us---fans-only"),
])
def test_vendor_slug_rule(vendor, slug):
    assert N.vendor_slug(vendor) == slug


def test_shopify_handle():
    assert N.shopify_handle("Eurofase", "38259") == "eurofase-38259"
    assert N.shopify_handle("Eurofase", None) is None
