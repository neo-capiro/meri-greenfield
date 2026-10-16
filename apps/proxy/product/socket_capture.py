"""Request-local capture of a trusted server's accepted asyncio TLS transport.

The server must call ``bind_request`` with its actual accepted transport and
the exact ASGI scope it dispatches, before entering the product application.
ASGI scope fields, forwarding headers and transport ``peername`` metadata do
not establish socket identity. This module supplies no listener or server
integration and cannot authenticate a transport supplied by untrusted Python.
"""
import asyncio
from asyncio.trsock import TransportSocket
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
import math
import socket
import ssl
import time

from .bearer_eni_admission import DirectTlsSocketPeer
from ..qualification.state.pricing import StateDenied


def _deny():
    raise StateDenied("PRODUCT_TLS_SOCKET_CAPTURE_DENIED")


def _observe(transport):
    """Read connected socket and negotiated server TLS state without I/O."""
    if not isinstance(transport, asyncio.Transport) or transport.is_closing():
        _deny()
    sock = transport.get_extra_info("socket")
    tls = transport.get_extra_info("ssl_object")
    if (not isinstance(sock, (socket.socket, TransportSocket))
            or not isinstance(tls, (ssl.SSLObject, ssl.SSLSocket))
            or tls.server_side is not True
            or sock.family != socket.AF_INET or sock.type != socket.SOCK_STREAM):
        _deny()
    descriptor = sock.fileno()
    endpoint = sock.getpeername()
    if (type(descriptor) is not int or descriptor < 0
            or type(endpoint) is not tuple or len(endpoint) != 2):
        _deny()
    peer = DirectTlsSocketPeer(endpoint[0], endpoint[1], tls.version())
    if transport.is_closing():
        _deny()
    return sock, tls, descriptor, peer


def _scope_matches(scope, peer):
    if (type(scope) is not dict or scope.get("type") != "http"
            or scope.get("scheme") != "https"
            or scope.get("client") != (peer.ipv4, peer.port)):
        _deny()


@dataclass
class _Capture:
    scope: dict
    transport: object
    sock: object
    tls: object
    descriptor: int
    peer: DirectTlsSocketPeer
    deadline: float
    active: bool = True


class DirectTlsSocketCapture:
    """Own the binding; borrow the transport and leave its closure to the server.

    ``asyncio.to_thread`` copies this ContextVar, so the synchronous bearer/ENI
    resolver can call ``read_direct_tls_socket`` off the ASGI loop. Every copied
    context refers to the same revocable holder. Exiting the dispatch, including
    cancellation or failure, invalidates late child tasks and lookup threads.
    """

    def __init__(self):
        self._current = ContextVar("product_direct_tls_capture", default=None)

    @contextmanager
    def bind_request(self, scope, transport, *, deadline):
        """Wrap one server dispatch with its original monotonic deadline.

        Intended server seam::

            with capture.bind_request(scope, accepted_transport, deadline=end):
                await product_app(scope, receive, send)

        Pass ``capture.read_direct_tls_socket`` to the existing bearer/ENI
        resolver factory. Set ``end`` at request arrival, at most 900 seconds
        ahead. Bind inside the task that dispatches this request, never in a
        connection callback shared by unrelated requests.
        """
        holder = None
        token = None
        try:
            now = time.monotonic()
            if (self._current.get() is not None
                    or type(deadline) not in (int, float)
                    or not math.isfinite(deadline) or not now < deadline <= now + 900):
                _deny()
            sock, tls, descriptor, peer = _observe(transport)
            _scope_matches(scope, peer)
            holder = _Capture(scope, transport, sock, tls, descriptor, peer, deadline)
            token = self._current.set(holder)
            self.read_direct_tls_socket(scope)
        except Exception:
            if holder is not None:
                holder.active = False
            if token is not None:
                self._current.reset(token)
            _deny()
        try:
            yield
        finally:
            holder.active = False
            self._current.reset(token)

    def read_direct_tls_socket(self, scope):
        """Return a fresh checked peer only for the exact active dispatch scope."""
        holder = self._current.get()
        try:
            if (type(holder) is not _Capture or not holder.active
                    or holder.scope is not scope or time.monotonic() >= holder.deadline):
                _deny()
            _scope_matches(scope, holder.peer)
            sock, tls, descriptor, peer = _observe(holder.transport)
            if (sock is not holder.sock or tls is not holder.tls
                    or descriptor != holder.descriptor or peer != holder.peer
                    or not holder.active or time.monotonic() >= holder.deadline):
                _deny()
            return peer
        except Exception:
            # A broken binding cannot become usable again if a transport, scope
            # or copied context is subsequently restored to its old values.
            if type(holder) is _Capture:
                holder.active = False
            _deny()
