"""Offline real-transport refusal/framing/cleanup checks; native TLS is unrun."""
import asyncio
import dataclasses
import http.client
import hashlib
import json
import socket
import ssl
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from apps.proxy.product.owner_https import (ProductOwnerHttpsExchange,OwnerClientTlsMaterial,OwnerExchangeUnavailable,
    validate_owner_http_reply,load_owner_client_tls_material)
from apps.proxy.product.owner_channel import (OwnerPeerPolicy,OwnerTlsEvidence,OwnerHostGate,
    make_product_owner_bridge,OPEN,OPERATION,POLL,REPLY)
from apps.proxy.product import refusal_diagnostics as diagnostics,telemetry_lines
from apps.proxy.product.service_pair_discovery import compile_owner_peer,PairProofError
from apps.proxy.product.test_boundary_codec import reservation
from apps.proxy.product.test.test_service_pair_discovery import fixture, peer_template


def policy():
    return OwnerPeerPolicy('https://owner.invalid:8444','owner.invalid','owner-task','proxy-task',
        'a'*64,'b'*64,'c'*64,'proxy-client')


def exchange():
    f=fixture();f.configuration['ownerCertSha256']='a'*64;f.configuration['proxyCertSha256']='c'*64
    template=peer_template();template.update(server_cert_sha256='a'*64,client_cert_sha256='c'*64)
    reader=f.reader();peer=compile_owner_peer(template,reader.read(deadline_ms=f.at+3000))
    context=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.minimum_version=context.maximum_version=ssl.TLSVersion.TLSv1_3
    result=ProductOwnerHttpsExchange(policy=peer,material=OwnerClientTlsMaterial(context,'c'*64),
        owner_ipv4='10.40.4.1',proxy_ipv4='10.40.4.2',expires_at_ms=f.configuration['expiresAtMs'],
        deployment_revision='reviewed-v1',service_pair_reader=reader)
    result.fixture=f
    return result


class HttpsTests(unittest.IsolatedAsyncioTestCase):
    async def test_reply_read_cannot_return_after_monotonic_lease_expiry(self):
        item=exchange();self.addCleanup(item.close)
        wall=item.fixture.at;item.now_ms=lambda:wall;item.pair_lease._now=lambda:wall
        mono=[item.pair_lease.current.checked_at_mono_ms];item.pair_lease._mono=lambda:mono[0]
        entered,release=threading.Event(),threading.Event()
        sent,closed,replies=[],[],[]
        def read(_size):
            entered.set()
            if not release.wait(2): raise TimeoutError('test did not release reply read')
            return b'[]'
        response=SimpleNamespace(status=200,version=11,will_close=False,length=0,
            getheaders=lambda:[('content-type','application/json'),('content-length','2'),
                ('cache-control','no-store'),('x-meri-owner-revision','reviewed-v1')],read=read)
        connection=SimpleNamespace(sock=SimpleNamespace(settimeout=lambda _:None),
            request=lambda *a,**kw:sent.append((a,kw)),getresponse=lambda:response,close=lambda:closed.append(True))
        item._connections['operation']=connection
        item._connection_generations['operation']=item.generation
        try:
            with patch.object(item,'_evidence',return_value='verified-held-carrier'):
                pending=asyncio.create_task(item('operation',OPERATION,b'[]',1))
                self.assertTrue(await asyncio.to_thread(entered.wait,1),'reply read must be in flight')
                mono[0]=item.pair_lease.current.expires_at_mono_ms+1
                release.set()
                with self.assertRaisesRegex(PairProofError,'^PAIR_UNAVAILABLE$'):
                    replies.append(await pending)
            self.assertEqual(replies,[],'an expired reply must never become an OwnerReply')
            self.assertEqual(len(sent),1);self.assertEqual(closed,[True])
            self.assertNotIn('operation',item._connections)
            self.assertEqual(item.now_ms(),wall,'wall time must not cause the refusal')
            self.assertTrue(item.available)
        finally:
            release.set()
            if 'pending' in locals():
                await asyncio.gather(pending,return_exceptions=True)

    async def test_reservation_timeout_after_native_write_is_never_resent_by_call_or_bridge(self):
        # The real exchange and bridge serialize actual HTTP bytes over native
        # socket pairs. Only the already-proven carrier's TLS evidence is scripted.
        item=exchange();self.addCleanup(item.close)
        wall=item.fixture.at;item.now_ms=lambda:wall;item.pair_lease._now=lambda:wall
        item._policy=dataclasses.replace(item.policy,max_exchange_ms=1000)
        value,observation=reservation();value['deadlineMs']=wall+10000
        frames,threads,servers,exchange_errors,socket_errors=[],[],[],[],[]
        received,stop=threading.Event(),threading.Event()
        session='owner_timeout_session'

        class NativeReadTimeout:
            def __init__(self,sock): self.sock=sock
            def settimeout(self,seconds): self.sock.settimeout(min(seconds,.1))
            def __getattr__(self,name): return getattr(self.sock,name)

        def serve(sock):
            try:
                with sock.makefile('rb') as stream:
                    while not stop.is_set():
                        line=stream.readline()
                        if not line: return
                        method,path,_=line.decode('ascii').strip().split(' ')
                        headers={}
                        while (line:=stream.readline()) not in (b'\r\n',b''):
                            key,header=line.decode('ascii').split(':',1);headers[key.lower()]=header.strip()
                        body=stream.read(int(headers['content-length']))
                        frame=json.loads(body);frames.append((method,path,frame))
                        if path==OPEN:
                            answer=['meri.proxy.session/1',session,frame[1],frame[2]]
                        elif path==POLL:
                            answer=['meri.proxy.capture-call/1',value['requestId'],
                                [value['binding'][key] for key in ('tenantId','actorId','conversationId',
                                    'runId','attemptId','workerId','writerFence')],value['deadlineMs']]
                        elif path==REPLY:
                            answer=['meri.proxy.capture-ack/1',session,value['requestId'],'call']
                        else:
                            self.assertEqual(frame[0],'meri.proxy.operation/1')
                            self.assertEqual(frame[2][0],'meri.proxy.reservation/1')
                            received.set()
                            # Request bytes reached the owner; no reply is sent.
                            stop.wait(3)
                            return
                        encoded=json.dumps(answer,separators=(',',':')).encode()
                        sock.sendall(b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: '+
                            str(len(encoded)).encode()+b'\r\nCache-Control: no-store\r\nX-Meri-Owner-Revision: reviewed-v1\r\n\r\n'+encoded)
            except BaseException as error:
                if not stop.is_set(): socket_errors.append(error)

        def connect(channel,_cutoff):
            client,server=socket.socketpair();servers.append(server)
            connection=http.client.HTTPConnection(item.policy.server_name,8444)
            connection.sock=NativeReadTimeout(client);connection.auto_open=0
            item._register(connection.sock,channel,item.generation)
            item._connections[channel]=connection;item._connection_generations[channel]=item.generation
            thread=threading.Thread(target=serve,args=(server,),daemon=True);threads.append(thread);thread.start()
            return connection

        def evidence(sock):
            p=item.policy
            return OwnerTlsEvidence(p.origin,p.server_name,p.owner_task_arn,p.proxy_task_arn,
                p.server_cert_sha256,p.server_issuer_sha256,p.client_cert_sha256,p.client_subject,
                'TLSv1.3','http/1.1',f'scripted_native_{id(sock)}')

        original_call=ProductOwnerHttpsExchange.__call__
        async def observed_call(exchange,channel,path,body,timeout):
            try:
                return await original_call(exchange,channel,path,body,timeout)
            except OwnerExchangeUnavailable as error:
                exchange_errors.append(error);raise
        async def capture(_request): return observation
        from apps.proxy.product import owner_channel
        with patch.dict(owner_channel._SERVICE_GATES,clear=True), \
             patch.object(item,'_connect',side_effect=connect),patch.object(item,'_evidence',side_effect=evidence), \
             patch.object(ProductOwnerHttpsExchange,'__call__',observed_call):
            bridge=make_product_owner_bridge(policy=item.policy,exchange=item,host_gate=OwnerHostGate(),
                request_id=value['requestId'],binding=value['binding'],deadline_ms=value['deadlineMs'],
                grant_id='grant_A',capability_sha256=hashlib.sha256(observation['proxyCredential'].encode()).hexdigest(),
                now_ms=lambda:wall)(capture)
            try:
                with self.assertRaisesRegex(Exception,'^PRODUCT_OWNER_CHANNEL_DENIED$'):
                    await bridge.reserve(value,observation)
                self.assertTrue(received.is_set(),'the complete reservation frame must reach the owner')
                self.assertEqual(len(exchange_errors),1)
                self.assertIsInstance(exchange_errors[0],OwnerExchangeUnavailable)
                reservations=[frame for method,path,frame in frames if method=='POST' and path==OPERATION]
                self.assertEqual(len(reservations),1,'__call__ must never resend the timed-out reservation')
                self.assertNotIn('operation',item._connections)
                self.assertGreaterEqual(len(item._resets),1)
                before=len(frames)
                with self.assertRaisesRegex(Exception,'^PRODUCT_OWNER_CHANNEL_DENIED$'):
                    await bridge.reserve(value,observation)
                self.assertEqual(len(frames),before,'a later reserve on the failed request sends nothing')
                self.assertEqual(bridge._state,'FAILED')
                self.assertEqual(socket_errors,[])
            finally:
                stop.set();item.close()
                for server in servers:
                    try: server.shutdown(socket.SHUT_RDWR)
                    except OSError: pass
                    server.close()
                for thread in threads:
                    await asyncio.to_thread(thread.join,2)
                    self.assertFalse(thread.is_alive())

    def test_observed_socket_addresses_must_match_selected_service_pair(self):
        item=exchange()
        class SocketBoundary:
            def fileno(self): return 7
            def version(self): return 'TLSv1.3'
            def selected_alpn_protocol(self): return 'http/1.1'
            def getpeername(self): return ('10.40.4.9',8444)
            def getsockname(self): return ('10.40.4.2',32123)
            def getpeercert(self,**_kwargs): raise AssertionError('foreign socket reached certificate projection')
        with patch('apps.proxy.product.owner_https.ssl.SSLSocket',SocketBoundary):
            with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                item._evidence(SocketBoundary())
        item.abort()
    def test_missing_or_arbitrary_discovery_cannot_make_product_transport(self):
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version=context.maximum_version=ssl.TLSVersion.TLSv1_3
        for reader in (None,SimpleNamespace(available=True)):
            with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                ProductOwnerHttpsExchange(policy=policy(),material=OwnerClientTlsMaterial(context,'c'*64),
                    owner_ipv4='10.1.2.3',proxy_ipv4='10.1.2.4',expires_at_ms=time.time_ns()//1000000+10000,
                    deployment_revision='reviewed-v1',service_pair_reader=reader)

    def test_held_socket_uses_lease_without_request_path_discovery(self):
        item=exchange();f=item.fixture;sent=[]
        response=SimpleNamespace(status=200,version=11,will_close=False,length=0,
            getheaders=lambda:[('content-type','application/json'),('content-length','2'),('cache-control','no-store'),('x-meri-owner-revision','reviewed-v1')],
            read=lambda _size:b'[]')
        sock=SimpleNamespace(settimeout=lambda _value:None)
        connection=SimpleNamespace(sock=sock,request=lambda *a,**kw:sent.append((a,kw)),getresponse=lambda:response)
        item._connections['operation'] = connection
        item._connection_generations['operation'] = item.generation
        with patch.object(item,'_connect',side_effect=AssertionError('held socket reconnected')),patch.object(item,'_evidence',return_value='synthetic-peer-boundary-only'):
            value=item._send('operation',OPERATION,b'[]',item.now_ms()+1000)
            value=item._send('operation',OPERATION,b'[]',item.now_ms()+1000)
        self.assertEqual(value.body,b'[]');self.assertEqual(len(f.calls),10);self.assertEqual(len(sent),2)
        # Background proof observes our own identity changed: never re-pin it.
        f.ids['proxy']='3'
        with self.assertRaisesRegex(Exception,'PAIR_DRIFT'):
            item.pair_lease.renew(deadline_ms=item.now_ms()+1000)
        self.assertFalse(item.available);self.assertEqual(len(sent),2)
    def test_an_owner_refusal_is_one_reply_status_line_and_the_exchange_cap_is_15000(self):
        item=exchange();lines=[];diagnostics.install(write=lambda data:lines.append(data.decode('ascii')))
        response=SimpleNamespace(status=403,version=11,will_close=False,length=0,
            getheaders=lambda:[('content-length','0'),('cache-control','no-store')],read=lambda _size:b'')
        connection=SimpleNamespace(sock=SimpleNamespace(settimeout=lambda _value:None),request=lambda *a,**kw:None,getresponse=lambda:response)
        item._connections['operation'] = connection
        item._connection_generations['operation'] = item.generation
        try:
            with diagnostics.request(),diagnostics.phase('placement'):
                with patch.object(item,'_connect',return_value=connection),patch.object(item,'_evidence',return_value='synthetic-peer-boundary-only'):
                    with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                        item._send('operation',OPERATION,b'[]',item.now_ms()+1000)
        finally:
            diagnostics.uninstall()
        self.assertEqual(lines,['PRODUCT_PROXY_REFUSED gate=exchange step=reply-status phase=placement at=exchange-wait code=REFUSED\n'])
        self.assertTrue(item.available, 'an answered request refusal is not process drift')
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version=context.maximum_version=ssl.TLSVersion.TLSv1_3
        for budget,allowed in ((15000,True),(15001,False)):
            f=fixture();f.configuration['ownerCertSha256']='a'*64;f.configuration['proxyCertSha256']='c'*64
            template=peer_template();template.update(server_cert_sha256='a'*64,client_cert_sha256='c'*64)
            reader=f.reader();peer=dataclasses.replace(compile_owner_peer(template,reader.read(deadline_ms=f.at+3000)),max_exchange_ms=budget)
            build=lambda:ProductOwnerHttpsExchange(policy=peer,material=OwnerClientTlsMaterial(context,'c'*64),
                owner_ipv4='10.40.4.1',proxy_ipv4='10.40.4.2',expires_at_ms=f.configuration['expiresAtMs'],
                deployment_revision='reviewed-v1',service_pair_reader=reader)
            if allowed:
                build().abort()
            else:
                with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                    build()

    def test_closed_http_response_framing(self):
        valid=[('content-type','application/json'),('content-length','2'),('cache-control','no-store'),
               ('x-meri-owner-revision','reviewed-v1')]
        self.assertEqual(validate_owner_http_reply(200,valid,expected_revision='reviewed-v1'),2)
        for status,headers in [(302,valid),(200,valid+[('Content-Length','2')]),
                (200,valid+[('transfer-encoding','chunked')]),(200,valid+[('location','https://foreign.invalid')]),
                (200,[('content-type','application/json'),('content-length','02'),('cache-control','no-store')]),
                (200,[('content-type','text/html'),('content-length','2'),('cache-control','no-store')])]:
            with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                validate_owner_http_reply(status,headers,expected_revision='reviewed-v1')

    def test_revision_header_requires_exact_independently_configured_pin(self):
        base=[('content-type','application/json'),('content-length','2'),('cache-control','no-store')]
        for headers in [base,base+[('x-meri-owner-revision','foreign')],
                base+[('x-meri-owner-revision','reviewed-v1'),('X-Meri-Owner-Revision','reviewed-v1')]]:
            with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                validate_owner_http_reply(200,headers,expected_revision='reviewed-v1')

    def test_abort_synchronously_closes_all_owned_descriptors_and_is_permanent(self):
        item=exchange();owned=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
        response=http.client.HTTPResponse(owned)
        connection=http.client.HTTPConnection('unused.invalid')
        connection.sock=owned
        connection._HTTPConnection__response=response
        item._connections['operation']=connection
        second=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
        item._register(second)
        item._register(owned);self.assertGreaterEqual(owned.fileno(),0)
        item.abort();self.assertEqual(owned.fileno(),-1);self.assertFalse(item.available)
        self.assertTrue(response.isclosed());self.assertEqual(item._connections,{})
        self.assertEqual(second.fileno(),-1)
        item.abort()

    async def test_capture_connection_cannot_submit_a_budget_claim(self):
        item=exchange()
        with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
            await item('capture',OPERATION,b'["meri.proxy.operation/1"]',.1)
        item.abort()

    async def test_admission_connection_carries_only_owner_reads(self):
        item=exchange()
        for path,body in ((OPEN,b'["meri.proxy.session-open/1"]'),(POLL,b'["meri.proxy.capture-poll/1"]'),
                          (REPLY,b'["meri.proxy.capture-reply/1"]'),(OPERATION,b'["meri.proxy.operation/1","s",[]]'),
                          (OPERATION,b'["meri.proxy.admission-read/1","r","a"]'),(OPERATION,b'["meri.proxy.placement-read/1","r"]')):
            with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                await item('admission',path,body,.1)
        item.abort()

    def test_unsupported_verified_chain_api_refuses_before_socket_creation(self):
        if hasattr(ssl.SSLSocket,'get_verified_chain'):
            self.skipTest('local runtime has the required public native API')
        item=exchange()
        with patch('apps.proxy.product.owner_https.socket.socket',side_effect=AssertionError('socket attempted')):
            with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                item._send('operation',OPERATION,b'["meri.proxy.admission-read/1"]',item.now_ms()+100)
        self.assertTrue(item.available)

    def test_missing_material_refuses_without_ambient_credential_discovery(self):
        with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
            load_owner_client_tls_material(ca_file=None,certificate_file=None,private_key_file=None,policy=policy())

    def test_later_tls_context_weakening_refuses_existing_transport(self):
        item=exchange();self.assertTrue(item.available)
        item.material.context.check_hostname=False
        self.assertFalse(item.available);item.abort()

    def test_each_new_socket_proves_after_handshake_before_any_http_bytes(self):
        item=exchange();events=[]
        class SocketBoundary:
            def __init__(self): self.closed=False
            def settimeout(self, value): pass
            def bind(self, address): events.append('bind')
            def connect(self, address): events.append('connect')
            def do_handshake(self): events.append('handshake')
            def getpeername(self): return ('10.40.4.1',8444)
            def getsockname(self): return ('10.40.4.2',12345)
            def get_verified_chain(self): return []
            def shutdown(self, how): pass
            def close(self): self.closed=True
        raw,tls=SocketBoundary(),SocketBoundary()
        original=item.pair_lease.discovery.read
        def proof(**kwargs):
            events.append('proof-start')
            self.assertIn('handshake',events)
            return original(**kwargs)
        with patch('apps.proxy.product.owner_https.ssl.SSLSocket',SocketBoundary), \
             patch('apps.proxy.product.owner_https.socket.socket',return_value=raw), \
             patch.object(item.material.context,'wrap_socket',return_value=tls), \
             patch.object(item,'_evidence',return_value='verified'), \
             patch.object(item.pair_lease.discovery,'read',side_effect=proof):
            connection=item._connect('operation',item.now_ms()+1000)
        self.assertLess(events.index('handshake'),events.index('proof-start'))
        self.assertEqual(len(item.fixture.calls),20)
        self.assertEqual(connection.auto_open,0, 'HTTPConnection cannot bypass the pinned reconnect path')
        self.assertEqual(item._connection_generations['operation'],item.generation)
        item.abort();self.assertTrue(raw.closed and tls.closed)

    def _assert_post_handshake_drift_sends_no_http_bytes(self, change):
        item=exchange();sent=[];events=[]
        class SocketBoundary:
            def __init__(self): self.closed=False
            def settimeout(self, value): pass
            def bind(self, address): pass
            def connect(self, address): pass
            def do_handshake(self):
                events.append('handshake')
                change(item.fixture)
            def getpeername(self): return ('10.40.4.1',8444)
            def getsockname(self): return ('10.40.4.2',12345)
            def get_verified_chain(self): return []
            def shutdown(self, how): pass
            def close(self): self.closed=True
        raw,tls=SocketBoundary(),SocketBoundary()
        with patch('apps.proxy.product.owner_https.ssl.SSLSocket',SocketBoundary), \
             patch('apps.proxy.product.owner_https.socket.socket',return_value=raw), \
             patch.object(item.material.context,'wrap_socket',return_value=tls), \
             patch.object(item,'_evidence',return_value='verified'), \
             patch.object(http.client.HTTPConnection,'request',side_effect=lambda *_a,**_kw:sent.append(1)):
            with self.assertRaisesRegex(Exception,'PAIR_DRIFT'):
                item._send('operation',OPERATION,b'[]',item.now_ms()+1000)
        self.assertEqual(events,['handshake'])
        self.assertEqual(sent,[]);self.assertFalse(item.available);self.assertFalse(item.ready)
        self.assertTrue(raw.closed and tls.closed)
        return item

    def test_post_handshake_drift_sends_no_http_bytes(self):
        self._assert_post_handshake_drift_sends_no_http_bytes(lambda f:f.ids.update(proxy='3'))

    def test_post_handshake_reused_ip_and_eni_do_not_admit_a_foreign_service_task(self):
        for mode in ('foreign-service', 'foreign-deployment', 'not-listed'):
            with self.subTest(mode=mode):
                def change(f):
                    original=f.task_id('owner')
                    # A different task now claims exactly the old owner's IP
                    # and ENI; matching network identity cannot confer membership.
                    f.ids['owner']='3'
                    replacement=f.task_id('owner')
                    self.assertNotEqual(replacement,original)
                    if mode == 'not-listed':
                        f.changes['list_tasks']=lambda v,kw: (
                            {'taskArns':[original]} if kw['serviceName']=='meri-owner' else v)
                    def tasks(value, _):
                        owner=value['tasks'][1]
                        self.assertEqual(owner['taskArn'],replacement)
                        details={row['name']:row['value'] for row in owner['attachments'][0]['details']}
                        self.assertEqual((details['privateIPv4Address'],details['networkInterfaceId']),
                                         ('10.40.4.1','eni-11111111'))
                        if mode == 'foreign-service': owner['group']='service:foreign-owner'
                        if mode == 'foreign-deployment': owner['startedBy']='ecs-svc/999'
                        return value
                    f.changes['describe_tasks']=tasks
                self._assert_post_handshake_drift_sends_no_http_bytes(change)

    def test_post_handshake_two_distinct_running_members_send_no_http_bytes(self):
        def change(f):
            def members(value, kwargs):
                self.assertEqual(kwargs['desiredStatus'],'RUNNING')
                if kwargs['serviceName']=='meri-owner':
                    second=f.task_id('owner').rsplit('/',1)[0]+'/'+'3'*32
                    self.assertNotEqual(second,value['taskArns'][0])
                    value['taskArns'].append(second)
                return value
            f.changes['list_tasks']=members
        item=self._assert_post_handshake_drift_sends_no_http_bytes(change)
        self.assertNotIn('describe_tasks',[method for method,_ in item.fixture.calls[10:]],
                         'two RUNNING members must fail in the post-handshake inventory phase')

    def test_post_handshake_final_membership_and_deployment_pins_send_no_http_bytes(self):
        for mode in ('membership','deployment'):
            with self.subTest(mode=mode):
                def change(f):
                    seen=[0]
                    def final(value,kwargs):
                        if mode=='deployment':
                            seen[0]+=1
                            if seen[0]==2: value['services'][1]['deployments'][0]['id']='ecs-svc/99'
                        elif kwargs['serviceName']=='meri-owner':
                            seen[0]+=1
                            if seen[0]==2:
                                value['taskArns']=[f.task_id('owner').rsplit('/',1)[0]+'/'+'3'*32]
                        return value
                    f.changes['describe_services' if mode=='deployment' else 'list_tasks']=final
                item=self._assert_post_handshake_drift_sends_no_http_bytes(change)
                self.assertIn('describe_network_interfaces',[method for method,_ in item.fixture.calls[10:]],
                              'the final recheck must follow the complete network observation')

    def test_post_handshake_changed_task_definition_and_image_are_never_repinned(self):
        for mode in ('task-definition','image-digest'):
            with self.subTest(mode=mode):
                def change(f):
                    def tasks(value,_):
                        owner=value['tasks'][1]
                        if mode=='task-definition':
                            owner['taskDefinitionArn']=owner['taskDefinitionArn'].rsplit(':',1)[0]+':99'
                        else:
                            owner['containers'][1]['imageDigest']='sha256:'+'f'*64
                        return value
                    f.changes['describe_tasks']=tasks
                self._assert_post_handshake_drift_sends_no_http_bytes(change)

    def test_read_timeout_resets_only_its_carrier_then_next_request_serves(self):
        item=exchange();sent=[];closed=[]
        response=SimpleNamespace(status=200,version=11,will_close=False,length=0,
            getheaders=lambda:[('content-type','application/json'),('content-length','2'),('cache-control','no-store'),('x-meri-owner-revision','reviewed-v1')],
            read=lambda _size:b'[]')
        def connection(failing):
            def reply():
                if failing: raise TimeoutError()
                return response
            return SimpleNamespace(sock=SimpleNamespace(settimeout=lambda _:None),
                request=lambda *_a,**_kw:sent.append(1),getresponse=reply,close=lambda:closed.append(failing))
        failed=connection(True);capture=connection(False)
        item._connections.update(admission=failed,capture=capture)
        item._connection_generations.update(admission=item.generation,capture=item.generation)
        with patch.object(item,'_evidence',return_value='verified'):
            with self.assertRaises(OwnerExchangeUnavailable):
                item._send('admission',OPERATION,b'[]',item.now_ms()+1000)
            self.assertTrue(item.available)
            self.assertIs(item._connections['capture'],capture)
            self.assertNotIn('admission',item._connections)
            item._connections['admission']=connection(False)
            item._connection_generations['admission']=item.generation
            self.assertEqual(item._send('admission',OPERATION,b'[]',item.now_ms()+1000).body,b'[]')
        self.assertEqual(sent,[1,1], 'the failed frame was not retried')
        self.assertEqual(closed,[True]);item.abort()

    def test_fourth_actual_carrier_reset_retires_but_duplicate_reset_does_not(self):
        item=exchange();health=[]
        telemetry_lines.install(write=lambda line:health.append(json.loads(line)))
        self.addCleanup(telemetry_lines.uninstall)
        for index in range(4):
            item._connections['operation']=SimpleNamespace(close=lambda:None)
            item._sent_channels['operation']=item._connections['operation']
            item.reset('operation');item.reset('operation')
            self.assertEqual(item.available,index<3)
        self.assertEqual([line['code'] for line in health if line.get('transition')=='retired'],['CARRIER_RESET_LIMIT'])
        self.assertEqual(len(item._resets),4)

    def test_replacement_connect_failures_do_not_spend_sent_carrier_reset_quota(self):
        from apps.proxy.product.test.test_pair_lease import replace_partner
        item=exchange();mono=[time.monotonic()*1000]
        item.pair_lease._mono=lambda:mono[0]
        replace_partner(item.fixture,'3')
        item.pair_lease.renew(deadline_ms=item.now_ms()+1000)
        class SocketBoundary:
            def __init__(self, failing=False): self.failing=failing;self.closed=False
            def settimeout(self, value): pass
            def bind(self, address): pass
            def connect(self, address):
                if self.failing: raise ConnectionRefusedError()
            def do_handshake(self): pass
            def getpeername(self): return ('10.40.4.3',8444)
            def getsockname(self): return ('10.40.4.2',12345)
            def get_verified_chain(self): return []
            def shutdown(self, how): pass
            def close(self): self.closed=True
        with patch('apps.proxy.product.owner_https.ssl.SSLSocket',SocketBoundary):
            for _ in range(6):
                raw=SocketBoundary(failing=True)
                with patch('apps.proxy.product.owner_https.socket.socket',return_value=raw):
                    with self.assertRaises(ConnectionRefusedError):
                        item._warm()
                self.assertTrue(raw.closed)
                self.assertTrue(item.ready)
                mono[0]+=2000
            self.assertEqual(item._resets,[])
            self.assertEqual(item._sockets,set())
            mono[0]+=30000
            self.assertFalse(item.ready)
            self.assertTrue(item.available, 'late reproof remains recoverable until absolute expiry')
            with patch('apps.proxy.product.owner_https.socket.socket',side_effect=lambda *_a,**_kw:SocketBoundary()), \
                 patch.object(item.material.context,'wrap_socket',side_effect=lambda *_a,**_kw:SocketBoundary()), \
                 patch.object(item,'_evidence',return_value='verified'):
                item._warm()
            self.assertTrue(item.ready)
            self.assertEqual(set(item._connections),{'operation','capture','admission'})
            self.assertEqual(item._resets,[])
        item.close()

    def test_expired_unavailable_lease_never_sends_or_uses_reset_budget(self):
        item=exchange();holder=item.pair_lease
        holder._mono=lambda:holder.current.expires_at_mono_ms
        item.fixture.changes['describe_services']=lambda *_: (_ for _ in ()).throw(TimeoutError())
        sent=[]
        item._connections['operation']=SimpleNamespace(request=lambda *_a,**_kw:sent.append(1))
        item._connection_generations['operation']=item.generation
        for _ in range(4):
            with self.assertRaisesRegex(Exception,'PAIR_UNAVAILABLE'):
                item._send('operation',OPERATION,b'[]',item.now_ms()+1000)
        self.assertEqual(sent,[]);self.assertEqual(item._resets,[])
        self.assertTrue(item.available);item.abort()


if __name__=='__main__':unittest.main()
