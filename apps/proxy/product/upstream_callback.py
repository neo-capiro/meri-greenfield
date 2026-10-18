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


def create_product_litellm_invoker(*, native_app, litellm_module, callback_base, native_baseline_types=(),
                                   native_lifespan_types=()):
    """Register one hook and return an ASGI invoker for the canonical host.

    The calling startup must import the *pinned* LiteLLM 1.104.2 module and
    ``litellm.proxy.proxy_server.app``, run the native lifespan/auth setup,
    and prove that this registered hook is on its selected deployment path.
    This source does not replace upstream auth, router or provider selection.

    ``native_baseline_types`` names the exact classes the pinned native import
    registers before this hook (each once, in order). ``native_lifespan_types``
    names the exact classes the pinned native lifespan may append after it (each
    at most once). Anything else refuses; native hooks' effects on a request are
    still subject to the host's final-request admission.
    """
    if (not callable(native_app) or type(callback_base) is not type
            or not callable(getattr(callback_base, "async_pre_call_deployment_hook", None))
            or type(getattr(litellm_module, "callbacks", None)) is not list
            or type(native_baseline_types) is not tuple
            or not all(type(t) is type for t in native_baseline_types)
            or len(set(native_baseline_types)) != len(native_baseline_types)
            or type(native_lifespan_types) is not tuple
            or not all(type(t) is type for t in native_lifespan_types)
            or len(set(native_lifespan_types)) != len(native_lifespan_types)
            or set(native_lifespan_types) & set(native_baseline_types)
            or [type(c) for c in litellm_module.callbacks] != list(native_baseline_types)):
        _deny()
    baseline = tuple(litellm_module.callbacks)

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

    lifespan_allowed = frozenset(native_lifespan_types)

    def registration_current():
        current = litellm_module.callbacks
        if type(current) is not list or len(current) < len(baseline) + 1:
            return False
        tail = current[len(baseline) + 1:]
        tail_types = [type(c) for c in tail]
        return (all(current[i] is baseline[i] for i in range(len(baseline)))
                and current[len(baseline)] is callback
                and all(t in lifespan_allowed for t in tail_types)
                and len(set(tail_types)) == len(tail_types))

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
        limiter = import_module("litellm.proxy.hooks.model_max_budget_limiter")
        # Exact native hooks the pinned 1.104.2 lifespan appends after this hook.
        lifespan = tuple(getattr(import_module(module_name), class_name) for module_name, class_name in (
            ("litellm.proxy.hooks.parallel_request_limiter_v3", "_PROXY_MaxParallelRequestsHandler_v3"),
            ("litellm.proxy.hooks.cache_control_check", "_PROXY_CacheControlCheck"),
            ("litellm.proxy.hooks.responses_id_security", "ResponsesIDSecurity"),
            ("litellm.proxy.hooks.litellm_skills.main", "SkillsInjectionHook"),
            ("litellm.proxy.hooks.max_iterations_limiter", "_PROXY_MaxIterationsHandler"),
            ("litellm.proxy.hooks.max_budget_per_session_limiter", "_PROXY_MaxBudgetPerSessionHandler"),
            ("litellm.proxy.hooks.sensitive_data_routing", "_PROXY_SensitiveDataRoutingHandler"),
            ("litellm.proxy.hooks.prompt_cache_prediction", "PromptCacheObserver"),
            ("litellm._service_logger", "ServiceLogging")))
        if (getattr(module, "__name__", None) != "litellm"
                or getattr(native, "__name__", None) != "litellm.proxy.proxy_server"
                or getattr(logger, "__name__", None) != "litellm.integrations.custom_logger"
                or getattr(limiter, "__name__", None) != "litellm.proxy.hooks.model_max_budget_limiter"):
            _deny()
        # Pinned 1.104.2 registers exactly this native limiter when proxy_server is imported.
        return create_product_litellm_invoker(
            native_app=native.app, litellm_module=module,
            callback_base=logger.CustomLogger,
            native_baseline_types=(limiter._PROXY_VirtualKeyModelMaxBudgetLimiter,),
            native_lifespan_types=lifespan)
    except StateDenied:
        raise
    except Exception:
        _deny()
