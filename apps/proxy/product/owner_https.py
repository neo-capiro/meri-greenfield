"""Real three-connection owner mTLS transport (operation, capture, admission). Import/construction open no socket.

Only externally delivered certificate files are accepted. No CA discovery,
certificate issuance, provider request, retry or account credential is involved.
Each new socket requires a fresh post-handshake pair proof; held sockets use
only their current generation's unexpired monotonic lease. Configuration pins
are not described as AWS observations.
"""
import asyncio
from dataclasses import dataclass, replace
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
from .service_pair_discovery import ProductServicePairDiscovery, PairProofError
from .pair_lease import ProductPairLease
from . import refusal_diagnostics as diagnostics
from . import telemetry_context as telemetry
from .budgets import MAX_OWNER_EXCHANGE_MS, CARRIER_RESETS_PER_MIN, CARRIER_RESET_WINDOW_MS
from ..qualification.state.pricing import StateDenied


class OwnerExchangeUnavailable(TimeoutError):
    """No authenticated owner answer was received; never means not dispatched."""
    def __init__(self):
        super().__init__('PRODUCT_OWNER_EXCHANGE_UNAVAILABLE')


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
    """Three independent generation-bound carriers; resets never retry a frame.

    A holder owns discovery. This adapter owns every socket, verifies a new
    socket after its handshake, and closes old carriers before policy changes.
    """
    def __init__(self, *, policy, material, owner_ipv4, proxy_ipv4, expires_at_ms,
                 deployment_revision, now_ms=None, service_pair_reader=None):
        if (type(policy) is not OwnerPeerPolicy or type(material) is not OwnerClientTlsMaterial
                or not isinstance(material.context, ssl.SSLContext)
                or material.context.protocol != ssl.PROTOCOL_TLS_CLIENT
                or material.context.minimum_version != ssl.TLSVersion.TLSv1_3
                or material.context.maximum_version != ssl.TLSVersion.TLSv1_3
                or material.context.verify_mode != ssl.CERT_REQUIRED
                or material.context.check_hostname is not True
                or material.client_cert_sha256 != policy.client_cert_sha256
                or policy.max_exchange_ms > MAX_OWNER_EXCHANGE_MS
                or type(deployment_revision) is not str or not 1 <= len(deployment_revision) <= 128
                or not deployment_revision.isascii()
                or any(not (c.isalnum() or c in '_-') for c in deployment_revision)
                or type(expires_at_ms) is not int or expires_at_ms <= 0
                or not callable(now_ms or time.time_ns)
                or type(service_pair_reader) not in (ProductServicePairDiscovery, ProductPairLease)):
            _deny()
        self.pair_lease = (service_pair_reader if type(service_pair_reader) is ProductPairLease
                           else ProductPairLease(service_pair_reader, now_ms=now_ms))
        self.service_pair_reader = self.pair_lease.discovery
        self._policy, self.material = policy, material
        self.owner_ipv4, self.proxy_ipv4 = _ip(owner_ipv4), _ip(proxy_ipv4)
        if self.owner_ipv4 == self.proxy_ipv4:
            _deny()
        self.expires_at_ms, self.deployment_revision = expires_at_ms, deployment_revision
        self.service_pair_reader.assert_transport(policy, self.owner_ipv4, self.proxy_ipv4, expires_at_ms, deployment_revision)
        self.now_ms = now_ms or (lambda: time.time_ns() // 1000000)
        self._state = threading.RLock()
        self._locks = {name: threading.Lock() for name in ("operation", "capture", "admission")}
        self._connections, self._sockets = {}, set()
        self._channel_sockets = {name: set() for name in self._locks}
        self._connection_generations = {}
        self._sent_channels = {}
        self._attempts = {}
        self._resets = []
        self._reset_listeners, self._close_listeners, self._install_listeners = [], [], []
        self._retired = self._closed = False
        self._unsubscribe_close = self.pair_lease.subscribe_generation_close(self._close_generation)
        self._unsubscribe_install = self.pair_lease.subscribe_generation_install(self._install_generation)
        self.pair_lease.set_warmup(self._warm)

    @property
    def policy(self):
        with self._state:
            return self._policy

    @property
    def generation(self):
        return self.pair_lease.generation

    @property
    def available(self):
        context = self.material.context
        return (not self._closed and not self._retired and self.pair_lease.available and self.now_ms() < self.expires_at_ms
                and context.minimum_version == ssl.TLSVersion.TLSv1_3
                and context.maximum_version == ssl.TLSVersion.TLSv1_3
                and context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname is True)

    @property
    def ready(self):
        return self.available and self.pair_lease.ready

    def subscribe_generation_close(self, callback):
        return self._subscribe(self._close_listeners, callback)

    def subscribe_generation_install(self, callback):
        return self._subscribe(self._install_listeners, callback)

    def subscribe_carrier_reset(self, callback):
        return self._subscribe(self._reset_listeners, callback)

    def _subscribe(self, listeners, callback):
        if not callable(callback):
            _deny()
        with self._state:
            listeners.append(callback)
        def remove():
            with self._state:
                if callback in listeners:
                    listeners.remove(callback)
        return remove

    @staticmethod
    def _close_owned(sockets, connections):
        for sock in sockets:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except (OSError, AttributeError):
                pass
        # HTTPResponse owns a makefile reference; close it as well as its socket.
        for connection in connections:
            try:
                connection.close()
            except Exception:
                pass
        for sock in sockets:
            try:
                sock.close()
            except (OSError, AttributeError):
                pass

    def _close_generation(self, generation):
        with self._state:
            sockets, connections = tuple(self._sockets), tuple(self._connections.values())
            self._sockets.clear()
            self._connections.clear()
            self._connection_generations.clear()
            self._sent_channels.clear()
            for owned in self._channel_sockets.values():
                owned.clear()
            callbacks = tuple(self._close_listeners)
        self._close_owned(sockets, connections)
        for callback in callbacks:
            callback(generation)

    def _install_generation(self, generation):
        lease = self.pair_lease.current
        with self._state:
            self._policy = replace(self._policy, owner_task_arn=lease.owner.task_arn,
                                   proxy_task_arn=lease.proxy.task_arn)
            self.owner_ipv4, self.proxy_ipv4 = lease.owner.ip, lease.proxy.ip
            callbacks = tuple(self._install_listeners)
        for callback in callbacks:
            callback(generation)

    def abort(self, reason='PAIR_DRIFT'):
        self._retired = True
        self.pair_lease.retire(reason)

    def close(self):
        self._closed = True
        self.pair_lease.stop()
        self._unsubscribe_close()
        self._unsubscribe_install()

    def reset(self, channel, *, expected_connection=None, expected_attempt=None):
        if channel not in self._locks:
            _deny()
        with self._state:
            connection = self._connections.get(channel)
            if expected_connection is not None and expected_connection is not connection:
                return
            if expected_attempt is not None and self._attempts.get(channel) is not expected_attempt:
                return
            sockets = tuple(self._channel_sockets[channel])
            if connection is None and not sockets:
                return
            sent_connection = self._sent_channels.pop(channel, None)
            sent = connection is not None and sent_connection is connection
            self._connections.pop(channel, None)
            self._connection_generations.pop(channel, None)
            self._channel_sockets[channel].clear()
            self._sockets.difference_update(sockets)
            at = time.monotonic()*1000
            self._resets = [stamp for stamp in self._resets if at-stamp < CARRIER_RESET_WINDOW_MS]
            # TCP/TLS warmup failures have sent no application frame. Closing
            # those attempts must not spend the timeout-after-send reset quota.
            if sent:
                self._resets.append(at)
            exceeded = len(self._resets) > CARRIER_RESETS_PER_MIN
            callbacks = tuple(self._reset_listeners)
        self._close_owned(sockets, (connection,) if connection is not None else ())
        for callback in callbacks:
            callback(channel)
        if exceeded:
            self.abort('CARRIER_RESET_LIMIT')

    def _remaining(self, cutoff, *, warmup=False):
        at = self.now_ms()
        # Re-proof may recover after its readiness window; warmup keeps trying.
        live = not self._closed and not self._retired and self.pair_lease.available if warmup else self.available
        if type(at) is not int or not live or at >= cutoff:
            raise PairProofError('PAIR_UNAVAILABLE')
        return (cutoff-at)/1000

    def _register(self, sock, channel=None, generation=None):
        with self._state:
            if self._closed or self._retired:
                sock.close()
                _deny()
            self._sockets.add(sock)
            if channel is not None:
                self._channel_sockets[channel].add(sock)
        if generation is not None:
            self.pair_lease.require(generation=generation, allow_reproving=True)

    def _evidence(self, sock, *, lease=None, policy=None):
        policy = policy or self.policy
        owner_ip, proxy_ip = (lease.owner.ip, lease.proxy.ip) if lease is not None else (self.owner_ipv4, self.proxy_ipv4)
        if (not isinstance(sock, ssl.SSLSocket) or sock.fileno() < 0
                or sock.version() != "TLSv1.3" or sock.selected_alpn_protocol() != "http/1.1"
                or sock.getpeername() != (owner_ip, 8444) or sock.getsockname()[0] != proxy_ip):
            _deny()
        leaf, chain = sock.getpeercert(binary_form=True), sock.get_verified_chain()
        if (type(leaf) is not bytes or hashlib.sha256(leaf).hexdigest() != policy.server_cert_sha256
                or type(chain) is not list or not 2 <= len(chain) <= 4
                or hashlib.sha256(chain[-1]).hexdigest() != policy.server_issuer_sha256):
            _deny()
        return OwnerTlsEvidence(policy.origin, policy.server_name, policy.owner_task_arn,
            policy.proxy_task_arn, hashlib.sha256(leaf).hexdigest(), hashlib.sha256(chain[-1]).hexdigest(),
            self.material.client_cert_sha256, policy.client_subject, sock.version(),
            sock.selected_alpn_protocol(), f"tls_{id(sock):x}")

    def _connect(self, channel, cutoff, *, warmup=False):
        if not hasattr(ssl.SSLSocket, "get_verified_chain"):
            _deny()
        lease = self.pair_lease.require(deadline_ms=cutoff, allow_reproving=warmup)
        policy = self.policy
        raw = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._register(raw, channel, lease.generation)
        raw.settimeout(self._remaining(cutoff, warmup=warmup))
        raw.bind((lease.proxy.ip, 0))
        raw.connect((lease.owner.ip, 8444))
        tls = self.material.context.wrap_socket(raw, server_hostname=policy.server_name,
                                                 do_handshake_on_connect=False)
        self._register(tls, channel, lease.generation)
        tls.settimeout(self._remaining(cutoff, warmup=warmup))
        tls.do_handshake()
        self._evidence(tls, lease=lease, policy=policy)
        # The only proof that binds this socket STARTS after this handshake.
        self.pair_lease.prove_socket(lease, owner_ip=tls.getpeername()[0],
            proxy_ip=tls.getsockname()[0], deadline_ms=cutoff)
        self._remaining(cutoff, warmup=warmup)
        connection = http.client.HTTPConnection(policy.server_name, 8444,
                                                 timeout=self._remaining(cutoff, warmup=warmup))
        connection.sock = tls
        connection.auto_open = 0  # A closed carrier must never let HTTPConnection bypass pinned TLS.
        with self._state:
            self._connections[channel] = connection
            self._connection_generations[channel] = lease.generation
        self.pair_lease.require(generation=lease.generation, allow_reproving=True)
        self.pair_lease.socket_ready(lease.generation)
        return connection

    def _warm(self):
        for channel in self._locks:
            if not self._locks[channel].acquire(blocking=False):
                continue
            try:
                if channel not in self._connections:
                    cutoff = min(self.expires_at_ms, self.now_ms()+self.policy.max_exchange_ms)
                    self._connect(channel, cutoff, warmup=True)
            except BaseException:
                self.reset(channel)
                raise
            finally:
                self._locks[channel].release()

    def start(self):
        self.pair_lease.start()

    def _send(self, channel, path, body, cutoff, cancelled=None):
        began, acquired, step = time.monotonic(), False, "lock"
        cancelled = cancelled or threading.Event()
        attempt, connection = cancelled, None
        try:
            acquired = self._locks[channel].acquire(timeout=self._remaining(cutoff))
            if not acquired or cancelled.is_set():
                raise OwnerExchangeUnavailable()
            with self._state:
                self._attempts[channel] = attempt
            step = "lease"
            lease = self.pair_lease.require(deadline_ms=cutoff)
            step = "connect"
            connection = self._connections.get(channel) or self._connect(channel, cutoff)
            generation = self._connection_generations.get(channel)
            self.pair_lease.require(generation=generation)
            if generation != lease.generation or cancelled.is_set():
                raise PairProofError('PAIR_REPROVING')
            sock = connection.sock
            evidence = self._evidence(sock)
            sock.settimeout(self._remaining(cutoff))
            step = "request"; diagnostics.stage("exchange-wait")
            with self._state:
                # Mark before the native write: an exception can follow a
                # partial write, which never proves that nothing was sent.
                self._sent_channels[channel] = connection
            connection.request("POST", path, body=body, headers={
                "host": f"{self.policy.server_name}:8444", "content-type": "application/json",
                "content-length": str(len(body)), "accept-encoding": "identity", "connection": "keep-alive"})
            response = connection.getresponse()
            step = "reply-status"
            length = validate_owner_http_reply(response.status, response.getheaders(),
                                               expected_revision=self.deployment_revision)
            if response.version != 11 or response.will_close:
                _deny()
            step = "reply-read"
            value = response.read(length+1)
            if len(value) != length or response.length not in (0, None):
                _deny()
            # The reply is usable only while its socket-bound lease remains valid.
            self.pair_lease.require(generation=generation)
            self._remaining(cutoff)
            if cancelled.is_set() or self._evidence(sock) != evidence:
                _deny()
            return OwnerReply(value, evidence)
        except BaseException as error:
            diagnostics.refused("exchange", step, error, deadline_ms=cutoff, now_ms=self.now_ms)
            if acquired and step not in ("lock", "lease"):
                self.reset(channel, expected_attempt=attempt)
            if isinstance(error, PairProofError):
                if error.code == 'PAIR_DRIFT':
                    self.abort()
                raise
            if isinstance(error, (TimeoutError, OSError, http.client.HTTPException)):
                raise OwnerExchangeUnavailable() from None
            raise
        finally:
            telemetry.count("ownerExchanges", channel, {OPEN: "OPEN", OPERATION: "OPERATION", POLL: "POLL", REPLY: "REPLY"}.get(path), (time.monotonic() - began) * 1000)
            if acquired:
                with self._state:
                    if self._attempts.get(channel) is attempt:
                        self._attempts.pop(channel, None)
                self._locks[channel].release()

    async def __call__(self, channel, path, body, timeout):
        if (channel not in self._locks or path not in (OPEN, OPERATION, POLL, REPLY)
                or path == OPEN and channel != "operation" or path in (POLL, REPLY) and channel != "capture"
                or channel == "admission" and path != OPERATION
                or type(body) is not bytes or not 1 <= len(body) <= 12*1024*1024
                or type(timeout) not in (int, float) or not math.isfinite(timeout)
                or not 0 < timeout <= self.policy.max_exchange_ms/1000):
            _deny()
        reads = {"capture": ("meri.proxy.admission-read/1",),
                 "admission": ("meri.proxy.admission-read/1", "meri.proxy.placement-read/1")}
        if channel in reads and path == OPERATION:
            try:
                frame = json.loads(body)
                if (type(frame) is not list or not frame or frame[0] not in reads[channel]
                        or len(frame) != (5 if frame[0] == "meri.proxy.admission-read/1" else 4)):
                    _deny()
            except (ValueError, TypeError, UnicodeError):
                _deny()
        cutoff = min(self.expires_at_ms, self.now_ms()+max(1, int(timeout*1000)))
        cancelled = threading.Event()
        # The native socket timeout is the primary bound. The event prevents a
        # queued native worker from sending after cancellation; reset releases I/O.
        try:
            return await asyncio.wait_for(asyncio.to_thread(self._send, channel, path, body, cutoff, cancelled),
                                          self._remaining(cutoff))
        except BaseException as error:
            cancelled.set()
            self.reset(channel, expected_attempt=cancelled)
            diagnostics.refused("exchange", "call", error, deadline_ms=cutoff, now_ms=self.now_ms)
            if isinstance(error, TimeoutError):
                raise OwnerExchangeUnavailable() from None
            raise
