"""One-request adapter for the real pinned upstream AsyncHTTPHandler.

This spike does not implement auth, durable state, AWS CountTokens or settlement.
Its trusted injected ledger must atomically reserve AND persist UNKNOWN before
authorizing a single send. No callback here releases that liability.
"""
import asyncio
from dataclasses import dataclass
import math
import time
from typing import Protocol

import httpx
from litellm.llms.custom_httpx.http_handler import AsyncHTTPHandler

from .bedrock_body import AdmissionDenied, BodyLimits, COUNT_MODEL_ID, RUNTIME_HOST, NativeBody, inspect_native_request


@dataclass(frozen=True)
class CountObservation:
    input_tokens: int
    native_body_sha256: str
    model_id: str
    origin: str


@dataclass(frozen=True)
class HoldReceipt:
    request_id: str
    native_body_sha256: str
    state: str


class NativeCounter(Protocol):
    async def count(self, parameters: dict) -> CountObservation:
        """Trusted adapter; no worker token claim or local-tokenizer fallback."""


class SendLedger(Protocol):
    async def reserve_and_arm_once(self, request_id: str, body: NativeBody,
                                   count: CountObservation) -> HoldReceipt:
        """Atomic current-fence/budget check + one send + durable UNKNOWN hold.

        Duplicate slots deny. Lost commit acknowledgement keeps the hold and
        raises. Only a separate trusted reconciliation path may release it.
        """


class BedrockSendGuard:
    """Per-logical-request state; create a fresh guarded client for the next slot."""

    def __init__(self, *, request_id, counter, ledger, deadline, expected_count_origin,
                 limits=BodyLimits(), clock=time.monotonic, lifetime_check=None):
        if type(request_id) is not str or not 1 <= len(request_id) <= 128:
            raise AdmissionDenied("INVALID_REQUEST_SLOT")
        if expected_count_origin not in ("fixture", "aws-counttokens"):
            raise AdmissionDenied("INVALID_COUNT_ORIGIN")
        if type(limits) is not BodyLimits or not callable(clock):
            raise AdmissionDenied("INVALID_GUARD_CONFIGURATION")
        if type(deadline) not in (int, float) or not math.isfinite(deadline):
            raise AdmissionDenied("INVALID_DEADLINE")
        if lifetime_check is not None and not callable(lifetime_check):
            raise AdmissionDenied("INVALID_LIFETIME_CHECK")
        # Trusted server composition explicitly supplies its private context
        # check. Default callers retain the old contract without this wiring.
        self.lifetime_check = lifetime_check
        self.request_id = request_id
        self.counter = counter
        self.ledger = ledger
        self.deadline = deadline
        self.expected_count_origin = expected_count_origin
        self.limits = limits
        self.clock = clock
        self.hook_entries = 0
        self.armed = False
        self.hold_receipt = None
        self.native_body = None
        self.count_observation = None
        self._entered = False
        self._remaining()

    def _check_lifetime(self):
        if self.lifetime_check is not None:
            if self.lifetime_check() is not None:
                raise AdmissionDenied("INVALID_LIFETIME_CHECK_RESULT")

    def _remaining(self):
        remaining = self.deadline - self.clock()
        if not math.isfinite(remaining) or remaining <= 0:
            raise AdmissionDenied("ORIGINAL_DEADLINE_EXPIRED")
        return remaining

    async def _within_deadline(self, factory):
        # Compute before constructing the coroutine; expired paths leak none.
        remaining = self._remaining()
        try:
            return await asyncio.wait_for(factory(), timeout=min(remaining, 30))
        except asyncio.TimeoutError as exc:
            raise AdmissionDenied("ADMISSION_OPERATION_TIMEOUT") from exc

    async def before_send(self, request: httpx.Request):
        self.hook_entries += 1
        # Before every await: also blocks overlapping calls and internal retries.
        if self._entered:
            raise AdmissionDenied("SECOND_SEND_DENIED")
        self._entered = True
        self._check_lifetime()
        self._remaining()
        try:
            raw = request.content
        except httpx.RequestNotRead as exc:
            raise AdmissionDenied("UNQUALIFIED_STREAMING_REQUEST_BODY") from exc
        if request.headers.get("content-type") != "application/json":
            raise AdmissionDenied("UNSUPPORTED_CONTENT_TYPE")
        if "content-encoding" in request.headers:
            raise AdmissionDenied("UNQUALIFIED_NATIVE_ENCODING")
        if request.headers.get("host") != RUNTIME_HOST:
            raise AdmissionDenied("UNQUALIFIED_HOST_HEADER")
        # No service-tier, latency, guardrail, trace or beta feature headers are
        # qualified by this small envelope. SigV4/date/session-token are trusted
        # client concerns, not worker-supplied authority checked by this spike.
        if any(name.startswith("x-amzn-bedrock-") or name == "anthropic-beta"
               for name in request.headers):
            raise AdmissionDenied("UNQUALIFIED_NATIVE_FEATURE_HEADER")
        body = inspect_native_request(request.method, str(request.url), raw, self.limits)
        try:
            count = await self._within_deadline(lambda: self.counter.count(body.count_parameters()))
        except Exception:
            raise AdmissionDenied("COUNT_ADAPTER_FAILED") from None
        self._check_lifetime()
        if type(count) is not CountObservation or count.origin != self.expected_count_origin:
            raise AdmissionDenied("UNTRUSTED_COUNT_OBSERVATION")
        if count.model_id != COUNT_MODEL_ID or count.native_body_sha256 != body.sha256:
            raise AdmissionDenied("COUNT_BODY_MISMATCH")
        if type(count.input_tokens) is not int or not 1 <= count.input_tokens <= self.limits.max_input_tokens:
            raise AdmissionDenied("INPUT_TOKEN_BOUND")
        try:
            self._check_lifetime()
            # Product uses the same one-send guard and CountTokens result, but
            # its canonical JS reservation owner also needs the actual final
            # HTTPX request. The qualification ledger retains its old port.
            product_reserve = getattr(self.ledger, "reserve_final_native_once", None)
            hold = await self._within_deadline(
                (lambda: product_reserve(self.request_id, request, body, count))
                if callable(product_reserve) else
                (lambda: self.ledger.reserve_and_arm_once(self.request_id, body, count)))
        except Exception:
            raise AdmissionDenied("LEDGER_ADMISSION_FAILED") from None
        self._check_lifetime()
        if (type(hold) is not HoldReceipt or hold.request_id != self.request_id
                or hold.native_body_sha256 != body.sha256 or hold.state != "UNKNOWN"):
            raise AdmissionDenied("INVALID_DURABLE_SEND_RECEIPT")
        self.hold_receipt = hold
        self.native_body = body
        self.count_observation = count
        self.armed = True
        # If the deadline elapsed at commit, retain UNKNOWN and do not send.
        self._remaining()
        self._check_lifetime()


def guarded_client(guard: BedrockSendGuard, *, transport: httpx.AsyncBaseTransport):
    """Supported upstream constructor/client injection, no replacement handler.

    Explicit transport is mandatory for this spike. Tests supply a recording fake;
    no real AWS counter/transport or deployment wiring is implemented here.
    Upstream's internal connection retry copies event_hooks into its new client.
    The injected transport is trusted. Hidden retries below its HTTPX interface
    are outside this hook; a future network transport needs separate qualification.
    """
    if type(guard) is not BedrockSendGuard or not isinstance(transport, httpx.AsyncBaseTransport):
        raise AdmissionDenied("INVALID_CLIENT_DEPENDENCY")
    return AsyncHTTPHandler(event_hooks={"request": [guard.before_send]},
                            transport=transport, follow_redirects=False)
