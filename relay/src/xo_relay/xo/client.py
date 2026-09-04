"""XO Product API client.

Guarantees, in order of importance:
  1. READ-ONLY. There is no code path that issues anything but GET. The bearer token XO
     issues also authorizes POST/PUT/DELETE against Premier's product database; we never
     use it that way, whether or not XO grants the read-only scope we asked for.
  2. IPv4 only (see ipv4.py) - IPv6 egress is a silent 401.
  3. Throttled under XO's stated 20 req/s fast / 1 req/s slow ceilings.
  4. Explicit `fields` on every call; `limit` <= 500; offset pagination.
  5. 401/403 fail hard with a human-readable reason - they are not retry problems.
     400 logs the full query. 5xx retries once after a long wait, then raises.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Iterator, Mapping, Optional, Sequence

import requests

from .ipv4 import IPv4HTTPAdapter
from .models import XOProduct

log = logging.getLogger(__name__)

MAX_LIMIT = 500
XO_FAST_RPS_CEILING = 20.0
XO_SLOW_RPS_CEILING = 1.0
SLOW_RESPONSE_THRESHOLD_S = 1.0

# Filters XO documents as valid alongside getAll=1. Anything else -> 400 from XO; we
# reject it client-side so the failure is explained rather than logged as an HTTP error.
GETALL_ALLOWED_PARAMS = frozenset(
    {"getAll", "vendor", "catalogID", "fields", "limit", "offset", "includeDiscontinued", "lastMod"}
)

# Recommended response shaping (handoff §4): flat facets, structured files/images so the
# parser is never splitting URLs on colons.
DEFAULT_FLAT_FORMAT: Mapping[str, str] = {
    "StandardData": "p",
    "FileData": "n",
    "ImageData": "n",
}


class XOError(Exception):
    """Base class for XO API failures."""

    def __init__(self, message: str, *, status: Optional[int] = None, url: str = "", body: str = ""):
        super().__init__(message)
        self.status = status
        self.url = url
        self.body = body


class XOAuthError(XOError):
    """401/403 - a human problem (IPv6, token, whitelist), never retried."""


class XOBadRequest(XOError):
    """400 - invalid parameter combination; the full query is in `.url`."""


class XONotFound(XOError):
    """404 - product id does not exist; expected for stale ids, not retried."""


class XOServerError(XOError):
    """5xx after retries were exhausted."""


class ReadOnlyViolation(RuntimeError):
    """Raised if anything tries to send a non-GET to XO. Should be unreachable."""


class TokenBucket:
    """Simple token bucket. `rate` tokens/second, burst `capacity`."""

    def __init__(self, rate: float, capacity: Optional[int] = None, *, clock=time.monotonic, sleeper=time.sleep):
        if rate <= 0:
            raise ValueError("rate must be > 0")
        self.rate = float(rate)
        self.capacity = float(capacity if capacity is not None else max(1, int(rate)))
        self._tokens = self.capacity
        self._clock = clock
        self._sleep = sleeper
        self._last = clock()

    def acquire(self) -> float:
        """Block until a token is available. Returns seconds slept."""
        slept = 0.0
        while True:
            now = self._clock()
            self._tokens = min(self.capacity, self._tokens + (now - self._last) * self.rate)
            self._last = now
            if self._tokens >= 1.0:
                self._tokens -= 1.0
                return slept
            need = (1.0 - self._tokens) / self.rate
            self._sleep(need)
            slept += need


@dataclass
class RequestLog:
    url: str
    status: int
    elapsed_s: float
    rows: int


@dataclass
class XOClient:
    database_name: str
    access_token: str
    rate_limit_rps: float = 10.0
    server_error_wait_s: float = 300.0
    server_error_retries: int = 1
    timeout_s: float = 120.0
    session: Optional[requests.Session] = None
    clock: Callable[[], float] = time.monotonic
    sleeper: Callable[[float], None] = time.sleep
    history: list[RequestLog] = field(default_factory=list)

    def __post_init__(self):
        if not self.database_name:
            raise ValueError("database_name is required (XO client database name, from Client Services)")
        if not self.access_token:
            raise ValueError("access_token is required")
        if self.rate_limit_rps > XO_FAST_RPS_CEILING:
            raise ValueError(f"rate_limit_rps {self.rate_limit_rps} exceeds XO's 20 req/s ceiling")
        if self.session is None:
            self.session = requests.Session()
            self.session.mount("https://", IPv4HTTPAdapter())
            self.session.mount("http://", IPv4HTTPAdapter())
        self._bucket = TokenBucket(self.rate_limit_rps, clock=self.clock, sleeper=self.sleeper)
        self._last_slow_at: Optional[float] = None

    # ------------------------------------------------------------------ urls
    @property
    def base_url(self) -> str:
        return f"https://{self.database_name}.xologic.com"

    @property
    def product_url(self) -> str:
        return f"{self.base_url}/api/v2/product"

    @property
    def docs_url(self) -> str:
        return f"{self.base_url}/api/doc"

    # ------------------------------------------------------------------ core GET
    def _throttle(self) -> None:
        # After a slow response XO asks for <= 1 req/s. Enforce a 1s gap from the slow call.
        if self._last_slow_at is not None:
            gap = (1.0 / XO_SLOW_RPS_CEILING) - (self.clock() - self._last_slow_at)
            if gap > 0:
                self.sleeper(gap)
            self._last_slow_at = None
        self._bucket.acquire()

    def _get(self, url: str, params: Mapping[str, Any]) -> Any:
        """The only network call in this package. GET, nothing else."""
        method = "GET"
        if method != "GET":  # pragma: no cover - documents the invariant
            raise ReadOnlyViolation(method)
        headers = {"Authorization": f"Bearer {self.access_token}", "Accept": "application/json"}
        attempt = 0
        while True:
            self._throttle()
            started = self.clock()
            try:
                resp = self.session.request(method, url, params=params, headers=headers, timeout=self.timeout_s)
            except requests.RequestException as e:
                if attempt < self.server_error_retries:
                    attempt += 1
                    log.warning("XO connection error (%s); retrying in %ss", e, self.server_error_wait_s)
                    self.sleeper(self.server_error_wait_s)
                    continue
                raise XOServerError(f"connection error talking to XO: {e}", url=url) from e
            elapsed = self.clock() - started
            if elapsed >= SLOW_RESPONSE_THRESHOLD_S:
                self._last_slow_at = self.clock()
            full_url = resp.url if getattr(resp, "url", None) else url
            status = resp.status_code
            body = _safe_text(resp)

            if status == 200:
                data = resp.json()
                rows = len(data) if isinstance(data, list) else 1
                self.history.append(RequestLog(full_url, status, elapsed, rows))
                return data
            if status in (401, 403):
                self.history.append(RequestLog(full_url, status, elapsed, 0))
                raise XOAuthError(_auth_message(status, body), status=status, url=full_url, body=body)
            if status == 400:
                self.history.append(RequestLog(full_url, status, elapsed, 0))
                log.error("XO 400 Bad Request. Full query: %s  body=%s", full_url, body[:500])
                raise XOBadRequest(f"XO rejected the query (400). Full query: {full_url}", status=400, url=full_url, body=body)
            if status == 404:
                self.history.append(RequestLog(full_url, status, elapsed, 0))
                raise XONotFound(f"XO returned 404 for {full_url}", status=404, url=full_url, body=body)
            if status >= 500:
                self.history.append(RequestLog(full_url, status, elapsed, 0))
                if attempt < self.server_error_retries:
                    attempt += 1
                    log.warning("XO %s; retrying in %ss (attempt %s)", status, self.server_error_wait_s, attempt)
                    self.sleeper(self.server_error_wait_s)
                    continue
                raise XOServerError(
                    f"XO server error {status} persisted after {attempt} retry; alert a human. {full_url}",
                    status=status, url=full_url, body=body,
                )
            self.history.append(RequestLog(full_url, status, elapsed, 0))
            raise XOError(f"unexpected XO status {status} for {full_url}", status=status, url=full_url, body=body)

    # ------------------------------------------------------------------ params
    @staticmethod
    def build_params(
        *,
        fields: Sequence[str],
        limit: int = MAX_LIMIT,
        offset: int = 0,
        get_all: bool = False,
        sort: Optional[str] = None,
        last_mod: Optional[str] = None,
        vendor: Optional[str | int] = None,
        catalog_id: Optional[str | int] = None,
        include_discontinued: Optional[bool] = None,
        flat_format: Optional[Mapping[str, str] | str] = None,
        extra: Optional[Mapping[str, Any]] = None,
    ) -> dict[str, Any]:
        if not fields:
            raise ValueError("fields is required - XO performance depends on an explicit field list")
        if not (1 <= limit <= MAX_LIMIT):
            raise ValueError(f"limit must be 1..{MAX_LIMIT}")
        if offset < 0:
            raise ValueError("offset must be >= 0")
        if get_all and sort:
            raise ValueError("use either getAll=1 or sort=..., not both")
        params: dict[str, Any] = {}
        if get_all:
            params["getAll"] = 1
        elif sort:
            params["sort"] = sort
        params["fields"] = ",".join(dict.fromkeys(fields))  # dedupe, keep order
        params["limit"] = limit
        params["offset"] = offset
        if last_mod:
            params["lastMod"] = last_mod
        if vendor is not None:
            params["vendor"] = vendor
        if catalog_id is not None:
            params["catalogID"] = catalog_id
        if include_discontinued is not None:
            params["includeDiscontinued"] = 1 if include_discontinued else 0
        if extra:
            params.update(extra)
        if flat_format:
            if isinstance(flat_format, str):
                params["FlatFormat"] = flat_format
            else:
                for dtype, mode in flat_format.items():
                    params[f"FlatFormat[{dtype}]"] = mode
        if get_all:
            bad = [k for k in params if k not in GETALL_ALLOWED_PARAMS and not k.startswith("FlatFormat")]
            if bad:
                raise ValueError(
                    f"{bad} are not allowed with getAll=1 (XO returns 400). Use sort='none' for these filters."
                )
        return params

    # ------------------------------------------------------------------ public API
    def get_products_page(self, **kwargs) -> list[dict]:
        params = self.build_params(**kwargs)
        data = self._get(self.product_url, params)
        return _as_rows(data)

    def iter_products(self, *, page_size: int = MAX_LIMIT, max_pages: Optional[int] = None, **kwargs) -> Iterator[dict]:
        """Paginate with limit/offset until a short page. Yields raw dict rows."""
        offset = int(kwargs.pop("offset", 0))
        pages = 0
        while True:
            rows = self.get_products_page(limit=page_size, offset=offset, **kwargs)
            for r in rows:
                yield r
            pages += 1
            if len(rows) < page_size:
                return
            if max_pages is not None and pages >= max_pages:
                return
            offset += page_size

    def get_product(self, product_id: str, *, fields: Sequence[str], flat_format=None) -> Optional[dict]:
        """Single product by XOItemID (e.g. '19-2088'). None on 404."""
        params: dict[str, Any] = {"fields": ",".join(dict.fromkeys(fields))}
        if flat_format:
            if isinstance(flat_format, str):
                params["FlatFormat"] = flat_format
            else:
                for dtype, mode in flat_format.items():
                    params[f"FlatFormat[{dtype}]"] = mode
        try:
            data = self._get(f"{self.product_url}/{product_id}", params)
        except XONotFound:
            return None
        rows = _as_rows(data)
        return rows[0] if rows else None

    def delta(self, *, since: str, fields: Sequence[str], flat_format=DEFAULT_FLAT_FORMAT, **kwargs) -> Iterator[XOProduct]:
        """The FTP-delta replacement: sort=none&lastMod=<since>, full current records.

        `since` is an XO expression like '-7days', '-3hours', '-1week'. Always request the
        three change dates; XO does not say which one matched.
        """
        fields = list(fields)
        for must in ("AvailabilityChangedDate", "CatalogChangedDate", "PriceChangedDate"):
            if must not in fields:
                fields.append(must)
        for row in self.iter_products(sort="none", last_mod=since, fields=fields, flat_format=flat_format, **kwargs):
            yield XOProduct.from_api(row)

    def full_catalog(self, *, fields: Sequence[str], vendor=None, include_discontinued: bool = True,
                     flat_format=DEFAULT_FLAT_FORMAT, **kwargs) -> Iterator[XOProduct]:
        """Full-catalog sync via getAll=1 (MiniBeast)."""
        for row in self.iter_products(get_all=True, fields=fields, vendor=vendor,
                                      include_discontinued=include_discontinued, flat_format=flat_format, **kwargs):
            yield XOProduct.from_api(row)


# ---------------------------------------------------------------------- helpers
def _as_rows(data: Any) -> list[dict]:
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    if isinstance(data, dict):
        for key in ("data", "products", "items", "results"):
            if isinstance(data.get(key), list):
                return [r for r in data[key] if isinstance(r, dict)]
        return [data]
    raise XOError(f"unexpected JSON shape from XO: {type(data).__name__}")


def _safe_text(resp) -> str:
    try:
        return resp.text or ""
    except Exception:  # pragma: no cover
        return ""


def _auth_message(status: int, body: str) -> str:
    if status == 401:
        return (
            "XO returned 401 Not Authorized. Check, in this order: (1) the request left over IPv4 "
            "(this client pins IPv4, so if it happened the pin failed - run with curl -4 to confirm); "
            "(2) the bearer token is present and correct. Not a retry problem."
        )
    return (
        "XO returned 403 Forbidden: this egress IP is not on XO's allowlist. Human action: send the "
        "public IPv4 to clientservices@xologic.com. Not a retry problem."
    )
