"""Bounded, content-free CloudWatch EMF lines; no resources start at import.

Only the three proxy-owned P0 schemas are accepted. Nested maps use closed
vocabularies too: an allowed container never permits arbitrary caller keys.
The emitter borrows the refusal diagnostics' preserved stderr writer.
"""
import json
import math
import os
import re
import threading
import time

SCHEMA = "meri.telemetry/1"
EVENTS = frozenset(("meri.model.request", "meri.health", "meri.process.rollup"))
IDS = re.compile(r"(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\Z", re.I)
CODE = re.compile(r"[A-Za-z0-9_.:-]{1,64}\Z")
AWS_OPERATIONS = frozenset(("DescribeTasks", "DescribeServices", "ListTasks", "DescribeTaskDefinition", "DescribeNetworkInterfaces", "CountTokens", "other"))
AWS_OUTCOMES = frozenset(("success", "error", "timeout", "cancelled", "unanswered", "other"))
CHANNELS = frozenset(("operation", "capture", "admission"))
PATHS = frozenset(("OPEN", "OPERATION", "POLL", "REPLY"))
COMPONENTS = frozenset(("bootstrap", "pending-work", "owner-gate", "pair", "exchange", "service-gate", "facts", "credential-delivery", "currentness", "resources"))
TRANSITIONS = frozenset(("quarantined", "poisoned", "retired", "unavailable", "reproven"))
HEALTH_CODES = frozenset(("PAIR_DRIFT", "PAIR_REPROVEN", "PAIR_UNAVAILABLE", "PAIR_REPROVING", "CARRIER_RESET_LIMIT", "PAIR_REPROOF_LIMIT", "PENDING_WORK", "BOOTSTRAP_PENDING_WORK", "OWNER_GATE_POISONED", "PAIR_RETIRED", "EXCHANGE_RETIRED", "RESOURCES_RETIRED", "PRODUCT_PROXY_UNAVAILABLE", "PRODUCT_PROXY_SERVICE_UNAVAILABLE", "PRODUCT_CALLBACK_UNAVAILABLE"))
GATES = frozenset(("pair", "admission", "exchange", "bootstrap", "placement", "owner", "eni", "resolver", "service"))
STEPS = frozenset(("scope", "poisoned", "busy", "timeout", "resolver", "deadline", "carrier", "exchange", "reply", "frame", "decode", "expiry", "placement", "admission", "lock", "pair-before", "connect", "request", "reply-status", "reply-read", "pair-after", "evidence", "call", "snapshot", "read", "consume", "join", "replay", "not-ready", "identity", "tasks", "services", "task-definition", "network", "bearer", "socket", "peer", "observe", "authority", "lease", "binding", "current", "describe-tasks", "task", "tags", "container", "attachment", "describe-eni", "clock", "tls-socket", "bearer-header", "task-eni", "ingress", "expired", "source", "recheck"))
_REFUSAL_CODES = frozenset(("DEADLINE", "REFUSED"))
_DURATIONS = ("bootstrapMs", "bedrockHeadersMs", "firstChunkMs", "streamEndMs", "settleMs", "ownerExchangeMs", "awsMs")
_lock = threading.Lock()
_sink = None
_environment = "Preview"
_dropped = 0
_now = lambda: time.time_ns() // 1_000_000


def timeout_class(code):
    if code in ("DEADLINE", "RUNTIME_STARTUP_TIMEOUT", "RUNTIME_SHUTDOWN_TIMEOUT", "PRODUCT_OWNER_STARTUP_TIMEOUT"):
        return "deadline"
    if code in ("PINNED_NATIVE_TIMEOUT", "REMOTE_RUNNER_CLEANUP_UNKNOWN", "SDK_CLEANUP_UNKNOWN"):
        return "transport-timeout"
    if code in ("NATIVE_UNAVAILABLE", "PINNED_NATIVE_STATUS_503", "503", 503, "timeout", "unanswered"):
        return "upstream-unavailable"
    return "none"


def _word(value, allowed):
    return value if type(value) is str and CODE.fullmatch(value) and value in allowed else "other"


def _id(value, *, unknown=False):
    if unknown and value == "unknown":
        return value
    return value if type(value) is str and IDS.fullmatch(value) else "invalid"


def _number(value):
    return value if type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 9007199254740991 else None


def _matrix(value, rows, columns):
    if type(value) is not dict:
        return {}
    result = {}
    for row in sorted(rows):
        source = value.get(row)
        if type(source) is not dict:
            continue
        selected = {key: _number(source[key]) for key in sorted(columns) if key in source and _number(source[key]) is not None}
        if selected:
            result[row] = selected
    return result


def _total(value):
    return sum(sum(row.values()) for row in value.values())


def _metric(directives, line, name, value, dimensions, unit="Count"):
    value = _number(value)
    if value is None:
        return
    line[name] = value
    directives.append({"Namespace": "Meri/" + _environment, "Dimensions": dimensions,
                       "Metrics": [{"Name": name, "Unit": unit}]})


def build_line(event, fields, *, at_ms=None):
    if event not in EVENTS or type(fields) is not dict:
        raise ValueError("TELEMETRY_SCHEMA")
    line = {"schema": SCHEMA, "event": event, "service": "proxy", "Service": "proxy"}
    directives = []
    if event == "meri.model.request":
        for key in ("runId", "attemptId", "requestId"):
            line[key] = _id(fields.get(key), unknown=key != "requestId")
        outcome = _word(fields.get("outcome"), frozenset(("completed", "refused", "failed", "cancelled")))
        line["outcome"] = line["Outcome"] = outcome
        for key in _DURATIONS + ("inputTokens", "outputTokens"):
            line[key] = _number(fields.get(key))
        refusal = fields.get("refusal")
        if type(refusal) is dict:
            line["refusal"] = {"gate": _word(refusal.get("gate"), GATES), "step": _word(refusal.get("step"), STEPS), "code": _word(refusal.get("code"), _REFUSAL_CODES)}
        line["ownerExchanges"] = _matrix(fields.get("ownerExchanges"), CHANNELS, PATHS)
        line["aws"] = _matrix(fields.get("aws"), AWS_OPERATIONS, AWS_OUTCOMES)
        _metric(directives, line, "ModelRequests", 1, [["Service", "Outcome"]])
        for metric, key in (("ModelTtftMs", "firstChunkMs"), ("ModelBootstrapMs", "bootstrapMs")):
            _metric(directives, line, metric, line[key], [["Service"]], "Milliseconds")
        _metric(directives, line, "OwnerExchanges", _total(line["ownerExchanges"]), [["Service"]])
        _metric(directives, line, "ProxyAwsCalls", _total(line["aws"]), [["Service"]])
    elif event == "meri.health":
        line["component"] = line["Component"] = _word(fields.get("component"), COMPONENTS)
        line["transition"] = _word(fields.get("transition"), TRANSITIONS)
        line["code"] = _word(fields.get("code"), HEALTH_CODES)
        _metric(directives, line, "HealthEvents", 1, [["Service"], ["Service", "Component"]])
    else:
        line["windowMs"] = _number(fields.get("windowMs"))
        line["telemetryDropped"] = _number(fields.get("telemetryDropped")) or 0
        line["aws"] = _matrix(fields.get("aws"), AWS_OPERATIONS, AWS_OUTCOMES)
        line["ownerExchanges"] = _matrix(fields.get("ownerExchanges"), CHANNELS, PATHS)
        line["core"], line["db"] = {}, {"statements": 0, "ms": 0}
        line["Attribution"] = "background"
        _metric(directives, line, "AwsCalls", _total(line["aws"]), [["Service"], ["Service", "Attribution"]])
        _metric(directives, line, "TelemetryDropped", line["telemetryDropped"], [["Service"]])
    stamp = _number(at_ms if at_ms is not None else _now())
    line["_aws"] = {"Timestamp": stamp, "CloudWatchMetrics": directives}
    return line


def install(*, fd=None, write=None, environment="Preview", now_ms=None):
    """Borrow one raw writer. Invalid explicit environment never silently defaults."""
    global _sink, _environment, _now
    if environment not in ("Preview", "Production") or ((fd is None) == (write is None)):
        raise ValueError("TELEMETRY_CONFIGURATION")
    if write is not None and not callable(write) or fd is not None and (type(fd) is not int or fd < 0):
        raise ValueError("TELEMETRY_CONFIGURATION")
    _sink = write if write is not None else lambda data: os.write(fd, data)
    _environment = environment
    _now = now_ms or (lambda: time.time_ns() // 1_000_000)


def uninstall():
    global _sink, _dropped
    _sink = None
    _dropped = 0


def note_drop():
    global _dropped
    with _lock:
        _dropped += 1


def dropped(*, reset=False):
    global _dropped
    with _lock:
        result = _dropped
        if reset:
            _dropped = 0
        return result


def acknowledge_dropped(count):
    global _dropped
    with _lock:
        _dropped = max(0, _dropped - count)


def emit(event, fields):
    global _dropped
    try:
        sink = _sink
        if sink is None:
            return False
        raw = (json.dumps(build_line(event, fields), ensure_ascii=True, separators=(",", ":"), allow_nan=False) + "\n").encode("ascii")
        if len(raw) > 8192:
            raise ValueError("TELEMETRY_SIZE")
        result = sink(raw)  # Exactly one borrowed write; never emit arbitrary exception text.
        if type(result) is int and result != len(raw):
            raise OSError("TELEMETRY_SHORT_WRITE")
        return True
    except BaseException:
        with _lock:
            _dropped += 1
        return False
