"""NetSuite write leg.

Phase 1 (now): emit an UPDATE CSV keyed on Internal ID and an ADD CSV for net-new items,
in the mapping's column order, for Jesse's saved CSV import map. Zero automation risk.

Phase 2 (after several clean Phase 1 cycles): PATCH / POST via SuiteTalk REST, one call per
record. Volume (hundreds/week) does not justify RESTlet batching or CSVImportTask.

Guards: writes to a production account require RELAY_ALLOW_PROD_WRITES=1 AND dry_run=False.
Ambiguous resolutions are never written. `externalid` is never in any payload.
"""
from __future__ import annotations

import csv
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Mapping, Optional, Sequence

import requests

from ..transform.netsuite_map import MappingConfig, build_row, rest_body
from .query import Resolution

log = logging.getLogger(__name__)

FORBIDDEN_NS_FIELDS = {"externalid", "externalId"}


@dataclass
class Phase1Result:
    update_path: Optional[Path]
    add_path: Optional[Path]
    update_rows: int
    add_rows: int
    skipped: list[dict[str, Any]]
    headers_update: list[str]
    headers_add: list[str]
    unmapped_vendors: list[str] = field(default_factory=list)


def _write_csv(path: Path, headers: Sequence[str], rows: Iterable[Mapping[str, str]], *, bom: bool = False) -> int:
    n = 0
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig" if bom else "utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(headers), extrasaction="ignore", lineterminator="\r\n")
        w.writeheader()
        for r in rows:
            w.writerow({h: r.get(h, "") for h in headers})
            n += 1
    return n


def emit_phase1(resolutions: Sequence[Resolution], cfg: MappingConfig, out_dir: Path, *,
                stamp: Optional[str] = None, groups: Optional[set[str]] = None, bom: Optional[bool] = None) -> Phase1Result:
    bom = cfg.csv_bom if bom is None else bom
    stamp = stamp or datetime.now().strftime("%Y-%m-%d_%H%M")
    upd_rows: list[dict[str, str]] = []
    add_rows: list[dict[str, str]] = []
    skipped: list[dict[str, Any]] = []
    unmapped_vendors: set[str] = set()
    for r in resolutions:
        if r.ambiguous or (not r.internal_id and not r.is_net_new):
            skipped.append({"sku": r.product.item_number, "xo_item_id": r.product.item_id, "reason": r.note or "unresolved",
                            "candidates": [c.get("id") for c in r.candidates]})
            continue
        if r.internal_id:
            upd_rows.append(build_row(r.product, cfg, op="update", internal_id=r.internal_id, groups=groups))
        else:
            add_rows.append(build_row(r.product, cfg, op="add", groups=groups))
            if r.product.vendor_name and cfg.vendor_map and cfg.ns_vendor(r.product.vendor_name) is None:
                unmapped_vendors.add(r.product.vendor_name)
    h_upd = cfg.headers("update", groups)
    h_add = list(cfg.headers("add", groups))
    for extra in cfg.add_defaults:
        if extra not in h_add:
            h_add.append(extra)
    for h in h_upd + h_add:
        if h.strip().lower() in {"external id", "externalid"}:
            raise RuntimeError("externalid must never be written (occupied by the LA process)")
    upd_path = add_path = None
    if upd_rows:
        upd_path = out_dir / f"xo_netsuite_UPDATE_{stamp}.csv"
        _write_csv(upd_path, h_upd, upd_rows, bom=bom)
    if add_rows:
        add_path = out_dir / f"xo_netsuite_ADD_{stamp}.csv"
        _write_csv(add_path, h_add, add_rows, bom=bom)
    if skipped:
        (out_dir / f"xo_netsuite_SKIPPED_{stamp}.json").write_text(json.dumps(skipped, indent=2), encoding="utf-8")
    return Phase1Result(upd_path, add_path, len(upd_rows), len(add_rows), skipped, h_upd, h_add, sorted(unmapped_vendors))


# ---------------------------------------------------------------------- Phase 2
@dataclass
class WriteOutcome:
    op: str
    internal_id: Optional[str]
    sku: Optional[str]
    status: Optional[int]
    ok: bool
    detail: str = ""
    body: dict[str, Any] = field(default_factory=dict)


@dataclass
class RestWriter:
    auth: Any                             # NetSuiteOAuth
    cfg: MappingConfig
    record_type: str = "inventoryitem"
    dry_run: bool = True
    allow_prod: bool = False
    session: requests.Session = field(default_factory=requests.Session)

    def __post_init__(self):
        slug = self.auth.account_slug
        is_prod = "-sb" not in slug and "-rp" not in slug
        if is_prod and not self.dry_run and not self.allow_prod:
            raise RuntimeError(f"refusing live writes to production account {self.auth.account} without RELAY_ALLOW_PROD_WRITES=1")

    @property
    def record_url(self) -> str:
        return f"{self.auth.rest_base}/record/v1/{self.record_type}"

    def _guard(self, body: Mapping[str, Any]) -> None:
        bad = FORBIDDEN_NS_FIELDS & set(body)
        if bad:
            raise RuntimeError(f"payload contains forbidden field(s) {bad}")

    def update(self, res: Resolution, *, groups: Optional[set[str]] = None) -> WriteOutcome:
        row = build_row(res.product, self.cfg, op="update", internal_id=res.internal_id, groups=groups)
        body = rest_body(row, self.cfg)
        self._guard(body)
        if self.dry_run:
            return WriteOutcome("PATCH", res.internal_id, res.product.item_number, None, True, "dry-run", body)
        resp = self.session.patch(f"{self.record_url}/{res.internal_id}", headers=self.auth.headers(), json=body, timeout=120)
        ok = resp.status_code in (200, 204)
        return WriteOutcome("PATCH", res.internal_id, res.product.item_number, resp.status_code, ok, "" if ok else resp.text[:400], body)

    def create(self, res: Resolution, *, groups: Optional[set[str]] = None) -> WriteOutcome:
        row = build_row(res.product, self.cfg, op="add", groups=groups)
        body = rest_body(row, self.cfg)
        self._guard(body)
        if self.dry_run:
            return WriteOutcome("POST", None, res.product.item_number, None, True, "dry-run", body)
        resp = self.session.post(self.record_url, headers=self.auth.headers(), json=body, timeout=120)
        ok = resp.status_code in (200, 201, 204)
        new_id = None
        loc = resp.headers.get("Location", "") if hasattr(resp, "headers") else ""
        if ok and loc:
            new_id = loc.rstrip("/").rsplit("/", 1)[-1]
        return WriteOutcome("POST", new_id, res.product.item_number, resp.status_code, ok, "" if ok else resp.text[:400], body)

    def write_all(self, resolutions: Sequence[Resolution], *, groups: Optional[set[str]] = None,
                  allow_creates: bool = False) -> list[WriteOutcome]:
        out: list[WriteOutcome] = []
        for r in resolutions:
            if r.ambiguous:
                out.append(WriteOutcome("SKIP", None, r.product.item_number, None, False, r.note))
            elif r.internal_id:
                out.append(self.update(r, groups=groups))
            elif r.is_net_new and allow_creates:
                out.append(self.create(r, groups=groups))
            else:
                out.append(WriteOutcome("SKIP", None, r.product.item_number, None, False, r.note or "net-new (creates disabled)"))
        return out
