"""Bound the final native request, after upstream translation and signing.

This small synthetic text/local-tool envelope is not the product Messages API.
Tool input and JSON schema are data; semantic block fields are validated separately.
"""
from dataclasses import dataclass
import hashlib
import json
import math
import re

# D1 (Neo, 2026-10-17): one admitted model envelope for every proxy check.
ENVELOPE_MAX_INPUT_TOKENS = 65536
ENVELOPE_MAX_OUTPUT_TOKENS = 8192

PROFILE_ID = "us.anthropic.claude-sonnet-4-6"
COUNT_MODEL_ID = "anthropic.claude-sonnet-4-6"
RUNTIME_HOST = "bedrock-runtime.us-east-1.amazonaws.com"
INVOKE_URLS = frozenset(
    "https://" + RUNTIME_HOST + "/model/" + PROFILE_ID + "/" + suffix
    for suffix in ("invoke", "invoke-with-response-stream")
)
_NAME = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")


class AdmissionDenied(ValueError):
    """Fixed reason codes, never request contents or credentials."""


@dataclass(frozen=True)
class BodyLimits:
    max_body_bytes: int = 4 * 1024 * 1024
    max_input_tokens: int = ENVELOPE_MAX_INPUT_TOKENS
    max_output_tokens: int = ENVELOPE_MAX_OUTPUT_TOKENS
    allowed_tool_names: frozenset = frozenset({"local_echo"})

    def __post_init__(self):
        for value in (self.max_body_bytes, self.max_input_tokens, self.max_output_tokens):
            if type(value) is not int or value <= 0:
                raise AdmissionDenied("INVALID_LIMITS")
        if self.max_body_bytes > 4 * 1024 * 1024 or self.max_input_tokens > ENVELOPE_MAX_INPUT_TOKENS or self.max_output_tokens > ENVELOPE_MAX_OUTPUT_TOKENS:
            raise AdmissionDenied("LIMITS_OUTSIDE_SPIKE_ENVELOPE")
        if type(self.allowed_tool_names) is not frozenset or len(self.allowed_tool_names) > 8:
            raise AdmissionDenied("INVALID_TOOL_ALLOWLIST")
        if any(type(x) is not str or not _NAME.fullmatch(x) for x in self.allowed_tool_names):
            raise AdmissionDenied("INVALID_TOOL_ALLOWLIST")


@dataclass(frozen=True)
class NativeBody:
    raw: bytes
    sha256: str
    max_output_tokens: int

    def count_parameters(self):
        """Boto3-shaped Blob input: serializer base64-encodes these exact bytes."""
        return {"modelId": COUNT_MODEL_ID, "input": {"invokeModel": {"body": self.raw}}}


def _deny(reason):
    raise AdmissionDenied(reason)


def _object(value, allowed, required=()):
    if type(value) is not dict or set(value) - set(allowed) or set(required) - set(value):
        _deny("UNSUPPORTED_BODY_SHAPE")


def _name(value):
    if type(value) is not str or not _NAME.fullmatch(value):
        _deny("INVALID_TOOL_IDENTITY")


def _pairs(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            _deny("DUPLICATE_JSON_KEY")
        out[key] = value
    return out


def _bounded_json_tree(value):
    todo = [(value, 0)]
    nodes = 0
    while todo:
        item, depth = todo.pop()
        nodes += 1
        if nodes > 100000 or depth > 32:
            _deny("JSON_STRUCTURE_BOUND")
        if type(item) is dict:
            todo.extend((k, depth + 1) for k in item)
            todo.extend((v, depth + 1) for v in item.values())
        elif type(item) is list:
            todo.extend((v, depth + 1) for v in item)
        elif type(item) is str:
            try:
                item.encode("utf-8", "strict")
            except UnicodeError:
                _deny("INVALID_UNICODE")
        elif type(item) is float and not math.isfinite(item):
            _deny("NONFINITE_JSON")
        elif item is not None and type(item) not in (int, float, bool):
            _deny("INVALID_JSON_TYPE")


def _text(block):
    _object(block, ("type", "text"), ("type", "text"))
    if block["type"] != "text" or type(block["text"]) is not str:
        _deny("UNSUPPORTED_TEXT_BLOCK")


def _content(content, role, limits):
    if type(content) is str:
        return
    if type(content) is not list or not 1 <= len(content) <= 64:
        _deny("INVALID_CONTENT")
    for block in content:
        if type(block) is not dict:
            _deny("INVALID_CONTENT")
        kind = block.get("type")
        if kind == "text":
            _text(block)
        elif kind == "tool_use" and role == "assistant":
            _object(block, ("type", "id", "name", "input"), ("type", "id", "name", "input"))
            _name(block["id"])
            if type(block["name"]) is not str or block["name"] not in limits.allowed_tool_names or type(block["input"]) is not dict:
                _deny("UNSUPPORTED_LOCAL_TOOL")
        elif kind == "tool_result" and role == "user":
            _object(block, ("type", "tool_use_id", "content", "is_error"), ("type", "tool_use_id", "content"))
            _name(block["tool_use_id"])
            if "is_error" in block and type(block["is_error"]) is not bool:
                _deny("INVALID_TOOL_RESULT")
            result = block["content"]
            if type(result) is list and 1 <= len(result) <= 64:
                for text in result:
                    _text(text)
            elif type(result) is not str:
                _deny("UNSUPPORTED_TOOL_RESULT")
        else:
            _deny("UNSUPPORTED_CONTENT_BLOCK")


def inspect_native_request(method, url, raw, limits):
    """Accept only the literal selected US profile endpoints and supported body."""
    if method != "POST" or url not in INVOKE_URLS:
        _deny("UNSUPPORTED_NATIVE_ROUTE")
    if type(raw) is not bytes or not 1 <= len(raw) <= limits.max_body_bytes:
        _deny("NATIVE_BODY_SIZE")
    try:
        body = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=_pairs,
                          parse_constant=lambda _: _deny("NONFINITE_JSON"))
    except (UnicodeError, json.JSONDecodeError, RecursionError, ValueError) as exc:
        if isinstance(exc, AdmissionDenied):
            raise
        _deny("MALFORMED_JSON")
    _bounded_json_tree(body)
    _object(body, ("anthropic_version", "max_tokens", "messages", "system", "tools", "tool_choice", "temperature"),
            ("anthropic_version", "max_tokens", "messages"))
    if body["anthropic_version"] != "bedrock-2023-05-31":
        _deny("UNSUPPORTED_NATIVE_VERSION")
    output = body["max_tokens"]
    if type(output) is not int or not 1 <= output <= limits.max_output_tokens:
        _deny("OUTPUT_BOUND")
    if "temperature" in body and (type(body["temperature"]) not in (int, float) or body["temperature"] != 0):
        _deny("UNQUALIFIED_SAMPLING")
    messages = body["messages"]
    if type(messages) is not list or not 1 <= len(messages) <= 64:
        _deny("INVALID_MESSAGES")
    for message in messages:
        _object(message, ("role", "content"), ("role", "content"))
        if message["role"] not in ("user", "assistant"):
            _deny("UNSUPPORTED_ROLE")
        _content(message["content"], message["role"], limits)
    if "system" in body:
        system = body["system"]
        if type(system) is list and 1 <= len(system) <= 64:
            for block in system:
                _text(block)
        elif type(system) is not str:
            _deny("UNSUPPORTED_SYSTEM")
    if "tools" in body:
        tools = body["tools"]
        if type(tools) is not list or not 1 <= len(tools) <= 8:
            _deny("INVALID_TOOLS")
        seen = set()
        for tool in tools:
            _object(tool, ("name", "description", "input_schema"), ("name", "input_schema"))
            name = tool["name"]
            if type(name) is not str or name not in limits.allowed_tool_names or name in seen:
                _deny("UNSUPPORTED_LOCAL_TOOL")
            seen.add(name)
            if type(tool["input_schema"]) is not dict or ("description" in tool and type(tool["description"]) is not str):
                _deny("INVALID_TOOL_SCHEMA")
    if "tool_choice" in body:
        choice = body["tool_choice"]
        _object(choice, ("type", "name", "disable_parallel_tool_use"), ("type",))
        if choice["type"] not in ("auto", "any", "tool"):
            _deny("UNSUPPORTED_TOOL_CHOICE")
        if (choice["type"] == "tool") != ("name" in choice):
            _deny("INVALID_TOOL_CHOICE")
        if "name" in choice and (type(choice["name"]) is not str or choice["name"] not in limits.allowed_tool_names):
            _deny("UNSUPPORTED_LOCAL_TOOL")
        if "disable_parallel_tool_use" in choice and choice["disable_parallel_tool_use"] is not True:
            _deny("UNQUALIFIED_PARALLEL_TOOLS")
    return NativeBody(raw=raw, sha256=hashlib.sha256(raw).hexdigest(), max_output_tokens=output)
