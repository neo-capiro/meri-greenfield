import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareManagedFixtureVolumeProbes as prepare } from './fixture-volume-probe-provenance.mjs';
import { preparePostBootstrapReadOnlyWireProof as preparePost } from './fixture-volume-probe-provenance.mjs';
import * as probeProvenance from './fixture-volume-probe-provenance.mjs';
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

// This synthetic observation clock is DATA only; no Date.now, live session or
// root-issued admission is allocated by these fixtures.
function postOptions(f = fixture()) {
  const { probeAtMs: _unused, ...options } = f.options;
  return { ...options, proofClock: { kind: 'POST_BOOTSTRAP_READONLY_WIRE_V1',
    proofSessionId: '12345678-1234-4234-9234-123456789abc',
    approvedAtMs: T + 1000000, expiresAtMs: T + 1600000 } };
}

test('post-bootstrap proof accepts expired owned history without extending original C or the old profile', () => {
  const f = fixture(); f.options.probeAtMs = T + 1000000; refused(f);
  const options = postOptions(f), value = preparePost(options);
  assert.equal(value.schema, 'meri-browser-post-bootstrap-readonly-proof-preparation/1');
  assert.equal(value.profile, 'POST_BOOTSTRAP_READONLY_WIRE_V1');
  assert.deepEqual(value.originalClock, { t0Ms: T, createNotAfterMs: T + 300000, C: T + 900000 });
  assert.deepEqual(value.history.clock, value.originalClock);
  assert.deepEqual(value.proofClock, { kind: 'POST_BOOTSTRAP_READONLY_WIRE_V1',
    proofSessionId: '12345678-1234-4234-9234-123456789abc', approvedAtMs: T + 1000000, expiresAtMs: T + 1600000 });
  for (const key of ['cleanup', 'historicalCleanup', 'history']) {
    assert.equal(key === 'history' ? value.history.cleanup : value[key], 'UNKNOWN');
  }
  for (const key of ['runtimeAdmitted', 'absenceWireQualified', 'physicalAbsenceProven',
    'freshApiAbsenceObserved', 'originalDeadlineCleanupProven']) assert.equal(value[key], false);
  assert.equal(value.evidenceOnly, true); assert.equal(value.status, 'PREPARED_NOT_ADMITTED');
});

test('post-bootstrap intents are exactly the VPC read and the retained singleton exact-ID volume read', () => {
  const value = preparePost(postOptions());
  assert.deepEqual(value.requestIntents, [
    { case: 'DescribeInVpc', readOnly: true, service: 'ec2', operation: 'describeInstances', arguments: {
      Filters: [{ Name: 'vpc-id', Values: ['vpc-06e1941747e798f0a'] }, { Name: 'owner-id', Values: ['967807252336'] }], MaxResults: 5 } },
    { case: 'DescribeRetainedVolumeById', readOnly: true, service: 'ec2', operation: 'describeVolumes',
      arguments: { VolumeIds: ['vol-0123456789abcdef0'] } },
  ]);
  assert.equal(value.directInstance, null);
});

test('post-bootstrap volume read is a frozen single-element exact-ID intent with no filter, paging or width escape', () => {
  const value = preparePost(postOptions()), intent = value.requestIntents[1];
  assert.equal(intent.service, 'ec2'); assert.equal(intent.operation, 'describeVolumes'); assert.equal(intent.readOnly, true);
  assert.equal(intent.case, 'DescribeRetainedVolumeById');
  // Exactly one argument key: the retained singleton ID. No predicate, page size or
  // caller hint may hide a still-existing resource or widen the observation.
  assert.deepEqual(Reflect.ownKeys(intent.arguments), ['VolumeIds']);
  for (const key of ['Filters', 'MaxResults', 'NextToken', 'VolumeId', 'filters']) {
    assert.equal(Object.hasOwn(intent.arguments, key), false);
  }
  assert.equal(intent.arguments.VolumeIds.length, 1);
  assert.equal(intent.arguments.VolumeIds[0], ID);
  assert.ok(Object.isFrozen(intent.arguments)); assert.ok(Object.isFrozen(intent.arguments.VolumeIds));
  // The MANAGED predecessor carries the same exact-ID shape; both remain independent literals.
  const managed = prepare(fixture().options);
  assert.deepEqual(managed.requestIntents[1].arguments, { VolumeIds: [ID] });
  assert.ok(managed.requestIntents[1].arguments.VolumeIds !== intent.arguments.VolumeIds);
});

test('post-bootstrap cannot accept caller filters, widened IDs, error strings or a simulated absence shortcut', () => {
  for (const extra of [{ filters: [{ Name: 'volume-id', Values: [ID] }] }, { volumeIds: [ID] }, { maxResults: 5 },
    { nativeError: { Code: 'InvalidVolume.NotFound' } }, { errorString: 'InvalidVolume.NotFound' },
    { missingVolumeError: { name: 'InvalidVolume.NotFound' } }, { absence: true }, { response: {} }]) {
    const options = postOptions(); Object.assign(options, extra); assert.throws(() => preparePost(options));
  }
  // A foreign or malformed ID cannot be smuggled into the singleton element.
  for (const volumeId of [OTHER, ID + '\n', null, undefined, true, [ID]]) {
    const options = postOptions(); options.volumeId = volumeId; assert.throws(() => preparePost(options));
  }
  // Only the two evidence-preparation exports exist: no exported absence/error decoder.
  assert.deepEqual(Object.keys(probeProvenance).sort(),
    ['prepareManagedFixtureVolumeProbes', 'preparePostBootstrapReadOnlyWireProof']);
});

test('proof clock has exact finite bounded distinct-session DATA with no original-clock substitution', () => {
  for (const patch of [
    { kind: 'MANAGED_WIRE_BOOTSTRAP_V1' }, { proofSessionId: F.runUuid }, { proofSessionId: 'new-session' },
    { proofSessionId: '12345678-1234-4234-9234-123456789abc\n' }, { proofSessionId: true },
    { approvedAtMs: NaN }, { approvedAtMs: Infinity }, { approvedAtMs: true }, { approvedAtMs: 0 },
    { approvedAtMs: T }, { approvedAtMs: T + 1000000.5 }, { expiresAtMs: NaN }, { expiresAtMs: true },
    { expiresAtMs: Number.MAX_SAFE_INTEGER + 1 }, { expiresAtMs: T + 1000000 },
    { expiresAtMs: T + 999999 }, { expiresAtMs: T + 1600001 }, { C: T + 1600000 },
  ]) {
    const options = postOptions(); Object.assign(options.proofClock, patch);
    assert.throws(() => preparePost(options));
  }
  const oneMs = postOptions(); oneMs.proofClock.expiresAtMs = oneMs.proofClock.approvedAtMs + 1;
  assert.equal(preparePost(oneMs).proofClock.expiresAtMs, T + 1000001);
  const copiedOriginal = postOptions(); copiedOriginal.proofClock = { ...copiedOriginal.originalClock };
  assert.throws(() => preparePost(copiedOriginal));
});

test('post-bootstrap still binds every external pin, retained ID and original clock through canonical history', () => {
  for (const key of ['sourceCommit', 'versionArn', 'roleArn', 'definitionSha256', 'inputSha256', 'executionArn', 'ownerBindingId']) {
    const options = postOptions(); options.expected[key] += 'x'; assert.throws(() => preparePost(options));
  }
  for (const key of ['t0Ms', 'createNotAfterMs', 'C']) {
    const options = postOptions(); options.originalClock[key]++; assert.throws(() => preparePost(options));
  }
  for (const volumeId of [null, undefined, OTHER, true, ID + '\n']) {
    const options = postOptions(); options.volumeId = volumeId; assert.throws(() => preparePost(options));
  }
  const f = fixture(); f.options.capture.pins.sourceCommit = 'c'.repeat(40);
  assert.throws(() => preparePost(postOptions(f)));
});

test('post-bootstrap requires genuine recorded successful first-delete outcome, never ambiguous or absent ACK', () => {
  for (const settings of [{ noDelete: true }, { ambiguousDelete: true }, { duplicateDelete: true }, { duplicateCreate: true }]) {
    assert.throws(() => preparePost(postOptions(fixture(settings))));
  }
  const value = preparePost(postOptions(fixture({ lostCreate: true })));
  assert.equal(value.history.createAttempt.outcome, 'TaskTimedOut');
  assert.equal(value.history.firstDeleteAttempt.outcome, 'TaskSucceeded');
  assert.equal(value.history.uncertain, true); assert.equal(value.cleanup, 'UNKNOWN');
});

test('post-bootstrap refuses corrupt, truncated, incomplete, token-ambiguous and foreign owned raw history', () => {
  const truncated = fixture(); truncated.events[0].executionStartedEventDetails.inputDetails.truncated = true; truncated.pack();
  assert.throws(() => preparePost(postOptions(truncated)));
  const missing = fixture(); missing.events.pop(); missing.pack(); assert.throws(() => preparePost(postOptions(missing)));
  for (const token of [null, false, 'unconsumed']) {
    const f = fixture(), c = f.options.capture; c.pages[0].responseRaw = raw({ events: f.events, nextToken: token });
    c.pins.pages[0].responseSha256 = sha(c.pages[0].responseRaw); assert.throws(() => preparePost(postOptions(f)));
  }
  const duplicateJson = fixture(), c = duplicateJson.options.capture;
  c.pages[0].responseRaw = Buffer.from('{"events":[],"events":[]}');
  c.pins.pages[0].responseSha256 = sha(c.pages[0].responseRaw); assert.throws(() => preparePost(postOptions(duplicateJson)));
  const foreign = fixture(); changeOutput(foreign, 'DescribeOwned', out => ({ Volumes: [{ ...out.Volumes[0], Tags: [] }] }));
  assert.throws(() => preparePost(postOptions(foreign)));
});

test('post-bootstrap extras, nonfinite raw history and accessors refuse without invoking their getter', () => {
  for (const extra of [{ admission: true }, { runtimeAdmitted: true }, { probeAtMs: T + 1 }, { caller: {} }, { rawCreate: {} }]) {
    const options = postOptions(); Object.assign(options, extra); assert.throws(() => preparePost(options));
  }
  let touched = 0;
  for (const [location, key] of [['options', 'capture'], ['proofClock', 'approvedAtMs'], ['expected', 'sourceCommit'],
    ['originalClock', 'C'], ['capture', 'pages']]) {
    const options = postOptions(), target = location === 'options' ? options : options[location];
    Object.defineProperty(target, key, { get() { touched++; return 'untrusted'; } });
    assert.throws(() => preparePost(options));
  }
  assert.equal(touched, 0);
  const f = fixture(), c = f.options.capture;
  c.pages[0].responseRaw = Buffer.from('{"events":[],"extra":1e309}');
  c.pins.pages[0].responseSha256 = sha(c.pages[0].responseRaw); assert.throws(() => preparePost(postOptions(f)));
});

test('post-bootstrap result is detached frozen evidence and produces no source9 receipt, raw capture or authority', () => {
  const options = postOptions(), value = preparePost(options);
  options.proofClock.expiresAtMs++; options.expected.sourceCommit = 'c'.repeat(40);
  options.capture.pages[0].responseRaw.fill(0);
  assert.equal(value.proofClock.expiresAtMs, T + 1600000);
  assert.equal(value.externalIdentity.sourceCommit, 'b'.repeat(40));
  assert.ok(Object.isFrozen(value.proofClock)); assert.ok(Object.isFrozen(value.history.ownership.direct.volume.Tags));
  assert.ok(Object.isFrozen(value.requestIntents[1].arguments.VolumeIds));
  for (const key of ['nonce', 'caller', 'rawCreate', 'deleteAck', 'ownerInput', 'definition', 'admission', 'capture']) {
    assert.equal(Object.hasOwn(value, key), false);
  }
  assert.equal(Object.hasOwn(value, 'clock'), false); // never relabel the proof clock as fixture clock
  assert.equal(Object.hasOwn(value.history, 'pages'), false);
  assert.match(value.limitations.join(' '), /actual time/);
  assert.match(value.limitations.join(' '), /cannot prove cleanup before original C/);
});
