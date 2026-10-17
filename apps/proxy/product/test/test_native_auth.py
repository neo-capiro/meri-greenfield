"""Offline projection controls with real product reader/lifetime, synthetic wire."""
import asyncio
from dataclasses import replace
import json
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import uuid

from apps.proxy.product import native_auth as auth
from apps.proxy.product.owner_admission import ProductOwnerAdmissionReader
from apps.proxy.product.owner_channel import OwnerPeerPolicy, OwnerHostGate
from apps.proxy.product.test.test_owner_admission import Exchange, milliseconds
from apps.proxy.product.test.test_bearer_eni_admission import source as issued_fixture
from apps.proxy.qualification.runtime.ingress import IngressAdmission, PeerLease
from apps.proxy.qualification.runtime.lifetime import RequestLifetime, LifetimeLimits, PendingWork, _request_lifetime
from apps.proxy.qualification.test.test_ingress import fixture, SHA, KEY


class Request:
    def __init__(self, scope, body):
        self.scope, self.raw = scope, body

    async def body(self):
        return self.raw


class AuthTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.issued = issued_fixture()[0].issued
        self.policy = OwnerPeerPolicy("https://owner.invalid:8444", "owner.invalid", "owner-task",
            "proxy-"+uuid.uuid4().hex, "1"*64, "2"*64, "3"*64, "proxy-subject")
        self.exchange = Exchange(self.policy, self.issued)
        self.exchange.source[2] = SHA
        self.reader = ProductOwnerAdmissionReader(policy=self.policy, exchange=self.exchange,
            host_gate=OwnerHostGate(), owner_loop=asyncio.get_running_loop())
        result = await asyncio.to_thread(self.reader.resolve_for_issued_sync,
            issued=self.issued, capability_sha256=SHA, deadline_ms=milliseconds()+2000)
        peer = PeerLease("10.77.0.9", time.monotonic(), result.authority.binding, result.authority.grant_id)
        async def observe():
            return replace(peer, observed_at=time.monotonic())
        self.life = RequestLifetime(IngressAdmission(result.authority, peer), observe,
            time.monotonic()+2, LifetimeLimits(), PendingWork())
        self.scope = fixture()[2]
        await self.life.start(self.scope)
        self.body = json.dumps({"model": auth.MODEL, "messages": []}).encode()
        self.life.original_body = self.body
        self.types = SimpleNamespace(UserAPIKeyAuth=lambda **values: SimpleNamespace(**values),
                                     LitellmUserRoles=SimpleNamespace(CUSTOMER="customer"))

    async def asyncTearDown(self):
        await self.life.close()

    async def dispatch(self, callback, *, request=None):
        request = request or Request(self.scope, self.body)
        async def native(scope, receive, send):
            return await callback(request)
        token = _request_lifetime.set(self.life)
        try:
            with patch.object(auth.metadata, "version", return_value="1.104.2"), \
                 patch.object(auth, "import_module", return_value=self.types):
                return await auth.wrap_native_app(native)(self.scope, None, None)
        finally:
            _request_lifetime.reset(token)

    async def test_real_product_authority_refreshes_and_projects_sha_model_only(self):
        before = len(self.exchange.calls)
        result = await self.dispatch(lambda req: auth.authenticate_product_request(req, KEY.decode()))
        self.assertEqual(len(self.exchange.calls), before+2)
        self.assertEqual(vars(result), {"token": SHA, "models": [auth.MODEL], "user_role": "customer",
            "expires": result.expires, "metadata": {}, "request_route": "/v1/messages"})
        self.assertNotIn(KEY.decode(), repr(vars(result)))
        self.assertLessEqual(int(result.expires.timestamp()*1000), self.issued.expires_at_ms)

    async def test_hook_without_outer_dispatch_or_exact_scope_refuses(self):
        with self.assertRaises(Exception):
            await auth.authenticate_product_request(Request(self.scope, self.body), KEY.decode())
        with self.assertRaises(Exception):
            await self.dispatch(lambda req: auth.authenticate_product_request(req, KEY.decode()),
                                request=Request(dict(self.scope), self.body))

    async def test_foreign_key_model_raw_body_and_second_auth_are_denied(self):
        for kind in ("key", "model", "body", "second"):
            async def call(req):
                if kind == "model":
                    req.raw = self.life.original_body = b'{"model":"foreign"}'
                if kind == "body":
                    req.raw = b'{"model":"meri-sonnet-qualification"}'
                result = await auth.authenticate_product_request(req, "foreign" if kind == "key" else KEY.decode())
                if kind == "second":
                    await auth.authenticate_product_request(req, KEY.decode())
                return result
            self.life.original_body = self.body
            with self.subTest(kind=kind), self.assertRaises(Exception):
                await self.dispatch(call)

    async def test_fresh_core_foreign_source_and_closed_lifetime_refuse(self):
        self.exchange.source[0][1] = "foreign-actor"
        with self.assertRaises(Exception):
            await self.dispatch(lambda req: auth.authenticate_product_request(req, KEY.decode()))
        self.assertFalse(self.reader.host_gate.available)

    async def test_closed_lifetime_and_mutated_native_scope_refuse_before_owner_read(self):
        before = len(self.exchange.calls)
        async def altered(req):
            req.scope["headers"] = [(b"authorization", b"Bearer "+b"f"*40)]
            return await auth.authenticate_product_request(req, KEY.decode())
        with self.assertRaises(Exception):
            await self.dispatch(altered)
        self.assertEqual(len(self.exchange.calls), before)
        self.scope = fixture()[2]
        self.life.deny("REQUEST_CLOSED")
        with self.assertRaises(Exception):
            await self.dispatch(lambda req: auth.authenticate_product_request(req, KEY.decode()))
        self.assertEqual(len(self.exchange.calls), before)

    async def test_copied_context_cannot_authenticate_after_dispatch_ends(self):
        ready = asyncio.Event()
        tasks = []
        async def call(req):
            async def late():
                await ready.wait()
                with self.assertRaises(Exception):
                    await auth.authenticate_product_request(req, KEY.decode())
            tasks.append(asyncio.create_task(late()))
            return None
        await self.dispatch(call)
        before = len(self.exchange.calls)
        ready.set()
        await asyncio.gather(*tasks)
        self.assertEqual(len(self.exchange.calls), before)

    async def test_foreign_private_context_cannot_reuse_the_active_scope(self):
        async def foreign(req):
            _request_lifetime.set(None)
            return await auth.authenticate_product_request(req, KEY.decode())
        with self.assertRaises(Exception):
            await self.dispatch(foreign)


if __name__ == "__main__":
    unittest.main()
