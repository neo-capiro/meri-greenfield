"""Disabled-by-default product proxy ASGI composition and native lifespan gate.

The real server must supply the accepted asyncio TLS transport through
``DirectTlsSocketCapture.bind_request`` around *each* HTTP dispatch. This
module opens no listener, connection, database, credential or AWS client.
It uses the one existing product budget owner through ProductSession; no
qualification ledger or provider path is substituted.
"""
import inspect

from ..qualification.state.pricing import StateDenied
from .bearer_eni_admission import FreshEcsEniReader
from .socket_capture import DirectTlsSocketCapture


def _deny():
    raise StateDenied("PRODUCT_PROXY_SERVICE_UNAVAILABLE")


async def _refuse(send):
    await send({"type": "http.response.start", "status": 403, "headers": []})
    await send({"type": "http.response.body", "body": b"INFERENCE_DENIED",
                "more_body": False})


class _DisabledProductProxy:
    ready = False

    async def __call__(self, scope, receive, send):
        if type(scope) is dict and scope.get("type") == "lifespan":
            event = await receive()
            if type(event) is dict and event.get("type") == "lifespan.startup":
                await send({"type": "lifespan.startup.failed",
                            "message": "PRODUCT_PROXY_DISABLED"})
            return
        if type(scope) is dict and scope.get("type") == "http":
            await _refuse(send)
            return
        _deny()


class ProductProxyService:
    """Forward pinned native lifespan; allow HTTP only after its startup ACK."""

    def __init__(self, host_app, invoker, capture):
        if (not callable(host_app) or not callable(invoker)
                or not callable(getattr(invoker, "native_app", None))
                or not callable(getattr(invoker, "registration_current", None))
                or type(capture) is not DirectTlsSocketCapture):
            _deny()
        self.host_app, self.invoker, self.direct_tls_capture = host_app, invoker, capture
        self._started = False

    @property
    def ready(self):
        return self._started and self.invoker.registration_current() and self.host_app.ready

    async def __call__(self, scope, receive, send):
        if type(scope) is not dict:
            _deny()
        if scope.get("type") == "lifespan":
            if self._started:
                _deny()

            async def native_send(event):
                if type(event) is not dict:
                    _deny()
                if event.get("type") == "lifespan.startup.complete":
                    if not self.invoker.registration_current():
                        await send({"type": "lifespan.startup.failed",
                                    "message": "PRODUCT_CALLBACK_UNAVAILABLE"})
                        _deny()
                    self._started = True
                elif event.get("type") in ("lifespan.shutdown.complete",
                                            "lifespan.startup.failed",
                                            "lifespan.shutdown.failed"):
                    self._started = False
                await send(event)

            try:
                result = self.invoker.native_app(scope, receive, native_send)
                if not inspect.isawaitable(result):
                    _deny()
                await result
            finally:
                self._started = False
            return
        if scope.get("type") != "http":
            _deny()
        if not self.ready:
            await _refuse(send)
            return
        await self.host_app(scope, receive, send)


def create_product_proxy_service(*, enabled=False, direct_tls_capture=None,
                                 resolve_bearer_sha256=None, ecs_client=None,
                                 ec2_client=None, resolve_session=None,
                                 bootstrap_seconds=5.0):
    """Wire existing ingress, current ECS observer and native LiteLLM route.

    Enabled startup requires separately reviewed, bounded control-owned
    bearer/issuance lookup and session/owner channel. None is discovered from
    an HTTP request or fabricated by this factory. Missing ports refuse
    *before* the upstream proxy import or a service listener can be started.
    """
    if enabled is False:
        return _DisabledProductProxy()
    if (enabled is not True or type(direct_tls_capture) is not DirectTlsSocketCapture
            or not callable(resolve_bearer_sha256)
            or not callable(resolve_session) or ecs_client is None or ec2_client is None):
        _deny()
    observe_task_eni = FreshEcsEniReader(ecs_client, ec2_client)
    # These imports are intentionally after all required port checks. The
    # exact upstream version is checked by its loader at enabled startup.
    from .upstream_callback import load_pinned_product_litellm_invoker
    from .host_composition import create_bearer_eni_product_proxy_app

    invoker = load_pinned_product_litellm_invoker()
    host = create_bearer_eni_product_proxy_app(
        read_direct_tls_socket=direct_tls_capture.read_direct_tls_socket,
        resolve_bearer_sha256=resolve_bearer_sha256,
        observe_task_eni=observe_task_eni,
        resolve_session=resolve_session,
        invoke_litellm=invoker,
        bootstrap_seconds=bootstrap_seconds)
    return ProductProxyService(host, invoker, direct_tls_capture)
