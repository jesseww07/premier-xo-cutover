from datetime import datetime, timezone
from decimal import Decimal

import pytest

from xo_relay.xo.models import XOProduct, Availability, parse_decimal, parse_bool, parse_utc, canon_key


@pytest.mark.parametrize("raw,expected", [
    (12, Availability.IN_STOCK),
    (-1, Availability.IN_STOCK_QTY_UNKNOWN),
    (-7, Availability.IN_STOCK_QTY_UNKNOWN),   # any negative, magnitude meaningless
    (0, Availability.OUT_OF_STOCK),
    (None, Availability.UNKNOWN),
    ("", Availability.UNKNOWN),
    ("-1", Availability.IN_STOCK_QTY_UNKNOWN),
])
def test_in_stock_semantics(raw, expected):
    p = XOProduct.from_api({"InStock": raw})
    assert p.availability is expected


def test_in_stock_minus_one_round_trips():
    assert XOProduct.from_api({"InStock": -1}).in_stock == -1


@pytest.mark.parametrize("raw,expected", [(0, False), (1, True), ("0", False), ("1", True), ("true", True), (None, None), ("", None)])
def test_discontinued_parsing(raw, expected):
    assert XOProduct.from_api({"Discontinued": raw}).discontinued is expected


def test_discontinued_and_stock_are_independent(by_sku):
    p = by_sku["F844-BN"]
    assert p.discontinued is True and p.in_stock == 45


def test_decimal_parsing_strips_thousands():
    assert parse_decimal("3,276.00") == Decimal("3276.00")
    assert parse_decimal("$1,234.5") == Decimal("1234.5")
    assert parse_decimal("") is None and parse_decimal(None) is None
    assert XOProduct.from_api({"WebPrice": "4,950.00"}).web_price == Decimal("4950.00")


def test_item_id_and_xo_item_id(by_sku):
    p = by_sku["38259-023"]
    assert p.item_id == 3372700111
    assert p.xo_item_id == "3249-27913"
    assert XOProduct.from_api({"VendorID": 10, "VItemID": 93}).xo_item_id == "10-93"  # clean over the API


def test_gtin_keeps_leading_zeros_and_pads_short():
    assert XOProduct.from_api({"GTIN": "00773546304351"}).gtin == "00773546304351"
    assert XOProduct.from_api({"GTIN": "773546397247"}).gtin == "00773546397247"


def test_change_dates_and_last_changed(by_sku):
    p = by_sku["38259-023"]
    assert p.availability_changed == datetime(2026, 9, 2, 15, 30, tzinfo=timezone.utc)
    assert p.last_changed == p.availability_changed  # max of the three
    start = datetime(2026, 8, 28, tzinfo=timezone.utc)
    end = datetime(2026, 9, 4, tzinfo=timezone.utc)
    assert p.change_dates_within(start, end)


def test_canonical_lookup_is_case_space_and_prefix_insensitive():
    p = XOProduct.from_api({"StandardData-Location Rating": "Damp", "ExtraData-Bulb Wattage": "60 W", "Item URL": "/x"})
    assert p.get("Standard-Location Rating") == "Damp"
    assert p.standard("Location Rating") == "Damp"
    assert p.extra("Bulb Wattage") == "60 W"
    assert p.get("ItemURL") == "/x" and p.get("ItemUrl") == "/x"
    assert canon_key("StandardData-Finish") == canon_key("Standard-Finish")


def test_standard_values_split_on_pipe():
    p = XOProduct.from_api({"StandardData-Style": "Transitional|Modern"})
    assert p.standard_values("Style") == ["Transitional", "Modern"]


def test_blank_strings_read_as_missing():
    p = XOProduct.from_api({"BackOrderDate": "", "IMAP": " "})
    assert p.back_order_date is None and p.imap is None


def test_parse_utc_variants():
    assert parse_utc("2026-09-02T15:30:00Z").tzinfo is not None
    assert parse_utc("2026-09-02").year == 2026
    with pytest.raises(ValueError):
        parse_utc("not a date")
