"""Unmounted product admission reader over the owner's dedicated admission carrier (or a bridge's capture carrier).

No SQL, socket, listener, credential or placement authority is created. Transport
evidence from a callback is not live mTLS authentication. Trusted startup must
provide that real exchange and an independently trusted IssuedTaskNetwork.
"""
import asyncio
from collections import OrderedDict
from dataclasses import dataclass, replace
import hashlib
import inspect
import json
import re
import threading
import time
import uuid
import weakref

from .owner_channel import (OPERATION, OwnerPeerPolicy, OwnerReply, OwnerHostGate, OwnerCarrierBusy,
                            acquire_owner_carrier, owner_exchange_state, validate_owner_reply,
                            admission_carrier, validate_capture_admission_lease)
from .budgets import ADMISSION_LEASE_MS, MIN_OWNER_EXCHANGE_MS, OWNER_CARRIER_WAIT_MS
from .bearer_eni_admission import IssuedTaskNetwork, ProductBearerSource
from .binding import _binding as checked_binding
from . import refusal_diagnostics as diagnostics
from ..qualification.state.pricing import StateDenied


READ_ID_WINDOW = 4096
"""Recent read ids kept to refuse a reused id. Ids are fresh uuid4 values and each reply must echo its own; a window, not a
lifetime cap, so a long-lived proxy (about 30 reads per turn) never runs out of reads."""


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
    read_at_mono: float
    expires_at_mono: float
    generation: int


@dataclass
class _LifetimeAdmission:
    source: bytes
    peer: tuple
    generation: int
    expires_at_ms: int
    receipt: object = None


class ProductOwnerAdmissionReader:
    """Loop-owned reader with synchronous facades for existing admission threads.

    Construct on the explicitly borrowed running owner loop. Synchronous methods
    refuse that loop's thread. All waiting, including operation-lock contention,
    shares one original absolute deadline. A failed read refuses its request;
    the transport owns carrier reset and definitive pair retirement. Reusable
    receipts are bound to one exact RequestLifetime, source, peer and generation.
    No TLS transport or physical-stop proof is supplied by this interface.
    """
    def __init__(self, *, policy, exchange, host_gate, owner_loop,
                 now_ms=None, monotonic=None, max_exchange_ms=3000, max_carrier_wait_ms=OWNER_CARRIER_WAIT_MS):
        if (type(policy) is not OwnerPeerPolicy or type(host_gate) is not OwnerHostGate
                or not host_gate.available or not callable(exchange)
                or not callable(getattr(exchange, "abort", None))
                or inspect.iscoroutinefunction(exchange.abort)
                or asyncio.get_running_loop() is not owner_loop or not owner_loop.is_running()
                or type(max_exchange_ms) is not int or not 1 <= max_exchange_ms <= policy.max_exchange_ms
                or type(max_carrier_wait_ms) is not int or not 1 <= max_carrier_wait_ms <= OWNER_CARRIER_WAIT_MS):
            _deny()
        self.policy, self.exchange, self.host_gate = policy, exchange, host_gate
        self.loop, self.loop_thread = owner_loop, threading.get_ident()
        self.now_ms = now_ms or (lambda: time.time_ns() // 1_000_000)
        self.monotonic = monotonic or time.monotonic
        if not callable(self.now_ms) or not callable(self.monotonic):
            _deny()
        self.max_exchange_ms, self.max_carrier_wait_ms = max_exchange_ms, max_carrier_wait_ms
        self.state = owner_exchange_state(exchange, policy, host_gate)
        self._receipts, self._read_ids = weakref.WeakValueDictionary(), OrderedDict()
        self._initial_caps = {}
        self._pending_tasks = set()
        self.generation = getattr(exchange, "generation", 0)
        self._bootstrap = weakref.WeakKeyDictionary()
        self._lifetimes = weakref.WeakKeyDictionary()
        self._receipt_lifetimes = {}
        self._receipt_lock = threading.RLock()
        self._closed = False
        subscribe = getattr(exchange, "subscribe_generation_close", None)
        self._unsubscribe = subscribe(self._generation_closed) if callable(subscribe) else None

    def _generation_closed(self, generation):
        if generation != self.generation:
            return
        self._closed = True
        # Callbacks may originate in the renewer thread. Deny on the owner loop,
        # while the generation check below invalidates authority synchronously.
        if not self.loop.is_closed():
            for life in list(self._lifetimes):
                self.loop.call_soon_threadsafe(life.deny, "PAIR_REPROVING")
            for task in tuple(self._pending_tasks):
                self.loop.call_soon_threadsafe(task.cancel)
        self._receipts.clear()
        self._receipt_lifetimes.clear()
        self._bootstrap.clear()

    def close(self):
        self._generation_closed(self.generation)
        if callable(self._unsubscribe):
            self._unsubscribe()
        self._unsubscribe = None

    def _generation_current(self):
        return (not self._closed and self.host_gate.available
                and getattr(self.exchange, "generation", 0) == self.generation)

    def _remaining(self, cutoff):
        at = _integer(self.now_ms())
        if not self._generation_current() or at >= cutoff:
            _deny()
        return (cutoff - at) / 1000

    async def _read(self, read_id, capability_sha256, expected, started, deadline, carrier, lease):
        read_at = self.monotonic()
        acquired, step, cutoff = False, "carrier", deadline
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
        with diagnostics.phase("admission" if expected is None else "session"):
            try:
                if read_id in self._read_ids:
                    _deny()
                self._read_ids[read_id] = None
                while len(self._read_ids) > READ_ID_WINDOW:
                    self._read_ids.popitem(last=False)
                # Waiting sends nothing: it is bounded on its own and never spends the exchange budget below.
                wait = min(self.max_carrier_wait_ms / 1000, check_carrier())
                waited = await acquire_owner_carrier(self.state[3][carrier], wait)
                acquired = True
                at = _integer(self.now_ms())
                cutoff = min(deadline, at + self.max_exchange_ms)
                if waited and deadline - at < min(MIN_OWNER_EXCHANGE_MS, self.max_exchange_ms):
                    raise OwnerCarrierBusy("OWNER_CARRIER_BUSY")
                check_carrier()
                step = "exchange"
                body = _json(["meri.proxy.admission-read/1", read_id, capability_sha256,
                              None if expected is None else _hash(expected), cutoff])
                reply = await asyncio.wait_for(
                    self.exchange(carrier, OPERATION, body, check_carrier()),
                    check_carrier())
                check_carrier()
                step = "reply"
                if type(reply) is not OwnerReply or type(reply.body) is not bytes or len(reply.body) > 16384:
                    _deny()
                frame = validate_owner_reply(self.policy, reply, carrier, self.state[4])
                step = "frame"
                _tuple(frame, 8)
                if frame[:3] != ["meri.proxy.admission/1", read_id, capability_sha256]:
                    _deny()
                step = "source"
                binding = _source(frame[4])
                if frame[4][2] != capability_sha256 or _sha(frame[3]) != _hash(frame[4]):
                    _deny()
                if expected is not None and _json(expected) != _json(frame[4]):
                    _deny()
                step = "current"
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
                result = _VerifiedAdmission(read_id, _json(frame[4]), frame[6], frame[7], lease,
                    _json(current), read_at, min(read_at + ADMISSION_LEASE_MS / 1000,
                        self.monotonic() + (frame[7] - at) / 1000),
                    self.generation)
                self._receipts[id(result)] = result
                return result
            except OwnerCarrierBusy as error:
                # Nothing was sent on this carrier: a plain refusal, never a poisoned gate.
                diagnostics.refused("admission", step, error, deadline_ms=cutoff, now_ms=self.now_ms)
                raise
            except BaseException as error:
                diagnostics.refused("admission", step, error, deadline_ms=cutoff, now_ms=self.now_ms)
                raise
            finally:
                if acquired:
                    self.state[3][carrier].release()

    def _sync_read(self, capability_sha256, expected, deadline_ms):
        if threading.get_ident() == self.loop_thread or self.loop.is_closed() or not self.loop.is_running():
            _deny()
        started = _integer(self.now_ms())
        deadline = _integer(deadline_ms, 1)
        carrier, lease = admission_carrier(self.exchange, self.host_gate,
                                           None if expected is None else _json(expected))
        if lease is not None:
            deadline = min(deadline, lease.deadline_ms)
        self._remaining(deadline)
        # The read resolves itself within one carrier wait plus one exchange; the second of margin only catches a stuck loop.
        bound = min(deadline, started + self.max_carrier_wait_ms + self.max_exchange_ms)
        read_id = uuid.uuid4().hex
        coroutine = self._read(read_id, _sha(capability_sha256), expected, started, deadline, carrier, lease)
        try:
            future = asyncio.run_coroutine_threadsafe(coroutine, self.loop)
        except BaseException:
            coroutine.close()
            _deny()
        try:
            result = future.result(timeout=max(.001, (bound - self.now_ms()) / 1000 + 1))
            validate_capture_admission_lease(lease, self.exchange, self.host_gate,
                None if expected is None else _json(expected))
            return result
        except OwnerCarrierBusy:
            raise
        except BaseException as error:
            diagnostics.refused("admission", "read", error, deadline_ms=bound, now_ms=self.now_ms)
            future.cancel()
            raise

    def _consume(self, receipt, expected=None, *, lifetime=None):
        owner = self._receipt_lifetimes.get(id(receipt))
        if (type(receipt) is not _VerifiedAdmission
                or self._receipts.get(id(receipt)) is not receipt
                or not self._generation_current() or receipt.generation != self.generation
                or receipt.expires_at_ms <= self.now_ms()
                or not receipt.read_at_mono <= self.monotonic() < receipt.expires_at_mono
                or owner is not None and (lifetime is None or owner() is not lifetime)
                or lifetime is not None and owner is None
                or expected is not None and receipt.source_bytes != _json(expected)):
            diagnostics.refused("admission", "consume")
            _deny()
        # A request receipt is no longer tied to one transient capture callback.
        # Its lifetime, source, peer and generation are the authority boundary.
        if lifetime is None:
            validate_capture_admission_lease(receipt.capture_lease, self.exchange,
                self.host_gate, receipt.source_bytes)
        return json.loads(receipt.source_bytes)

    @staticmethod
    def _peer(life):
        return life.peer.ipv4, life.peer.binding, life.peer.grant_id

    def bind_lifetime(self, life):
        from ..qualification.runtime.lifetime import RequestLifetime
        if type(life) is not RequestLifetime or life in self._lifetimes:
            _deny()
        authority = life.admission.authority
        binding = authority._product_owner
        if (type(binding) is not tuple or len(binding) != 3 or binding[0] is not self
                or not self._generation_current()
                or life.peer.binding != authority.binding or life.peer.grant_id != authority.grant_id):
            _deny()
        state = _LifetimeAdmission(binding[1], self._peer(life), self.generation, binding[2])
        self._lifetimes[life] = state
        receipt = self._bootstrap.pop(authority, None)
        if receipt is not None:
            self._install(life, state, receipt)
        return state

    def _lifetime(self, life):
        state = self._lifetimes.get(life)
        if (type(state) is not _LifetimeAdmission or life._admission_lease is not state
                or life.reason is not None or not self._generation_current()
                or state.generation != self.generation or self._peer(life) != state.peer
                or life.admission.authority._product_owner != (self, state.source, state.expires_at_ms)):
            _deny()
        return state

    def _install(self, life, state, receipt):
        with self._receipt_lock:
            if (life.reason is not None or self._lifetimes.get(life) is not state
                    or receipt.source_bytes != state.source
                    or receipt.generation != state.generation
                    or id(receipt) in self._receipt_lifetimes):
                _deny()
            self._consume(receipt, json.loads(state.source))
            previous = state.receipt
            if previous is not None:
                # A late renewal cannot revive a request after the old lease expired,
                # even if its watcher was starved and has not published deny yet.
                self._consume(previous, json.loads(state.source), lifetime=life)
                if receipt.read_at_mono < previous.read_at_mono:
                    # Completion order can differ from read order after an
                    # unanswered wait. Keep the later-started valid receipt.
                    self._receipts.pop(id(receipt), None)
                    return
            receipt_id = id(receipt)
            self._receipt_lifetimes[receipt_id] = weakref.ref(life,
                lambda _ref: self._receipt_lifetimes.pop(receipt_id, None))
            # A concurrent request check must see either the still-bound old receipt
            # or the fully-bound new one, never a published but unowned receipt.
            state.receipt = receipt
            if previous is not None:
                self._receipts.pop(id(previous), None)
                self._receipt_lifetimes.pop(id(previous), None)

    def current_lifetime(self, life):
        with self._receipt_lock:
            state = self._lifetime(life)
            self._consume(state.receipt, json.loads(state.source), lifetime=life)
            return state.receipt

    def renew_lifetime_sync(self, life):
        state = self._lifetime(life)
        expected = json.loads(state.source)
        receipt = None
        try:
            receipt = self._sync_read(expected[2], expected, state.expires_at_ms)
            self._lifetime(life)
            self._install(life, state, receipt)
        except Exception as error:
            if receipt is not None:
                self._receipts.pop(id(receipt), None)
            # A refusal that arrives after the caller's bounded wait still cuts
            # immediately. Only a genuinely unanswered renewal may retain a lease.
            if not life._unanswered(error) and not self.loop.is_closed():
                self.loop.call_soon_threadsafe(life.deny, "FRESH_ADMISSION_DENIED")
            raise

    def release_lifetime(self, life):
        state = self._lifetimes.pop(life, None)
        if state is not None and state.receipt is not None:
            self._receipts.pop(id(state.receipt), None)
            self._receipt_lifetimes.pop(id(state.receipt), None)

    def conversation_for_lifetime(self, life):
        return self._conversation(self.current_lifetime(life))

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
            diagnostics.refused("admission", "join")
            _deny()
        # The immutable issuance cap is distinct from this read's short lease.
        # The first lifetime may borrow this receipt, never the immutable issuance cap.
        self._initial_caps[_hash(source)] = issued.expires_at_ms
        encoded = _json(source)
        previous = self.state[5].get(capability_sha256)
        if previous is not None and previous != encoded:
            diagnostics.refused("admission", "replay")
            _deny()
        self.state[5][capability_sha256] = encoded
        from ..qualification.state.admission import GrantAdmission
        authority = GrantAdmission.from_product_owner(
            reader=self, expected_source=source, expires_at_ms=self._initial_caps[_hash(source)])
        self._bootstrap[authority] = receipt
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
        from ..qualification.runtime.lifetime import _request_lifetime
        life = _request_lifetime.get()
        if life is not None:
            with self._receipt_lock:
                receipt = self.current_lifetime(life)
                self._consume(receipt, expected, lifetime=life)
                return None
        receipt = self._sync_read(expected[2], expected, expires_at_ms)
        try:
            self._consume(receipt, expected)
        finally:
            self._receipts.pop(id(receipt), None)
        return None

    def read_current_conversation_sync(self, expected_source, expires_at_ms):
        """Lifetime receipt on the request path; unscoped callers make a fresh read."""
        from ..qualification.runtime.lifetime import _request_lifetime
        expected = json.loads(expected_source)
        life = _request_lifetime.get()
        if life is not None:
            with self._receipt_lock:
                receipt = self.current_lifetime(life)
                self._consume(receipt, expected, lifetime=life)
                return self._conversation(receipt)
        receipt = self._sync_read(expected[2], expected, expires_at_ms)
        try:
            self._consume(receipt, expected)
            return self._conversation(receipt)
        finally:
            self._receipts.pop(id(receipt), None)

    @staticmethod
    def _conversation(receipt):
        value = json.loads(receipt.currentness_bytes)
        return {"identitySha256": value[0], "binding": _binding(value[1]),
                "scopes": [dict(zip(("kind", "tenantId", "resourceId", "policyRevision"), row))
                           for row in value[2]], "selectedClientId": value[3],
                "contextRevision": value[4], "checkedAtMs": value[5],
                "expiresAtMs": min(value[6], receipt.expires_at_ms)}
