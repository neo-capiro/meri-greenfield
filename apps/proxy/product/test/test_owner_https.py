"""Offline real-transport refusal/framing/cleanup checks; native TLS is unrun."""
from apps.proxy.product.test.budget_fixture import TEST_BUDGETS, TEST_LIFETIME_LIMITS, budget_fixture, budget_data
import asyncio
import dataclasses
import http.client
import socket
import ssl
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from apps.proxy.product.owner_https import (ProductOwnerHttpsExchange,OwnerClientTlsMaterial,
    validate_owner_http_reply,load_owner_client_tls_material)
from apps.proxy.product.owner_channel import OwnerPeerPolicy,OPEN,OPERATION,POLL,REPLY
from apps.proxy.product import refusal_diagnostics as diagnostics
from apps.proxy.product.service_pair_discovery import compile_owner_peer
from apps.proxy.product.test.test_service_pair_discovery import fixture, peer_template


def policy():
    return OwnerPeerPolicy('https://owner.invalid:8444','owner.invalid','owner-task','proxy-task',
        'a'*64,'b'*64,'c'*64,'proxy-client', max_exchange_ms=3000)


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

    def test_actual_send_refreshes_service_pair_before_and_after_response(self):
        item=exchange();f=item.fixture;sent=[]
        response=SimpleNamespace(status=200,version=11,will_close=False,length=0,
            getheaders=lambda:[('content-type','application/json'),('content-length','2'),('cache-control','no-store'),('x-meri-owner-revision','reviewed-v1')],
            read=lambda _size:b'[]')
        sock=SimpleNamespace(settimeout=lambda _value:None)
        connection=SimpleNamespace(sock=sock,request=lambda *a,**kw:sent.append((a,kw)),getresponse=lambda:response)
        with patch.object(item,'_connect',return_value=connection),patch.object(item,'_evidence',return_value='synthetic-peer-boundary-only'):
            value=item._send('operation',OPERATION,b'[]',item.now_ms()+1000)
        self.assertEqual(value.body,b'[]');self.assertEqual(len(f.calls),30);self.assertEqual(len(sent),1)
        f.ids['proxy']='3'
        with patch.object(item,'_connect',side_effect=AssertionError('stale socket attempted')):
            with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                item._send('operation',OPERATION,b'[]',item.now_ms()+1000)
        self.assertFalse(item.available);self.assertEqual(len(sent),1)
    def test_an_owner_refusal_is_one_reply_status_line_and_the_exchange_cap_is_15000(self):
        item=exchange();lines=[];diagnostics.install(write=lambda data:lines.append(data.decode('ascii')), burst=20, window=60)
        response=SimpleNamespace(status=403,version=11,will_close=False,length=0,
            getheaders=lambda:[('content-length','0'),('cache-control','no-store')],read=lambda _size:b'')
        connection=SimpleNamespace(sock=SimpleNamespace(settimeout=lambda _value:None),request=lambda *a,**kw:None,getresponse=lambda:response)
        try:
            with diagnostics.request(),diagnostics.phase('placement'):
                with patch.object(item,'_connect',return_value=connection),patch.object(item,'_evidence',return_value='synthetic-peer-boundary-only'):
                    with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
                        item._send('operation',OPERATION,b'[]',item.now_ms()+1000)
        finally:
            diagnostics.uninstall()
        self.assertEqual(lines,['PRODUCT_PROXY_REFUSED gate=exchange step=reply-status phase=placement at=exchange-wait code=REFUSED\n'])
        self.assertFalse(item.available)
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
        self.assertFalse(item.available)

    def test_missing_material_refuses_without_ambient_credential_discovery(self):
        with self.assertRaisesRegex(Exception,'PRODUCT_OWNER_HTTPS_DENIED'):
            load_owner_client_tls_material(ca_file=None,certificate_file=None,private_key_file=None,policy=policy())

    def test_later_tls_context_weakening_refuses_existing_transport(self):
        item=exchange();self.assertTrue(item.available)
        item.material.context.check_hostname=False
        self.assertFalse(item.available);item.abort()


if __name__=='__main__':unittest.main()
