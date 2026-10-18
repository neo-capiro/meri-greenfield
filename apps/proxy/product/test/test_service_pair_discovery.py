"""Scripted task-role SDK boundary; no AWS, TLS, provider or credential I/O."""
import copy
from datetime import datetime, timezone
from types import SimpleNamespace
import threading
import time
import unittest
from apps.proxy.product.service_pair_discovery import (ProductServicePairDiscovery,
    parse_service_pair_configuration, parse_owner_peer_template, compile_owner_peer)

PREFIX = 'arn:aws:ecs:us-east-1:967807252336:'
def service_configuration(now=None):
    now = now or time.time_ns()//1000000
    def pin(role, digit):
        return {'clusterArn': PREFIX+'cluster/capiro-dev', 'serviceArn': PREFIX+'service/capiro-dev/meri-'+role,
            'taskDefinitionArn': PREFIX+'task-definition/meri-'+role+':4', 'containerName': role,
            'imageUri': '967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-'+role+'@sha256:'+digit*64,
            'taskRoleArn': 'arn:aws:iam::967807252336:role/meri-'+role, 'executionRoleArn': 'arn:aws:iam::967807252336:role/meri-execution',
            'vpcId': 'vpc-12345678', 'subnetIds': ['subnet-12345678'], 'securityGroupIds': ['sg-'+digit*8]}
    return {'schemaVersion': 2, 'deploymentRevision': 'reviewed-v1', 'expiresAtMs': now+60000,
        'ownerCertSha256': '1'*64, 'proxyCertSha256': '3'*64, 'owner': pin('owner', '1'), 'proxy': pin('proxy', '2')}

def peer_template():
    return {'origin': 'https://owner.invalid:8444', 'server_name': 'owner.invalid', 'server_cert_sha256': '1'*64,
        'server_issuer_sha256': '2'*64, 'client_cert_sha256': '3'*64, 'client_subject': 'proxy-subject', 'max_exchange_ms': 3000}

def fixture(now=None):
    at = now or time.time_ns()//1000000
    c, calls, changes, ids = service_configuration(at), [], {}, {'owner': '1', 'proxy': '2'}
    def task_id(role):
        return PREFIX+'task/capiro-dev/'+ids[role]*32
    def service(role):
        p = c[role]
        return {'serviceArn': p['serviceArn'], 'serviceName': 'meri-'+role, 'clusterArn': p['clusterArn'], 'status': 'ACTIVE',
            'taskDefinition': p['taskDefinitionArn'], 'desiredCount': 1, 'runningCount': 1, 'pendingCount': 0, 'launchType': 'FARGATE',
            'platformVersion': '1.4.0', 'enableExecuteCommand': False,
            'deployments': [{'id': 'ecs-svc/'+('1' if role == 'owner' else '2'), 'status': 'PRIMARY', 'taskDefinition': p['taskDefinitionArn'],
                'desiredCount': 1, 'runningCount': 1, 'pendingCount': 0, 'rolloutState': 'COMPLETED'}],
            'networkConfiguration': {'awsvpcConfiguration': {'assignPublicIp': 'DISABLED', 'subnets': p['subnetIds'], 'securityGroups': p['securityGroupIds']}}}
    def definition(role):
        p = c[role]
        return {'taskDefinitionArn': p['taskDefinitionArn'], 'status': 'ACTIVE', 'networkMode': 'awsvpc', 'requiresCompatibilities': ['FARGATE'],
            'taskRoleArn': p['taskRoleArn'], 'executionRoleArn': p['executionRoleArn'], 'containerDefinitions': [{'name': role, 'image': p['imageUri'], 'essential': True}]}
    def task(role):
        p, index = c[role], 1 if role == 'owner' else 2
        return {'taskArn': task_id(role), 'clusterArn': p['clusterArn'], 'taskDefinitionArn': p['taskDefinitionArn'], 'group': 'service:meri-'+role,
            'startedBy': 'ecs-svc/'+str(index), 'createdAt': datetime.fromtimestamp((at-10000)/1000, tz=timezone.utc), 'launchType': 'FARGATE',
            'platformFamily': 'Linux', 'platformVersion': '1.4.0', 'enableExecuteCommand': False, 'lastStatus': 'RUNNING', 'desiredStatus': 'RUNNING',
            # Live DescribeTasks shape: one name-only entry per task container and an empty accelerator list.
            'overrides': {'containerOverrides': [{'name': 'material-init'}, {'name': role}], 'inferenceAcceleratorOverrides': []},
            'containers': [{'name': 'material-init', 'taskArn': task_id(role), 'lastStatus': 'STOPPED', 'exitCode': 0},
                {'name': role, 'taskArn': task_id(role), 'lastStatus': 'RUNNING',
                'image': p['imageUri'], 'imageDigest': p['imageUri'].split('@')[1], 'containerArn': PREFIX+'container/capiro-dev/'+ids[role]*32+'/11111111-1111-4111-8111-111111111111',
                'networkInterfaces': [{'privateIpv4Address': '10.40.4.'+str(index)}]}],
            'attachments': [{'type': 'ElasticNetworkInterface', 'status': 'ATTACHED', 'details': [{'name': 'networkInterfaceId', 'value': 'eni-'+str(index)*8},
                {'name': 'subnetId', 'value': p['subnetIds'][0]}, {'name': 'privateIPv4Address', 'value': '10.40.4.'+str(index)}]}]}
    def network(role):
        p, index = c[role], 1 if role == 'owner' else 2
        return {'NetworkInterfaceId': 'eni-'+str(index)*8, 'VpcId': p['vpcId'], 'SubnetId': p['subnetIds'][0], 'PrivateIpAddress': '10.40.4.'+str(index),
            'OwnerId': '967807252336', 'Status': 'in-use', 'Attachment': {'Status': 'attached'}, 'Groups': [{'GroupId': g} for g in p['securityGroupIds']],
            'PrivateIpAddresses': [{'PrivateIpAddress': '10.40.4.'+str(index), 'Primary': True}], 'Ipv6Addresses': []}
    def call(method, kwargs):
        calls.append((method, kwargs))
        if method == 'describe_services':
            result = {'services': [service('proxy'), service('owner')], 'failures': []}
        elif method == 'list_tasks':
            result = {'taskArns': [task_id('owner' if kwargs['serviceName'] == 'meri-owner' else 'proxy')]}
        elif method == 'describe_task_definition':
            result = {'taskDefinition': definition('owner' if kwargs['taskDefinition'] == c['owner']['taskDefinitionArn'] else 'proxy')}
        elif method == 'describe_tasks':
            result = {'tasks': [task('proxy'), task('owner')], 'failures': []}
        else:
            result = {'NetworkInterfaces': [network('proxy'), network('owner')]}
        result = copy.deepcopy(result)
        return changes[method](result, kwargs) if method in changes else result
    class Client:
        def close(self):
            pass
    ecs, ec2 = Client(), Client()
    for client, methods in ((ecs, ('describe_services', 'list_tasks', 'describe_task_definition', 'describe_tasks')), (ec2, ('describe_network_interfaces',))):
        for method in methods:
            setattr(client, method, lambda _method=method, **kwargs: call(_method, kwargs))
    return SimpleNamespace(configuration=c, ecs=ecs, ec2=ec2, calls=calls, changes=changes, ids=ids, at=at, task_id=task_id,
        reader=lambda **kw: ProductServicePairDiscovery(configuration=c, ecs_client=ecs, ec2_client=ec2, enabled=True, **kw))

class DiscoveryTests(unittest.TestCase):
    def test_closed_prelaunch_service_schema_and_default_hold(self):
        f = fixture()
        self.assertFalse(parse_service_pair_configuration(f.configuration)['owner']['allowPrimaryInProgress'])
        r = ProductServicePairDiscovery(configuration=f.configuration, ecs_client=f.ecs, ec2_client=f.ec2)
        with self.assertRaises(Exception):
            r.read(deadline_ms=f.at+1000)
        self.assertEqual(f.calls, [])
        for key, value in (('taskArn', f.task_id('owner')), ('createdAtMs', f.at-1), ('subnetId', 'subnet-12345678'), ('allowPrimaryInProgress', 'true')):
            c = copy.deepcopy(f.configuration); c['owner'][key] = value
            with self.assertRaises(Exception):
                parse_service_pair_configuration(c)
        for key in ('owner_task_arn', 'proxy_task_arn'):
            v = peer_template(); v[key] = f.task_id('owner')
            with self.assertRaises(Exception):
                parse_owner_peer_template(v)

    def test_real_source_reader_compiles_policy_only_from_fresh_pair_and_never_caches(self):
        f, r = fixture(), None
        r = f.reader(); a = r.read(deadline_ms=f.at+1000); p = compile_owner_peer(peer_template(), a)
        self.assertEqual((p.owner_task_arn, p.proxy_task_arn), (f.task_id('owner'), f.task_id('proxy')))
        r.assert_transport(p, '10.40.4.1', '10.40.4.2', f.configuration['expiresAtMs'], 'reviewed-v1')
        self.assertEqual(len(f.calls), 10)
        a['owner']['taskArn'] = 'foreign'
        self.assertEqual(r.read(deadline_ms=f.at+1000)['owner']['taskArn'], p.owner_task_arn)
        self.assertEqual(len(f.calls), 20)
        for owner, proxy in (('10.40.4.9', '10.40.4.2'), ('10.40.4.1', '10.40.4.9')):
            with self.assertRaises(Exception):
                r.assert_transport(p, owner, proxy, f.configuration['expiresAtMs'], 'reviewed-v1')

    def test_foreign_service_roles_image_rollout_task_and_network_denials(self):
        cases = (
            ('describe_services', lambda v: v['services'][1].update(serviceArn=PREFIX+'service/capiro-dev/foreign')),
            ('describe_services', lambda v: v['services'][1].update(pendingCount=1)),
            ('describe_services', lambda v: v['services'][1].update(desiredCount=True)),
            ('describe_services', lambda v: v['services'][1]['deployments'][0].update(rolloutState='IN_PROGRESS')),
            ('describe_services', lambda v: v['services'][1]['deployments'].append(copy.deepcopy(v['services'][1]['deployments'][0]))),
            ('describe_task_definition', lambda v: v['taskDefinition'].update(taskRoleArn='arn:aws:iam::967807252336:role/foreign')),
            ('describe_task_definition', lambda v: v['taskDefinition'].update(executionRoleArn='arn:aws:iam::967807252336:role/foreign')),
            ('describe_task_definition', lambda v: v['taskDefinition']['containerDefinitions'][0].update(image='foreign:latest')),
            ('describe_tasks', lambda v: v['tasks'][1].update(startedBy='ecs-svc/9')),
            ('describe_tasks', lambda v: v['tasks'][1].update(lastStatus='PENDING')),
            ('describe_tasks', lambda v: v['tasks'][1]['overrides']['containerOverrides'][1].update(command=['unsafe'])),
            ('describe_tasks', lambda v: v['tasks'][1]['overrides']['containerOverrides'][0].update(environment=[{'name': 'X', 'value': '1'}])),
            ('describe_tasks', lambda v: v['tasks'][1]['overrides']['containerOverrides'].append({'name': 'foreign'})),
            ('describe_tasks', lambda v: v['tasks'][1]['overrides'].update(inferenceAcceleratorOverrides=[{'deviceName': 'x', 'deviceType': 'eia2.medium'}])),
            ('describe_tasks', lambda v: v['tasks'][1]['overrides'].update(cpu='4096')),
            ('describe_tasks', lambda v: v['tasks'][1]['containers'][1].update(imageDigest='sha256:'+'f'*64)),
            ('describe_network_interfaces', lambda v: v['NetworkInterfaces'][1].update(VpcId='vpc-99999999')),
            ('describe_network_interfaces', lambda v: v['NetworkInterfaces'][1].update(Association={'PublicIp': '203.0.113.1'})),
            ('describe_network_interfaces', lambda v: v['NetworkInterfaces'][1].update(Groups=[{'GroupId': 'sg-99999999'}])),
        )
        for method, mutate in cases:
            with self.subTest(method=method, mutate=mutate):
                f = fixture()
                def change(v, _, mutate=mutate):
                    mutate(v); return v
                f.changes[method] = change
                with self.assertRaisesRegex(Exception, 'PRODUCT_SERVICE_PAIR_DENIED'):
                    f.reader().read(deadline_ms=f.at+1000)

    def test_explicit_inprogress_and_bounded_service_inventory(self):
        f = fixture(); f.configuration['owner']['allowPrimaryInProgress'] = True
        def inprogress(v, _):
            v['services'][1]['deployments'][0]['rolloutState'] = 'IN_PROGRESS'; return v
        f.changes['describe_services'] = inprogress
        f.reader().read(deadline_ms=f.at+1000)
        for mode in ('duplicate', 'empty', 'repeated-token', 'foreign'):
            f = fixture()
            f.changes['list_tasks'] = lambda v, _, mode=mode: ({'taskArns': v['taskArns']*2} if mode == 'duplicate' else
                {'taskArns': []} if mode == 'empty' else {'taskArns': [], 'nextToken': 'repeat'} if mode == 'repeated-token' else {'taskArns': ['foreign']})
            with self.assertRaises(Exception):
                f.reader().read(deadline_ms=f.at+1000)
            self.assertLessEqual(len(f.calls), 3)

    def test_replacement_drift_and_reversed_clock_never_restore_old_pair(self):
        f = fixture(); r = f.reader(); r.read(deadline_ms=f.at+1000); f.ids['proxy'] = '3'
        with self.assertRaises(Exception):
            r.read(deadline_ms=f.at+1000)
        self.assertFalse(r.available); count = len(f.calls); f.ids['proxy'] = '2'
        with self.assertRaises(Exception):
            r.read(deadline_ms=f.at+1000)
        self.assertEqual(len(f.calls), count)
        f = fixture(); at = [f.at]; r = f.reader(now_ms=lambda: at[0])
        def reverse(v, _):
            at[0] -= 1; return v
        f.changes['describe_services'] = reverse
        with self.assertRaises(Exception):
            r.read(deadline_ms=f.at+1000)

    def test_final_service_and_membership_rechecks_reject_midproof_replacement(self):
        for mode in ('membership', 'deployment'):
            f = fixture(); seen = [0]
            def change(v, kwargs):
                if mode == 'deployment':
                    seen[0] += 1
                    if seen[0] == 2:
                        v['services'][1]['deployments'][0]['id'] = 'ecs-svc/99'
                elif kwargs['serviceName'] == 'meri-owner':
                    seen[0] += 1
                    if seen[0] == 2:
                        v['taskArns'] = [f.task_id('proxy')]
                return v
            f.changes['list_tasks' if mode == 'membership' else 'describe_services'] = change
            with self.assertRaisesRegex(Exception, 'PRODUCT_SERVICE_PAIR_DENIED'):
                f.reader().read(deadline_ms=f.at+1000)

    def test_queue_wait_consumes_original_deadline_before_any_sdk_command(self):
        f = fixture(); r = f.reader(); r._read_lock.acquire()
        try:
            with self.assertRaisesRegex(Exception, 'PRODUCT_SERVICE_PAIR_DENIED'):
                r.read(deadline_ms=time.time_ns()//1000000+10)
            self.assertEqual(f.calls, [])
        finally:
            r._read_lock.release()
        self.assertTrue(r.available)

    def test_pending_native_call_abort_prevents_late_followup_commands(self):
        f = fixture(); entered, release = threading.Event(), threading.Event(); errors = []
        def pending(v, _):
            entered.set(); release.wait(1); return v
        f.changes['describe_services'] = pending; r = f.reader()
        def run():
            try:
                r.read(deadline_ms=f.at+1000)
            except Exception as error:
                errors.append(error)
        worker = threading.Thread(target=run)
        try:
            worker.start(); self.assertTrue(entered.wait(.5)); r.abort(); release.set(); worker.join(.5)
            self.assertFalse(worker.is_alive()); self.assertTrue(errors); self.assertEqual(len(f.calls), 1); self.assertFalse(r.available)
        finally:
            release.set(); worker.join(1)

if __name__ == '__main__':
    unittest.main()
