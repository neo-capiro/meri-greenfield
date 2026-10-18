"""Local HTTPX provider boundary: raw Bedrock frames, no socket or model call."""
import base64
import hashlib
import json
import struct
import zlib

import httpx


def fields(value, prefix=""):
    """Record structure only. Never export prompt, text or credential values."""
    result = set()
    if type(value) is dict:
        for key, item in value.items():
            path = prefix + "." + key if prefix else key
            result.add(path)
            result.update(fields(item, path))
    elif type(value) is list:
        for item in value:
            result.update(fields(item, prefix + "[]"))
    return sorted(result)


def frame(event):
    headers = b""
    for name, value in ((":message-type", "event"), (":event-type", "chunk"),
                        (":content-type", "application/json")):
        key, content = name.encode(), value.encode()
        headers += bytes([len(key)]) + key + b"\x07" + struct.pack(">H", len(content)) + content
    body = json.dumps({"bytes": base64.b64encode(json.dumps(event, separators=(",", ":")).encode()).decode()},
                      separators=(",", ":")).encode()
    prelude = struct.pack(">II", 16 + len(headers) + len(body), len(headers))
    wire = prelude + struct.pack(">I", zlib.crc32(prelude)) + headers + body
    return wire + struct.pack(">I", zlib.crc32(wire))


def response_frames(mode="complete"):
    usage = {"input_tokens": 12, "output_tokens": 1}
    if mode == "cached":
        usage["cache_read_input_tokens"] = 1
    events = [
        {"type": "message_start", "message": {"id": "msg_offline", "type": "message",
         "role": "assistant", "model": "anthropic.claude-sonnet-4-6", "content": [],
         "stop_reason": None, "stop_sequence": None, "usage": usage}},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        {"type": "content_block_delta", "index": 0,
         "delta": {"type": "text_delta", "text": "Offline synthetic reply."}},
        {"type": "content_block_stop", "index": 0},
        {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None},
         "usage": {"output_tokens": 3}},
        {"type": "message_stop", "amazon-bedrock-invocationMetrics": {
         "inputTokenCount": 12, "outputTokenCount": 3, "invocationLatency": 1, "firstByteLatency": 1}},
    ]
    if mode == "missing-usage":
        del events[-2]["usage"]
    raw = b"".join(frame(event) for event in events)
    return raw[:-1] if mode == "truncated" else raw


class RawStream(httpx.AsyncByteStream):
    def __init__(self, raw):
        self.raw = raw

    async def __aiter__(self):
        for at in range(0, len(self.raw), 11):
            yield self.raw[at:at + 11]

    async def aclose(self):
        pass


class ProviderStub(httpx.AsyncBaseTransport):
    def __init__(self, mode, receipt):
        self.mode, self.receipt = mode, receipt

    async def handle_async_request(self, request):
        self.receipt["providerExecutions"] += 1
        if self.receipt["providerExecutions"] > 1:
            raise RuntimeError("OFFLINE_DUPLICATE_PROVIDER_EXECUTION")
        return httpx.Response(200, headers={"content-type": "application/vnd.amazon.eventstream"},
                              stream=RawStream(response_frames(self.mode)))

    async def aclose(self):
        pass


def request_observation(raw):
    value = json.loads(raw)
    result = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "fieldNames": fields(value),
              "topLevelTypes": {key: type(item).__name__ for key, item in value.items()},
              "topLevelArrayLengths": {key: len(item) for key, item in value.items() if type(item) is list}}
    if value.get("model") == "meri-sonnet-qualification":
        result["modelAlias"] = value["model"]
    if type(value.get("max_tokens")) is int:
        result["maxOutputTokens"] = value["max_tokens"]
    if type(value.get("stream")) is bool:
        result["stream"] = value["stream"]
    if type(value.get("tools")) is list:
        result["toolNames"] = [item["name"] for item in value["tools"] if type(item) is dict
            and type(item.get("name")) is str and 1 <= len(item["name"]) <= 128
            and all(c.isalnum() or c in "-_" for c in item["name"])]
    user_id = value.get("metadata", {}).get("user_id")
    if type(user_id) is str:
        result["metadataUserIdBytes"] = len(user_id.encode())
        try:
            decoded = json.loads(user_id)
            if type(decoded) is dict:
                result["metadataUserIdTypes"] = {key: type(item).__name__ for key, item in decoded.items()}
        except ValueError:
            result["metadataUserIdJson"] = False
    return result
