import pytest

from xo_relay.transform.netsuite_map import build_row, rest_body


def test_update_row_headers_are_script_ids_and_lead_with_internalid(by_sku, mapping):
    row = build_row(by_sku["38259-023"], mapping, op="update", internal_id="887136")
    keys = list(row)
    assert keys[0] == "internalid" and row["internalid"] == "887136"
    assert "itemid" not in row and "subsidiary" not in row and "vendor" not in row
    assert "externalid" not in {k.lower() for k in keys}
    assert "displayname" not in row and "upccode" not in row


def test_custitem7_sources_from_itemid_not_xoitemid(by_sku, mapping):
    row = build_row(by_sku["38259-023"], mapping, op="update", internal_id="1")
    assert row["custitem7"] == "3372700111"


def test_pricing_columns(by_sku, mapping):
    row = build_row(by_sku["38259-023"], mapping, op="update", internal_id="1")
    assert row["price"] == "4950.00"            # MSRP -> Base Price (level 1 "MSRP")
    assert row["cost"] == "2475.00"             # ItemCost with thousands separator stripped
    assert row["custitem5"] == "4950.00"        # IMAP
    assert row["custitem_xo_umap"] == ""
    assert row["custitem_xo_vendor_disc_cost"] == "2350.00"


def test_availability_and_dates(by_sku, mapping):
    row = build_row(by_sku["2343NI"], mapping, op="update", internal_id="1")
    assert row["custitem_xo_in_stock"] == "-1"  # the -1 case round-trips
    assert row["custitem_xo_availability_changed"] == "09/03/2026"
    assert row["custitem_xo_last_changed"] == "09/03/2026"
    row2 = build_row(by_sku["NEW-SKU-001"], mapping, op="add")
    assert row2["custitem_xo_backorder_date"] == "10/15/2026"


def test_naming_inversion_lands_on_the_right_fields(by_sku, mapping):
    row = build_row(by_sku["38259-023"], mapping, op="update", internal_id="1")
    assert row["custitem_la_safety_listing"] == "ETL Approved"   # label "Safety Rating"
    assert row["custitem_la_safety_rating"] == "Dry Rated"       # label "Location Rating"


def test_units_stripped_and_case_variants_coalesced(by_sku, mapping):
    row = build_row(by_sku["38259-023"], mapping, op="update", internal_id="1")
    assert row["custitem_la_max_wattage"] == "60"
    assert row["custitem_la_voltage"] == "120"
    assert row["custitem_la_color_temperature"] == "3000"
    assert row["custitem_la_light_output"] == "4800"
    assert row["custitem_la_width"] == "36"
    k = build_row(by_sku["2343NI"], mapping, op="update", internal_id="1")
    assert k["custitem_la_number_of_bulbs"] == "3"
    assert k["custitem_la_width"] == "20"


def test_urls_files_and_gtin(by_sku, mapping):
    row = build_row(by_sku["38259-023"], mapping, op="update", internal_id="1")
    assert row["custitem_la_product_url"] == "https://shoppremier.xologic.com/brand-eurofase/ferro-16-light-chandelier-38259-023"
    assert row["custitem_spec_sheet_link"] == "https://shoppremier.xologic.com/SpecFiles/38259-023_spec.pdf"
    assert row["custitem_la_image"].endswith("38259-023_01.jpg")
    assert row["custitem_la_upc"] == "00773546304351"
    assert build_row(by_sku["48508-022"], mapping, op="update", internal_id="1")["custitem_la_upc"] == "00773546397247"


def test_add_row_has_constants_handle_and_vendor(by_sku, mapping):
    row = build_row(by_sku["38259-023"], mapping, op="add")
    assert list(row)[0] == "itemid" and row["itemid"] == "38259-023"
    assert row["custitem_fa_shopify_handle"] == "eurofase-38259"
    assert row["manufacturer"] == "Eurofase" and row["vendor"] == "EUROFASE"
    assert row["subsidiary"] == "Premier Lighting, LLC"
    assert row["custitem_fa_shopify_flag"] == "Ignore"
    assert row["incomeaccount"] == "40000 Sales Revenue"
    assert "internalid" not in row


def test_add_row_unmapped_vendor_is_blank(by_sku, mapping):
    row = build_row(by_sku["NEW-SKU-001"], mapping, op="add")
    assert row["vendor"] == "" and row["manufacturer"] == "Crystorama Lighting Group, Inc."
    assert row["custitem_fa_shopify_handle"] == "crystorama-lighting-group,-inc-new-sku"


def test_groups_subset(by_sku, mapping):
    row = build_row(by_sku["38259-023"], mapping, op="update", internal_id="1", groups={"pricing"})
    assert set(row) >= {"internalid", "custitem7", "price", "cost", "custitem_xo_price_changed"}
    assert "custitem_la_bulb_type" not in row


def test_update_requires_internal_id(by_sku, mapping):
    with pytest.raises(ValueError):
        build_row(by_sku["38259-023"], mapping, op="update")


def test_rest_body_types_and_skips_csv_only(by_sku, mapping):
    row = build_row(by_sku["38259-023"], mapping, op="update", internal_id="887136")
    body = rest_body(row, mapping)
    assert "id" not in body and "internalid" not in body and "price" not in body   # rest:false
    assert body["cost"] == 2475.0 and body["custitem_xo_in_stock"] == 12
    assert body["custitem_xo_availability_changed"] == "2026-09-02"
    assert body["custitem7"] == 3372700111
    assert "externalid" not in body


def test_mapping_has_no_externalid_and_unverified_are_flagged(mapping):
    assert all("external" not in (c.ns_field or "").lower() for c in mapping.columns)
    assert {c.header for c in mapping.unverified_sources()} >= {"custitem_xo_umap", "custitem_la_product_url"}
