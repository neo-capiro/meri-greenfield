"""Synthetic private owner exchange; no TLS socket, owner or provider call."""
import asyncio
from dataclasses import replace
import hashlib
import importlib
import itertools
import json
import sys
import time
import types
import unittest
from unittest.mock import patch

_SERVICE_SEQUENCE = itertools.count()

_litellm_names = ("litellm", "litellm.llms", "litellm.llms.custom_httpx",
                  "litellm.llms.custom_httpx.http_handler")
_litellm_stubs = {name: types.ModuleType(name) for name in _litellm_names}
_litellm_stubs[_litellm_names[-1]].AsyncHTTPHandler = type("UnusedAsyncHTTPHandler", (), {})
with patch.dict(sys.modules, _litellm_stubs):
    owner_channel = importlib.import_module("apps.proxy.product.owner_channel")
    from apps.proxy.product.test_boundary_codec import reservation, usage
    from apps.proxy.product.test.test_complete_capture_codec import capture
    from apps.proxy.product.owner_admission import ProductOwnerAdmissionReader
    from apps.proxy.product.test.test_bearer_eni_admission import source as issued_fixture
from apps.proxy.product.response_settlement import SettlementCommitUncertain
OPEN, OPERATION, POLL, REPLY = (owner_channel.OPEN, owner_channel.OPERATION,
                               owner_channel.POLL, owner_channel.REPLY)
OwnerPeerPolicy, OwnerReply = owner_channel.OwnerPeerPolicy, owner_channel.OwnerReply
OwnerHostGate = owner_channel.OwnerHostGate
OwnerTlsEvidence = owner_channel.OwnerTlsEvidence
make_product_owner_bridge = owner_channel.make_product_owner_bridge
StateDenied = owner_channel.StateDenied


def wire(value):
    return json.dumps(value, separators=(",", ":")).encode("utf-8")


class FakeExchange:
    def __init__(self, policy, *, delay_poll=0, delay_operation=0,
                 same_connection=False, uncertain=False, request_id="request_A"):
        self.policy = policy
        self.delay_poll, self.delay_operation = delay_poll, delay_operation
        self.same_connection, self.uncertain = same_connection, uncertain
        self.request_id = request_id
        self.session_id = "owner_session_A"
        self.challenge = asyncio.Event()
        self.replied = asyncio.Event()
        self.kind = None
        self.calls = []
        self.aborted = False
        self.generation = 1
        self.resets = []
        self._serial = dict.fromkeys(owner_channel.CARRIERS, 0)
        self._connected = set()
        self._generation_close = []
        self._generation_install = []
        self._carrier_reset = []

    def subscribe_generation_close(self, callback):
        self._generation_close.append(callback)

    def subscribe_generation_install(self, callback):
        self._generation_install.append(callback)

    def subscribe_carrier_reset(self, callback):
        self._carrier_reset.append(callback)

    def reset(self, channel, *, expected_connection=None):
        if channel in self._connected:
            self._connected.remove(channel)
            self.resets.append(channel)
            self._serial[channel] += 1
            for callback in self._carrier_reset:
                callback(channel)

    def replace_partner(self):
        for callback in self._generation_close:
            callback(self.generation)
        self._connected.clear()
        self.generation += 1
        self.policy = replace(self.policy, owner_task_arn=self.policy.owner_task_arn + "-next")
        for callback in self._generation_install:
            callback(self.generation)

    def abort(self):
        self.aborted = True
        self.challenge.set()
        self.replied.set()

    def evidence(self, channel):
        return OwnerTlsEvidence(
            self.policy.origin, self.policy.server_name,
            self.policy.owner_task_arn, self.policy.proxy_task_arn,
            self.policy.server_cert_sha256, self.policy.server_issuer_sha256,
            self.policy.client_cert_sha256, self.policy.client_subject,
            "TLSv1.3", "http/1.1",
            "operation_A" if self.same_connection else f"{channel}_{self._serial[channel]}")

    async def __call__(self, channel, path, body, timeout):
        self._connected.add(channel)
        self.calls.append((channel, path))
        frame = json.loads(body)
        if path == OPEN:
            self.challenge.clear()
            self.replied.clear()
            answer = ["meri.proxy.session/1", self.session_id, frame[1], frame[2]]
        elif path == POLL:
            if self.delay_poll:
                await asyncio.sleep(self.delay_poll)
            await self.challenge.wait()
            request = reservation()[0]
            request["requestId"] = self.request_id
            binding = frame_binding(request["binding"])
            answer = (["meri.proxy.capture-call/1", request["requestId"],
                       binding, request["deadlineMs"]] if self.kind == "call" else
                      ["meri.proxy.capture-complete/1", request["requestId"],
                       binding, "grant_A"])
        elif path == REPLY:
            self.replied.set()
            answer = ["meri.proxy.capture-ack/1", self.session_id, self.request_id, self.kind]
        else:
            if self.delay_operation:
                await asyncio.sleep(self.delay_operation)
            claim = frame[2]
            if claim[0] == "meri.proxy.outcome/1":
                answer = ["meri.proxy.outcome-receipt/1", self.session_id,
                          [self.request_id, "SETTLED", "42"]]
            else:
                self.kind = "call" if claim[0] == "meri.proxy.reservation/1" else "complete"
                self.challenge.set()
                await self.replied.wait()
                if self.kind == "call":
                    answer = ["meri.proxy.reservation-receipt/1", self.session_id,
                              [self.request_id, hashlib.sha256(reservation()[1][
                                  "nativeRequest"]["body"]).hexdigest(), "UNKNOWN"]]
                elif self.uncertain:
                    answer = ["meri.proxy.commit-uncertain/1", self.session_id,
                              self.request_id]
                else:
                    answer = ["meri.proxy.settlement-receipt/1", self.session_id,
                              [self.request_id, "SETTLED"]]
                self.challenge.clear()
                self.replied.clear()
        return OwnerReply(wire(answer), self.evidence(channel))


def frame_binding(binding):
    return [binding[name] for name in ("tenantId", "actorId", "conversationId",
                                      "runId", "attemptId", "workerId", "writerFence")]


class OwnerChannelTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.value, self.observation = reservation()
        self.policy = OwnerPeerPolicy(
            "https://owner.internal:8444", "owner.internal",
            "arn:aws:ecs:us-east-1:123456789012:task/owner-" +
            str(next(_SERVICE_SEQUENCE)),
            "arn:aws:ecs:us-east-1:123456789012:task/proxy-task", "a" * 64,
            "b" * 64, "c" * 64, "proxy-task-v1")
        self.host_gate = OwnerHostGate()
        self.now = lambda: self.value["deadlineMs"] - 5000

    def bridge(self, port, captured=None, *, request_id="request_A"):
        if captured is None:
            async def captured(request):
                return {**self.observation, "requestId": request["requestId"]}
        return make_product_owner_bridge(
            policy=self.policy, exchange=port, host_gate=self.host_gate,
            request_id=request_id, binding=self.value["binding"],
            deadline_ms=self.value["deadlineMs"], grant_id="grant_A",
            capability_sha256=hashlib.sha256(
                self.observation["proxyCredential"].encode()).hexdigest(),
            now_ms=self.now)(captured)

    def complete_observation(self):
        result = capture()
        result["completion"]["binding"] = self.value["binding"]
        result["completion"]["taskArn"] = self.observation["peer"]["taskArn"]
        result["completion"]["capabilitySha256"] = hashlib.sha256(
            self.observation["proxyCredential"].encode()).hexdigest()
        result["rawRequestBody"] = self.observation["rawRequestBody"]
        result["nativeRequestBody"] = self.observation["nativeRequest"]["body"]
        native_sha = hashlib.sha256(result["nativeRequestBody"]).hexdigest()
        raw_sha = hashlib.sha256(result["rawRequestBody"]).hexdigest()
        result["reservation"]["nativeBodySha256"] = native_sha
        result["completion"]["nativeBodySha256"] = native_sha
        result["completion"]["rawRequestSha256"] = raw_sha
        result["usageResult"]["binding"]["native_body_sha256"] = native_sha
        result["usageResult"]["binding"]["raw_request_sha256"] = raw_sha
        return result

    async def test_a_held_carrier_refuses_the_reserve_before_sending_and_never_poisons(self):
        deadline = self.value["deadlineMs"]
        self.now = lambda: deadline - 100  # The carrier wait is bounded by the 100 ms left.
        port = FakeExchange(self.policy)
        lock = owner_channel.owner_exchange_state(port, self.policy, self.host_gate)[3]["operation"]
        await lock.acquire()
        try:
            with self.assertRaisesRegex(Exception, "^OWNER_CARRIER_BUSY$"):
                await self.bridge(port).reserve(self.value, self.observation)
        finally:
            lock.release()
        self.assertEqual(port.calls, [])
        self.assertFalse(port.aborted)
        self.assertTrue(self.host_gate.available)

    async def test_the_reserve_exchange_clock_starts_once_its_carrier_is_held(self):
        self.policy = replace(self.policy, max_exchange_ms=200)
        started, deadline = time.monotonic(), self.value["deadlineMs"]
        self.now = lambda: deadline - 5000 + int((time.monotonic() - started) * 1000)
        port = FakeExchange(self.policy)
        lock = owner_channel.owner_exchange_state(port, self.policy, self.host_gate)[3]["operation"]
        await lock.acquire()
        async def release():
            await asyncio.sleep(.3)  # Longer than the whole 200 ms exchange budget.
            lock.release()
        releaser = asyncio.create_task(release())
        receipt = await self.bridge(port).reserve(self.value, self.observation)
        await releaser
        self.assertEqual(receipt["state"], "UNKNOWN")
        self.assertFalse(port.aborted)
        self.assertTrue(self.host_gate.available)

    async def test_reservation_and_settlement_use_distinct_fresh_capture(self):
        port = FakeExchange(self.policy)
        bridge = self.bridge(port)
        request_captures = []
        complete_captures = []

        async def request_capture(request):
            request_captures.append(request)
            return self.observation

        bridge.capture_call = request_capture
        receipt = await bridge.reserve(self.value, self.observation)
        self.assertEqual(receipt["state"], "UNKNOWN")
        self.assertEqual(len(request_captures), 1)
        self.assertEqual(request_captures[0]["binding"], self.value["binding"])
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)

        async def complete_capture(request):
            complete_captures.append(request)
            return self.complete_observation()

        bridge.bind_complete_capture(complete_capture)
        await bridge.settle_complete("request_A", usage())
        self.assertEqual(len(complete_captures), 1)
        self.assertEqual(complete_captures[0]["grantId"], "grant_A")
        with self.assertRaises(StateDenied):
            await bridge.read_outcome("request_A")
        self.assertFalse(port.aborted)
        self.assertEqual([path for _, path in port.calls].count(POLL), 2)
        self.assertEqual([path for _, path in port.calls].count(REPLY), 2)

    async def test_settled_readback_allows_a_distinct_request_with_identical_bytes(self):
        port = FakeExchange(self.policy, uncertain=True)
        bridge = self.bridge(port)
        await bridge.reserve(self.value, self.observation)
        async def complete_capture(_request):
            return self.complete_observation()
        bridge.bind_complete_capture(complete_capture)
        with self.assertRaises(SettlementCommitUncertain):
            await bridge.settle_complete("request_A", usage())
        self.assertEqual(await bridge.read_outcome("request_A"),
                         {"requestId": "request_A", "state": "SETTLED", "actualMicroUSD": "42"})
        self.assertTrue(self.host_gate.available)
        self.assertFalse(port.aborted)
        calls = len(port.calls)
        port.request_id, port.session_id = "request_B", "owner_session_B"
        next_bridge = self.bridge(port, request_id="request_B")
        next_value = {**self.value, "requestId": "request_B"}
        next_observation = {**self.observation, "requestId": "request_B"}
        self.assertEqual(next_observation["rawRequestBody"], self.observation["rawRequestBody"])
        self.assertEqual(next_observation["nativeRequest"]["body"], self.observation["nativeRequest"]["body"])
        receipt = await next_bridge.reserve(next_value, next_observation)
        self.assertEqual(receipt["requestId"], "request_B")
        self.assertEqual(receipt["state"], "UNKNOWN")
        self.assertEqual([path for _, path in port.calls[calls:]].count(OPEN), 1)
        self.assertFalse(port.aborted)

    async def test_unavailable_settlement_readback_refuses_only_its_request(self):
        class UnavailableOutcome(FakeExchange):
            async def __call__(self, channel, path, body, timeout):
                if path == OPERATION and json.loads(body)[2][0] == "meri.proxy.outcome/1":
                    self.calls.append((channel, path))
                    raise RuntimeError("synthetic unavailable readback")
                return await super().__call__(channel, path, body, timeout)

        port = UnavailableOutcome(self.policy, uncertain=True)
        bridge = self.bridge(port)
        next_port = FakeExchange(self.policy, request_id="request_B")
        next_bridge = self.bridge(next_port, request_id="request_B")
        await bridge.reserve(self.value, self.observation)
        async def complete_capture(_request):
            return self.complete_observation()
        bridge.bind_complete_capture(complete_capture)
        with self.assertRaises(SettlementCommitUncertain):
            await bridge.settle_complete("request_A", usage())
        self.assertTrue(self.host_gate.available, "commit uncertainty still permits exact readback")
        self.assertFalse(port.aborted)
        with self.assertRaises(StateDenied):
            await bridge.read_outcome("request_A")
        self.assertTrue(self.host_gate.available)
        self.assertFalse(port.aborted)
        calls = list(port.calls)
        with self.assertRaises(StateDenied):
            await bridge.read_outcome("request_A")
        receipt = await next_bridge.reserve({**self.value, "requestId": "request_B"},
            {**self.observation, "requestId": "request_B"})
        self.assertEqual(receipt["state"], "UNKNOWN")
        self.assertEqual(port.calls, calls, "failed outcome is not retried")
        self.assertTrue(next_port.calls, "another request can reserve independently")

    async def test_same_tls_connection_refuses_request_without_retry_or_poison(self):
        port = FakeExchange(self.policy, same_connection=True)
        bridge = self.bridge(port)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertFalse(port.aborted)
        self.assertTrue(self.host_gate.available)
        before = len(port.calls)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertEqual(len(port.calls), before)

    async def test_both_arrival_orders_preserve_one_capture(self):
        for delayed in ("poll", "operation"):
            with self.subTest(delayed=delayed):
                port = FakeExchange(self.policy, delay_poll=.01 if delayed == "poll" else 0,
                                    delay_operation=.01 if delayed == "operation" else 0)
                bridge = self.bridge(port)
                receipt = await bridge.reserve(self.value, self.observation)
                self.assertEqual(receipt["state"], "UNKNOWN")
                self.assertFalse(port.aborted)

    async def test_caller_cancellation_resets_active_carrier_without_poison(self):
        started = asyncio.Event()
        release = asyncio.Event()
        parent = self

        class HangingOpen(FakeExchange):
            async def __call__(self, channel, path, body, timeout):
                if path == OPEN:
                    started.set()
                    try:
                        await release.wait()
                    except asyncio.CancelledError:
                        await release.wait()  # Deliberately suppress cancellation.
                return await super().__call__(channel, path, body, timeout)

            def reset(self, channel, *, expected_connection=None):
                super().reset(channel, expected_connection=expected_connection)
                release.set()

        port = HangingOpen(self.policy)
        bridge = self.bridge(port)
        task = asyncio.create_task(bridge.reserve(self.value, self.observation))
        await started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        await asyncio.sleep(0)
        self.assertFalse(port.aborted)
        self.assertTrue(self.host_gate.available)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)

    async def test_late_host_capture_cannot_reply_but_another_session_can_serve(self):
        started, release = asyncio.Event(), asyncio.Event()

        async def late_capture(request):
            started.set()
            try:
                await release.wait()
            except asyncio.CancelledError:
                await release.wait()  # Simulate a callback ignoring cancellation.
            return self.observation

        port = FakeExchange(self.policy)
        bridge = self.bridge(port, late_capture)
        pending = asyncio.create_task(bridge.reserve(self.value, self.observation))
        await started.wait()
        pending.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await pending
        self.assertFalse(port.aborted)
        self.assertTrue(self.host_gate.available)
        next_bridge = self.bridge(FakeExchange(self.policy, request_id="request_B"), request_id="request_B")
        receipt = await next_bridge.reserve({**self.value, "requestId": "request_B"},
            {**self.observation, "requestId": "request_B"})
        self.assertEqual(receipt["state"], "UNKNOWN")
        release.set()
        await asyncio.sleep(0)
        self.assertEqual([path for _, path in port.calls].count(REPLY), 0)

    async def test_malformed_open_resets_request_carrier_without_reuse(self):
        class BadOpen(FakeExchange):
            async def __call__(self, channel, path, body, timeout):
                reply = await super().__call__(channel, path, body, timeout)
                if path == OPEN:
                    return OwnerReply(wire(["meri.proxy.session/1", self.session_id,
                                            "request_A", "f" * 64]), reply.evidence)
                return reply

        port = BadOpen(self.policy)
        bridge = self.bridge(port)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertFalse(port.aborted)
        self.assertTrue(self.host_gate.available)
        count = len(port.calls)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertEqual(len(port.calls), count)

    async def test_foreign_capability_selector_never_opens_a_session(self):
        port = FakeExchange(self.policy)
        bridge = self.bridge(port)
        bridge.capability_sha256 = "f" * 64
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertFalse(port.aborted)
        self.assertTrue(self.host_gate.available)
        self.assertEqual(port.calls, [])

    async def test_second_gate_for_same_service_is_refused_even_with_new_timeout(self):
        first = self.bridge(FakeExchange(self.policy))
        self.assertTrue(first.host_gate.available)
        changed = replace(self.policy, max_exchange_ms=2500)
        with self.assertRaises(StateDenied):
            make_product_owner_bridge(
                policy=changed, exchange=FakeExchange(changed),
                host_gate=OwnerHostGate(), request_id=self.value["requestId"],
                binding=self.value["binding"], deadline_ms=self.value["deadlineMs"],
                grant_id="grant_A", capability_sha256=hashlib.sha256(
                    self.observation["proxyCredential"].encode()).hexdigest(),
                now_ms=self.now)(lambda request: None)

    async def test_malformed_reservation_receipt_refuses_without_reuse(self):
        class BadReceipt(FakeExchange):
            async def __call__(self, channel, path, body, timeout):
                reply = await super().__call__(channel, path, body, timeout)
                if path == OPERATION:
                    return OwnerReply(wire(["meri.proxy.reservation-receipt/1",
                                            self.session_id,
                                            ["request_A", "f" * 64, "SETTLED"]]),
                                      reply.evidence)
                return reply

        port = BadReceipt(self.policy)
        bridge = self.bridge(port)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertFalse(port.aborted)
        self.assertTrue(self.host_gate.available)
        count = len(port.calls)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertEqual(len(port.calls), count)

    async def test_late_exchange_after_cancellation_cannot_reuse_channel(self):
        started, release = asyncio.Event(), asyncio.Event()

        class LateOpen(FakeExchange):
            async def __call__(self, channel, path, body, timeout):
                if path == OPEN:
                    started.set()
                    try:
                        await release.wait()
                    except asyncio.CancelledError:
                        await release.wait()
                return await super().__call__(channel, path, body, timeout)

        port = LateOpen(self.policy)
        bridge = self.bridge(port)
        pending = asyncio.create_task(bridge.reserve(self.value, self.observation))
        await started.wait()
        pending.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await pending
        self.assertFalse(port.aborted)
        self.assertTrue(self.host_gate.available)
        release.set()
        await asyncio.sleep(0)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertEqual([path for _, path in port.calls], [OPEN])

    async def test_read_only_open_timeout_resets_then_next_request_uses_fresh_carrier(self):
        class TimeoutOnce(FakeExchange):
            failed = False

            async def __call__(self, channel, path, body, timeout):
                result = await super().__call__(channel, path, body, timeout)
                if path == OPEN and not self.failed:
                    self.failed = True
                    raise TimeoutError("synthetic unanswered open")
                return result

        port = TimeoutOnce(self.policy)
        bridge = self.bridge(port)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertEqual(port.resets, ["operation"])
        self.assertTrue(self.host_gate.available)
        self.assertFalse(port.aborted)
        port.request_id, port.session_id = "request_B", "session_B"
        next_bridge = self.bridge(port, request_id="request_B")
        receipt = await next_bridge.reserve({**self.value, "requestId": "request_B"},
            {**self.observation, "requestId": "request_B"})
        self.assertEqual(receipt["state"], "UNKNOWN")
        self.assertEqual(next_bridge._operation_connection, "operation_1")

    async def test_reserve_timeout_retains_unknown_and_never_retries_reserve(self):
        class LostReserveAcknowledgement(FakeExchange):
            hold = None
            reserve_calls = 0

            async def __call__(self, channel, path, body, timeout):
                reply = await super().__call__(channel, path, body, timeout)
                if path == OPERATION and json.loads(body)[2][0] == "meri.proxy.reservation/1":
                    self.reserve_calls += 1
                    self.hold = "UNKNOWN"
                    raise TimeoutError("synthetic lost reserve acknowledgement")
                return reply

        port = LostReserveAcknowledgement(self.policy)
        bridge = self.bridge(port)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertEqual(port.hold, "UNKNOWN")
        self.assertEqual(port.reserve_calls, 1)
        before = list(port.calls)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertEqual(port.calls, before)
        self.assertEqual(port.hold, "UNKNOWN")
        self.assertTrue(self.host_gate.available)
        self.assertFalse(port.aborted)

    async def test_settle_timeout_preserves_unknown_then_reads_outcome_on_fresh_carrier(self):
        class LostSettleAcknowledgement(FakeExchange):
            hold = None
            settle_calls = 0
            outcome_calls = 0

            async def __call__(self, channel, path, body, timeout):
                reply = await super().__call__(channel, path, body, timeout)
                if path == OPERATION:
                    kind = json.loads(body)[2][0]
                    if kind == "meri.proxy.reservation/1":
                        self.hold = "UNKNOWN"
                    elif kind == "meri.proxy.settlement/1":
                        self.settle_calls += 1
                        raise TimeoutError("synthetic unanswered settle")
                    elif kind == "meri.proxy.outcome/1":
                        self.outcome_calls += 1
                        self.hold = "SETTLED"
                return reply

        port = LostSettleAcknowledgement(self.policy)
        bridge = self.bridge(port)
        await bridge.reserve(self.value, self.observation)
        async def complete_capture(_request):
            return self.complete_observation()
        bridge.bind_complete_capture(complete_capture)
        with self.assertRaises(SettlementCommitUncertain):
            await bridge.settle_complete("request_A", usage())
        self.assertEqual(port.hold, "UNKNOWN")
        self.assertEqual(port.settle_calls, 1)
        self.assertIn("operation", port.resets)
        self.assertTrue(self.host_gate.available)
        with self.assertRaises(StateDenied):
            await bridge.settle_complete("request_A", usage())
        receipt = await bridge.read_outcome("request_A")
        self.assertEqual(receipt["state"], "SETTLED")
        self.assertEqual(bridge._operation_connection, "operation_1")
        self.assertEqual(port.outcome_calls, 1)
        self.assertEqual(port.settle_calls, 1)
        self.assertFalse(port.aborted)

    async def test_generation_change_invalidates_old_bridge_and_source_before_new_request(self):
        port = FakeExchange(self.policy)
        bridge = self.bridge(port)
        old_state = owner_channel.owner_exchange_state(port, self.policy, self.host_gate)
        old_state[5][bridge.capability_sha256] = "old-source"
        await bridge.reserve(self.value, self.observation)
        port.replace_partner()
        self.assertEqual(old_state[5], {})
        self.assertEqual(old_state[4], dict.fromkeys(owner_channel.CARRIERS))
        before = list(port.calls)
        with self.assertRaises(StateDenied):
            bridge.bind_complete_capture(lambda _request: None)
        with self.assertRaises(StateDenied):
            await bridge._exchange("operation", OPEN, b"[]")
        self.assertEqual(port.calls, before)
        self.assertEqual(bridge._state, "FAILED")
        self.policy = port.policy
        port.request_id, port.session_id = "request_B", "session_B"
        next_bridge = self.bridge(port, request_id="request_B")
        receipt = await next_bridge.reserve({**self.value, "requestId": "request_B"},
            {**self.observation, "requestId": "request_B"})
        self.assertEqual(receipt["state"], "UNKNOWN")
        self.assertEqual(next_bridge.generation, 2)
        self.assertIsNot(owner_channel.owner_exchange_state(port, self.policy, self.host_gate), old_state)

    async def test_generation_mismatch_cannot_read_an_uncertain_outcome(self):
        port = FakeExchange(self.policy, uncertain=True)
        bridge = self.bridge(port)
        await bridge.reserve(self.value, self.observation)
        async def complete_capture(_request):
            return self.complete_observation()
        bridge.bind_complete_capture(complete_capture)
        with self.assertRaises(SettlementCommitUncertain):
            await bridge.settle_complete("request_A", usage())
        port.replace_partner()
        before = list(port.calls)
        with self.assertRaises(StateDenied):
            await bridge.read_outcome("request_A")
        self.assertEqual(port.calls, before)

    async def test_generation_check_refuses_even_before_close_notification_arrives(self):
        port = FakeExchange(self.policy)
        bridge = self.bridge(port)
        port.generation += 1  # The per-use fence must not depend on callback timing.
        with self.assertRaises(StateDenied):
            await bridge._exchange("operation", OPEN, wire([
                "meri.proxy.session-open/1", "request_A", bridge.capability_sha256,
                frame_binding(self.value["binding"]), self.value["deadlineMs"]]))
        self.assertEqual(port.calls, [])

    async def test_bridge_requires_generation_and_synchronous_carrier_reset(self):
        port = FakeExchange(self.policy)
        del port.generation
        with self.assertRaises(StateDenied):
            self.bridge(port)
        port.generation = 1
        async def asynchronous_reset(channel):
            pass
        port.reset = asynchronous_reset
        with self.assertRaises(StateDenied):
            self.bridge(port)
        self.assertEqual(port.calls, [])


if __name__ == "__main__":
    unittest.main()
