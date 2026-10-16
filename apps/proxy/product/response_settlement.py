"""Observe one actual native HTTPX response before requesting model settlement.

The injected callback must be a private, authenticated host bridge to the canonical
product-model-settlement owner. This module never reads worker usage claims,
creates a DB connection, releases a hold, or makes a provider request. A typed
UsageResult is data, not proof of its own provenance outside this host.
"""
import base64
import binascii
import hashlib
import json

from botocore.eventstream import EventStreamBuffer
import httpx

from ..qualification.runtime.bedrock_body import AdmissionDenied, NativeBody
from ..qualification.runtime.native_usage import (
    MAX_BYTES, NativeStreamUsage, UsageBinding, parse_complete_message,
)

_MAX_WIRE_BYTES = 8 * 1024 * 1024
_MAX_NATIVE_CHUNK = 262144
_STREAM_TYPE = "application/vnd.amazon.eventstream"
_JSON_TYPE = "application/json"
_CHUNK_HEADERS = {
    ":message-type": "event",
    ":event-type": "chunk",
    ":content-type": _JSON_TYPE,
}
_MAX_MONEY = (1 << 63) - 1


def _settled_outcome(value, request_id):
    """Read-only JS owner result; malformed or unresolved means no ACK proof."""
    if type(value) is not dict or set(value) != {"requestId", "state", "actualMicroUSD"}:
        return False
    if value["requestId"] != request_id or value["state"] != "SETTLED":
        return False
    actual = value["actualMicroUSD"]
    return (type(actual) is str and 1 <= len(actual) <= 19
            and actual.isascii() and actual.isdecimal()
            and (actual == "0" or not actual.startswith("0"))
            and int(actual) <= _MAX_MONEY)


def _pairs(values):
    result = {}
    for key, value in values:
        if key in result:
            raise ValueError("DUPLICATE_EVENT_KEY")
        result[key] = value
    return result


def _native_chunk(frame):
    """Decode only the selected Bedrock chunk envelope after botocore CRCs."""
    if frame.headers != _CHUNK_HEADERS or len(frame.payload) > _MAX_NATIVE_CHUNK * 2:
        raise ValueError("UNSUPPORTED_EVENT_FRAME")
    envelope = json.loads(frame.payload.decode("utf-8", "strict"), object_pairs_hook=_pairs)
    if type(envelope) is not dict or set(envelope) != {"bytes"} or type(envelope["bytes"]) is not str:
        raise ValueError("UNSUPPORTED_EVENT_FRAME")
    value = base64.b64decode(envelope["bytes"], validate=True)
    if not 1 <= len(value) <= _MAX_NATIVE_CHUNK:
        raise ValueError("NATIVE_CHUNK_SIZE")
    return value


class _ObservedResponseStream(httpx.AsyncByteStream):
    def __init__(self, source, status, headers, binding, complete, read_outcome):
        self.source, self.status, self.binding, self.complete = source, status, binding, complete
        self.read_outcome = read_outcome
        self.content_type = headers.get("content-type")
        self.encoding = headers.get("content-encoding")
        self.length = headers.get("content-length")
        self.bytes_seen = 0
        self.invalid = False
        self.eof = False
        self.closed = False
        self.body = bytearray()
        self.frames = EventStreamBuffer() if self.content_type == _STREAM_TYPE else None
        self.native = NativeStreamUsage(binding) if self.frames is not None else None

    def _consume(self, chunk):
        if type(chunk) is not bytes:
            self.invalid = True
            return
        self.bytes_seen += len(chunk)
        if self.bytes_seen > (_MAX_WIRE_BYTES if self.frames is not None else MAX_BYTES):
            self.invalid = True
        if self.invalid or not chunk:
            return
        if self.frames is None:
            self.body.extend(chunk)
            return
        try:
            self.frames.add_data(chunk)
            for frame in self.frames:
                self.native.feed_native_chunk(_native_chunk(frame))
        except (ValueError, TypeError, UnicodeError, binascii.Error, OverflowError):
            self.invalid = True
        except Exception:
            # botocore eventstream raises dedicated CRC/length exceptions. They
            # are semantic failure, never evidence to settle the liability.
            self.invalid = True

    def _result(self):
        if (self.status != 200 or self.encoding is not None
                or self.content_type not in (_JSON_TYPE, _STREAM_TYPE) or self.invalid):
            return None
        if self.length is not None:
            if (not 1 <= len(self.length) <= 20 or not self.length.isascii()
                    or not self.length.isdecimal() or int(self.length) != self.bytes_seen):
                return None
        if self.frames is None:
            return parse_complete_message(bytes(self.body), self.binding, http_status=200,
                                          body_complete=self.eof, content_type=_JSON_TYPE)
        # Pinned botocore EventStreamBuffer retains a partial final frame in
        # _data. An HTTP EOF is insufficient when this buffer is nonempty.
        if self.frames._data:
            return None
        return self.native.finish(transport_complete=self.eof)

    async def __aiter__(self):
        if self.closed:
            raise RuntimeError("NATIVE_RESPONSE_ALREADY_CLOSED")
        try:
            async for chunk in self.source:
                self._consume(chunk)
                yield chunk
            self.eof = True
            result = self._result()
            if result is not None and result.status == "COMPLETE":
                # The host bridge must authenticate this process and bind the
                # original reservation, task, hashes and current tenant owner.
                # A failed/uncertain callback leaves the durable hold UNKNOWN.
                try:
                    await self.complete(self.binding.request_id, result)
                except Exception as settlement_error:
                    # The transaction may have committed before its ACK was
                    # lost. Reconcile only through the canonical owner's
                    # readOutcome; never retry inference or release UNKNOWN.
                    if self.read_outcome is None:
                        raise
                    try:
                        outcome = await self.read_outcome(self.binding.request_id)
                    except Exception:
                        raise settlement_error from None
                    if not _settled_outcome(outcome, self.binding.request_id):
                        raise settlement_error
        finally:
            self.closed = True

    async def aclose(self):
        self.closed = True
        await self.source.aclose()


class NativeSettlementTransport(httpx.AsyncBaseTransport):
    """Single-send HTTPX adapter composed inside the existing guarded client.

    `guard` and `usage_binding` are constructor-captured by trusted startup.
    Their Python types alone do not authenticate a cross-process settlement
    message; the injected bridge must do that before exposing it to JS.
    """
    def __init__(self, inner, *, guard, usage_binding, settle_complete, read_outcome=None):
        if (not isinstance(inner, httpx.AsyncBaseTransport)
                or type(usage_binding) is not UsageBinding or not callable(settle_complete)
                or (read_outcome is not None and not callable(read_outcome))):
            raise AdmissionDenied("INVALID_SETTLEMENT_COMPOSITION")
        self.inner, self.guard = inner, guard
        self.usage_binding, self.settle_complete = usage_binding, settle_complete
        self.read_outcome = read_outcome
        self.entered = False

    async def handle_async_request(self, request):
        if self.entered:
            raise AdmissionDenied("SECOND_NATIVE_SEND_DENIED")
        self.entered = True
        body = getattr(self.guard, "native_body", None)
        count = getattr(self.guard, "count_observation", None)
        if (getattr(self.guard, "armed", False) is not True
                or getattr(self.guard, "hook_entries", None) != 1
                or type(body) is not NativeBody or count is None
                or getattr(self.guard, "request_id", None) != self.usage_binding.request_id
                or body.sha256 != self.usage_binding.native_body_sha256
                or body.max_output_tokens != self.usage_binding.max_output_tokens
                or getattr(count, "input_tokens", None) != self.usage_binding.counted_input_tokens):
            raise AdmissionDenied("UNARMED_SETTLEMENT_SLOT")
        try:
            raw = request.content
        except httpx.RequestNotRead as exc:
            raise AdmissionDenied("UNQUALIFIED_STREAMING_REQUEST_BODY") from exc
        if raw != body.raw or hashlib.sha256(raw).hexdigest() != body.sha256:
            raise AdmissionDenied("NATIVE_BODY_DRIFT")
        response = await self.inner.handle_async_request(request)
        if not isinstance(response, httpx.Response) or not isinstance(response.stream, httpx.AsyncByteStream):
            raise AdmissionDenied("INVALID_NATIVE_RESPONSE")
        response.stream = _ObservedResponseStream(response.stream, response.status_code,
                                                  response.headers, self.usage_binding,
                                                  self.settle_complete, self.read_outcome)
        return response

    async def aclose(self):
        await self.inner.aclose()
