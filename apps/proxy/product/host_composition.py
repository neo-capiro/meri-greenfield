"""Fail-closed, per-request composition of the accepted product proxy owners.

The caller owns the direct TLS socket, ECS peer observer, persisted session
resolver, authenticated JavaScript owner channel, and the pinned LiteLLM
request invoker. This module owns the one HTTPX handler and the ordering of its
final-native request/count/UNKNOWN/send/complete-response hooks. It does not
open a socket, discover a credential, or create a second budget.
"""
from dataclasses import dataclass
import asyncio
from contextvars import ContextVar
import hashlib
import inspect
import math
import time

import httpx
from litellm.llms.custom_httpx.http_handler import AsyncHTTPHandler

from ..qualification.runtime.aws_counter import AwsNativeCounter
from ..qualification.runtime.bedrock_body import BodyLimits
from ..qualification.runtime.bedrock_transport import BedrockSendGuard
from ..qualification.runtime.lifetime import LifetimeLimits, PendingWork, RequestLifetime, _request_lifetime
from ..qualification.runtime.server import TrustedRequest, create_app
from ..qualification.state.pricing import StateDenied
from .aws_cli_counter import create_fixed_cli_count_callback
from .cli_count_tokens import create_cli_count_tokens_app
from .host_observation import (HostRequestObservation, HostResponseObservationTransport,
                               require_current_conversation, _binding, _SLOT, _UUID)
from .request_admission import ProductReservationAdapter
from .response_settlement import NativeSettlementTransport, SettlementContext
from .response_settlement import _settled_outcome
from .bearer_eni_admission import create_bearer_eni_trusted_resolver
from .upstream_callback import ProductNativeDispatchEvidence


MODEL_ALIAS = "meri-sonnet-qualification"


def _deny():
    raise StateDenied("PRODUCT_PROXY_COMPOSITION_REFUSED")


@dataclass(frozen=True)
class ProductSession:
    """Trusted persisted run/grant facts and separately owned infrastructure ports.

    `make_owner_bridge` receives the constructor-captured Python host request
    observation. Its result must authenticate the private channel and invoke
    the existing JavaScript product reservation/settlement owners. The bridge
    also receives the complete-response observation before provider dispatch.
    It must never use its Python claim as its independent capture.
    """

    request_id: str
    binding: dict
    model_grant_id: str
    deadline_ms: int
    selected_client_id: str
    pricing_revision: str
    count_client: object
    make_provider_transport: object
    make_owner_bridge: object
    check_current_conversation: object
    limits: BodyLimits = BodyLimits()

    def __post_init__(self):
        if (type(self.request_id) is not str or not _SLOT.fullmatch(self.request_id)
                or type(self.binding) is not dict
                or type(self.model_grant_id) is not str or not 1 <= len(self.model_grant_id) <= 128
                or type(self.deadline_ms) is not int or not 0 < self.deadline_ms <= 9007199254740991
                or type(self.selected_client_id) is not str
                or not _UUID.fullmatch(self.selected_client_id)
                or self.selected_client_id != self.selected_client_id.lower()
                or type(self.pricing_revision) is not str or len(self.pricing_revision) != 64
                or any(char not in "0123456789abcdef" for char in self.pricing_revision)
                or type(self.limits) is not BodyLimits
                or not callable(self.make_provider_transport)
                or not callable(self.make_owner_bridge)
                or not callable(self.check_current_conversation)):
            _deny()
        object.__setattr__(self, "binding", _binding(self.binding))


def _session(life, session):
    if type(life) is not RequestLifetime or type(session) is not ProductSession:
        _deny()
    life.check()
    binding = session.binding
    if (type(binding) is not dict
            or binding.get("runId") != life.peer.binding.run_id
            or binding.get("writerFence") != life.peer.binding.fence
            or session.model_grant_id != life.admission.authority.grant_id
            or session.deadline_ms <= time.time_ns() // 1_000_000):
        _deny()
    return session


class _OneNativeTransport(httpx.AsyncBaseTransport):
    """Bind raw-body hash and the response capture only after the send is armed."""

    def __init__(self, inner, *, life, session, guard, request_capture, bridge, evidence):
        self.inner, self.life, self.session = inner, life, session
        self.guard, self.request_capture, self.bridge = guard, request_capture, bridge
        self.evidence = evidence
        self.entered = False

    async def handle_async_request(self, request):
        if self.entered:
            _deny()
        self.entered = True
        self.life.check()
        raw = self.life.original_body
        if (type(raw) is not bytes or not 1 <= len(raw) <= 4 * 1024 * 1024
                or self.guard.armed is not True):
            _deny()
        context = SettlementContext(self.session.request_id, hashlib.sha256(raw).hexdigest(),
                                    self.session.pricing_revision,
                                    self.session.limits.allowed_tool_names)
        observed = HostResponseObservationTransport(
            self.inner, guard=self.guard, context=context,
            request_capture=self.request_capture)
        # The owner bridge registers this host callback on its authenticated
        # private channel. A missing/rejected channel retains UNKNOWN and no
        # provider transport is entered.
        if self.bridge.bind_complete_capture(observed.capture_authenticated_complete) is not None:
            _deny()
        async def settle_complete(request_id, result):
            await self.bridge.settle_complete(request_id, result)
            self.evidence.mark_settled()

        async def read_outcome(request_id):
            outcome = await self.bridge.read_outcome(request_id)
            if _settled_outcome(outcome, request_id):
                self.evidence.mark_settled()
            return outcome

        transport = NativeSettlementTransport(
            observed, guard=self.guard, context=context,
            settle_complete=settle_complete,
            read_outcome=read_outcome)
        response = await transport.handle_async_request(request)
        self.evidence.mark_entered()
        return response

    async def aclose(self):
        await self.inner.aclose()


async def create_guarded_product_handler(life, session):
    """Create one pinned LiteLLM HTTPX handler for one admitted Messages call."""
    session = _session(life, session)
    if _request_lifetime.get() is not life:
        _deny()
    counter = AwsNativeCounter(session.count_client, deadline=life.deadline,
                               limits=session.limits)
    host = HostRequestObservation(counter, request_id=session.request_id,
                                  binding=session.binding, deadline_ms=session.deadline_ms,
                                  selected_client_id=session.selected_client_id,
                                  check_current_conversation=session.check_current_conversation,
                                  limits=session.limits)
    bridge = session.make_owner_bridge(host.capture_authenticated_call)
    if (not callable(getattr(bridge, "reserve", None))
            or not callable(getattr(bridge, "settle_complete", None))
            or not callable(getattr(bridge, "read_outcome", None))
            or not callable(getattr(bridge, "bind_complete_capture", None))):
        _deny()
    ledger = ProductReservationAdapter(bridge, host.claim_ingress,
                                       binding=session.binding, deadline_ms=session.deadline_ms)
    guard = BedrockSendGuard(request_id=session.request_id, counter=host, ledger=ledger,
                             deadline=life.deadline, expected_count_origin="aws-counttokens",
                             limits=session.limits, lifetime_check=life.check)
    inner = session.make_provider_transport()
    if not isinstance(inner, httpx.AsyncBaseTransport):
        close = getattr(inner, "aclose", None)
        if callable(close):
            result = close()
            if inspect.isawaitable(result):
                await result
        _deny()
    evidence = ProductNativeDispatchEvidence()
    transport = _OneNativeTransport(inner, life=life, session=session, guard=guard,
                                    request_capture=host, bridge=bridge, evidence=evidence)
    try:
        handler = AsyncHTTPHandler(event_hooks={"request": [host.before_guard, guard.before_send]},
                                   transport=transport, follow_redirects=False)
        handler._product_native_dispatch_evidence = evidence
        return handler
    except BaseException:
        await transport.aclose()
        raise


def create_product_proxy_app(*, trusted_resolver, resolve_session, invoke_litellm,
                             limits=LifetimeLimits(), body_limits=BodyLimits()):
    """Mount the existing direct-ingress wrapper with one product HTTPX path.

    `trusted_resolver` must independently authenticate the TLS peer and current
    task/grant. `resolve_session` reads persisted server facts, never worker
    fields. `invoke_litellm(handler, scope, receive, send)` must install *that*
    handler for the single pinned upstream request. Missing ports deny startup.
    """
    if (not callable(trusted_resolver) or not callable(resolve_session)
            or not callable(invoke_litellm) or type(limits) is not LifetimeLimits
            or type(body_limits) is not BodyLimits):
        _deny()

    async def current_session():
        life = _request_lifetime.get()
        if type(life) is not RequestLifetime:
            _deny()
        session = await life._bounded(lambda: resolve_session(life))
        session = _session(life, session)
        if session.limits != body_limits:
            _deny()
        return life, session

    async def messages(scope, receive, send):
        life, session = await current_session()
        handler = await create_guarded_product_handler(life, session)
        try:
            result = invoke_litellm(handler, scope, receive, send)
            if not inspect.isawaitable(result):
                _deny()
            await result
        finally:
            await handler.close()

    async def count(request):
        life, session = await current_session()
        await life.refresh()
        await require_current_conversation(
            life, binding=session.binding, request_id=session.request_id,
            deadline_ms=session.deadline_ms,
            selected_client_id=session.selected_client_id,
            check_current_conversation=session.check_current_conversation)
        callback = create_fixed_cli_count_callback(
            session.count_client, allowed_tool_names=session.limits.allowed_tool_names)
        tokens = await callback(request)
        await life.refresh()
        await require_current_conversation(
            life, binding=session.binding, request_id=session.request_id,
            deadline_ms=session.deadline_ms,
            selected_client_id=session.selected_client_id,
            check_current_conversation=session.check_current_conversation)
        return tokens

    count_app = create_cli_count_tokens_app(
        count, model=MODEL_ALIAS, allowed_tool_names=body_limits.allowed_tool_names)
    return create_app(messages, trusted_resolver, limits, count_tokens_app=count_app)


def create_bearer_eni_product_proxy_app(*, read_direct_tls_socket,
                                        resolve_bearer_sha256, observe_task_eni,
                                        resolve_session, invoke_litellm,
                                        limits=LifetimeLimits(), body_limits=BodyLimits(),
                                        bootstrap_seconds=5.0):
    """Compose the one ingress/host path from required trusted product ports.

    This is import-inert. The real direct-socket callback, durable grant lookup,
    bounded ECS/ENI reader, owner channel and LiteLLM invoker remain required
    before a service entry point can call this factory.
    """
    if (type(bootstrap_seconds) not in (int, float)
            or not math.isfinite(bootstrap_seconds)
            or not 0 < bootstrap_seconds <= 5):
        _deny()
    resolver = create_bearer_eni_trusted_resolver(
        read_direct_tls_socket=read_direct_tls_socket,
        resolve_bearer_sha256=resolve_bearer_sha256,
        observe_task_eni=observe_task_eni)
    return _BoundedProductBootstrap(resolver, resolve_session, invoke_litellm,
                                    limits, body_limits, bootstrap_seconds)


@dataclass
class _TrustedHolder:
    scope: dict
    trusted: TrustedRequest
    active: bool = True


class _BoundedProductBootstrap:
    """Keep blocking identity/AWS reads off-loop and quarantine an unfinished read.

    A timed-out thread may continue. The app then remains unavailable until
    restart; it never substitutes a second bearer/peer or allows another send.
    The real TLS callback must be safe to invoke on the worker thread.
    """

    def __init__(self, resolver, resolve_session, invoke_litellm, limits,
                 body_limits, bootstrap_seconds):
        self._resolver = resolver
        self._bootstrap_seconds = bootstrap_seconds
        self._request = ContextVar("product_bounded_trusted_request", default=None)
        self._poisoned = False
        self._outstanding = set()
        self._active = 0

        def captured(scope):
            current = self._request.get()
            if (type(current) is not _TrustedHolder or not current.active
                    or current.scope is not scope or not self.ready
                    or time.monotonic() >= current.trusted.deadline):
                _deny()
            return current.trusted

        # One long-lived InferenceApp retains its own PendingWork quarantine.
        self._inner = create_product_proxy_app(
            trusted_resolver=captured, resolve_session=resolve_session,
            invoke_litellm=invoke_litellm, limits=limits, body_limits=body_limits)

    @property
    def ready(self):
        return not self._poisoned and self._inner.ready

    def _quarantine(self, task):
        self._poisoned = True
        if task not in self._outstanding:
            self._outstanding.add(task)
            pending = getattr(self._inner, "pending", None)
            if type(pending) is PendingWork:
                pending.quarantine({task})

            def finished(value):
                self._outstanding.discard(value)
                if not value.cancelled():
                    value.exception()

            task.add_done_callback(finished)

    async def __call__(self, scope, receive, send):
        if type(scope) is not dict or not self.ready or self._active >= 4:
            await self._inner._refuse(send)
            return
        accepted_at = time.monotonic()
        self._active += 1
        task = asyncio.create_task(asyncio.to_thread(self._resolver, scope))
        try:
            done, _ = await asyncio.wait({task}, timeout=self._bootstrap_seconds)
            if not done:
                self._quarantine(task)
                await self._inner._refuse(send)
                return
            try:
                trusted = task.result()
                if type(trusted) is not TrustedRequest:
                    _deny()
            except Exception:
                await self._inner._refuse(send)
                return
            if not self.ready:
                await self._inner._refuse(send)
                return
            # The original deadline includes admission time, never starts anew
            # after a slow durable/AWS lookup.
            deadline = min(trusted.deadline, accepted_at + 900)
            if time.monotonic() >= deadline:
                await self._inner._refuse(send)
                return
            trusted = TrustedRequest(trusted.admission, trusted.observer, deadline)
            holder = _TrustedHolder(scope, trusted)
            token = self._request.set(holder)
            try:
                await self._inner(scope, receive, send)
            finally:
                holder.active = False  # Also revokes copied contexts in child tasks.
                self._request.reset(token)
        except asyncio.CancelledError:
            if not task.done():
                self._quarantine(task)
            raise
        finally:
            self._active -= 1
