"""Native terminal bytes require canonical settlement proof before SDK parsing.

Real native CRC/frame/usage parsers and canonical transport; synthetic source,
armed reservation and authenticated settlement stand-ins. No provider calls.
"""
import asyncio
import base64
import hashlib
import json
import struct
from types import SimpleNamespace
import unittest
import zlib

from botocore.eventstream import EventStreamBuffer
import httpx

from apps.proxy.product.response_settlement import (
    NativeSettlementTransport, SettlementCommitUncertain, SettlementContext, _native_chunk,
)
from apps.proxy.qualification.runtime.bedrock_body import (
    AdmissionDenied, BodyLimits, INVOKE_URLS, inspect_native_request,
)


URL = sorted(INVOKE_URLS)[-1]
SCHEMA = {"type": "object", "properties": {"reply": {"type": "string"}},
          "required": ["reply"], "additionalProperties": False}


def raw(value):
    return json.dumps(value, separators=(",", ":")).encode()


def frame(event):
    # Literal AWS event-stream fixture framing; canonical botocore verifies it.
    headers = b""
    for name, value in ((":message-type", "event"), (":event-type", "chunk"),
                        (":content-type", "application/json")):
        name, value = name.encode(), value.encode()
        headers += bytes([len(name)]) + name + b"\x07" + struct.pack(">H", len(value)) + value
    payload = raw({"bytes": base64.b64encode(raw(event)).decode()})
    prelude = struct.pack(">II", 16 + len(headers) + len(payload), len(headers))
    wire = prelude + struct.pack(">I", zlib.crc32(prelude)) + headers + payload
    return wire + struct.pack(">I", zlib.crc32(wire))


def message():
    return {"id": "msg_synthetic", "type": "message", "role": "assistant",
            "model": "claude-sonnet-4-6", "content": [{"type": "text", "text": "synthetic"}],
            "stop_reason": "end_turn", "stop_sequence": None,
            "usage": {"input_tokens": 12, "output_tokens": 3}}


def frames(*, structured=False):
    start = message();start.update(content=[], stop_reason=None)
    start["usage"]["output_tokens"] = 0
    block = ({"type": "tool_use", "id": "tool_1", "name": "StructuredOutput", "input": {}}
             if structured else {"type": "text", "text": ""})
    delta = ({"type": "input_json_delta", "partial_json": '{"reply":"synthetic"}'}
             if structured else {"type": "text_delta", "text": "synthetic"})
    return [frame(event) for event in (
        {"type": "message_start", "message": start},
        {"type": "content_block_start", "index": 0, "content_block": block},
        {"type": "content_block_delta", "index": 0, "delta": delta},
        {"type": "content_block_stop", "index": 0},
        {"type": "message_delta", "delta": {
            "stop_reason": "tool_use" if structured else "end_turn", "stop_sequence": None},
         "usage": {"output_tokens": 3}},
        {"type": "message_stop"},
    )]


def decoded_events(chunks):
    parser = EventStreamBuffer();parser.add_data(b"".join(chunks))
    return [json.loads(_native_chunk(event)) for event in parser]


class Source(httpx.AsyncByteStream):
    def __init__(self, chunks):
        self.chunks, self.closed, self.close_calls = chunks, False, 0

    async def __aiter__(self):
        for chunk in self.chunks:
            yield chunk

    async def aclose(self):
        self.close_calls += 1
        self.closed = True


class Inner(httpx.AsyncBaseTransport):
    def __init__(self, source, content_type):
        self.source, self.content_type, self.calls = source, content_type, 0

    async def handle_async_request(self, request):
        self.calls += 1
        return httpx.Response(200, stream=self.source, request=request,
                              headers={"content-type": self.content_type})


class TerminalGateTests(unittest.IsolatedAsyncioTestCase):
    async def stream(self, chunks, complete, *, read_outcome=None, structured=False, json_body=False):
        names = frozenset({"StructuredOutput"}) if structured else frozenset({"local_echo"})
        limits = BodyLimits(allowed_tool_names=names,
                            structured_output_schema_json=json.dumps(SCHEMA) if structured else None)
        request_body = {"anthropic_version": "bedrock-2023-05-31", "max_tokens": 16,
                        "messages": [{"role": "user", "content": "synthetic"}]}
        if structured:
            request_body["tools"] = [{"name": "StructuredOutput", "input_schema": SCHEMA}]
        body = inspect_native_request("POST", URL, raw(request_body), limits)
        context = SettlementContext("request_A", "b" * 64, "c" * 64, names)
        guard = SimpleNamespace(armed=True, hook_entries=1, request_id=context.request_id,
            expected_count_origin="aws-counttokens", native_body=body,
            count_observation=SimpleNamespace(origin="aws-counttokens", input_tokens=12,
                native_body_sha256=body.sha256),
            hold_receipt=SimpleNamespace(request_id=context.request_id,
                native_body_sha256=body.sha256, state="UNKNOWN"),
            ledger=SimpleNamespace(reserved_raw_request_sha256=context.raw_request_sha256))
        source = Source(chunks)
        inner = Inner(source, "application/json" if json_body else "application/vnd.amazon.eventstream")
        transport = NativeSettlementTransport(inner, guard=guard, context=context,
            settle_complete=complete, read_outcome=read_outcome)
        response = await transport.handle_async_request(httpx.Request("POST", URL, content=body.raw))
        return response.stream, source, inner

    async def collect(self, stream, emitted):
        try:
            async for chunk in stream:
                emitted.append(chunk)
        finally:
            await stream.aclose()

    async def test_terminal_is_withheld_through_ack_for_coalesced_split_and_structured_frames(self):
        for structured in (False, True):
            wire_frames = frames(structured=structured);wire = b"".join(wire_frames)
            for chunks in ([wire], wire_frames, [wire[i:i+11] for i in range(0, len(wire), 11)]):
                with self.subTest(structured=structured, chunks=len(chunks)):
                    entered, release = asyncio.Event(), asyncio.Event()
                    claims, emitted = [], []
                    async def complete(identifier, claim):
                        claims.append((identifier, claim));entered.set();await release.wait()
                    stream, source, inner = await self.stream(chunks, complete, structured=structured)
                    task = asyncio.create_task(self.collect(stream, emitted))
                    try:
                        await asyncio.wait_for(entered.wait(), 2)
                        observed = decoded_events(emitted)
                        self.assertNotIn("message_delta", [e["type"] for e in observed])
                        self.assertNotIn("message_stop", [e["type"] for e in observed])
                        self.assertFalse(any(e.get("content_block", {}).get("type") == "tool_use" for e in observed))
                        if not structured and chunks is wire_frames:
                            self.assertEqual(emitted, wire_frames[:4], "early text continues streaming")
                        self.assertFalse(task.done())
                    finally:
                        release.set();await task
                    self.assertEqual(b"".join(emitted), wire)
                    self.assertEqual((len(claims), inner.calls, source.closed), (1, 1, True))
                    self.assertEqual(hashlib.sha256(b"".join(emitted)).digest(), hashlib.sha256(wire).digest())

    async def test_json_body_is_withheld_until_ack(self):
        entered, release = asyncio.Event(), asyncio.Event();emitted = []
        async def complete(*_):
            entered.set();await release.wait()
        wire = raw(message())
        stream, source, _ = await self.stream([wire[:20], wire[20:]], complete, json_body=True)
        task = asyncio.create_task(self.collect(stream, emitted))
        try:
            await asyncio.wait_for(entered.wait(), 2)
            self.assertEqual(emitted, [])
        finally:
            release.set();await task
        self.assertEqual(b"".join(emitted), wire);self.assertTrue(source.closed)

    async def test_invalid_truncated_and_trailing_frames_never_release_terminals_or_settle(self):
        for structured in (False, True):
            wire_frames = frames(structured=structured)
            cases = ([b"".join(wire_frames)[:-1]], wire_frames[:-1] + [wire_frames[-1][:-1]],
                     wire_frames + [b"trailing"], wire_frames + [frame({"type": "ping"})],
                     wire_frames[:-1] + [wire_frames[-1][:-1] + bytes([wire_frames[-1][-1] ^ 1])])
            for chunks in cases:
                with self.subTest(structured=structured, chunks=len(chunks)):
                    claims, emitted = [], []
                    async def complete(*claim):
                        claims.append(claim)
                    stream, source, inner = await self.stream(chunks, complete, structured=structured)
                    with self.assertRaisesRegex(AdmissionDenied, "INCOMPLETE_NATIVE_RESPONSE"):
                        await self.collect(stream, emitted)
                    observed = decoded_events(emitted)
                    self.assertFalse(any(e["type"] in ("message_delta", "message_stop") for e in observed))
                    self.assertFalse(any(e.get("content_block", {}).get("type") == "tool_use" for e in observed))
                    self.assertEqual((claims, inner.calls, source.closed), ([], 1, True))

    async def test_lost_ack_releases_only_after_exact_settled_readback(self):
        for outcome in ({"requestId": "request_A", "state": "SETTLED", "actualMicroUSD": "90"},
                        {"requestId": "request_A", "state": "UNKNOWN", "actualMicroUSD": None},
                        {"requestId": "other", "state": "SETTLED", "actualMicroUSD": "90"},
                        RuntimeError("synthetic unavailable readback")):
            with self.subTest(outcome=outcome):
                claims, reads, emitted = [], [], []
                async def complete(*claim):
                    claims.append(claim);raise SettlementCommitUncertain("synthetic lost ACK")
                async def read(identifier):
                    reads.append(identifier)
                    if isinstance(outcome, Exception):
                        raise outcome
                    return outcome
                wire_frames = frames(structured=True)
                stream, source, inner = await self.stream(wire_frames, complete, read_outcome=read, structured=True)
                if type(outcome) is dict and outcome.get("requestId") == "request_A" and outcome.get("state") == "SETTLED":
                    await self.collect(stream, emitted)
                    self.assertEqual(b"".join(emitted), b"".join(wire_frames))
                else:
                    with self.assertRaisesRegex(SettlementCommitUncertain, "synthetic lost ACK"):
                        await self.collect(stream, emitted)
                    self.assertEqual([e["type"] for e in decoded_events(emitted)], ["message_start"])
                self.assertEqual((len(claims), reads, inner.calls, source.closed), (1, ["request_A"], 1, True))

    async def test_cancellation_and_wire_bounds_never_flush_held_terminals(self):
        for action in ("cancel", "close"):
            entered, release = asyncio.Event(), asyncio.Event();emitted = []
            async def pending(*_):
                entered.set();await release.wait()
            stream, source, _ = await self.stream(frames(structured=True), pending, structured=True)
            task = asyncio.create_task(self.collect(stream, emitted))
            await asyncio.wait_for(entered.wait(), 2)
            if action == "cancel":
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
            else:
                await stream.aclose();release.set()
                with self.assertRaisesRegex(AdmissionDenied, "INCOMPLETE_NATIVE_RESPONSE"):
                    await task
            self.assertEqual([e["type"] for e in decoded_events(emitted)], ["message_start"])
            self.assertEqual((source.closed, source.close_calls), (True, 1))
        async def forbidden(*_):
            self.fail("oversized response must not settle")
        for json_body, bound in ((False, 8 * 1024 * 1024), (True, 4 * 1024 * 1024)):
            emitted = []
            stream, source, _ = await self.stream([b"x" * (bound+1)], forbidden, json_body=json_body)
            with self.assertRaisesRegex(AdmissionDenied, "INCOMPLETE_NATIVE_RESPONSE"):
                await self.collect(stream, emitted)
            self.assertEqual(emitted, []);self.assertTrue(source.closed)


if __name__ == "__main__":
    unittest.main()
