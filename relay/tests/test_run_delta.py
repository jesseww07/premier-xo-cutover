import csv
import json

from xo_relay import run_delta
from xo_relay.shopify.matrixify import md5_base64, write_products_csv


def test_end_to_end_from_fixtures(tmp_path, fixtures_dir, monkeypatch):
    monkeypatch.setenv("XO_ITEM_URL_BASE", "https://shoppremier.xologic.com")
    monkeypatch.setenv("RELAY_ENV_FILE", str(tmp_path / "nonexistent.env"))
    rc = run_delta.main([
        "--source", f"fixture:{fixtures_dir / 'synthetic_delta.json'}",
        "--resolver", f"fixture:{fixtures_dir / 'synthetic_resolution.json'}",
        "--prices", f"fixture:{fixtures_dir / 'synthetic_prices.json'}",
        "--out", str(tmp_path), "--stamp", "TEST",
    ])
    assert rc == 0
    report = json.loads((tmp_path / "relay_report_TEST.json").read_text(encoding="utf-8"))
    assert report["records"] == 8
    res = report["netsuite_resolution"]
    assert res["by_custitem7"] == 1 and res["ambiguous"] == 1 and res["add"] == 1 and res["update"] == 6, res
    p1 = report["netsuite_phase1"]
    assert p1["update_rows"] == 6 and p1["add_rows"] == 1 and p1["skipped"] == 1
    upd = list(csv.DictReader(open(p1["update_file"], encoding="utf-8-sig")))
    assert {r["internalid"] for r in upd} == {"887136", "123001", "123002", "123003", "900001", "600001"}
    sh = report["shopify"]
    assert sh["errors"] == []
    assert sh["compare_at"]["sale"] >= 1 and sh["compare_at"]["cleared"] >= 1
    assert "Products" in sh["file"]
    data = open(sh["file"], "rb").read()
    assert not data.startswith(b"\xef\xbb\xbf")
    header = data.split(b"\n", 1)[0].decode()
    assert "Handle" not in header and "Title" not in header and "Variant Inventory Tracker" not in header
    assert (tmp_path / "relay_report_TEST.md").exists()


def test_products_filename_and_checksum(tmp_path):
    p = write_products_csv([{"Variant Sku": "A", "Variant Price": "1.00"}], tmp_path / "x_Products.csv")
    assert len(md5_base64(p)) == 24
    import pytest
    with pytest.raises(ValueError):
        write_products_csv([{"a": "b"}], tmp_path / "wrong.csv")


def test_load_fields_strips_comments_and_dedupes():
    fields, flat = run_delta.load_fields("delta")
    assert "AvailabilityChangedDate" in fields and "InStock" in fields and "StandardData" in fields
    assert len(fields) == len(set(fields))
    assert all("#" not in f for f in fields)
    assert flat["StandardData"] == "p" and flat["FileData"] == "n"
