"""Approved service-pair selection using borrowed task-role SDK clients only.

No original runner placement, database, credentials or TLS identity is created.
Revision/certificate pins are configuration custody, not AWS attestation.
Blocking SDK calls run only inside the caller's owned native-work deadline;
abort retires future commands without claiming an in-flight call has stopped.
"""
from concurrent.futures import ThreadPoolExecutor, wait
import copy
from datetime import datetime
import ipaddress
import re
import threading
import time
from ..qualification.state.pricing import StateDenied
from . import refusal_diagnostics as diagnostics
from . import telemetry_context as telemetry
from .budgets import MAX_OWNER_EXCHANGE_MS, PAIR_LEASE_TTL_MS

_PREFIX = 'arn:aws:ecs:us-east-1:967807252336:'
_IAM = 'arn:aws:iam::967807252336:role/'

class PairProofError(StateDenied):
    """Content-free distinction between absent evidence and contradictory evidence."""
    def __init__(self, code):
        if code not in ('PAIR_UNAVAILABLE', 'PAIR_DRIFT', 'PAIR_REPROVING'):
            raise ValueError('PAIR_CODE')
        self.code = code
        super().__init__(code)


def _unavailable():
    raise PairProofError('PAIR_UNAVAILABLE')


def _drift():
    raise PairProofError('PAIR_DRIFT')


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
            or type(v['max_exchange_ms']) is not int or not 1 <= v['max_exchange_ms'] <= MAX_OWNER_EXCHANGE_MS):
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

def _service(s, pin, *, partner=False):
    # A replacement may change the partner's availability, never its pins. Keep
    # the own service strict and inspect every deployment, including drainers.
    if (s.get('clusterArn') != pin['clusterArn'] or s.get('serviceName') != pin['serviceArn'].split('/')[-1]
            or s.get('status') != 'ACTIVE' or s.get('taskDefinition') != pin['taskDefinitionArn']
            or type(s.get('desiredCount')) is not int or s['desiredCount'] != 1
            or any(type(s.get(k)) is not int or s[k] < 0 for k in ('runningCount', 'pendingCount'))
            or s.get('launchType') != 'FARGATE' or s.get('platformVersion') != '1.4.0' or s.get('enableExecuteCommand') is not False):
        _deny()
    net = s.get('networkConfiguration', {}).get('awsvpcConfiguration', {})
    if net.get('assignPublicIp') != 'DISABLED' or not _same_set(net.get('subnets'), pin['subnetIds']) or not _same_set(net.get('securityGroups'), pin['securityGroupIds']):
        _deny()
    ds = s.get('deployments')
    if type(ds) is not list or not 1 <= len(ds) <= 8:
        _deny()
    if any(type(d) is not dict or not _matches(r'ecs-svc/[0-9]{1,32}', d.get('id'))
           or d.get('taskDefinition') != pin['taskDefinitionArn']
           or d.get('status') not in ('PRIMARY', 'ACTIVE', 'INACTIVE')
           or any(type(d.get(k)) is not int or d[k] < 0 for k in ('desiredCount', 'runningCount', 'pendingCount')) for d in ds):
        _deny()
    primary = [d for d in ds if d['status'] == 'PRIMARY']
    if len(primary) != 1 or len({d['id'] for d in ds}) != len(ds):
        _deny()
    d = primary[0]
    others = [v for v in ds if v is not d]
    if d['desiredCount'] != 1 or d.get('rolloutState') not in ('COMPLETED', 'IN_PROGRESS'):
        _deny()
    quiet = all(v['runningCount'] == v['pendingCount'] == 0 and
                (v['desiredCount'] == 0 or partner and d['rolloutState'] == 'IN_PROGRESS'
                 and v['status'] == 'ACTIVE' and v['desiredCount'] == 1) for v in others)
    stable = (s['runningCount'] == d['runningCount'] == 1 and s['pendingCount'] == d['pendingCount'] == 0 and quiet)
    rolling = False
    if not partner:
        if not stable or d['rolloutState'] != 'COMPLETED' and not pin['allowPrimaryInProgress']:
            _deny()
    else:
        rolling = (d['rolloutState'] == 'IN_PROGRESS' and any(v['status'] == 'ACTIVE' for v in others)
                   and all(v['desiredCount'] <= 1 and v['pendingCount'] == 0 and v['runningCount'] <= 1
                           and (v['runningCount'] == 0 or v['status'] == 'ACTIVE') for v in others)
                   and sum(v['runningCount'] for v in others) <= 1)
        if (s['runningCount'] > (2 if rolling else 1) or s['pendingCount'] > 1
                or d['runningCount'] > 1 or d['pendingCount'] > 1 or not quiet and not rolling
                or s['runningCount'] == 1 and s['pendingCount'] == 1 and not rolling):
            _deny()
    return {'deploymentId': d['id'], 'deploymentIds': tuple(v['id'] for v in ds),
            'transitional': not stable, 'rolling': rolling}

def _definition(reply, p):
    d = reply.get('taskDefinition')
    if type(d) is not dict or not d:
        _unavailable()
    if (d.get('taskDefinitionArn') != p['taskDefinitionArn'] or d.get('status') != 'ACTIVE' or d.get('networkMode') != 'awsvpc'
            or 'FARGATE' not in d.get('requiresCompatibilities', []) or d.get('taskRoleArn') != p['taskRoleArn'] or d.get('executionRoleArn') != p['executionRoleArn']):
        _deny()
    rows = d.get('containerDefinitions')
    if type(rows) is not list or not 1 <= len(rows) <= 10:
        _deny()
    rows = [v for v in rows if v.get('name') == p['containerName']]
    if len(rows) != 1 or rows[0].get('image') != p['imageUri'] or rows[0].get('essential') is not True:
        _deny()

def _task(t, p, task_id, service, at, *, partner=False):
    pending = partner and t.get('lastStatus') in ('PROVISIONING', 'PENDING', 'ACTIVATING')
    matches = lambda row, key, expected: pending and key not in row or type(row.get(key)) is type(expected) and row.get(key) == expected
    deployments = service['deploymentIds'] if partner and service['rolling'] else (service['deploymentId'],)
    created = t.get('createdAt')
    if (t.get('taskArn') != task_id or t.get('clusterArn') != p['clusterArn'] or t.get('taskDefinitionArn') != p['taskDefinitionArn']
            or t.get('group') != 'service:'+p['serviceArn'].split('/')[-1] or t.get('startedBy') not in deployments
            or not (pending and 'createdAt' not in t) and
               (not isinstance(created, datetime) or created.tzinfo is None or not 0 < created.timestamp()*1000 <= at)
            or not matches(t, 'launchType', 'FARGATE') or not matches(t, 'platformFamily', 'Linux')
            or not matches(t, 'platformVersion', '1.4.0') or not matches(t, 'enableExecuteCommand', False)
            or not pending and t.get('lastStatus') != 'RUNNING' or t.get('desiredStatus') != 'RUNNING'):
        _deny()
    # A pending task may not have received its container/ENI metadata. Absence
    # withholds proof; every present role, image and network contradiction wins.
    rows = t.get('containers', [] if pending else None)
    if (type(rows) is not list or any(type(v) is not dict or not _matches(r'[A-Za-z0-9_-]{1,255}', v.get('name')) for v in rows)
            or len({v['name'] for v in rows}) != len(rows)):
        _deny()
    o = _closed(t.get('overrides', {}), (), ('taskRoleArn', 'executionRoleArn', 'containerOverrides', 'inferenceAcceleratorOverrides'))
    if any(k in o and o[k] != p[k] for k in ('taskRoleArn', 'executionRoleArn')):
        _deny()
    if 'inferenceAcceleratorOverrides' in o and o['inferenceAcceleratorOverrides'] != []:
        _deny()
    if 'containerOverrides' in o:
        own_names = {v['name'] for v in rows}
        if type(o['containerOverrides']) is not list or any(
                not _matches(r'[A-Za-z0-9_-]{1,255}', _closed(v, ('name',))['name'])
                or not (pending and not rows) and v['name'] not in own_names for v in o['containerOverrides']):
            _deny()
    matched = [v for v in rows if v['name'] == p['containerName']]
    if len(matched) > 1 or not pending and len(matched) != 1:
        _deny()
    c = matched[0] if matched else {}
    container_prefix = p['clusterArn'].replace('cluster/', 'container/')+'/'+task_id.split('/')[-1]+'/'
    if (not pending and c.get('lastStatus') != 'RUNNING' or not matches(c, 'image', p['imageUri'])
            or not matches(c, 'imageDigest', p['imageUri'].split('@')[1]) or c.get('taskArn', task_id) != task_id
            or not (pending and 'containerArn' not in c) and
               not _matches(re.escape(container_prefix)+r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', c.get('containerArn'))):
        _deny()
    attachments = t.get('attachments', [])
    if type(attachments) is not list or any(type(a) is not dict for a in attachments):
        _deny()
    attachments = [a for a in attachments if a.get('type') == 'ElasticNetworkInterface']
    if (len(attachments) > 1 or not pending and len(attachments) != 1
            or attachments and attachments[0].get('status') not in (('ATTACHED', 'PRECREATED', 'ATTACHING') if pending else ('ATTACHED',))):
        _deny()
    raw_details = attachments[0].get('details', [] if pending else None) if attachments else []
    if type(raw_details) is not list:
        _deny()
    details = {}
    for value in raw_details:
        if (type(value) is not dict or type(value.get('name')) is not str or type(value.get('value')) is not str
                or value['name'] in details or value['name'] in ('publicIPv4Address', 'publicIpAddress')):
            _deny()
        details[value['name']] = value['value']
    eni, subnet, raw_ip = details.get('networkInterfaceId'), details.get('subnetId'), details.get('privateIPv4Address')
    ip = None if pending and raw_ip is None else _private(raw_ip)
    if ((not pending or eni is not None) and not _matches(r'eni-[a-f0-9]{8,17}', eni)
            or (not pending or subnet is not None) and subnet not in p['subnetIds']):
        _deny()
    if 'networkInterfaces' in c:
        interfaces = c['networkInterfaces']
        if (type(interfaces) is not list or len(interfaces) > 1 or not pending and len(interfaces) != 1
                or any(type(v) is not dict or any(k in v for k in ('publicIpv4Address', 'publicIPv4Address', 'publicIpAddress'))
                       or _private(v.get('privateIpv4Address')) != (ip or v.get('privateIpv4Address')) for v in interfaces)):
            _deny()
    return {'taskArn': task_id, 'createdAtMs': int(created.timestamp()*1000) if created is not None else None,
            'running': not pending, 'primary': t.get('startedBy') == service['deploymentId'],
            'privateIpv4Address': ip, 'eni': eni, 'subnet': subnet}

def _network(n, v, p):
    pending = not v['running']
    matches = lambda key, expected: pending and key not in n or n.get(key) == expected
    if (n.get('NetworkInterfaceId') != v['eni'] or not matches('SubnetId', v['subnet'] or n.get('SubnetId'))
            or 'SubnetId' in n and n['SubnetId'] not in p['subnetIds'] or not matches('VpcId', p['vpcId'])
            or not matches('PrivateIpAddress', v['privateIpv4Address'] or n.get('PrivateIpAddress'))
            or not matches('OwnerId', '967807252336')
            or n.get('Status') not in (('in-use', 'available', None) if pending else ('in-use',))
            or n.get('Attachment', {}).get('Status') not in (('attached', 'attaching', None) if pending else ('attached',))
            or any(k in n.get('Association', {}) for k in ('PublicIp', 'CarrierIp'))
            or not (pending and 'Groups' not in n) and not _same_set([g.get('GroupId') for g in n.get('Groups', [])], p['securityGroupIds'])
            or n.get('Ipv6Addresses', []) != []):
        _deny()
    if 'PrivateIpAddress' in n:
        _private(n['PrivateIpAddress'])
    rows = n.get('PrivateIpAddresses', [] if pending else None)
    if type(rows) is not list or not pending and not rows or any(any(k in r.get('Association', {}) for k in ('PublicIp', 'CarrierIp')) for r in rows):
        _deny()
    ips = [_private(r.get('PrivateIpAddress')) for r in rows]
    if len(set(ips)) != len(ips) or v['privateIpv4Address'] is not None and v['privateIpv4Address'] not in ips:
        _deny()

def _together(pool, *reads, cutoff):
    """Bound the read phase; the caller quarantines unfinished native work."""
    futures = [pool.submit(read) for read in reads]
    done, pending = wait(futures, timeout=max(0, cutoff-time.monotonic()))
    for future in pending:
        future.cancel()
    # A contradictory observation is decisive even when another independent
    # call timed out. Argument order must never hide an observed pin failure.
    for future in futures:
        if future in done and not future.cancelled():
            error = future.exception()
            if error is not None and (not isinstance(error, PairProofError) or error.code == 'PAIR_DRIFT'):
                raise error
    if pending:
        _unavailable()
    return [future.result() for future in futures]

class ProductServicePairDiscovery:
    def __init__(self, *, configuration, ecs_client, ec2_client, now_ms=None, max_request_ms=3000, max_lease_ms=PAIR_LEASE_TTL_MS, enabled=False):
        self._pins = parse_service_pair_configuration(configuration)
        self._now = now_ms if now_ms is not None else (lambda: time.time_ns()//1000000)
        if (type(enabled) is not bool or type(max_request_ms) is not int or not 1 <= max_request_ms <= 3000
                or type(max_lease_ms) is not int or not 1 <= max_lease_ms <= PAIR_LEASE_TTL_MS or not callable(self._now)):
            _deny()
        self._ecs, self._ec2 = ecs_client, ec2_client
        for client, methods in ((ecs_client, ('describe_services', 'list_tasks', 'describe_task_definition', 'describe_tasks')), (ec2_client, ('describe_network_interfaces',))):
            if any(not callable(getattr(client, name, None)) for name in methods):
                _deny()
        self._enabled, self._retired, self._active = enabled, False, 0
        self._max_request_ms, self._max_lease_ms = max_request_ms, max_lease_ms
        self._state, self._read_lock, self._identity = threading.Lock(), threading.Lock(), None
        self._quarantined = False
        self._last_observation = None
        self._last_checked_mono_ms = None

    @property
    def available(self):
        return self._enabled and not self._retired and not self._quarantined and self._now() < self._pins['expiresAtMs']

    @property
    def quarantined(self):
        return self._quarantined

    @property
    def last_observation(self):
        return copy.deepcopy(self._last_observation)

    @property
    def pins(self):
        return copy.deepcopy(self._pins)

    @property
    def max_lease_ms(self):
        return self._max_lease_ms

    def recreate(self):
        """New proof lifecycle, same borrowed clients and immutable configuration."""
        return ProductServicePairDiscovery(configuration=self._pins, ecs_client=self._ecs,
            ec2_client=self._ec2, now_ms=self._now, max_request_ms=self._max_request_ms,
            max_lease_ms=self._max_lease_ms, enabled=self._enabled)

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
        acquired, step, cutoff, pool = False, 'unavailable', None, None
        try:
            at = self._now()
            if not self.available or not _instant(at) or not _instant(deadline_ms) or deadline_ms <= at:
                _unavailable()
            cutoff = min(deadline_ms, self._pins['expiresAtMs'], at+self._max_request_ms)
            monotonic_cutoff = time.monotonic()+(cutoff-at)/1000
            def check():
                if not self.available or self._now() < at or self._now() >= cutoff or time.monotonic() >= monotonic_cutoff:
                    _unavailable()
            step = 'lock'
            acquired = self._read_lock.acquire(timeout=max(0, monotonic_cutoff-time.monotonic()))
            if not acquired:
                _unavailable()
            def call(client, method, **kwargs):
                check()
                with self._state:
                    if self._retired or self._quarantined:
                        _unavailable()
                    self._active += 1
                try:
                    result = getattr(client, method)(**kwargs)
                except Exception:
                    _unavailable()
                finally:
                    with self._state:
                        self._active -= 1
                check()
                if type(result) is not dict:
                    _unavailable()
                return result
            pins = self._pins
            def services():
                reply = call(self._ecs, 'describe_services', cluster=pins['owner']['clusterArn'], services=[pins[r]['serviceArn'] for r in ('owner', 'proxy')])
                rows = reply.get('services')
                if type(rows) is not list:
                    _unavailable()
                expected = {pins[role]['serviceArn']: role for role in ('owner', 'proxy')}
                observations = {}
                for row in rows:
                    role = expected.get(row.get('serviceArn')) if type(row) is dict else None
                    if role is None or role in observations:
                        _drift()
                    # Validate every returned row before a missing peer/failure
                    # can turn the aggregate result into unavailable.
                    observations[role] = _service(row, pins[role], partner=role == 'owner')
                if len(observations) != 2 or reply.get('failures', []) != []:
                    _unavailable()
                return observations
            def member(p, *, partner=False):
                ids, tokens, token = set(), set(), None
                for _ in range(4):
                    reply = call(self._ecs, 'list_tasks', cluster=p['clusterArn'], serviceName=p['serviceArn'].split('/')[-1], desiredStatus='RUNNING', maxResults=100, **({'nextToken': token} if token else {}))
                    values = reply.get('taskArns')
                    if type(values) is not list:
                        _unavailable()
                    if len(values) > 100:
                        _drift()
                    for v in values:
                        if not _matches(re.escape(p['clusterArn'].replace('cluster/', 'task/'))+r'/[a-f0-9]{32}', v) or v in ids:
                            _deny()
                        ids.add(v)
                        if len(ids) > (2 if partner else 1):
                            _deny()
                    token = reply.get('nextToken')
                    if token is None:
                        if not partner and len(ids) != 1:
                            _deny()
                        return tuple(sorted(ids))
                    if type(token) is not str or not 1 <= len(token) <= 1024 or token in tokens:
                        _unavailable()
                    tokens.add(token)
                _unavailable()
            def definition(p):
                _definition(call(self._ecs, 'describe_task_definition', taskDefinition=p['taskDefinitionArn']), p)
            # Four phases instead of ten sequential round trips (5/1/1/3 calls, at most 5 at once); same reads and checks.
            pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix='meri-service-pair')
            step = 'snapshot'; diagnostics.stage('pair-snapshot')
            first, owner_id, proxy_id, _, _ = _together(pool, services, lambda: member(pins['owner'], partner=True),
                lambda: member(pins['proxy']), lambda: definition(pins['owner']), lambda: definition(pins['proxy']), cutoff=monotonic_cutoff)
            if len(owner_id) > 1 and not first['owner']['rolling']:
                _drift()
            ids = {'owner': owner_id, 'proxy': proxy_id}
            listed = [task_id for values in ids.values() for task_id in values]
            if len(set(listed)) != len(listed):
                _deny()
            step = 'tasks'; diagnostics.stage('pair-tasks')
            reply, = _together(pool, lambda: call(self._ecs, 'describe_tasks', cluster=pins['owner']['clusterArn'], tasks=listed, include=['TAGS']), cutoff=monotonic_cutoff)
            rows = reply.get('tasks')
            if type(rows) is not list:
                _unavailable()
            expected = {task_id: role for role, task_ids in ids.items() for task_id in task_ids}
            tasks = {}
            for row in rows:
                task_id = row.get('taskArn') if type(row) is dict else None
                role = expected.get(task_id)
                if role is None or task_id in tasks:
                    _drift()
                tasks[task_id] = _task(row, pins[role], task_id, first[role], at, partner=role == 'owner')
            incomplete = len(tasks) != len(listed) or reply.get('failures', []) != []
            if incomplete:
                _unavailable()
            # Pending tasks can lack placement, but every observed ENI is still
            # checked: an absent peer must never mask another task's drift.
            placed = {value['eni']: (expected[task_id], value) for task_id, value in tasks.items() if value['eni'] is not None}
            known_ips = [value['privateIpv4Address'] for value in tasks.values() if value['privateIpv4Address'] is not None]
            if (len(placed) != sum(value['eni'] is not None for value in tasks.values())
                    or len(set(known_ips)) != len(known_ips)):
                _deny()
            step = 'network'; diagnostics.stage('pair-network')
            reply, = _together(pool, lambda: call(self._ec2, 'describe_network_interfaces', NetworkInterfaceIds=list(placed)), cutoff=monotonic_cutoff)
            rows = reply.get('NetworkInterfaces')
            if type(rows) is not list:
                _unavailable()
            observed = set()
            for row in rows:
                eni = row.get('NetworkInterfaceId') if type(row) is dict else None
                if eni not in placed or eni in observed:
                    _drift()
                role, value = placed[eni]
                _network(row, value, pins[role])
                observed.add(eni)
            incomplete |= len(observed) != len(placed)
            step = 'recheck'; diagnostics.stage('pair-recheck')
            last, owner_again, proxy_again = _together(pool, services, lambda: member(pins['owner'], partner=True), lambda: member(pins['proxy']), cutoff=monotonic_cutoff)
            if last['proxy']['deploymentId'] != first['proxy']['deploymentId'] or proxy_again != ids['proxy']:
                _deny()
            if set(owner_again) & set(proxy_again):
                _deny()
            if len(owner_again) > 1 and not last['owner']['rolling']:
                _drift()
            if last['owner']['deploymentId'] != first['owner']['deploymentId'] or owner_again != ids['owner']:
                # Both final service and member snapshots passed their pins.
                # A partner replacement can arrive during this proof, but its
                # uninspected task/deployment cannot contribute to a lease.
                # Retry with a complete observation on the next renewal.
                _unavailable()
            # No observation is published for replacement gaps, pending members,
            # or the two pinned members of a same-revision rolling deployment.
            if (incomplete or first['owner']['transitional'] or last['owner']['transitional'] or len(owner_id) != 1
                    or any(not value['running'] or not value['primary'] for value in tasks.values())):
                _unavailable()
            pair = {role: tasks[task_ids[0]] for role, task_ids in ids.items()}
            check()
            checked = self._now()
            if not _instant(checked) or checked < at or checked >= cutoff:
                _unavailable()
            observation = {**{r: {k: pair[r][k] for k in ('taskArn', 'createdAtMs', 'privateIpv4Address', 'eni')} for r in ('owner', 'proxy')},
                'checkedAtMs': checked, 'expiresAtMs': min(pins['expiresAtMs'], checked+self._max_lease_ms)}
            with self._state:
                if self._retired or self._quarantined:
                    _unavailable()
                self._identity = tuple(tuple(pair[r][k] for k in ('taskArn', 'createdAtMs', 'privateIpv4Address')) for r in ('owner', 'proxy'))
                self._last_observation = copy.deepcopy(observation)
                self._last_checked_mono_ms = time.monotonic()*1000
            return observation
        except Exception as error:
            diagnostics.refused('pair', step, error, deadline_ms=cutoff, now_ms=self._now)
            if isinstance(error, PairProofError):
                raise
            _drift()
        finally:
            if pool is not None:
                pool.shutdown(wait=False, cancel_futures=True)
            with self._state:
                if self._active:
                    self._quarantined = True
            if acquired:
                self._read_lock.release()
