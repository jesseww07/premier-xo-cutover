import csv

import pytest

from xo_relay.netsuite.query import Resolution
from xo_relay.netsuite.write import emit_phase1, RestWriter


def _resolutions(by_sku):
    return [
        Resolution(product=by_sku["38259-023"], internal_id="887136", matched_by="custitem7"),
        Resolution(product=by_sku["2343NI"], internal_id="123001", matched_by="itemid"),
        Resolution(product=by_sku["NEW-SKU-001"], is_net_new=True),
        Resolution(product=by_sku["AMBIG-1"], candidates=[{"id": "1"}, {"id": "2"}], note="ambiguous"),
    ]


def test_phase1_emits_update_add_and_skipped(tmp_path, by_sku, mapping):
    res = emit_phase1(_resolutions(by_sku), mapping, tmp_path, stamp="T")
    assert res.update_rows == 2 and res.add_rows == 1 and len(res.skipped) == 1
    upd = list(csv.DictReader(res.update_path.open(encoding="utf-8-sig")))
    assert upd[0]["internalid"] == "887136" and upd[1]["internalid"] == "123001"
    assert list(upd[0].keys())[0] == "internalid"
    add = list(csv.DictReader(res.add_path.open(encoding="utf-8-sig")))
    assert add[0]["itemid"] == "NEW-SKU-001" and add[0]["subsidiary"] == "Premier Lighting, LLC"
    assert (tmp_path / "xo_netsuite_SKIPPED_T.json").exists()
    assert res.update_path.read_bytes().startswith(b"\xef\xbb\xbf")   # utf-8-sig like the existing files
    assert res.unmapped_vendors == ["Crystorama Lighting Group, Inc."]


def test_phase1_no_externalid_anywhere(tmp_path, by_sku, mapping):
    res = emit_phase1(_resolutions(by_sku), mapping, tmp_path, stamp="T")
    for path in (res.update_path, res.add_path):
        head = path.open(encoding="utf-8-sig").readline().lower()
        assert "externalid" not in head


class _Auth:
    def __init__(self, account):
        self.account = account
    @property
    def account_slug(self):
        return self.account.lower().replace("_", "-")
    @property
    def rest_base(self):
        return f"https://{self.account_slug}.suitetalk.api.netsuite.com/services/rest"
    def headers(self):
        return {"Authorization": "Bearer x"}


def test_rest_writer_refuses_prod_without_flag(mapping):
    with pytest.raises(RuntimeError):
        RestWriter(_Auth("7513000"), mapping, dry_run=False, allow_prod=False)
    RestWriter(_Auth("7513000"), mapping, dry_run=True)            # dry-run always fine
    RestWriter(_Auth("7513000-SB1"), mapping, dry_run=False)       # sandbox fine


def test_rest_writer_dry_run_bodies(by_sku, mapping):
    w = RestWriter(_Auth("7513000-SB1"), mapping, dry_run=True)
    out = w.write_all(_resolutions(by_sku), allow_creates=True)
    ops = [o.op for o in out]
    assert ops == ["PATCH", "PATCH", "POST", "SKIP"]
    assert out[0].body["custitem7"] == 3372700111 and "externalid" not in out[0].body
    assert out[2].body["itemid"] == "NEW-SKU-001"
    assert w.record_url.endswith("/record/v1/inventoryitem")
