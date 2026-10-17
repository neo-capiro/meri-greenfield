import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {
  createTemporalIssuerAwsReaders,
  createTemporalIssuerAwsTaskProof,
  createTemporalIssuerTaskAuthority,
  parseTemporalIssuerTaskAuthorityConfiguration,
} from './task-authority.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

const turn = () => new Promise(resolve => setImmediate(resolve));

const account = '123456789012';
const region = 'us-east-1';
const cluster = `arn:aws:ecs:${region}:${account}:cluster/meri-preview`;
const taskArn = `arn:aws:ecs:${region}:${account}:task/meri-preview/${'a'.repeat(32)}`;
const digest = `sha256:${'b'.repeat(64)}`;
const role = 'control';
const raw = Buffer.from('test-only-authenticated-peer-certificate');
const fingerprint = createHash('sha256').update(raw).digest('hex');

function rolePin(name) {
  const prefix = name === 'control' ? 'control' : 'worker';
  return {
    subject: `meri-temporal-${prefix}:v1`,
    workloadPrincipal: `meri-workload-${prefix}:v1`,
    peerSubjectCn: `meri-temporal-${prefix}`,
    peerUriBase: `spiffe://issuer.meri.internal/temporal/${prefix}/`,
    serviceArn: `arn:aws:ecs:${region}:${account}:service/meri-preview/meri-${prefix}`,
    taskDefinitionArn: `arn:aws:ecs:${region}:${account}:task-definition/meri-${prefix}:7`,
    containerName: `meri-${prefix}`,
    imageUri: `${account}.dkr.ecr.${region}.amazonaws.com/meri/${prefix}@${digest}`,
    taskRoleArn: `arn:aws:iam::${account}:role/meri-${prefix}-task`,
    executionRoleArn: `arn:aws:iam::${account}:role/meri-${prefix}-execution`,
    revision: 'revision-17',
  };
}

function fixture() {
  const config = {
    schemaVersion: 1,
    clusterArn: cluster,
    vpcId: 'vpc-12345678',
    privateSubnetIds: ['subnet-12345678'],
    securityGroupIds: ['sg-12345678'],
    maxLeaseMs: 10000,
    roles: {control: rolePin('control'), 'temporal-worker': rolePin('temporal-worker')},
  };
  const pin = config.roles.control;
  const peerSanUri = pin.peerUriBase + encodeURIComponent(taskArn);
  const peer = {authorized: true, remoteAddress: '10.0.1.4', certificate: {
    raw, fingerprint256: fingerprint.toUpperCase().match(/../gu).join(':'),
    subject: {CN: pin.peerSubjectCn}, subjectaltname: `URI:${peerSanUri}`,
    valid_from: '2026-01-01T00:00:00.000Z', valid_to: '2027-01-01T00:00:00.000Z',
  }};
  const identity = {role, subject: pin.subject, workloadPrincipal: pin.workloadPrincipal};
  const binding = {schemaVersion: 1, state: 'CURRENT', certificateSha256: fingerprint,
    role, peerSanUri, taskArn, revision: pin.revision, expiresAtMs: 1790000020000};
  const service = {serviceArn: pin.serviceArn, clusterArn: cluster, status: 'ACTIVE',
    taskDefinition: pin.taskDefinitionArn, desiredCount: 1, runningCount: 1, serviceName: 'meri-control',
    deployments: [{status: 'PRIMARY', taskDefinition: pin.taskDefinitionArn, rolloutState: 'COMPLETED'}]};
  const task = {taskArn, clusterArn: cluster, taskDefinitionArn: pin.taskDefinitionArn,
    lastStatus: 'RUNNING', desiredStatus: 'RUNNING', launchType: 'FARGATE', group: 'service:meri-control',
    containers: [{name: pin.containerName, lastStatus: 'RUNNING', imageDigest: digest}],
    attachments: [{type: 'ElasticNetworkInterface', status: 'ATTACHED', details: [
      {name: 'networkInterfaceId', value: 'eni-12345678'},
      {name: 'subnetId', value: 'subnet-12345678'},
      {name: 'privateIPv4Address', value: '10.0.1.4'},
    ]}]};
  const taskDefinition = {taskDefinitionArn: pin.taskDefinitionArn, status: 'ACTIVE',
    networkMode: 'awsvpc', requiresCompatibilities: ['FARGATE'],
    taskRoleArn: pin.taskRoleArn, executionRoleArn: pin.executionRoleArn,
    containerDefinitions: [{name: pin.containerName, image: pin.imageUri}]};
  const networkInterface = {NetworkInterfaceId: 'eni-12345678', VpcId: config.vpcId,
    SubnetId: 'subnet-12345678', Status: 'in-use', PrivateIpAddress: '10.0.1.4',
    Groups: [{GroupId: 'sg-12345678'}]};
  const calls = [];
  let bindingRead = 0;
  const ports = {
    bindings: {async readCurrent(request) {
      calls.push('binding');
      assert.equal(request.certificateSha256, fingerprint);
      bindingRead += 1;
      return bindingRead === 2 && ports.secondBinding ? ports.secondBinding : binding;
    }},
    ecs: {
      async describeServices(request) {
        calls.push('service');
        assert.deepEqual(request.services, [pin.serviceArn]);
        return {services: [service], failures: []};
      },
      async describeTasks(request) {
        calls.push('task');
        assert.deepEqual(request.tasks, [taskArn]);
        return {tasks: [task], failures: []};
      },
      async listTasks(request) {
        calls.push('serviceTasks');
        assert.equal(request.serviceName, 'meri-control');
        assert.equal(request.desiredStatus, 'RUNNING');
        return {taskArns: [taskArn]};
      },
      async describeTaskDefinition(request) {
        calls.push('definition');
        assert.equal(request.taskDefinition, pin.taskDefinitionArn);
        return {taskDefinition};
      },
    },
    ec2: {async describeNetworkInterfaces(request) {
      calls.push('eni');
      assert.deepEqual(request.NetworkInterfaceIds, ['eni-12345678']);
      return {NetworkInterfaces: [networkInterface]};
    }},
  };
  const nowMs = 1790000000000;
  const authority = createTemporalIssuerTaskAuthority({configuration: config, ecs: ports.ecs,
    ec2: ports.ec2, bindings: ports.bindings, now: () => nowMs});
  return {config, pin, peer, identity, binding, service, task, taskDefinition, networkInterface, calls, ports, authority, nowMs};
}

test('closed pins are reusable after parsing, and current task is checked with fresh binding before and after cloud facts', async () => {
  const f = fixture();
  assert.deepEqual(parseTemporalIssuerTaskAuthorityConfiguration(parseTemporalIssuerTaskAuthorityConfiguration(f.config)),
    parseTemporalIssuerTaskAuthorityConfiguration(f.config));
  const result = await f.authority.readCurrent({peer: f.peer, identity: f.identity});
  assert.deepEqual(result, {state: 'CURRENT', identity: f.identity, observedAtMs: f.nowMs,
    validUntilMs: f.nowMs + 10000, revision: f.pin.revision});
  assert.deepEqual(f.calls, ['binding', 'service', 'task', 'serviceTasks', 'definition', 'eni', 'binding']);
});

test('control and worker cannot share the task role or service authority pin', () => {
  const f = fixture();
  f.config.roles['temporal-worker'].taskRoleArn = f.config.roles.control.taskRoleArn;
  assert.throws(() => parseTemporalIssuerTaskAuthorityConfiguration(f.config));
  const g = fixture();
  g.config.roles['temporal-worker'].serviceArn = g.config.roles.control.serviceArn;
  assert.throws(() => parseTemporalIssuerTaskAuthorityConfiguration(g.config));
});

test('the two fixed temporal identities cannot be reconfigured', () => {
  const f = fixture();
  f.config.roles.control.subject = 'alternate-control:v1';
  assert.throws(() => parseTemporalIssuerTaskAuthorityConfiguration(f.config));
  const g = fixture();
  g.config.roles['temporal-worker'].workloadPrincipal = 'alternate-worker:v1';
  assert.throws(() => parseTemporalIssuerTaskAuthorityConfiguration(g.config));
});

test('stopped ECS task revokes the lease', async () => {
  const f = fixture();
  f.task.lastStatus = 'STOPPED';
  assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'REVOKED');
});

test('token authority keeps two durable reads when pinned PRIMARY rollout is in progress', async () => {
  const f = fixture();
  f.service.deployments[0].rolloutState = 'IN_PROGRESS';
  assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'REVOKED');
  f.config.roles.control.allowPrimaryInProgress = true;
  const authority = createTemporalIssuerTaskAuthority({configuration: f.config, ecs: f.ports.ecs,
    ec2: f.ports.ec2, bindings: f.ports.bindings, now: () => f.nowMs});
  f.calls.length = 0;
  assert.equal((await authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'CURRENT');
  assert.deepEqual(f.calls, ['binding', 'service', 'task', 'serviceTasks', 'definition', 'eni', 'binding']);
});

test('standalone task with forged service group is absent from service-scoped ListTasks', async () => {
  const f = fixture();
  f.ports.ecs.listTasks = async request => {
    f.calls.push('serviceTasks');
    assert.equal(request.serviceName, 'meri-control');
    return {taskArns: []};
  };
  assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'REVOKED');
  assert.equal(f.calls.at(-1), 'serviceTasks');
});

test('service membership is checked across every bounded page and refuses unclosed pagination', async () => {
  const f = fixture();
  let page = 0;
  f.ports.ecs.listTasks = async request => {
    f.calls.push('serviceTasks');
    page += 1;
    assert.equal(request.nextToken, page === 1 ? undefined : 'second');
    return page === 1 ? {taskArns: [], nextToken: 'second'} : {taskArns: [taskArn]};
  };
  assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'CURRENT');
  assert.equal(page, 2);
  const g = fixture();
  let overflowPage = 0;
  g.ports.ecs.listTasks = async () => ({taskArns: [], nextToken: `page-${++overflowPage}`});
  assert.equal((await g.authority.readCurrent({peer: g.peer, identity: g.identity})).state, 'REVOKED');
  assert.equal(overflowPage, 4);
});

test('current revision and second durable revocation are mandatory', async () => {
  const f = fixture();
  f.binding.revision = 'retired';
  assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'REVOKED');
  const g = fixture();
  g.ports.secondBinding = {schemaVersion: 1, state: 'REVOKED'};
  assert.equal((await g.authority.readCurrent({peer: g.peer, identity: g.identity})).state, 'REVOKED');
  assert.equal(g.calls.at(-1), 'binding');
});

test('container image, task role, VPC, subnet and public ENI mismatch each revoke', async () => {
  for (const change of [
    f => { f.task.containers[0].imageDigest = `sha256:${'c'.repeat(64)}`; },
    f => { f.taskDefinition.taskRoleArn = `arn:aws:iam::${account}:role/other`; },
    f => { f.task.overrides = {taskRoleArn: `arn:aws:iam::${account}:role/other`}; },
    f => { f.task.overrides = {executionRoleArn: `arn:aws:iam::${account}:role/other`}; },
    f => { f.networkInterface.VpcId = 'vpc-87654321'; },
    f => { f.task.attachments[0].details[1].value = 'subnet-87654321'; },
    f => { f.networkInterface.Association = {PublicIp: '203.0.113.10'}; },
  ]) {
    const f = fixture();
    change(f);
    assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'REVOKED');
  }
});

test('a copied current task certificate from another private ENI is revoked', async () => {
  const f = fixture();
  f.peer.remoteAddress = '10.0.1.99';
  assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'REVOKED');
});

test('unrecognized role, wrong echo and unauthenticated or wrong-role peer are refused before durable reads', async () => {
  for (const change of [
    f => { f.identity.role = 'admin'; },
    f => { f.identity.subject = 'other'; },
    f => { f.peer.authorized = false; },
    f => { f.peer.certificate.subject.CN = 'other'; },
    f => { f.peer.certificate.subjectaltname = 'URI:spiffe://other/task'; },
  ]) {
    const f = fixture();
    change(f);
    assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'REVOKED');
    assert.deepEqual(f.calls, []);
  }
});

test('failed fresh cloud read is unavailable, never current', async () => {
  const f = fixture();
  f.ports.ecs.describeTasks = async () => { throw new Error('transient read failure'); };
  assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'UNAVAILABLE');
});

test('malformed current source shape and expired binding cannot issue lease', async () => {
  const f = fixture();
  f.binding.expiresAtMs = f.nowMs - 1;
  assert.equal((await f.authority.readCurrent({peer: f.peer, identity: f.identity})).state, 'REVOKED');
  const g = fixture();
  g.binding.extra = 'not a closed authority fact';
  assert.equal((await g.authority.readCurrent({peer: g.peer, identity: g.identity})).state, 'REVOKED');
});

test('reader close tracks a held dynamic import and blocks a late SDK send', async () => {
  const loading = deferred();
  let sends = 0;
  const readers = createTemporalIssuerAwsReaders({
    ecsClient: {send() { sends += 1; return Promise.resolve({}); }},
    ec2Client: {send() { sends += 1; return Promise.resolve({}); }},
    loadModule: () => loading.promise,
  });
  const first = readers.ecs.describeServices({cluster, services: []});
  await turn();
  const receipt = readers.close();
  assert.deepEqual(receipt, {schemaVersion: 1, state: 'CLEANUP_UNKNOWN', pendingOperations: 1});
  loading.resolve({DescribeServicesCommand: class { constructor(input) { this.input = input; } }});
  await assert.rejects(first, {code: 'TEMPORAL_ISSUER_TASK_AUTHORITY_UNAVAILABLE'});
  assert.equal(sends, 0);
  await assert.rejects(readers.ecs.describeTasks({cluster, tasks: []}),
    {code: 'TEMPORAL_ISSUER_TASK_AUTHORITY_UNAVAILABLE'});
  assert.strictEqual(readers.close(), receipt);
});

test('reader close retains a held SDK send even when its AbortSignal is ignored', async () => {
  const sending = deferred();
  let sendSignal;
  const readers = createTemporalIssuerAwsReaders({
    ecsClient: {send(_command, options) { sendSignal = options.abortSignal; return sending.promise; }},
    ec2Client: {send() { throw new Error('unexpected EC2'); }},
    loadModule: async () => ({DescribeServicesCommand: class {}}),
  });
  const first = readers.ecs.describeServices({cluster, services: []});
  await turn();
  assert.equal(sendSignal.aborted, false);
  const receipt = readers.close();
  assert.deepEqual(receipt, {schemaVersion: 1, state: 'CLEANUP_UNKNOWN', pendingOperations: 1});
  assert.equal(sendSignal.aborted, true);
  sending.resolve({services: []});
  await first;
  assert.strictEqual(readers.close(), receipt);
});

test('direct AWS proof close tracks an uncooperative cloud read', async () => {
  const f = fixture();
  const serviceRead = deferred();
  f.ports.ecs.describeServices = () => serviceRead.promise;
  const proof = createTemporalIssuerAwsTaskProof({configuration: f.config, ecs: f.ports.ecs,
    ec2: f.ports.ec2, now: () => f.nowMs});
  const reading = proof.readCurrent({role, taskArn, peerIPv4: f.peer.remoteAddress});
  await turn();
  const receipt = proof.close();
  assert.deepEqual(receipt, {schemaVersion: 1, state: 'CLEANUP_UNKNOWN', pendingOperations: 1});
  serviceRead.resolve({services: [f.service], failures: []});
  assert.equal((await reading).state, 'UNAVAILABLE');
  assert.deepEqual(f.calls, []);
  await assert.rejects(proof.readCurrent({role, taskArn, peerIPv4: f.peer.remoteAddress}),
    {code: 'TEMPORAL_ISSUER_TASK_AUTHORITY_UNAVAILABLE'});
});

test('task authority close tracks held durable binding and never starts cloud proof afterward', async () => {
  const f = fixture();
  const bindingRead = deferred();
  f.ports.bindings.readCurrent = () => bindingRead.promise;
  const authority = createTemporalIssuerTaskAuthority({configuration: f.config,
    ecs: f.ports.ecs, ec2: f.ports.ec2, bindings: f.ports.bindings, now: () => f.nowMs});
  const reading = authority.readCurrent({peer: f.peer, identity: f.identity});
  await turn();
  const receipt = authority.close();
  assert.deepEqual(receipt, {schemaVersion: 1, state: 'CLEANUP_UNKNOWN', pendingOperations: 1});
  bindingRead.resolve(f.binding);
  assert.equal((await reading).state, 'UNAVAILABLE');
  assert.deepEqual(f.calls, []);
  assert.strictEqual(authority.close(), receipt);
  await assert.rejects(authority.readCurrent({peer: f.peer, identity: f.identity}),
    {code: 'TEMPORAL_ISSUER_TASK_AUTHORITY_UNAVAILABLE'});
});

test('close after cloud proof resolves cannot start a second durable binding read',async()=>{
 const f=fixture();let clockReads=0,authority,closeReceipt;
 authority=createTemporalIssuerTaskAuthority({configuration:f.config,
  ecs:f.ports.ecs,ec2:f.ports.ec2,bindings:f.ports.bindings,now:()=>{
   clockReads++;
   // The third read is the final timestamp inside the AWS proof. Schedule
   // close before the awaiting outer authority can resume its continuation.
   if(clockReads===3)queueMicrotask(()=>{closeReceipt=authority.close();});
   return f.nowMs;
  }});
 const result=await authority.readCurrent({peer:f.peer,identity:f.identity});
 assert.equal(result.state,'UNAVAILABLE');
 assert.equal(closeReceipt.state,'CLEANUP_UNKNOWN');
 assert.equal(f.calls.filter(call=>call==='binding').length,1);
 assert.strictEqual(authority.close(),closeReceipt);
});

test('an already-aborted proof or authority read returns UNAVAILABLE without I/O',async()=>{
 const f=fixture(),signal=AbortSignal.abort();
 const proof=createTemporalIssuerAwsTaskProof({configuration:f.config,
  ecs:f.ports.ecs,ec2:f.ports.ec2,now:()=>f.nowMs});
 assert.equal((await proof.readCurrent({role,taskArn,peerIPv4:f.peer.remoteAddress,signal})).state,
  'UNAVAILABLE');
 assert.equal((await f.authority.readCurrent({peer:f.peer,identity:f.identity,signal})).state,
  'UNAVAILABLE');
 assert.deepEqual(f.calls,[]);
 assert.deepEqual(proof.close(),{schemaVersion:1,state:'CLEAN',pendingOperations:0});
 assert.deepEqual(f.authority.close(),{schemaVersion:1,state:'CLEAN',pendingOperations:0});
});

test('idle task readers and authorities close cleanly without starting work', () => {
  const f = fixture();
  assert.deepEqual(f.authority.close(), {schemaVersion: 1, state: 'CLEAN', pendingOperations: 0});
  const readers = createTemporalIssuerAwsReaders({ecsClient: {send() {}}, ec2Client: {send() {}}});
  assert.deepEqual(readers.close(), {schemaVersion: 1, state: 'CLEAN', pendingOperations: 0});
});
