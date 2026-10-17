"""Stdlib synthetic owner replies only; no TLS, SQL, provider or network."""
import asyncio
from dataclasses import replace
import copy
import contextvars
import hashlib
import json
import time
import unittest
import uuid

from apps.proxy.product.owner_admission import ProductOwnerAdmissionReader, _hash
from apps.proxy.product.owner_channel import (OwnerPeerPolicy, OwnerTlsEvidence, OwnerReply,
    OwnerHostGate, ProductOwnerBridge, OPEN, OPERATION, POLL, REPLY)
from apps.proxy.product.binding import _binding
from apps.proxy.product.test.test_bearer_eni_admission import source as issued_fixture
from apps.proxy.qualification.state.admission import GrantAdmission
from apps.proxy.qualification.runtime.ingress import IngressAdmission, PeerLease
from apps.proxy.qualification.runtime.lifetime import RequestLifetime, LifetimeLimits, PendingWork
from apps.proxy.qualification.test.test_ingress import fixture as ingress_fixture, SHA, KEY
from apps.proxy.product.test_boundary_codec import reservation


def milliseconds():
    return time.time_ns() // 1000000


class Exchange:
    def __init__(self, policy, issued):
        self.policy, self.issued = policy, issued
        self.calls, self.aborted, self.saved, self.mutate = [], False, None, None
        self.delay = 0
        self.late_reply = False
        self.evidence_change = {}
        b = issued.execution_binding
        self.source = [[b[k] for k in ("tenantId", "actorId", "conversationId", "runId", "attemptId", "workerId", "writerFence")],
            issued.grant_id, "a"*64,
            [issued.binding.run_id, issued.binding.attempt, issued.binding.worker_arn, issued.binding.fence, issued.binding.policy_revision],
            [issued.started_by, issued.started_by, dict(issued.tags)["meri:plan-sha256"], issued.expires_at_ms, issued.image_digest],
            [issued.binding.worker_arn, issued.created_at_ms, issued.cluster_arn, issued.task_definition_arn, issued.container_name],
            "e"*64, "11111111-1111-4111-8111-111111111111"]

    def abort(self):
        self.aborted = True

    async def __call__(self, channel, path, body, timeout):
        self.calls.append((channel, path, json.loads(body), timeout))
        if self.delay:
            try:
                await asyncio.sleep(self.delay)
            except asyncio.CancelledError:
                if not self.late_reply:
                    raise
                await asyncio.sleep(.01)
        request = json.loads(body)
        at = milliseconds()
        current = ["b"*64, self.source[0], [["client", self.source[0][0], self.source[7], self.source[3][4]]],
                   self.source[7], "c"*64, at, request[4]]
        frame = ["meri.proxy.admission/1", request[1], request[2], _hash(self.source),
                 copy.deepcopy(self.source), current, at, min(request[4], self.issued.expires_at_ms)]
        if self.mutate:
            frame = self.mutate(frame)
        if frame is True or frame is None:
            return frame
        return self.reply(frame, channel)

    def reply(self, frame, channel):
        evidence = OwnerTlsEvidence(self.policy.origin, self.policy.server_name,
            self.policy.owner_task_arn, self.policy.proxy_task_arn, self.policy.server_cert_sha256,
            self.policy.server_issuer_sha256, self.policy.client_cert_sha256,
            self.policy.client_subject, "TLSv1.3", "http/1.1",
            "operation-A" if channel == "operation" else "capture-A")
        evidence = replace(evidence, **self.evidence_change)
        reply = OwnerReply(json.dumps(frame, ensure_ascii=False).encode(), evidence)
        if self.saved is None:
            self.saved = reply
        return reply


class ReservationExchange(Exchange):
    """Operation response really waits for the independent capture reply."""
    def __init__(self, policy, issued, request, observation):
        super().__init__(policy, issued)
        self.source[2] = SHA
        self.request, self.observation = request, observation
        self.entered, self.replied = asyncio.Event(), asyncio.Event()
        self.operation_pending = False
        self.read_during_pending = False

    def abort(self):
        super().abort()
        self.entered.set(); self.replied.set()

    async def __call__(self, channel, path, body, timeout):
        frame = json.loads(body)
        if frame[0] == "meri.proxy.admission-read/1":
            if self.operation_pending:
                if channel != "capture":
                    raise AssertionError("fresh capture admission used held operation connection")
                self.read_during_pending = True
            return await super().__call__(channel, path, body, timeout)
        self.calls.append((channel, path, frame, timeout))
        if path == OPEN:
            answer = ["meri.proxy.session/1", "session_A", frame[1], frame[2]]
        elif path == POLL:
            await self.entered.wait()
            answer = ["meri.proxy.capture-call/1", self.request["requestId"],
                self.source[0], self.request["deadlineMs"]]
        elif path == REPLY:
            self.replied.set()
            answer = ["meri.proxy.capture-ack/1", "session_A", self.request["requestId"], "call"]
        else:
            self.operation_pending = True
            self.entered.set()
            try:
                await self.replied.wait()
            finally:
                self.operation_pending = False
            answer = ["meri.proxy.reservation-receipt/1", "session_A",
                [self.request["requestId"], hashlib.sha256(self.observation["nativeRequest"]["body"]).hexdigest(), "UNKNOWN"]]
        return self.reply(answer, channel)


class AdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.issued = issued_fixture()[0].issued
        self.policy = OwnerPeerPolicy("https://owner.synthetic.invalid:8444", "owner.synthetic.invalid",
            "owner-task", "proxy-task-"+uuid.uuid4().hex, "1"*64, "2"*64, "3"*64, "proxy-subject")
        self.exchange = Exchange(self.policy, self.issued)
        self.gate = OwnerHostGate()
        self.reader = ProductOwnerAdmissionReader(policy=self.policy, exchange=self.exchange,
            host_gate=self.gate, owner_loop=asyncio.get_running_loop())

    async def resolve(self):
        return await asyncio.to_thread(self.reader.resolve_for_issued_sync,
            issued=self.issued, capability_sha256="a"*64, deadline_ms=milliseconds()+2000)

    async def test_real_exact_admission_type_rechecks_owner_without_python_store(self):
        result = await self.resolve()
        self.assertIs(type(result.authority), GrantAdmission)
        self.assertIsNone(result.authority.store)
        self.assertEqual(result.authority.namespace, "product")
        await asyncio.to_thread(result.authority.check)
        self.assertEqual(len(self.exchange.calls), 2)
        self.assertNotEqual(self.exchange.calls[0][2][1], self.exchange.calls[1][2][1])
        self.assertIsNone(self.exchange.calls[0][2][3])
        self.assertEqual(self.exchange.calls[1][2][3], _hash(self.exchange.source))
        self.assertTrue(all(c[:2] == ("operation", OPERATION) for c in self.exchange.calls))

    async def test_owner_loop_sync_call_refuses_before_scheduling(self):
        with self.assertRaises(Exception):
            self.reader.resolve_for_issued_sync(issued=self.issued, capability_sha256="a"*64,
                                               deadline_ms=milliseconds()+1000)
        self.assertEqual(self.exchange.calls, [])

    async def test_wrong_tls_peer_or_capture_connection_cannot_authenticate_an_admission(self):
        for kind in ("tls", "owner", "capture"):
            await self.asyncSetUp()
            if kind == "tls": self.exchange.evidence_change = {"tls_version": "TLSv1.2"}
            if kind == "owner": self.exchange.evidence_change = {"owner_task_arn": "foreign-owner"}
            if kind == "capture": self.reader.state[4]["capture"] = "operation-A"
            with self.subTest(kind=kind), self.assertRaises(Exception):
                await self.resolve()
            self.assertFalse(self.gate.available)

    async def test_existing_request_lifetime_uses_fresh_product_reader_on_start_and_refresh(self):
        self.exchange.source[2] = SHA
        source = await asyncio.to_thread(self.reader.resolve_for_issued_sync,
            issued=self.issued, capability_sha256=SHA, deadline_ms=milliseconds()+2000)
        peer = PeerLease("10.77.0.9", time.monotonic(), source.authority.binding, source.authority.grant_id)
        async def observe():
            return replace(peer, observed_at=time.monotonic())
        life = RequestLifetime(IngressAdmission(source.authority, peer), observe,
            time.monotonic()+2, LifetimeLimits(), PendingWork())
        scope = ingress_fixture()[2]
        scope["client"] = (peer.ipv4, 1234)
        try:
            await life.start(scope)
            await life.refresh()
            self.assertEqual(len(self.exchange.calls), 3)
            self.assertIsNone(source.authority.store)
        finally:
            await life.close()

    async def test_fresh_check_rejects_boolean_none_cached_foreign_and_late_receipts(self):
        for kind in ("boolean", "none", "cached", "foreign", "late", "extension"):
            await self.asyncSetUp()
            authority = (await self.resolve()).authority
            if kind == "cached":
                saved = self.exchange.saved
                async def cached(*_args):
                    return saved
                self.exchange.__class__ = type("CachedExchange", (Exchange,), {"__call__": staticmethod(cached)})
            else:
                def mutate(frame):
                    if kind == "boolean": return True
                    if kind == "none": return None
                    if kind == "foreign": frame[4][6] = "f"*64; frame[3] = _hash(frame[4])
                    if kind == "late": frame[6] = 1
                    if kind == "extension": frame[7] += 1
                    return frame
                self.exchange.mutate = mutate
            with self.subTest(kind=kind), self.assertRaises(Exception):
                await asyncio.to_thread(authority.check)
            self.assertFalse(self.gate.available)

    async def test_foreign_issued_source_and_mutable_input_cannot_change_bound_identity(self):
        authority = (await self.resolve()).authority
        self.issued.execution_binding["actorId"] = "foreign-after-resolution"
        await asyncio.to_thread(authority.check)
        self.exchange.source[0][1] = "foreign-owner"
        with self.assertRaises(Exception):
            await asyncio.to_thread(authority.check)

    async def test_deadline_includes_lock_wait_and_timeout_is_sticky(self):
        await self.reader.state[3]["operation"].acquire()
        self.reader.max_exchange_ms = 20
        try:
            with self.assertRaises(Exception):
                await self.resolve()
        finally:
            self.reader.state[3]["operation"].release()
        await asyncio.sleep(.02)
        self.assertFalse(self.gate.available)
        self.assertTrue(self.exchange.aborted)
        self.assertEqual(self.exchange.calls, [])
        with self.assertRaises(Exception):
            await self.resolve()

    async def test_two_thread_checks_serialize_and_use_distinct_read_ids(self):
        authority = (await self.resolve()).authority
        self.exchange.delay = .01
        await asyncio.gather(asyncio.to_thread(authority.check), asyncio.to_thread(authority.check))
        self.assertEqual(len({c[2][1] for c in self.exchange.calls}), 3)

    async def test_late_reply_after_timeout_cannot_restore_authority(self):
        self.reader.max_exchange_ms = 15
        self.exchange.delay, self.exchange.late_reply = .1, True
        with self.assertRaises(Exception):
            await self.resolve()
        await asyncio.sleep(.04)
        self.assertFalse(self.gate.available)
        self.assertEqual(self.reader._receipts, {})
        self.assertEqual(self.reader._pending_tasks, set())
        self.assertTrue(self.exchange.aborted)
        with self.assertRaises(Exception):
            ProductOwnerAdmissionReader(policy=self.policy, exchange=Exchange(self.policy,self.issued),
                host_gate=OwnerHostGate(),owner_loop=asyncio.get_running_loop())

    async def test_real_bridge_capture_refresh_uses_second_connection_and_revokes_copied_context(self):
        deadline = milliseconds()+2000
        value, observation = reservation()
        value.update(binding=dict(self.issued.execution_binding), deadlineMs=deadline)
        observation.update(proxyCredential=KEY.decode())
        observation["peer"].update(binding=dict(self.issued.execution_binding),
            taskArn=self.issued.binding.worker_arn, grantId=self.issued.grant_id)
        exchange = ReservationExchange(self.policy, self.issued, value, observation)
        reader = ProductOwnerAdmissionReader(policy=self.policy,exchange=exchange,
            host_gate=self.gate,owner_loop=asyncio.get_running_loop())
        source = await asyncio.to_thread(reader.resolve_for_issued_sync,
            issued=self.issued,capability_sha256=SHA,deadline_ms=deadline)
        peer = PeerLease("10.77.0.9",time.monotonic(),source.authority.binding,source.authority.grant_id)
        async def observe(): return replace(peer,observed_at=time.monotonic())
        life = RequestLifetime(IngressAdmission(source.authority,peer),observe,
            time.monotonic()+2,LifetimeLimits(),PendingWork())
        late_ready, copied = asyncio.Event(), []
        expected = source.authority._product_owner[1]
        async def capture(request):
            self.assertEqual(request,value)
            # No initial lookup or foreign full source may borrow capture carrier.
            with self.assertRaises(Exception):
                await asyncio.to_thread(reader.resolve_for_issued_sync,
                    issued=self.issued,capability_sha256=SHA,deadline_ms=deadline)
            foreign = json.loads(expected); foreign[6] = "f"*64
            with self.assertRaises(Exception):
                await asyncio.to_thread(reader.check_current_sync,
                    json.dumps(foreign,ensure_ascii=False,separators=(",", ":")).encode(),deadline)
            with self.assertRaises(Exception):
                await asyncio.to_thread(self.reader.check_current_sync,expected,deadline)
            await life.refresh()  # Actual GrantAdmission.check through actual to_thread.
            context = contextvars.copy_context()
            async def late():
                await late_ready.wait()
                with self.assertRaises(Exception):
                    await asyncio.to_thread(source.authority.check)
            copied.append(context.run(asyncio.create_task,late()))
            return observation
        bridge = ProductOwnerBridge(policy=self.policy,exchange=exchange,capture_call=capture,
            host_gate=self.gate,request_id=value["requestId"],binding=value["binding"],
            deadline_ms=deadline,grant_id=self.issued.grant_id,capability_sha256=SHA)
        try:
            await life.start(ingress_fixture()[2])
            result = await asyncio.wait_for(bridge.reserve(value,observation),.75)
            self.assertEqual(result["state"],"UNKNOWN")
            self.assertTrue(exchange.read_during_pending)
            reads = [c for c in exchange.calls if c[2][0]=="meri.proxy.admission-read/1"]
            self.assertEqual([c[0] for c in reads],["operation","operation","capture"])
            before = len(exchange.calls)
            late_ready.set(); await asyncio.gather(*copied)
            self.assertEqual(len(exchange.calls),before)
            self.assertTrue(self.gate.available)
            self.assertEqual(self.exchange.calls,[])
        finally:
            late_ready.set()
            if copied: await asyncio.gather(*copied)
            await life.close()

    def test_factory_rejects_boolean_callback_and_binding_validator_preserves_unicode_rules(self):
        with self.assertRaises(Exception):
            GrantAdmission.from_product_owner(reader=lambda: True, expected_source=[], expires_at_ms=1)
        b = dict(self.issued.execution_binding); b["tenantId"] = "ténant😀"
        self.assertEqual(_binding(b), b)
        self.assertEqual(_hash(["ténant😀", 1]), hashlib.sha256('["ténant😀",1]'.encode()).hexdigest())
        self.assertEqual(_hash(["ténant😀", 1]), "75dc0f8791835c10492de8c87c9306f1a0a247c98852230fce029bd6edff587c")
        for bad in ({**b, "writerFence": True}, {**b, "actorId": "\ud800"}):
            with self.assertRaises(Exception): _binding(bad)


if __name__ == "__main__":
    unittest.main()
