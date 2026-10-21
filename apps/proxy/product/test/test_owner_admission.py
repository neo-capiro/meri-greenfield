"""Stdlib synthetic owner replies only; no TLS, SQL, provider or network."""
from apps.proxy.product.test.budget_fixture import TEST_BUDGETS, TEST_LIFETIME_LIMITS, budget_fixture, budget_data
import asyncio
from dataclasses import replace
import copy
import contextvars
import hashlib
import json
import time
import unittest
from unittest.mock import patch
import uuid

from apps.proxy.product.owner_admission import ProductOwnerAdmissionReader, _hash
from apps.proxy.product.owner_channel import (OwnerPeerPolicy, OwnerTlsEvidence, OwnerReply,
    OwnerHostGate, ProductOwnerBridge, OPEN, OPERATION, POLL, REPLY)
from apps.proxy.product.binding import _binding
from apps.proxy.product.test.test_bearer_eni_admission import source as issued_fixture
from apps.proxy.qualification.state.admission import GrantAdmission
from apps.proxy.qualification.state.pricing import StateDenied
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
            f"{channel}-A")
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
                if channel == "operation":
                    raise AssertionError("an admission read used the held operation connection")
                self.read_during_pending = self.read_during_pending or channel == "capture"
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


class TwoReservationExchange(Exchange):
    """One actual pair of carrier locks with two independently captured sessions."""
    def __init__(self, policy, issued, requests, observation):
        super().__init__(policy, issued)
        self.source[2] = SHA
        self.requests, self.observation = requests, observation
        self.allow_first_open, self.first_open = asyncio.Event(), asyncio.Event()
        self.entered = {key: asyncio.Event() for key in requests}
        self.replied = {key: asyncio.Event() for key in requests}
        self.trace = []

    async def __call__(self, channel, path, body, timeout):
        frame = json.loads(body)
        if frame[0] == "meri.proxy.admission-read/1":
            self.trace.append(("admission",channel))
            return await super().__call__(channel,path,body,timeout)
        if path == OPEN:
            request_id = frame[1]
            self.trace.append(("open",request_id))
            if request_id == "request_A":
                self.first_open.set()
                await self.allow_first_open.wait()
            return self.reply(["meri.proxy.session/1",request_id,request_id,frame[2]],channel)
        request_id = frame[1]
        request = self.requests[request_id]
        if path == POLL:
            self.trace.append(("poll",request_id))
            await self.entered[request_id].wait()
            answer = ["meri.proxy.capture-call/1",request_id,self.source[0],request["deadlineMs"]]
        elif path == REPLY:
            self.replied[request_id].set()
            answer = ["meri.proxy.capture-ack/1",request_id,request_id,"call"]
        else:
            self.trace.append(("claim",request_id))
            self.entered[request_id].set()
            await self.replied[request_id].wait()
            answer = ["meri.proxy.reservation-receipt/1",request_id,[request_id,
                hashlib.sha256(self.observation["nativeRequest"]["body"]).hexdigest(),"UNKNOWN"]]
        return self.reply(answer,channel)


class AdmissionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.issued = issued_fixture()[0].issued
        self.policy = OwnerPeerPolicy("https://owner.synthetic.invalid:8444", "owner.synthetic.invalid",
            "owner-task", "proxy-task-"+uuid.uuid4().hex, "1"*64, "2"*64, "3"*64, "proxy-subject", max_exchange_ms=3000)
        self.exchange = Exchange(self.policy, self.issued)
        self.gate = OwnerHostGate()
        self.reader = ProductOwnerAdmissionReader(policy=self.policy, exchange=self.exchange,
            host_gate=self.gate, owner_loop=asyncio.get_running_loop(), max_exchange_ms=3000, max_carrier_wait_ms=10000, min_exchange_ms=8000, settle_ms=1000)

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
        self.assertTrue(all(c[:2] == ("admission", OPERATION) for c in self.exchange.calls))

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
            if kind == "capture": self.reader.state[4]["capture"] = "admission-A"
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

    async def test_carrier_wait_is_bounded_on_its_own_and_never_poisons(self):
        # Before candidate 6 the wait counted against the exchange deadline and its expiry poisoned the process-wide gate.
        lock = self.reader.state[3]["admission"]
        await lock.acquire()
        self.reader.max_carrier_wait_ms = 20
        try:
            with self.assertRaisesRegex(StateDenied, "^OWNER_CARRIER_BUSY$"):
                await self.resolve()
        finally:
            lock.release()
        self.assertTrue(self.gate.available)
        self.assertFalse(self.exchange.aborted)
        self.assertEqual(self.exchange.calls, [])
        await self.resolve()  # Nothing was retired: the next read proceeds.
        self.assertTrue(self.gate.available)

    async def test_exchange_clock_starts_once_the_carrier_is_held(self):
        lock = self.reader.state[3]["admission"]
        await lock.acquire()
        self.reader.max_exchange_ms, self.exchange.delay = 60, .03
        async def release():
            await asyncio.sleep(.1)  # Longer than the whole 60 ms exchange budget.
            lock.release()
        releaser = asyncio.create_task(release())
        result = await self.resolve()
        await releaser
        self.assertIs(type(result.authority), GrantAdmission)
        self.assertTrue(self.gate.available)
        self.assertFalse(self.exchange.aborted)

    async def test_a_waited_read_without_room_for_its_exchange_is_refused_before_sending(self):
        lock = self.reader.state[3]["admission"]
        await lock.acquire()
        self.reader.max_exchange_ms = 500
        async def release():
            await asyncio.sleep(.1)
            lock.release()
        releaser = asyncio.create_task(release())
        with self.assertRaisesRegex(StateDenied, "^OWNER_CARRIER_BUSY$"):
            await asyncio.to_thread(self.reader.resolve_for_issued_sync,
                issued=self.issued, capability_sha256="a"*64, deadline_ms=milliseconds()+300)
        await releaser
        self.assertEqual(self.exchange.calls, [])
        self.assertTrue(self.gate.available)
        self.assertFalse(self.exchange.aborted)

    async def test_read_id_window_never_runs_out_on_a_long_lived_proxy(self):
        # The former set refused every read after 4096, and that refusal aborted and poisoned the proxy.
        from apps.proxy.product import owner_admission
        # Thousands of reads outlast a wall-clock step under WSL; reader and fake owner share one monotonic clock instead.
        offset = time.time_ns() // 1000000 - time.monotonic_ns() // 1000000
        clock = lambda: offset + time.monotonic_ns() // 1000000
        self.reader.now_ms = clock
        with patch(__name__ + ".milliseconds", clock):
            authority = (await asyncio.to_thread(self.reader.resolve_for_issued_sync, issued=self.issued,
                capability_sha256="a"*64, deadline_ms=clock()+600000)).authority
            def many():
                for _ in range(owner_admission.READ_ID_WINDOW + 8):
                    authority.check()
            await asyncio.to_thread(many)
        self.assertTrue(self.gate.available)
        self.assertEqual(len(self.reader._read_ids), owner_admission.READ_ID_WINDOW)

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
                host_gate=OwnerHostGate(),owner_loop=asyncio.get_running_loop(), max_exchange_ms=3000, max_carrier_wait_ms=10000, min_exchange_ms=8000, settle_ms=1000)

    async def test_real_bridge_capture_refresh_uses_second_connection_and_revokes_copied_context(self):
        deadline = milliseconds()+2000
        value, observation = reservation()
        value.update(binding=dict(self.issued.execution_binding), deadlineMs=deadline)
        observation.update(proxyCredential=KEY.decode())
        observation["peer"].update(binding=dict(self.issued.execution_binding),
            taskArn=self.issued.binding.worker_arn, grantId=self.issued.grant_id)
        exchange = ReservationExchange(self.policy, self.issued, value, observation)
        reader = ProductOwnerAdmissionReader(policy=self.policy,exchange=exchange,
            host_gate=self.gate,owner_loop=asyncio.get_running_loop(), max_exchange_ms=3000, max_carrier_wait_ms=10000, min_exchange_ms=8000, settle_ms=1000)
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
            deadline_ms=deadline,grant_id=self.issued.grant_id,capability_sha256=SHA, max_carrier_wait_ms=10000)
        try:
            await life.start(ingress_fixture()[2])
            result = await asyncio.wait_for(bridge.reserve(value,observation),.75)
            self.assertEqual(result["state"],"UNKNOWN")
            self.assertTrue(exchange.read_during_pending)
            reads = [c for c in exchange.calls if c[2][0]=="meri.proxy.admission-read/1"]
            self.assertEqual([c[0] for c in reads],["admission","admission","capture"])
            before = len(exchange.calls)
            late_ready.set(); await asyncio.gather(*copied)
            self.assertEqual(len(exchange.calls),before)
            self.assertTrue(self.gate.available)
            self.assertEqual(self.exchange.calls,[])
        finally:
            late_ready.set()
            if copied: await asyncio.gather(*copied)
            await life.close()

    async def test_two_real_bridges_serialize_open_and_capture_while_each_refreshes_fresh_authority(self):
        deadline=milliseconds()+2000
        template,observation=reservation()
        template.update(binding=dict(self.issued.execution_binding),deadlineMs=deadline)
        observation.update(proxyCredential=KEY.decode())
        observation["peer"].update(binding=dict(self.issued.execution_binding),
            taskArn=self.issued.binding.worker_arn,grantId=self.issued.grant_id)
        requests={key:{**template,"requestId":key} for key in ("request_A","request_B")}
        exchange=TwoReservationExchange(self.policy,self.issued,requests,observation)
        reader=ProductOwnerAdmissionReader(policy=self.policy,exchange=exchange,
            host_gate=self.gate,owner_loop=asyncio.get_running_loop(), max_exchange_ms=3000, max_carrier_wait_ms=10000, min_exchange_ms=8000, settle_ms=1000)
        source=await asyncio.to_thread(reader.resolve_for_issued_sync,
            issued=self.issued,capability_sha256=SHA,deadline_ms=deadline)
        peer=PeerLease("10.77.0.9",time.monotonic(),source.authority.binding,source.authority.grant_id)
        async def observe():return replace(peer,observed_at=time.monotonic())
        lives={key:RequestLifetime(IngressAdmission(source.authority,peer),observe,
            time.monotonic()+2,LifetimeLimits(),PendingWork()) for key in requests}
        callback_entered,continue_first=asyncio.Event(),asyncio.Event()
        bridges={}
        for key in requests:
            async def capture(request, key=key):
                self.assertEqual(request,requests[key])
                if key=="request_A":
                    callback_entered.set();await continue_first.wait()
                await lives[key].refresh()
                return {**observation,"requestId":key}
            bridges[key]=ProductOwnerBridge(policy=self.policy,exchange=exchange,capture_call=capture,
                host_gate=self.gate,request_id=key,binding=template["binding"],deadline_ms=deadline,
                grant_id=self.issued.grant_id,capability_sha256=SHA, max_carrier_wait_ms=10000)
        tasks=[]
        try:
            for life in lives.values():await life.start(ingress_fixture()[2])
            tasks.append(asyncio.create_task(bridges["request_A"].reserve(requests["request_A"],{**observation,"requestId":"request_A"})))
            await asyncio.wait_for(exchange.first_open.wait(),.5)
            tasks.append(asyncio.create_task(bridges["request_B"].reserve(requests["request_B"],{**observation,"requestId":"request_B"})))
            await asyncio.sleep(0);exchange.allow_first_open.set()
            await asyncio.wait_for(callback_entered.wait(),.5)
            await asyncio.sleep(0)
            self.assertNotIn(("open","request_B"),exchange.trace,
                "the second bridge must not open or poll ahead of the active capture refresh")
            continue_first.set()
            results=await asyncio.wait_for(asyncio.gather(*tasks),1)
            self.assertEqual([item["state"] for item in results],["UNKNOWN","UNKNOWN"])
            self.assertEqual([item for item in exchange.trace if item[0]=="admission"],
                [("admission","admission")]*3+[("admission","capture")]*2)
            self.assertTrue(self.gate.available)
        finally:
            exchange.allow_first_open.set();continue_first.set()
            for task in tasks:
                if not task.done():task.cancel()
            if tasks:await asyncio.gather(*tasks,return_exceptions=True)
            for life in lives.values():await life.close()

    def reservation_fixture(self, deadline):
        value, observation = reservation()
        value.update(binding=dict(self.issued.execution_binding), deadlineMs=deadline)
        observation.update(proxyCredential=KEY.decode())
        observation["peer"].update(binding=dict(self.issued.execution_binding),
            taskArn=self.issued.binding.worker_arn, grantId=self.issued.grant_id)
        return value, observation

    def held_reservation(self, exchange, value, observation, deadline, capture):
        bridge = ProductOwnerBridge(policy=self.policy, exchange=exchange, capture_call=capture,
            host_gate=self.gate, request_id=value["requestId"], binding=value["binding"],
            deadline_ms=deadline, grant_id=self.issued.grant_id, capability_sha256=SHA, max_carrier_wait_ms=10000)
        return asyncio.create_task(bridge.reserve(value, observation))

    async def test_watch_refresh_never_queues_behind_a_held_reservation(self):
        deadline = milliseconds()+5000
        value, observation = self.reservation_fixture(deadline)
        exchange = ReservationExchange(self.policy, self.issued, value, observation)
        reader = ProductOwnerAdmissionReader(policy=self.policy, exchange=exchange,
            host_gate=self.gate, owner_loop=asyncio.get_running_loop(), max_exchange_ms=3000, max_carrier_wait_ms=10000, min_exchange_ms=8000, settle_ms=1000)
        source = await asyncio.to_thread(reader.resolve_for_issued_sync,
            issued=self.issued, capability_sha256=SHA, deadline_ms=deadline)
        entered, release = asyncio.Event(), asyncio.Event()
        async def capture(_request):
            entered.set(); await release.wait()
            return observation
        reserve = self.held_reservation(exchange, value, observation, deadline, capture)
        try:
            await asyncio.wait_for(entered.wait(), 1)
            self.assertTrue(exchange.operation_pending)
            # The turn's own watch refresh while its reserve operation holds the operation carrier.
            await asyncio.wait_for(asyncio.to_thread(source.authority.check), .5)
            self.assertTrue(exchange.operation_pending)
        finally:
            release.set()
        self.assertEqual((await asyncio.wait_for(reserve, 1))["state"], "UNKNOWN")
        self.assertEqual([c[0] for c in exchange.calls if c[2][0] == "meri.proxy.admission-read/1"],
                         ["admission", "admission"])
        self.assertTrue(self.gate.available)

    async def test_title_style_request_and_turn_at_tail_latency_never_poison(self):
        # Scaled 1:10 from the live tail (adj-e B6/B13): exchange budget 15 s -> 1.5 s, carrier wait 10 s -> 1 s, one owner
        # read 2.5 s -> .25 s, the turn's reserve operation 14 s -> 1.4 s. Before candidate 6 each read below queued behind
        # the held reserve on the operation carrier with its 1.5 s clock already running; the first expiry poisoned the proxy.
        deadline = milliseconds()+10000
        value, observation = self.reservation_fixture(deadline)
        exchange = ReservationExchange(self.policy, self.issued, value, observation)
        reader = ProductOwnerAdmissionReader(policy=self.policy, exchange=exchange, host_gate=self.gate,
            owner_loop=asyncio.get_running_loop(), max_exchange_ms=1500, max_carrier_wait_ms=1000, min_exchange_ms=8000, settle_ms=1000)
        source = await asyncio.to_thread(reader.resolve_for_issued_sync,
            issued=self.issued, capability_sha256=SHA, deadline_ms=deadline)
        expected = source.authority._product_owner[1]
        exchange.delay = .25
        entered = asyncio.Event()
        async def capture(_request):
            entered.set(); await asyncio.sleep(1.4)
            return observation
        reserve = self.held_reservation(exchange, value, observation, deadline, capture)
        await asyncio.wait_for(entered.wait(), 2)
        # The title-style request's bootstrap read, opening refresh and native-auth read, and the turn's watch refresh.
        reads = await asyncio.wait_for(asyncio.gather(
            asyncio.to_thread(reader.resolve_for_issued_sync, issued=self.issued, capability_sha256=SHA, deadline_ms=deadline),
            asyncio.to_thread(source.authority.check),
            asyncio.to_thread(reader.read_current_conversation_sync, expected, deadline),
            asyncio.to_thread(source.authority.check)), 5)
        self.assertEqual(reads[2]["selectedClientId"], "11111111-1111-4111-8111-111111111111")
        self.assertTrue(exchange.operation_pending, "every read finished while the reserve still held its carrier")
        self.assertEqual((await asyncio.wait_for(reserve, 5))["state"], "UNKNOWN")
        self.assertTrue(self.gate.available)
        self.assertFalse(exchange.aborted)

    async def test_expired_queued_claim_never_polls_or_aborts_another_bridge(self):
        from apps.proxy.product.owner_channel import owner_exchange_state
        lock=owner_exchange_state(self.exchange,self.policy,self.gate)[6]
        await lock.acquire()
        value,observation=reservation();deadline=milliseconds()+30
        value.update(binding=dict(self.issued.execution_binding),deadlineMs=deadline)
        async def capture(_request):raise AssertionError("expired claim captured")
        bridge=ProductOwnerBridge(policy=self.policy,exchange=self.exchange,capture_call=capture,
            host_gate=self.gate,request_id=value["requestId"],binding=value["binding"],deadline_ms=deadline,
            grant_id=self.issued.grant_id,capability_sha256=SHA, max_carrier_wait_ms=10000)
        try:
            with self.assertRaises(Exception):await bridge.reserve(value,observation)
            self.assertEqual(self.exchange.calls,[])
            self.assertFalse(self.exchange.aborted);self.assertTrue(self.gate.available)
        finally:lock.release()

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
