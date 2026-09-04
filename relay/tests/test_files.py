import json

from xo_relay.transform import files as F
from xo_relay.xo.models import XOProduct


def test_documents_match_on_descr_not_slot(by_sku):
    p = by_sku["38259-023"]  # spec sheet is in slot 3, warranty in slot 1
    assert F.spec_sheet(p, base="https://shoppremier.xologic.com") == "https://shoppremier.xologic.com/SpecFiles/38259-023_spec.pdf"
    assert F.installation_sheet(p) == "https://amplifi.eurofase.com/files/38259-023_install.pdf"
    assert F.warranty_doc(p) == "https://www.dropbox.com/s/abc123/38259-023_warranty.pdf?dl=1"


def test_full_urls_pass_through_unchanged(by_sku):
    assert F.spec_sheet(by_sku["2343NI"], base="https://x") == "https://us1.hostedftp.com/SpecFiles/SP-2343NI.pdf"


def test_installation_keyword_variants(by_sku):
    assert F.installation_sheet(by_sku["F844-BN"], base="https://b") == "https://b/files/F844_install.pdf"
    assert F.spec_sheet(by_sku["F844-BN"]) is None


def test_primary_image_and_gallery(by_sku):
    p = by_sku["38259-023"]
    assert F.primary_image(p) == "http://shoppremier.xologic.com/vendors/3249/large/38259-023_01.jpg"
    assert len(F.gallery(p)) == 2
    assert F.primary_image(by_sku["2343NI"]) is None


def test_string_p_format_single_entry_with_https_url(by_sku):
    p = by_sku["48508-022"]
    entries = F.file_entries(p)
    assert entries == [{"FileName": "https://amplifi.eurofase.com/files/48508-022_spec.pdf", "FileDescr": "Spec Sheet"}]
    assert F.spec_sheet(p) == "https://amplifi.eurofase.com/files/48508-022_spec.pdf"
    assert F.primary_image(p) == "http://shoppremier.xologic.com/vendors/3249/large/48508-022_01.jpg"


def test_string_p_format_multiple_entries_split_on_repeated_label(fixtures_dir):
    rows = json.loads((fixtures_dir / "synthetic_delta_strings.json").read_text(encoding="utf-8"))
    p = XOProduct.from_api(rows[0])
    entries = F.file_entries(p)
    assert len(entries) == 2
    assert entries[1]["FilePath"].startswith("https://www.dropbox.com/")
    assert F.installation_sheet(p) == "https://www.dropbox.com/s/abc/38259-023_install.pdf?dl=1"


def test_k_format_indexed_keys_collect_into_gallery(fixtures_dir):
    rows = json.loads((fixtures_dir / "synthetic_delta_strings.json").read_text(encoding="utf-8"))
    p = XOProduct.from_api(rows[0])
    imgs = F.image_entries(p)
    assert [e["FileName"] for e in imgs] == ["38259-023_01.jpg", "38259-023_02.jpg"]
    assert F.gallery(p)[1].endswith("38259-023_02.jpg")


def test_bare_url_token_is_kept_whole():
    entries = F.parse_entries("https://cdn.example.com/a:b/file.pdf")
    assert entries[0]["FilePath"] == "https://cdn.example.com/a:b/file.pdf"


def test_empty_inputs():
    assert F.parse_entries(None) == [] and F.parse_entries("") == [] and F.parse_entries([]) == []
