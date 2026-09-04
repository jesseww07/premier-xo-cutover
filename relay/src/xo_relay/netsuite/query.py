"""SuiteQL internal-ID resolution.

Match key = NetSuite internal id, resolved at the start of each run:
  1. by custitem7 (XO Item ID == XO ItemID) - the durable join once populated
  2. by itemid (Item Name/Number == XO ItemNumber), normalized strip/upper
Anything unresolved is a CREATE candidate, but only after a dedupe check across the WHOLE
item table (451,973 items have no external id and were never given a Shopify handle - blind
creates would duplicate them).

SuiteQL facts that save time (handoff §8): Oracle syntax; IN-lists cap at 1,000; no ROWNUM
on aggregates; GROUP BY on some columns errors -> SUM(CASE ...). REST SuiteQL pages at 1,000.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Mapping, Optional, Sequence

import requests

from ..xo.models import XOProduct

log = logging.getLogger(__name__)

IN_LIST_CAP = 1000
PAGE_SIZE = 1000

SHOPIFY_HANDLE_FIELD = "custitem_fa_shopify_handle"   # internalid 8117
XO_ITEM_ID_FIELD = "custitem7"


def norm_key(v: Any) -> str:
    return "" if v is None else str(v).strip().upper()


def sql_str(v: str) -> str:
    return "'" + str(v).replace("'", "''") + "'"


def chunks(seq: Sequence[Any], n: int = IN_LIST_CAP) -> Iterable[Sequence[Any]]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


Runner = Callable[[str], list[dict[str, Any]]]


@dataclass
class SuiteQL:
    """Thin SuiteQL runner over SuiteTalk REST with offset pagination."""
    auth: Any                           # NetSuiteOAuth (needs .rest_base and .headers())
    session: requests.Session = field(default_factory=requests.Session)
    page_size: int = PAGE_SIZE

    def run(self, sql: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            resp = self.session.post(
                f"{self.auth.rest_base}/query/v1/suiteql",
                params={"limit": self.page_size, "offset": offset},
                headers={**self.auth.headers(), "Prefer": "transient"},
                json={"q": sql},
                timeout=120,
            )
            if resp.status_code != 200:
                raise RuntimeError(f"SuiteQL failed {resp.status_code}: {resp.text[:500]}\nSQL: {sql[:500]}")
            body = resp.json()
            rows.extend(body.get("items", []))
            if not body.get("hasMore"):
                return rows
            offset += self.page_size


# ---------------------------------------------------------------------- queries
def q_shopify_live_items() -> str:
    return (
        f"SELECT id, itemid, {XO_ITEM_ID_FIELD} AS xo_item_id, {SHOPIFY_HANDLE_FIELD} AS handle, externalid "
        f"FROM item WHERE isinactive = 'F' AND {SHOPIFY_HANDLE_FIELD} IS NOT NULL"
    )


def q_by_itemid(values: Sequence[str]) -> str:
    lst = ", ".join(sql_str(v) for v in values)
    return f"SELECT id, itemid, {XO_ITEM_ID_FIELD} AS xo_item_id, isinactive, itemtype FROM item WHERE UPPER(itemid) IN ({lst})"


def q_by_xo_item_id(values: Sequence[str]) -> str:
    lst = ", ".join(sql_str(v) for v in values)
    return f"SELECT id, itemid, {XO_ITEM_ID_FIELD} AS xo_item_id, isinactive, itemtype FROM item WHERE {XO_ITEM_ID_FIELD} IN ({lst})"


# ---------------------------------------------------------------------- resolution
@dataclass
class Resolution:
    product: XOProduct
    internal_id: Optional[str] = None
    matched_by: Optional[str] = None            # 'custitem7' | 'itemid' | None
    candidates: list[dict[str, Any]] = field(default_factory=list)  # >1 => ambiguous, do not write
    is_net_new: bool = False
    note: str = ""

    @property
    def ambiguous(self) -> bool:
        return len(self.candidates) > 1


@dataclass
class Resolver:
    run: Runner

    def resolve(self, products: Sequence[XOProduct], *, dedupe_creates: bool = True) -> list[Resolution]:
        # 1) by custitem7
        xo_ids = sorted({str(p.item_id) for p in products if p.item_id is not None})
        by_xo: dict[str, list[dict]] = {}
        for chunk in chunks(xo_ids):
            for r in self.run(q_by_xo_item_id(list(chunk))):
                by_xo.setdefault(norm_key(r.get("xo_item_id")), []).append(r)
        # 2) by itemid for the rest
        need_sku = [p for p in products if p.item_id is None or norm_key(p.item_id) not in by_xo]
        skus = sorted({norm_key(p.item_number) for p in need_sku if p.item_number})
        by_sku: dict[str, list[dict]] = {}
        for chunk in chunks(skus):
            for r in self.run(q_by_itemid(list(chunk))):
                by_sku.setdefault(norm_key(r.get("itemid")), []).append(r)

        out: list[Resolution] = []
        for p in products:
            res = Resolution(product=p)
            hits = by_xo.get(norm_key(p.item_id), []) if p.item_id is not None else []
            if hits:
                res.matched_by = XO_ITEM_ID_FIELD
            else:
                hits = by_sku.get(norm_key(p.item_number), []) if p.item_number else []
                if hits:
                    res.matched_by = "itemid"
            res.candidates = hits
            if len(hits) == 1:
                res.internal_id = str(hits[0]["id"])
                if str(hits[0].get("isinactive", "F")).upper() == "T":
                    res.note = "matched an INACTIVE item"
            elif len(hits) > 1:
                res.note = f"ambiguous: {len(hits)} items match ({res.matched_by}); skipped"
            else:
                if not p.item_number:
                    res.note = "no ItemNumber - cannot create"
                else:
                    res.is_net_new = True
            out.append(res)
        return out


def summarize(resolutions: Sequence[Resolution]) -> dict[str, int]:
    s = {"total": len(resolutions), "update": 0, "add": 0, "ambiguous": 0, "inactive_match": 0, "unresolvable": 0,
         "by_custitem7": 0, "by_itemid": 0}
    for r in resolutions:
        if r.ambiguous:
            s["ambiguous"] += 1
        elif r.internal_id:
            s["update"] += 1
            s["by_custitem7" if r.matched_by == XO_ITEM_ID_FIELD else "by_itemid"] += 1
            if "INACTIVE" in r.note:
                s["inactive_match"] += 1
        elif r.is_net_new:
            s["add"] += 1
        else:
            s["unresolvable"] += 1
    return s
