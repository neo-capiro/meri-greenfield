"""Compose real owner transport with existing bearer admission/session owners.

This module owns no database, credential authority, provider loop or listener.
Placement comes only from the control owner's authenticated closed read frame.
Native dependencies are imported only when resolving an enabled ProductSession.
"""
import asyncio
import hashlib
import json
import threading
import time
import uuid
import weakref

from .owner_channel import (OwnerPeerPolicy, OwnerHostGate, OPERATION, OwnerCarrierBusy,
                            acquire_owner_carrier, owner_exchange_state, validate_owner_reply,
                            make_product_owner_bridge)
from .budgets import OWNER_CARRIER_WAIT_MS
from .boundary_codec import encode_admit
from .owner_admission import ProductOwnerAdmissionReader
from .owner_https import ProductOwnerHttpsExchange
from .bearer_eni_admission import IssuedTaskNetwork
from . import refusal_diagnostics as diagnostics
from . import telemetry_context as telemetry
from ..qualification.state.grants import RunBinding
from ..qualification.state.pricing import StateDenied


def _deny():
    raise StateDenied("PRODUCT_OWNER_STARTUP_DENIED")


def decode_product_placement(value):
    if type(value) is not list or len(value) != 15 or type(value[0]) is not list or len(value[0]) != 5:
        _deny()
    names = ("tenantId", "actorId", "conversationId", "runId", "attemptId", "workerId", "writerFence")
    if (type(value[6]) is not list or len(value[6]) != 7 or type(value[13]) is not list
            or type(value[14]) is not list or any(type(row) is not list or len(row) != 2 for row in value[14])):
        _deny()
    return IssuedTaskNetwork(RunBinding(*value[0]), *value[1:6], dict(zip(names,value[6])),
        *value[7:13], tuple(value[13]), tuple(tuple(row) for row in value[14]))


class ProductOwnerStartup:
    """Trusted startup callbacks for the existing concrete proxy service."""
    def __init__(self, *, policy, exchange, host_gate, owner_loop, count_client,
                 make_provider_transport, pricing_revision, body_limits=None,
                 now_ms=None):
        if (type(policy) is not OwnerPeerPolicy or type(exchange) is not ProductOwnerHttpsExchange
                or exchange.policy is not policy
                or type(host_gate) is not OwnerHostGate or not host_gate.available
                or not exchange.available or asyncio.get_running_loop() is not owner_loop
                or not callable(make_provider_transport) or count_client is None
                or type(pricing_revision) is not str or len(pricing_revision) != 64
                or any(c not in "0123456789abcdef" for c in pricing_revision)):
            _deny()
        self.policy,self.exchange,self.gate,self.loop=policy,exchange,host_gate,owner_loop
        self.loop_thread=threading.get_ident()
        self.now_ms=now_ms or (lambda:time.time_ns()//1000000)
        self.count_client,self.make_provider_transport=count_client,make_provider_transport
        self.pricing_revision,self.body_limits=pricing_revision,body_limits
        self._authorities=weakref.WeakValueDictionary()
        self._sessions=weakref.WeakKeyDictionary()
        self._closed=False
        self._install_generation(getattr(exchange,"generation",0))
        self._subscriptions=[]
        for name,callback in (("subscribe_generation_close",self._close_generation),
                              ("subscribe_generation_install",self._schedule_generation)):
            subscribe=getattr(exchange,name,None)
            if callable(subscribe):self._subscriptions.append(subscribe(callback))

    def _close_generation(self,generation):
        if generation!=self.generation:return
        self._authorities.clear();self._sessions.clear()
        self.reader.close()

    def _schedule_generation(self,generation):
        if not self._closed and not self.loop.is_closed():
            self.loop.call_soon_threadsafe(self._install_generation,generation)

    def _install_generation(self,generation):
        if self._closed or generation!=getattr(self.exchange,"generation",0):return
        policy=self.exchange.policy
        reader=ProductOwnerAdmissionReader(policy=policy,exchange=self.exchange,host_gate=self.gate,
            owner_loop=self.loop,now_ms=self.now_ms,max_exchange_ms=policy.max_exchange_ms)
        state=owner_exchange_state(self.exchange,policy,self.gate)
        self.policy,self.reader,self.state,self.generation=policy,reader,state,generation

    def _check_generation(self,generation):
        if (self._closed or generation!=self.generation
                or generation!=getattr(self.exchange,"generation",0)
                or self.policy is not self.exchange.policy):_deny()

    async def _placement(self, capability, read_id, started, deadline):
        generation=self.generation;policy=self.policy;state=self.state
        self._check_generation(generation)
        step="carrier";cutoff=deadline;lock=state[3]["operation"]
        with diagnostics.phase("placement"):
            try:
                # Waiting sends nothing (OwnerCarrierBusy on expiry); the exchange clock starts with the carrier held.
                await acquire_owner_carrier(lock,min(OWNER_CARRIER_WAIT_MS,deadline-self.now_ms())/1000)
                try:
                    cutoff=min(deadline,self.now_ms()+self.policy.max_exchange_ms)
                    async with asyncio.timeout(max(.001,(cutoff-self.now_ms())/1000)):
                        self._check_generation(generation)
                        if not self.gate.available or self.now_ms()>=cutoff:
                            _deny()
                        step="exchange"
                        requested=min(deadline,self.now_ms()+900000)
                        read_at=self.reader.monotonic()
                        raw=encode_admit(read_id,capability,requested)
                        reply=await self.exchange("operation",OPERATION,raw,(cutoff-self.now_ms())/1000,
                            cutoff_ms=cutoff)
                        step="reply"
                        self._check_generation(generation)
                        frame=validate_owner_reply(policy,reply,"operation",state[4])
                        at=self.now_ms()
                        step="frame"
                        if (type(frame) is not list or len(frame)!=7
                                or frame[:3]!=["meri.proxy.admitted/1",read_id,capability]
                                or type(frame[5]) is not str or not frame[5] or len(frame[5])>128
                                or not all(c.isascii() and (c.isalnum() or c in "_-") for c in frame[5])
                                or type(frame[6]) is not int or not at<frame[6]<=requested):
                            _deny()
                        issued=decode_product_placement(frame[3])
                        if frame[6]>issued.expires_at_ms or not self.gate.available:
                            _deny()
                        if self.now_ms()>=cutoff:
                            _deny()
                        # The embedded receipt is bounded by the ADMIT deadline sent on the wire.
                        # The transport cutoff above bounds this exchange, not the receipt lifetime.
                        receipt=self.reader._verify_frame(frame[4],read_id,capability,None,
                            started,requested,read_at)
                        telemetry.bind(issued.execution_binding,read_id)
                        return issued,receipt,frame[5],frame[6]
                finally:
                    lock.release()
            except BaseException as error:
                diagnostics.refused("placement",step,error,deadline_ms=cutoff,now_ms=self.now_ms)
                raise

    def resolve_bearer_sha256(self, capability):
        if (threading.get_ident()==self.loop_thread or self.loop.is_closed() or not self.loop.is_running()
                or type(capability) is not str or len(capability)!=64
                or any(c not in "0123456789abcdef" for c in capability)):
            _deny()
        generation=self.generation;reader=self.reader
        self._check_generation(generation)
        started=self.now_ms();deadline=self.exchange.expires_at_ms
        bound=min(deadline,started+OWNER_CARRIER_WAIT_MS+self.policy.max_exchange_ms)
        read_id=uuid.uuid4().hex
        coroutine=self._placement(capability,read_id,started,deadline)
        future=None;step="placement"
        try:
            diagnostics.stage("placement-read")
            future=asyncio.run_coroutine_threadsafe(coroutine,self.loop)
            issued,receipt,session_id,session_deadline=future.result(timeout=max(.001,(bound-self.now_ms())/1000+1))
            step="admission";diagnostics.stage("admission-read")
            self._check_generation(generation)
            source=reader.resolve_for_issued_sync(issued=issued,capability_sha256=capability,
                deadline_ms=session_deadline,receipt=receipt)
            self._check_generation(generation)
            self._authorities[id(source.authority)]=source.authority
            self._sessions[source.authority]=(read_id,session_id,session_deadline)
            return source
        except OwnerCarrierBusy as error:
            # A carrier stayed held: nothing of this resolution was sent on it. Refuse the request, keep the gate.
            diagnostics.refused("owner",step,error,deadline_ms=bound,now_ms=self.now_ms)
            if future is None:coroutine.close()
            raise
        except BaseException as error:
            diagnostics.refused("owner",step,error,deadline_ms=bound,now_ms=self.now_ms)
            if future is None:coroutine.close()
            else:future.cancel()
            _deny()

    async def resolve_session(self, life):
        from ..qualification.runtime.lifetime import RequestLifetime
        from .host_composition import ProductSession
        from ..qualification.runtime.bedrock_body import BodyLimits
        if type(life) is not RequestLifetime:
            _deny()
        generation=self.generation
        self._check_generation(generation)
        authority=life.admission.authority
        if self._authorities.get(id(authority)) is not authority or authority._product_owner[0] is not self.reader:
            _deny()
        expected=authority._product_owner[1];facts=json.loads(expected)
        binding=dict(zip(("tenantId","actorId","conversationId","runId","attemptId","workerId","writerFence"),facts[0]))
        if authority.binding!=life.peer.binding or authority.grant_id!=life.peer.grant_id:
            _deny()
        session=self._sessions.pop(authority,None)
        if session is None:
            _deny()
        request_id,session_id,deadline=session
        if self.now_ms()>=deadline or deadline>facts[4][3]:
            _deny()
        telemetry.bind(binding, request_id)
        async def current(value):
            if (type(value) is not dict or value!={"binding":binding,"requestId":request_id,"deadlineMs":deadline}):
                _deny()
            return life.current_conversation()
        life.check()
        self._check_generation(generation)
        return ProductSession(request_id=request_id,binding=binding,model_grant_id=facts[1],
            deadline_ms=deadline,selected_client_id=facts[7],pricing_revision=self.pricing_revision,
            count_client=self.count_client,make_provider_transport=self.make_provider_transport,
            make_owner_bridge=make_product_owner_bridge(policy=self.policy,exchange=self.exchange,
                host_gate=self.gate,request_id=request_id,binding=binding,deadline_ms=deadline,
                grant_id=facts[1],capability_sha256=facts[2],session_id=session_id,now_ms=self.now_ms),
            check_current_conversation=current,limits=self.body_limits or BodyLimits())

    def close(self):
        if self._closed:return
        self._closed=True
        for unsubscribe in self._subscriptions:
            if callable(unsubscribe):unsubscribe()
        self._subscriptions.clear()
        self.reader.close()
        self.gate.poison();self.exchange.close();self._authorities.clear();self._sessions.clear()
