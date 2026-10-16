"""Offline host-source checks; no listener, SQL, provider call or credentials."""
import asyncio
import base64
import hashlib
import importlib
import json
import struct
import sys
import time
import types
import unittest
import zlib
from unittest.mock import patch

import httpx

from apps.proxy.qualification.runtime.ingress import PeerLease
from apps.proxy.qualification.runtime.lifetime import (
    LifetimeLimits, PendingWork, RequestLifetime, _request_lifetime,
)
from apps.proxy.qualification.test.test_ingress import BINDING as RUN, GRANT, fixture


def _source_modules():
    names = ["litellm", "litellm.llms", "litellm.llms.custom_httpx",
             "litellm.llms.custom_httpx.http_handler"]
    modules = {name: types.ModuleType(name) for name in names}
    modules[names[-1]].AsyncHTTPHandler = type("UnusedAsyncHTTPHandler", (), {})
    with patch.dict(sys.modules, modules):
        host = importlib.import_module("apps.proxy.product.host_observation")
        admission = importlib.import_module("apps.proxy.product.request_admission")
        guard = importlib.import_module("apps.proxy.qualification.runtime.bedrock_transport")
        settlement = importlib.import_module("apps.proxy.product.response_settlement")
    return host, admission, guard, settlement


HOST, ADMISSION, GUARD, SETTLEMENT = _source_modules()
RUNTIME_HOST = "bedrock-runtime.us-east-1.amazonaws.com"
URL = "https://" + RUNTIME_HOST + "/model/us.anthropic.claude-sonnet-4-6/invoke"
NATIVE = json.dumps({"anthropic_version": "bedrock-2023-05-31", "max_tokens": 16,
                     "messages": [{"role": "user", "content": "synthetic"}]},
                    separators=(",", ":")).encode()
RAW = b'{"prompt":"synthetic"}'
MESSAGE = json.dumps({"id": "msg_synthetic", "type": "message", "role": "assistant",
                      "model": "anthropic.claude-sonnet-4-6",
                      "content": [{"type": "text", "text": "synthetic answer"}],
                      "stop_reason": "end_turn", "stop_sequence": None,
                      "usage": {"input_tokens": 12, "output_tokens": 3}},
                     separators=(",", ":")).encode()
BINDING = {"tenantId": "tenant", "actorId": "actor",
           "conversationId": "11111111-1111-4111-8111-111111111111",
           "runId": RUN.run_id,
           "attemptId": "22222222-2222-4222-8222-222222222222",
           "workerId": "33333333-3333-4333-8333-333333333333",
           "writerFence": RUN.fence}
CLIENT_ID = "11111111-1111-4111-8111-111111111111"
OTHER_CLIENT = "44444444-4444-4444-8444-444444444444"
VALUE = {"requestId": "request_A", "binding": BINDING, "deadlineMs": 9000000000000}


def wrong_client(receipt):
    return {**receipt, "selectedClientId": OTHER_CLIENT,
            "scopes": [{**receipt["scopes"][0], "resourceId": OTHER_CLIENT}]}


class Counter:
    def __init__(self):
        self.calls = 0

    async def count(self, parameters):
        self.calls += 1
        raw = parameters["input"]["invokeModel"]["body"]
        return GUARD.CountObservation(12, hashlib.sha256(raw).hexdigest(),
                                      "anthropic.claude-sonnet-4-6", "aws-counttokens")


class Bridge:
    def __init__(self, host):
        self.host, self.observed, self.claim = host, None, None

    async def reserve(self, value, claim):
        self.claim = claim
        # createProductProxyReservationBridge passes a request with an own
        # optional signal field, even when no signal was supplied by Python.
        self.observed = await self.host.capture_authenticated_call({**value, "signal": object()})
        if self.observed != claim:
            raise AssertionError("host and adapter observations differ")
        return {"requestId": value["requestId"],
                "nativeBodySha256": hashlib.sha256(self.observed["nativeRequest"]["body"]).hexdigest(),
                "state": "UNKNOWN"}


class BytesStream(httpx.AsyncByteStream):
    def __init__(self, chunks):
        self.chunks = chunks

    async def __aiter__(self):
        for chunk in self.chunks:
            yield chunk

    async def aclose(self):
        pass


class Inner(httpx.AsyncBaseTransport):
    def __init__(self, chunks, status=200, content_type="application/json"):
        self.chunks, self.status, self.calls = chunks, status, 0
        self.content_type = content_type

    async def handle_async_request(self, request):
        self.calls += 1
        return httpx.Response(self.status, headers={"content-type": self.content_type},
                              stream=BytesStream(self.chunks), request=request)


def stream_frame(event):
    headers = b""
    for name, value in ((":message-type", "event"), (":event-type", "chunk"),
                        (":content-type", "application/json")):
        name, value = name.encode(), value.encode()
        headers += bytes([len(name)]) + name + b"\x07" + struct.pack(">H", len(value)) + value
    payload = json.dumps({"bytes": base64.b64encode(json.dumps(event, separators=(",", ":")).encode()).decode()},
                         separators=(",", ":")).encode()
    prelude = struct.pack(">II", 16 + len(headers) + len(payload), len(headers))
    before_crc = prelude + struct.pack(">I", zlib.crc32(prelude)) + headers + payload
    return before_crc + struct.pack(">I", zlib.crc32(before_crc))


def streamed_message():
    start = json.loads(MESSAGE)
    start.update(content=[], stop_reason=None, usage={"input_tokens": 12, "output_tokens": 0})
    events = [{"type": "message_start", "message": start},
              {"type": "content_block_start", "index": 0,
               "content_block": {"type": "text", "text": ""}},
              {"type": "content_block_delta", "index": 0,
               "delta": {"type": "text_delta", "text": "synthetic answer"}},
              {"type": "content_block_stop", "index": 0},
              {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None},
               "usage": {"output_tokens": 3}},
              {"type": "message_stop"}]
    return b"".join(stream_frame(event) for event in events)


class HostObservationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        _, ingress, scope = fixture()

        async def observer():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        self.life = RequestLifetime(ingress, observer, time.monotonic() + 10,
                                    LifetimeLimits(poll_seconds=.05, check_seconds=.5), PendingWork())
        await self.life.start(scope)
        self.life.original_body = RAW
        self.token = _request_lifetime.set(self.life)
        self.archived = False
        self.current_requests = []
        self.context_change = None

    async def current_conversation(self, request):
        self.current_requests.append(request)
        if self.archived:
            raise RuntimeError("synthetic archived Core conversation")
        now = time.time_ns() // 1_000_000
        receipt = {"identitySha256": "a" * 64, "binding": BINDING.copy(),
                   "scopes": [{"kind": "client", "tenantId": BINDING["tenantId"],
                               "resourceId": CLIENT_ID,
                               "policyRevision": RUN.policy_revision}],
                   "selectedClientId": CLIENT_ID,
                   "contextRevision": "b" * 64,
                   "checkedAtMs": now, "expiresAtMs": now + 5000}
        return self.context_change(receipt) if self.context_change else receipt

    async def asyncTearDown(self):
        _request_lifetime.reset(self.token)
        await self.life.close()

    def composition(self):
        counter = Counter()
        host = HOST.HostRequestObservation(counter, request_id="request_A",
                                           binding=BINDING, deadline_ms=VALUE["deadlineMs"],
                                           selected_client_id=CLIENT_ID,
                                           check_current_conversation=self.current_conversation)
        bridge = Bridge(host)
        adapter = ADMISSION.ProductReservationAdapter(
            bridge, host.claim_ingress, binding=BINDING, deadline_ms=VALUE["deadlineMs"])
        guard = GUARD.BedrockSendGuard(request_id="request_A", counter=host,
                                      ledger=adapter, deadline=time.monotonic() + 5,
                                      expected_count_origin="aws-counttokens")
        request = httpx.Request("POST", URL, content=NATIVE,
                                headers={"content-type": "application/json"})
        return counter, host, bridge, adapter, guard, request

    async def armed(self):
        parts = self.composition()
        _, host, _, _, guard, request = parts
        await host.before_guard(request)
        await guard.before_send(request)
        return parts

    async def test_request_hook_and_count_are_separate_one_shot_sources(self):
        counter, host, bridge, adapter, guard, request = await self.armed()
        self.assertTrue(guard.armed)
        self.assertEqual(counter.calls, 1)
        self.assertGreaterEqual(len(self.current_requests), 3)
        self.assertTrue(all(set(call) == {"binding", "requestId", "deadlineMs"}
                            and call["binding"] == BINDING for call in self.current_requests))
        self.assertEqual(bridge.observed, bridge.claim)
        self.assertEqual(bridge.observed["rawRequestBody"], RAW)
        self.assertEqual(bridge.observed["nativeRequest"]["body"], NATIVE)
        self.assertEqual(adapter.reserved_raw_request_sha256, hashlib.sha256(RAW).hexdigest())
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await host.before_guard(request)
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await host.capture_authenticated_call(VALUE)
        with self.assertRaises(Exception):
            await guard.before_send(request)
        self.assertEqual(counter.calls, 1)

    async def test_missing_or_denied_core_currentness_refuses_before_count_or_hold(self):
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            HOST.HostRequestObservation(Counter(), request_id="request_A",
                                        binding=BINDING, deadline_ms=VALUE["deadlineMs"],
                                        selected_client_id=CLIENT_ID)
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            HOST.HostRequestObservation(Counter(), request_id="request_A",
                                        binding=BINDING, deadline_ms=VALUE["deadlineMs"],
                                        selected_client_id="AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
                                        check_current_conversation=self.current_conversation)
        counter, host, _, _, guard, request = self.composition()
        self.archived = True
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await host.before_guard(request)
        self.assertEqual(counter.calls, 0)
        self.archived = False
        self.context_change = lambda receipt: {**receipt, "binding": {
            **BINDING, "conversationId": "22222222-2222-4222-8222-222222222222"}}
        other_counter, other_host, _, _, _, other_request = self.composition()
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await other_host.before_guard(other_request)
        self.assertEqual(other_counter.calls, 0)
        self.context_change = wrong_client
        wrong_counter, wrong_host, _, _, _, wrong_request = self.composition()
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await wrong_host.before_guard(wrong_request)
        self.assertEqual(wrong_counter.calls, 0)

    async def test_archive_after_count_refuses_reservation_and_after_hold_refuses_native_send(self):
        counter, host, _, adapter, guard, request = self.composition()
        await host.before_guard(request)
        original_count = counter.count

        async def count_then_archive(parameters):
            result = await original_count(parameters)
            self.archived = True
            return result

        counter.count = count_then_archive
        with self.assertRaisesRegex(Exception, "LEDGER_ADMISSION_FAILED"):
            await guard.before_send(request)
        self.assertEqual(counter.calls, 1)
        self.assertFalse(guard.armed)
        self.assertIsNone(adapter.reserved_raw_request_sha256)

        self.archived = False
        _, host, _, adapter, guard, request = await self.armed()
        self.archived = True
        context = SETTLEMENT.SettlementContext("request_A", hashlib.sha256(RAW).hexdigest(), "a" * 64)
        inner = Inner([MESSAGE])
        captured = HOST.HostResponseObservationTransport(inner, guard=guard,
                                                         context=context, request_capture=host)
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await captured.handle_async_request(request)
        self.assertEqual(inner.calls, 0)
        self.assertTrue(guard.armed)
        self.assertEqual(guard.hold_receipt.state, "UNKNOWN")
        self.assertIsNotNone(adapter.reserved_raw_request_sha256)

        self.archived = False
        _, wrong_host, _, wrong_adapter, wrong_guard, wrong_request = await self.armed()
        self.context_change = wrong_client
        wrong_inner = Inner([MESSAGE])
        wrong_capture = HOST.HostResponseObservationTransport(
            wrong_inner, guard=wrong_guard, context=context,
            request_capture=wrong_host)
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await wrong_capture.handle_async_request(wrong_request)
        self.assertEqual(wrong_inner.calls, 0)
        self.assertEqual(wrong_guard.hold_receipt.state, "UNKNOWN")
        self.assertIsNotNone(wrong_adapter.reserved_raw_request_sha256)

        self.context_change = None
        _, final_host, _, _, final_guard, final_request = await self.armed()
        self.current_requests.clear()
        self.context_change = lambda receipt: (wrong_client(receipt)
                                                if len(self.current_requests) == 2 else receipt)
        final_inner = Inner([MESSAGE])
        final_capture = HOST.HostResponseObservationTransport(
            final_inner, guard=final_guard, context=context,
            request_capture=final_host)
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await final_capture.handle_async_request(final_request)
        self.assertEqual(len(self.current_requests), 2)
        self.assertEqual(final_inner.calls, 0)
        self.assertEqual(final_guard.hold_receipt.state, "UNKNOWN")

    async def test_archive_after_provider_dispatch_preserves_complete_usage_evidence(self):
        _, host, _, _, guard, request = await self.armed()
        context = SETTLEMENT.SettlementContext("request_A", hashlib.sha256(RAW).hexdigest(), "a" * 64)
        captured = HOST.HostResponseObservationTransport(Inner([MESSAGE]), guard=guard,
                                                         context=context, request_capture=host)
        settled = []

        async def complete(request_id, claim):
            settled.append(await captured.capture_authenticated_complete({
                "requestId": request_id, "binding": BINDING, "grantId": GRANT}))

        outer = SETTLEMENT.NativeSettlementTransport(captured, guard=guard,
                                                     context=context, settle_complete=complete)
        response = await outer.handle_async_request(request)
        self.archived = True
        self.assertEqual(b"".join([chunk async for chunk in response.stream]), MESSAGE)
        self.assertEqual(len(settled), 1)
        self.assertEqual(settled[0]["completion"]["usage"], {
            "inputTokens": 12, "outputTokens": 3})

    async def test_claim_or_mutation_cannot_create_host_request_evidence(self):
        counter, host, _, _, _, request = self.composition()
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await host.capture_authenticated_call({**VALUE, "peer": {"trusted": True}})
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await host.count({"modelId": "anthropic.claude-sonnet-4-6",
                              "input": {"invokeModel": {"body": NATIVE}}})
        self.assertEqual(counter.calls, 0)
        await host.before_guard(request)
        await host.count({"modelId": "anthropic.claude-sonnet-4-6",
                          "input": {"invokeModel": {"body": NATIVE}}})
        request.headers["x-extra"] = "changed"
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await host.capture_authenticated_call(VALUE)

    async def test_response_requires_actual_inner_stream_eof_and_complete_usage(self):
        _, host, _, _, guard, request = await self.armed()
        context = SETTLEMENT.SettlementContext("request_A", hashlib.sha256(RAW).hexdigest(), "a" * 64)
        inner = Inner([MESSAGE[:40], MESSAGE[40:]])
        captured = HOST.HostResponseObservationTransport(inner, guard=guard, context=context,
                                                         request_capture=host)
        result = []

        async def settled(request_id, claim):
            observed = await captured.capture_authenticated_complete(
                {"requestId": request_id, "binding": BINDING, "grantId": GRANT})
            result.append((claim, observed))

        outer = SETTLEMENT.NativeSettlementTransport(captured, guard=guard,
                                                     context=context, settle_complete=settled)
        response = await outer.handle_async_request(request)
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await captured.capture_authenticated_complete(
                {"requestId": "request_A", "binding": BINDING, "grantId": GRANT})
        chunks = [chunk async for chunk in response.stream]
        self.assertEqual(b"".join(chunks), MESSAGE)
        self.assertEqual(inner.calls, 1)
        self.assertEqual(len(result), 1)
        claim, observed = result[0]
        self.assertEqual(observed["usageResult"]["evidence_sha256"], claim.evidence_sha256)
        self.assertEqual(observed["completion"]["usage"], {"inputTokens": 12, "outputTokens": 3})
        self.assertEqual(observed["rawRequestBody"], RAW)
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            await captured.capture_authenticated_complete(
                {"requestId": "request_A", "binding": BINDING, "grantId": GRANT})

    async def test_response_slot_binding_and_raw_hash_mismatch_denied_before_lower_send(self):
        _, host, _, adapter, guard, request = await self.armed()
        raw_sha = hashlib.sha256(RAW).hexdigest()
        good = SETTLEMENT.SettlementContext("request_A", raw_sha, "a" * 64)
        wrong_id = SETTLEMENT.SettlementContext("another_request", raw_sha, "a" * 64)
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            HOST.HostResponseObservationTransport(Inner([MESSAGE]), guard=guard,
                                                  context=wrong_id, request_capture=host)
        host.request_id = "another_request"
        with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
            HOST.HostResponseObservationTransport(Inner([MESSAGE]), guard=guard,
                                                  context=good, request_capture=host)
        host.request_id = "request_A"
        for mismatch in ("raw", "binding"):
            with self.subTest(mismatch=mismatch):
                inner = Inner([MESSAGE])
                context = SETTLEMENT.SettlementContext("request_A", "f" * 64, "a" * 64) if mismatch == "raw" else good
                captured = HOST.HostResponseObservationTransport(inner, guard=guard,
                                                                  context=context, request_capture=host)
                if mismatch == "binding":
                    adapter._binding = {**BINDING, "tenantId": "other"}
                with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
                    await captured.handle_async_request(request)
                self.assertEqual(inner.calls, 0)

    async def test_real_httpx_hooks_and_fragmented_native_stream_require_eof(self):
        _, host, bridge, _, guard, _ = self.composition()
        payload = streamed_message()
        inner = Inner([payload[i:i + 11] for i in range(0, len(payload), 11)],
                      content_type="application/vnd.amazon.eventstream")
        context = SETTLEMENT.SettlementContext("request_A", hashlib.sha256(RAW).hexdigest(), "a" * 64)
        captured = HOST.HostResponseObservationTransport(inner, guard=guard, context=context,
                                                         request_capture=host)
        settled = []

        async def complete(request_id, claim):
            source = await captured.capture_authenticated_complete(
                {"requestId": request_id, "binding": BINDING, "grantId": GRANT})
            settled.append((claim, source))

        transport = SETTLEMENT.NativeSettlementTransport(captured, guard=guard,
                                                         context=context, settle_complete=complete)
        async with httpx.AsyncClient(transport=transport,
                                     event_hooks={"request": [host.before_guard, guard.before_send]}) as client:
            async with client.stream("POST", URL.replace("/invoke", "/invoke-with-response-stream"),
                                     content=NATIVE,
                                     headers={"content-type": "application/json"}) as response:
                iterator = response.aiter_raw()
                first = await anext(iterator)
                self.assertEqual(settled, [])
                with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
                    await captured.capture_authenticated_complete(
                        {"requestId": "request_A", "binding": BINDING, "grantId": GRANT})
                remainder = [chunk async for chunk in iterator]
                self.assertEqual(first + b"".join(remainder), payload)
        self.assertEqual(inner.calls, 1)
        self.assertEqual(len(settled), 1)
        self.assertEqual(settled[0][0].reason, "COMPLETE_NATIVE_STREAM")
        self.assertEqual(settled[0][1]["usageResult"]["reason"], "COMPLETE_NATIVE_STREAM")
        self.assertEqual(bridge.observed["nativeRequest"]["body"], NATIVE)

        # Reversing real HTTPX hook order must fail before transport dispatch.
        _, reverse_host, _, _, reverse_guard, _ = self.composition()
        reverse_inner = Inner([payload])
        reverse_capture = HOST.HostResponseObservationTransport(
            reverse_inner, guard=reverse_guard, context=context,
            request_capture=reverse_host)
        reverse_transport = SETTLEMENT.NativeSettlementTransport(
            reverse_capture, guard=reverse_guard, context=context,
            settle_complete=lambda *_: (_ for _ in ()).throw(AssertionError("must not settle")))
        async with httpx.AsyncClient(transport=reverse_transport,
                                     event_hooks={"request": [reverse_guard.before_send,
                                                              reverse_host.before_guard]}) as client:
            with self.assertRaises(Exception):
                await client.post(URL, content=NATIVE, headers={"content-type": "application/json"})
        self.assertEqual(reverse_inner.calls, 0)

    async def test_truncated_or_cancelled_response_never_records_completion(self):
        for chunks, consume in (([MESSAGE[:-1]], True), ([MESSAGE[:20], MESSAGE[20:]], False)):
            with self.subTest(consume=consume):
                _, host, _, _, guard, request = await self.armed()
                context = SETTLEMENT.SettlementContext("request_A", hashlib.sha256(RAW).hexdigest(), "a" * 64)
                captured = HOST.HostResponseObservationTransport(Inner(chunks), guard=guard,
                                                                 context=context, request_capture=host)
                outer = SETTLEMENT.NativeSettlementTransport(
                    captured, guard=guard, context=context,
                    settle_complete=lambda *_: (_ for _ in ()).throw(AssertionError("must not settle")))
                response = await outer.handle_async_request(request)
                if consume:
                    _ = [chunk async for chunk in response.stream]
                else:
                    await response.stream.aclose()
                with self.assertRaisesRegex(Exception, "PRODUCT_HOST_OBSERVATION_REFUSED"):
                    await captured.capture_authenticated_complete(
                        {"requestId": "request_A", "binding": BINDING, "grantId": GRANT})


if __name__ == "__main__":
    unittest.main()
