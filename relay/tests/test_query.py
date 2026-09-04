from xo_relay.netsuite.query import Resolver, chunks, q_by_itemid, q_by_xo_item_id, sql_str, summarize, norm_key
from xo_relay.xo.models import XOProduct


def test_chunks_cap_at_1000():
    vals = [str(i) for i in range(2500)]
    sizes = [len(c) for c in chunks(vals)]
    assert sizes == [1000, 1000, 500]


def test_sql_quoting():
    assert sql_str("O'Brien") == "'O''Brien'"
    assert "UPPER(itemid) IN ('A', 'B')" in q_by_itemid(["A", "B"])
    assert "custitem7 IN ('1', '2')" in q_by_xo_item_id(["1", "2"])
    assert "ROWNUM" not in q_by_itemid(["A"])


def fake_runner(sql: str):
    if "custitem7 IN" in sql:
        return [{"id": "887136", "itemid": "38259-023", "xo_item_id": "3372700111", "isinactive": "F"}]
    return [
        {"id": "123001", "itemid": "2343NI", "xo_item_id": None, "isinactive": "F"},
        {"id": "500001", "itemid": "AMBIG-1", "xo_item_id": None, "isinactive": "F"},
        {"id": "500002", "itemid": "ambig-1", "xo_item_id": None, "isinactive": "F"},
        {"id": "600001", "itemid": "OLD-INACTIVE", "xo_item_id": None, "isinactive": "T"},
    ]


def test_resolver_prefers_custitem7_then_itemid_then_net_new(products):
    res = Resolver(fake_runner).resolve(products)
    by = {r.product.item_number: r for r in res}
    assert by["38259-023"].internal_id == "887136" and by["38259-023"].matched_by == "custitem7"
    assert by["2343NI"].internal_id == "123001" and by["2343NI"].matched_by == "itemid"
    assert by["NEW-SKU-001"].is_net_new and by["NEW-SKU-001"].internal_id is None
    assert by["AMBIG-1"].ambiguous and by["AMBIG-1"].internal_id is None
    assert by["OLD-INACTIVE"].internal_id == "600001" and "INACTIVE" in by["OLD-INACTIVE"].note
    s = summarize(res)
    assert s["ambiguous"] == 1 and s["by_custitem7"] == 1 and s["inactive_match"] == 1
    # matched: 38259-023, 2343NI, OLD-INACTIVE; ambiguous: AMBIG-1; net-new: the other 4
    assert s["update"] == 3 and s["add"] == 4


def test_resolver_batches_queries(monkeypatch):
    calls = []

    def runner(sql):
        calls.append(sql)
        return []

    prods = [XOProduct.from_api({"ItemID": i, "ItemNumber": f"SKU{i}"}) for i in range(1500)]
    Resolver(runner).resolve(prods)
    xo_calls = [c for c in calls if "custitem7 IN" in c]
    sku_calls = [c for c in calls if "UPPER(itemid) IN" in c]
    assert len(xo_calls) == 2 and len(sku_calls) == 2
    assert all(c.count("'") / 2 <= 1000 for c in calls)


def test_norm_key():
    assert norm_key(" abc ") == "ABC" and norm_key(None) == ""
