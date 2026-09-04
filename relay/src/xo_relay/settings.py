"""Environment-driven settings. Nothing here is ever committed with a real value.

Load order: process environment wins; a `.env` file in the relay root (or the path in
RELAY_ENV_FILE) fills gaps. `.env` is git-ignored; `.env.example` documents every key.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping, Optional


def load_env_file(path: Path) -> dict[str, str]:
    """Minimal .env parser (KEY=VALUE, '#' comments, optional quotes). No dependency."""
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        values[key] = val
    return values


def _bool(v: Optional[str], default: bool = False) -> bool:
    if v is None or v == "":
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


@dataclass(frozen=True)
class Settings:
    # --- XO Product API (the only leg with an IP constraint) ---
    xo_database_name: str = ""
    xo_access_token: str = ""
    xo_item_url_base: str = ""          # prefix for the relative `Item URL` path (open item #6/#7)
    xo_rate_limit_rps: float = 10.0     # hard ceiling is 20 req/s per XO; stay under it
    xo_server_error_wait_s: float = 300 # XO: "retry after 5 minutes" on 500
    xo_server_error_retries: int = 1    # then alert

    # --- NetSuite (token auth, no IP requirement) ---
    ns_account: str = "7513000-SB1"     # sandbox by default; prod needs RELAY_ALLOW_PROD_WRITES
    ns_client_id: str = ""
    ns_cert_id: str = ""                # certificate id shown on the OAuth 2.0 client credentials setup
    ns_private_key_path: str = ""
    ns_private_key_passphrase: str = ""

    # --- Shopify Admin (compare-at lookup only; the import itself stays with Matrixify) ---
    shopify_store_domain: str = ""      # e.g. shoppremier.myshopify.com
    shopify_admin_token: str = ""
    shopify_api_version: str = "2026-07"

    # --- Relay behaviour ---
    write_mode: str = "csv"             # csv (Phase 1) | rest (Phase 2)
    dry_run: bool = True
    allow_prod_writes: bool = False
    out_dir: str = "out"
    fixtures_dir: str = "tests/fixtures"

    extra: Mapping[str, str] = field(default_factory=dict, repr=False)

    # ------------------------------------------------------------------ derived
    @property
    def ns_account_slug(self) -> str:
        return self.ns_account.lower().replace("_", "-")

    @property
    def ns_is_production(self) -> bool:
        return "-sb" not in self.ns_account_slug and "-rp" not in self.ns_account_slug

    # ------------------------------------------------------------------ loading
    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None, env_file: Optional[Path] = None) -> "Settings":
        env = dict(env if env is not None else os.environ)
        path = env_file or Path(env.get("RELAY_ENV_FILE", ".env"))
        merged = {**load_env_file(Path(path)), **env}
        g = merged.get
        return cls(
            xo_database_name=g("XO_DATABASE_NAME", ""),
            xo_access_token=g("XO_ACCESS_TOKEN", ""),
            xo_item_url_base=g("XO_ITEM_URL_BASE", ""),
            xo_rate_limit_rps=float(g("XO_RATE_LIMIT_RPS", "10")),
            xo_server_error_wait_s=float(g("XO_SERVER_ERROR_WAIT_S", "300")),
            xo_server_error_retries=int(g("XO_SERVER_ERROR_RETRIES", "1")),
            ns_account=g("NS_ACCOUNT", "7513000-SB1"),
            ns_client_id=g("NS_CLIENT_ID", ""),
            ns_cert_id=g("NS_CERT_ID", ""),
            ns_private_key_path=g("NS_PRIVATE_KEY_PATH", ""),
            ns_private_key_passphrase=g("NS_PRIVATE_KEY_PASSPHRASE", ""),
            shopify_store_domain=g("SHOPIFY_STORE_DOMAIN", ""),
            shopify_admin_token=g("SHOPIFY_ADMIN_TOKEN", ""),
            shopify_api_version=g("SHOPIFY_API_VERSION", "2026-07"),
            write_mode=g("RELAY_WRITE_MODE", "csv"),
            dry_run=_bool(g("RELAY_DRY_RUN"), True),
            allow_prod_writes=_bool(g("RELAY_ALLOW_PROD_WRITES"), False),
            out_dir=g("RELAY_OUT_DIR", "out"),
            fixtures_dir=g("RELAY_FIXTURES_DIR", "tests/fixtures"),
            extra=merged,
        )
