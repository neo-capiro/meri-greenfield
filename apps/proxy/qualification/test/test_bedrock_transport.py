"""Actual pinned LiteLLM/HTTPX route, only fake HTTP transport/count/ledger.

Run with a replacement credential-free environment and the isolated venv.
These fixtures establish no real token count, durable transaction or AWS usage.
"""
import asyncio
import base64
import copy
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import socket
import struct
import sys
import time
import unittest
from unittest.mock import patch
import zlib

# Keep upstream import/model metadata on packaged data, with no credential chain.
if os.environ.get("LITELLM_LOCAL_MODEL_COST_MAP") != "True" or os.environ.get("AWS_EC2_METADATA_DISABLED") != "true":
    raise RuntimeError("replacement offline test environment required")
for key in os.environ:
    if key in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_PROFILE",
               "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI", "AWS_CONTAINER_CREDENTIALS_FULL_URI",
               "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY"):
        raise RuntimeError("credential-bearing test environment refused")

def _deny_dns(*args, **kwargs):
    raise AssertionError("unexpected DNS in fake-transport test")

with patch("socket.getaddrinfo", _deny_dns):
    import httpx
    import litellm
    from litellm.anthropic_interface.messages import acreate
    from litellm.integrations.custom_logger import CustomLogger
    from litellm.llms.custom_httpx.http_handler import AsyncHTTPHandler
    from botocore.session import Session
    from botocore.serialize import create_serializer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime.bedrock_body import AdmissionDenied, BodyLimits, COUNT_MODEL_ID, PROFILE_ID, inspect_native_request
from runtime.bedrock_transport import BedrockSendGuard, CountObservation, HoldReceipt, guarded_client

URL = "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-6/invoke"
MODEL = "bedrock/invoke/us.anthropic.claude-sonnet-4-6"
PARAMS = {"aws_region_name": "us-east-1", "aws_access_key_id": "SYNTHETIC-NOT-A-CREDENTIAL",
          "aws_secret_access_key": "SYNTHETIC-NOT-A-SECRET", "num_retries": 0}

def native_body():
    return {"anthropic_version": "bedrock-2023-05-31", "max_tokens": 16,
            "messages": [{"role": "user", "content": "synthetic"}]}

def response_body():
    return {"id": "synthetic-message", "type": "message", "role": "assistant",
            "model": COUNT_MODEL_ID, "content": [{"type": "text", "text": "synthetic"}],
            "stop_reason": "end_turn", "stop_sequence": None,
            "usage": {"input_tokens": 1, "output_tokens": 1}}


class FixtureCounter:
    def __init__(self):
        self.parameters = []
        self.tokens = 123
        self.origin = "fixture"
        self.model_id = COUNT_MODEL_ID
        self.digest_override = None
        self.error = None

    async def count(self, parameters):
        self.parameters.append(copy.deepcopy(parameters))
        if self.error:
            raise self.error
        digest = hashlib.sha256(parameters["input"]["invokeModel"]["body"]).hexdigest()
        return CountObservation(self.tokens, self.digest_override or digest, self.model_id, self.origin)


class FixtureLedger:
    """Explicitly in-memory, pessimistic hold oracle; not a Postgres implementation."""
    def __init__(self):
        self.holds = {}
        self.error_before_commit = False
        self.lost_ack = False
        self.after_commit = None
        self.receipt_state = "UNKNOWN"

    async def reserve_and_arm_once(self, request_id, body, count):
        if self.error_before_commit:
            raise RuntimeError("synthetic ledger unavailable")
        if request_id in self.holds:
            raise AdmissionDenied("DUPLICATE_DURABLE_SLOT")
        self.holds[request_id] = {"state": "UNKNOWN", "bodySha256": body.sha256,
                                  "countOrigin": count.origin, "outputBound": body.max_output_tokens}
        if self.after_commit:
            self.after_commit()
        if self.lost_ack:
            raise RuntimeError("synthetic lost commit acknowledgement")
        return HoldReceipt(request_id, body.sha256, self.receipt_state)


class RecordingTransport(httpx.AsyncBaseTransport):
    """No socket, HTTP server or provider. Failures arise after recording a send."""
    def __init__(self, fail_first=None, response=None):
        self.requests = []
        self.fail_first = fail_first
        self.response = response

    async def handle_async_request(self, request):
        self.requests.append((request.method, str(request.url), request.content))
        if len(self.requests) == 1 and self.fail_first:
            raise self.fail_first("synthetic transport uncertainty", request=request)
        if self.response:
            return self.response(request)
        return httpx.Response(200, json=response_body())


def event_frame(event):
    """Literal AWS event-stream fixture framing, not a copied provider handler."""
    headers = b""
    for name, value in ((":message-type", "event"), (":event-type", "chunk"),
                        (":content-type", "application/json")):
        n, v = name.encode(), value.encode()
        headers += bytes([len(n)]) + n + b"\x07" + struct.pack(">H", len(v)) + v
    payload = json.dumps({"bytes": base64.b64encode(json.dumps(event).encode()).decode()}).encode()
    prelude = struct.pack(">II", 16 + len(headers) + len(payload), len(headers))
    message = prelude + struct.pack(">I", zlib.crc32(prelude)) + headers + payload
    return message + struct.pack(">I", zlib.crc32(message))


def sse_payloads(chunks):
    return [json.loads(line[5:].strip()) for line in b"".join(chunks).splitlines()
            if line.startswith(b"data:")]


class TransportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.assertEqual(importlib.metadata.version("litellm"), "1.104.2")
        self.dns_patch = patch("socket.getaddrinfo", _deny_dns)
        self.dns_patch.start()
        self.addCleanup(self.dns_patch.stop)
        self.clients = []

    async def asyncTearDown(self):
        for client in self.clients:
            await client.close()

    def setup_guard(self, *, transport=None, clock=time.monotonic, deadline=None, limits=BodyLimits()):
        counter, ledger = FixtureCounter(), FixtureLedger()
        guard = BedrockSendGuard(request_id="fixture-request-1", counter=counter, ledger=ledger,
          deadline=deadline if deadline is not None else clock() + 10,
          expected_count_origin="fixture", limits=limits, clock=clock)
        transport = transport or RecordingTransport()
        client = guarded_client(guard, transport=transport)
        self.clients.append(client)
        return guard, counter, ledger, transport, client

    async def public_call(self, client=None, **overrides):
        fields = {"model": MODEL, "max_tokens": 16,
                  "messages": [{"role": "user", "content": "synthetic"}], **PARAMS}
        if client is not None:
            fields["client"] = client
        fields.update(overrides)
        return await acreate(**fields)

    async def test_public_bedrock_route_uses_real_handler_and_exact_count_blob(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        self.assertIs(type(client), AsyncHTTPHandler)
        result = await self.public_call(client, system="synthetic system")
        self.assertEqual(result["stop_reason"], "end_turn")
        self.assertEqual(len(transport.requests), 1)
        method, url, raw = transport.requests[0]
        self.assertEqual((method, url), ("POST", URL))
        self.assertEqual(counter.parameters, [{"modelId": COUNT_MODEL_ID, "input": {"invokeModel": {"body": raw}}}])
        self.assertEqual(guard.native_body.raw, raw)
        self.assertEqual(guard.native_body.sha256, hashlib.sha256(raw).hexdigest())
        self.assertNotIn("model", json.loads(raw))
        self.assertNotIn("stream", json.loads(raw))
        self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")
        self.assertEqual(ledger.holds[guard.request_id]["countOrigin"], "fixture")
        # Real botocore serializer's Blob wire shape, without creating a client.
        operation = Session().get_service_model("bedrock-runtime").operation_model("CountTokens")
        serialized = create_serializer("rest-json").serialize_to_request(counter.parameters[0], operation)
        counted_bytes = base64.b64decode(json.loads(serialized["body"])["input"]["invokeModel"]["body"], validate=True)
        self.assertEqual(counted_bytes, raw)
        print(json.dumps({"proof": "actual-upstream-final-body", "countOrigin": "fixture",
            "invokeBytes": len(raw), "invokeSha256": hashlib.sha256(raw).hexdigest(),
            "countBlobSha256": hashlib.sha256(counter.parameters[0]["input"]["invokeModel"]["body"]).hexdigest(),
            "serializedCountBlobSha256": hashlib.sha256(counted_bytes).hexdigest()}, sort_keys=True))

    async def test_actual_customlogger_deployment_hook_can_inject_client(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        seen = []
        class Inject(CustomLogger):
            async def async_pre_call_deployment_hook(self, kwargs, call_type):
                seen.append(call_type)
                return {**kwargs, "client": client}
        old = litellm.callbacks
        try:
            litellm.callbacks = [Inject()]
            await self.public_call()
        finally:
            litellm.callbacks = old
        self.assertIn("anthropic_messages", seen)
        self.assertEqual(len(transport.requests), 1)
        self.assertTrue(guard.armed)

    async def test_streaming_route_count_blob_matches_actual_signed_body(self):
        events = [
            {"type": "message_start", "message": {**response_body(), "content": [], "stop_reason": None}},
            {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
            {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "synthetic"}},
            {"type": "content_block_stop", "index": 0},
            {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None}, "usage": {"output_tokens": 1}},
            {"type": "message_stop"},
        ]
        payload = b"".join(event_frame(x) for x in events)
        transport = RecordingTransport(response=lambda req: httpx.Response(200,
            headers={"content-type": "application/vnd.amazon.eventstream"}, content=payload))
        guard, counter, ledger, transport, client = self.setup_guard(transport=transport)
        stream = await self.public_call(client, stream=True)
        observed = [event async for event in stream]
        decoded = sse_payloads(observed)
        self.assertEqual([x["type"] for x in decoded], [x["type"] for x in events])
        self.assertEqual(decoded[-2]["delta"]["stop_reason"], "end_turn")
        self.assertEqual(decoded[-1], {"type": "message_stop"})
        self.assertEqual(transport.requests[0][1], URL + "-with-response-stream")
        self.assertEqual(counter.parameters[0]["input"]["invokeModel"]["body"], transport.requests[0][2])
        self.assertNotIn("stream", json.loads(transport.requests[0][2]))
        self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")

    async def test_actual_stream_truncation_and_semantic_error_remain_visible_and_unknown(self):
        start = {"type": "message_start", "message": {**response_body(), "content": [], "stop_reason": None}}
        for events in ([start], [start, {"type": "error", "error": {"type": "overloaded_error", "message": "synthetic"}}]):
            with self.subTest(eventTypes=[x["type"] for x in events]):
                payload = b"".join(event_frame(x) for x in events)
                transport = RecordingTransport(response=lambda req: httpx.Response(200,
                    headers={"content-type": "application/vnd.amazon.eventstream"}, content=payload))
                guard, counter, ledger, transport, client = self.setup_guard(transport=transport)
                stream = await self.public_call(client, stream=True)
                decoded = sse_payloads([chunk async for chunk in stream])
                self.assertTrue(any(x["type"] == "error" for x in decoded))
                self.assertFalse(any(x["type"] == "message_stop" for x in decoded))
                self.assertEqual(len(transport.requests), 1)
                self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")

    async def test_actual_tools_translation_preserves_counted_final_body(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        await self.public_call(client, tools=[{"name": "local_echo", "description": "synthetic echo",
            "input_schema": {"type": "object", "properties": {"thinking": {"type": "string"}}}}],
            messages=[{"role": "user", "content": "synthetic"},
                      {"role": "assistant", "content": [{"type": "tool_use", "id": "tool_1", "name": "local_echo", "input": {"thinking": "data", "api_base": "data"}}]},
                      {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "tool_1", "content": "synthetic result"}]}])
        raw = transport.requests[0][2]
        self.assertEqual(counter.parameters[0]["input"]["invokeModel"]["body"], raw)
        self.assertEqual(json.loads(raw)["messages"][1]["content"][0]["input"]["thinking"], "data")

    async def test_explicit_frozen_sdk_echo_name_uses_same_supported_client_seam(self):
        # A literal from the unchanged SDK loopback oracle, not a native SDK run.
        name = "mcp__wire__echo"
        guard, counter, ledger, transport, client = self.setup_guard(
            limits=BodyLimits(allowed_tool_names=frozenset({name})))
        await self.public_call(client, tools=[{"name": name, "description": "synthetic echo",
            "input_schema": {"type": "object", "properties": {"token": {"type": "string"}},
                             "required": ["token"], "additionalProperties": False}}])
        self.assertEqual(json.loads(transport.requests[0][2])["tools"][0]["name"], name)
        self.assertEqual(counter.parameters[0]["input"]["invokeModel"]["body"], transport.requests[0][2])

    async def test_real_upstream_connection_retry_without_guard_sends_twice(self):
        for failure in (httpx.RemoteProtocolError, httpx.ConnectError):
            with self.subTest(failure=failure.__name__):
                transport = RecordingTransport(failure)
                client = AsyncHTTPHandler(transport=transport, follow_redirects=False)
                self.clients.append(client)
                await self.public_call(client)
                self.assertEqual(len(transport.requests), 2)

    async def test_guard_prevents_internal_connection_retries_and_retains_unknown(self):
        for failure in (httpx.RemoteProtocolError, httpx.ConnectError):
            with self.subTest(failure=failure.__name__):
                guard, counter, ledger, transport, client = self.setup_guard(transport=RecordingTransport(failure))
                with self.assertRaises(Exception):
                    await self.public_call(client)
                self.assertEqual(len(transport.requests), 1)
                self.assertEqual(guard.hook_entries, 2)
                self.assertEqual(len(counter.parameters), 1)
                self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")

    async def test_actual_http400_thinking_retry_is_blocked_even_without_thinking_body(self):
        def invalid_signature(request):
            return httpx.Response(400, json={"message": "Invalid signature in thinking block"})
        # This actual upstream retry is selected from the response text. Denying
        # thinking in the admitted request alone does not eliminate the branch.
        unguarded = RecordingTransport(response=invalid_signature)
        client = AsyncHTTPHandler(transport=unguarded, follow_redirects=False)
        self.clients.append(client)
        with self.assertRaises(Exception):
            await self.public_call(client)
        self.assertEqual(len(unguarded.requests), 2)
        guard, counter, ledger, transport, client = self.setup_guard(
            transport=RecordingTransport(response=invalid_signature))
        with self.assertRaises(Exception):
            await self.public_call(client)
        self.assertEqual(len(transport.requests), 1)
        self.assertEqual(guard.hook_entries, 2)
        self.assertEqual(len(counter.parameters), 1)
        self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")

    async def test_http_failure_and_redirect_never_release_or_follow(self):
        for status in (400, 429, 500, 307):
            with self.subTest(status=status):
                transport = RecordingTransport(response=lambda req: httpx.Response(status,
                    headers={"location": "https://unqualified.invalid/"}, json={"error": {"type": "synthetic_error", "message": "synthetic"}}))
                guard, counter, ledger, transport, client = self.setup_guard(transport=transport)
                with self.assertRaises(Exception):
                    await self.public_call(client)
                self.assertEqual(len(transport.requests), 1)
                self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")

    async def test_count_failures_and_forged_observations_prevent_send(self):
        mutations = [("tokens", 0), ("tokens", True), ("tokens", 65537),
                     ("origin", "aws-counttokens"), ("model_id", "foreign-model"),
                     ("digest_override", "0" * 64), ("error", RuntimeError("synthetic count unavailable"))]
        for attr, value in mutations:
            with self.subTest(attr=attr, value=str(value)):
                guard, counter, ledger, transport, client = self.setup_guard()
                setattr(counter, attr, value)
                with self.assertRaises(AdmissionDenied):
                    await client.post(URL, json=native_body(), headers={"content-type": "application/json"})
                self.assertEqual(transport.requests, [])
                self.assertEqual(ledger.holds, {})

    async def test_ledger_failures_and_lost_commit_ack_never_send(self):
        for attr in ("error_before_commit", "lost_ack"):
            with self.subTest(attr=attr):
                guard, counter, ledger, transport, client = self.setup_guard()
                setattr(ledger, attr, True)
                with self.assertRaises(AdmissionDenied):
                    await client.post(URL, json=native_body(), headers={"content-type": "application/json"})
                self.assertEqual(transport.requests, [])
                self.assertEqual(bool(ledger.holds), attr == "lost_ack")
                if ledger.holds:
                    self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")

    async def test_invalid_receipt_denies_and_preserves_unknown(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        ledger.receipt_state = "REFUNDED"
        with self.assertRaises(AdmissionDenied):
            await client.post(URL, json=native_body(), headers={"content-type": "application/json"})
        self.assertEqual(transport.requests, [])
        self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")

    async def test_original_deadline_crossed_at_commit_keeps_unknown_without_send(self):
        clock = [1.0]
        guard, counter, ledger, transport, client = self.setup_guard(clock=lambda: clock[0], deadline=2.0)
        ledger.after_commit = lambda: clock.__setitem__(0, 3.0)
        with self.assertRaises(AdmissionDenied):
            await client.post(URL, json=native_body(), headers={"content-type": "application/json"})
        self.assertEqual(transport.requests, [])
        self.assertTrue(guard.armed)
        self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")

    async def test_count_timeout_denies_without_reservation_or_send(self):
        guard, counter, ledger, transport, client = self.setup_guard(deadline=time.monotonic() + .05)
        cancelled = []
        async def slow_count(parameters):
            try:
                await asyncio.Event().wait()
            finally:
                cancelled.append(True)
        counter.count = slow_count
        with self.assertRaisesRegex(AdmissionDenied, "COUNT_ADAPTER_FAILED"):
            await client.post(URL, json=native_body(), headers={"content-type": "application/json"})
        self.assertEqual(cancelled, [True])
        self.assertEqual(ledger.holds, {})
        self.assertEqual(transport.requests, [])

    async def test_cancellation_after_ledger_commit_preserves_unknown_without_send(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        committed = asyncio.Event()
        original = ledger.reserve_and_arm_once
        async def commit_then_wait(*args):
            await original(*args)
            committed.set()
            await asyncio.Event().wait()
        ledger.reserve_and_arm_once = commit_then_wait
        pending = asyncio.create_task(client.post(URL, json=native_body(), headers={"content-type": "application/json"}))
        try:
            await asyncio.wait_for(committed.wait(), 1)
            pending.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await pending
        finally:
            if not pending.done():
                pending.cancel()
                await asyncio.gather(pending, return_exceptions=True)
        self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")
        self.assertEqual(transport.requests, [])

    async def test_counter_body_drift_denies_before_ledger_or_send(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        original = counter.count
        async def drifting_count(parameters):
            parameters["input"]["invokeModel"]["body"] += b" "
            return await original(parameters)
        counter.count = drifting_count
        with self.assertRaisesRegex(AdmissionDenied, "COUNT_BODY_MISMATCH"):
            await client.post(URL, json=native_body(), headers={"content-type": "application/json"})
        self.assertEqual(ledger.holds, {})
        self.assertEqual(transport.requests, [])

    async def test_actual_public_route_foreign_profile_never_sends(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        with self.assertRaises(Exception):
            await self.public_call(client, model="bedrock/invoke/global.anthropic.claude-sonnet-4-6")
        self.assertEqual(counter.parameters, [])
        self.assertEqual(ledger.holds, {})
        self.assertEqual(transport.requests, [])

    async def test_parallel_calls_share_only_one_slot(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        results = await asyncio.gather(self.public_call(client), self.public_call(client), return_exceptions=True)
        self.assertEqual(sum(isinstance(x, Exception) for x in results), 1)
        self.assertEqual(len(transport.requests), 1)
        self.assertEqual(len(counter.parameters), 1)
        self.assertEqual(len(ledger.holds), 1)

    async def test_route_method_encoding_and_content_type_denied_before_count(self):
        cases = [("POST", URL.replace("us-east-1", "us-west-2"), {}),
                 ("POST", URL.replace(PROFILE_ID, "global.anthropic.claude-sonnet-4-6"), {}),
                 ("POST", URL + "?x=1", {}), ("GET", URL, {}),
                 ("POST", URL, {"content-type": "text/plain"}),
                 ("POST", URL, {"content-encoding": "gzip"}),
                 ("POST", URL, {"host": "foreign.invalid"}),
                 ("POST", URL, {"x-amzn-bedrock-service-tier": "priority"}),
                 ("POST", URL, {"x-amzn-bedrock-performanceconfig-latency": "optimized"}),
                 ("POST", URL, {"anthropic-beta": "unqualified"})]
        for method, url, headers in cases:
            with self.subTest(method=method, url=url, headers=headers):
                guard, counter, ledger, transport, client = self.setup_guard()
                request = client.client.build_request(method, url, content=json.dumps(native_body()).encode(),
                    headers={"content-type": "application/json", **headers})
                with self.assertRaises(AdmissionDenied):
                    await client.client.send(request)
                self.assertEqual(counter.parameters, [])
                self.assertEqual(transport.requests, [])


    async def test_lifetime_denied_before_count_has_no_hold_or_dispatch(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        self.assertIsNone(guard.lifetime_check)  # Outside a server context.
        def deny():
            raise AdmissionDenied("LOCAL_LIFETIME_DENIED")
        guard.lifetime_check = deny
        with self.assertRaises(Exception):
            await self.public_call(client)
        self.assertEqual(counter.parameters, [])
        self.assertEqual(ledger.holds, {})
        self.assertEqual(transport.requests, [])

    async def test_lifetime_revoked_after_count_prevents_hold_and_dispatch(self):
        guard, counter, ledger, transport, client = self.setup_guard()
        denied = False
        def check():
            if denied:
                raise AdmissionDenied("LOCAL_LIFETIME_DENIED")
        old = counter.count
        async def count(parameters):
            nonlocal denied
            result = await old(parameters)
            denied = True
            return result
        counter.count = count
        guard.lifetime_check = check
        with self.assertRaises(Exception):
            await self.public_call(client)
        self.assertEqual(len(counter.parameters), 1)
        self.assertEqual(ledger.holds, {})
        self.assertEqual(transport.requests, [])

    async def test_lifetime_revoked_after_hold_keeps_unknown_without_dispatch(self):
        guard, _, ledger, transport, client = self.setup_guard()
        denied = False
        def check():
            if denied:
                raise AdmissionDenied("LOCAL_LIFETIME_DENIED")
        def revoke():
            nonlocal denied
            denied = True
        guard.lifetime_check = check
        ledger.after_commit = revoke
        with self.assertRaises(Exception):
            await self.public_call(client)
        self.assertEqual(ledger.holds[guard.request_id]["state"], "UNKNOWN")
        self.assertEqual(transport.requests, [])


class BodyTests(unittest.TestCase):
    def inspect(self, body):
        return inspect_native_request("POST", URL, json.dumps(body).encode(), BodyLimits())

    def test_native_semantic_feature_and_shape_negatives(self):
        bad = []
        for key, value in (("model", "foreign"), ("stream", True), ("thinking", {"type": "enabled"}),
                           ("anthropic_beta", ["unknown"]), ("cache_control", {"type": "ephemeral"}),
                           ("max_tokens", 8193), ("max_tokens", True), ("max_tokens", 0),
                           ("messages", []), ("anthropic_version", "foreign"), ("temperature", 1)):
            bad.append({**native_body(), key: value})
        bad.extend([
            {**native_body(), "messages": [{"role": "user", "content": [{"type": "text", "text": "synthetic", "cache_control": {"type": "ephemeral"}}]}]},
            {**native_body(), "system": [{"type": "text", "text": "synthetic", "cache_control": {"type": "ephemeral"}}]},
            {**native_body(), "tools": [{"type": "web_search_20250305", "name": "web_search"}]},
            {**native_body(), "messages": [{"role": "assistant", "content": [{"type": "tool_use", "id": "tool_1", "name": [], "input": {}}]}]},
            {**native_body(), "tool_choice": {"type": "tool", "name": []}},
            {**native_body(), "messages": [{"role": "user", "content": [{"type": "tool_result", "tool_use_id": "tool_1", "content": [{"type": "image", "source": {}}]}]}]},
        ])
        for body in bad:
            with self.subTest(bodyKeys=sorted(body)):
                with self.assertRaises(AdmissionDenied):
                    self.inspect(body)

    def test_duplicate_nonfinite_truncated_and_bounded_raw_bytes(self):
        raws = [b'{"max_tokens":16,"max_tokens":1}', b'{', b'null',
                json.dumps(native_body()).encode().replace(b'16', b'NaN', 1),
                json.dumps(native_body()).encode().replace(b'16', b'1e999', 1),
                b' ' * (4 * 1024 * 1024 + 1)]
        for raw in raws:
            with self.subTest(bytes=len(raw)):
                with self.assertRaises(AdmissionDenied):
                    inspect_native_request("POST", URL, raw, BodyLimits())

    def test_qualification_limits_refuse_widening_or_malformed_names(self):
        for kwargs in ({"max_input_tokens": 65537}, {"max_output_tokens": 8193},
                       {"max_body_bytes": True}, {"allowed_tool_names": {"local_echo"}},
                       {"allowed_tool_names": frozenset({"bad.name"})}):
            with self.subTest(kwargs=str(kwargs)):
                with self.assertRaises(AdmissionDenied):
                    BodyLimits(**kwargs)


if __name__ == "__main__":
    unittest.main()
