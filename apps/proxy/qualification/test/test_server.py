"""Assembled ASGI caller controls; actual socket/TLS/ECS/LiteLLM not proven."""
import asyncio
import json
import sys
import time
import types
import unittest
from unittest.mock import patch

from apps.proxy.qualification.runtime.ingress import PeerLease
from apps.proxy.qualification.runtime.lifetime import LifetimeLimits, _request_lifetime
from apps.proxy.qualification.runtime.server import TrustedRequest, create_app
from apps.proxy.qualification.test.test_ingress import fixture, BINDING, GRANT

LIMITS = LifetimeLimits(check_seconds=.05, cleanup_seconds=.02)


class ServerTests(unittest.IsolatedAsyncioTestCase):
    def make(self, upstream, *, deadline=None, observer=None, limits=LIMITS, count_tokens_app=None):
        store, admission, scope = fixture()
        async def observe():
            return PeerLease("10.77.0.9", time.monotonic(), BINDING, GRANT)
        def resolve(actual_scope):
            return TrustedRequest(admission, observer or observe, deadline or time.monotonic()+1)
        app = create_app(upstream, resolve, limits, count_tokens_app=count_tokens_app)
        queue = asyncio.Queue()
        queue.put_nowait({"type": "http.request", "body": b"{}", "more_body": False})
        sends = []
        async def send(event):
            sends.append(event)
        return store, scope, app, queue, sends, send

    async def test_actual_upstream_invoked_after_auth_with_private_context_and_body(self):
        calls = []
        async def upstream(scope, receive, send):
            calls.append(_request_lifetime.get().check)
            self.assertGreater(store.calls, 0)
            self.assertEqual((await receive())["body"], b"{}")
            calls[0]()
            await send({"type": "http.response.start", "status": 200})
            await send({"type": "http.response.body", "body": b"synthetic", "more_body": False})
        store, scope, app, queue, sends, send = self.make(upstream)
        await app(scope, queue.get, send)
        self.assertEqual([x["type"] for x in sends], ["http.response.start", "http.response.body"])
        self.assertEqual(len(calls), 1)
        self.assertIsNone(_request_lifetime.get())
        self.assertTrue(app.ready)


    async def test_routes_headers_keys_denied_before_upstream_or_body(self):
        calls = []
        async def upstream(*args):
            calls.append(1)
        for field, value in (("scheme", "http"), ("path", "/key/generate"), ("query_string", b""), ("query_string", b"beta=true&x=1"),
                             ("client", ("10.77.0.10", 10)), ("headers", [(b"x-meri-task", b"forged")])):
            _, scope, app, _, sends, send = self.make(upstream)
            scope[field] = value
            async def forbidden():
                self.fail("unauthorized request consumed body")
            await app(scope, forbidden, send)
            self.assertEqual(sends[0]["status"], 403)
        self.assertEqual(calls, [])


    async def test_unmounted_count_tokens_route_never_falls_into_inference(self):
        inference = []
        async def upstream(*args):
            inference.append(1)
        _, scope, app, queue, sends, send = self.make(upstream)
        scope.update(path="/v1/messages/count_tokens", raw_path=b"/v1/messages/count_tokens")
        await app(scope, queue.get, send)
        self.assertEqual(inference, [])
        self.assertEqual(sends[0]["status"], 403)

    async def test_actual_caller_private_context_explicitly_wires_native_guard(self):
        # Real guard constructed INSIDE actual caller; no HTTP context injection.
        import hashlib
        import json
        import httpx
        from apps.proxy.qualification.runtime.bedrock_body import COUNT_MODEL_ID
        # This case exercises the native guard hook, not the LiteLLM handler.
        # Keep it runnable when the pinned upstream package is absent locally.
        modules = {name: types.ModuleType(name) for name in
                   ("litellm", "litellm.llms", "litellm.llms.custom_httpx",
                    "litellm.llms.custom_httpx.http_handler")}
        modules["litellm.llms.custom_httpx.http_handler"].AsyncHTTPHandler = object
        with patch.dict(sys.modules, modules):
            from apps.proxy.qualification.runtime.bedrock_transport import BedrockSendGuard, CountObservation
        from apps.proxy.qualification.state.pricing import StateDenied
        observed = []
        class Counter:
            async def count(self, parameters):
                raw = parameters["input"]["invokeModel"]["body"]
                _request_lifetime.get().deny("SYNTHETIC_REVOKE_DURING_COUNT")
                return CountObservation(1, hashlib.sha256(raw).hexdigest(), COUNT_MODEL_ID, "fixture")
        class Ledger:
            async def reserve_and_arm_once(self, *args):
                raise AssertionError("revoked guard reached ledger")
        async def upstream(scope, receive, send):
            guard = BedrockSendGuard(request_id="synthetic-native-1", counter=Counter(), ledger=Ledger(),
                                     deadline=time.monotonic()+1, expected_count_origin="fixture",
                                     lifetime_check=_request_lifetime.get().check)
            self.assertIs(guard.lifetime_check.__self__, _request_lifetime.get())
            raw = json.dumps({"anthropic_version": "bedrock-2023-05-31", "max_tokens": 16,
                              "messages": [{"role": "user", "content": "synthetic"}]}).encode()
            request = httpx.Request("POST", "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-6/invoke",
                                    content=raw, headers={"content-type": "application/json"})
            with self.assertRaises(StateDenied):
                await guard.before_send(request)
            observed.append(guard.armed)
        _, scope, app, queue, _, send = self.make(upstream)
        await app(scope, queue.get, send)
        self.assertEqual(observed, [False])

    async def test_blocked_send_cut_by_disconnect_without_downstream_resume(self):
        entered, release, canceled = asyncio.Event(), asyncio.Event(), asyncio.Event()
        pulls = []
        async def upstream(scope, receive, send):
            await receive()
            await send({"type": "http.response.start", "status": 200})
            try:
                pulls.append(1)
                await send({"type": "http.response.body", "body": b"one", "more_body": True})
                pulls.append(2)
            finally:
                canceled.set()
        store, scope, app, queue, sends, _ = self.make(upstream)
        async def blocked(event):
            sends.append(event)
            if event["type"] == "http.response.body":
                entered.set()
                await release.wait()
        task = asyncio.create_task(app(scope, queue.get, blocked))
        await asyncio.wait_for(entered.wait(), .3)
        queue.put_nowait({"type": "http.disconnect"})
        await asyncio.wait_for(task, .3)
        self.assertTrue(canceled.is_set())
        self.assertEqual(pulls, [1])
        self.assertFalse(release.is_set())
        self.assertTrue(app.ready)

    async def test_quiet_upstream_ends_on_disconnect_not_on_a_later_fence_change(self):
        started, canceled = asyncio.Event(), asyncio.Event()
        async def upstream(scope, receive, send):
            await receive()
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                canceled.set()
        store, scope, app, queue, sends, send = self.make(upstream)
        task = asyncio.create_task(app(scope, queue.get, send))
        await asyncio.wait_for(started.wait(), .3)
        store.run["fence"] = 2  # Admission happened at start; the request is not re-authorized.
        await asyncio.sleep(.05)
        self.assertFalse(task.done())
        queue.put_nowait({"type": "http.disconnect"})
        await asyncio.wait_for(task, .3)
        self.assertTrue(canceled.is_set())

    async def test_body_bound_and_malformed_event_deny(self):
        for event in ({"type": "http.request", "body": b"x"*9}, {"type": "http.request", "body": "wrong"},
                      {"type": "http.request", "body": b"x", "more_body": 1}):
            reached = []
            async def upstream(scope, receive, send):
                await receive()
                reached.append(1)
            _, scope, app, queue, sends, send = self.make(upstream, limits=LifetimeLimits(.05, .02, 8, 2))
            queue.get_nowait()
            queue.put_nowait(event)
            await asyncio.wait_for(app(scope, queue.get, send), .3)
            self.assertEqual(reached, [])

    async def test_single_receive_owner_and_bounded_queue(self):
        active = calls = maximum = 0
        wait, saturated = asyncio.Event(), asyncio.Event()
        async def upstream(scope, receive, send):
            await wait.wait()
        _, scope, app, _, _, send = self.make(upstream)
        async def receive():
            nonlocal active, calls, maximum
            active += 1
            maximum = max(maximum, active)
            calls += 1
            if calls == 3:
                saturated.set()
            await asyncio.sleep(0)
            active -= 1
            return {"type": "http.request", "body": b"x", "more_body": True}
        task = asyncio.create_task(app(scope, receive, send))
        try:
            await asyncio.wait_for(saturated.wait(), .3)
            await asyncio.sleep(.01)
            self.assertEqual(maximum, 1)
            self.assertEqual(calls, 3)  # Two queued + one held by sole bounded pump.
        finally:
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task

    async def test_cancellation_resistant_upstream_quarantines_and_denies_next_request(self):
        entered, release = asyncio.Event(), asyncio.Event()
        async def upstream(scope, receive, send):
            entered.set()
            try:
                await release.wait()
            except asyncio.CancelledError:
                await release.wait()  # Models upstream shielded iterator cleanup.
        store, scope, app, queue, sends, send = self.make(upstream)
        task = asyncio.create_task(app(scope, queue.get, send))
        try:
            await asyncio.wait_for(entered.wait(), .3)
            queue.put_nowait({"type": "http.disconnect"})
            await asyncio.wait_for(task, .3)
            self.assertFalse(app.ready)
            self.assertEqual(len(app.pending.tasks), 1)
            before = store.calls
            await app(scope, queue.get, send)
            self.assertEqual(store.calls, before)
        finally:
            release.set()
            if app.pending.tasks:
                await asyncio.wait(set(app.pending.tasks), timeout=.3)

    async def test_composed_mandatory_receive_cancellation_denies(self):
        entered, finished = asyncio.Event(), asyncio.Event()
        lives = []
        async def upstream(scope, receive, send):
            lives.append(_request_lifetime.get())
            entered.set()
            try:
                await asyncio.Event().wait()
            finally:
                finished.set()
        _, scope, app, _, sends, send = self.make(upstream)
        async def receive():
            await entered.wait()
            raise asyncio.CancelledError()
        task = asyncio.create_task(app(scope, receive, send))
        try:
            await asyncio.wait_for(entered.wait(), .3)
            await asyncio.wait_for(task, .3)
            self.assertTrue(finished.is_set())
            self.assertEqual(lives[0].reason, "REQUEST_RECEIVE_CANCELLED")
            self.assertTrue(lives[0].denied.is_set())
            self.assertEqual(lives[0].tasks, set())
            self.assertTrue(app.ready)
            self.assertEqual(sends[0]["status"], 403)
        finally:
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    async def test_whole_request_cancellation_propagates_without_reason_replacement(self):
        entered, finished = asyncio.Event(), asyncio.Event()
        lives = []
        async def upstream(scope, receive, send):
            lives.append(_request_lifetime.get())
            entered.set()
            try:
                await asyncio.Event().wait()
            finally:
                finished.set()
        _, scope, app, queue, _, send = self.make(upstream)
        task = asyncio.create_task(app(scope, queue.get, send))
        await asyncio.wait_for(entered.wait(), .3)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(finished.is_set())
        self.assertEqual(lives[0].reason, "REQUEST_CANCELLED")
        self.assertEqual(lives[0].tasks, set())
        self.assertTrue(app.ready)
