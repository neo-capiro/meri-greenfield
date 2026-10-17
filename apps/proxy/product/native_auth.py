"""Pinned native custom-auth projection of an already admitted TLS request.

No native key, database, JWT issuer or identity lookup is introduced here.
The outer host alone creates RequestLifetime. This projection is usable only
inside that exact, revocable native ASGI dispatch; a request/header cannot
install the context or choose an authority.
"""
import asyncio
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import hmac
from importlib import import_module, metadata
import json
import time

from ..qualification.runtime.lifetime import RequestLifetime, _request_lifetime
from ..qualification.state.admission import GrantAdmission
from ..qualification.state.pricing import StateDenied
from .owner_admission import ProductOwnerAdmissionReader


MODEL = "meri-sonnet-qualification"
HOOK = "apps.proxy.product.native_auth.authenticate_product_request"
_current = ContextVar("product_native_auth_request", default=None)


def _deny():
    raise StateDenied("PRODUCT_NATIVE_AUTH_DENIED")


def _pairs(items):
    value = {}
    for key, item in items:
        if key in value:
            _deny()
        value[key] = item
    return value


@dataclass
class _Request:
    scope: dict
    life: RequestLifetime
    source: bytes
    active: bool = True
    calls: int = 0


def _source(life):
    if (type(life) is not RequestLifetime
            or type(life.admission.authority) is not GrantAdmission):
        _deny()
    authority = life.admission.authority
    source = authority._product_owner
    if (authority.namespace != "product" or type(source) is not tuple or len(source) != 3
            or type(source[0]) is not ProductOwnerAdmissionReader
            or type(source[1]) is not bytes or type(source[2]) is not int):
        _deny()
    life.check()
    return source


def wrap_native_app(native_app):
    """Trusted startup wraps only the actual pinned native app, not a route."""
    if not callable(native_app):
        _deny()

    async def app(scope, receive, send):
        if type(scope) is not dict:
            _deny()
        if scope.get("type") != "http":
            return await native_app(scope, receive, send)
        life = _request_lifetime.get()
        source = _source(life)
        if (_current.get() is not None or scope.get("scheme") != "https"
                or scope.get("method") != "POST" or scope.get("path") != "/v1/messages"
                or scope.get("raw_path") != b"/v1/messages"
                or scope.get("query_string") != b"beta=true"):
            _deny()
        holder = _Request(scope, life, source[1])
        token = _current.set(holder)
        try:
            return await native_app(scope, receive, send)
        finally:
            holder.active = False
            _current.reset(token)

    return app


def _check(holder, request):
    if (type(holder) is not _Request or not holder.active or holder.calls != 1
            or _request_lifetime.get() is not holder.life
            or getattr(request, "scope", None) is not holder.scope):
        _deny()
    source = _source(holder.life)
    holder.life.admission.validate_scope(holder.scope)
    if (source[1] != holder.source or holder.scope.get("path") != "/v1/messages"
            or holder.scope.get("raw_path") != b"/v1/messages"):
        _deny()
    return source


async def authenticate_product_request(request, api_key):
    """LiteLLM 1.104.2 supported async(request, api_key) custom-auth hook.

    Only a SHA is projected as the native token. In particular, the original
    opaque grant is never passed as UserAPIKeyAuth.api_key, user ID or metadata.
    Native common model/route checks remain a separate required startup gate.
    """
    holder = _current.get()
    if type(holder) is not _Request or not holder.active or holder.calls != 0:
        _deny()
    holder.calls = 1
    source = _check(holder, request)
    life = holder.life
    credential = life.proxy_credential
    if (type(api_key) is not str or type(credential) is not bytes
            or not hmac.compare_digest(api_key.encode("utf-8", "strict"), credential)
            or hashlib.sha256(credential).hexdigest() != life.admission.authority.capability_sha256):
        _deny()
    # The native Request consumes the same bounded ASGI receive stream. Never
    # parse worker claims into an authority or use a cached successful receipt.
    raw = await life._bounded(request.body)
    _check(holder, request)
    if type(raw) is not bytes or raw != life.original_body:
        _deny()
    try:
        body = json.loads(raw, object_pairs_hook=_pairs, parse_constant=lambda _value: _deny())
    except (ValueError, UnicodeError, TypeError):
        _deny()
    if type(body) is not dict or body.get("model") != MODEL:
        _deny()
    await life.refresh()
    source = _check(holder, request)
    receipt = await life._bounded(lambda: asyncio.to_thread(
        source[0].read_current_conversation_sync, holder.source, source[2]), thread=True)
    _check(holder, request)
    at = time.time_ns() // 1_000_000
    facts = json.loads(holder.source)
    if (type(receipt) is not dict or receipt.get("selectedClientId") != facts[7]
            or type(receipt.get("expiresAtMs")) is not int
            or not at < receipt["expiresAtMs"] <= source[2]):
        _deny()
    expiry = min(source[2], receipt["expiresAtMs"],
                 at + max(0, int((life.deadline-time.monotonic())*1000)))
    if expiry <= at:
        _deny()
    try:
        if metadata.version("litellm") != "1.104.2":
            _deny()
        types = import_module("litellm.proxy._types")
        result = types.UserAPIKeyAuth(
            token=life.admission.authority.capability_sha256,
            models=[MODEL], user_role=types.LitellmUserRoles.CUSTOMER,
            expires=datetime.fromtimestamp(expiry/1000, timezone.utc),
            metadata={}, request_route="/v1/messages")
    except StateDenied:
        raise
    except Exception:
        _deny()
    _check(holder, request)
    return result
