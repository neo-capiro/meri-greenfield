"""Approved service-pair selection using borrowed task-role SDK clients only.

No original runner placement, database, credentials or TLS identity is created.
Revision/certificate pins are configuration custody, not AWS attestation.
Blocking SDK calls run only inside the caller's owned native-work deadline;
abort retires future commands without claiming an in-flight call has stopped.
"""
import copy
from datetime import datetime
import ipaddress
import re
import threading
import time
from ..qualification.state.pricing import StateDenied

_PREFIX = 'arn:aws:ecs:us-east-1:967807252336:'
_IAM = 'arn:aws:iam::967807252336:role/'

def _deny():
    raise StateDenied('PRODUCT_SERVICE_PAIR_DENIED')

def _closed(value, required, optional=()):
    if type(value) is not dict or not set(required) <= value.keys() or value.keys() - set(required) - set(optional):
        _deny()
    return value

def _matches(pattern, value):
    return type(value) is str and re.fullmatch(pattern, value, flags=re.ASCII) is not None

def _instant(value):
    return type(value) is int and 0 < value <= 9007199254740991

def _same_set(value, expected):
    return type(value) is list and len(value) == len(expected) and len(set(value)) == len(value) and set(value) == set(expected)

def parse_service_pair_configuration(raw):
    try:
        c = copy.deepcopy(_closed(raw, ('schemaVersion', 'deploymentRevision', 'expiresAtMs', 'ownerCertSha256', 'proxyCertSha256', 'owner', 'proxy')))
        if (type(c['schemaVersion']) is not int or c['schemaVersion'] != 2 or not _instant(c['expiresAtMs'])
                or not _matches(r'[A-Za-z0-9_-]{1,128}', c['deploymentRevision'])
                or not all(_matches(r'[a-f0-9]{64}', c[k]) for k in ('ownerCertSha256', 'proxyCertSha256'))
                or c['ownerCertSha256'] == c['proxyCertSha256']):
            _deny()
        for role in ('owner', 'proxy'):
            p = _closed(c[role], ('clusterArn', 'serviceArn', 'taskDefinitionArn', 'containerName', 'imageUri',
                'taskRoleArn', 'executionRoleArn', 'vpcId', 'subnetIds', 'securityGroupIds'), ('allowPrimaryInProgress',))
            cluster = p['clusterArn'][len(_PREFIX+'cluster/'):] if type(p['clusterArn']) is str else ''
            service_prefix = _PREFIX+'service/'+cluster+'/'
            service = p['serviceArn'][len(service_prefix):] if type(p['serviceArn']) is str else ''
            if (p['clusterArn'] != _PREFIX+'cluster/'+cluster or not _matches(r'[A-Za-z0-9_-]{1,255}', cluster)
                    or p['serviceArn'] != service_prefix+service or not _matches(r'[A-Za-z0-9_-]{1,255}', service)
                    or not _matches(re.escape(_PREFIX)+r'task-definition/[A-Za-z0-9_-]+:[1-9][0-9]*', p['taskDefinitionArn'])
                    or not _matches(r'[A-Za-z0-9_-]{1,255}', p['containerName'])
                    or not _matches(r'967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com/[a-z0-9]+(?:[._/-][a-z0-9]+)*@sha256:[a-f0-9]{64}', p['imageUri'])
                    or not all(_matches(re.escape(_IAM)+r'[A-Za-z0-9_+=,.@/-]{1,512}', p[k]) for k in ('taskRoleArn', 'executionRoleArn'))
                    or not _matches(r'vpc-[a-f0-9]{8,17}', p['vpcId']) or type(p.get('allowPrimaryInProgress', False)) is not bool):
                _deny()
            for key, kind, maximum in (('subnetIds', 'subnet', 16), ('securityGroupIds', 'sg', 5)):
                values = p[key]
                if (type(values) is not list or not 1 <= len(values) <= maximum
                        or not all(_matches(kind+r'-[a-f0-9]{8,17}', v) for v in values) or len(set(values)) != len(values)):
                    _deny()
            p['allowPrimaryInProgress'] = p.get('allowPrimaryInProgress', False)
        a, b = c['owner'], c['proxy']
        if a['serviceArn'] == b['serviceArn'] or a['clusterArn'] != b['clusterArn'] or a['vpcId'] != b['vpcId']:
            _deny()
        return c
    except Exception:
        _deny()

def parse_owner_peer_template(raw):
    v = copy.deepcopy(_closed(raw, ('origin', 'server_name', 'server_cert_sha256', 'server_issuer_sha256',
        'client_cert_sha256', 'client_subject', 'max_exchange_ms')))
    if (not _matches(r'[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?', v['server_name'])
            or v['origin'] != 'https://'+v['server_name']+':8444'
            or not all(_matches(r'[a-f0-9]{64}', v[k]) for k in ('server_cert_sha256', 'server_issuer_sha256', 'client_cert_sha256'))
            or v['server_cert_sha256'] == v['client_cert_sha256'] or not _matches(r'[A-Za-z0-9_-]{1,128}', v['client_subject'])
            or type(v['max_exchange_ms']) is not int or not 1 <= v['max_exchange_ms'] <= 3000):
        _deny()
    return v

def compile_owner_peer(template, pair):
    from .owner_channel import OwnerPeerPolicy
    return OwnerPeerPolicy(**parse_owner_peer_template(template), owner_task_arn=pair['owner']['taskArn'], proxy_task_arn=pair['proxy']['taskArn'])

def _private(value):
    if type(value) is not str:
        _deny()
    address = ipaddress.IPv4Address(value)
    if str(address) != value or not any(address in ipaddress.IPv4Network(n) for n in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')):
        _deny()
    return value

def _service(reply, pin):
    rows = reply.get('services')
    if type(rows) is not list or len(rows) != 2 or reply.get('failures', []) != []:
        _deny()
    rows = [v for v in rows if v.get('serviceArn') == pin['serviceArn']]
    if len(rows) != 1:
        _deny()
    s = rows[0]
    if (s.get('clusterArn') != pin['clusterArn'] or s.get('serviceName') != pin['serviceArn'].split('/')[-1]
            or s.get('status') != 'ACTIVE' or s.get('taskDefinition') != pin['taskDefinitionArn']
            or any(type(s.get(k)) is not int or s[k] != v for k, v in (('desiredCount', 1), ('runningCount', 1), ('pendingCount', 0)))
            or s.get('launchType') != 'FARGATE' or s.get('platformVersion') != '1.4.0' or s.get('enableExecuteCommand') is not False):
        _deny()
    ds = s.get('deployments')
    if type(ds) is not list or not 1 <= len(ds) <= 8:
        _deny()
    primary = [d for d in ds if d.get('status') == 'PRIMARY']
    if len(primary) != 1:
        _deny()
    d = primary[0]
    if (not _matches(r'ecs-svc/[0-9]{1,32}', d.get('id')) or d.get('taskDefinition') != pin['taskDefinitionArn']
            or any(type(d.get(k)) is not int or d[k] != v for k, v in (('desiredCount', 1), ('runningCount', 1), ('pendingCount', 0)))
            or not (d.get('rolloutState') == 'COMPLETED' or pin['allowPrimaryInProgress'] and d.get('rolloutState') == 'IN_PROGRESS')
            or any(any(type(v.get(k)) is not int or v[k] != 0 for k in ('desiredCount', 'runningCount', 'pendingCount')) for v in ds if v is not d)):
        _deny()
    net = s.get('networkConfiguration', {}).get('awsvpcConfiguration', {})
    if net.get('assignPublicIp') != 'DISABLED' or not _same_set(net.get('subnets'), pin['subnetIds']) or not _same_set(net.get('securityGroups'), pin['securityGroupIds']):
        _deny()
    return d['id']

def _definition(reply, p):
    d = reply.get('taskDefinition', {})
    if (d.get('taskDefinitionArn') != p['taskDefinitionArn'] or d.get('status') != 'ACTIVE' or d.get('networkMode') != 'awsvpc'
            or 'FARGATE' not in d.get('requiresCompatibilities', []) or d.get('taskRoleArn') != p['taskRoleArn'] or d.get('executionRoleArn') != p['executionRoleArn']):
        _deny()
    rows = d.get('containerDefinitions')
    if type(rows) is not list or not 1 <= len(rows) <= 10:
        _deny()
    rows = [v for v in rows if v.get('name') == p['containerName']]
    if len(rows) != 1 or rows[0].get('image') != p['imageUri'] or rows[0].get('essential') is not True:
        _deny()

def _task(t, p, task_id, deployment, at):
    created = t.get('createdAt')
    if (t.get('taskArn') != task_id or t.get('clusterArn') != p['clusterArn'] or t.get('taskDefinitionArn') != p['taskDefinitionArn']
            or t.get('group') != 'service:'+p['serviceArn'].split('/')[-1] or t.get('startedBy') != deployment
            or not isinstance(created, datetime) or created.tzinfo is None or not 0 < created.timestamp()*1000 <= at
            or t.get('launchType') != 'FARGATE' or t.get('platformFamily') != 'Linux' or t.get('platformVersion') != '1.4.0'
            or t.get('enableExecuteCommand') is not False or t.get('lastStatus') != 'RUNNING' or t.get('desiredStatus') != 'RUNNING'):
        _deny()
    # Live DescribeTasks always reports `inferenceAcceleratorOverrides: []` and one name-only containerOverrides
    # entry per task container (material-init included). Name-only entries for the task's own containers and an
    # empty accelerator list override nothing; any field beyond `name`, a foreign name or an accelerator still denies.
    o = _closed(t.get('overrides', {}), (), ('taskRoleArn', 'executionRoleArn', 'containerOverrides', 'inferenceAcceleratorOverrides'))
    if any(k in o and o[k] != p[k] for k in ('taskRoleArn', 'executionRoleArn')):
        _deny()
    if 'inferenceAcceleratorOverrides' in o and o['inferenceAcceleratorOverrides'] != []:
        _deny()
    if 'containerOverrides' in o:
        own_names = {v.get('name') for v in t.get('containers') or () if type(v) is dict}
        if type(o['containerOverrides']) is not list or any(_closed(v, ('name',))['name'] not in own_names for v in o['containerOverrides']):
            _deny()
    rows = t.get('containers')
    if type(rows) is not list or any(not _matches(r'[A-Za-z0-9_-]{1,255}', v.get('name')) for v in rows) or len({v['name'] for v in rows}) != len(rows):
        _deny()
    rows = [v for v in rows if v['name'] == p['containerName']]
    if len(rows) != 1:
        _deny()
    c = rows[0]
    container_prefix = p['clusterArn'].replace('cluster/', 'container/')+'/'+task_id.split('/')[-1]+'/'
    if (c.get('lastStatus') != 'RUNNING' or c.get('image') != p['imageUri'] or c.get('imageDigest') != p['imageUri'].split('@')[1]
            or c.get('taskArn', task_id) != task_id or not _matches(re.escape(container_prefix)+r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', c.get('containerArn'))):
        _deny()
    attachments = [a for a in t.get('attachments', []) if a.get('type') == 'ElasticNetworkInterface']
    if len(attachments) != 1 or attachments[0].get('status') != 'ATTACHED' or type(attachments[0].get('details')) is not list:
        _deny()
    details = {}
    for v in attachments[0]['details']:
        if type(v.get('name')) is not str or type(v.get('value')) is not str or v['name'] in details:
            _deny()
        details[v['name']] = v['value']
    eni, subnet, ip = details.get('networkInterfaceId'), details.get('subnetId'), _private(details.get('privateIPv4Address'))
    if (not _matches(r'eni-[a-f0-9]{8,17}', eni) or subnet not in p['subnetIds'] or 'networkInterfaces' in c
            and (type(c['networkInterfaces']) is not list or len(c['networkInterfaces']) != 1 or c['networkInterfaces'][0].get('privateIpv4Address') != ip)):
        _deny()
    return {'taskArn': task_id, 'createdAtMs': int(created.timestamp()*1000), 'privateIpv4Address': ip, 'eni': eni, 'subnet': subnet}

def _network(n, v, p):
    if (n.get('NetworkInterfaceId') != v['eni'] or n.get('SubnetId') != v['subnet'] or n.get('VpcId') != p['vpcId']
            or n.get('PrivateIpAddress') != v['privateIpv4Address'] or n.get('OwnerId') != '967807252336' or n.get('Status') != 'in-use'
            or n.get('Attachment', {}).get('Status') != 'attached' or any(k in n.get('Association', {}) for k in ('PublicIp', 'CarrierIp'))
            or not _same_set([g.get('GroupId') for g in n.get('Groups', [])], p['securityGroupIds']) or n.get('Ipv6Addresses', []) != []):
        _deny()
    rows = n.get('PrivateIpAddresses')
    if type(rows) is not list or not rows or any(any(k in r.get('Association', {}) for k in ('PublicIp', 'CarrierIp')) for r in rows):
        _deny()
    ips = [_private(r.get('PrivateIpAddress')) for r in rows]
    if len(set(ips)) != len(ips) or v['privateIpv4Address'] not in ips:
        _deny()

class ProductServicePairDiscovery:
    def __init__(self, *, configuration, ecs_client, ec2_client, now_ms=None, max_request_ms=3000, max_lease_ms=30000, enabled=False):
        self._pins = parse_service_pair_configuration(configuration)
        self._now = now_ms if now_ms is not None else (lambda: time.time_ns()//1000000)
        if (type(enabled) is not bool or type(max_request_ms) is not int or not 1 <= max_request_ms <= 3000
                or type(max_lease_ms) is not int or not 1 <= max_lease_ms <= 30000 or not callable(self._now)):
            _deny()
        self._ecs, self._ec2 = ecs_client, ec2_client
        for client, methods in ((ecs_client, ('describe_services', 'list_tasks', 'describe_task_definition', 'describe_tasks')), (ec2_client, ('describe_network_interfaces',))):
            if any(not callable(getattr(client, name, None)) for name in methods):
                _deny()
        self._enabled, self._retired, self._active = enabled, False, 0
        self._max_request_ms, self._max_lease_ms = max_request_ms, max_lease_ms
        self._state, self._read_lock, self._identity = threading.Lock(), threading.Lock(), None

    @property
    def available(self):
        return self._enabled and not self._retired and self._now() < self._pins['expiresAtMs']

    def abort(self):
        with self._state:
            self._retired = True

    def assert_transport(self, policy, owner_ipv4, proxy_ipv4, expires_at_ms, revision):
        # The expected socket pair is compiled from this reader's admitted
        # startup snapshot, never a server body, header or prelaunch task ID.
        with self._state:
            identity = self._identity
            if (not self.available or identity is None or revision != self._pins['deploymentRevision']
                    or expires_at_ms != self._pins['expiresAtMs']
                    or policy.server_cert_sha256 != self._pins['ownerCertSha256']
                    or policy.client_cert_sha256 != self._pins['proxyCertSha256']
                    or (policy.owner_task_arn, owner_ipv4) != (identity[0][0], identity[0][2])
                    or (policy.proxy_task_arn, proxy_ipv4) != (identity[1][0], identity[1][2])):
                _deny()

    async def aclose(self):
        self.abort()
        if self._active:
            raise StateDenied('PRODUCT_PROXY_CLEANUP_UNKNOWN')

    def read(self, *, deadline_ms):
        acquired = False
        try:
            at = self._now()
            if not self.available or not _instant(at) or not _instant(deadline_ms) or deadline_ms <= at:
                _deny()
            cutoff = min(deadline_ms, self._pins['expiresAtMs'], at+self._max_request_ms)
            monotonic_cutoff = time.monotonic()+(cutoff-at)/1000
            def check():
                if not self.available or self._now() < at or self._now() >= cutoff or time.monotonic() >= monotonic_cutoff:
                    _deny()
            acquired = self._read_lock.acquire(timeout=max(0, monotonic_cutoff-time.monotonic()))
            if not acquired:
                _deny()
            def call(client, method, **kwargs):
                check()
                with self._state:
                    if self._retired:
                        _deny()
                    self._active += 1
                try:
                    result = getattr(client, method)(**kwargs)
                finally:
                    with self._state:
                        self._active -= 1
                check()
                if type(result) is not dict:
                    _deny()
                return result
            pins = self._pins
            def services():
                reply = call(self._ecs, 'describe_services', cluster=pins['owner']['clusterArn'], services=[pins[r]['serviceArn'] for r in ('owner', 'proxy')])
                return {r: _service(reply, pins[r]) for r in ('owner', 'proxy')}
            def member(p):
                ids, tokens, token = set(), set(), None
                for _ in range(4):
                    reply = call(self._ecs, 'list_tasks', cluster=p['clusterArn'], serviceName=p['serviceArn'].split('/')[-1], desiredStatus='RUNNING', maxResults=100, **({'nextToken': token} if token else {}))
                    values = reply.get('taskArns')
                    if type(values) is not list or len(values) > 100:
                        _deny()
                    for v in values:
                        if not _matches(re.escape(p['clusterArn'].replace('cluster/', 'task/'))+r'/[a-f0-9]{32}', v) or v in ids:
                            _deny()
                        ids.add(v)
                        if len(ids) > 1:
                            _deny()
                    token = reply.get('nextToken')
                    if token is None:
                        if len(ids) != 1:
                            _deny()
                        return next(iter(ids))
                    if type(token) is not str or not 1 <= len(token) <= 1024 or token in tokens:
                        _deny()
                    tokens.add(token)
                _deny()
            first = services()
            ids = {r: member(pins[r]) for r in ('owner', 'proxy')}
            if len(set(ids.values())) != 2:
                _deny()
            for r in ('owner', 'proxy'):
                _definition(call(self._ecs, 'describe_task_definition', taskDefinition=pins[r]['taskDefinitionArn']), pins[r])
            reply = call(self._ecs, 'describe_tasks', cluster=pins['owner']['clusterArn'], tasks=list(ids.values()), include=['TAGS'])
            rows = reply.get('tasks')
            if type(rows) is not list or len(rows) != 2 or len({t.get('taskArn') for t in rows}) != 2 or reply.get('failures', []) != []:
                _deny()
            tasks = {t.get('taskArn'): t for t in rows}
            pair = {r: _task(tasks[ids[r]], pins[r], ids[r], first[r], at) for r in ('owner', 'proxy')}
            if pair['owner']['eni'] == pair['proxy']['eni'] or pair['owner']['privateIpv4Address'] == pair['proxy']['privateIpv4Address']:
                _deny()
            reply = call(self._ec2, 'describe_network_interfaces', NetworkInterfaceIds=[pair[r]['eni'] for r in ('owner', 'proxy')])
            rows = reply.get('NetworkInterfaces')
            if type(rows) is not list or len(rows) != 2 or len({n.get('NetworkInterfaceId') for n in rows}) != 2:
                _deny()
            networks = {n.get('NetworkInterfaceId'): n for n in rows}
            for r in ('owner', 'proxy'):
                _network(networks[pair[r]['eni']], pair[r], pins[r])
            if services() != first or any(member(pins[r]) != ids[r] for r in ('owner', 'proxy')):
                _deny()
            check()
            identity = tuple(tuple(pair[r][k] for k in ('taskArn', 'createdAtMs', 'privateIpv4Address')) for r in ('owner', 'proxy'))
            with self._state:
                if self._retired or self._identity is not None and self._identity != identity:
                    self._retired = True
                    _deny()
                self._identity = identity
            checked = self._now()
            if not _instant(checked) or checked < at or checked >= cutoff:
                _deny()
            return {**{r: {k: pair[r][k] for k in ('taskArn', 'createdAtMs', 'privateIpv4Address')} for r in ('owner', 'proxy')},
                'checkedAtMs': checked, 'expiresAtMs': min(pins['expiresAtMs'], deadline_ms, checked+self._max_lease_ms)}
        except Exception:
            _deny()
        finally:
            if acquired:
                self._read_lock.release()
