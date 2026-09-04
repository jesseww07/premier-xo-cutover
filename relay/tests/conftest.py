import json
from pathlib import Path

import pytest

from xo_relay.xo.models import XOProduct
from xo_relay.transform.netsuite_map import MappingConfig, DEFAULT_MAPPING_PATH

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir() -> Path:
    return FIX


@pytest.fixture
def delta_rows() -> list[dict]:
    return json.loads((FIX / "synthetic_delta.json").read_text(encoding="utf-8"))


@pytest.fixture
def products(delta_rows) -> list[XOProduct]:
    return [XOProduct.from_api(r) for r in delta_rows]


@pytest.fixture
def by_sku(products) -> dict[str, XOProduct]:
    return {p.item_number: p for p in products}


@pytest.fixture
def mapping() -> MappingConfig:
    cfg = MappingConfig.load(DEFAULT_MAPPING_PATH)
    cfg.item_url_base = "https://shoppremier.xologic.com"
    return cfg


class FakeResponse:
    def __init__(self, status: int, payload=None, text: str = "", url: str = "", headers=None):
        self.status_code = status
        self._payload = payload
        self.text = text or (json.dumps(payload) if payload is not None else "")
        self.url = url
        self.headers = headers or {}

    def json(self):
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


class FakeSession:
    """Scripted requests.Session stand-in. `script` is a list of FakeResponse (or callables)."""

    def __init__(self, script):
        self.script = list(script)
        self.calls: list[dict] = []

    def request(self, method, url, params=None, headers=None, timeout=None, **kw):
        self.calls.append({"method": method, "url": url, "params": dict(params or {}), "headers": dict(headers or {})})
        if not self.script:
            raise AssertionError("FakeSession script exhausted")
        nxt = self.script.pop(0)
        resp = nxt(method, url, params) if callable(nxt) else nxt
        if not resp.url:
            from urllib.parse import urlencode
            resp.url = url + ("?" + urlencode(params, doseq=True) if params else "")
        return resp

    def post(self, url, **kw):
        self.calls.append({"method": "POST", "url": url, **kw})
        nxt = self.script.pop(0)
        return nxt(url, kw) if callable(nxt) else nxt

    def patch(self, url, **kw):
        self.calls.append({"method": "PATCH", "url": url, **kw})
        nxt = self.script.pop(0)
        return nxt(url, kw) if callable(nxt) else nxt


@pytest.fixture
def fake_response():
    return FakeResponse


@pytest.fixture
def fake_session():
    return FakeSession
