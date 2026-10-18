"""Focused offline checks of the product host wiring; no model or SQL call."""
import hashlib
import importlib
import asyncio
import json
import sys
import threading
import time
import types
import unittest
from unittest.mock import patch

import httpx

from apps.proxy.product.test.test_host_observation import (
    BINDING, CLIENT_ID, GRANT, Inner, MESSAGE, NATIVE, RAW, RUN, URL,
    _request_lifetime, fixture, LifetimeLimits, PendingWork,
    RequestLifetime, PeerLease,
)
from apps.proxy.qualification.runtime.server import TrustedRequest


class _Handler:
    def __init__(self, *, event_hooks, transport, follow_redirects):
        self.client = httpx.AsyncClient(event_hooks=event_hooks, transport=transport,
                                        follow_redirects=follow_redirects, trust_env=False)

    async def close(self):
        await self.client.aclose()


names = ["litellm", "litellm.llms", "litellm.llms.custom_httpx",
         "litellm.llms.custom_httpx.http_handler"]
modules = {name: types.ModuleType(name) for name in names}
modules[names[-1]].AsyncHTTPHandler = _Handler
_before = set(sys.modules)
with patch.dict(sys.modules, modules):
    PRODUCT = importlib.import_module("apps.proxy.product.host_composition")
    _product = {name: module for name, module in sys.modules.items()
                if name.startswith("apps.") and name not in _before}
# patch.dict drops every module first imported inside it. Keep one instance of the
# product modules (their type-identity checks span suites); only stubs are removed.
sys.modules.update(_product)


class _Counter:
    def __init__(self):
        self.calls = 0

    async def count(self, parameters):
        self.calls += 1
        raw = parameters["input"]["invokeModel"]["body"]
        # The source fixture imports its modules under a short-lived LiteLLM
        # stub; use the class belonging to this host composition's guard.
        observation = PRODUCT.HostRequestObservation.count.__globals__["CountObservation"]
        return observation(12, hashlib.sha256(raw).hexdigest(),
                           "anthropic.claude-sonnet-4-6", "aws-counttokens")


class _Bridge:
    def __init__(self, capture_request):
        self.capture_request = capture_request
        self.capture_complete = None
        self.reservations = self.settlements = 0

    async def reserve(self, value, claim):
        observed = await self.capture_request(value)
        if observed != claim:
            raise AssertionError("host request capture differs")
        self.reservations += 1
        return {"requestId": value["requestId"],
                "nativeBodySha256": hashlib.sha256(observed["nativeRequest"]["body"]).hexdigest(),
                "state": "UNKNOWN"}

    def bind_complete_capture(self, callback):
        if self.capture_complete is not None:
            raise AssertionError("second capture")
        self.capture_complete = callback

    async def settle_complete(self, request_id, claim):
        source = await self.capture_complete({
            "requestId": request_id, "binding": BINDING, "grantId": GRANT})
        if source["usageResult"]["evidence_sha256"] != claim.evidence_sha256:
            raise AssertionError("host response capture differs")
        self.settlements += 1

    async def read_outcome(self, request_id):
        raise AssertionError("certain settlement has no reconciliation")


class HostCompositionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        _, ingress, scope = fixture()

        async def observer():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        self.life = RequestLifetime(ingress, observer, time.monotonic() + 10,
                                    LifetimeLimits(poll_seconds=.05, check_seconds=.5), PendingWork())
        await self.life.start(scope)
        self.life.original_body = RAW
        self.token = _request_lifetime.set(self.life)
        self.counter = _Counter()
        self.inner = Inner([MESSAGE])
        self.bridge = None
        self.archived = False

    async def asyncTearDown(self):
        _request_lifetime.reset(self.token)
        await self.life.close()

    async def test_missing_trusted_host_or_litellm_invoker_refuses_mount(self):
        async def supplied(*_args):
            raise AssertionError("refused mount must not invoke a port")

        for ports in (
            {"trusted_resolver": None, "resolve_session": supplied,
             "invoke_litellm": supplied},
            {"trusted_resolver": supplied, "resolve_session": None,
             "invoke_litellm": supplied},
            {"trusted_resolver": supplied, "resolve_session": supplied,
             "invoke_litellm": None},
        ):
            with self.subTest(ports=tuple(k for k, v in ports.items() if v is None)):
                with self.assertRaisesRegex(Exception, "PRODUCT_PROXY_COMPOSITION_REFUSED"):
                    PRODUCT.create_product_proxy_app(**ports)

    async def current(self, request):
        if self.archived:
            raise RuntimeError("Core conversation archived")
        at = time.time_ns() // 1_000_000
        return {"identitySha256": "a" * 64, "binding": BINDING.copy(),
                "scopes": [{"kind": "client", "tenantId": BINDING["tenantId"],
                            "resourceId": CLIENT_ID, "policyRevision": RUN.policy_revision}],
                "selectedClientId": CLIENT_ID, "contextRevision": "b" * 64,
                "checkedAtMs": at, "expiresAtMs": at + 5000}

    def session(self, *, bridge_factory=None):
        def make_bridge(capture):
            self.bridge = _Bridge(capture)
            return self.bridge

        return PRODUCT.ProductSession(
            "request_A", BINDING.copy(), GRANT, 9000000000000, CLIENT_ID,
            "a" * 64, object(), lambda: self.inner,
            bridge_factory or make_bridge, self.current)

    async def test_single_final_native_send_and_complete_eof_settlement(self):
        with patch.object(PRODUCT, "AwsNativeCounter", return_value=self.counter):
            handler = await PRODUCT.create_guarded_product_handler(self.life, self.session())
        try:
            async with handler.client.stream("POST", URL, content=NATIVE,
                                             headers={"content-type": "application/json"}) as response:
                self.assertEqual(b"".join([chunk async for chunk in response.aiter_raw()]), MESSAGE)
            self.assertEqual(self.counter.calls, 1)
            self.assertEqual(self.inner.calls, 1)
            self.assertEqual(self.bridge.reservations, 1)
            self.assertEqual(self.bridge.settlements, 1)
            with self.assertRaises(Exception):
                await handler.client.post(URL, content=NATIVE,
                                          headers={"content-type": "application/json"})
            self.assertEqual(self.inner.calls, 1)
        finally:
            await handler.close()

    async def test_missing_owner_capture_refuses_before_count_or_provider(self):
        with patch.object(PRODUCT, "AwsNativeCounter", return_value=self.counter):
            with self.assertRaisesRegex(Exception, "PRODUCT_PROXY_COMPOSITION_REFUSED"):
                await PRODUCT.create_guarded_product_handler(
                    self.life, self.session(bridge_factory=lambda _: object()))
        self.assertEqual(self.counter.calls, 0)
        self.assertEqual(self.inner.calls, 0)

    async def test_archived_core_refuses_before_count_or_reservation(self):
        with patch.object(PRODUCT, "AwsNativeCounter", return_value=self.counter):
            handler = await PRODUCT.create_guarded_product_handler(self.life, self.session())
        try:
            self.archived = True
            with self.assertRaises(Exception):
                await handler.client.post(URL, content=NATIVE,
                                          headers={"content-type": "application/json"})
            self.assertEqual(self.counter.calls, 0)
            self.assertEqual(self.bridge.reservations, 0)
            self.assertEqual(self.inner.calls, 0)
        finally:
            await handler.close()

    async def test_wrong_persisted_grant_refuses_before_provider_transport(self):
        session = self.session()
        wrong = PRODUCT.ProductSession(**{
            **session.__dict__, "model_grant_id": "different-grant"})
        with self.assertRaisesRegex(Exception, "PRODUCT_PROXY_COMPOSITION_REFUSED"):
            await PRODUCT.create_guarded_product_handler(self.life, wrong)
        self.assertEqual(self.inner.calls, 0)

    async def test_asgi_host_mounts_only_admitted_messages_and_closes_handler(self):
        _, ingress, scope = fixture()
        calls = {"resolved": 0, "invoked": 0}

        async def observe():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        def trusted(_scope):
            return TrustedRequest(ingress, observe, time.monotonic() + 5)

        async def resolve(_life):
            calls["resolved"] += 1
            return self.session()

        async def invoke(handler, _scope, receive, send):
            calls["invoked"] += 1
            self.assertEqual((await receive())["body"], RAW)
            async with handler.client.stream("POST", URL, content=NATIVE,
                                             headers={"content-type": "application/json"}) as response:
                body = b"".join([chunk async for chunk in response.aiter_raw()])
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": body, "more_body": False})

        app = PRODUCT.create_product_proxy_app(
            trusted_resolver=trusted, resolve_session=resolve,
            invoke_litellm=invoke,
            limits=LifetimeLimits(poll_seconds=.05, check_seconds=.5))
        receive_queue = asyncio.Queue()
        receive_queue.put_nowait({"type": "http.request", "body": RAW, "more_body": False})
        sent = []

        async def send(value):
            sent.append(value)

        with patch.object(PRODUCT, "AwsNativeCounter", return_value=self.counter):
            await app(scope, receive_queue.get, send)
        self.assertEqual([event["type"] for event in sent],
                         ["http.response.start", "http.response.body"])
        self.assertEqual(sent[1]["body"], MESSAGE)
        self.assertEqual((calls["resolved"], calls["invoked"], self.inner.calls), (1, 1, 1))
        self.assertEqual(self.bridge.settlements, 1)
        self.assertTrue(app.ready)

        _, _, denied_scope = fixture()
        denied_scope.update(path="/key/generate", raw_path=b"/key/generate")
        denied = []
        async def deny_send(value):
            denied.append(value)
        await app(denied_scope, receive_queue.get, deny_send)
        self.assertEqual(denied[0]["status"], 403)
        self.assertEqual((calls["resolved"], calls["invoked"], self.inner.calls), (1, 1, 1))

    async def test_cli_count_route_uses_admitted_lifetime_without_model_send(self):
        _, ingress, scope = fixture()
        scope.update(path="/v1/messages/count_tokens",
                     raw_path=b"/v1/messages/count_tokens")
        scope["headers"].extend([
            (b"anthropic-version", b"2023-06-01"),
            (b"anthropic-beta", b"token-counting-2024-11-01")])

        async def observe():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        async def resolve(_life):
            return self.session()

        invoked = []
        async def invoke(*args):
            invoked.append(1)

        app = PRODUCT.create_product_proxy_app(
            trusted_resolver=lambda _: TrustedRequest(ingress, observe, time.monotonic() + 5),
            resolve_session=resolve, invoke_litellm=invoke,
            limits=LifetimeLimits(poll_seconds=.05, check_seconds=.5))
        request = json.dumps({"model": PRODUCT.MODEL_ALIAS,
                              "messages": [{"role": "user", "content": "synthetic"}],
                              "tools": []}).encode()
        queue = asyncio.Queue()
        queue.put_nowait({"type": "http.request", "body": request, "more_body": False})
        sent = []
        async def send(value):
            sent.append(value)
        async def synthetic_count(_request):
            return 7
        with patch.object(PRODUCT, "create_fixed_cli_count_callback", return_value=synthetic_count):
            await app(scope, queue.get, send)
        self.assertEqual(sent[0]["status"], 200)
        self.assertEqual(json.loads(sent[1]["body"]), {"input_tokens": 7})
        self.assertEqual(invoked, [])
        self.assertEqual(self.inner.calls, 0)
        self.assertTrue(app.ready)

    async def test_cli_count_refuses_archived_core_before_aws_count(self):
        _, ingress, scope = fixture()
        scope.update(path="/v1/messages/count_tokens",
                     raw_path=b"/v1/messages/count_tokens")
        scope["headers"].extend([
            (b"anthropic-version", b"2023-06-01"),
            (b"anthropic-beta", b"token-counting-2024-11-01")])

        async def observe():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        async def resolve(_life):
            return self.session()

        async def invoke(*_args):
            raise AssertionError("Messages invoker must not run")

        app = PRODUCT.create_product_proxy_app(
            trusted_resolver=lambda _: TrustedRequest(ingress, observe, time.monotonic() + 5),
            resolve_session=resolve, invoke_litellm=invoke,
            limits=LifetimeLimits(poll_seconds=.05, check_seconds=.5))
        request = json.dumps({"model": PRODUCT.MODEL_ALIAS,
                              "messages": [{"role": "user", "content": "synthetic"}],
                              "tools": []}).encode()
        queue = asyncio.Queue()
        queue.put_nowait({"type": "http.request", "body": request, "more_body": False})
        sent, counted = [], []

        async def count(_request):
            counted.append(1)
            return 7

        self.archived = True
        with patch.object(PRODUCT, "create_fixed_cli_count_callback", return_value=count):
            await app(scope, queue.get, sent.append)
        self.assertEqual(sent[0]["status"], 403)
        self.assertEqual(counted, [])
        self.assertEqual(self.inner.calls, 0)

    async def test_cli_count_refuses_context_change_during_aws_count(self):
        _, ingress, scope = fixture()
        scope.update(path="/v1/messages/count_tokens",
                     raw_path=b"/v1/messages/count_tokens")
        scope["headers"].extend([
            (b"anthropic-version", b"2023-06-01"),
            (b"anthropic-beta", b"token-counting-2024-11-01")])

        async def observe():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        async def resolve(_life):
            return self.session()

        app = PRODUCT.create_product_proxy_app(
            trusted_resolver=lambda _: TrustedRequest(ingress, observe, time.monotonic() + 5),
            resolve_session=resolve, invoke_litellm=lambda *_: None,
            limits=LifetimeLimits(poll_seconds=.05, check_seconds=.5))
        request = json.dumps({"model": PRODUCT.MODEL_ALIAS,
                              "messages": [{"role": "user", "content": "synthetic"}],
                              "tools": []}).encode()
        queue = asyncio.Queue()
        queue.put_nowait({"type": "http.request", "body": request, "more_body": False})
        sent, counted = [], []

        async def count(_request):
            counted.append(1)
            self.archived = True
            return 7

        with patch.object(PRODUCT, "create_fixed_cli_count_callback", return_value=count):
            await app(scope, queue.get, sent.append)
        self.assertEqual(sent[0]["status"], 403)
        self.assertEqual(counted, [1])
        self.assertEqual(self.inner.calls, 0)

    async def test_bounded_bootstrap_reaches_existing_count_lifetime(self):
        _, ingress, scope = fixture()
        scope.update(path="/v1/messages/count_tokens",
                     raw_path=b"/v1/messages/count_tokens")
        scope["headers"].extend([
            (b"anthropic-version", b"2023-06-01"),
            (b"anthropic-beta", b"token-counting-2024-11-01")])

        async def observe():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        async def resolve(_life):
            return self.session()

        async def invoke(*_args):
            raise AssertionError("CountTokens must not invoke inference")

        trusted = lambda _: TrustedRequest(ingress, observe, time.monotonic() + 5)
        with patch.object(PRODUCT, "create_bearer_eni_trusted_resolver", return_value=trusted):
            app = PRODUCT.create_bearer_eni_product_proxy_app(
                read_direct_tls_socket=lambda _: None,
                resolve_bearer_sha256=lambda _: None,
                observe_task_eni=lambda *_: None,
                resolve_session=resolve, invoke_litellm=invoke,
                limits=LifetimeLimits(poll_seconds=.05, check_seconds=.5))
        request = json.dumps({"model": PRODUCT.MODEL_ALIAS,
                              "messages": [{"role": "user", "content": "synthetic"}],
                              "tools": []}).encode()
        queue = asyncio.Queue()
        queue.put_nowait({"type": "http.request", "body": request, "more_body": False})
        sent, counted = [], []

        async def send(value):
            sent.append(value)

        async def count(_request):
            counted.append(1)
            return 7

        with patch.object(PRODUCT, "create_fixed_cli_count_callback", return_value=count):
            await app(scope, queue.get, send)
        self.assertEqual(sent[0]["status"], 200)
        self.assertEqual(json.loads(sent[1]["body"]), {"input_tokens": 7})
        self.assertEqual(counted, [1])
        self.assertTrue(app.ready)


class _BootstrapInner:
    def __init__(self, pull):
        self.pull = pull
        self.pending = PendingWork()
        self.trusted = None
        self.late_release = None
        self.late_task = None

    @property
    def ready(self):
        return self.pending.ready

    async def _refuse(self, send):
        await send({"type": "http.response.start", "status": 403, "headers": []})

    async def __call__(self, scope, _receive, send):
        self.trusted = self.pull(scope)
        if self.late_release is not None:
            async def late_pull():
                await self.late_release.wait()
                return self.pull(scope)
            self.late_task = asyncio.create_task(late_pull())
        await send({"type": "http.response.start", "status": 200, "headers": []})


class BoundedBootstrapTests(unittest.IsolatedAsyncioTestCase):
    def _app(self, resolver, *, seconds=.05):
        with (patch.object(PRODUCT, "create_bearer_eni_trusted_resolver", return_value=resolver),
              patch.object(PRODUCT, "create_product_proxy_app",
                           side_effect=lambda **kwargs: _BootstrapInner(kwargs["trusted_resolver"]))):
            return PRODUCT.create_bearer_eni_product_proxy_app(
                read_direct_tls_socket=lambda _: None,
                resolve_bearer_sha256=lambda _: None,
                observe_task_eni=lambda *_: None,
                resolve_session=lambda _: None,
                invoke_litellm=lambda *_: None,
                bootstrap_seconds=seconds)

    async def _call(self, app, scope):
        sent = []

        async def send(value):
            sent.append(value)

        await app(scope, lambda: None, send)
        return sent

    async def test_success_uses_one_request_bound_trusted_context(self):
        _, ingress, scope = fixture()

        async def observer():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        trusted = TrustedRequest(ingress, observer, time.monotonic() + 20)
        app = self._app(lambda _: trusted)
        sent = await self._call(app, scope)
        self.assertEqual(sent[0]["status"], 200)
        self.assertIs(app._inner.trusted.admission, ingress)
        self.assertTrue(app.ready)
        with self.assertRaises(PRODUCT.StateDenied):
            app._inner.pull(scope)  # No request-local context survives response.

    async def test_child_copy_of_context_is_revoked_after_response(self):
        _, ingress, scope = fixture()

        async def observer():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        trusted = TrustedRequest(ingress, observer, time.monotonic() + 20)
        app = self._app(lambda _: trusted)
        app._inner.late_release = asyncio.Event()
        sent = await self._call(app, scope)
        self.assertEqual(sent[0]["status"], 200)
        self.assertIsNotNone(app._inner.late_task)
        app._inner.late_release.set()
        with self.assertRaises(PRODUCT.StateDenied):
            await app._inner.late_task
        self.assertTrue(app.ready)

    async def test_hung_sync_lookup_does_not_block_loop_and_poison_is_sticky(self):
        gate = threading.Event()
        entered = threading.Event()
        _, ingress, scope = fixture()

        async def observer():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        def slow(_scope):
            entered.set()
            gate.wait(2)
            return TrustedRequest(ingress, observer, time.monotonic() + 20)

        app = self._app(slow, seconds=.03)
        started = time.monotonic()
        try:
            sent = await self._call(app, scope)
            self.assertEqual(sent[0]["status"], 403)
            self.assertLess(time.monotonic() - started, .5)
            self.assertTrue(entered.is_set())
            self.assertFalse(app.ready)
            self.assertFalse(app._inner.ready)
            again = await self._call(app, scope)
            self.assertEqual(again[0]["status"], 403)
            gate.set()
            await asyncio.sleep(.05)
            self.assertFalse(app.ready)  # Late success never reopens the host.
        finally:
            gate.set()
    async def test_cancellation_quarantines_outstanding_lookup(self):
        gate = threading.Event()
        started = threading.Event()
        _, ingress, scope = fixture()

        async def observer():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), RUN, GRANT)

        def slow(_scope):
            started.set()
            gate.wait(2)
            return TrustedRequest(ingress, observer, time.monotonic() + 20)

        app = self._app(slow, seconds=.5)
        task = asyncio.create_task(self._call(app, scope))
        try:
            await asyncio.wait_for(asyncio.to_thread(started.wait, .2), .3)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
            self.assertFalse(app.ready)
        finally:
            gate.set()


if __name__ == "__main__":
    unittest.main()
