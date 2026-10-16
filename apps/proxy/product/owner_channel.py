"""One-request proxy side of the unmounted private HTTPS :8444 owner channel.

The injected exchange port MUST use two dedicated, pinned-mTLS connections:
operation claims on one and fresh host capture on another. Evidence returned
by an arbitrary callback is not TLS authentication. No client, credential,
listener or network request is created by this module.
"""
import asyncio
from dataclasses import dataclass
import hashlib
import hmac
import inspect
import json
import re
import threading
import time

from ..qualification.state.pricing import StateDenied
from .boundary_codec import (_binding, _wire, encode_complete_capture,
                             encode_reservation, encode_settlement)
from .host_observation import _binding as _host_binding
from .response_settlement import SettlementCommitUncertain


OPEN = "/v1/internal/product-model/owner/session/open"
OPERATION = "/v1/internal/product-model/owner/operation"
POLL = "/v1/internal/product-model/owner/capture/poll"
REPLY = "/v1/internal/product-model/owner/capture/reply"
_WIRE_MAX = 12 * 1024 * 1024
_SLOT = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_SHA = re.compile(r"[0-9a-f]{64}\Z")
_ORIGIN = re.compile(r"https://[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?:8444\Z")
_SERVICE_GATES = {}
_SERVICE_GATES_LOCK = threading.Lock()


def _deny():
    raise StateDenied("PRODUCT_OWNER_CHANNEL_DENIED")


def _slot(value):
    if type(value) is not str or not _SLOT.fullmatch(value):
        _deny()
    return value


def _sha(value):
    if type(value) is not str or not _SHA.fullmatch(value):
        _deny()
    return value


def _frame(raw):
    if type(raw) is not bytes or not 1 <= len(raw) <= _WIRE_MAX:
        _deny()
    try:
        value = json.loads(raw.decode("utf-8", "strict"))
    except (UnicodeError, ValueError, TypeError):
        _deny()

    def check(item, depth):
        if depth > 10:
            _deny()
        if type(item) is list:
            if len(item) > 128:
                _deny()
            for child in item:
                check(child, depth + 1)
        elif type(item) is str:
            if len(item) > _WIRE_MAX:
                _deny()
        elif type(item) is int:
            if not -9007199254740991 <= item <= 9007199254740991:
                _deny()
        elif item is not True and item is not False and item is not None:
            _deny()
    check(value, 0)
    if type(value) is not list:
        _deny()
    return value


@dataclass(frozen=True)
class OwnerPeerPolicy:
    origin: str
    server_name: str
    owner_task_arn: str
    proxy_task_arn: str
    server_cert_sha256: str
    server_issuer_sha256: str
    client_cert_sha256: str
    client_subject: str
    max_exchange_ms: int = 3000

    def __post_init__(self):
        if (type(self.origin) is not str or not _ORIGIN.fullmatch(self.origin)
                or type(self.server_name) is not str
                or self.origin != f"https://{self.server_name}:8444"
                or any(type(value) is not str or not 1 <= len(value) <= 512
                       for value in (self.owner_task_arn, self.proxy_task_arn))
                or self.owner_task_arn == self.proxy_task_arn
                or type(self.client_subject) is not str
                or not 1 <= len(self.client_subject) <= 256
                or type(self.max_exchange_ms) is not int
                or not 1 <= self.max_exchange_ms <= 30000):
            _deny()
        for value in (self.server_cert_sha256, self.server_issuer_sha256,
                      self.client_cert_sha256):
            _sha(value)


@dataclass(frozen=True)
class OwnerTlsEvidence:
    """Only the reviewed mTLS transport may construct this from its TLS peer."""
    origin: str
    server_name: str
    owner_task_arn: str
    proxy_task_arn: str
    server_cert_sha256: str
    server_issuer_sha256: str
    client_cert_sha256: str
    client_subject: str
    tls_version: str
    alpn: str
    connection_id: str


@dataclass(frozen=True)
class OwnerReply:
    body: bytes
    evidence: OwnerTlsEvidence
    status: int = 200
    content_type: str = "application/json"


class OwnerHostGate:
    """One shared, process-lifetime fail-closed gate for all host sessions."""

    def __init__(self):
        self._available = True

    @property
    def available(self):
        return self._available

    def poison(self):
        self._available = False


class ProductOwnerBridge:
    """Single-use bridge accepted by ProductSession.make_owner_bridge.

    `exchange(channel, path, body, timeout_seconds)` must authenticate the
    exact fixed HTTPS origin and the mTLS client/server material, return
    transport-derived TLS evidence, enforce no redirects/cache/retries, and
    keep a distinct persistent TLS connection for each channel. It must have
    its own independent I/O bound. Its synchronous `abort()` must immediately
    close and permanently retire both connections; a timed-out Python task
    cannot guarantee cancellation of socket I/O. The owner reauthenticates both.
    """

    def __init__(self, *, policy, exchange, capture_call, host_gate, request_id,
                 binding, deadline_ms, grant_id, capability_sha256, now_ms=None):
        if (type(policy) is not OwnerPeerPolicy or not callable(exchange)
                or not callable(getattr(exchange, "abort", None))
                or inspect.iscoroutinefunction(exchange.abort)
                or type(host_gate) is not OwnerHostGate or not host_gate.available
                or not callable(capture_call) or not callable(now_ms or time.time_ns)
                or type(deadline_ms) is not int or not 0 < deadline_ms <= 9007199254740991):
            _deny()
        # Stable task and fixed-origin identity outlives a send. A different
        # timeout or rotated cert cannot supply a fresh gate for the same
        # owner/proxy service pair while old host work remains unresolved.
        gate_key = (policy.origin, policy.owner_task_arn, policy.proxy_task_arn)
        with _SERVICE_GATES_LOCK:
            existing = _SERVICE_GATES.get(gate_key)
            if existing is not None and existing is not host_gate:
                _deny()
            _SERVICE_GATES[gate_key] = host_gate
        self.policy, self.exchange, self.capture_call = policy, exchange, capture_call
        self.host_gate = host_gate
        self.request_id, self.binding = _slot(request_id), _host_binding(binding)
        self.deadline_ms, self.grant_id = deadline_ms, _slot(grant_id)
        self.capability_sha256 = _sha(capability_sha256)
        self.now_ms = now_ms or (lambda: time.time_ns() // 1_000_000)
        self.session_id = None
        self._operation_connection = self._capture_connection = None
        self._complete_capture = None
        self._capture_token = None
        self._aborted = False
        self._state = "NEW"

    def _abort(self):
        self._state = "FAILED"
        self._capture_token = None
        self.host_gate.poison()
        if self._aborted:
            return
        self._aborted = True
        try:
            result = self.exchange.abort()
            if inspect.isawaitable(result):
                if inspect.iscoroutine(result):
                    result.close()
                _deny()
        except Exception:
            # Never turn a broken close into permission to reuse a channel.
            pass

    def _remaining(self):
        if not self.host_gate.available:
            _deny()
        at = self.now_ms()
        if type(at) is not int or at >= self.deadline_ms:
            _deny()
        return min(self.policy.max_exchange_ms, self.deadline_ms - at) / 1000

    def _peer(self, evidence, channel):
        p = self.policy
        if type(evidence) is not OwnerTlsEvidence or any((
                type(value) is not str for value in vars(evidence).values())):
            _deny()
        if (evidence.origin != p.origin or evidence.server_name != p.server_name
                or evidence.owner_task_arn != p.owner_task_arn
                or evidence.proxy_task_arn != p.proxy_task_arn
                or evidence.client_subject != p.client_subject
                or evidence.tls_version != "TLSv1.3" or evidence.alpn != "http/1.1"):
            _deny()
        for actual, expected in ((evidence.server_cert_sha256, p.server_cert_sha256),
                                 (evidence.server_issuer_sha256, p.server_issuer_sha256),
                                 (evidence.client_cert_sha256, p.client_cert_sha256)):
            if not hmac.compare_digest(_sha(actual), expected):
                _deny()
        ident = _slot(evidence.connection_id)
        if channel == "operation":
            if self._operation_connection is None:
                self._operation_connection = ident
            elif self._operation_connection != ident:
                _deny()
            if ident == self._capture_connection:
                _deny()
        elif channel == "capture":
            if self._capture_connection is None:
                self._capture_connection = ident
            elif self._capture_connection != ident:
                _deny()
            if ident == self._operation_connection:
                _deny()
        else:
            _deny()

    async def _exchange(self, channel, path, body):
        if (path not in (OPEN, OPERATION, POLL, REPLY)
                or (channel == "operation") != (path in (OPEN, OPERATION))
                or type(body) is not bytes or not 1 <= len(body) <= _WIRE_MAX):
            _deny()
        timeout = self._remaining()
        task = asyncio.create_task(self.exchange(channel, path, body, timeout))
        try:
            done, _ = await asyncio.wait({task}, timeout=timeout)
            if not done:
                _deny()
            result = task.result()
            if (type(result) is not OwnerReply or result.status != 200
                    or result.content_type != "application/json"):
                _deny()
            self._peer(result.evidence, channel)
            self._remaining()
            return _frame(result.body)
        except BaseException:
            self._abort()
            task.cancel()
            if task.done():
                try:
                    task.result()
                except BaseException:
                    pass
            else:
                task.add_done_callback(
                    lambda item: item.exception() if not item.cancelled() else None)
            raise

    def _matches(self, request):
        return (type(request) is dict and set(request) == {
            "requestId", "binding", "deadlineMs"}
            and request == {"requestId": self.request_id,
                            "binding": self.binding, "deadlineMs": self.deadline_ms})

    async def _open(self):
        body = _wire(["meri.proxy.session-open/1", self.request_id,
                      self.capability_sha256, _binding(self.binding), self.deadline_ms])
        result = await self._exchange("operation", OPEN, body)
        if (len(result) != 4 or result[0] != "meri.proxy.session/1"
                or result[2:] != [self.request_id, self.capability_sha256]):
            _deny()
        self.session_id = _slot(result[1])

    async def _capture(self, kind, token):
        if self._capture_token is not token:
            _deny()
        challenge = await self._exchange("capture", POLL, _wire([
            "meri.proxy.capture-poll/1", self.session_id, self.request_id, kind]))
        if self._capture_token is not token:
            _deny()
        if kind == "call":
            if (len(challenge) != 4 or challenge[0] != "meri.proxy.capture-call/1"
                    or challenge[1:] != [self.request_id, _binding(self.binding),
                                          self.deadline_ms]):
                _deny()
            source = self.capture_call({"requestId": self.request_id,
                                        "binding": self.binding.copy(),
                                        "deadlineMs": self.deadline_ms})
            if not inspect.isawaitable(source):
                _deny()
            captured = await source
            if self._capture_token is not token:
                _deny()
            value = {"requestId": self.request_id, "binding": self.binding,
                     "deadlineMs": self.deadline_ms}
            frame = encode_reservation(value, captured)
        elif kind == "complete":
            if (len(challenge) != 4 or challenge[0] != "meri.proxy.capture-complete/1"
                    or challenge[1:] != [self.request_id, _binding(self.binding), self.grant_id]
                    or not callable(self._complete_capture)):
                _deny()
            source = self._complete_capture({"requestId": self.request_id,
                                             "binding": self.binding.copy(),
                                             "grantId": self.grant_id})
            if not inspect.isawaitable(source):
                _deny()
            captured = await source
            if self._capture_token is not token:
                _deny()
            frame = encode_complete_capture(self.request_id, captured)
        else:
            _deny()
        if self._capture_token is not token:
            _deny()
        acknowledgement = await self._exchange("capture", REPLY, _wire([
            "meri.proxy.capture-reply/1", self.session_id,
            json.loads(frame.decode("ascii"))]))
        if acknowledgement != ["meri.proxy.capture-ack/1", self.session_id,
                               self.request_id, kind]:
            _deny()

    async def _operation(self, claim, kind):
        token = object()
        if self._capture_token is not None:
            _deny()
        self._capture_token = token
        capture = asyncio.create_task(self._capture(kind, token))
        try:
            result = await self._exchange("operation", OPERATION, _wire([
                "meri.proxy.operation/1", self.session_id,
                json.loads(claim.decode("ascii"))]))
            done, _ = await asyncio.wait({capture}, timeout=self._remaining())
            if not done:
                _deny()
            capture.result()
            return result
        except BaseException:
            self._abort()
            capture.cancel()
            if capture.done():
                try:
                    capture.result()
                except BaseException:
                    pass
            else:
                capture.add_done_callback(
                    lambda item: item.exception() if not item.cancelled() else None)
            raise
        finally:
            self._capture_token = None

    async def reserve(self, value, observation):
        if self._state != "NEW" or not self.host_gate.available or not self._matches(value):
            _deny()
        self._state = "FAILED"
        try:
            claim = encode_reservation(value, observation)
            # The open selector is derived from the host-observed credential;
            # a caller supplied digest cannot select a foreign persisted grant.
            credential = observation["proxyCredential"]
            if not hmac.compare_digest(
                    hashlib.sha256(credential.encode("utf-8")).hexdigest(),
                    self.capability_sha256):
                _deny()
            await self._open()
            result = await self._operation(claim, "call")
            if (len(result) != 3 or result[:2] != [
                    "meri.proxy.reservation-receipt/1", self.session_id]
                    or type(result[2]) is not list or len(result[2]) != 3
                    or result[2][0] != self.request_id or result[2][2] != "UNKNOWN"):
                _deny()
            receipt = {"requestId": self.request_id,
                       "nativeBodySha256": _sha(result[2][1]), "state": "UNKNOWN"}
            self._state = "HELD"
            return receipt
        except asyncio.CancelledError:
            self._abort()
            raise
        except Exception:
            self._abort()
            _deny()

    def bind_complete_capture(self, capture):
        if self._state != "HELD" or self._complete_capture is not None or not callable(capture):
            _deny()
        self._complete_capture = capture

    async def settle_complete(self, request_id, result):
        if (self._state != "HELD" or self._complete_capture is None
                or request_id != self.request_id):
            _deny()
        self._state = "FAILED"
        try:
            result_frame = await self._operation(encode_settlement(request_id, result),
                                                 "complete")
            if result_frame == ["meri.proxy.commit-uncertain/1", self.session_id,
                                self.request_id]:
                self._state = "UNCERTAIN"
                raise SettlementCommitUncertain("CANONICAL_SETTLEMENT_ACK_UNKNOWN")
            if result_frame != ["meri.proxy.settlement-receipt/1", self.session_id,
                                [self.request_id, "SETTLED"]]:
                _deny()
            self._state = "SETTLED"
        except SettlementCommitUncertain:
            raise
        except asyncio.CancelledError:
            self._abort()
            raise
        except Exception:
            self._abort()
            _deny()

    async def read_outcome(self, request_id):
        if self._state != "UNCERTAIN" or request_id != self.request_id:
            _deny()
        self._state = "FAILED"
        try:
            result = await self._exchange("operation", OPERATION, _wire([
                "meri.proxy.operation/1", self.session_id,
                ["meri.proxy.outcome/1", self.request_id]]))
            if (len(result) != 3 or result[:2] != [
                    "meri.proxy.outcome-receipt/1", self.session_id]
                    or type(result[2]) is not list or len(result[2]) != 3
                    or result[2][:2] != [self.request_id, "SETTLED"]
                    or type(result[2][2]) is not str
                    or not re.fullmatch(r"(?:0|[1-9][0-9]{0,18})", result[2][2])
                    or int(result[2][2]) > (1 << 63) - 1):
                _deny()
            self._state = "SETTLED"
            return {"requestId": self.request_id, "state": "SETTLED",
                    "actualMicroUSD": result[2][2]}
        except asyncio.CancelledError:
            self._abort()
            raise
        except Exception:
            self._abort()
            _deny()


def make_product_owner_bridge(*, policy, exchange, host_gate, request_id, binding,
                              deadline_ms, grant_id, capability_sha256,
                              now_ms=None):
    """Adapt ProductSession.make_owner_bridge without inventing an HTTP client."""
    def make(capture_call):
        return ProductOwnerBridge(
            policy=policy, exchange=exchange, capture_call=capture_call,
            host_gate=host_gate,
            request_id=request_id, binding=binding, deadline_ms=deadline_ms,
            grant_id=grant_id, capability_sha256=capability_sha256,
            now_ms=now_ms)
    return make
