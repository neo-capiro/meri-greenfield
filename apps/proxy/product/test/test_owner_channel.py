"""Synthetic private owner exchange; no TLS socket, owner or provider call."""
import asyncio
from dataclasses import replace
import hashlib
import importlib
import itertools
import json
import sys
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
                 same_connection=False, uncertain=False):
        self.policy = policy
        self.delay_poll, self.delay_operation = delay_poll, delay_operation
        self.same_connection, self.uncertain = same_connection, uncertain
        self.session_id = "owner_session_A"
        self.challenge = asyncio.Event()
        self.replied = asyncio.Event()
        self.kind = None
        self.calls = []
        self.aborted = False

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
            "operation_A" if channel == "operation" or self.same_connection
            else "capture_A")

    async def __call__(self, channel, path, body, timeout):
        self.calls.append((channel, path))
        frame = json.loads(body)
        if path == OPEN:
            answer = ["meri.proxy.session/1", self.session_id, frame[1], frame[2]]
        elif path == POLL:
            if self.delay_poll:
                await asyncio.sleep(self.delay_poll)
            await self.challenge.wait()
            request = reservation()[0]
            binding = frame_binding(request["binding"])
            answer = (["meri.proxy.capture-call/1", request["requestId"],
                       binding, request["deadlineMs"]] if self.kind == "call" else
                      ["meri.proxy.capture-complete/1", request["requestId"],
                       binding, "grant_A"])
        elif path == REPLY:
            self.replied.set()
            answer = ["meri.proxy.capture-ack/1", self.session_id, "request_A", self.kind]
        else:
            if self.delay_operation:
                await asyncio.sleep(self.delay_operation)
            claim = frame[2]
            if claim[0] == "meri.proxy.outcome/1":
                answer = ["meri.proxy.outcome-receipt/1", self.session_id,
                          ["request_A", "SETTLED", "42"]]
            else:
                self.kind = "call" if claim[0] == "meri.proxy.reservation/1" else "complete"
                self.challenge.set()
                await self.replied.wait()
                if self.kind == "call":
                    answer = ["meri.proxy.reservation-receipt/1", self.session_id,
                              ["request_A", hashlib.sha256(reservation()[1][
                                  "nativeRequest"]["body"]).hexdigest(), "UNKNOWN"]]
                elif self.uncertain:
                    answer = ["meri.proxy.commit-uncertain/1", self.session_id,
                              "request_A"]
                else:
                    answer = ["meri.proxy.settlement-receipt/1", self.session_id,
                              ["request_A", "SETTLED"]]
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

    def bridge(self, port, captured=None):
        if captured is None:
            async def captured(request):
                return self.observation
        return make_product_owner_bridge(
            policy=self.policy, exchange=port, host_gate=self.host_gate,
            request_id=self.value["requestId"], binding=self.value["binding"],
            deadline_ms=self.value["deadlineMs"], grant_id="grant_A",
            capability_sha256=hashlib.sha256(
                self.observation["proxyCredential"].encode()).hexdigest(),
            now_ms=self.now)(captured)

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

        bridge.bind_complete_capture(complete_capture)
        await bridge.settle_complete("request_A", usage())
        self.assertEqual(len(complete_captures), 1)
        self.assertEqual(complete_captures[0]["grantId"], "grant_A")
        with self.assertRaises(StateDenied):
            await bridge.read_outcome("request_A")
        self.assertFalse(port.aborted)
        self.assertEqual([path for _, path in port.calls].count(POLL), 2)
        self.assertEqual([path for _, path in port.calls].count(REPLY), 2)

    async def test_same_tls_connection_and_late_reply_poison_without_retry(self):
        port = FakeExchange(self.policy, same_connection=True)
        bridge = self.bridge(port)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertTrue(port.aborted)
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

    async def test_caller_cancellation_aborts_persistent_connections(self):
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

            def abort(self):
                super().abort()
                release.set()

        port = HangingOpen(self.policy)
        bridge = self.bridge(port)
        task = asyncio.create_task(bridge.reserve(self.value, self.observation))
        await started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        await asyncio.sleep(0)
        self.assertTrue(port.aborted)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)

    async def test_late_host_capture_poison_blocks_another_session(self):
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
        self.assertTrue(port.aborted)
        self.assertFalse(self.host_gate.available)
        with self.assertRaises(StateDenied):
            self.bridge(FakeExchange(self.policy))
        release.set()
        await asyncio.sleep(0)
        self.assertEqual([path for _, path in port.calls].count(REPLY), 0)

    async def test_malformed_open_aborts_both_channels_without_reuse(self):
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
        self.assertTrue(port.aborted)
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
        self.assertTrue(port.aborted)
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

    async def test_malformed_reservation_receipt_aborts_without_reuse(self):
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
        self.assertTrue(port.aborted)
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
        self.assertTrue(port.aborted)
        release.set()
        await asyncio.sleep(0)
        with self.assertRaises(StateDenied):
            await bridge.reserve(self.value, self.observation)
        self.assertEqual([path for _, path in port.calls], [OPEN])


if __name__ == "__main__":
    unittest.main()
