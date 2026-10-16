"""Bounded, inert values for the private Python-to-JavaScript proxy boundary.

The wire format is a versioned tree of positional JSON arrays and primitives.
It contains no JSON objects, so duplicate object keys cannot be hidden by a
parser. Encoding is not authentication: the JavaScript bridge still requires
its independent, constructor-captured host observation before budget SQL.
"""
import base64
import json
import re

from ..qualification.runtime.native_usage import UsageBinding, UsageResult


_WIRE_LIMIT = 12 * 1024 * 1024
_BODY_LIMIT = 4 * 1024 * 1024
_SLOT = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_UUID = re.compile(r"(?:urn:uuid:)?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\Z",
                   re.IGNORECASE)
_HEADER = re.compile(r"[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}\Z")
_CREDENTIAL = re.compile(r"[!-~]{32,256}\Z")
_HASH = re.compile(r"[a-f0-9]{64}\Z")
_BINDING_KEYS = ("tenantId", "actorId", "conversationId", "runId",
                 "attemptId", "workerId", "writerFence")


def _deny():
    raise ValueError("PRODUCT_PROXY_CODEC_REFUSED")


def _keys(value, expected):
    if type(value) is not dict or set(value) != set(expected):
        _deny()


def _text(value, maximum, *, minimum=1, pattern=None):
    if (type(value) is not str or not minimum <= len(value) <= maximum
            or not value.isascii() or (pattern is not None and not pattern.fullmatch(value))):
        _deny()
    return value


def _printable(value, maximum, *, minimum=1):
    _text(value, maximum, minimum=minimum)
    if any(not 32 <= ord(char) <= 126 for char in value):
        _deny()
    return value


def _identity(value):
    # Public RunBinding permits arbitrary tenant/actor text up to 128 Unicode
    # code points. Preserve it exactly; only bound the UTF-8 wire footprint.
    if type(value) is not str or not 1 <= len(value) <= 128:
        _deny()
    try:
        size = len(value.encode("utf-8", "strict"))
    except UnicodeError:
        _deny()
    if size > 512:
        _deny()
    return value


def _integer(value, low, high):
    if type(value) is not int or not low <= value <= high:
        _deny()
    return value


def _body(value):
    if type(value) is not bytes or not 1 <= len(value) <= _BODY_LIMIT:
        _deny()
    return base64.b64encode(value).decode("ascii")


def _binding(value):
    _keys(value, _BINDING_KEYS)
    return [_identity(value["tenantId"]), _identity(value["actorId"])] + [
        _text(value[key], 45, pattern=_UUID) for key in _BINDING_KEYS[2:-1]] + [
        _integer(value["writerFence"], 1, 9007199254740991)]


def _wire(frame):
    # No dict is permitted in any frame constructor below.
    raw = json.dumps(frame, ensure_ascii=True, separators=(",", ":"),
                     allow_nan=False).encode("ascii")
    if len(raw) > _WIRE_LIMIT:
        _deny()
    return raw


def encode_reservation(value, observation):
    """Encode one ProductReservationAdapter value and its untrusted claim."""
    _keys(value, ("requestId", "binding", "deadlineMs"))
    _keys(observation, ("requestId", "peer", "proxyCredential",
                        "rawRequestBody", "nativeRequest", "count"))
    _keys(observation["peer"], ("binding", "taskArn", "grantId", "observedAtMs"))
    _keys(observation["nativeRequest"], ("method", "url", "host",
                                        "contentType", "body", "headers"))
    _keys(observation["count"], ("inputTokens", "nativeBodySha256",
                                 "modelId", "origin"))
    request_id = _text(value["requestId"], 128, pattern=_SLOT)
    if observation["requestId"] != request_id:
        _deny()
    binding = _binding(value["binding"])
    peer_binding = _binding(observation["peer"]["binding"])
    if peer_binding != binding:
        _deny()
    native = observation["nativeRequest"]
    headers = native["headers"]
    if type(headers) not in (list, tuple) or not 1 <= len(headers) <= 64:
        _deny()
    seen = set()
    checked_headers = []
    for pair in headers:
        if type(pair) not in (list, tuple) or len(pair) != 2:
            _deny()
        name = _text(pair[0], 128, pattern=_HEADER)
        lower = name.lower()
        if lower in seen:
            _deny()
        seen.add(lower)
        checked_headers.append([name, _printable(pair[1], 8192, minimum=0)])
    if "host" not in seen or "content-type" not in seen:
        _deny()
    peer = observation["peer"]
    count = observation["count"]
    frame = ["meri.proxy.reservation/1",
             [request_id, binding, _integer(value["deadlineMs"], 1, 9007199254740991)],
             [request_id,
              [peer_binding, _printable(peer["taskArn"], 512),
               _text(peer["grantId"], 128, pattern=_SLOT),
               _integer(peer["observedAtMs"], 1, 9007199254740991)],
              _text(observation["proxyCredential"], 256, minimum=32,
                    pattern=_CREDENTIAL),
              _body(observation["rawRequestBody"]),
              [_text(native["method"], 16, pattern=_SLOT),
               _printable(native["url"], 1024), _printable(native["host"], 256),
               _printable(native["contentType"], 256), _body(native["body"]),
               checked_headers],
              [_integer(count["inputTokens"], 1, 8192),
               _text(count["nativeBodySha256"], 64, pattern=_HASH),
               _printable(count["modelId"], 128),
               _text(count["origin"], 64, pattern=_SLOT)]]]
    return _wire(frame)


def encode_settlement(request_id, result):
    """Encode only a complete typed native UsageResult for the JS bridge."""
    _text(request_id, 128, pattern=_SLOT)
    if type(result) is not UsageResult or type(result.binding) is not UsageBinding:
        _deny()
    binding = result.binding
    if (result.status != "COMPLETE" or result.origin != "native-usage-data"
            or result.reason not in ("COMPLETE_NATIVE_MESSAGE", "COMPLETE_NATIVE_STREAM")
            or binding.request_id != request_id):
        _deny()
    if type(binding.allowed_tool_names) is not frozenset or len(binding.allowed_tool_names) > 8:
        _deny()
    names = sorted(_text(name, 128, pattern=_SLOT)
                   for name in binding.allowed_tool_names)
    counted = _integer(binding.counted_input_tokens, 1, 8192)
    maximum = _integer(binding.max_output_tokens, 1, 256)
    if _integer(result.input_tokens, 1, 8192) != counted:
        _deny()
    output = _integer(result.output_tokens, 0, maximum)
    frame = ["meri.proxy.settlement/1", request_id,
             ["COMPLETE",
              [request_id,
               _text(binding.native_body_sha256, 64, pattern=_HASH),
               _text(binding.raw_request_sha256, 64, pattern=_HASH),
               _text(binding.pricing_revision, 64, pattern=_HASH),
               counted, maximum, names],
              _text(result.evidence_sha256, 64, pattern=_HASH),
              counted, output, result.reason, "native-usage-data"]]
    return _wire(frame)
