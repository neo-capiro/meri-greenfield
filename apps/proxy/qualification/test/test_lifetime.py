"""Finite synthetic canonical-authority lifetime controls; no services."""
import asyncio
from dataclasses import replace
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from apps.proxy.qualification.runtime import lifetime as lifetime_module
from apps.proxy.qualification.runtime.ingress import PeerLease
from apps.proxy.qualification.runtime.lifetime import LifetimeLimits, PendingWork, RequestLifetime
from apps.proxy.qualification.state.pricing import StateDenied
from apps.proxy.qualification.test.test_ingress import fixture, BINDING, GRANT

LIMITS = LifetimeLimits(check_seconds=.05, cleanup_seconds=.02)


class LifetimeTests(unittest.IsolatedAsyncioTestCase):
    def make(self, observer=None, deadline=None):
        store, ingress, scope = fixture()
        async def current():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), BINDING, GRANT)
        pending = PendingWork()
        life = RequestLifetime(ingress, observer or current, deadline or time.monotonic()+1, LIMITS, pending)
        return store, scope, life, pending

    async def test_refresh_preserves_full_identity_and_uses_new_observation(self):
        store, scope, life, _ = self.make()
        previous = life.peer
        await life.start(scope)
        self.assertGreaterEqual(life.peer.observed_at, previous.observed_at)
        self.assertIsNot(life.peer, previous)
        self.assertEqual(life.peer.binding, BINDING)
        self.assertGreater(store.calls, 0)
        await life.close()

    async def test_wrong_peer_grant_every_binding_field_and_stale_observation(self):
        rows = [dict(ipv4="10.77.0.10"), dict(grant_id=BINDING.run_id),
                dict(observed_at=time.monotonic()-31)]
        for field, value in (("run_id", GRANT), ("attempt", 2), ("fence", 2),
                             ("worker_arn", BINDING.worker_arn[:-1]+"b"), ("policy_revision", "b"*64)):
            rows.append(dict(binding=replace(BINDING, **{field: value})))
        for changes in rows:
            with self.subTest(changes=changes):
                async def wrong():
                    return PeerLease(**dict(dict(ipv4="10.77.0.9", observed_at=time.monotonic(), binding=BINDING, grant_id=GRANT), **changes))
                _, scope, life, _ = self.make(wrong)
                with self.assertRaises(StateDenied):
                    await life.start(scope)
                self.assertTrue(life.denied.is_set())
                await life.close()

    async def test_regressing_observation_refused(self):
        _, scope, life, _ = self.make()
        old = life.peer
        async def regression():
            return replace(old, observed_at=old.observed_at-.001)
        life.observer = regression
        with self.assertRaises(StateDenied):
            await life.start(scope)
        await life.close()

    async def test_canonical_fence_revocation_refuses_at_start(self):
        store, scope, life, _ = self.make()
        store.run["fence"] = 2
        with self.assertRaises(StateDenied):
            await life.start(scope)
        self.assertEqual(life.reason, "FRESH_ADMISSION_DENIED")
        await life.close()

    async def test_admitted_once_then_bounded_only_by_deadline(self):
        observations = []
        async def observe():
            observations.append(1)
            return PeerLease("10.77.0.9", time.monotonic(), BINDING, GRANT)
        store, scope, life, _ = self.make(observe, deadline=time.monotonic()+.2)
        await life.start(scope)
        calls = store.calls
        self.assertEqual(life.tasks, set())  # No watcher runs beside the request.
        store.run["fence"] = 2  # A later change is not re-read during the request.
        await asyncio.sleep(.1)
        life.check()
        self.assertEqual((store.calls, len(observations)), (calls, 1))
        await asyncio.sleep(.15)
        with self.assertRaises(StateDenied):
            life.check()
        self.assertEqual(life.reason, "ORIGINAL_DEADLINE_EXPIRED")
        await life.close()

    async def test_deterministic_original_deadline_and_observation_timeout_boundary(self):
        # Scope the clock to this module; asyncio and PeerLease keep their clocks.
        for at_deadline, expected in ((False, "FRESH_OBSERVATION_TIMEOUT"),
                                      (True, "ORIGINAL_DEADLINE_EXPIRED")):
            with self.subTest(at_deadline=at_deadline):
                now = [time.monotonic()]
                deadline = now[0] + .04
                _, _, life, _ = self.make(deadline=deadline)
                clock = SimpleNamespace(monotonic=lambda: now[0])
                async def blocked():
                    now[0] = deadline if at_deadline else deadline-.001
                    await asyncio.Event().wait()
                with patch.object(lifetime_module, "time", clock):
                    with self.assertRaises(StateDenied):
                        await life._bounded(blocked)
                    self.assertEqual(life.reason, expected)
                    self.assertEqual(life.deadline, deadline)
                    await life.close()

    async def test_pending_state_thread_is_retained_no_new_poll_or_forced_stop(self):
        store, scope, life, pending = self.make()
        entered, release = threading.Event(), threading.Event()
        old = store.transact
        def blocked(operation):
            entered.set()
            release.wait(1)
            return old(operation)
        store.transact = blocked
        try:
            with self.assertRaises(StateDenied):
                await life.start(scope)
            self.assertTrue(entered.is_set())
            await life.close()
            self.assertFalse(pending.ready)
            self.assertEqual(len(pending.tasks), 1)
            self.assertEqual(store.calls, 0)
        finally:
            release.set()
            if pending.tasks:
                await asyncio.wait(set(pending.tasks), timeout=1)
        self.assertFalse(pending.ready)  # Explicit recovery needed even after finish.

    async def test_cancellation_resistant_observer_retained_then_test_releases(self):
        release = asyncio.Event()
        async def resistant():
            try:
                await release.wait()
            except asyncio.CancelledError:
                await release.wait()
            return PeerLease("10.77.0.9", time.monotonic(), BINDING, GRANT)
        _, scope, life, pending = self.make(resistant)
        try:
            with self.assertRaises(StateDenied):
                await life.start(scope)
            await life.close()
            self.assertFalse(pending.ready)
            self.assertEqual(len(pending.tasks), 1)
        finally:
            release.set()
            if pending.tasks:
                await asyncio.wait(set(pending.tasks), timeout=1)

    async def test_owner_cancels_cleanup_still_quarantines_pending_work(self):
        _, _, life, pending = self.make()
        release = asyncio.Event()
        async def resistant():
            try:
                await release.wait()
            except asyncio.CancelledError:
                await release.wait()
        life.spawn(resistant())
        await asyncio.sleep(0)
        closing = asyncio.create_task(life.close())
        await asyncio.sleep(0)
        closing.cancel()
        try:
            with self.assertRaises(asyncio.CancelledError):
                await closing
            self.assertFalse(pending.ready)
            self.assertEqual(len(pending.tasks), 1)
        finally:
            release.set()
            if pending.tasks:
                await asyncio.wait(set(pending.tasks), timeout=1)

    async def test_mandatory_task_cancelled_before_start_denies(self):
        _, scope, life, _ = self.make()
        await life.start(scope)
        task = life.spawn(asyncio.Event().wait(), mandatory="REQUEST_RECEIVE_STOPPED")
        task.cancel()  # No scheduling turn: coroutine's except block cannot run.
        await asyncio.wait_for(life.denied.wait(), .3)
        self.assertEqual(life.reason, "REQUEST_RECEIVE_STOPPED")
        await life.close()

    async def test_intentional_close_keeps_reason_before_mandatory_cancellation(self):
        _, scope, life, _ = self.make()
        await life.start(scope)
        await life.close()
        self.assertEqual(life.reason, "REQUEST_CLOSED")
        self.assertTrue(life.denied.is_set())
        self.assertEqual(life.tasks, set())


class LimitTests(unittest.TestCase):
    def test_typed_finite_closed_limits(self):
        for name in ("check_seconds", "cleanup_seconds", "max_body_bytes", "max_events"):
            for value in (True, 0, -1, float("nan"), float("inf"), "1", 2**30):
                with self.subTest(name=name, value=value), self.assertRaises(StateDenied):
                    LifetimeLimits(**{name: value})

    def test_check_and_cleanup_reach_the_owner_exchange_budget(self):
        LifetimeLimits(check_seconds=30, cleanup_seconds=30)
        for name, value in (("check_seconds", 30.01), ("cleanup_seconds", 30.01)):
            with self.subTest(name=name), self.assertRaises(StateDenied):
                LifetimeLimits(**{name: value})


class CleanupBoundTests(unittest.IsolatedAsyncioTestCase):
    async def test_close_waits_for_a_thread_inside_its_bound_and_quarantines_only_past_it(self):
        _, ingress, _ = fixture()
        async def current():
            return PeerLease(ingress.peer.ipv4, time.monotonic(), BINDING, GRANT)
        for cleanup, quarantined in ((.5, False), (.02, True)):
            with self.subTest(cleanup_seconds=cleanup):
                pending = PendingWork()
                life = RequestLifetime(ingress, current, time.monotonic()+2, replace(LIMITS, cleanup_seconds=cleanup), pending)
                life.spawn(asyncio.to_thread(time.sleep, .1), thread=True)
                await life.close()
                self.assertEqual(pending.ready, not quarantined)
                if pending.tasks:
                    await asyncio.wait(set(pending.tasks), timeout=1)
