"""One-request LiteLLM deployment-hook binding for the product proxy host.

The native LiteLLM ASGI app and its CustomLogger class are supplied only at
reviewed startup. This module never calls ``acreate`` directly: the admitted
ASGI request still traverses the pinned proxy's native auth and router. The
callback inserts the host's one guarded AsyncHTTPHandler at the documented
deployment hook. A missing or changed callback registration refuses before
the native app is entered.
"""
from contextvars import ContextVar
from dataclasses import dataclass
from importlib import import_module, metadata
import inspect

from ..qualification.runtime.ingress import INFERENCE_PATH, INFERENCE_QUERY
from ..qualification.state.pricing import StateDenied


_active = ContextVar("product_native_litellm_handler", default=None)


def _deny():
    raise StateDenied("PRODUCT_NATIVE_LITELLM_REFUSED")


class ProductNativeDispatchEvidence:
    """Private host marker for the one guarded native transport and settlement."""

    __slots__ = ("entered", "settled")

    def __init__(self):
        self.entered = False
        self.settled = False

    def mark_entered(self):
        if self.entered:
            _deny()
        self.entered = True

    def mark_settled(self):
        if not self.entered or self.settled:
            _deny()
        self.settled = True


@dataclass
class _HandlerHolder:
    handler: object
    evidence: ProductNativeDispatchEvidence
    scope: dict
    active: bool = True
    hook_calls: int = 0
    success: bool = False


def create_product_litellm_invoker(*, native_app, litellm_module, callback_base):
    """Register one hook and return an ASGI invoker for the canonical host.

    The calling startup must import the *pinned* LiteLLM 1.104.2 module and
    ``litellm.proxy.proxy_server.app``, run the native lifespan/auth setup,
    and prove that this registered hook is on its selected deployment path.
    This source does not replace upstream auth, router or provider selection.
    """
    if (not callable(native_app) or type(callback_base) is not type
            or not callable(getattr(callback_base, "async_pre_call_deployment_hook", None))
            or type(getattr(litellm_module, "callbacks", None)) is not list
            or litellm_module.callbacks):
        _deny()

    class ProductDeploymentHook(callback_base):
        async def async_pre_call_deployment_hook(self, kwargs, call_type):
            holder = _active.get()
            if (type(holder) is not _HandlerHolder or not holder.active
                    or holder.hook_calls != 0 or call_type != "anthropic_messages"
                    or type(kwargs) is not dict or "client" in kwargs):
                _deny()
            holder.hook_calls = 1
            return {**kwargs, "client": holder.handler}

    callback = ProductDeploymentHook()
    litellm_module.callbacks.append(callback)

    def registration_current():
        return (type(litellm_module.callbacks) is list
                and len(litellm_module.callbacks) == 1
                and litellm_module.callbacks[0] is callback)

    async def invoke(handler, scope, receive, send):
        evidence = getattr(handler, "_product_native_dispatch_evidence", None)
        if (not registration_current()
                or _active.get() is not None
                or type(scope) is not dict or scope.get("type") != "http"
                or scope.get("scheme") != "https" or scope.get("method") != "POST"
                or scope.get("path") != INFERENCE_PATH
                or scope.get("raw_path") != INFERENCE_PATH.encode("ascii")
                or scope.get("query_string") != INFERENCE_QUERY
                or not callable(getattr(handler, "close", None))
                or type(evidence) is not ProductNativeDispatchEvidence
                or evidence.entered or evidence.settled
                or not callable(receive) or not callable(send)):
            _deny()
        holder = _HandlerHolder(handler, evidence, scope)
        token = _active.set(holder)

        async def guarded_send(event):
            if type(event) is not dict:
                _deny()
            if event.get("type") == "http.response.start":
                status = event.get("status")
                if (type(status) is int and 200 <= status < 300
                        and (holder.hook_calls != 1 or not evidence.entered)):
                    _deny()
                holder.success = type(status) is int and 200 <= status < 300
            if (event.get("type") == "http.response.body" and holder.success
                    and event.get("more_body", False) is False and not evidence.settled):
                _deny()
            await send(event)

        try:
            result = native_app(scope, receive, guarded_send)
            if not inspect.isawaitable(result):
                _deny()
            await result
        finally:
            holder.active = False  # Revokes copied contexts in child tasks.
            _active.reset(token)

    invoke.native_app = native_app
    invoke.registration_current = registration_current
    return invoke


def load_pinned_product_litellm_invoker():
    """Import the exact native proxy route only at enabled service startup.

    This does not run LiteLLM's lifespan or prove its auth/schema/Prisma
    prerequisites. A caller must qualify those before serving requests.
    """
    try:
        if metadata.version("litellm") != "1.104.2":
            _deny()
        module = import_module("litellm")
        native = import_module("litellm.proxy.proxy_server")
        logger = import_module("litellm.integrations.custom_logger")
        if (getattr(module, "__name__", None) != "litellm"
                or getattr(native, "__name__", None) != "litellm.proxy.proxy_server"
                or getattr(logger, "__name__", None) != "litellm.integrations.custom_logger"):
            _deny()
        return create_product_litellm_invoker(
            native_app=native.app, litellm_module=module,
            callback_base=logger.CustomLogger)
    except StateDenied:
        raise
    except Exception:
        _deny()
