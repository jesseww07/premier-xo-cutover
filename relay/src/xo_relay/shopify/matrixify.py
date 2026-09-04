"""Matrixify Products CSV emit + the Shopify price lookup the compare-at rule needs.

The upload/import itself stays exactly where it is today (the scheduled task's Step 4 via the
Matrixify MCP, or Matrixify's scheduled import). This module produces the file it expects:
UTF-8 WITHOUT BOM, filename containing "Products", no Handle/Title/Tracker columns.
"""
from __future__ import annotations

import base64
import csv
import hashlib
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence

import requests

from ..xo.models import parse_decimal


def write_products_csv(rows: Sequence[Mapping[str, str]], path: Path) -> Path:
    if "products" not in path.name.lower():
        raise ValueError("filename must contain 'Products' for Matrixify entity auto-detection")
    if not rows:
        raise ValueError("no rows")
    headers = list(rows[0].keys())
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:      # no BOM
        w = csv.DictWriter(f, fieldnames=headers, lineterminator="\n")
        w.writeheader()
        for r in rows:
            w.writerow({h: r.get(h, "") for h in headers})
    return path


def md5_base64(path: Path) -> str:
    """Checksum in the form matrixify_import_get_upload_url wants (openssl md5 -binary | base64)."""
    return base64.b64encode(hashlib.md5(path.read_bytes()).digest()).decode("ascii")


def upload_manifest(path: Path) -> dict[str, Any]:
    return {"filename": path.name, "byte_size": path.stat().st_size, "content_type": "text/csv",
            "checksum_md5_base64": md5_base64(path)}


@dataclass
class GraphQLPriceLookup:
    """sku -> (price, compareAtPrice) via Admin GraphQL productVariants search, ~40 SKUs per call."""
    store_domain: str
    admin_token: str
    api_version: str = "2026-07"
    session: requests.Session = field(default_factory=requests.Session)

    @property
    def url(self) -> str:
        return f"https://{self.store_domain}/admin/api/{self.api_version}/graphql.json"

    @staticmethod
    def build_query(skus: Sequence[str]) -> str:
        # quote every SKU - many contain slashes
        terms = " OR ".join('sku:"' + s.replace('"', '\\"') + '"' for s in skus)
        q = terms.replace("\\", "\\\\").replace('"', '\\"')
        return '{ productVariants(first: 50, query: "' + q + '") { nodes { sku price compareAtPrice } } }'

    def __call__(self, skus: Sequence[str]) -> dict[str, tuple[Optional[Decimal], Optional[Decimal]]]:
        if not skus:
            return {}
        resp = self.session.post(self.url, headers={"X-Shopify-Access-Token": self.admin_token,
                                                    "Content-Type": "application/json"},
                                 json={"query": self.build_query(skus)}, timeout=60)
        if resp.status_code != 200:
            raise RuntimeError(f"Shopify GraphQL {resp.status_code}: {resp.text[:300]}")
        body = resp.json()
        if body.get("errors"):
            raise RuntimeError(f"Shopify GraphQL errors: {body['errors']}")
        out: dict[str, tuple[Optional[Decimal], Optional[Decimal]]] = {}
        for node in body["data"]["productVariants"]["nodes"]:
            sku = node.get("sku")
            if not sku:
                continue
            pair = (parse_decimal(node.get("price")), parse_decimal(node.get("compareAtPrice")))
            if sku in out and out[sku] != pair:
                # duplicate variants with different values: keep the first, but it is worth a look
                continue
            out[sku] = pair
        return out
