"""Offline native HTTPX response observation; no provider, DB or bridge socket."""
import base64
import gzip
import hashlib
import json
import struct
import unittest
import zlib

import httpx

from apps.proxy.product.response_settlement import NativeSettlementTransport
from apps.proxy.qualification.runtime.bedrock_body import NativeBody
from apps.proxy.qualification.runtime.native_usage import UsageBinding

RAW_REQUEST = b'{"synthetic":"final-native-body"}'
SHA = hashlib.sha256(RAW_REQUEST).hexdigest()
BINDING = UsageBinding("request-1", SHA, "b" * 64, "c" * 64, 7, 16)


def message():
    return {"id": "synthetic-message", "type": "message", "role": "assistant",
            "model": "claude-sonnet-4-6", "content": [{"type": "text", "text": "synthetic"}],
            "stop_reason": "end_turn", "stop_sequence": None,
            "usage": {"input_tokens": 7, "output_tokens": 3}}


def raw(value):
    return json.dumps(value, separators=(",", ":")).encode()


def events():
    start = message()
    start.update(content=[], stop_reason=None)
    start["usage"] = {"input_tokens": 7, "output_tokens": 0}
    return [{"type": "message_start", "message": start},
            {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
            {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "synthetic"}},
            {"type": "content_block_stop", "index": 0},
            {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None},
             "usage": {"output_tokens": 3}},
            {"type": "message_stop"}]


def frame(event):
    headers = b""
    for name, value in ((":message-type", "event"), (":event-type", "chunk"),
                        (":content-type", "application/json")):
        name, value = name.encode(), value.encode()
        headers += bytes([len(name)]) + name + b"\x07" + struct.pack(">H", len(value)) + value
    payload = raw({"bytes": base64.b64encode(raw(event)).decode()})
    prelude = struct.pack(">II", 16 + len(headers) + len(payload), len(headers))
    before_crc = prelude + struct.pack(">I", zlib.crc32(prelude)) + headers + payload
    return before_crc + struct.pack(">I", zlib.crc32(before_crc))


class Guard:
    armed = True
    hook_entries = 1
    request_id = BINDING.request_id
    native_body = NativeBody(RAW_REQUEST, SHA, 16)
    count_observation = type("Count", (), {"input_tokens": 7})()


class Chunks(httpx.AsyncByteStream):
    def __init__(self, parts, error=None):
        self.parts, self.error = parts, error

    async def __aiter__(self):
        for item in self.parts:
            yield item
        if self.error:
            raise self.error

    async def aclose(self):
        pass


class Inner(httpx.AsyncBaseTransport):
    def __init__(self, parts, status=200, headers=None, error=None):
        self.parts, self.status = parts, status
        self.headers = headers or {"content-type": "application/json"}
        self.error = error
        self.sends = 0

    async def handle_async_request(self, request):
        self.sends += 1
        return httpx.Response(self.status, headers=self.headers, stream=Chunks(self.parts, self.error))


class SettlementTests(unittest.IsolatedAsyncioTestCase):
    def setup_transport(self, parts, *, status=200, headers=None, error=None, guard=None,
                        callback=None, read_outcome=None):
        self.calls = []
        async def settle(request_id, result):
            self.calls.append((request_id, result))
            if callback:
                await callback()
        inner = Inner(parts, status=status, headers=headers, error=error)
        transport = NativeSettlementTransport(inner, guard=guard or Guard(),
                                              usage_binding=BINDING, settle_complete=settle,
                                              read_outcome=read_outcome)
        return inner, transport

    async def call(self, transport):
        async with httpx.AsyncClient(transport=transport) as client:
            return await client.post("https://bedrock-runtime.us-east-1.amazonaws.com/model/selected/invoke",
                                     content=RAW_REQUEST)

    async def test_nonstream_complete_settles_after_actual_eof_with_exact_usage(self):
        payload = raw(message())
        inner, transport = self.setup_transport([payload[:3], payload[3:]])
        response = await self.call(transport)
        self.assertEqual(response.content, payload)
        self.assertEqual(inner.sends, 1)
        self.assertEqual(len(self.calls), 1)
        slot, result = self.calls[0]
        self.assertEqual(slot, BINDING.request_id)
        self.assertEqual((result.status, result.input_tokens, result.output_tokens), ("COMPLETE", 7, 3))
        self.assertEqual(result.evidence_sha256, hashlib.sha256(payload).hexdigest())

    async def test_native_stream_fragmented_frames_settle_only_on_eof(self):
        payload = b"".join(frame(event) for event in events())
        # Split inside preludes, headers and JSON chunks, not only at frames.
        parts = [payload[i:i + 11] for i in range(0, len(payload), 11)]
        _, transport = self.setup_transport(parts, headers={"content-type": "application/vnd.amazon.eventstream"})
        self.assertEqual((await self.call(transport)).content, payload)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual((self.calls[0][1].input_tokens, self.calls[0][1].output_tokens), (7, 3))

    async def test_http_error_malformed_or_semantically_incomplete_stays_unknown(self):
        valid = raw(message())
        for parts, status, headers in (([valid], 500, None), ([valid[:-1]], 200, None),
                                       ([valid], 200, {"content-type": "text/plain"}),
                                       ([valid], 200, {"content-type": "application/json", "content-length": "1"}),
                                       ([gzip.compress(valid)], 200, {"content-type": "application/json", "content-encoding": "gzip"})):
            with self.subTest(status=status, headers=headers):
                _, transport = self.setup_transport(parts, status=status, headers=headers)
                await self.call(transport)
                self.assertEqual(self.calls, [])

    async def test_eventstream_crc_truncated_frame_and_missing_terminal_stay_unknown(self):
        payload = b"".join(frame(event) for event in events())
        damaged = bytearray(payload)
        damaged[-1] ^= 1
        for wire in (bytes(damaged), payload[:-1],
                     b"".join(frame(event) for event in events()[:-1])):
            with self.subTest(wire_length=len(wire)):
                _, transport = self.setup_transport([wire], headers={"content-type": "application/vnd.amazon.eventstream"})
                await self.call(transport)
                self.assertEqual(self.calls, [])

    async def test_early_close_and_stream_exception_do_not_settle(self):
        payload = raw(message())
        _, transport = self.setup_transport([payload[:3], payload[3:]])
        async with httpx.AsyncClient(transport=transport) as client:
            async with client.stream("POST", "https://bedrock-runtime.us-east-1.amazonaws.com/model/selected/invoke",
                                     content=RAW_REQUEST) as response:
                self.assertEqual(await anext(response.aiter_raw()), payload[:3])
        self.assertEqual(self.calls, [])
        _, transport = self.setup_transport([payload[:3]], error=RuntimeError("synthetic stream failure"))
        with self.assertRaisesRegex(RuntimeError, "synthetic stream failure"):
            await self.call(transport)
        self.assertEqual(self.calls, [])

    async def test_unarmed_or_drifted_slot_denies_before_send(self):
        guard = Guard()
        guard.armed = False
        inner, transport = self.setup_transport([raw(message())], guard=guard)
        with self.assertRaisesRegex(Exception, "UNARMED_SETTLEMENT_SLOT"):
            await self.call(transport)
        self.assertEqual(inner.sends, 0)
        inner, transport = self.setup_transport([raw(message())])
        async with httpx.AsyncClient(transport=transport) as client:
            with self.assertRaisesRegex(Exception, "NATIVE_BODY_DRIFT"):
                await client.post("https://bedrock-runtime.us-east-1.amazonaws.com/model/selected/invoke",
                                  content=b"different")
        self.assertEqual(inner.sends, 0)

    async def test_uncertain_bridge_failure_never_rearms_send(self):
        async def uncertain():
            raise RuntimeError("synthetic lost settlement acknowledgement")
        inner, transport = self.setup_transport([raw(message())], callback=uncertain)
        with self.assertRaisesRegex(RuntimeError, "lost settlement acknowledgement"):
            await self.call(transport)
        self.assertEqual(inner.sends, 1)
        self.assertEqual(len(self.calls), 1)

    async def test_lost_ack_reads_committed_settlement_without_second_inference(self):
        async def lost_ack():
            raise RuntimeError("synthetic lost settlement acknowledgement")
        reads = []
        async def read_outcome(slot):
            reads.append(slot)
            return {"requestId": slot, "state": "SETTLED", "actualMicroUSD": "42"}
        inner, transport = self.setup_transport([raw(message())], callback=lost_ack,
                                                 read_outcome=read_outcome)
        self.assertEqual((await self.call(transport)).status_code, 200)
        self.assertEqual(reads, [BINDING.request_id])
        self.assertEqual(inner.sends, 1)
        self.assertEqual(len(self.calls), 1)

    async def test_unresolved_or_mismatched_read_outcome_preserves_failure(self):
        async def lost_ack():
            raise RuntimeError("synthetic lost settlement acknowledgement")
        for outcome in ({"requestId": BINDING.request_id, "state": "UNKNOWN", "actualMicroUSD": None},
                        {"requestId": "other", "state": "SETTLED", "actualMicroUSD": "42"},
                        {"requestId": BINDING.request_id, "state": "SETTLED", "actualMicroUSD": None}):
            with self.subTest(outcome=outcome):
                async def read_outcome(_slot):
                    return outcome
                inner, transport = self.setup_transport([raw(message())], callback=lost_ack,
                                                         read_outcome=read_outcome)
                with self.assertRaisesRegex(RuntimeError, "lost settlement acknowledgement"):
                    await self.call(transport)
                self.assertEqual(inner.sends, 1)


if __name__ == "__main__":
    unittest.main()
