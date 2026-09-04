"""NetSuite OAuth 2.0 client credentials flow (machine-to-machine, certificate-based).

No user, no password, no TBA token rotation, no IP requirement. Setup in NetSuite:
  Setup > Integration > OAuth 2.0 Client Credentials (M2M) Setup  -> upload the public cert,
  pick the integration record and the dedicated integration ROLE (the same role the FarApp
  UE deployment will be restricted away from). NetSuite shows a Certificate ID -> NS_CERT_ID.

Token request: POST https://<acct>.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token
  grant_type=client_credentials
  client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
  client_assertion=<JWT signed with the private key; alg PS256 (RSA) or ES256 (EC); kid=cert id>
Access tokens last 60 minutes; we refresh at 55.

Implemented with `cryptography` only (already installed); no PyJWT dependency.
"""
from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa, utils as asym_utils

SCOPE = "rest_webservices"
ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def load_private_key(pem: bytes, passphrase: Optional[str] = None):
    pw = passphrase.encode() if passphrase else None
    return serialization.load_pem_private_key(pem, password=pw)


def sign_jwt(private_key, *, kid: str, iss: str, aud: str, scope: str = SCOPE, now: Optional[int] = None,
             lifetime_s: int = 3600) -> str:
    """Build and sign the client assertion. PS256 for RSA keys, ES256 for P-256 EC keys."""
    now = int(now if now is not None else time.time())
    if isinstance(private_key, rsa.RSAPrivateKey):
        alg = "PS256"
    elif isinstance(private_key, ec.EllipticCurvePrivateKey):
        alg = "ES256"
    else:  # pragma: no cover
        raise TypeError("unsupported private key type")
    header = {"alg": alg, "typ": "JWT", "kid": kid}
    payload = {"iss": iss, "scope": [scope] if isinstance(scope, str) else list(scope), "aud": aud,
               "iat": now, "exp": now + min(lifetime_s, 3600)}
    signing_input = b64url(json.dumps(header, separators=(",", ":")).encode()) + "." + \
                    b64url(json.dumps(payload, separators=(",", ":")).encode())
    if alg == "PS256":
        sig = private_key.sign(signing_input.encode(), padding.PSS(mgf=padding.MGF1(hashes.SHA256()),
                                                                   salt_length=hashes.SHA256().digest_size),
                               hashes.SHA256())
    else:
        der = private_key.sign(signing_input.encode(), ec.ECDSA(hashes.SHA256()))
        r, s = asym_utils.decode_dss_signature(der)
        sig = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return signing_input + "." + b64url(sig)


@dataclass
class NetSuiteOAuth:
    account: str                       # e.g. 7513000-SB1 or 7513000
    client_id: str
    cert_id: str
    private_key_pem: bytes
    passphrase: Optional[str] = None
    session: requests.Session = field(default_factory=requests.Session)
    clock: Callable[[], float] = time.time
    _token: Optional[str] = field(default=None, repr=False)
    _expires_at: float = 0.0

    @classmethod
    def from_settings(cls, s) -> "NetSuiteOAuth":
        missing = [k for k, v in {"NS_CLIENT_ID": s.ns_client_id, "NS_CERT_ID": s.ns_cert_id,
                                  "NS_PRIVATE_KEY_PATH": s.ns_private_key_path}.items() if not v]
        if missing:
            raise ValueError(f"NetSuite OAuth settings missing: {missing}")
        pem = Path(s.ns_private_key_path).read_bytes()
        return cls(account=s.ns_account, client_id=s.ns_client_id, cert_id=s.ns_cert_id,
                   private_key_pem=pem, passphrase=s.ns_private_key_passphrase or None)

    @property
    def account_slug(self) -> str:
        return self.account.lower().replace("_", "-")

    @property
    def rest_base(self) -> str:
        return f"https://{self.account_slug}.suitetalk.api.netsuite.com/services/rest"

    @property
    def token_url(self) -> str:
        return f"{self.rest_base}/auth/oauth2/v1/token"

    def assertion(self) -> str:
        key = load_private_key(self.private_key_pem, self.passphrase)
        return sign_jwt(key, kid=self.cert_id, iss=self.client_id, aud=self.token_url, now=int(self.clock()))

    def token(self, *, force: bool = False) -> str:
        if not force and self._token and self.clock() < self._expires_at:
            return self._token
        resp = self.session.post(
            self.token_url,
            data={"grant_type": "client_credentials", "client_assertion_type": ASSERTION_TYPE,
                  "client_assertion": self.assertion()},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=60,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"NetSuite token request failed {resp.status_code}: {resp.text[:400]}")
        body = resp.json()
        self._token = body["access_token"]
        self._expires_at = self.clock() + float(body.get("expires_in", 3600)) - 300  # refresh 5 min early
        return self._token

    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token()}", "Content-Type": "application/json",
                "Accept": "application/json"}
