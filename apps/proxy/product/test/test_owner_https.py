"""Offline real-transport refusal/framing/cleanup checks; native TLS is unrun."""
import asyncio
import http.client
import socket
import ssl
import time
import unittest
from unittest.mock import patch

from apps.proxy.product.owner_https import (ProductOwnerHttpsExchange,OwnerClientTlsMaterial,
    validate_owner_http_reply,load_owner_client_tls_material)
from apps.proxy.product.owner_channel import OwnerPeerPolicy,OPERATION


def policy():
    return OwnerPeerPolicy('https://owner.invalid:8444','owner.invalid','owner-task','proxy-task',
        'a'*64,'b'*64,'c'*64,'proxy-client')


def exchange():
    context=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.minimum_version=context.maximum_version=ssl.TLSVersion.TLSv1_3
    return ProductOwnerHttpsExchange(policy=policy(),material=OwnerClientTlsMaterial(context,'c'*64),
        owner_ipv4='10.1.2.3',proxy_ipv4='10.1.2.4',expires_at_ms=time.time_ns()//1000000+10000,
        deployment_revision='reviewed-v1')


class HttpsTests(unittest.IsolatedAsyncioTestCase):
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
