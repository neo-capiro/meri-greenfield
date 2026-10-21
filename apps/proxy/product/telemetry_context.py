"""Request-scoped P0 measurements, shared through copied asyncio/thread contexts.

No credentials, request bodies or full bindings are retained. Measurements never
participate in request authority, admission, retirement or settlement decisions.
"""
import asyncio
import contextlib
import contextvars
import threading
import time
import uuid

from . import telemetry_lines as lines

_request = contextvars.ContextVar("meri_proxy_telemetry_request", default=None)
_lock = threading.RLock()
_background = {"aws": {}, "ownerExchanges": {}}
_started = time.monotonic()


def _now():
    return time.monotonic() * 1000


def _safe(function):
    def call(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except BaseException:
            lines.note_drop()
            return None
    return call


class RequestMeasurements:
    def __init__(self):
        self.start = _now()
        self.provider_start = None
        self.closed = False
        self.fields = {"runId": "unknown", "attemptId": "unknown", "requestId": uuid.uuid4().hex,
                       "outcome": "failed", "aws": {}, "awsMs": 0,
                       "ownerExchanges": {}, "ownerExchangeMs": 0}


@contextlib.contextmanager
def request():
    """Outer bootstrap owns the scope; nested InferenceApp reuses it."""
    existing = _request.get()
    if existing is not None:
        yield existing
        return
    token = _request.set(RequestMeasurements())
    try:
        yield _request.get()
    finally:
        finish()
        _request.reset(token)


@_safe
def bind(binding, request_id=None):
    current = _request.get()
    if current is not None and not current.closed and type(binding) is dict:
        # Copy only safe identifiers, never the full authority binding.
        current.fields["runId"] = lines._id(binding.get("runId"))
        current.fields["attemptId"] = lines._id(binding.get("attemptId"))
        if request_id is not None:
            current.fields["requestId"] = lines._id(request_id)


@_safe
def mark(name):
    current = _request.get()
    if current is None or current.closed:
        return
    at = _now()
    if name == "provider.start":
        if current.provider_start is None:
            current.provider_start = at
    elif name == "bootstrapMs":
        current.fields.setdefault(name, max(0, at - current.start))
    elif name in ("bedrockHeadersMs", "firstChunkMs", "streamEndMs") and current.provider_start is not None:
        current.fields.setdefault(name, max(0, at - current.provider_start))


@_safe
def settle(started, result):
    current = _request.get()
    if current is None or current.closed:
        return
    current.fields["settleMs"] = max(0, _now() - started)
    current.fields["inputTokens"] = lines._number(getattr(result, "input_tokens", None))
    current.fields["outputTokens"] = lines._number(getattr(result, "output_tokens", None))


@_safe
def outcome(value):
    current = _request.get()
    if current is not None and not current.closed and value in ("completed", "refused", "failed", "cancelled"):
        current.fields["outcome"] = value


@_safe
def http_outcome(response_status):
    """Keep response classification inside the telemetry failure boundary."""
    outcome("completed" if response_status < 400 else
            "refused" if response_status in (401, 403) else "failed")


@_safe
def failed(*, refused=False):
    current = _request.get()
    if current is not None and not current.closed and current.fields.get("outcome") != "refused":
        current.fields["outcome"] = "refused" if refused else "failed"


@_safe
def refusal(gate, step, code):
    current = _request.get()
    # The resolver thread and owner loop share this request object through copied
    # contexts. Choose the first refusal atomically, just as the text diagnostic
    # does; a later refusal must not replace its cause while fields are sanitized.
    with _lock:
        if current is not None and not current.closed and "refusal" not in current.fields:
            current.fields["refusal"] = {"gate": lines._word(gate, lines.GATES), "step": lines._word(step, lines.STEPS), "code": code if code in ("DEADLINE", "REFUSED") else "other"}
            current.fields["outcome"] = "refused"


@_safe
def count(group, row, column, duration):
    current = _request.get()
    if group not in ("aws", "ownerExchanges"):
        return
    rows, columns = ((lines.AWS_OPERATIONS, lines.AWS_OUTCOMES) if group == "aws" else (lines.CHANNELS, lines.PATHS))
    row, column = lines._word(row, rows), lines._word(column, columns)
    if row not in rows or column not in columns:
        return
    with _lock:
        target = current.fields if current is not None and not current.closed else _background
        selected = target[group].setdefault(row, {})
        selected[column] = selected.get(column, 0) + 1
        key = "awsMs" if group == "aws" else "ownerExchangeMs"
        target[key] = target.get(key, 0) + (lines._number(duration) or 0)


@_safe
def health(component, transition, code):
    lines.emit("meri.health", {"component": component, "transition": transition, "code": code})


@_safe
def finish():
    current = _request.get()
    if current is not None and not current.closed:
        with _lock:
            current.closed = True
            fields = dict(current.fields)
        lines.emit("meri.model.request", fields)


@_safe
def rollup():
    global _started
    at = time.monotonic()
    with _lock:
        fields = {"windowMs": max(0, (at - _started) * 1000),
                  "aws": _background["aws"], "ownerExchanges": _background["ownerExchanges"],
                  "telemetryDropped": lines.dropped()}
        _background.clear()
        _background.update(aws={}, ownerExchanges={})
        _started = at
    if lines.emit("meri.process.rollup", fields):
        lines.acknowledge_dropped(fields["telemetryDropped"])


class RollupTimer:
    """Explicit service-owned timer, independent of request retry sleeps."""
    def __init__(self, loop):
        self.loop = loop
        self.closed = False
        self.handle = None
        self._schedule()

    def _schedule(self):
        try:
            self.handle = self.loop.call_later(60, self._tick)
        except BaseException:
            lines.note_drop()
            self.closed = True

    def _tick(self):
        if not self.closed:
            rollup()
            self._schedule()

    def close(self):
        self.closed = True
        if self.handle is not None:
            self.handle.cancel()


def start_rollups():
    return RollupTimer(asyncio.get_running_loop())
