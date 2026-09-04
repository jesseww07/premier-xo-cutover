import base64
import json

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from xo_relay.netsuite.auth import NetSuiteOAuth, sign_jwt, ASSERTION_TYPE


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def test_jwt_structure_and_signature_verify():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    tok = sign_jwt(key, kid="CERT123", iss="client-id", aud="https://7513000-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token", now=1_700_000_000)
    h, p, s = tok.split(".")
    header = json.loads(_b64d(h))
    payload = json.loads(_b64d(p))
    assert header == {"alg": "PS256", "typ": "JWT", "kid": "CERT123"}
    assert payload["iss"] == "client-id" and payload["scope"] == ["rest_webservices"]
    assert payload["exp"] - payload["iat"] == 3600
    key.public_key().verify(_b64d(s), f"{h}.{p}".encode(),
                            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32), hashes.SHA256())


class Resp:
    def __init__(self, status, payload):
        self.status_code = status
        self._p = payload
        self.text = json.dumps(payload)
    def json(self):
        return self._p


class Sess:
    def __init__(self):
        self.posts = []
    def post(self, url, data=None, headers=None, timeout=None):
        self.posts.append((url, data))
        return Resp(200, {"access_token": f"tok{len(self.posts)}", "expires_in": 3600})


def test_token_flow_caches_and_targets_sandbox_url():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    t = {"now": 1_700_000_000.0}
    auth = NetSuiteOAuth(account="7513000_SB1", client_id="cid", cert_id="kid", private_key_pem=pem, session=Sess(), clock=lambda: t["now"])
    assert auth.token_url == "https://7513000-sb1.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token"
    assert auth.token() == "tok1"
    assert auth.token() == "tok1"                      # cached
    t["now"] += 3600
    assert auth.token() == "tok2"                      # refreshed after expiry
    url, data = auth.session.posts[0]
    assert data["grant_type"] == "client_credentials" and data["client_assertion_type"] == ASSERTION_TYPE
    assert auth.headers()["Authorization"].startswith("Bearer ")
