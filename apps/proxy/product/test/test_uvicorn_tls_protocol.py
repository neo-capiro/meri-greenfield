"""Synthetic pinned-protocol controls; no listener or TLS handshake."""
import asyncio
from contextlib import contextmanager
import ssl
from types import SimpleNamespace
import time
import unittest
from unittest.mock import patch

from apps.proxy.product.service_entrypoint import ProductProxyService
from apps.proxy.product.socket_capture import DirectTlsSocketCapture
from apps.proxy.product.test.test_socket_capture import connection
from apps.proxy.product.uvicorn_tls_protocol import (
    create_product_h11_config, create_product_h11_protocol, serve_product_proxy,
)
from apps.proxy.qualification.state.pricing import StateDenied


class FakeH11Protocol(asyncio.Protocol):
    def __init__(self, config, server_state, app_state, _loop=None):
        self.app = config.loaded_app
        self.cycle = None
        self.transport = None
        self.events = 0

    def connection_made(self, transport):
        self.transport = transport

    def connection_lost(self, exc):
        pass

    def handle_events(self):
        self.events += 1


class FakeConfig:
    def __init__(self, **kwargs):
        self.options = kwargs


class FakeServer:
    config = None
    served = False

    def __init__(self, config):
        type(self).config = config

    async def serve(self):
        type(self).served = True


class Host:
    ready = True

    def __init__(self, capture):
        self.capture = capture
        self.peers = []

    async def __call__(self, scope, receive, send):
        self.peers.append(self.capture.read_direct_tls_socket(scope))
        await send({"type": "http.response.start", "status": 403, "headers": []})
        await send({"type": "http.response.body", "body": b"denied"})


class Invoker:
    async def __call__(self, *args):
        raise AssertionError("native invocation is not used in this control")

    async def native_app(self, *args):
        raise AssertionError("lifespan is not used in this control")

    def registration_current(self):
        return True


class UvicornTlsProtocolTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.capture = DirectTlsSocketCapture()
        self.host = Host(self.capture)
        self.service = ProductProxyService(self.host, Invoker(), self.capture)
        self.service._started = True
        self.transport, _, _, _, self.scope = connection()
        self.messages = []

    @contextmanager
    def pinned(self, *, uvicorn="0.51.0", h11="0.16.0"):
        versions = {"uvicorn": uvicorn, "h11": h11}

        def imported(name):
            if name == "uvicorn.protocols.http.h11_impl":
                return SimpleNamespace(H11Protocol=FakeH11Protocol)
            if name == "uvicorn":
                return SimpleNamespace(Config=FakeConfig, Server=FakeServer)
            raise AssertionError("unexpected module import")

        with patch("apps.proxy.product.uvicorn_tls_protocol.metadata.version",
                   side_effect=lambda package: versions[package]), patch(
            "apps.proxy.product.uvicorn_tls_protocol.import_module",
            side_effect=imported
        ):
            yield

    def config(self, protocol):
        return SimpleNamespace(
            loaded=True, http_protocol_class=protocol, loaded_app=self.service,
            proxy_headers=False, ws="none", ws_protocol_class=None,
            loop="asyncio", interface="asgi3",
            ssl=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER))

    def protocol(self):
        with self.pinned():
            protocol = create_product_h11_protocol(self.service)
        return protocol(self.config(protocol), object(), {})

    async def send(self, message):
        self.messages.append(message)

    async def test_exact_cycle_binds_accepted_tls_transport_and_scope(self):
        protocol = self.protocol()
        protocol.connection_made(self.transport)
        protocol.cycle = SimpleNamespace(scope=self.scope, transport=self.transport)
        protocol.handle_events()
        await protocol.app(self.scope, None, self.send)
        self.assertEqual(len(self.host.peers), 1)
        self.assertEqual(self.host.peers[0].ipv4, "10.77.0.9")
        self.assertEqual(self.messages[0]["status"], 403)
        self.assertEqual(protocol.events, 1)
        with self.assertRaises(StateDenied):
            self.capture.read_direct_tls_socket(self.scope)

    async def test_scope_transport_or_app_replacement_never_enters_product(self):
        for changed in ("cycle_scope", "cycle_transport", "protocol_transport",
                        "missing_cycle", "missing_accept", "app_replacement"):
            with self.subTest(changed=changed):
                protocol = self.protocol()
                protocol.connection_made(self.transport)
                protocol.cycle = SimpleNamespace(scope=self.scope,
                                                 transport=self.transport)
                if changed == "cycle_scope":
                    protocol.cycle.scope = dict(self.scope)
                elif changed == "cycle_transport":
                    protocol.cycle.transport = object()
                elif changed == "protocol_transport":
                    protocol.transport = object()
                elif changed == "missing_cycle":
                    protocol.cycle = None
                elif changed == "missing_accept":
                    protocol.connection_lost(None)
                else:
                    protocol.app = self.service
                    with self.assertRaises(StateDenied):
                        protocol.handle_events()
                    continue
                with self.assertRaises(StateDenied):
                    await protocol.app(self.scope, None, self.send)
        self.assertEqual(self.host.peers, [])

    async def test_deadline_is_from_connection_and_not_dispatch(self):
        protocol = self.protocol()
        protocol.connection_made(self.transport)
        protocol.cycle = SimpleNamespace(scope=self.scope, transport=self.transport)
        protocol._accepted_at = time.monotonic() - 901
        with self.assertRaises(StateDenied):
            await protocol.app(self.scope, None, self.send)
        self.assertEqual(self.host.peers, [])

    async def test_wrong_version_or_server_config_refuses_before_dispatch(self):
        with self.pinned(uvicorn="0.41.0"):
            with self.assertRaises(StateDenied):
                create_product_h11_protocol(self.service)
        with self.pinned(h11="0.15.0"):
            with self.assertRaises(StateDenied):
                create_product_h11_protocol(self.service)
        for invalid in (True, 0, 901):
            with self.subTest(limit=invalid), self.pinned():
                with self.assertRaises(StateDenied):
                    create_product_h11_protocol(
                        self.service, max_connection_seconds=invalid)
        with self.pinned():
            protocol = create_product_h11_protocol(self.service)
        for field, value in (("loaded", False), ("http_protocol_class", FakeH11Protocol),
                             ("loaded_app", object()), ("proxy_headers", True),
                             ("ws", "auto"), ("ws_protocol_class", object()),
                             ("loop", "auto"), ("interface", "asgi2"),
                             ("ssl", None)):
            with self.subTest(field=field):
                config = self.config(protocol)
                setattr(config, field, value)
                with self.assertRaises(StateDenied):
                    protocol(config, object(), {})
        self.assertEqual(self.host.peers, [])

    async def test_stopped_config_fixes_plan_port_tls_and_protocol(self):
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        with self.pinned():
            config = create_product_h11_config(
                self.service, server_tls_context=tls)
        self.assertIs(config.options["app"], self.service)
        self.assertEqual((config.options["host"], config.options["port"]),
                         ("0.0.0.0", 8443))
        self.assertEqual((config.options["loop"], config.options["ws"],
                          config.options["interface"], config.options["lifespan"]),
                         ("asyncio", "none", "asgi3", "on"))
        self.assertIs(config.options["proxy_headers"], False)
        self.assertTrue(issubclass(config.options["http"], FakeH11Protocol))
        self.assertIs(config.options["ssl_context_factory"](None, None), tls)
        with self.pinned():
            with self.assertRaises(StateDenied):
                create_product_h11_config(
                    self.service, server_tls_context=None)

    async def test_default_and_missing_ports_do_not_start_server(self):
        FakeServer.served = False
        with self.pinned():
            with self.assertRaises(StateDenied):
                await serve_product_proxy()
            with self.assertRaises(StateDenied):
                await serve_product_proxy(enabled=True)
        self.assertFalse(FakeServer.served)

    async def test_explicit_source_composition_passes_exact_ports_to_server(self):
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        FakeServer.served = False
        with self.pinned(), patch(
            "apps.proxy.product.uvicorn_tls_protocol.create_product_proxy_service",
            return_value=self.service,
        ) as compose:
            await serve_product_proxy(
                enabled=True, server_tls_context=tls,
                direct_tls_capture=self.capture,
                resolve_bearer_sha256=lambda _: None,
                ecs_client=object(), ec2_client=object(),
                resolve_session=lambda _: None,
            )
        self.assertTrue(FakeServer.served)
        self.assertIs(FakeServer.config.options["app"], self.service)
        self.assertIs(compose.call_args.kwargs["direct_tls_capture"], self.capture)
        self.assertIs(FakeServer.config.options["ssl_context_factory"](None, None), tls)


if __name__ == "__main__":
    unittest.main()
