"""Strict native usage DATA, never settlement authority or automatic refund.

Supply only trusted transport bytes. Nonstream has type=message, not message_stop.
Stream input is one complete JSON payload from a decoded AWS SDK chunk.bytes;
this module does not parse AWS eventstream frames, SSE, or worker claims.
"""
from dataclasses import dataclass
import hashlib
import json
import re

from .bedrock_body import _bounded_json_tree, _pairs

_HASH = re.compile(r"[a-f0-9]{64}\Z")
_NAME = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_MODELS = frozenset({"anthropic.claude-sonnet-4-6", "claude-sonnet-4-6"})
_STOPS = frozenset({"end_turn", "max_tokens", "tool_use", "refusal", "model_context_window_exceeded"})
MAX_BYTES = 4 * 1024 * 1024


@dataclass(frozen=True)
class UsageBinding:
    request_id: str
    native_body_sha256: str
    raw_request_sha256: str
    pricing_revision: str
    counted_input_tokens: int
    max_output_tokens: int
    allowed_tool_names: frozenset = frozenset({"local_echo"})

    def __post_init__(self):
        if type(self.request_id) is not str or not _NAME.fullmatch(self.request_id):
            raise ValueError("INVALID_USAGE_BINDING")
        for x in (self.native_body_sha256, self.raw_request_sha256, self.pricing_revision):
            if type(x) is not str or not _HASH.fullmatch(x):raise ValueError("INVALID_USAGE_BINDING")
        _integer(self.counted_input_tokens, 1, 8192); _integer(self.max_output_tokens, 1, 256)
        if (type(self.allowed_tool_names) is not frozenset or len(self.allowed_tool_names) > 8
                or any(type(x) is not str or not _NAME.fullmatch(x) for x in self.allowed_tool_names)):
            raise ValueError("INVALID_USAGE_BINDING")


@dataclass(frozen=True)
class UsageResult:
    status: str
    binding: UsageBinding
    evidence_sha256: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    reason: str = "INCOMPLETE_NATIVE_USAGE"
    # DATA marker only. A caller can construct this class; it is not authentication.
    origin: str = "native-usage-data"


def _integer(x, low, high):
    if type(x) is not int or not low <= x <= high:raise ValueError("TOKEN_OR_INDEX_BOUND")
    return x


def _object(value, required, optional=()):
    if type(value) is not dict or not set(required) <= set(value) or set(value) - set(required) - set(optional):
        raise ValueError("UNSUPPORTED_NATIVE_SHAPE")


def _load(raw):
    if type(raw) is not bytes or not 1 <= len(raw) <= MAX_BYTES:raise ValueError("NATIVE_SIZE")
    value = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=_pairs,
                       parse_constant=lambda _: (_ for _ in ()).throw(ValueError("NONFINITE_JSON")))
    _bounded_json_tree(value)
    return value


def _usage(value, binding, *, delta=False):
    _object(value, ("output_tokens",) if delta else ("input_tokens", "output_tokens"),
            ("cache_creation_input_tokens", "cache_read_input_tokens"))
    for name in ("cache_creation_input_tokens", "cache_read_input_tokens"):
        if name in value:_integer(value[name], 0, 0)
    output = _integer(value["output_tokens"], 0, binding.max_output_tokens)
    if not delta and _integer(value["input_tokens"], 1, 8192) != binding.counted_input_tokens:
        raise ValueError("COUNT_USAGE_MISMATCH")
    return output


def _message(value, binding, *, start=False):
    _object(value, ("id", "type", "role", "model", "content", "stop_reason", "stop_sequence", "usage"))
    if (type(value["id"]) is not str or not 1 <= len(value["id"]) <= 256
            or value["type"] != "message" or value["role"] != "assistant"
            or type(value["model"]) is not str or value["model"] not in _MODELS
            or value["stop_sequence"] is not None or type(value["content"]) is not list
            or len(value["content"]) > 64):raise ValueError("UNSUPPORTED_NATIVE_MESSAGE")
    if start:
        if value["content"] != [] or value["stop_reason"] is not None:raise ValueError("INVALID_MESSAGE_START")
    elif type(value["stop_reason"]) is not str or value["stop_reason"] not in _STOPS:
        raise ValueError("INCOMPLETE_NATIVE_MESSAGE")
    return _usage(value["usage"], binding)


def _block(value, binding):
    if type(value) is not dict:raise ValueError("UNSUPPORTED_CONTENT")
    if value.get("type") == "text":
        _object(value, ("type", "text"))
        if type(value["text"]) is not str:raise ValueError("UNSUPPORTED_CONTENT")
        return "text"
    _object(value, ("type", "id", "name", "input"))
    if (value["type"] != "tool_use" or type(value["id"]) is not str or not _NAME.fullmatch(value["id"])
            or type(value["name"]) is not str or value["name"] not in binding.allowed_tool_names
            or type(value["input"]) is not dict):raise ValueError("UNSUPPORTED_CONTENT")
    return "tool_use"


def parse_complete_message(raw, binding, *, http_status, body_complete, content_type):
    """Explicit complete native HTTP body required; never reads a stream itself."""
    if type(binding) is not UsageBinding:raise ValueError("TYPED_USAGE_BINDING_REQUIRED")
    # Oversized/ill-typed input is not traversed for evidence hashing.
    evidence = hashlib.sha256(raw if type(raw) is bytes and len(raw) <= MAX_BYTES
                              else b"meri-native-usage/unretained-invalid-size").hexdigest()
    try:
        if type(http_status) is not int or http_status != 200 or body_complete is not True or content_type != "application/json":
            raise ValueError("INCOMPLETE_OR_FAILED_HTTP")
        value = _load(raw);output = _message(value, binding);ids=set()
        for block in value["content"]:
            if _block(block, binding) == "tool_use":
                if block["id"] in ids:raise ValueError("DUPLICATE_TOOL_ID")
                ids.add(block["id"])
        return UsageResult("COMPLETE", binding, evidence, binding.counted_input_tokens, output, "COMPLETE_NATIVE_MESSAGE")
    except (ValueError, TypeError, RecursionError, UnicodeError):
        return UsageResult("UNKNOWN", binding, evidence)


class NativeStreamUsage:
    """Finite lifecycle, sticky UNKNOWN. Finish only after observed transport EOF.

    Evidence SHA256 is domain-prefixed, uint64-length-framed exact chunk bytes;
    it is not the AWS outer-frame hash and retains no response content.
    """
    def __init__(self, binding):
        if type(binding) is not UsageBinding:raise ValueError("TYPED_USAGE_BINDING_REQUIRED")
        self.binding=binding; self.phase="START"; self.failed=False
        self.bytes=0; self.chunks=0; self.output=0; self.blocks={}; self.ids=set()
        self.hash=hashlib.sha256(b"meri-native-usage-stream/1\0"); self.finished=False

    def feed_native_chunk(self, raw):
        if self.finished:raise ValueError("USAGE_PARSER_FINISHED")
        self.chunks+=1
        if type(raw) is not bytes or not 1 <= len(raw) <= 262144 or self.bytes+len(raw)>MAX_BYTES or self.chunks>4096:
            self.failed=True;return
        self.bytes+=len(raw);self.hash.update(len(raw).to_bytes(8,"big"));self.hash.update(raw)
        if self.failed:return
        try:self._event(_load(raw))
        except (ValueError, TypeError, RecursionError, UnicodeError):self.failed=True

    def _event(self, event):
        if type(event) is not dict:raise ValueError("INVALID_EVENT")
        kind=event.get("type")
        if self.phase=="STOP":raise ValueError("TRAILING_EVENT")
        if kind=="ping":
            _object(event,("type",));return
        if self.phase=="START":
            _object(event,("type","message"))
            if kind!="message_start":raise ValueError("MISSING_START")
            self.output=_message(event["message"],self.binding,start=True);self.phase="BLOCKS";return
        if kind=="content_block_start" and self.phase=="BLOCKS":
            _object(event,("type","index","content_block"));index=_integer(event["index"],0,63)
            if index!=len(self.blocks) or any(not r["closed"] for r in self.blocks.values()):raise ValueError("BLOCK_ORDER")
            value=event["content_block"];typ=_block(value,self.binding)
            if typ=="tool_use":
                if value["input"]!={} or value["id"] in self.ids:raise ValueError("INVALID_TOOL_START")
                self.ids.add(value["id"])
            self.blocks[index]={"kind":typ,"closed":False,"json":b""};return
        if kind in ("content_block_delta","content_block_stop") and self.phase=="BLOCKS":
            _object(event,("type","index","delta") if kind.endswith("delta") else ("type","index"))
            index=_integer(event["index"],0,63);row=self.blocks.get(index)
            if row is None or row["closed"]:raise ValueError("BLOCK_ORDER")
            if kind.endswith("stop"):
                if row["kind"]=="tool_use" and row["json"] and type(_load(row["json"])) is not dict:raise ValueError("TOOL_JSON")
                row["closed"]=True;return
            value=event["delta"]
            if row["kind"]=="text":
                _object(value,("type","text"))
                if value["type"]!="text_delta" or type(value["text"]) is not str:raise ValueError("UNSUPPORTED_DELTA")
            else:
                _object(value,("type","partial_json"))
                if value["type"]!="input_json_delta" or type(value["partial_json"]) is not str:raise ValueError("UNSUPPORTED_DELTA")
                row["json"]+=value["partial_json"].encode("utf-8")
            return
        if kind=="message_delta" and self.phase in ("BLOCKS","DELTA"):
            _object(event,("type","delta","usage"));_object(event["delta"],("stop_reason","stop_sequence"))
            if (any(not r["closed"] for r in self.blocks.values()) or event["delta"]["stop_sequence"] is not None
                    or type(event["delta"]["stop_reason"]) is not str or event["delta"]["stop_reason"] not in _STOPS):raise ValueError("INVALID_MESSAGE_DELTA")
            output=_usage(event["usage"],self.binding,delta=True)
            if output<self.output:raise ValueError("USAGE_REGRESSION")
            self.output=output;self.phase="DELTA";return
        if kind=="message_stop" and self.phase=="DELTA":
            _object(event,("type",));self.phase="STOP";return
        raise ValueError("UNSUPPORTED_OR_OUT_OF_ORDER_EVENT")

    def finish(self, *, transport_complete, cancelled=False):
        if self.finished:raise ValueError("USAGE_PARSER_FINISHED")
        self.finished=True
        if self.failed or self.phase!="STOP" or transport_complete is not True or cancelled is not False:
            return UsageResult("UNKNOWN",self.binding,self.hash.hexdigest())
        return UsageResult("COMPLETE",self.binding,self.hash.hexdigest(),self.binding.counted_input_tokens,self.output,"COMPLETE_NATIVE_STREAM")
