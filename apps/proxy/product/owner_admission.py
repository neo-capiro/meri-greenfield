"""Unmounted product admission reader over the existing owner operation channel.

No SQL, socket, listener, credential or placement authority is created. Transport
evidence from a callback is not live mTLS authentication. Trusted startup must
provide that real exchange and an independently trusted IssuedTaskNetwork.
"""
import asyncio
from dataclasses import dataclass, replace
import hashlib
import inspect
import json
import re
import threading
import time
import uuid

from .owner_channel import (OPERATION, OwnerPeerPolicy, OwnerReply, OwnerHostGate,
                            owner_exchange_state, validate_owner_reply,
                            admission_carrier, validate_capture_admission_lease)
from .bearer_eni_admission import IssuedTaskNetwork, ProductBearerSource
from .binding import _binding as checked_binding
from ..qualification.state.pricing import StateDenied


def _deny():
    raise StateDenied("PRODUCT_OWNER_ADMISSION_DENIED")


def _tuple(value, size):
    if type(value) is not list or len(value) != size:
        _deny()
    return value


def _integer(value, minimum=0):
    if type(value) is not int or not minimum <= value <= 9007199254740991:
        _deny()
    return value


def _sha(value):
    if type(value) is not str or re.fullmatch(r"[0-9a-f]{64}", value) is None:
        _deny()
    return value


def _json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8", "strict")


def _hash(value):
    return hashlib.sha256(_json(value)).hexdigest()


def _binding(value):
    names = ("tenantId", "actorId", "conversationId", "runId", "attemptId", "workerId", "writerFence")
    return checked_binding(dict(zip(names, _tuple(value, 7))))


def _source(value):
    s = _tuple(value, 8)
    binding = _binding(s[0])
    q, original, resource = _tuple(s[3], 5), _tuple(s[4], 5), _tuple(s[5], 5)
    _sha(s[2]); _sha(s[6]); _sha(q[4]); _sha(original[0]); _sha(original[1]); _sha(original[2])
    _integer(q[1], 1); _integer(q[3], 1); _integer(original[3], 1); _integer(resource[1], 1)
    if (q[0] != binding["runId"] or q[3] != binding["writerFence"] or resource[0] != q[2]
            or original[0] != _hash(binding) or original[1] != original[0]
            or type(original[4]) is not str or re.fullmatch(r"sha256:[0-9a-f]{64}", original[4]) is None
            or resource[1] >= original[3]
            or any(type(resource[n]) is not str or not 1 <= len(resource[n]) <= 512 for n in (0, 2, 3, 4))
            or type(s[1]) is not str or re.fullmatch(r"[0-9a-f-]{36}", s[1]) is None
            or type(s[7]) is not str or re.fullmatch(r"[0-9a-f-]{36}", s[7]) is None):
        _deny()
    return binding


@dataclass(frozen=True)
class _VerifiedAdmission:
    read_id: str
    source_bytes: bytes
    checked_at_ms: int
    expires_at_ms: int
    capture_lease: object
    currentness_bytes: bytes


class ProductOwnerAdmissionReader:
    """Loop-owned reader with synchronous facades for existing admission threads.

    Construct on the explicitly borrowed running owner loop. Synchronous methods
    refuse that loop's thread. All waiting, including operation-lock contention,
    shares one original absolute deadline. Unknown work retires the exchange.
    The real exchange's synchronous abort() MUST be thread-safe from both this
    loop and a foreign admission thread and permanently retire both connections.
    An awaitable/loop-only close is insufficient. No such TLS transport or
    physical-stop proof is supplied by this source interface.
    """
    def __init__(self, *, policy, exchange, host_gate, owner_loop,
                 now_ms=None, max_exchange_ms=3000):
        if (type(policy) is not OwnerPeerPolicy or type(host_gate) is not OwnerHostGate
                or not host_gate.available or not callable(exchange)
                or not callable(getattr(exchange, "abort", None))
                or inspect.iscoroutinefunction(exchange.abort)
                or asyncio.get_running_loop() is not owner_loop or not owner_loop.is_running()
                or type(max_exchange_ms) is not int or not 1 <= max_exchange_ms <= policy.max_exchange_ms):
            _deny()
        self.policy, self.exchange, self.host_gate = policy, exchange, host_gate
        self.loop, self.loop_thread = owner_loop, threading.get_ident()
        self.now_ms = now_ms or (lambda: time.time_ns() // 1_000_000)
        if not callable(self.now_ms):
            _deny()
        self.max_exchange_ms = max_exchange_ms
        self.state = owner_exchange_state(exchange, policy, host_gate)
        self._receipts, self._read_ids = {}, set()
        self._initial_caps = {}
        self._pending_tasks = set()

    def _abort(self):
        self.host_gate.poison()
        try:
            result = self.exchange.abort()
            if inspect.isawaitable(result):
                if inspect.iscoroutine(result):
                    result.close()
        except Exception:
            pass

    def _remaining(self, cutoff):
        at = _integer(self.now_ms())
        if not self.host_gate.available or at >= cutoff:
            _deny()
        return (cutoff - at) / 1000

    async def _read(self, read_id, capability_sha256, expected, started, cutoff, carrier, lease):
        acquired = False
        task = asyncio.current_task()
        self._pending_tasks.add(task)
        def finished(value):
            self._pending_tasks.discard(value)
            if not value.cancelled():
                value.exception()  # Observe a late failure after its thread future was cancelled.
        task.add_done_callback(finished)
        def check_carrier():
            if validate_capture_admission_lease(lease, self.exchange, self.host_gate,
                    None if expected is None else _json(expected)) != carrier:
                _deny()
            return self._remaining(cutoff)
        try:
            if read_id in self._read_ids or len(self._read_ids) >= 4096:
                _deny()
            self._read_ids.add(read_id)
            await asyncio.wait_for(self.state[3][carrier].acquire(), check_carrier())
            acquired = True
            check_carrier()
            body = _json(["meri.proxy.admission-read/1", read_id, capability_sha256,
                          None if expected is None else _hash(expected), cutoff])
            reply = await asyncio.wait_for(
                self.exchange(carrier, OPERATION, body, check_carrier()),
                check_carrier())
            check_carrier()
            if type(reply) is not OwnerReply or type(reply.body) is not bytes or len(reply.body) > 16384:
                _deny()
            frame = validate_owner_reply(self.policy, reply, carrier, self.state[4])
            _tuple(frame, 8)
            if frame[:3] != ["meri.proxy.admission/1", read_id, capability_sha256]:
                _deny()
            binding = _source(frame[4])
            if frame[4][2] != capability_sha256 or _sha(frame[3]) != _hash(frame[4]):
                _deny()
            if expected is not None and _json(expected) != _json(frame[4]):
                _deny()
            current = _tuple(frame[5], 7)
            _sha(current[0]); _sha(current[4]); _binding(current[1])
            scopes = [["client", binding["tenantId"], frame[4][7], frame[4][3][4]]]
            at = _integer(self.now_ms())
            if (current[1] != frame[4][0] or current[2] != scopes or current[3] != frame[4][7]
                    or not started <= _integer(current[5]) <= at
                    or not started <= _integer(frame[6]) <= at
                    or _integer(frame[7], 1) <= at or frame[7] > cutoff
                    or frame[7] > _integer(current[6], 1) or frame[7] > frame[4][4][3]):
                _deny()
            check_carrier()
            result = _VerifiedAdmission(read_id, _json(frame[4]), frame[6], frame[7], lease, _json(current))
            self._receipts[id(result)] = result
            return result
        except BaseException:
            self._abort()
            raise
        finally:
            if acquired:
                self.state[3][carrier].release()

    def _sync_read(self, capability_sha256, expected, deadline_ms):
        if threading.get_ident() == self.loop_thread or self.loop.is_closed() or not self.loop.is_running():
            _deny()
        started = _integer(self.now_ms())
        cutoff = min(_integer(deadline_ms, 1), started + self.max_exchange_ms)
        carrier, lease = admission_carrier(self.exchange, self.host_gate,
                                           None if expected is None else _json(expected))
        if lease is not None:
            cutoff = min(cutoff, lease.deadline_ms)
        self._remaining(cutoff)
        read_id = uuid.uuid4().hex
        coroutine = self._read(read_id, _sha(capability_sha256), expected, started, cutoff, carrier, lease)
        try:
            future = asyncio.run_coroutine_threadsafe(coroutine, self.loop)
        except BaseException:
            coroutine.close()
            self._abort()
            _deny()
        try:
            result = future.result(timeout=self._remaining(cutoff))
            validate_capture_admission_lease(lease, self.exchange, self.host_gate,
                None if expected is None else _json(expected))
            return result
        except BaseException:
            self._abort(); future.cancel()
            _deny()

    def _consume(self, receipt, expected=None):
        if (type(receipt) is not _VerifiedAdmission
                or self._receipts.pop(id(receipt), None) is not receipt
                or not self.host_gate.available or receipt.expires_at_ms <= self.now_ms()
                or expected is not None and receipt.source_bytes != _json(expected)):
            _deny()
        validate_capture_admission_lease(receipt.capture_lease, self.exchange,
            self.host_gate, receipt.source_bytes)
        return json.loads(receipt.source_bytes)

    def resolve_for_issued_sync(self, *, issued, capability_sha256, deadline_ms):
        if type(issued) is not IssuedTaskNetwork:
            _deny()
        # Snapshot before any await; the frozen issued object contains a mutable dict.
        execution = dict(issued.execution_binding)
        receipt = self._sync_read(capability_sha256, None, min(deadline_ms, issued.expires_at_ms))
        source = self._consume(receipt)
        q, original, resource = source[3], source[4], source[5]
        if (_binding(source[0]) != execution or source[1] != issued.grant_id
                or q != [issued.binding.run_id, issued.binding.attempt, issued.binding.worker_arn,
                         issued.binding.fence, issued.binding.policy_revision]
                or resource != [issued.binding.worker_arn, issued.created_at_ms, issued.cluster_arn,
                                issued.task_definition_arn, issued.container_name]
                or original != [issued.started_by, issued.started_by, dict(issued.tags)["meri:plan-sha256"],
                                issued.expires_at_ms, issued.image_digest]):
            self._abort(); _deny()
        # The immutable issuance cap is distinct from this read's short lease.
        # A later check must read again; it may never extend the original cap.
        self._initial_caps[_hash(source)] = issued.expires_at_ms
        encoded = _json(source)
        previous = self.state[5].get(capability_sha256)
        if previous is not None and previous != encoded:
            self._abort(); _deny()
        self.state[5][capability_sha256] = encoded
        from ..qualification.state.admission import GrantAdmission
        authority = GrantAdmission.from_product_owner(
            reader=self, expected_source=source, expires_at_ms=self._initial_caps[_hash(source)])
        return ProductBearerSource(authority, replace(issued, execution_binding=execution))

    def _bind(self, expected_source, expires_at_ms):
        _source(expected_source)
        encoded = _json(expected_source)
        cap = self._initial_caps.get(_hash(expected_source))
        if cap is None or _integer(expires_at_ms, 1) > cap:
            _deny()
        return encoded

    def check_current_sync(self, expected_source, expires_at_ms):
        expected = json.loads(expected_source)  # immutable bytes owned by GrantAdmission
        receipt = self._sync_read(expected[2], expected, expires_at_ms)
        self._consume(receipt, expected)
        return None

    def read_current_conversation_sync(self, expected_source, expires_at_ms):
        """Fresh seven-field Core receipt, never a cached authorization result."""
        expected = json.loads(expected_source)
        receipt = self._sync_read(expected[2], expected, expires_at_ms)
        self._consume(receipt, expected)
        value = json.loads(receipt.currentness_bytes)
        return {"identitySha256": value[0], "binding": _binding(value[1]),
                "scopes": [dict(zip(("kind", "tenantId", "resourceId", "policyRevision"), row))
                           for row in value[2]], "selectedClientId": value[3],
                "contextRevision": value[4], "checkedAtMs": value[5],
                "expiresAtMs": min(value[6], receipt.expires_at_ms)}
