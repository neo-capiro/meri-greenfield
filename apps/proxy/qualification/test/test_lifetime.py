"""Finite synthetic canonical-authority lifetime controls; no services."""
import asyncio
from dataclasses import replace
import threading
import time
import unittest

from apps.proxy.qualification.runtime.ingress import PeerLease
from apps.proxy.qualification.runtime.lifetime import LifetimeLimits, PendingWork, RequestLifetime
from apps.proxy.qualification.state.pricing import StateDenied
from apps.proxy.qualification.test.test_ingress import fixture, BINDING, GRANT

LIMITS = LifetimeLimits(poll_seconds=.01, check_seconds=.05, cleanup_seconds=.02)


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

    async def test_canonical_fence_revocation_is_sticky(self):
        store, scope, life, _ = self.make()
        await life.start(scope)
        store.run["fence"] = 2
        await asyncio.wait_for(life.denied.wait(), .3)
        store.run["fence"] = 1
        with self.assertRaises(StateDenied):
            life.check()
        await life.close()

    async def test_original_deadline_not_reset_by_observer_renewal(self):
        _, scope, life, _ = self.make(deadline=time.monotonic()+.04)
        await life.start(scope)
        await asyncio.wait_for(life.denied.wait(), .3)
        self.assertEqual(life.reason, "ORIGINAL_DEADLINE_EXPIRED")
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


class LimitTests(unittest.TestCase):
    def test_typed_finite_closed_limits(self):
        for name in ("poll_seconds", "check_seconds", "cleanup_seconds", "max_body_bytes", "max_events"):
            for value in (True, 0, -1, float("nan"), float("inf"), "1", 2**30):
                with self.subTest(name=name, value=value), self.assertRaises(StateDenied):
                    LifetimeLimits(**{name: value})
