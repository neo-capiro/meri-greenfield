"""Pinned Uvicorn HTTP/1 dispatch binding for the product proxy's TLS socket.

This supplies a protocol *class* for a future explicit Uvicorn Config(http=...).
It opens no listener and does not enable the product service. The private h11
cycle seam is pinned to Uvicorn 0.51.0; version or configuration drift refuses
construction before an HTTP request can enter the product application.
"""
import asyncio
from importlib import import_module, metadata
import ssl
import time

from ..qualification.state.pricing import StateDenied
from .service_entrypoint import ProductProxyService, create_product_proxy_service


def _deny():
    raise StateDenied("PRODUCT_UVICORN_TLS_PROTOCOL_DENIED")


def create_product_h11_protocol(service, *, max_connection_seconds=900):
    """Return the exact HTTP protocol class for a separately configured server.

    The accepted connection timestamp is a conservative lower bound on every
    request's arrival, including pipelined and keep-alive requests. Later
    requests on a long-lived connection can be denied before their own age
    reaches the limit. The deadline is never refreshed at ASGI dispatch.
    """
    if (type(service) is not ProductProxyService
            or type(max_connection_seconds) is not int
            or not 0 < max_connection_seconds <= 900):
        _deny()
    try:
        if metadata.version("uvicorn") != "0.51.0" or metadata.version("h11") != "0.16.0":
            _deny()
        base = import_module("uvicorn.protocols.http.h11_impl").H11Protocol
    except (ImportError, AttributeError, metadata.PackageNotFoundError):
        _deny()
    if not isinstance(base, type) or not issubclass(base, asyncio.Protocol):
        _deny()

    capture = service.direct_tls_capture

    class ProductH11Protocol(base):
        def __init__(self, config, server_state, app_state, _loop=None):
            # Config.load() must have run. Pin the actual server dispatch to
            # this one application, no forwarded client rewrite or WS path.
            if (getattr(config, "loaded", None) is not True
                    or getattr(config, "http_protocol_class", None) is not type(self)
                    or getattr(config, "loaded_app", None) is not service
                    or getattr(config, "proxy_headers", None) is not False
                    or getattr(config, "ws", None) != "none"
                    or getattr(config, "ws_protocol_class", object()) is not None
                    or getattr(config, "loop", None) != "asyncio"
                    or getattr(config, "interface", None) != "asgi3"
                    or not isinstance(getattr(config, "ssl", None), ssl.SSLContext)
                    or config.ssl.protocol != ssl.PROTOCOL_TLS_SERVER):
                _deny()
            super().__init__(config, server_state, app_state, _loop)
            if self.app is not service:
                _deny()
            self._accepted_transport = None
            self._accepted_at = None

            async def bound_app(scope, receive, send):
                cycle = self.cycle
                transport = self._accepted_transport
                arrived = self._accepted_at
                if (type(scope) is not dict or cycle is None
                        or cycle.scope is not scope
                        or transport is None or cycle.transport is not transport
                        or self.transport is not transport
                        or type(arrived) is not float):
                    _deny()
                with capture.bind_request(
                    scope, transport, deadline=arrived + max_connection_seconds
                ):
                    await service(scope, receive, send)

            self._bound_app = bound_app
            self.app = bound_app

        def connection_made(self, transport):
            arrived = time.monotonic()
            super().connection_made(transport)
            if self.transport is not transport or self._accepted_transport is not None:
                _deny()
            self._accepted_transport = transport
            self._accepted_at = arrived

        def handle_events(self):
            # h11 handles pipelined requests by recursively calling this
            # method after a response. Never let a later app replacement use
            # the same trusted connection without the capture wrapper.
            if self.app is not self._bound_app:
                _deny()
            return super().handle_events()

        def connection_lost(self, exc):
            self._accepted_transport = None
            self._accepted_at = None
            return super().connection_lost(exc)

    return ProductH11Protocol


def create_product_h11_config(service, *, server_tls_context):
    """Compose a stopped, plan-port Uvicorn Config from borrowed TLS material.

    The caller must supply an already reviewed server-authenticated TLS
    context. No key, certificate, port listener or owner credential is made
    here. Uvicorn loads the config immediately before constructing protocols;
    their constructor checks every security-critical option again.
    """
    if (type(service) is not ProductProxyService
            or not isinstance(server_tls_context, ssl.SSLContext)
            or server_tls_context.protocol != ssl.PROTOCOL_TLS_SERVER):
        _deny()
    protocol = create_product_h11_protocol(service)
    try:
        config_type = import_module("uvicorn").Config
    except (ImportError, AttributeError):
        _deny()
    return config_type(
        app=service, host="0.0.0.0", port=8443, loop="asyncio",
        http=protocol, ws="none", proxy_headers=False, interface="asgi3",
        lifespan="on", workers=1,
        ssl_context_factory=lambda _config, _default: server_tls_context,
    )


async def serve_product_proxy(*, enabled=False, server_tls_context=None,
                              direct_tls_capture=None, resolve_bearer_sha256=None,
                              ecs_client=None, ec2_client=None,
                              resolve_session=None, bootstrap_seconds=5.0):
    """Explicit opt-in entry point; no import-time or default listener.

    Enabled startup still needs real durable/session owner callbacks, a
    reviewed TLS context and exact pinned LiteLLM/Uvicorn dependencies.
    Missing evidence refuses before Server.serve can open a socket.
    """
    if (enabled is not True
            or not isinstance(server_tls_context, ssl.SSLContext)
            or server_tls_context.protocol != ssl.PROTOCOL_TLS_SERVER):
        _deny()
    service = create_product_proxy_service(
        enabled=True, direct_tls_capture=direct_tls_capture,
        resolve_bearer_sha256=resolve_bearer_sha256, ecs_client=ecs_client,
        ec2_client=ec2_client, resolve_session=resolve_session,
        bootstrap_seconds=bootstrap_seconds,
    )
    config = create_product_h11_config(
        service, server_tls_context=server_tls_context)
    try:
        server_type = import_module("uvicorn").Server
    except (ImportError, AttributeError):
        _deny()
    server = server_type(config)
    await server.serve()
    if getattr(server, "started", None) is not True:
        _deny()


async def serve_product_proxy_with_owner(*, enabled=False, server_tls_context=None,
        owner_policy=None, owner_tls_material=None, owner_ipv4=None, proxy_ipv4=None,
        deployment_expires_at_ms=None, deployment_revision=None, ecs_client=None, ec2_client=None,
        count_client=None, make_provider_transport=None, pricing_revision=None,
        body_limits=None, bootstrap_seconds=5.0):
    """Actual opt-in caller for placement, fresh admission and session composition.

    Externally delivered reviewed TLS material/deployment pins and bounded AWS
    clients are mandatory. This opens only the existing explicit proxy server;
    imports/default calls never activate a listener or create credentials.
    """
    if enabled is not True:
        _deny()
    from .owner_channel import OwnerHostGate
    from .owner_https import ProductOwnerHttpsExchange
    from .owner_startup import ProductOwnerStartup
    from .socket_capture import DirectTlsSocketCapture
    exchange = ProductOwnerHttpsExchange(policy=owner_policy,material=owner_tls_material,
        owner_ipv4=owner_ipv4,proxy_ipv4=proxy_ipv4,expires_at_ms=deployment_expires_at_ms,
        deployment_revision=deployment_revision)
    startup = None
    try:
        startup = ProductOwnerStartup(policy=owner_policy,exchange=exchange,
            host_gate=OwnerHostGate(),owner_loop=asyncio.get_running_loop(),
            count_client=count_client,make_provider_transport=make_provider_transport,
            pricing_revision=pricing_revision,body_limits=body_limits)
        await serve_product_proxy(enabled=True,server_tls_context=server_tls_context,
            direct_tls_capture=DirectTlsSocketCapture(),
            resolve_bearer_sha256=startup.resolve_bearer_sha256,
            resolve_session=startup.resolve_session,ecs_client=ecs_client,
            ec2_client=ec2_client,bootstrap_seconds=bootstrap_seconds)
    finally:
        if startup is not None:
            startup.close()
        else:
            exchange.abort()
