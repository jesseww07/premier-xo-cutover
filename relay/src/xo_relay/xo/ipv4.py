"""Force IPv4 on the XO leg.

XO whitelists IPv4 addresses only; an IPv6 egress produces `401 Not Authorized` that looks
like a bad token. We do not trust OS dual-stack preference. This adapter resolves the host
with AF_INET only and connects to the first IPv4 address that answers - the same algorithm
as urllib3's create_connection, minus the address family fallback.

Scoped to the session that mounts it: no global monkeypatching of urllib3 or socket.
"""
from __future__ import annotations

import socket
import sys
from typing import Optional, Sequence

from requests.adapters import HTTPAdapter
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.exceptions import ConnectTimeoutError, NameResolutionError, NewConnectionError
from urllib3.util.timeout import _DEFAULT_TIMEOUT


def create_ipv4_connection(
    address: tuple[str, int],
    timeout=_DEFAULT_TIMEOUT,
    source_address: Optional[tuple[str, int]] = None,
    socket_options: Optional[Sequence[tuple[int, int, int | bytes]]] = None,
    *,
    _getaddrinfo=socket.getaddrinfo,
    _socket_factory=socket.socket,
) -> socket.socket:
    """Connect to `address` using IPv4 only. Raises socket.gaierror if no A record."""
    host, port = address
    if host.startswith("["):
        host = host.strip("[]")
    err: Optional[Exception] = None
    infos = _getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
    for af, socktype, proto, _canon, sa in infos:
        if af != socket.AF_INET:  # defensive: never let a AAAA slip through
            continue
        sock = None
        try:
            sock = _socket_factory(af, socktype, proto)
            for opt in socket_options or ():
                sock.setsockopt(*opt)
            if timeout is not _DEFAULT_TIMEOUT:
                sock.settimeout(timeout)
            if source_address:
                sock.bind(source_address)
            sock.connect(sa)
            return sock
        except OSError as e:
            err = e
            if sock is not None:
                sock.close()
    if err is not None:
        raise err
    raise OSError("getaddrinfo returned no IPv4 address for %r" % host)


class _IPv4Mixin:
    def _new_conn(self):  # type: ignore[override]
        try:
            sock = create_ipv4_connection(
                (self._dns_host, self.port),
                self.timeout,
                source_address=self.source_address,
                socket_options=self.socket_options,
            )
        except socket.gaierror as e:
            raise NameResolutionError(self.host, self, e) from e
        except socket.timeout as e:
            raise ConnectTimeoutError(
                self, f"Connection to {self.host} timed out. (connect timeout={self.timeout})"
            ) from e
        except OSError as e:
            raise NewConnectionError(self, f"Failed to establish a new connection: {e}") from e
        sys.audit("http.client.connect", self, self.host, self.port)
        return sock


class IPv4HTTPConnection(_IPv4Mixin, HTTPConnection):
    pass


class IPv4HTTPSConnection(_IPv4Mixin, HTTPSConnection):
    pass


class IPv4HTTPConnectionPool(HTTPConnectionPool):
    ConnectionCls = IPv4HTTPConnection


class IPv4HTTPSConnectionPool(HTTPSConnectionPool):
    ConnectionCls = IPv4HTTPSConnection


class IPv4HTTPAdapter(HTTPAdapter):
    """requests adapter whose pools only ever dial IPv4."""

    def init_poolmanager(self, *args, **kwargs):
        super().init_poolmanager(*args, **kwargs)
        self.poolmanager.pool_classes_by_scheme = {
            "http": IPv4HTTPConnectionPool,
            "https": IPv4HTTPSConnectionPool,
        }
