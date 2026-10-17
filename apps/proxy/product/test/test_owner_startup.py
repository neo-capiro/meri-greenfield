"""Offline placement constructor boundary; no server or native dependencies."""
import asyncio
import json
import ssl
import time
import uuid
import unittest
from unittest.mock import patch
from apps.proxy.product.owner_startup import decode_product_placement,ProductOwnerStartup
from apps.proxy.product.owner_channel import OwnerHostGate
from apps.proxy.product.owner_https import ProductOwnerHttpsExchange,OwnerClientTlsMaterial
from apps.proxy.product.test.test_bearer_eni_admission import source
from apps.proxy.product.test.test_owner_admission import Exchange
from apps.proxy.product.service_pair_discovery import compile_owner_peer
from apps.proxy.product.test.test_service_pair_discovery import fixture,peer_template


class StartupTests(unittest.TestCase):
    def test_exact_control_placement_roundtrip_retains_original_expiry(self):
        issued=source()[0].issued
        names=('tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence')
        q=issued.binding
        value=[[q.run_id,q.attempt,q.worker_arn,q.fence,q.policy_revision],issued.grant_id,
            issued.cluster_arn,issued.task_definition_arn,issued.container_name,issued.image_digest,
            [issued.execution_binding[n] for n in names],issued.started_by,issued.group,
            issued.created_at_ms,issued.expires_at_ms,issued.vpc_id,issued.subnet_id,
            list(issued.security_group_ids),[list(row) for row in issued.tags]]
        self.assertEqual(decode_product_placement(value),issued)
        for foreign in [True,None,{},value+["credential"]]:
            with self.assertRaises(Exception):decode_product_placement(foreign)
        altered=value.copy();altered[10]+=1
        with self.assertRaises(Exception):decode_product_placement(altered)


class StartupCompositionTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_startup_joins_placement_and_fresh_admission_without_native_import(self):
        issued=source()[0].issued
        # The service-pair reader is mandatory: the owner/proxy peer policy and both
        # IPv4s come from the scripted discovery of exactly one owner/proxy pair.
        pair=fixture();reader=pair.reader()
        # The process-global owner gate is keyed by origin and task pair, so this test
        # uses its own origin instead of colliding with other scripted pairs.
        host='owner-'+uuid.uuid4().hex+'.invalid';template=peer_template()
        template.update(origin='https://'+host+':8444',server_name=host)
        policy=compile_owner_peer(template,reader.read(deadline_ms=pair.at+3000))
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.minimum_version=context.maximum_version=ssl.TLSVersion.TLSv1_3
        transport=ProductOwnerHttpsExchange(policy=policy,material=OwnerClientTlsMaterial(context,'3'*64),
            owner_ipv4='10.40.4.1',proxy_ipv4='10.40.4.2',expires_at_ms=pair.configuration['expiresAtMs'],
            deployment_revision='reviewed-v1',service_pair_reader=reader)
        synthetic=Exchange(policy,issued)
        loop=asyncio.get_running_loop();gate=OwnerHostGate()
        startup=ProductOwnerStartup(policy=policy,exchange=transport,host_gate=gate,owner_loop=loop,
            count_client=object(),make_provider_transport=lambda:None,pricing_revision='f'*64)
        names=('tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence');q=issued.binding
        placement=[[q.run_id,q.attempt,q.worker_arn,q.fence,q.policy_revision],issued.grant_id,
            issued.cluster_arn,issued.task_definition_arn,issued.container_name,issued.image_digest,
            [issued.execution_binding[n] for n in names],issued.started_by,issued.group,
            issued.created_at_ms,issued.expires_at_ms,issued.vpc_id,issued.subnet_id,
            list(issued.security_group_ids),[list(row) for row in issued.tags]]
        calls=[]
        def wire_only(channel,path,body,cutoff):
            frame=json.loads(body);calls.append(frame[0])
            if frame[0]=='meri.proxy.placement-read/1':
                return synthetic.reply(['meri.proxy.placement/1',frame[1],frame[2],placement,
                    time.time_ns()//1000000,frame[3]],channel)
            future=asyncio.run_coroutine_threadsafe(synthetic(channel,path,body,(cutoff-time.time_ns()//1000000)/1000),loop)
            return future.result(timeout=1)
        try:
            # Only the wire is synthetic. No TLS success or native dependencies are claimed.
            with patch.object(transport,'_send',side_effect=wire_only):
                resolved=await asyncio.to_thread(startup.resolve_bearer_sha256,'a'*64)
                self.assertEqual(resolved.issued,issued)
                await asyncio.to_thread(resolved.authority.check)
                expected=resolved.authority._product_owner[1]
                receipt=await asyncio.to_thread(startup.reader.read_current_conversation_sync,
                    expected,issued.expires_at_ms)
                self.assertEqual(receipt['binding'],issued.execution_binding)
                self.assertEqual(receipt['selectedClientId'],'11111111-1111-4111-8111-111111111111')
                self.assertEqual(calls,['meri.proxy.placement-read/1']+['meri.proxy.admission-read/1']*3)
                with self.assertRaises(Exception):startup.resolve_bearer_sha256('a'*64)
        finally:
            startup.close()
        self.assertFalse(transport.available);self.assertFalse(gate.available)


if __name__=='__main__':unittest.main()
