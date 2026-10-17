"""Pinned Claude Code CLI 2.1.295 CountTokens preflight for the fixed model.

The direct proxy's trusted ASGI lifetime and injected Bedrock client own this
callback. It makes one CountTokens call, never inference or budget admission.
The separate final-native AwsNativeCounter remains the reservation evidence.
"""
import asyncio
import json

from .cli_count_tokens import _BETAS, _content, _tools, _tree
from ..qualification.runtime.bedrock_body import COUNT_MODEL_ID, ENVELOPE_MAX_INPUT_TOKENS
from ..qualification.runtime.lifetime import _request_lifetime
from ..qualification.state.pricing import StateDenied


def _deny(code):
    raise StateDenied(code)


def cli_count_parameters(request, *, allowed_tool_names=()):
    """Mirror the pinned CLI's Bedrock-direct native CountTokens body.

    The CLI's proxy request has no max_tokens. Its Bedrock adapter supplies 1
    without thinking, or 2048 for its 1024-token thinking budget. Empty tools
    are omitted, and beta header values become the native array unchanged.
    """
    if (type(request) is not dict or not {"messages", "tools", "betas"} <= set(request)
            or set(request) - {"messages", "tools", "betas", "thinking"}):
        _deny("CLI_COUNT_REQUEST_REFUSED")
    messages, betas = request["messages"], request["betas"]
    if (type(allowed_tool_names) not in (tuple, list, frozenset)
            or len(allowed_tool_names) > 64
            or any(type(name) is not str for name in allowed_tool_names)
            or len(set(allowed_tool_names)) != len(allowed_tool_names)):
        _deny("CLI_COUNT_TOOL_CONFIGURATION_REFUSED")
    allowed = frozenset(allowed_tool_names)
    _tools(request["tools"], allowed)
    if (type(messages) is not list or not 1 <= len(messages) <= 64
            or type(betas) is not tuple or len(betas) > len(_BETAS)
            or len(set(betas)) != len(betas)
            or any(type(beta) is not str or beta not in _BETAS
                   or beta == "token-counting-2024-11-01" for beta in betas)):
        _deny("CLI_COUNT_REQUEST_REFUSED")
    thinking = request.get("thinking")
    if "thinking" in request and (type(thinking) is not dict or thinking != {
            "type": "enabled", "budget_tokens": 1024}):
        _deny("CLI_COUNT_THINKING_REFUSED")
    for message in messages:
        if (type(message) is not dict or set(message) != {"role", "content"}
                or message["role"] not in ("user", "assistant")):
            _deny("CLI_COUNT_MESSAGES_REFUSED")
        _content(message["content"], message["role"], thinking is not None, allowed)
    _tree({"messages": messages, "tools": request["tools"], "thinking": thinking})
    native = {"anthropic_version": "bedrock-2023-05-31", "messages": messages,
              "max_tokens": 2048 if thinking is not None else 1}
    if request["tools"]:
        native["tools"] = request["tools"]
    if betas:
        native["anthropic_beta"] = list(betas)
    if thinking is not None:
        native["thinking"] = thinking
    raw = json.dumps(native, ensure_ascii=False, separators=(",", ":"),
                     allow_nan=False).encode("utf-8", "strict")
    if not 1 <= len(raw) <= 4 * 1024 * 1024:
        _deny("CLI_COUNT_NATIVE_BODY_BOUND")
    return {"modelId": COUNT_MODEL_ID, "input": {"invokeModel": {"body": raw}}}


def create_fixed_cli_count_callback(client, *, allowed_tool_names=()):
    """Bind an injected pinned Bedrock client; discover no credentials here.

    The CountTokens app calls this only inside the authenticated lifetime.
    AwsNativeCounter supplies the existing pinned-client, endpoint, retry,
    TLS, proxy, timeout and deadline checks, but its inference-body validator
    is intentionally not used for this distinct count-only request.
    """
    async def count(request):
        from ..qualification.runtime.aws_counter import AwsNativeCounter

        life = _request_lifetime.get()
        if life is None or getattr(life, "_cli_count_entered", False):
            _deny("CLI_COUNT_TRUSTED_LIFETIME_REQUIRED")
        life._cli_count_entered = True
        life.check()
        parameters = cli_count_parameters(request, allowed_tool_names=allowed_tool_names)
        checker = AwsNativeCounter(client, deadline=life.deadline)
        checker._validate_client()
        life.check()
        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(client.count_tokens, **parameters),
                timeout=checker._remaining())
        except asyncio.CancelledError:
            raise
        except Exception:
            _deny("CLI_AWS_COUNT_FAILED")
        checker._remaining()
        life.check()
        if type(response) is not dict or set(response) != {"inputTokens", "ResponseMetadata"}:
            _deny("CLI_COUNT_RESPONSE_REFUSED")
        tokens, metadata = response["inputTokens"], response["ResponseMetadata"]
        if (type(tokens) is not int or not 1 <= tokens <= ENVELOPE_MAX_INPUT_TOKENS
                or type(metadata) is not dict
                or not {"RequestId", "HTTPStatusCode", "HTTPHeaders", "RetryAttempts"} <= set(metadata)
                or set(metadata) - {"RequestId", "HTTPStatusCode", "HTTPHeaders",
                                    "RetryAttempts", "MaxAttemptsReached"}
                or ("MaxAttemptsReached" in metadata and metadata["MaxAttemptsReached"] is not True)
                or type(metadata["HTTPStatusCode"]) is not int or metadata["HTTPStatusCode"] != 200
                or type(metadata["RetryAttempts"]) is not int or metadata["RetryAttempts"] != 0
                or type(metadata["RequestId"]) is not str or not 1 <= len(metadata["RequestId"]) <= 256
                or type(metadata["HTTPHeaders"]) is not dict or len(metadata["HTTPHeaders"]) > 64
                or any(type(k) is not str or type(v) is not str or len(k) > 256 or len(v) > 8192
                       for k, v in metadata["HTTPHeaders"].items())):
            _deny("CLI_COUNT_RESPONSE_REFUSED")
        return tokens

    return count
