import assert from 'node:assert/strict';
import test from 'node:test';
import {createTemporalIssuerBootstrapTaskProof} from './bootstrap-task-proof.mjs';

const account = '123456789012';
const region = 'us-east-1';
const clusterArn = `arn:aws:ecs:${region}:${account}:cluster/meri-preview`;
const taskArn = `arn:aws:ecs:${region}:${account}:task/meri-preview/${'a'.repeat(32)}`;
const peerIPv4 = '10.0.1.4';
const digest = `sha256:${'b'.repeat(64)}`;
const nowMs = 1790000000000;

function pin(role) {
  const name = role === 'control' ? 'control' : 'worker';
  return {
    subject: `meri-temporal-${name}:v1`,
    workloadPrincipal: `meri-workload-${name}:v1`,
    peerSubjectCn: `meri-temporal-${name}`,
    peerUriBase: `spiffe://issuer.meri.internal/temporal/${name}/`,
    serviceArn: `arn:aws:ecs:${region}:${account}:service/meri-preview/meri-${name}`,
    taskDefinitionArn: `arn:aws:ecs:${region}:${account}:task-definition/meri-${name}:7`,
    containerName: `meri-${name}`,
    imageUri: `${account}.dkr.ecr.${region}.amazonaws.com/meri/${name}@${digest}`,
    taskRoleArn: `arn:aws:iam::${account}:role/meri-${name}-task`,
    executionRoleArn: `arn:aws:iam::${account}:role/meri-${name}-execution`,
    revision: 'revision-17',
  };
}

function fixture(role = 'control') {
  const configuration = {
    schemaVersion: 1, clusterArn, vpcId: 'vpc-12345678',
    privateSubnetIds: ['subnet-12345678'], securityGroupIds: ['sg-12345678'],
    maxLeaseMs: 10000,
    roles: {control: pin('control'), 'temporal-worker': pin('temporal-worker')},
  };
  const selected = configuration.roles[role];
  const serviceName = selected.serviceArn.split('/').at(-1);
  const service = {
    serviceArn: selected.serviceArn, clusterArn, status: 'ACTIVE',
    taskDefinition: selected.taskDefinitionArn, desiredCount: 1, runningCount: 1,
    serviceName,
    deployments: [{status: 'PRIMARY', taskDefinition: selected.taskDefinitionArn, rolloutState: 'COMPLETED'}],
  };
  const task = {
    taskArn, clusterArn, taskDefinitionArn: selected.taskDefinitionArn,
    lastStatus: 'RUNNING', desiredStatus: 'RUNNING', launchType: 'FARGATE',
    group: `service:${serviceName}`,
    containers: [{name: selected.containerName, lastStatus: 'RUNNING', imageDigest: digest}],
    attachments: [{type: 'ElasticNetworkInterface', status: 'ATTACHED', details: [
      {name: 'networkInterfaceId', value: 'eni-12345678'},
      {name: 'subnetId', value: 'subnet-12345678'},
      {name: 'privateIPv4Address', value: peerIPv4},
    ]}],
  };
  const definition = {
    taskDefinitionArn: selected.taskDefinitionArn, status: 'ACTIVE', networkMode: 'awsvpc',
    requiresCompatibilities: ['FARGATE'], taskRoleArn: selected.taskRoleArn,
    executionRoleArn: selected.executionRoleArn,
    containerDefinitions: [{name: selected.containerName, image: selected.imageUri}],
  };
  const eni = {
    NetworkInterfaceId: 'eni-12345678', VpcId: configuration.vpcId,
    SubnetId: 'subnet-12345678', Status: 'in-use', PrivateIpAddress: peerIPv4,
    Groups: [{GroupId: 'sg-12345678'}],
  };
  const calls = [];
  const ecs = {
    async describeServices(request) {
      calls.push('service');
      assert.deepEqual(request.services, [selected.serviceArn]);
      return {services: [service], failures: []};
    },
    async describeTasks(request) {
      calls.push('task');
      assert.deepEqual(request.tasks, [taskArn]);
      return {tasks: [task], failures: []};
    },
    async listTasks(request) {
      calls.push('list');
      assert.equal(request.serviceName, serviceName);
      return {taskArns: [taskArn]};
    },
    async describeTaskDefinition(request) {
      calls.push('definition');
      assert.equal(request.taskDefinition, selected.taskDefinitionArn);
      return {taskDefinition: definition};
    },
  };
  const ec2 = {async describeNetworkInterfaces(request) {
    calls.push('eni');
    assert.deepEqual(request.NetworkInterfaceIds, ['eni-12345678']);
    return {NetworkInterfaces: [eni]};
  }};
  const create = () => createTemporalIssuerBootstrapTaskProof({configuration, ecs, ec2, now: () => nowMs});
  const read = () => create().readCurrent({role, taskArn, peerIPv4});
  return {configuration, selected, service, task, definition, eni, calls, ecs, ec2, create, read};
}

test('fresh post-placement proof returns only pinned, currently observed task facts', async () => {
  const f = fixture();
  assert.deepEqual(await f.read(), {
    state: 'CURRENT', role: 'control', taskArn, peerIPv4, revision: f.selected.revision,
    serviceArn: f.selected.serviceArn, taskDefinitionArn: f.selected.taskDefinitionArn,
    imageUri: f.selected.imageUri, taskRoleArn: f.selected.taskRoleArn,
    executionRoleArn: f.selected.executionRoleArn, observedAtMs: nowMs,
    validUntilMs: nowMs + 10000,
  });
  assert.deepEqual(f.calls, ['service', 'task', 'list', 'definition', 'eni']);
});

test('caller task ARN is a selector, never proof of service ownership', async () => {
  const f = fixture();
  assert.equal((await f.create().readCurrent({role: 'control', taskArn: 'other', peerIPv4})).state, 'REVOKED');
  assert.deepEqual(f.calls, []);
  f.ecs.listTasks = async () => ({taskArns: []});
  assert.equal((await f.read()).state, 'REVOKED');
});

test('direct observed peer address must equal the current private task ENI', async () => {
  const f = fixture();
  assert.equal((await f.create().readCurrent({role: 'control', taskArn, peerIPv4: '10.0.1.9'})).state, 'REVOKED');
  f.eni.Association = {PublicIp: '203.0.113.10'};
  assert.equal((await f.read()).state, 'REVOKED');
});

test('stopped, standalone, wrong revision and changed image or task role refuse proof', async () => {
  for (const change of [
    f => { f.task.lastStatus = 'STOPPED'; },
    f => { f.task.group = 'family:meri-control'; },
    f => { f.service.taskDefinition = `arn:aws:ecs:${region}:${account}:task-definition/meri-control:8`; },
    f => { f.task.containers[0].imageDigest = `sha256:${'c'.repeat(64)}`; },
    f => { f.definition.taskRoleArn = `arn:aws:iam::${account}:role/other`; },
  ]) {
    const f = fixture();
    change(f);
    assert.equal((await f.read()).state, 'REVOKED');
  }
});

test('PRIMARY in-progress rollout is closed by default and opens only for an exact pinned revision', async () => {
  const f = fixture();
  f.service.deployments[0].rolloutState = 'IN_PROGRESS';
  assert.equal((await f.read()).state, 'REVOKED');
  f.configuration.roles.control.allowPrimaryInProgress = true;
  assert.equal((await f.read()).state, 'CURRENT');
  f.service.deployments[0].taskDefinition = `arn:aws:ecs:${region}:${account}:task-definition/meri-control:8`;
  assert.equal((await f.read()).state, 'REVOKED');
  const g = fixture();
  g.configuration.roles.control.allowPrimaryInProgress = 'true';
  assert.throws(() => g.create());
});

test('worker may have no task role only when pinned null and no override adds one', async () => {
  const f = fixture('temporal-worker');
  f.configuration.roles['temporal-worker'].taskRoleArn = null;
  f.definition.taskRoleArn = undefined;
  assert.equal((await f.read()).state, 'CURRENT');
  f.task.overrides = {taskRoleArn: `arn:aws:iam::${account}:role/other`};
  assert.equal((await f.read()).state, 'REVOKED');
  const g = fixture();
  g.configuration.roles.control.taskRoleArn = null;
  assert.throws(() => g.create());
});

test('service membership must close every bounded page; repeated or endless token refuses', async () => {
  const f = fixture();
  let page = 0;
  f.ecs.listTasks = async ({nextToken}) => {
    page += 1;
    assert.equal(nextToken, page === 1 ? undefined : 'second');
    return page === 1 ? {taskArns: [], nextToken: 'second'} : {taskArns: [taskArn]};
  };
  assert.equal((await f.read()).state, 'CURRENT');
  assert.equal(page, 2);
  const g = fixture();
  g.ecs.listTasks = async () => ({taskArns: [taskArn], nextToken: 'again'});
  assert.equal((await g.read()).state, 'REVOKED');
});

test('abort and AWS failures are unavailable, never current', async () => {
  const f = fixture();
  const controller = new AbortController();
  controller.abort();
  assert.equal((await f.create().readCurrent({role: 'control', taskArn, peerIPv4,
    signal: controller.signal})).state, 'UNAVAILABLE');
  assert.deepEqual(f.calls, []);
  f.ecs.describeTasks = async () => { throw new Error('ECS unavailable'); };
  assert.equal((await f.read()).state, 'UNAVAILABLE');
});
