"""Synthetic ingress controls; no database, provider, server or socket requests."""
import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
import time
import unittest

from apps.proxy.qualification.runtime.ingress import IngressAdmission, PeerLease
from apps.proxy.qualification.state.admission import GrantAdmission
from apps.proxy.qualification.state.grants import RunBinding
from apps.proxy.qualification.state.pricing import StateDenied

KEY = b"synthetic-opaque-qualification-key-0001"
BINDING = RunBinding("00000000-0000-4000-8000-000000000001", 1,
    "arn:aws:ecs:us-east-1:967807252336:task/independent/" + "a" * 32, 1, "a" * 64)
GRANT = "00000000-0000-4000-8000-000000000002"
SHA = hashlib.sha256(KEY).hexdigest()


class Store:
    def __init__(self):
        self.now = datetime.now(timezone.utc)
        self.run = dict(zip(("run_id", "attempt", "worker_arn", "fence", "policy_revision"), BINDING.values()))
        self.grant = dict(self.run, state="ACTIVE", capability_sha256=SHA,
                          expires_at=self.now + timedelta(minutes=1))
        self.calls = 0
        self.queries = []
        self.quarantined = False
        self.failure = False

    def budget(self, cursor):
        return {"now": self.now, "quarantined": self.quarantined}

    def transact(self, operation):
        self.calls += 1
        if self.failure:
            raise RuntimeError("synthetic secret must not escape")
        return operation(self)

    def execute(self, query, params):
        self.queries.append((query, params))
        self.row = self.run if ".runs " in query else self.grant

    def fetchone(self):
        return self.row


def fixture():
    store = Store()
    authority = GrantAdmission(store, GRANT, BINDING, SHA)
    ingress = IngressAdmission(authority, PeerLease("10.77.0.9", time.monotonic(), BINDING, GRANT))
    scope = {"type": "http", "scheme": "https", "method": "POST", "path": "/v1/messages",
             "raw_path": b"/v1/messages", "query_string": b"", "client": ("10.77.0.9", 4321),
             "headers": [(b"authorization", b"Bearer " + KEY), (b"content-type", b"application/json")]}
    return store, ingress, scope


class StateTests(unittest.TestCase):
    def test_authoritative_query_is_exact_and_repeat_is_fresh(self):
        store, ingress, _ = fixture()
        ingress.authority.check(); ingress.authority.check()
        self.assertEqual(store.calls, 2)
        self.assertEqual(store.queries[:2], [
            ("SELECT * FROM meri_qualification.runs WHERE run_id=%s", (BINDING.run_id,)),
            ("SELECT * FROM meri_qualification.grants WHERE grant_id=%s", (GRANT,))])

    def test_denied_grant_states(self):
        for state in ("PENDING", "REVOKED", "UNKNOWN", None):
            with self.subTest(state=state):
                store, ingress, _ = fixture(); store.grant["state"] = state
                with self.assertRaises(StateDenied): ingress.authority.check()

    def test_missing_run_or_grant(self):
        for field in ("run", "grant"):
            with self.subTest(field=field):
                store, ingress, _ = fixture(); setattr(store, field, None)
                with self.assertRaises(StateDenied): ingress.authority.check()

    def test_every_run_and_grant_binding_field(self):
        changes = {"run_id": GRANT, "attempt": 2, "worker_arn": BINDING.worker_arn[:-1] + "b",
                   "fence": 2, "policy_revision": "b" * 64}
        for row in ("run", "grant"):
            for field, value in changes.items():
                with self.subTest(row=row, field=field):
                    store, ingress, _ = fixture(); getattr(store, row)[field] = value
                    with self.assertRaises(StateDenied): ingress.authority.check()

    def test_expiry_uses_authoritative_time_including_boundary(self):
        for delta in (0, -1):
            store, ingress, _ = fixture(); store.grant["expires_at"] = store.now + timedelta(seconds=delta)
            with self.assertRaises(StateDenied): ingress.authority.check()

    def test_capability_and_quarantine(self):
        store, ingress, _ = fixture(); store.grant["capability_sha256"] = "b" * 64
        with self.assertRaises(StateDenied): ingress.authority.check()
        store, ingress, _ = fixture(); store.quarantined = True
        with self.assertRaises(StateDenied): ingress.authority.check()

    def test_typed_identity_and_fixed_failures(self):
        for args in ((Store(), GRANT, {}, SHA), (Store(), "bad", BINDING, SHA),
                     (Store(), GRANT, BINDING, "bad")):
            with self.assertRaises(StateDenied): GrantAdmission(*args)


class IngressTests(unittest.IsolatedAsyncioTestCase):
    async def test_honest_direct_tls_request(self):
        store, ingress, scope = fixture(); await ingress.authorize(scope)
        self.assertEqual(store.calls, 1)

    async def test_admin_source_route_query_tls_denied_before_state(self):
        for change in ({"path": "/key/generate"}, {"path": "/sources"}, {"method": "GET"},
                       {"scheme": "http"}, {"query_string": b"beta=true"},
                       {"raw_path": b"/v1/%6dessages"}, {"type": "websocket"}):
            with self.subTest(change=change):
                store, ingress, scope = fixture(); scope.update(change)
                with self.assertRaises(StateDenied): await ingress.authorize(scope)
                self.assertEqual(store.calls, 0)

    async def test_peer_port_and_identity_spoof_denied(self):
        for client in (("10.77.0.8", 4321), ("10.77.0.9", True), ("10.77.0.9", 0), None):
            store, ingress, scope = fixture(); scope["client"] = client
            with self.assertRaises(StateDenied): await ingress.authorize(scope)
            self.assertEqual(store.calls, 0)

    async def test_forwarded_and_run_override_headers_denied(self):
        for header in (b"forwarded", b"x-forwarded-for", b"x-meri-fence", b"x-litellm-api-base", b"x-api-key"):
            store, ingress, scope = fixture(); scope["headers"].append((header, b"synthetic"))
            with self.assertRaises(StateDenied): await ingress.authorize(scope)
            self.assertEqual(store.calls, 0)

    async def test_duplicate_malformed_oversized_headers_and_wrong_keys(self):
        replacements = [[(b"authorization", b"Bearer " + KEY)] * 2,
                        [(b"Authorization", b"Bearer " + KEY)], [(b"bad_name", b"value")],
                        [(b"authorization", b"Bearer " + KEY + b"\n")],
                        [(b"authorization", b"Bearer " + b"b" * 40)],
                        [(b"authorization", b"Bearer tiny")], [(b"x-data", b"a" * 16385)],
                        [(b"authorization", b"Basic " + KEY)]]
        for headers in replacements:
            store, ingress, scope = fixture(); scope["headers"] = headers
            with self.assertRaises(StateDenied): await ingress.authorize(scope)
            self.assertEqual(store.calls, 0)

    async def test_peer_lease_fails_past_and_future(self):
        for observed in (time.monotonic() - 30, time.monotonic() + 60):
            store, ingress, scope = fixture()
            ingress.peer = PeerLease("10.77.0.9", observed, BINDING, GRANT)
            with self.assertRaises(StateDenied): await ingress.authorize(scope)
            self.assertEqual(store.calls, 0)
        for ip in ("127.0.0.1", "8.8.8.8", "::1", "010.77.0.9"):
            with self.assertRaises(StateDenied): PeerLease(ip, time.monotonic(), BINDING, GRANT)

    async def test_trusted_peer_observation_must_match_full_grant_binding(self):
        _, ingress, _ = fixture()
        changed = RunBinding(BINDING.run_id, 2, BINDING.worker_arn, 2, BINDING.policy_revision)
        for binding, grant in ((changed, GRANT), (BINDING, BINDING.run_id)):
            with self.assertRaisesRegex(StateDenied, "PEER_BINDING_MISMATCH"):
                IngressAdmission(ingress.authority, PeerLease("10.77.0.9", time.monotonic(), binding, grant))

    async def test_state_failure_is_content_free(self):
        store, ingress, scope = fixture(); store.failure = True
        with self.assertRaisesRegex(StateDenied, "^FRESH_STATE_DENIED$"):
            await ingress.authorize(scope)

    async def test_stream_checks_before_each_item_and_closes(self):
        store, ingress, scope = fixture(); closed = []
        async def source():
            try:
                yield "first"
                store.grant["state"] = "REVOKED"
                yield "must-not-publish"
            finally: closed.append(True)
        result = []
        with self.assertRaises(StateDenied):
            async for item in ingress.stream(scope, source()): result.append(item)
        self.assertEqual(result, ["first"]); self.assertEqual(closed, [True])

    async def test_quiet_stream_revocation_polls_without_chunks(self):
        store, ingress, scope = fixture(); closed = []; started = asyncio.Event()
        async def source():
            try:
                started.set()
                await asyncio.sleep(60)
                yield "must-not-publish"
            finally: closed.append(True)
        async def revoke():
            await started.wait(); store.grant["state"] = "REVOKED"
        task = asyncio.create_task(revoke()); before = time.monotonic()
        with self.assertRaises(StateDenied):
            async for _ in ingress.stream(scope, source()): self.fail("quiet source published")
        await task
        elapsed = time.monotonic() - before
        self.assertGreaterEqual(elapsed, 5)
        self.assertLess(elapsed, 8); self.assertEqual(closed, [True])

    async def test_downstream_resume_rechecks_revocation_before_next_pull(self):
        store, ingress, scope = fixture(); pulls = []; closed = []
        async def source():
            try:
                pulls.append("first"); yield "one"
                pulls.append("second"); yield "must-not-pull"
            finally: closed.append(True)
        stream = ingress.stream(scope, source())
        self.assertEqual(await anext(stream), "one")
        store.grant["state"] = "REVOKED"
        with self.assertRaises(StateDenied): await anext(stream)
        self.assertEqual(pulls, ["first"]); self.assertEqual(closed, [True])

    async def test_downstream_resume_rechecks_peer_expiry_before_next_pull(self):
        _, ingress, scope = fixture(); pulls = []; closed = []
        async def source():
            try:
                pulls.append("first"); yield "one"
                pulls.append("second"); yield "must-not-pull"
            finally: closed.append(True)
        stream = ingress.stream(scope, source())
        self.assertEqual(await anext(stream), "one")
        ingress.peer = PeerLease("10.77.0.9", time.monotonic() - 30, BINDING, GRANT)
        with self.assertRaisesRegex(StateDenied, "PEER_OBSERVATION_EXPIRED"): await anext(stream)
        self.assertEqual(pulls, ["first"]); self.assertEqual(closed, [True])

    async def test_normal_eof_and_cancel_close_owned_iterator(self):
        _, ingress, scope = fixture()
        async def finite(): yield "one"
        self.assertEqual([x async for x in ingress.stream(scope, finite())], ["one"])
        closed = []; started = asyncio.Event()
        async def quiet():
            try:
                started.set()
                await asyncio.sleep(60); yield "never"
            finally: closed.append(True)
        async def consume():
            async for _ in ingress.stream(scope, quiet()): pass
        task = asyncio.create_task(consume()); await asyncio.wait_for(started.wait(), 1); task.cancel()
        with self.assertRaises(asyncio.CancelledError): await task
        self.assertEqual(closed, [True])

    async def test_stream_rejects_key_before_source_or_database(self):
        store, ingress, scope = fixture(); scope["headers"] = []
        entered = []
        async def source():
            entered.append(True); yield "never"
        with self.assertRaises(StateDenied):
            async for _ in ingress.stream(scope, source()): self.fail("unauthorized publication")
        self.assertEqual(entered, []); self.assertEqual(store.calls, 0)

    async def test_production_poll_and_state_bounds_are_fixed(self):
        from apps.proxy.qualification.runtime import ingress
        self.assertEqual((ingress.POLL_SECONDS, ingress.STATE_TIMEOUT_SECONDS, ingress.PEER_LEASE_SECONDS),
                         (5.0, 5.0, 30.0))


if __name__ == "__main__": unittest.main(verbosity=2)
