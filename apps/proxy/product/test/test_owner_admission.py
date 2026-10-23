"""Stdlib synthetic owner replies only; no TLS, SQL, provider or network."""
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
    OwnerHostGate, ProductOwnerBridge, OPERATION, report_owner_write_completed)
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
        self.generation = 1
        self.resets = []
        self._listeners = {"close": [], "install": [], "reset": []}
        self._connections = {}
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

    def _subscribe(self, kind, callback):
        self._listeners[kind].append(callback)
        return lambda: self._listeners[kind].remove(callback)

    def subscribe_generation_close(self, callback):
        return self._subscribe("close", callback)

    def subscribe_generation_install(self, callback):
        return self._subscribe("install", callback)

    def subscribe_carrier_reset(self, callback):
        return self._subscribe("reset", callback)

    def reset(self, channel, expected_connection=None):
        self.resets.append(channel)
        self._connections[channel] = self._connections.get(channel, 0) + 1
        for callback in tuple(self._listeners["reset"]):
            callback(channel)

    def abort(self):
        self.aborted = True

    async def __call__(self, channel, path, body, timeout):
        self.calls.append((channel, path, json.loads(body), timeout))
        report_owner_write_completed(self)
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
            f"{channel}-A" + (str(self._connections[channel]) if channel in self._connections else ""))
        evidence = replace(evidence, **self.evidence_change)
        reply = OwnerReply(json.dumps(frame, ensure_ascii=False).encode(), evidence)
        if self.saved is None:
            self.saved = reply
        return reply


class ReservationExchange(Exchange):
    """One combined operation reply may wait while independent owner reads run."""
    def __init__(self, policy, issued, request, observation):
        super().__init__(policy, issued)
        self.source[2] = SHA
        self.request, self.observation = request, observation
        self.entered, self.replied = asyncio.Event(), asyncio.Event()
        self.operation_pending = False
        self.read_during_pending = False
        self.hold_operation, self.operation_delay = False, 0

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
        if (channel != "operation" or path != OPERATION or len(frame) != 4
                or frame[:2] != ["meri.proxy.operation/2", "session_A"]
                or frame[2][0] != "meri.proxy.reservation/1"
                or frame[3][0] != "meri.proxy.reservation/1"):
            raise AssertionError("reservation did not send one combined operation/2")
        self.calls.append((channel, path, frame, timeout))
        report_owner_write_completed(self)
        self.operation_pending = True
        self.entered.set()
        try:
            if self.hold_operation:
                await self.replied.wait()
            if self.operation_delay:
                await asyncio.sleep(self.operation_delay)
        finally:
            self.operation_pending = False
        answer = ["meri.proxy.reservation-receipt/1", "session_A",
            [self.request["requestId"], hashlib.sha256(self.observation["nativeRequest"]["body"]).hexdigest(), "UNKNOWN"]]
        return self.reply(answer, channel)


class TwoReservationExchange(Exchange):
    """Two admitted sessions share the carrier only for their combined exchanges."""
    def __init__(self, policy, issued, requests, observation):
        super().__init__(policy, issued)
        self.source[2] = SHA
        self.requests, self.observation = requests, observation
        self.trace = []

    async def __call__(self, channel, path, body, timeout):
        frame = json.loads(body)
        if frame[0] == "meri.proxy.admission-read/1":
            self.trace.append(("admission", channel))
            return await super().__call__(channel, path, body, timeout)
        if (channel != "operation" or path != OPERATION or len(frame) != 4
                or frame[0] != "meri.proxy.operation/2"
                or frame[2][0] != "meri.proxy.reservation/1"
                or frame[3][0] != "meri.proxy.reservation/1"):
            raise AssertionError("reservation did not send one combined operation/2")
        report_owner_write_completed(self)
        request_id = frame[1]
        request = self.requests[request_id]
        if frame[2][1][0] != request["requestId"] or frame[3][1][0] != request["requestId"]:
            raise AssertionError("combined exchange mixed requests")
        self.trace.append(("claim", request_id))
        answer = ["meri.proxy.reservation-receipt/1", request_id, [request_id,
            hashlib.sha256(self.observation["nativeRequest"]["body"]).hexdigest(), "UNKNOWN"]]
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
        self.assertTrue(all(c[:2] == ("admission", OPERATION) for c in self.exchange.calls))

    async def test_refusal_lines_name_the_admission_read_apart_from_the_session_read(self):
        from apps.proxy.product import refusal_diagnostics as diagnostics
        lines = []
        diagnostics.install(write=lambda data: lines.append(data.decode("ascii")))
        try:
            self.exchange.mutate = lambda frame: ["meri.proxy.foreign/1"] + frame[1:]
            with diagnostics.request(), self.assertRaises(Exception):
                await self.resolve()
            await self.asyncSetUp()
            authority = (await self.resolve()).authority
            self.exchange.mutate = lambda frame: frame[:6] + [1] + frame[7:]
            with diagnostics.request(), self.assertRaises(Exception):
                await asyncio.to_thread(authority.check)
            await self.asyncSetUp()
            self.exchange.mutate = lambda frame: frame[:4] + [None] + frame[5:]
            with diagnostics.request(), self.assertRaises(Exception):
                await self.resolve()
        finally:
            diagnostics.uninstall()
        self.assertEqual(lines, ["PRODUCT_PROXY_REFUSED gate=admission step=frame phase=admission code=REFUSED\n",
                                 "PRODUCT_PROXY_REFUSED gate=admission step=current phase=session code=REFUSED\n",
                                 "PRODUCT_PROXY_REFUSED gate=admission step=source phase=admission code=REFUSED\n"])

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
            self.assertTrue(self.gate.available)
            self.assertFalse(self.exchange.aborted)

    async def test_existing_request_lifetime_reuses_bootstrap_receipt_on_start(self):
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
            life.check()
            self.assertEqual(len(self.exchange.calls), 1)
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
            self.assertTrue(self.gate.available)
            self.assertFalse(self.exchange.aborted)

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
        self.assertTrue(self.gate.available)
        self.assertEqual(dict(self.reader._receipts), {})
        self.assertEqual(self.reader._pending_tasks, set())
        self.assertFalse(self.exchange.aborted)
        with self.assertRaises(Exception):
            ProductOwnerAdmissionReader(policy=self.policy, exchange=Exchange(self.policy,self.issued),
                host_gate=OwnerHostGate(),owner_loop=asyncio.get_running_loop())

    async def test_real_bridge_capture_reuses_lifetime_receipt_and_revokes_copied_context(self):
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
            life.check()  # This request was admitted at start; no nested capture read.
            context = contextvars.copy_context()
            async def late():
                await late_ready.wait()
                with self.assertRaises(Exception):
                    await asyncio.to_thread(source.authority.check)
            copied.append(context.run(asyncio.create_task,late()))
            return observation
        bridge = ProductOwnerBridge(policy=self.policy,exchange=exchange,capture_call=capture,
            host_gate=self.gate,request_id=value["requestId"],binding=value["binding"],
            deadline_ms=deadline,grant_id=self.issued.grant_id,capability_sha256=SHA,session_id="session_A")
        try:
            await life.start(ingress_fixture()[2])
            result = await asyncio.wait_for(bridge.reserve(value,observation),.75)
            self.assertEqual(result["state"],"UNKNOWN")
            self.assertFalse(exchange.read_during_pending)
            reads = [c for c in exchange.calls if c[2][0]=="meri.proxy.admission-read/1"]
            self.assertEqual([c[0] for c in reads],["admission"])
            before = len(exchange.calls)
            late_ready.set(); await asyncio.gather(*copied)
            self.assertEqual(len(exchange.calls),before)
            self.assertTrue(self.gate.available)
            self.assertEqual(self.exchange.calls,[])
        finally:
            late_ready.set()
            if copied: await asyncio.gather(*copied)
            await life.close()

    async def test_two_real_bridges_capture_independently_with_separate_lifetime_receipts(self):
        deadline=milliseconds()+2000
        template,observation=reservation()
        template.update(binding=dict(self.issued.execution_binding),deadlineMs=deadline)
        observation.update(proxyCredential=KEY.decode())
        observation["peer"].update(binding=dict(self.issued.execution_binding),
            taskArn=self.issued.binding.worker_arn,grantId=self.issued.grant_id)
        requests={key:{**template,"requestId":key} for key in ("request_A","request_B")}
        exchange=TwoReservationExchange(self.policy,self.issued,requests,observation)
        reader=ProductOwnerAdmissionReader(policy=self.policy,exchange=exchange,
            host_gate=self.gate,owner_loop=asyncio.get_running_loop())
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
                lives[key].check()
                return {**observation,"requestId":key}
            bridges[key]=ProductOwnerBridge(policy=self.policy,exchange=exchange,capture_call=capture,
                host_gate=self.gate,request_id=key,binding=template["binding"],deadline_ms=deadline,
                grant_id=self.issued.grant_id,capability_sha256=SHA,session_id=key)
        tasks=[]
        try:
            for life in lives.values():await life.start(ingress_fixture()[2])
            tasks.append(asyncio.create_task(bridges["request_A"].reserve(requests["request_A"],{**observation,"requestId":"request_A"})))
            await asyncio.wait_for(callback_entered.wait(), .5)
            tasks.append(asyncio.create_task(bridges["request_B"].reserve(requests["request_B"],{**observation,"requestId":"request_B"})))
            second = await asyncio.wait_for(asyncio.shield(tasks[1]), .5)
            self.assertEqual(second["state"], "UNKNOWN")
            self.assertFalse(tasks[0].done(), "the first capture is still held")
            self.assertEqual([item for item in exchange.trace if item[0] == "claim"], [("claim", "request_B")],
                "the operation carrier must be free while another request captures")
            continue_first.set()
            results=await asyncio.wait_for(asyncio.gather(*tasks),1)
            self.assertEqual([item["state"] for item in results],["UNKNOWN","UNKNOWN"])
            self.assertEqual([item for item in exchange.trace if item[0]=="admission"],
                [("admission","admission")]*2)
            self.assertTrue(self.gate.available)
        finally:
            continue_first.set()
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
            deadline_ms=deadline, grant_id=self.issued.grant_id, capability_sha256=SHA, session_id="session_A")
        return asyncio.create_task(bridge.reserve(value, observation))

    async def test_admission_read_never_queues_behind_a_held_reservation(self):
        deadline = milliseconds()+5000
        value, observation = self.reservation_fixture(deadline)
        exchange = ReservationExchange(self.policy, self.issued, value, observation)
        reader = ProductOwnerAdmissionReader(policy=self.policy, exchange=exchange,
            host_gate=self.gate, owner_loop=asyncio.get_running_loop())
        source = await asyncio.to_thread(reader.resolve_for_issued_sync,
            issued=self.issued, capability_sha256=SHA, deadline_ms=deadline)
        exchange.hold_operation = True
        async def capture(_request):
            return observation
        reserve = self.held_reservation(exchange, value, observation, deadline, capture)
        try:
            await asyncio.wait_for(exchange.entered.wait(), 1)
            self.assertTrue(exchange.operation_pending)
            # A fresh admission read while a reserve operation holds the operation carrier.
            await asyncio.wait_for(asyncio.to_thread(source.authority.check), .5)
            self.assertTrue(exchange.operation_pending)
        finally:
            exchange.replied.set()
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
            owner_loop=asyncio.get_running_loop(), max_exchange_ms=1500, max_carrier_wait_ms=1000)
        source = await asyncio.to_thread(reader.resolve_for_issued_sync,
            issued=self.issued, capability_sha256=SHA, deadline_ms=deadline)
        expected = source.authority._product_owner[1]
        exchange.delay = .25
        exchange.operation_delay = 1.4
        async def capture(_request):
            return observation
        reserve = self.held_reservation(exchange, value, observation, deadline, capture)
        await asyncio.wait_for(exchange.entered.wait(), 2)
        # The title-style request's bootstrap read, an admission read, a session read and another admission read.
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

    async def test_expired_queued_claim_never_sends_or_aborts_another_bridge(self):
        from apps.proxy.product.owner_channel import owner_exchange_state
        lock=owner_exchange_state(self.exchange,self.policy,self.gate)[6]
        await lock.acquire()
        deadline=milliseconds()+30
        value,observation=self.reservation_fixture(deadline)
        captured=[]
        async def capture(request):
            captured.append(request)
            return observation
        bridge=ProductOwnerBridge(policy=self.policy,exchange=self.exchange,capture_call=capture,
            host_gate=self.gate,request_id=value["requestId"],binding=value["binding"],deadline_ms=deadline,
            grant_id=self.issued.grant_id,capability_sha256=SHA,session_id="session_A")
        try:
            with self.assertRaisesRegex(StateDenied, "^PRODUCT_OWNER_CHANNEL_DENIED$"):
                await asyncio.wait_for(bridge.reserve(value,observation), .5)
            self.assertEqual(captured,[value], "capture completed before the queued claim expired")
            self.assertEqual(self.exchange.calls,[])
            self.assertTrue(lock.locked(), "expiry cannot release another request's claim")
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


class AdmissionLeaseTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.issued = issued_fixture()[0].issued
        self.wall = [milliseconds()]
        self.mono = [time.monotonic()]
        self.policy = OwnerPeerPolicy("https://owner.invalid:8444", "owner.invalid",
            "owner-task", "proxy-"+uuid.uuid4().hex, "1"*64, "2"*64, "3"*64, "proxy-subject", 15000)
        self.exchange = Exchange(self.policy, self.issued)
        self.exchange.source[2] = SHA
        self.gate = OwnerHostGate()
        self.reader = ProductOwnerAdmissionReader(policy=self.policy, exchange=self.exchange,
            host_gate=self.gate, owner_loop=asyncio.get_running_loop(),
            now_ms=lambda: self.wall[0], monotonic=lambda: self.mono[0], max_exchange_ms=15000)
        self.lives = []
        self.observations = []

    async def asyncTearDown(self):
        for life in self.lives:
            await life.close()
        self.reader.close()

    async def source(self):
        with patch(__name__ + ".milliseconds", lambda: self.wall[0]):
            return await asyncio.to_thread(self.reader.resolve_for_issued_sync,
                issued=self.issued, capability_sha256=SHA, deadline_ms=self.wall[0]+30000)

    def lifetime(self, source, *, limits=LifetimeLimits()):
        peer = PeerLease("10.77.0.9", time.monotonic(), source.authority.binding, source.authority.grant_id)
        async def observe():
            self.observations.append(1)
            return replace(peer, observed_at=time.monotonic())
        life = RequestLifetime(IngressAdmission(source.authority, peer), observe,
            time.monotonic()+60, limits, PendingWork())
        self.lives.append(life)
        return life

    async def start(self, life):
        with patch(__name__ + ".milliseconds", lambda: self.wall[0]):
            await life.start(ingress_fixture()[2])

    async def test_receipt_reuses_only_in_its_lifetime_with_no_request_path_reads(self):
        source = await self.source()
        first = self.lifetime(source)
        await self.start(first)
        for _ in range(10):
            first.check()
            self.assertEqual(first.current_conversation()["selectedClientId"], self.exchange.source[7])
        self.assertEqual(len(self.exchange.calls), 1)
        self.assertEqual(self.observations, [])  # Bootstrap already observed the runner.
        second = self.lifetime(source)
        self.assertIsNone(second._admission_lease.receipt)
        with self.assertRaises(StateDenied):
            self.reader._consume(first._admission_lease.receipt, self.exchange.source, lifetime=second)
        await self.start(second)  # No bootstrap receipt: one fresh read at start.
        self.assertEqual(self.observations, [1])
        self.assertIsNot(first._admission_lease.receipt, second._admission_lease.receipt)
        self.assertEqual(len(self.exchange.calls), 2)
        # A caller cannot move the entire lease holder across lifetimes either.
        second._admission_lease = first._admission_lease
        with self.assertRaises(StateDenied):
            second.current_conversation()

    async def test_receipt_source_and_runner_peer_remain_bound(self):
        for field in ("source", "ipv4", "grant", "binding", "cap"):
            source = await self.source()
            life = self.lifetime(source)
            await self.start(life)
            if field == "source":
                reader, encoded, expiry = source.authority._product_owner
                foreign = json.loads(encoded); foreign[6] = "f"*64
                source.authority._product_owner = reader, json.dumps(foreign).encode(), expiry
            elif field == "cap":
                reader, encoded, expiry = source.authority._product_owner
                source.authority._product_owner = reader, encoded, expiry+1
            elif field == "ipv4":
                life.peer = replace(life.peer, ipv4="10.77.0.10")
            elif field == "grant":
                life.peer = replace(life.peer, grant_id=life.peer.binding.run_id)
            else:
                life.peer = replace(life.peer, binding=replace(life.peer.binding, fence=2))
            with self.subTest(field=field), self.assertRaises(StateDenied):
                life.current_conversation()

    async def test_request_outlives_its_admission_receipt_without_another_read(self):
        # Live 2026-10-23: a 10 s admission lease, renewed by ~6 s owner exchanges, cut a streaming answer mid-turn.
        life = self.lifetime(await self.source())
        await self.start(life)
        receipt = life._admission_lease.receipt
        self.assertEqual(life.tasks, set())  # No renewal or expiry watcher runs beside the request.
        self.mono[0] = receipt.expires_at_mono + 50
        self.wall[0] = receipt.expires_at_ms + 50000
        life.check()
        self.assertEqual(life.current_conversation()["selectedClientId"], self.exchange.source[7])
        self.assertIsNone(life.reason)
        self.assertEqual((len(self.exchange.calls), self.observations), (1, []))

    async def test_streaming_answer_longer_than_the_former_lease_completes(self):
        from apps.proxy.qualification.runtime.lifetime import _request_lifetime
        from apps.proxy.qualification.runtime.server import TrustedRequest, create_app
        source = await self.source()
        peer = PeerLease("10.77.0.9", time.monotonic(), source.authority.binding, source.authority.grant_id)
        async def observe():
            self.observations.append(1)
            return replace(peer, observed_at=time.monotonic())
        chunks = [b"delta-%d" % n for n in range(30)]
        async def upstream(scope, receive, send):
            await receive()
            await send({"type": "http.response.start", "status": 200})
            for chunk in chunks:
                # One simulated second per chunk: 30 s in all, three times the former 10 s admission lease.
                self.mono[0] += 1; self.wall[0] += 1000
                _request_lifetime.get().current_conversation()
                await send({"type": "http.response.body", "body": chunk, "more_body": True})
            await send({"type": "http.response.body", "body": b"", "more_body": False})
        app = create_app(upstream, lambda _scope: TrustedRequest(
            IngressAdmission(source.authority, peer), observe, time.monotonic()+60))
        received = asyncio.Queue()
        received.put_nowait({"type": "http.request", "body": b"{}", "more_body": False})
        sent = []
        async def send(event):
            sent.append(event)
        await asyncio.wait_for(app(ingress_fixture()[2], received.get, send), 5)
        self.assertEqual(sent[0], {"type": "http.response.start", "status": 200})
        self.assertEqual(b"".join(event.get("body", b"") for event in sent[1:]), b"".join(chunks))
        self.assertFalse(sent[-1]["more_body"])
        self.assertTrue(app.ready)
        self.assertEqual((len(self.exchange.calls), self.observations), (1, []))

    async def test_receipt_already_expired_at_start_refuses_the_request(self):
        def shorten(frame):
            frame[7] = frame[6]+250
            return frame
        self.exchange.mutate = shorten
        life = self.lifetime(await self.source())
        receipt = life._admission_lease.receipt
        self.assertEqual(receipt.expires_at_mono-receipt.read_at_mono, .25)
        self.mono[0] = receipt.expires_at_mono
        with self.assertRaises(StateDenied):
            await self.start(life)
        self.assertEqual(life.reason, "FRESH_ADMISSION_DENIED")

    async def test_refused_start_read_denies_without_poisoning(self):
        source = await self.source()
        self.lifetime(source)  # Takes the bootstrap receipt.
        life = self.lifetime(source)
        self.exchange.mutate = lambda _frame: None
        with self.assertRaises(StateDenied):
            await self.start(life)
        self.assertTrue(life.denied.is_set())
        self.assertIsNone(life._admission_lease.receipt)
        self.assertTrue(self.gate.available)
        self.assertFalse(self.exchange.aborted)

    async def test_generation_change_closes_old_admission_even_with_valid_receipt(self):
        life = self.lifetime(await self.source())
        await self.start(life)
        for callback in tuple(self.exchange._listeners["close"]):
            callback(1)
        with self.assertRaises(StateDenied):
            life.current_conversation()
        await asyncio.sleep(0)
        self.assertTrue(life.denied.is_set())
        self.assertTrue(self.gate.available)
        self.assertEqual(dict(self.reader._receipts), {})


if __name__ == "__main__":
    unittest.main()
