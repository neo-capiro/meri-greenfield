"""Source-only service activation controls; no TLS listener or native import."""
import asyncio
import unittest

from apps.proxy.product.service_entrypoint import (
    ProductProxyService, create_product_proxy_service)
from apps.proxy.product.socket_capture import DirectTlsSocketCapture


class _Host:
    ready = True

    def __init__(self):
        self.calls = 0

    async def __call__(self, _scope, _receive, send):
        self.calls += 1
        await send({"type": "http.response.start", "status": 200, "headers": []})


class ProductServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_disabled_by_default_refuses_http_and_startup(self):
        app = create_product_proxy_service()
        self.assertFalse(app.ready)
        sent = []

        async def collect(event):
            sent.append(event)

        await app({"type": "http"}, lambda: None, collect)
        self.assertEqual(sent[0]["status"], 403)
        sent.clear()

        async def startup():
            return {"type": "lifespan.startup"}

        await app({"type": "lifespan"}, startup, collect)
        self.assertEqual(sent[0]["type"], "lifespan.startup.failed")

    async def test_missing_enabled_ports_refuse_before_any_native_import(self):
        with self.assertRaisesRegex(Exception, "PRODUCT_PROXY_SERVICE_UNAVAILABLE"):
            create_product_proxy_service(enabled=True,
                                         direct_tls_capture=DirectTlsSocketCapture())
        with self.assertRaisesRegex(Exception, "PRODUCT_PROXY_SERVICE_UNAVAILABLE"):
            create_product_proxy_service(enabled="true")

    async def test_http_requires_native_lifespan_and_current_callback(self):
        incoming = asyncio.Queue()
        observed = asyncio.Queue()
        active = [True]
        host = _Host()

        async def native(scope, receive, send):
            self.assertEqual(scope["type"], "lifespan")
            self.assertEqual((await receive())["type"], "lifespan.startup")
            await send({"type": "lifespan.startup.complete"})
            self.assertEqual((await receive())["type"], "lifespan.shutdown")
            await send({"type": "lifespan.shutdown.complete"})

        async def invoke(*_args):
            pass

        invoke.native_app = native
        invoke.registration_current = lambda: active[0]
        service = ProductProxyService(host, invoke, DirectTlsSocketCapture())

        async def collect(event):
            await observed.put(event)

        async def call_http():
            sent = []

            async def gather(event):
                sent.append(event)

            await service({"type": "http"}, lambda: None, gather)
            return sent

        self.assertEqual((await call_http())[0]["status"], 403)
        await incoming.put({"type": "lifespan.startup"})
        lifespan = asyncio.create_task(service({"type": "lifespan"}, incoming.get, collect))
        self.assertEqual((await observed.get())["type"], "lifespan.startup.complete")
        self.assertTrue(service.ready)
        self.assertEqual((await call_http())[0]["status"], 200)
        self.assertEqual(host.calls, 1)
        active[0] = False
        self.assertEqual((await call_http())[0]["status"], 403)
        self.assertEqual(host.calls, 1)
        active[0] = True
        await incoming.put({"type": "lifespan.shutdown"})
        self.assertEqual((await observed.get())["type"], "lifespan.shutdown.complete")
        await lifespan
        self.assertFalse(service.ready)


if __name__ == "__main__":
    unittest.main()
