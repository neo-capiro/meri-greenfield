"""Real two-connection owner mTLS transport. Import/construction open no socket.

Only externally delivered certificate files are accepted. No CA discovery,
certificate issuance, provider request, retry or account credential is involved.
The Node owner validates fresh native self/proxy task leases around every reply;
configured task/certificate pins here are not described as AWS observations.
"""
import asyncio
from dataclasses import dataclass
import hashlib
import http.client
import ipaddress
import json
import math
import socket
import ssl
import threading
import time

from .owner_channel import OwnerPeerPolicy, OwnerReply, OwnerTlsEvidence, OPEN, OPERATION, POLL, REPLY
from ..qualification.state.pricing import StateDenied


def _deny():
    raise StateDenied("PRODUCT_OWNER_HTTPS_DENIED")


def _ip(value):
    try:
        parsed = ipaddress.IPv4Address(value)
        if type(value) is not str or str(parsed) != value or not any(parsed in n for n in (
                ipaddress.IPv4Network("10.0.0.0/8"), ipaddress.IPv4Network("172.16.0.0/12"),
                ipaddress.IPv4Network("192.168.0.0/16"))):
            _deny()
        return value
    except (ValueError, TypeError):
        _deny()


@dataclass(frozen=True)
class OwnerClientTlsMaterial:
    context: ssl.SSLContext
    client_cert_sha256: str


def load_owner_client_tls_material(*, ca_file, certificate_file, private_key_file, policy):
    """Read only explicit trusted file refs; callers deliver/protect those files."""
    if type(policy) is not OwnerPeerPolicy or any(type(v) is not str or not v for v in
            (ca_file, certificate_file, private_key_file)):
        _deny()
    try:
        with open(certificate_file, "r", encoding="ascii") as source:
            pem = source.read(65537)
        if len(pem) > 65536:
            _deny()
        first = pem[:pem.index("-----END CERTIFICATE-----") + len("-----END CERTIFICATE-----")]
        actual = hashlib.sha256(ssl.PEM_cert_to_DER_cert(first)).hexdigest()
        if actual != policy.client_cert_sha256:
            _deny()
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version = ssl.TLSVersion.TLSv1_3
        context.maximum_version = ssl.TLSVersion.TLSv1_3
        context.verify_mode = ssl.CERT_REQUIRED
        context.check_hostname = True
        context.options |= ssl.OP_NO_TICKET
        context.set_alpn_protocols(["http/1.1"])
        context.load_verify_locations(cafile=ca_file)
        context.load_cert_chain(certificate_file, private_key_file)
        roots = context.get_ca_certs(binary_form=True)
        if len(roots) != 1 or hashlib.sha256(roots[0]).hexdigest() != policy.server_issuer_sha256:
            _deny()
        return OwnerClientTlsMaterial(context, actual)
    except Exception:
        _deny()


def validate_owner_http_reply(status, headers, *, expected_revision, max_bytes=12*1024*1024):
    """Closed HTTP framing, independent of the admission/budget body codec."""
    if status != 200 or type(headers) is not list or len(headers) > 64:
        _deny()
    result = {}
    for key, value in headers:
        if type(key) is not str or type(value) is not str or key.lower() in result:
            _deny()
        result[key.lower()] = value
    length = result.get("content-length", "")
    if (not length.isascii() or not length.isdigit() or str(int(length)) != length
            or not 1 <= int(length) <= max_bytes
            or result.get("content-type") != "application/json"
            or result.get("cache-control") != "no-store"
            or result.get("x-meri-owner-revision") != expected_revision
            or "transfer-encoding" in result or "content-encoding" in result
            or "location" in result):
        _deny()
    return int(length)


class ProductOwnerHttpsExchange:
    """Use one dedicated verified socket per carrier, never reconnect after loss.

    abort() is synchronous and thread-safe: it permanently retires the pair and
    shuts down/closes every registered raw/TLS descriptor before returning.
    Native success requires pinned CPython >=3.13 public verified-chain API.
    """
    def __init__(self, *, policy, material, owner_ipv4, proxy_ipv4, expires_at_ms,
                 deployment_revision, now_ms=None):
        if (type(policy) is not OwnerPeerPolicy or type(material) is not OwnerClientTlsMaterial
                or not isinstance(material.context, ssl.SSLContext)
                or material.context.protocol != ssl.PROTOCOL_TLS_CLIENT
                or material.context.minimum_version != ssl.TLSVersion.TLSv1_3
                or material.context.maximum_version != ssl.TLSVersion.TLSv1_3
                or material.context.verify_mode != ssl.CERT_REQUIRED
                or material.context.check_hostname is not True
                or material.client_cert_sha256 != policy.client_cert_sha256
                or policy.max_exchange_ms > 3000
                or type(deployment_revision) is not str or not 1 <= len(deployment_revision) <= 128
                or not deployment_revision.isascii()
                or any(not (c.isalnum() or c in '_-') for c in deployment_revision)
                or type(expires_at_ms) is not int or expires_at_ms <= 0
                or not callable(now_ms or time.time_ns)):
            _deny()
        self.policy, self.material = policy, material
        self.owner_ipv4, self.proxy_ipv4 = _ip(owner_ipv4), _ip(proxy_ipv4)
        if self.owner_ipv4 == self.proxy_ipv4:
            _deny()
        self.expires_at_ms = expires_at_ms
        self.deployment_revision = deployment_revision
        self.now_ms = now_ms or (lambda: time.time_ns() // 1000000)
        self._state = threading.RLock()
        self._locks = {name: threading.Lock() for name in ("operation", "capture")}
        self._connections, self._sockets = {}, set()
        self._retired = False

    @property
    def available(self):
        context = self.material.context
        return (not self._retired and self.now_ms() < self.expires_at_ms
                and context.minimum_version == ssl.TLSVersion.TLSv1_3
                and context.maximum_version == ssl.TLSVersion.TLSv1_3
                and context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname is True)

    def abort(self):
        with self._state:
            self._retired = True
            sockets = tuple(self._sockets)
            connections = tuple(self._connections.values())
            self._sockets.clear()
            self._connections.clear()
        for sock in sockets:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        # HTTPResponse owns a makefile reference. Close that owner too; closing
        # only SSLSocket can otherwise defer descriptor retirement indefinitely.
        for connection in connections:
            try:
                connection.close()
            except Exception:
                pass
        for sock in sockets:
            try:
                sock.close()
            except OSError:
                pass

    def _remaining(self, cutoff):
        at = self.now_ms()
        if type(at) is not int or not self.available or at >= cutoff:
            _deny()
        return (cutoff-at)/1000

    def _register(self, sock):
        with self._state:
            if self._retired:
                sock.close()
                _deny()
            self._sockets.add(sock)

    def _evidence(self, sock):
        # Certificate chain validity/name is OpenSSL's decision; exact pins and
        # fixed socket endpoints add deployment/task binding, not a new issuer.
        if (not isinstance(sock, ssl.SSLSocket) or sock.fileno() < 0
                or sock.version() != "TLSv1.3" or sock.selected_alpn_protocol() != "http/1.1"
                or sock.getpeername() != (self.owner_ipv4, 8444)
                or sock.getsockname()[0] != self.proxy_ipv4):
            _deny()
        leaf = sock.getpeercert(binary_form=True)
        chain = sock.get_verified_chain()
        if (type(leaf) is not bytes or hashlib.sha256(leaf).hexdigest() != self.policy.server_cert_sha256
                or type(chain) is not list or not 2 <= len(chain) <= 4
                or hashlib.sha256(chain[-1]).hexdigest() != self.policy.server_issuer_sha256):
            _deny()
        return OwnerTlsEvidence(self.policy.origin, self.policy.server_name,
            self.policy.owner_task_arn, self.policy.proxy_task_arn,
            hashlib.sha256(leaf).hexdigest(), hashlib.sha256(chain[-1]).hexdigest(),
            self.material.client_cert_sha256, self.policy.client_subject,
            sock.version(), sock.selected_alpn_protocol(), f"tls_{id(sock):x}")

    def _connect(self, channel, cutoff):
        # Refuse unsupported platform before creating even an unconnected socket.
        if not hasattr(ssl.SSLSocket, "get_verified_chain"):
            _deny()
        raw = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._register(raw)
        raw.settimeout(self._remaining(cutoff))
        raw.bind((self.proxy_ipv4, 0))
        raw.connect((self.owner_ipv4, 8444))
        tls = self.material.context.wrap_socket(raw, server_hostname=self.policy.server_name,
                                                 do_handshake_on_connect=False)
        self._register(tls)
        tls.settimeout(self._remaining(cutoff));tls.do_handshake()
        self._evidence(tls)
        connection = http.client.HTTPConnection(self.policy.server_name, 8444,
                                                 timeout=self._remaining(cutoff))
        connection.sock = tls
        self._connections[channel] = connection
        return connection

    def _send(self, channel, path, body, cutoff):
        acquired = False
        try:
            acquired = self._locks[channel].acquire(timeout=self._remaining(cutoff))
            if not acquired:
                _deny()
            connection = self._connections.get(channel) or self._connect(channel, cutoff)
            sock = connection.sock
            evidence = self._evidence(sock)
            sock.settimeout(self._remaining(cutoff))
            connection.request("POST", path, body=body, headers={
                "host": f"{self.policy.server_name}:8444", "content-type": "application/json",
                "content-length": str(len(body)), "accept-encoding": "identity", "connection": "keep-alive"})
            response = connection.getresponse()
            length = validate_owner_http_reply(response.status, response.getheaders(),
                                               expected_revision=self.deployment_revision)
            if response.version != 11 or response.will_close:
                _deny()
            value = response.read(length+1)
            if len(value) != length or response.length not in (0, None):
                _deny()
            self._remaining(cutoff)
            if self._evidence(sock) != evidence:
                _deny()
            return OwnerReply(value, evidence)
        except BaseException:
            self.abort()
            _deny()
        finally:
            if acquired:
                self._locks[channel].release()

    async def __call__(self, channel, path, body, timeout):
        if (channel not in self._locks or path not in (OPEN, OPERATION, POLL, REPLY)
                or path in (OPEN,) and channel != "operation"
                or path in (POLL, REPLY) and channel != "capture"
                or type(body) is not bytes or not 1 <= len(body) <= 12*1024*1024
                or type(timeout) not in (int, float) or not math.isfinite(timeout)
                or not 0 < timeout <= self.policy.max_exchange_ms/1000):
            _deny()
        if channel == "capture" and path == OPERATION:
            try:
                frame = json.loads(body)
                if type(frame) is not list or len(frame) != 5 or frame[0] != "meri.proxy.admission-read/1":
                    _deny()
            except (ValueError, TypeError, UnicodeError):
                _deny()
        cutoff = min(self.expires_at_ms, self.now_ms()+max(1,int(timeout*1000)))
        try:
            return await asyncio.wait_for(asyncio.to_thread(self._send, channel, path, body, cutoff),
                                          self._remaining(cutoff))
        except BaseException:
            self.abort()
            raise
