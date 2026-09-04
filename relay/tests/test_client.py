import socket

import pytest

from xo_relay.xo.client import (
    XOClient, XOAuthError, XOBadRequest, XONotFound, XOServerError, TokenBucket, GETALL_ALLOWED_PARAMS,
)
from xo_relay.xo import ipv4


class Clock:
    def __init__(self):
        self.t = 1000.0
    def __call__(self):
        return self.t
    def sleep(self, s):
        self.t += s


def make_client(session, clock=None, **kw):
    clock = clock or Clock()
    return XOClient("premier", "tok", session=session, clock=clock, sleeper=clock.sleep, **kw), clock


# ---------------------------------------------------------------------- params
def test_build_params_getall_rejects_keyword():
    with pytest.raises(ValueError):
        XOClient.build_params(fields=["XOItemID"], get_all=True, extra={"keyword": "chandelier"})


def test_build_params_flat_format_per_type_and_dedupes_fields():
    p = XOClient.build_params(fields=["A", "B", "A"], sort="none", last_mod="-7days",
                              flat_format={"StandardData": "p", "FileData": "n"})
    assert p["fields"] == "A,B"
    assert p["sort"] == "none" and p["lastMod"] == "-7days"
    assert p["FlatFormat[StandardData]"] == "p" and p["FlatFormat[FileData]"] == "n"
    assert "getAll" not in p


def test_build_params_limit_bounds():
    with pytest.raises(ValueError):
        XOClient.build_params(fields=["A"], limit=501)
    with pytest.raises(ValueError):
        XOClient.build_params(fields=[], limit=10)


# ---------------------------------------------------------------------- pagination
def test_iter_products_paginates_until_short_page(fake_session, fake_response):
    page1 = [{"XOItemID": f"1-{i}"} for i in range(3)]
    page2 = [{"XOItemID": "1-3"}]
    sess = fake_session([fake_response(200, page1), fake_response(200, page2)])
    client, _ = make_client(sess)
    rows = list(client.iter_products(page_size=3, sort="none", fields=["XOItemID"]))
    assert [r["XOItemID"] for r in rows] == ["1-0", "1-1", "1-2", "1-3"]
    assert [c["params"]["offset"] for c in sess.calls] == [0, 3]
    assert all(c["method"] == "GET" for c in sess.calls)
    assert sess.calls[0]["headers"]["Authorization"] == "Bearer tok"
    assert sess.calls[0]["url"] == "https://premier.xologic.com/api/v2/product"


def test_delta_always_requests_three_change_dates(fake_session, fake_response):
    sess = fake_session([fake_response(200, [])])
    client, _ = make_client(sess)
    list(client.delta(since="-7days", fields=["XOItemID"]))
    fields = sess.calls[0]["params"]["fields"].split(",")
    assert {"AvailabilityChangedDate", "CatalogChangedDate", "PriceChangedDate"} <= set(fields)
    assert sess.calls[0]["params"]["sort"] == "none"
    assert sess.calls[0]["params"]["lastMod"] == "-7days"


def test_full_catalog_uses_getall(fake_session, fake_response):
    sess = fake_session([fake_response(200, [])])
    client, _ = make_client(sess)
    list(client.full_catalog(fields=["XOItemID"], vendor=3249))
    p = sess.calls[0]["params"]
    assert p["getAll"] == 1 and p["vendor"] == 3249 and p["includeDiscontinued"] == 1
    assert all(k in GETALL_ALLOWED_PARAMS or k.startswith("FlatFormat") for k in p)


# ---------------------------------------------------------------------- errors
@pytest.mark.parametrize("status", [401, 403])
def test_auth_errors_fail_hard_without_retry(fake_session, fake_response, status):
    sess = fake_session([fake_response(status, text="Not Authorized")])
    client, clock = make_client(sess)
    with pytest.raises(XOAuthError) as ei:
        client.get_products_page(fields=["XOItemID"], sort="none")
    assert len(sess.calls) == 1
    msg = str(ei.value)
    assert ("IPv4" in msg) if status == 401 else ("allowlist" in msg)


def test_400_raises_with_full_query(fake_session, fake_response, caplog):
    sess = fake_session([fake_response(400, text="fields=InvalidField")])
    client, _ = make_client(sess)
    with pytest.raises(XOBadRequest) as ei:
        client.get_products_page(fields=["InvalidField"], sort="none")
    assert "InvalidField" in ei.value.url
    assert any("Full query" in r.getMessage() for r in caplog.records)


def test_404_single_product_returns_none(fake_session, fake_response):
    sess = fake_session([fake_response(404)])
    client, _ = make_client(sess)
    assert client.get_product("19-9999", fields=["XOItemID"]) is None


def test_500_retries_once_after_long_wait_then_raises(fake_session, fake_response):
    sess = fake_session([fake_response(500), fake_response(500)])
    client, clock = make_client(sess, server_error_wait_s=300, server_error_retries=1)
    t0 = clock.t
    with pytest.raises(XOServerError):
        client.get_products_page(fields=["XOItemID"], sort="none")
    assert len(sess.calls) == 2
    assert clock.t - t0 >= 300


def test_500_then_200_succeeds(fake_session, fake_response):
    sess = fake_session([fake_response(500), fake_response(200, [{"XOItemID": "1-1"}])])
    client, _ = make_client(sess)
    assert client.get_products_page(fields=["XOItemID"], sort="none") == [{"XOItemID": "1-1"}]


# ---------------------------------------------------------------------- throttle
def test_token_bucket_spaces_requests():
    clock = Clock()
    b = TokenBucket(rate=2.0, capacity=1, clock=clock, sleeper=clock.sleep)
    t0 = clock.t
    for _ in range(5):
        b.acquire()
    # 4 waits of 0.5s
    assert clock.t - t0 == pytest.approx(2.0, abs=0.01)


def test_rate_above_xo_ceiling_rejected(fake_session):
    with pytest.raises(ValueError):
        XOClient("premier", "tok", session=fake_session([]), rate_limit_rps=25)


def test_slow_response_forces_one_second_gap(fake_session, fake_response):
    clock = Clock()

    def slow(method, url, params):
        clock.t += 2.0  # the response took 2s
        return fake_response(200, [])

    sess = fake_session([slow, fake_response(200, [])])
    client, _ = make_client(sess, clock=clock, rate_limit_rps=20)
    client.get_products_page(fields=["A"], sort="none")
    t_after_slow = clock.t
    client.get_products_page(fields=["A"], sort="none")
    assert clock.t - t_after_slow >= 1.0


# ---------------------------------------------------------------------- ipv4 pin
def test_create_ipv4_connection_requests_af_inet_only():
    seen = {}

    def gai(host, port, family, socktype):
        seen["family"] = family
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("203.0.113.5", port))]

    class Sock:
        def __init__(self, af, st, proto):
            seen["af"] = af
        def setsockopt(self, *a): pass
        def settimeout(self, t): seen["timeout"] = t
        def bind(self, a): pass
        def connect(self, sa): seen["sa"] = sa
        def close(self): pass

    s = ipv4.create_ipv4_connection(("premier.xologic.com", 443), 30, _getaddrinfo=gai, _socket_factory=Sock)
    assert seen["family"] == socket.AF_INET and seen["af"] == socket.AF_INET
    assert seen["sa"] == ("203.0.113.5", 443) and seen["timeout"] == 30


def test_create_ipv4_connection_skips_ipv6_results():
    def gai(host, port, family, socktype):
        return [(socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("2001:db8::1", port, 0, 0))]

    with pytest.raises(OSError):
        ipv4.create_ipv4_connection(("h", 443), _getaddrinfo=gai, _socket_factory=lambda *a: None)


def test_default_session_mounts_ipv4_adapter():
    client = XOClient("premier", "tok")
    adapter = client.session.get_adapter("https://premier.xologic.com/")
    assert isinstance(adapter, ipv4.IPv4HTTPAdapter)
    assert adapter.poolmanager.pool_classes_by_scheme["https"] is ipv4.IPv4HTTPSConnectionPool
