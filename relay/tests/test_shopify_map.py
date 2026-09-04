from decimal import Decimal

import pytest

from xo_relay.transform.shopify_map import (
    ShopifyMapConfig, build_delta_rows, apply_compare_at, compare_at_value, shopify_inventory_qty, validate_rows,
)


@pytest.fixture
def scfg(mapping):
    return ShopifyMapConfig.from_mapping(mapping.shopify)


def test_forbidden_columns_rejected():
    with pytest.raises(ValueError):
        ShopifyMapConfig.from_mapping({"columns": {"sku": "Handle"}})


@pytest.mark.parametrize("raw,expected", [(12, "12"), (0, "0"), (-1, "0"), (-7, "0"), (None, "")])
def test_quantity_policy(raw, expected):
    assert shopify_inventory_qty(raw) == expected


def test_build_rows_contract(products, scfg):
    rows, stats = build_delta_rows(products, scfg)
    r = {x["Variant Sku"]: x for x in rows}
    assert set(rows[0].keys()) == {"Vendor", "Variant Sku", "Variant Inventory Qty", "Variant Cost", "Variant Price", "Command",
                                   scfg.columns["discontinued"], scfg.columns["backorder_date"]}
    assert all(x["Command"] == "UPDATE" for x in rows)
    assert r["38259-023"]["Variant Price"] == "4950.00" and r["38259-023"]["Variant Cost"] == "2475.00"   # commas stripped
    assert r["2343NI"]["Variant Inventory Qty"] == "0"          # -1 -> 0
    assert r["AMBIG-1"]["Variant Inventory Qty"] == ""          # -7 -> 0, then Justice Design guard blanks it
    assert r["HF-134501-SKT-07"]["Variant Inventory Qty"] == ""  # built-to-order guard (had 0)
    assert r["HF-134501-SKT-07"]["Variant Price"] == "2100.00"   # everything else intact
    assert r["48508-022"]["Variant Inventory Qty"] == ""         # blank stays blank
    assert r["F844-BN"][scfg.columns["discontinued"]] == "1" and r["F844-BN"]["Variant Inventory Qty"] == "45"
    assert r["NEW-SKU-001"][scfg.columns["backorder_date"]] == "2026-10-15"
    assert stats["negatives_normalized"] == 2 and stats["negative_values"] == {"-1": 1, "-7": 1}
    assert stats["built_to_order_blanked"] == {"Hubbardton Forge": 1, "Justice Design Group": 1}
    assert stats["discontinued"]["1"] == 2


D = Decimal


@pytest.mark.parametrize("new,old,existing,cell,outcome", [
    (D("90"), D("100"), None, "100.00", "sale"),               # drop -> old price becomes compare-at
    (D("80"), D("90"), D("100"), "100.00", "sale"),            # repeated drop keeps the ORIGINAL highest
    (D("110"), D("100"), D("120"), "", "cleared"),             # increase clears
    (D("100"), D("100"), D("120"), "120.00", "preserved"),     # unchanged keeps existing
    (D("100"), D("100"), None, "", "unchanged"),
    (D("100"), D("100"), D("90"), "", "unchanged"),            # existing <= price is junk -> blank
    (None, D("100"), D("120"), "120.00", "no_price"),          # inventory-only row rewrites existing (empty would CLEAR)
    (D("50"), None, None, "", "not_found"),
])
def test_compare_at_rules(new, old, existing, cell, outcome):
    assert compare_at_value(new, old, existing) == (cell, outcome)


def test_apply_compare_at_fills_every_row_and_flags(products, scfg):
    rows, _ = build_delta_rows(products, scfg)
    store = {
        "38259-023": (D("5200.00"), None),        # drop 4.8% -> sale, compare-at 5200
        "2343NI": (D("279.99"), D("349.00")),     # increase to 299.99 -> cleared
        "HF-134501-SKT-07": (D("2100.00"), D("2400.00")),  # unchanged -> preserved 2400
        "F844-BN": (D("419.95"), D("419.95")),    # existing <= price -> blank
        "AMBIG-1": (D("500.00"), None),           # 500 -> 99 = 80% drop -> suspicious
    }
    calls = []

    def lookup(skus):
        calls.append(list(skus))
        return {s: store[s] for s in skus if s in store}

    stats = apply_compare_at(rows, scfg, lookup, batch_size=3)
    r = {x["Variant Sku"]: x for x in rows}
    assert all(scfg.columns["compare_at"] in x for x in rows)
    assert r["38259-023"]["Variant Compare At Price"] == "5200.00"
    assert r["2343NI"]["Variant Compare At Price"] == ""
    assert r["HF-134501-SKT-07"]["Variant Compare At Price"] == "2400.00"
    assert r["F844-BN"]["Variant Compare At Price"] == ""
    assert stats["sale"] == 2 and stats["cleared"] == 1 and stats["preserved"] == 1
    assert stats["skus_not_in_shopify"] == ["48508-022", "NEW-SKU-001", "OLD-INACTIVE"]
    assert stats["lookup_calls"] == 3 and len(calls) == 3
    assert [d["sku"] for d in stats["suspicious_drops"]] == ["AMBIG-1"]


def test_validate_passes_clean_file(products, scfg):
    rows, _ = build_delta_rows(products, scfg)
    stats = apply_compare_at(rows, scfg, lambda skus: {s: (D("9999"), None) for s in skus})
    errors, warnings = validate_rows(rows, scfg, compare_at_stats=stats)
    assert errors == []


def test_validate_catches_negatives_commas_and_forbidden(products, scfg):
    rows, _ = build_delta_rows(products, scfg)
    apply_compare_at(rows, scfg, lambda skus: {})
    rows[0]["Variant Inventory Qty"] = "-1"
    rows[1]["Variant Price"] = "3,276.00"
    rows[0]["Handle"] = "x"
    rows[3]["Variant Compare At Price"] = "1.00"
    errors, _ = validate_rows(rows, scfg)
    joined = " | ".join(errors)
    assert "negative quantity" in joined and "thousands separator" in joined
    assert "forbidden column present: handle" in joined and "compare-at <= price" in joined


def test_validate_missing_compare_at_column_is_an_error(products, scfg):
    rows, _ = build_delta_rows(products, scfg)
    errors, _ = validate_rows(rows, scfg)
    assert any("compare-at column missing" in e for e in errors)


def test_validate_warns_on_mass_clear(products, scfg):
    rows, _ = build_delta_rows(products, scfg)
    stats = apply_compare_at(rows, scfg, lambda skus: {s: (D("1.00"), None) for s in skus})  # every price "increased"
    _, warnings = validate_rows(rows, scfg, compare_at_stats=stats)
    assert any("systematic price inflation" in w for w in warnings)
