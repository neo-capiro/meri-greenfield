import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareManagedFixtureVolumeProbes as prepare } from './fixture-volume-probe-provenance.mjs';
import { createFixtureBootstrapDescriptor, fixtureBootstrapInput } from './fixture-volume-activation.mjs';
import { compileFixtureBootstrapWorkflow, compileFixtureWorkflow } from './fixture-volume-workflow.mjs';
import { FIXTURE as F, fixtureTags, fixtureMachineName, fixtureExecutionName } from './fixture-volume-binding.mjs';

// Literal synthetic service-shaped DATA, never captured AWS origin/admission.
const T = 1791660000000, ID = 'vol-0123456789abcdef0', OTHER = 'vol-1123456789abcdef0';
const machine = `arn:aws:states:${F.region}:${F.account}:stateMachine:${fixtureMachineName()}`;
const execution = `arn:aws:states:${F.region}:${F.account}:execution:${fixtureMachineName()}:${fixtureExecutionName()}`;
const role = `arn:aws:iam::${F.account}:role/QualificationFixtureOnly`;
const raw = value => Buffer.from(JSON.stringify(value));
const sha = value => createHash('sha256').update(value).digest('hex');
const volume = () => ({ VolumeId: ID, Tags: fixtureTags(), CreateTime: new Date(T + 500).toISOString(),
  AvailabilityZone: F.az, KmsKeyId: F.keyArn, Size: 1, VolumeType: 'gp3', Encrypted: true,
  Attachments: [], SnapshotId: '', State: 'available' });

function fixture({ lostCreate = false, ambiguousDelete = false, noDelete = false, duplicateCreate = false, duplicateDelete = false } = {}) {
  const descriptor = createFixtureBootstrapDescriptor({ t0Ms: T, createNotAfterMs: T + 300000 });
  const graph = compileFixtureBootstrapWorkflow(descriptor), events = []; let time = T + 1000;
  const add = (type, details, parent = events.length) => {
    const event = { id: events.length + 1, previousEventId: parent, timestamp: time / 1000, type, ...details };
    events.push(event); time += 50; return event;
  };
  const inputRaw = raw(fixtureBootstrapInput(descriptor));
  add('ExecutionStarted', { executionStartedEventDetails: { input: inputRaw.toString(), inputDetails: { truncated: false },
    roleArn: role, stateMachineVersionArn: machine + ':1' } }, 0);
  const state = name => add(`${graph.States[name].Type}StateEntered`, { stateEnteredEventDetails: { name, input: '{}', inputDetails: { truncated: false } } });
  function call(name, parameters, output, failed = false) {
    const entered = state(name), api = graph.States[name].Resource.split(':').at(-1);
    const scheduled = add('TaskScheduled', { taskScheduledEventDetails: { resourceType: 'aws-sdk:ec2', resource: api,
      region: F.region, parameters: JSON.stringify(parameters), timeoutInSeconds: 15 } }, entered.id);
    const started = add('TaskStarted', { taskStartedEventDetails: { resourceType: 'aws-sdk:ec2', resource: api } }, scheduled.id);
    const ended = failed ? add('TaskTimedOut', { taskTimedOutEventDetails: { resourceType: 'aws-sdk:ec2', resource: api,
      error: 'States.Timeout', cause: 'synthetic unknown completion' } }, started.id) :
      add('TaskSucceeded', { taskSucceededEventDetails: { resourceType: 'aws-sdk:ec2', resource: api,
        output: JSON.stringify(output), outputDetails: { truncated: false } } }, started.id);
    add('TaskStateExited', { stateExitedEventDetails: { name, output: '{}', outputDetails: { truncated: false } } }, ended.id);
  }
  state('RecordCreateAttempt'); call('CreateVolume', graph.States.CreateVolume.Arguments, { VolumeId: ID }, lostCreate);
  if (duplicateCreate) call('CreateVolume', graph.States.CreateVolume.Arguments, { VolumeId: ID });
  call('ListFirst', graph.States.ListFirst.Arguments, { Volumes: [volume()] });
  call('DescribeOwned', { VolumeIds: [ID] }, { Volumes: [volume()] });
  if (!noDelete) {
    state('RecordDeleteAttempt'); call('DeleteVolume', { VolumeId: ID }, {}, ambiguousDelete);
    if (duplicateDelete) call('DeleteVolume', { VolumeId: ID }, {});
  }
  add('ExecutionSucceeded', { executionSucceededEventDetails: { output: '{"cleanup":"UNKNOWN"}', outputDetails: { truncated: false } } });
  const capture = { descriptor, pins: { sourceCommit: 'b'.repeat(40), definitionSha256: sha(raw(graph)), inputSha256: sha(inputRaw),
    versionArn: machine + ':1', executionArn: execution, roleArn: role, pages: [] }, definitionRaw: raw(graph), inputRaw, pages: [] };
  const options = { capture, expected: { ...capture.pins, ownerBindingId: descriptor.ownerBindingId },
    originalClock: { t0Ms: T, createNotAfterMs: T + 300000, C: T + 900000 }, volumeId: ID, probeAtMs: T + 10000 };
  delete options.expected.pages;
  const pack = () => {
    const requestRaw = raw({ executionArn: execution, includeExecutionData: true, reverseOrder: false, maxResults: 1000 });
    const responseRaw = raw({ events }); capture.pages = [{ requestRaw, responseRaw }];
    capture.pins.pages = [{ requestSha256: sha(requestRaw), responseSha256: sha(responseRaw) }];
  };
  pack(); return { options, events, pack };
}
function changeOutput(f, state, change) {
  let active; for (const e of f.events) {
    if (e.type === 'TaskStateEntered') active = e.stateEnteredEventDetails.name;
    if (active === state && e.type === 'TaskSucceeded') {
      e.taskSucceededEventDetails.output = JSON.stringify(change(JSON.parse(e.taskSucceededEventDetails.output))); break;
    }
  } f.pack();
}
const refused = f => assert.throws(() => prepare(f.options));

test('exact MANAGED predecessor is detached frozen evidence with original clock and two literal readonly intents', () => {
  const f = fixture(), value = prepare(f.options);
  assert.equal(value.schema, 'meri-browser-MANAGED-probe-preparation/1'); assert.equal(value.provenance, 'MANAGED');
  assert.equal(value.profile, 'MANAGED_WIRE_BOOTSTRAP_V1'); assert.equal(value.volumeId, ID);
  assert.deepEqual(value.clock, { t0Ms: T, createNotAfterMs: T + 300000, C: T + 900000 });
  assert.equal(value.history.createAttempt.outcome, 'TaskSucceeded'); assert.equal(value.history.firstDeleteAttempt.outcome, 'TaskSucceeded');
  assert.deepEqual(value.requestIntents, [
    { case: 'DescribeInVpc', readOnly: true, service: 'ec2', operation: 'describeInstances', arguments: {
      Filters: [{ Name: 'vpc-id', Values: ['vpc-06e1941747e798f0a'] }, { Name: 'owner-id', Values: ['967807252336'] }], MaxResults: 5 } },
    { case: 'DescribeMissingVolume', readOnly: true, service: 'ec2', operation: 'describeVolumes', arguments: { VolumeIds: [ID] } },
  ]);
  assert.ok(Object.isFrozen(value.history.ownership.direct.volume.Tags[0]));
  assert.ok(Object.isFrozen(value.requestIntents[1].arguments.VolumeIds));
  f.options.expected.sourceCommit = 'c'.repeat(40); f.options.capture.pages[0].responseRaw.fill(0);
  assert.equal(value.externalIdentity.sourceCommit, 'b'.repeat(40)); assert.equal(value.history.volumeId, ID);
});
test('ambiguous delete and lost create remain actual UNKNOWN outcomes, permitting only exact-ID readonly intents', () => {
  const value = prepare(fixture({ lostCreate: true, ambiguousDelete: true }).options);
  assert.equal(value.history.createAttempt.outcome, 'TaskTimedOut'); assert.equal(value.history.firstDeleteAttempt.outcome, 'TaskTimedOut');
  assert.equal(value.history.uncertain, true); assert.equal(value.cleanup, 'UNKNOWN');
  for (const key of ['runtimeAdmitted', 'physicalAbsenceProven', 'absenceWireQualified']) assert.equal(value[key], false);
  assert.deepEqual(value.requestIntents.map(x => x.operation), ['describeInstances', 'describeVolumes']);
});
test('valid-looking external source/version/role/hash/owner substitutions refuse independent expected identities', () => {
  for (const key of ['sourceCommit', 'versionArn', 'roleArn', 'definitionSha256', 'inputSha256', 'executionArn', 'ownerBindingId']) {
    const f = fixture(); f.options.expected[key] += 'x'; refused(f);
  }
  const f = fixture(); f.options.capture.pins.sourceCommit = 'c'.repeat(40); refused(f);
  const g = fixture(); g.options.capture.pins.versionArn = machine + ':2';
  g.events[0].executionStartedEventDetails.stateMachineVersionArn = machine + ':2'; g.pack(); refused(g);
});
test('legacy profile, coherent arbitrary definition and input substitution cannot bridge', () => {
  const f = fixture(), c = f.options.capture;
  c.definitionRaw = raw(compileFixtureWorkflow({ t0Ms: T, createNotAfterMs: T + 300000, ownerBindingId: c.descriptor.ownerBindingId }));
  c.pins.definitionSha256 = sha(c.definitionRaw); refused(f);
});
test('coherently rehashed foreign input and bootstrap profile refuse', () => {
  for (const patch of [{ profile: 'foreign' }, { runUuid: 'foreign' }, { ownerBindingId: 'f'.repeat(64) }]) {
    const f = fixture(), c = f.options.capture; c.inputRaw = raw({ ...JSON.parse(c.inputRaw), ...patch });
    c.pins.inputSha256 = sha(c.inputRaw); f.options.expected.inputSha256 = c.pins.inputSha256;
    f.events[0].executionStartedEventDetails.input = c.inputRaw.toString(); f.pack(); refused(f);
  }
});
test('missing first delete or duplicate create/delete mutation attempts refuse', () => {
  for (const settings of [{ noDelete: true }, { duplicateCreate: true }, { duplicateDelete: true }]) refused(fixture(settings));
  const f = fixture(); f.events.find(e => e.stateEnteredEventDetails?.name === 'RecordCreateAttempt').stateEnteredEventDetails.name = 'BeginScan';
  f.pack(); refused(f);
});
test('missing, foreign, duplicate or attached owned singleton refuses through canonical reconstruction', () => {
  for (const patch of [{ Tags: [] }, { VolumeId: OTHER }, { Attachments: [{}] }, { KmsKeyId: 'foreign' }, { State: 'creating' }]) {
    const f = fixture(); changeOutput(f, 'DescribeOwned', out => ({ Volumes: [{ ...out.Volumes[0], ...patch }] })); refused(f);
  }
  for (const rows of [[], [volume(), volume()]]) { const f = fixture(); changeOutput(f, 'ListFirst', () => ({ Volumes: rows })); refused(f); }
  const f = fixture(); changeOutput(f, 'DescribeOwned', out => ({ ...out, NextToken: null })); refused(f);
});
test('external retained ID cannot be guessed, absent or replaced', () => {
  for (const id of [undefined, null, OTHER, ID + '\n', true]) { const f = fixture(); f.options.volumeId = id; refused(f); }
});
test('original clock cannot reset and explicit current probe time expires at original C', () => {
  for (const key of ['t0Ms', 'createNotAfterMs', 'C']) { const f = fixture(); f.options.originalClock[key]++; refused(f); }
  for (const ms of [T, T + 900000, T + 900001, NaN, Infinity, true, T + 10000.5]) {
    const f = fixture(); f.options.probeAtMs = ms; refused(f);
  }
  const f = fixture(); f.options.probeAtMs = T + 899999; assert.equal(prepare(f.options).clock.C, T + 900000);
});
test('capture corruption, paging token ambiguity and incomplete history refuse before preparation', () => {
  const f = fixture(); f.options.capture.pages[0].responseRaw = Buffer.from('bad'); refused(f);
  for (const token of [null, false, 'unconsumed']) {
    const g = fixture(), c = g.options.capture; c.pages[0].responseRaw = raw({ events: g.events, nextToken: token });
    c.pins.pages[0].responseSha256 = sha(c.pages[0].responseRaw); refused(g);
  }
  const g = fixture(); g.events.pop(); g.pack(); refused(g);
});
test('fabricated local CLI predecessor, admission flags and getters cannot select another path', () => {
  for (const extra of [{ caller: {} }, { nonce: 'a'.repeat(64) }, { created: { status: 'CREATED' } },
    { deleteAck: { status: 'DELETE_ACK_NOT_ABSENCE' } }, { runtimeAdmitted: true }, { graph: {} }]) {
    const f = fixture(); Object.assign(f.options, extra); refused(f);
  }
  const f = fixture(); f.options.capture = { status: 'CREATED', nonce: 'a'.repeat(64), caller: {}, rawCreate: { VolumeId: ID } }; refused(f);
  let touched = 0; const g = fixture(); Object.defineProperty(g.options, 'capture', { get() { touched++; return {}; } }); refused(g);
  assert.equal(touched, 0);
  const value = prepare(fixture().options);
  for (const key of ['nonce', 'caller', 'rawCreate', 'deleteAck', 'ownerInput', 'definition', 'roleArn', 'admission']) assert.equal(Object.hasOwn(value, key), false);
  assert.equal(value.directInstance, null);
});
test('stale pre-delete proof and foreign actual delete parameters cannot be promoted', () => {
  const f = fixture(); let deletion = false;
  for (const e of f.events) { if (e.stateEnteredEventDetails?.name === 'RecordDeleteAttempt') deletion = true; if (deletion) e.timestamp += 16; }
  f.pack(); refused(f);
  const g = fixture(); let active;
  for (const e of g.events) { if (e.type === 'TaskStateEntered') active = e.stateEnteredEventDetails.name;
    if (active === 'DeleteVolume' && e.type === 'TaskScheduled') e.taskScheduledEventDetails.parameters = JSON.stringify({ VolumeId: OTHER }); }
  g.pack(); refused(g);
});
