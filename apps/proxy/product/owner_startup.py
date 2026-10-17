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

from .owner_channel import (OwnerPeerPolicy, OwnerHostGate, OPERATION,
                            owner_exchange_state, validate_owner_reply,
                            make_product_owner_bridge)
from .owner_admission import ProductOwnerAdmissionReader
from .owner_https import ProductOwnerHttpsExchange
from .bearer_eni_admission import IssuedTaskNetwork
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
        self.reader=ProductOwnerAdmissionReader(policy=policy,exchange=exchange,host_gate=host_gate,
            owner_loop=owner_loop,now_ms=self.now_ms,max_exchange_ms=policy.max_exchange_ms)
        self.count_client,self.make_provider_transport=count_client,make_provider_transport
        self.pricing_revision,self.body_limits=pricing_revision,body_limits
        self.state=owner_exchange_state(exchange,policy,host_gate)
        self._authorities={}

    async def _placement(self, capability, read_id, started, cutoff):
        async with asyncio.timeout(max(.001,(cutoff-self.now_ms())/1000)):
            async with self.state[3]["operation"]:
                if not self.gate.available or self.now_ms()>=cutoff:
                    _deny()
                raw=json.dumps(["meri.proxy.placement-read/1",read_id,capability,cutoff],
                    separators=(",",":")).encode("ascii")
                reply=await self.exchange("operation",OPERATION,raw,(cutoff-self.now_ms())/1000)
                frame=validate_owner_reply(self.policy,reply,"operation",self.state[4])
                at=self.now_ms()
                if (type(frame) is not list or len(frame)!=6
                        or frame[:3]!=["meri.proxy.placement/1",read_id,capability]
                        or type(frame[4]) is not int or not started<=frame[4]<=at
                        or type(frame[5]) is not int or not at<frame[5]<=cutoff):
                    _deny()
                issued=decode_product_placement(frame[3])
                if frame[5]>issued.expires_at_ms or not self.gate.available:
                    _deny()
                return issued,frame[5]

    def resolve_bearer_sha256(self, capability):
        if (threading.get_ident()==self.loop_thread or self.loop.is_closed() or not self.loop.is_running()
                or type(capability) is not str or len(capability)!=64
                or any(c not in "0123456789abcdef" for c in capability)):
            _deny()
        started=self.now_ms();cutoff=min(self.exchange.expires_at_ms,started+self.policy.max_exchange_ms)
        coroutine=self._placement(capability,uuid.uuid4().hex,started,cutoff)
        future=None
        try:
            future=asyncio.run_coroutine_threadsafe(coroutine,self.loop)
            issued,effective=future.result(timeout=max(.001,(cutoff-self.now_ms())/1000))
            source=self.reader.resolve_for_issued_sync(issued=issued,capability_sha256=capability,
                deadline_ms=min(cutoff,effective))
            self._authorities[id(source.authority)]=source.authority
            return source
        except BaseException:
            if future is None:coroutine.close()
            else:future.cancel()
            self.gate.poison();self.exchange.abort();_deny()

    async def resolve_session(self, life):
        from ..qualification.runtime.lifetime import RequestLifetime
        from .host_composition import ProductSession
        from ..qualification.runtime.bedrock_body import BodyLimits
        if type(life) is not RequestLifetime:
            _deny()
        authority=life.admission.authority
        if self._authorities.get(id(authority)) is not authority or authority._product_owner[0] is not self.reader:
            _deny()
        expected=authority._product_owner[1];facts=json.loads(expected)
        binding=dict(zip(("tenantId","actorId","conversationId","runId","attemptId","workerId","writerFence"),facts[0]))
        if authority.binding!=life.peer.binding or authority.grant_id!=life.peer.grant_id:
            _deny()
        remaining=max(0,int((life.deadline-time.monotonic())*1000))
        deadline=min(facts[4][3],self.now_ms()+remaining)
        request_id=uuid.uuid4().hex
        async def current(value):
            if (type(value) is not dict or value!={"binding":binding,"requestId":request_id,"deadlineMs":deadline}):
                _deny()
            return await asyncio.to_thread(self.reader.read_current_conversation_sync,expected,deadline)
        life.check()
        await asyncio.to_thread(self.reader.check_current_sync,expected,deadline)
        return ProductSession(request_id=request_id,binding=binding,model_grant_id=facts[1],
            deadline_ms=deadline,selected_client_id=facts[7],pricing_revision=self.pricing_revision,
            count_client=self.count_client,make_provider_transport=self.make_provider_transport,
            make_owner_bridge=make_product_owner_bridge(policy=self.policy,exchange=self.exchange,
                host_gate=self.gate,request_id=request_id,binding=binding,deadline_ms=deadline,
                grant_id=facts[1],capability_sha256=facts[2],now_ms=self.now_ms),
            check_current_conversation=current,limits=self.body_limits or BodyLimits())

    def close(self):
        self.gate.poison();self.exchange.abort();self._authorities.clear()
