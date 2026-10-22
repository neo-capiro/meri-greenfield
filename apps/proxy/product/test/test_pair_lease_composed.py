"""Real Python↔Node loopback TLS; scripted AWS, Core, SQL and provider only.

These checks exercise the production owners together, not private-network or
pinned-image qualification. Only the two exact loopback transport addresses
are admitted by test-local shims; all certificate and task bindings stay real.
"""
import asyncio
from dataclasses import replace
import hashlib
import json
import os
from pathlib import Path
import shutil
import time
import unittest
from unittest.mock import patch
import uuid

import httpx

from apps.proxy.product import host_composition as host
from apps.proxy.product import owner_channel, owner_https, service_pair_discovery
from apps.proxy.product.owner_channel import OwnerHostGate, OPERATION
from apps.proxy.product.owner_https import (ProductOwnerHttpsExchange,
    OwnerExchangeUnavailable, load_owner_client_tls_material)
from apps.proxy.product.owner_startup import ProductOwnerStartup
from apps.proxy.product.pair_lease import ProductPairLease
from apps.proxy.product.service_pair_discovery import compile_owner_peer
from apps.proxy.product.test.test_service_pair_discovery import fixture as aws_fixture
from apps.proxy.qualification.runtime.bedrock_transport import CountObservation
from apps.proxy.qualification.runtime.ingress import IngressAdmission, PeerLease
from apps.proxy.qualification.runtime.lifetime import (RequestLifetime, LifetimeLimits,
    PendingWork, _request_lifetime)

ROOT = Path(__file__).resolve().parents[4]
URL = 'https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-6/invoke'
NATIVE = json.dumps({'anthropic_version': 'bedrock-2023-05-31', 'max_tokens': 16,
    'messages': [{'role': 'user', 'content': 'synthetic'}]}, separators=(',', ':')).encode()
MESSAGE = json.dumps({'id': 'msg_synthetic', 'type': 'message', 'role': 'assistant',
    'model': 'anthropic.claude-sonnet-4-6', 'content': [{'type': 'text', 'text': 'synthetic answer'}],
    'stop_reason': 'end_turn', 'stop_sequence': None,
    'usage': {'input_tokens': 12, 'output_tokens': 3}}, separators=(',', ':')).encode()


class Handler:
    def __init__(self, **kwargs):
        self.client = httpx.AsyncClient(**kwargs, trust_env=False)

    async def close(self):
        await self.client.aclose()


class Counter:
    calls = 0

    async def count(self, parameters):
        self.calls += 1
        body = parameters['input']['invokeModel']['body']
        return CountObservation(12, hashlib.sha256(body).hexdigest(),
                                'anthropic.claude-sonnet-4-6', 'aws-counttokens')


class Provider(httpx.AsyncBaseTransport):
    def __init__(self, delay):
        self.calls, self.delay = 0, delay

    async def handle_async_request(self, request):
        self.calls += 1
        await asyncio.sleep(self.delay)
        class Body(httpx.AsyncByteStream):
            async def __aiter__(self):
                yield MESSAGE
        return httpx.Response(200, stream=Body(), headers={'content-type': 'application/json'})


def loopback_only(original):
    def validate(value):
        return value if value in ('127.0.0.1', '127.0.0.2') else original(value)
    return validate


class ComposedPairLeaseTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        node = shutil.which('node')
        if node is None:
            self.skipTest('UNRUN: composed pair lease requires Node.js')
        if not (ROOT/'node_modules').is_dir():
            self.skipTest('UNRUN: composed pair lease requires installed workspace node_modules')
        for module in ('apps/proxy/product/test/p2-composed-owner.mjs',
                       'apps/gateway/budget/product-scripted-fixture.mjs', 'packages/contracts/validate.mjs'):
            if not (ROOT/module).is_file():
                self.skipTest('UNRUN: composed pair lease requires workspace module '+module)
        # Each child models a new owner/proxy process; isolate the proxy's
        # process-lifetime one-gate registry while preserving other suites.
        gates = patch.dict(owner_channel._SERVICE_GATES, clear=True)
        gates.start(); self.addCleanup(gates.stop)
        self.child = await asyncio.create_subprocess_exec(node, str(Path(__file__).with_name('p2-composed-owner.mjs')),
            cwd=ROOT, env={**os.environ, 'MERI_REVIEW_SOURCE_ROOT': str(ROOT)},
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        self.addAsyncCleanup(self.close_child)
        line = await asyncio.wait_for(self.child.stdout.readline(), 20)
        if not line:
            self.fail((await self.child.stderr.read()).decode())
        self.meta = json.loads(line)
        self.shims = [patch.object(owner_https, '_ip', loopback_only(owner_https._ip)),
                      patch.object(service_pair_discovery, '_private', loopback_only(service_pair_discovery._private))]
        for shim in self.shims:
            shim.start(); self.addCleanup(shim.stop)
        self.aws = aws_fixture(self.meta['at'])
        self.aws.configuration.update(self.meta['pins'])
        def loopback(value, _):
            # Preserve the scripted SDK datetimes; only replace exact network fields.
            def replace_ip(item):
                if isinstance(item, dict):
                    return {k: replace_ip(v) for k, v in item.items()}
                if isinstance(item, list):
                    return [replace_ip(v) for v in item]
                return {'10.40.4.1': '127.0.0.1', '10.40.4.2': '127.0.0.2'}.get(item, item) if isinstance(item, str) else item
            return replace_ip(value)
        for name in ('describe_tasks', 'describe_network_interfaces'):
            self.aws.changes[name] = loopback
        self.holder = ProductPairLease(self.aws.reader())
        self.addAsyncCleanup(self.holder.aclose)
        pair = await asyncio.to_thread(self.holder.read, deadline_ms=self.now()+15000)
        policy = compile_owner_peer({'origin': 'https://owner.synthetic.invalid:8444', 'server_name': 'owner.synthetic.invalid',
            'server_cert_sha256': self.meta['pins']['ownerCertSha256'], 'server_issuer_sha256': self.meta['clientPolicy']['issuerSha256'],
            'client_cert_sha256': self.meta['pins']['proxyCertSha256'], 'client_subject': 'proxy-task-v1', 'max_exchange_ms': 15000}, pair)
        files = self.meta['clientFiles']
        material = load_owner_client_tls_material(ca_file=files['caFile'], certificate_file=files['certFile'], private_key_file=files['keyFile'], policy=policy)
        self.exchange = ProductOwnerHttpsExchange(policy=policy, material=material, owner_ipv4='127.0.0.1', proxy_ipv4='127.0.0.2',
            expires_at_ms=self.meta['pins']['expiresAtMs'], deployment_revision=self.meta['pins']['deploymentRevision'], service_pair_reader=self.holder)
        self.addCleanup(self.exchange.close)
        await asyncio.to_thread(self.exchange._warm)
        # The owner's secureConnection hook proves each carrier without assigning
        # its HTTP role. An admission frame would incorrectly consume capture's role.
        async with asyncio.timeout(5):
            while (await self.stats())['pairProofs'] != 4:
                await asyncio.sleep(.01)
        self.calls, self.lost_ack, self.bridges = [], False, []
        original = ProductOwnerHttpsExchange.__call__
        async def counted(exchange, channel, path, body, timeout):
            frame = json.loads(body); self.calls.append((channel, path, frame))
            result = await original(exchange, channel, path, body, timeout)
            if self.lost_ack and json.loads(result.body)[0] == 'meri.proxy.settlement-receipt/1':
                self.lost_ack = False
                exchange.reset(channel)
                await asyncio.sleep(.05)  # Let the real owner close the original session socket.
                raise OwnerExchangeUnavailable()
            return result
        self.counter_patch = patch.object(ProductOwnerHttpsExchange, '__call__', counted)
        self.counter_patch.start(); self.addCleanup(self.counter_patch.stop)

    @staticmethod
    def now():
        return time.time_ns() // 1000000

    @staticmethod
    def frame(value):
        return json.dumps(value, separators=(',', ':')).encode()

    async def close_child(self):
        if self.child.returncode is None:
            self.child.stdin.write(b'{"command":"close"}\n')
            await self.child.stdin.drain()
            try:
                await asyncio.wait_for(self.child.wait(), 20)
            except TimeoutError:
                self.child.kill(); await self.child.wait()
        errors = (await self.child.stderr.read()).decode()
        self.assertEqual(self.child.returncode, 0, errors)

    async def stats(self):
        self.child.stdin.write(b'{"command":"stats"}\n'); await self.child.stdin.drain()
        return json.loads(await asyncio.wait_for(self.child.stdout.readline(), 5))

    async def invoke(self, delay):
        provider, counter = Provider(delay), Counter()
        startup = ProductOwnerStartup(policy=self.exchange.policy, exchange=self.exchange, host_gate=OwnerHostGate(),
            owner_loop=asyncio.get_running_loop(), count_client=object(), make_provider_transport=lambda: provider,
            pricing_revision=self.meta['pricingRevision'])
        self.addCleanup(startup.close)
        source = await asyncio.to_thread(startup.resolve_bearer_sha256, self.meta['capability'])
        authority = source.authority
        peer_checks = []
        async def observer():
            peer_checks.append(time.monotonic())
            return PeerLease('10.77.0.9', time.monotonic(), authority.binding, authority.grant_id)
        peer = await observer()
        life = RequestLifetime(IngressAdmission(authority, peer), observer, time.monotonic()+60,
            LifetimeLimits(check_seconds=15, cleanup_seconds=15), PendingWork())
        self.addAsyncCleanup(life.close)
        await life.start({'type': 'http', 'scheme': 'https', 'method': 'POST', 'path': '/v1/messages',
            'raw_path': b'/v1/messages', 'query_string': b'beta=true', 'client': ('10.77.0.9', 40000),
            'headers': [(b'authorization', b'Bearer '+self.meta['credential'].encode())]})
        life.original_body = b'{"prompt":"synthetic"}'
        token = _request_lifetime.set(life)
        try:
            session = await startup.resolve_session(life)
            create_bridge = session.make_owner_bridge
            def tracked(capture):
                bridge = create_bridge(capture); self.bridges.append(bridge); return bridge
            session = replace(session, make_owner_bridge=tracked)
            with patch.object(host, 'AsyncHTTPHandler', Handler), patch.object(host, 'AwsNativeCounter', return_value=counter):
                handler = await host.create_guarded_product_handler(life, session)
            try:
                async with handler.client.stream('POST', URL, content=NATIVE, headers={'content-type': 'application/json'}) as response:
                    self.assertEqual(b''.join([chunk async for chunk in response.aiter_raw()]), MESSAGE)
            except Exception as error:
                raise AssertionError({'frames': [call[2][0] for call in self.calls], 'owner': await self.stats()}) from error
            finally:
                await handler.close()
            self.assertEqual((provider.calls, counter.calls), (1, 1))
            return session, len(peer_checks)
        finally:
            _request_lifetime.reset(token)
            await life.close()

    async def test_twenty_second_request_reuses_warm_pair_and_request_proofs(self):
        before, discoveries = await self.stats(), len(self.aws.calls)
        session, peer_checks = await self.invoke(20.2)
        after = await self.stats()
        self.assertEqual(peer_checks, 5)
        self.assertEqual(len(self.calls), 13)
        self.assertEqual(len(self.aws.calls)-discoveries, 0)
        self.assertEqual(after['pairProofs']-before['pairProofs'], 0)
        self.assertEqual(after['coreCalls']-before['coreCalls'], 12)
        self.assertEqual(len(after['requests']), 1)
        self.assertEqual(after['requests'][0]['request_id'], session.request_id)
        self.assertEqual(after['requests'][0]['state'], 'SETTLED')
        self.assertEqual(after['budget']['consumed_micro_usd'], '90')

    async def test_lost_settle_ack_recovers_read_only_on_new_tls_carrier(self):
        self.lost_ack = True
        session, _ = await self.invoke(0)
        after = await self.stats()
        self.assertFalse(self.lost_ack)
        operations = [call[2] for call in self.calls if call[2][0] == 'meri.proxy.operation/1']
        words = [frame[2][0] for frame in operations]
        self.assertEqual(words.count('meri.proxy.settlement/1'), 1)
        self.assertEqual(words.count('meri.proxy.reservation/1'), 1)
        self.assertEqual(words.count('meri.proxy.outcome/1'), 1)
        self.assertEqual(after['requests'][0]['state'], 'SETTLED')
        self.assertEqual(after['budget']['consumed_micro_usd'], '90')
        self.assertEqual(sum(sql.startswith('UPDATE meri_product_budget.requests SET') for sql in after['commands']), 1)
        outcome = next(frame for frame in operations if frame[2][0] == 'meri.proxy.outcome/1')
        # A fresh authenticated socket cannot use another session or request.
        for changed in ([outcome[0], uuid.uuid4().hex, outcome[2]],
                        [outcome[0], outcome[1], [outcome[2][0], uuid.uuid4().hex]]):
            with self.assertRaises(Exception):
                await self.exchange('operation', OPERATION, self.frame(changed), 15)
            self.assertEqual((await self.stats())['commands'], after['commands'])
        self.child.stdin.write(self.frame({'command': 'foreign-principal', 'frame': outcome})+b'\n')
        await self.child.stdin.drain()
        foreign = json.loads(await asyncio.wait_for(self.child.stdout.readline(), 5))
        self.assertTrue(foreign['refused'])
        self.assertEqual(foreign['commands'], after['commands'])
