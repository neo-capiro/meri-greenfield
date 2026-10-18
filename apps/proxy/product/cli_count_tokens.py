"""The pinned Claude Code CLI's CountTokens request, behind trusted ingress.

This ASGI application owns only wire classification and response shaping. The
caller must wrap it in the existing peer, model-grant, revocation and lifetime
owner. An injected counting function owns the fixed upstream CountTokens call;
this module has no provider client, credential lookup, or inference path.
"""
import json
import math
import re

from ..qualification.runtime.bedrock_body import ENVELOPE_MAX_INPUT_TOKENS
from ..qualification.runtime.lifetime import _current_lifetime_check
from ..qualification.state.pricing import StateDenied


COUNT_PATH = "/v1/messages/count_tokens"
COUNT_QUERY = b"beta=true"
MAX_BODY_BYTES = 4 * 1024 * 1024
MAX_EVENTS = 4096
_BETAS = frozenset({
    "token-counting-2024-11-01",
    "claude-code-20250219",
    "interleaved-thinking-2025-05-14",
    "context-management-2025-06-27",
    "oauth-2025-04-20",
})
_NAME = re.compile(r"[A-Za-z][A-Za-z0-9_]{0,127}\Z")
_TOOL_ID = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")


def _deny(code):
    raise StateDenied(code)


def _pairs(items):
    value = {}
    for key, item in items:
        if key in value:
            _deny("COUNT_DUPLICATE_JSON_KEY")
        value[key] = item
    return value


def _tree(value):
    stack = [(value, 0)]
    nodes = 0
    while stack:
        item, depth = stack.pop()
        nodes += 1
        if nodes > 100000 or depth > 32:
            _deny("COUNT_JSON_BOUND")
        if type(item) is dict:
            stack.extend((key, depth + 1) for key in item)
            stack.extend((child, depth + 1) for child in item.values())
        elif type(item) is list:
            stack.extend((child, depth + 1) for child in item)
        elif type(item) is str:
            try:
                item.encode("utf-8", "strict")
            except UnicodeError:
                _deny("COUNT_INVALID_UNICODE")
        elif type(item) is float:
            if not math.isfinite(item):
                _deny("COUNT_NONFINITE_JSON")
        elif item is not None and type(item) not in (int, bool):
            _deny("COUNT_INVALID_JSON")


def _headers(scope):
    headers = scope.get("headers")
    if type(headers) is not list or len(headers) > 64:
        _deny("COUNT_HEADERS_REQUIRED")
    seen = {}
    for entry in headers:
        if (type(entry) not in (tuple, list) or len(entry) != 2
                or type(entry[0]) is not bytes or type(entry[1]) is not bytes
                or entry[0] in seen):
            _deny("COUNT_HEADERS_REFUSED")
        seen[entry[0]] = entry[1]
    if (seen.get(b"content-type") != b"application/json"
            or seen.get(b"anthropic-version") != b"2023-06-01"
            or b"content-encoding" in seen):
        _deny("COUNT_HEADERS_REFUSED")
    raw_beta = seen.get(b"anthropic-beta")
    if type(raw_beta) is not bytes:
        _deny("COUNT_BETA_REQUIRED")
    try:
        betas = [part.strip() for part in raw_beta.decode("ascii", "strict").split(",")]
    except UnicodeError:
        _deny("COUNT_BETA_REFUSED")
    if (not betas or len(betas) != len(set(betas))
            or set(betas) - _BETAS or "token-counting-2024-11-01" not in betas):
        _deny("COUNT_BETA_REFUSED")
    return tuple(beta for beta in betas if beta != "token-counting-2024-11-01")


def _tools(value, allowed):
    if type(value) is not list or len(value) > 64:
        _deny("COUNT_TOOLS_REFUSED")
    names = set()
    for tool in value:
        if (type(tool) is not dict or not {"name", "input_schema"} <= set(tool)
                or set(tool) - {"name", "description", "input_schema"}):
            _deny("COUNT_TOOLS_REFUSED")
        name = tool["name"]
        if type(name) is not str or name not in allowed or name in names:
            _deny("COUNT_TOOLS_REFUSED")
        names.add(name)
        schema = tool["input_schema"]
        if (type(schema) is not dict or schema.get("type") != "object"
                or "description" in tool and
                (type(tool["description"]) is not str or len(tool["description"]) > 10000)):
            _deny("COUNT_TOOLS_REFUSED")


def _content(content, role, thinking, allowed):
    if type(content) is str:
        return
    if type(content) is not list or not 1 <= len(content) <= 64:
        _deny("COUNT_CONTENT_REFUSED")
    for block in content:
        if type(block) is not dict:
            _deny("COUNT_CONTENT_REFUSED")
        kind = block.get("type")
        if kind == "text":
            if set(block) != {"type", "text"} or type(block["text"]) is not str:
                _deny("COUNT_CONTENT_REFUSED")
        elif kind == "thinking" and role == "assistant" and thinking:
            if (set(block) != {"type", "thinking", "signature"}
                    or type(block["thinking"]) is not str
                    or type(block["signature"]) is not str):
                _deny("COUNT_CONTENT_REFUSED")
        elif kind == "redacted_thinking" and role == "assistant" and thinking:
            if set(block) != {"type", "data"} or type(block["data"]) is not str:
                _deny("COUNT_CONTENT_REFUSED")
        elif kind == "tool_use" and role == "assistant" and allowed:
            if (set(block) != {"type", "id", "name", "input"}
                    or type(block["id"]) is not str or not _TOOL_ID.fullmatch(block["id"])
                    or type(block["name"]) is not str or block["name"] not in allowed
                    or type(block["input"]) is not dict):
                _deny("COUNT_CONTENT_REFUSED")
        elif kind == "tool_result" and role == "user" and allowed:
            if (not {"type", "tool_use_id", "content"} <= set(block)
                    or set(block) - {"type", "tool_use_id", "content", "is_error"}
                    or type(block["tool_use_id"]) is not str
                    or not _TOOL_ID.fullmatch(block["tool_use_id"])
                    or "is_error" in block and type(block["is_error"]) is not bool):
                _deny("COUNT_CONTENT_REFUSED")
            result = block["content"]
            if type(result) is list:
                if not 1 <= len(result) <= 64 or any(
                        type(item) is not dict or set(item) != {"type", "text"}
                        or item["type"] != "text" or type(item["text"]) is not str
                        for item in result):
                    _deny("COUNT_CONTENT_REFUSED")
            elif type(result) is not str:
                _deny("COUNT_CONTENT_REFUSED")
        else:
            _deny("COUNT_CONTENT_REFUSED")


def parse_cli_count_request(scope, raw, *, model, allowed_tool_names=()):
    """Return a bounded request with no body-selected model or credential."""
    if (type(scope) is not dict or scope.get("type") != "http"
            or scope.get("method") != "POST" or scope.get("path") != COUNT_PATH
            or scope.get("raw_path") != COUNT_PATH.encode("ascii")
            or scope.get("query_string") != COUNT_QUERY):
        _deny("COUNT_ROUTE_REFUSED")
    betas = _headers(scope)
    if type(raw) is not bytes or not 1 <= len(raw) <= MAX_BODY_BYTES:
        _deny("COUNT_BODY_BOUND")
    try:
        body = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=_pairs,
                          parse_constant=lambda _: _deny("COUNT_NONFINITE_JSON"))
    except (UnicodeError, json.JSONDecodeError, RecursionError, ValueError) as error:
        if isinstance(error, StateDenied):
            raise
        _deny("COUNT_MALFORMED_JSON")
    _tree(body)
    if (type(body) is not dict or not {"model", "messages", "tools"} <= set(body)
            or set(body) - {"model", "messages", "tools", "thinking"}
            or body["model"] != model):
        _deny("COUNT_BODY_REFUSED")
    allowed = frozenset(allowed_tool_names)
    _tools(body["tools"], allowed)
    messages = body["messages"]
    if type(messages) is not list or not 1 <= len(messages) <= 64:
        _deny("COUNT_MESSAGES_REFUSED")
    thinking = body.get("thinking")
    if thinking is not None and (type(thinking) is not dict or thinking != {
            "type": "enabled", "budget_tokens": 1024}):
        _deny("COUNT_THINKING_REFUSED")
    for message in messages:
        if (type(message) is not dict or set(message) != {"role", "content"}
                or message["role"] not in ("user", "assistant")):
            _deny("COUNT_MESSAGES_REFUSED")
        _content(message["content"], message["role"], thinking is not None, allowed)
    return {"messages": messages, "tools": body["tools"], "betas": betas,
            **({"thinking": thinking} if thinking is not None else {})}


async def _read_body(receive, check):
    pieces = []
    size = 0
    for _ in range(MAX_EVENTS):
        check()
        event = await receive()
        check()
        if (type(event) is not dict or event.get("type") != "http.request"
                or set(event) - {"type", "body", "more_body"}
                or type(event.get("body", b"")) is not bytes
                or type(event.get("more_body", False)) is not bool):
            _deny("COUNT_REQUEST_EVENT_REFUSED")
        part = event.get("body", b"")
        size += len(part)
        if size > MAX_BODY_BYTES:
            _deny("COUNT_BODY_BOUND")
        pieces.append(part)
        if not event.get("more_body", False):
            return b"".join(pieces)
    _deny("COUNT_REQUEST_EVENT_BOUND")


def create_cli_count_tokens_app(count_tokens, *, model, allowed_tool_names=()):
    """Mount only inside the trusted inference server's lifetime wrapper.

    `count_tokens` is a trusted async function accepting the validated request
    without a model selector. It performs one fixed-model provider CountTokens
    operation and returns the provider's integer input token count. This count
    is for CLI compatibility, never the model-budget reservation observation.
    """
    if (not callable(count_tokens) or type(model) is not str or not 1 <= len(model) <= 128
            or type(allowed_tool_names) not in (tuple, list, frozenset)
            or len(allowed_tool_names) > 64
            or any(type(name) is not str or not _NAME.fullmatch(name)
                   for name in allowed_tool_names)
            or len(set(allowed_tool_names)) != len(allowed_tool_names)):
        _deny("COUNT_CONFIGURATION_REFUSED")
    allowed_tool_names = frozenset(allowed_tool_names)

    async def app(scope, receive, send):
        check = _current_lifetime_check()
        if check is None:
            _deny("COUNT_TRUSTED_LIFETIME_REQUIRED")
        check()
        raw = await _read_body(receive, check)
        request = parse_cli_count_request(scope, raw, model=model,
                                          allowed_tool_names=allowed_tool_names)
        check()
        try:
            tokens = await count_tokens(request)
        except Exception:
            _deny("COUNT_PROVIDER_REFUSED")
        check()
        if type(tokens) is not int or not 1 <= tokens <= ENVELOPE_MAX_INPUT_TOKENS:
            _deny("COUNT_RESPONSE_REFUSED")
        payload = json.dumps({"input_tokens": tokens}, separators=(",", ":")).encode("ascii")
        await send({"type": "http.response.start", "status": 200,
                    "headers": [(b"content-type", b"application/json"),
                                (b"content-length", str(len(payload)).encode("ascii"))]})
        check()
        await send({"type": "http.response.body", "body": payload, "more_body": False})
        check()

    return app
