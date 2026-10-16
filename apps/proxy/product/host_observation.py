"""Inert proxy-host observations from the actual HTTPX and ASGI lifetimes.

The request hook must precede BedrockSendGuard.before_send, and this object must
be the guard's counter wrapper. The product host composition installs both
hooks but is not mounted by a direct TLS server. The response transport must
sit below NativeSettlementTransport. These objects open no listener and
authenticate no cross-process caller. A separate authenticated channel is
still required before observations authorize SQL.
Neither reader accepts a Python-to-JavaScript codec frame as evidence.
"""
import hashlib
import re
import time

import httpx

from ..qualification.runtime.bedrock_body import (
    AdmissionDenied, BodyLimits, COUNT_MODEL_ID, PROFILE_ID, RUNTIME_HOST,
    inspect_native_request,
)
from ..qualification.runtime.bedrock_transport import BedrockSendGuard, CountObservation, HoldReceipt
from ..qualification.runtime.lifetime import RequestLifetime, _request_lifetime
from ..qualification.runtime.native_usage import UsageBinding, UsageResult
from ..qualification.state.pricing import StateDenied
from .response_settlement import SettlementContext, _ObservedResponseStream


def _deny():
    raise StateDenied("PRODUCT_HOST_OBSERVATION_REFUSED")


_SLOT = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")
_UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\Z", re.IGNORECASE)
_SHA256 = re.compile(r"[0-9a-f]{64}\Z")


def _binding(value):
    if type(value) is not dict or set(value) != {"tenantId", "actorId", "conversationId",
                                                 "runId", "attemptId", "workerId", "writerFence"}:
        _deny()
    for name in ("tenantId", "actorId"):
        item = value[name]
        if type(item) is not str or not 1 <= len(item) <= 128:
            _deny()
        try:
            if len(item.encode("utf-8", "strict")) > 512:
                _deny()
        except UnicodeError:
            _deny()
    for name in ("conversationId", "runId", "attemptId", "workerId"):
        if type(value[name]) is not str or not _UUID.fullmatch(value[name]):
            _deny()
    if type(value["writerFence"]) is not int or not 1 <= value["writerFence"] <= 9007199254740991:
        _deny()
    return value.copy()


def _native_request(request, limits):
    if not isinstance(request, httpx.Request):
        _deny()
    try:
        raw = request.content
    except httpx.RequestNotRead:
        _deny()
    if (type(raw) is not bytes or request.headers.get("host") != RUNTIME_HOST
            or request.headers.get("content-type") != "application/json"
            or "content-encoding" in request.headers):
        _deny()
    try:
        body = inspect_native_request(request.method, str(request.url), raw, limits)
    except (AdmissionDenied, ValueError, TypeError):
        _deny()
    headers = request.headers.raw
    if len(headers) > 64 or sum(len(name) + len(value) for name, value in headers) > 16384:
        _deny()
    try:
        pairs = [(name.decode("ascii", "strict"), value.decode("ascii", "strict"))
                 for name, value in headers]
    except UnicodeError:
        _deny()
    lowered = [name.lower() for name, _ in pairs]
    if (len(lowered) != len(set(lowered)) or "host" not in lowered
            or "content-type" not in lowered):
        _deny()
    return body, {"method": request.method, "url": str(request.url),
                  "host": request.headers.get("host"),
                  "contentType": request.headers.get("content-type"),
                  "body": bytes(raw), "headers": pairs}


async def require_current_conversation(life, *, binding, request_id, deadline_ms,
                                       selected_client_id, check_current_conversation):
    """Fresh Core identity/context join shared by Messages and CountTokens."""
    started = time.time_ns() // 1_000_000
    try:
        receipt = await life._bounded(lambda: check_current_conversation({
            "binding": binding.copy(), "requestId": request_id,
            "deadlineMs": deadline_ms}))
    except Exception:
        _deny()
    at = time.time_ns() // 1_000_000
    if (type(receipt) is not dict or set(receipt) != {
            "identitySha256", "binding", "scopes", "selectedClientId",
            "contextRevision", "checkedAtMs", "expiresAtMs"}
            or receipt["binding"] != binding
            or type(receipt["identitySha256"]) is not str
            or not _SHA256.fullmatch(receipt["identitySha256"])
            or type(receipt["contextRevision"]) is not str
            or not _SHA256.fullmatch(receipt["contextRevision"])
            or receipt["selectedClientId"] != selected_client_id
            or type(receipt["scopes"]) is not list or len(receipt["scopes"]) != 1
            or type(receipt["scopes"][0]) is not dict
            or set(receipt["scopes"][0]) != {
                "kind", "tenantId", "resourceId", "policyRevision"}
            or receipt["scopes"][0] != {
                "kind": "client", "tenantId": binding["tenantId"],
                "resourceId": selected_client_id,
                "policyRevision": life.peer.binding.policy_revision}
            or type(receipt["checkedAtMs"]) is not int
            or not started <= receipt["checkedAtMs"] <= at
            or type(receipt["expiresAtMs"]) is not int
            or receipt["expiresAtMs"] <= at):
        _deny()
    life.check()


class HostRequestObservation:
    """One final HTTPX request and actual CountTokens result, from separate hooks.

    `before_guard` is an HTTPX event hook preceding the send guard. `count`
    delegates the actual native counter. The private lifetime, not caller data,
    supplies the direct peer, bearer and complete original ASGI body at read.
    This source is inert until trusted host composition installs both hooks.
    """

    def __init__(self, counter, *, request_id, binding, deadline_ms,
                 selected_client_id=None, check_current_conversation=None,
                 limits=BodyLimits()):
        if (not callable(getattr(counter, "count", None)) or type(request_id) is not str
                or not _SLOT.fullmatch(request_id)
                or type(deadline_ms) is not int or not 0 < deadline_ms <= 9007199254740991
                or type(selected_client_id) is not str or not _UUID.fullmatch(selected_client_id)
                or selected_client_id != selected_client_id.lower()
                or not callable(check_current_conversation)
                or type(limits) is not BodyLimits):
            _deny()
        self.counter, self.request_id = counter, request_id
        # The future authenticated host composition supplies this private Meri
        # Core-context reader. No worker input, native bearer or codec frame does.
        self._check_current_conversation = check_current_conversation
        self._selected_client_id = selected_client_id
        self._binding, self.deadline_ms, self.limits = _binding(binding), deadline_ms, limits
        self._lifetime = self._request = self._native = self._count = None
        self._count_entered = self._request_read = self._claim_read = False
        self._peer_at_ms = None
        self._original_body_sha = self._capability_sha = None

    @property
    def binding(self):
        return self._binding.copy()

    async def _current(self, life):
        await require_current_conversation(
            life, binding=self._binding, request_id=self.request_id,
            deadline_ms=self.deadline_ms, selected_client_id=self._selected_client_id,
            check_current_conversation=self._check_current_conversation)

    async def before_guard(self, request):
        if self._lifetime is not None:
            _deny()
        life = _request_lifetime.get()
        if type(life) is not RequestLifetime or life.original_body is None:
            _deny()
        await life.refresh()
        life.check()
        await self._current(life)
        if type(life.original_body) is not bytes or not 1 <= len(life.original_body) <= 4 * 1024 * 1024:
            _deny()
        body, native = _native_request(request, self.limits)
        self._lifetime, self._request, self._native = life, request, native
        self._body = body
        self._original_body_sha = hashlib.sha256(life.original_body).hexdigest()
        if type(life.proxy_credential) is not bytes:
            _deny()
        self._capability_sha = hashlib.sha256(life.proxy_credential).hexdigest()
        if self._capability_sha != life.admission.authority.capability_sha256:
            _deny()

    async def count(self, parameters):
        if self._count_entered or self._lifetime is None or self._request is None:
            _deny()
        self._count_entered = True
        self._lifetime.check()
        if (type(parameters) is not dict or set(parameters) != {"modelId", "input"}
                or parameters.get("modelId") != COUNT_MODEL_ID
                or type(parameters.get("input")) is not dict
                or set(parameters["input"]) != {"invokeModel"}
                or type(parameters["input"].get("invokeModel")) is not dict
                or set(parameters["input"]["invokeModel"]) != {"body"}
                or parameters["input"]["invokeModel"]["body"] != self._body.raw):
            _deny()
        observation = await self.counter.count(parameters)
        self._lifetime.check()
        if (type(observation) is not CountObservation
                or observation.origin != "aws-counttokens"
                or observation.model_id != COUNT_MODEL_ID
                or observation.native_body_sha256 != self._body.sha256
                or type(observation.input_tokens) is not int
                or not 1 <= observation.input_tokens <= self.limits.max_input_tokens):
            _deny()
        self._count = observation
        return observation

    async def _source(self, *, require_current=True):
        life = self._lifetime
        if (type(life) is not RequestLifetime or self._request is None
                or self._count is None or self._native is None):
            _deny()
        await life.refresh()
        life.check()
        if require_current:
            await self._current(life)
        if (life.original_body is None or life.proxy_credential is None
                or type(life.original_body) is not bytes
                or not 1 <= len(life.original_body) <= 4 * 1024 * 1024
                or hashlib.sha256(life.original_body).hexdigest() != self._original_body_sha
                or type(life.proxy_credential) is not bytes
                or hashlib.sha256(life.proxy_credential).hexdigest() != self._capability_sha):
            _deny()
        peer = life.peer
        if (self._binding["runId"] != peer.binding.run_id
                or self._binding["writerFence"] != peer.binding.fence):
            _deny()
        try:
            credential = life.proxy_credential.decode("ascii", "strict")
        except UnicodeError:
            _deny()
        body, native = _native_request(self._request, self.limits)
        if body != self._body or native != self._native:
            _deny()
        if self._peer_at_ms is None:
            # Both independent reads report the same admitted host observation.
            # Each read still refreshes and checks the live private lifetime.
            self._peer_at_ms = time.time_ns() // 1_000_000
        return {"requestId": self.request_id,
                "peer": {"binding": self._binding.copy(), "taskArn": peer.binding.worker_arn,
                         "grantId": life.admission.authority.grant_id,
                         "observedAtMs": self._peer_at_ms},
                "proxyCredential": credential,
                "rawRequestBody": bytes(life.original_body),
                "nativeRequest": {**native, "headers": list(native["headers"])},
                "count": {"inputTokens": self._count.input_tokens,
                          "nativeBodySha256": self._count.native_body_sha256,
                          "modelId": self._count.model_id, "origin": self._count.origin}}

    async def claim_ingress(self):
        """ProductReservationAdapter's direct source, without a codec frame."""
        if self._claim_read:
            _deny()
        self._claim_read = True
        source = await self._source()
        return {"peer": source["peer"], "proxyCredential": source["proxyCredential"],
                "rawRequestBody": source["rawRequestBody"]}

    async def capture_authenticated_call(self, request):
        """Read once for a separately authenticated host callback, if mounted."""
        if (self._request_read or type(request) is not dict
                or set(request) not in ({"requestId", "binding", "deadlineMs"},
                                        {"requestId", "binding", "deadlineMs", "signal"})
                or request["requestId"] != self.request_id
                or request["binding"] != self._binding
                or request["deadlineMs"] != self.deadline_ms):
            _deny()
        # The JS bridge's optional AbortSignal is a local cancellation hint.
        # It is neither serialized nor an identity, deadline, peer or body fact;
        # the RequestLifetime below remains the sole cancellation authority.
        self._request_read = True
        return await self._source()


class HostResponseObservationTransport(httpx.AsyncBaseTransport):
    """Lower HTTPX transport tee for one independently parsed native response.

    Compose as `NativeSettlementTransport(HostResponseObservationTransport(...),
    ...)`. The inner _ObservedResponseStream receives actual transport bytes and
    final EOF before the outer settlement callback can request this record.
    """

    def __init__(self, inner, *, guard, context, request_capture):
        if (not isinstance(inner, httpx.AsyncBaseTransport)
                or type(guard) is not BedrockSendGuard
                or type(context) is not SettlementContext
                or type(request_capture) is not HostRequestObservation
                or guard.counter is not request_capture
                or request_capture.request_id != guard.request_id
                or guard.request_id != context.request_id):
            _deny()
        self.inner, self.guard, self.context = inner, guard, context
        self.request_capture = request_capture
        self.entered = self.read = False
        self._stream = self._result = None

    async def handle_async_request(self, request):
        if self.entered:
            _deny()
        self.entered = True
        body = self.guard.native_body
        count = self.guard.count_observation
        receipt = self.guard.hold_receipt
        if (self.guard.armed is not True or self.guard.hook_entries != 1
                or self.guard.request_id != self.context.request_id
                or self.request_capture.request_id != self.context.request_id
                or self.guard.expected_count_origin != "aws-counttokens"
                or body is None or count is None or type(receipt) is not HoldReceipt
                or receipt.request_id != self.context.request_id
                or receipt.native_body_sha256 != body.sha256 or receipt.state != "UNKNOWN"
                or getattr(self.guard.ledger, "reserved_raw_request_sha256", None)
                != self.context.raw_request_sha256
                or getattr(self.guard.ledger, "_binding", None) != self.request_capture._binding
                or self.request_capture._original_body_sha != self.context.raw_request_sha256
                or self.request_capture._count != count
                or self.request_capture._body != body):
            _deny()
        current, _ = _native_request(request, self.request_capture.limits)
        if current != body:
            _deny()
        source = await self.request_capture._source()
        raw_sha = hashlib.sha256(source["rawRequestBody"]).hexdigest()
        if raw_sha != self.context.raw_request_sha256:
            _deny()
        binding = UsageBinding(self.context.request_id, body.sha256, raw_sha,
                               self.context.pricing_revision, count.input_tokens,
                               body.max_output_tokens, self.context.allowed_tool_names)
        # Recheck at the final async boundary. A denial retains the committed
        # UNKNOWN hold and sends no provider bytes.
        await self.request_capture._current(self.request_capture._lifetime)
        response = await self.inner.handle_async_request(request)
        if not isinstance(response, httpx.Response) or not isinstance(response.stream, httpx.AsyncByteStream):
            _deny()

        async def record(request_id, result):
            if (self._result is not None or request_id != self.context.request_id
                    or type(result) is not UsageResult or result.binding != binding):
                _deny()
            self._result = result

        self._stream = _ObservedResponseStream(response.stream, response.status_code,
                                               response.headers, binding, record, None)
        response.stream = self._stream
        return response

    async def capture_authenticated_complete(self, request):
        if (self.read or type(request) is not dict
                or set(request) != {"requestId", "binding", "grantId"}
                or request["requestId"] != self.context.request_id
                or self.request_capture.request_id != self.context.request_id
                or request["binding"] != self.request_capture.binding
                or self._stream is None or self._stream.eof is not True
                or self._stream.closed is not True
                or type(self._result) is not UsageResult
                or self._result.status != "COMPLETE"):
            _deny()
        self.read = True
        # Settlement records cost already incurred. It still refreshes the
        # original peer/grant and bytes, but a later Core archive must not
        # suppress complete usage evidence or imply the hold was refunded.
        source = await self.request_capture._source(require_current=False)
        if request["grantId"] != source["peer"]["grantId"]:
            _deny()
        raw = source["rawRequestBody"]
        native = source["nativeRequest"]["body"]
        raw_sha = hashlib.sha256(raw).hexdigest()
        native_sha = hashlib.sha256(native).hexdigest()
        receipt = self.guard.hold_receipt
        result = self._result
        if (raw_sha != self.context.raw_request_sha256
                or result.binding.raw_request_sha256 != raw_sha
                or result.binding.native_body_sha256 != native_sha
                or receipt.native_body_sha256 != native_sha):
            _deny()
        capability_sha = hashlib.sha256(source["proxyCredential"].encode("ascii")).hexdigest()
        if capability_sha != self.request_capture._lifetime.admission.authority.capability_sha256:
            _deny()
        return {"reservation": {"requestId": receipt.request_id,
                                 "nativeBodySha256": receipt.native_body_sha256,
                                 "state": receipt.state},
                "rawRequestBody": raw, "nativeRequestBody": native,
                "completion": {"requestId": self.context.request_id,
                               "binding": self.request_capture.binding.copy(),
                               "taskArn": source["peer"]["taskArn"],
                               "capabilitySha256": capability_sha,
                               "nativeBodySha256": native_sha,
                               "rawRequestSha256": raw_sha,
                               "modelId": COUNT_MODEL_ID, "profileId": PROFILE_ID,
                               "pricingRevision": self.context.pricing_revision,
                               "evidenceSha256": result.evidence_sha256,
                               "httpStatus": self._stream.status,
                               "complete": True, "eof": True,
                               "usage": {"inputTokens": result.input_tokens,
                                         "outputTokens": result.output_tokens}},
                "usageResult": {"status": result.status,
                                "binding": {"request_id": result.binding.request_id,
                                            "native_body_sha256": result.binding.native_body_sha256,
                                            "raw_request_sha256": result.binding.raw_request_sha256,
                                            "pricing_revision": result.binding.pricing_revision,
                                            "counted_input_tokens": result.binding.counted_input_tokens,
                                            "max_output_tokens": result.binding.max_output_tokens,
                                            "allowed_tool_names": sorted(result.binding.allowed_tool_names)},
                                "evidence_sha256": result.evidence_sha256,
                                "input_tokens": result.input_tokens,
                                "output_tokens": result.output_tokens,
                                "reason": result.reason, "origin": result.origin}}

    async def aclose(self):
        await self.inner.aclose()
