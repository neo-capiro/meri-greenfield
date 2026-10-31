import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { compileNativeWatchdogDefinition } from './workflow.mjs';

// Exact pinned evaluator: JSONata 2.0.6, same raw SHA256 the legacy browser suite requires.
// No install, network call, AWS mock or OS callback is used at test time.
const evaluatorPath = process.env.MERI_TEST_JSONATA;
assert.equal(typeof evaluatorPath, 'string', 'Explicit retained JSONata evaluator required');
assert.equal(createHash('sha256').update(readFileSync(evaluatorPath)).digest('hex'),
  '8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b');
const jsonata = createRequire(import.meta.url)(evaluatorPath);

// Executes the actual compiled native-watchdog expressions. Choice routing follows the real ASL order
// (first true condition wins, otherwise Default). API results, the clock and service duration are synthetic:
// this is expression/transition qualification, not AWS behavior, timing or physical-survival proof.
const def = compileNativeWatchdogDefinition(), S = def.States;
const accountId = '967807252336', region = 'us-east-1';
const hostId = '0f8fad5b-d9cb-469f-a165-70867728950e', generation = 1;
const instanceId = 'i-0123456789abcdef0', rootVolumeId = 'vol-0123456789abcdef0';
const eni = 'eni-0123456789abcdef0', sg = 'sg-0123456789abcdef0';
const provisionToken = '4'.repeat(64), allocationSha256 = 'c'.repeat(64);
const T0 = 1793441668691, leaseDeadlineMs = T0 + 60000, cleanupCeilingMs = T0 + 85000;
const input = { schema: 'meri-native-watchdog-input/1', hostId, generation, accountId, region, provisionToken,
  allocationSha256, sourceCommit: 'd'.repeat(40), imageDigest: `sha256:${'e'.repeat(64)}`,
  bootstrapSha256: 'f'.repeat(64), placementSha256: '1'.repeat(64), launchSha256: '2'.repeat(64),
  controlPolicySha256: '3'.repeat(64), originalT0Ms: T0, deadlineMs: cleanupCeilingMs,
  leaseDeadlineMs, cleanupCeilingMs, executionName: `${hostId}-g1`,
  placement: { vpcId: 'vpc-0123456789abcdef0', subnetId: 'subnet-0123456789abcdef0', securityGroupIds: [sg] },
  launch: { ImageId: 'ami-0123456789abcdef0' } };

async function evaluate(value, ctx, { result = {}, error = {}, ms = T0 } = {}) {
  if (typeof value !== 'string' || !value.startsWith('{% ')) {
    if (Array.isArray(value)) return Promise.all(value.map(entry => evaluate(entry, ctx, { result, error, ms })));
    if (value && typeof value === 'object')
      return Object.fromEntries(await Promise.all(Object.entries(value)
        .map(async ([key, entry]) => [key, await evaluate(entry, ctx, { result, error, ms })])));
    return value;
  }
  const expression = jsonata(value.slice(3, -3));
  expression.registerFunction('now', () => new Date(ms).toISOString(), '<:s>');
  return expression.evaluate({}, { ctx, states: { input, result, errorOutput: error } });
}
const initialized = () => evaluate(S.Initialize.Assign.ctx, {});
const deadlineMs = cleanupCeilingMs;

// Faithful Choice routing: the first satisfied condition wins, otherwise Default.
async function route(name, ctx, ms = T0, result = {}) {
  const state = S[name];
  assert.ok(state && state.Type === 'Choice', `${name} must be a Choice`);
  for (const branch of state.Choices ?? [])
    if (await evaluate(branch.Condition, ctx, { ms, result })) return branch.Next;
  assert.equal(state.Default !== undefined, true, `${name} must define Default`);
  return state.Default;
}

// The machine binds $ctx.last from a Task's result (or $ctx.lastError from its Catch) before the next state.
const applyTask = (name, ctx, result, ms = T0) => evaluate(S[name].Assign.ctx, ctx, { result, ms });
const applyCatch = (name, ctx, error, ms = T0) => evaluate(S[name].Catch[0].Assign.ctx, ctx, { error, ms });

test('D1/D2: legacy admission is disabled and shared prearm wait wakes at the workload lease',async()=>{
 assert.equal(await route('AdmissionGuard',{}),'SourceOnlyRefusal');
 const ctx=await initialized();
 assert.equal(await evaluate(S.PrearmWait.Seconds,ctx,{ms:leaseDeadlineMs-5000}),5);
 assert.equal(ctx.cleanupCeilingMs,leaseDeadlineMs+25000);
});

test('every generated native expression parses under the pinned evaluator', () => {
  const visit = (value) => {
    if (typeof value === 'string' && value.startsWith('{% ')) jsonata(value.slice(3, -3));
    else if (value && typeof value === 'object') for (const entry of Object.values(value)) visit(entry);
  };
  visit(def);
  for (const [name, state] of Object.entries(S)) {
    for (const next of [state.Next, state.Default, ...(state.Choices ?? []).map(x => x.Next),
      ...(state.Catch ?? []).map(x => x.Next)].filter(Boolean))
      assert.ok(S[next], `${name} -> ${next}`);
  }
});

test('Initialize binds the original lease and cleanup ceilings and never extends them', async () => {
  const ctx = await initialized();
  assert.equal(ctx.t0Ms, T0); assert.equal(ctx.leaseDeadlineMs, leaseDeadlineMs);
  assert.equal(ctx.cleanupCeilingMs, cleanupCeilingMs); assert.equal(ctx.deadlineMs, deadlineMs);
  assert.equal(ctx.provisionToken, provisionToken); assert.deepEqual(ctx.owned, []); assert.equal(ctx.token, null);
});

test('the first page carries no NextToken and a retained token is sent back verbatim', async () => {
  const ctx = await initialized();
  const first = await evaluate(S.DiscoverFirst.Arguments, ctx);
  assert.equal(Object.hasOwn(first, 'NextToken'), false);
  assert.equal(first.MaxResults, 100);
  assert.deepEqual(first.Filters, [{ Name: 'tag:MeriProvisionToken', Values: [provisionToken] }]);
  const next = await evaluate(S.DiscoverNext.Arguments, { ...ctx, token: 'opaque+/=token' });
  assert.equal(next.NextToken, 'opaque+/=token');
  assert.deepEqual({ ...next, NextToken: undefined }, { ...first, NextToken: undefined });
});

test('TimeGate orders the original lease before any discovery and the ceiling before any page', async () => {
  const ctx = await initialized();
  assert.equal(await route('TimeGate', ctx, T0 + 1000), 'PrearmWait');
  assert.equal(await route('TimeGate', ctx, leaseDeadlineMs), 'PageRoute');
  assert.equal(await route('TimeGate', ctx, cleanupCeilingMs - 1), 'PageRoute');
  assert.equal(await route('TimeGate', ctx, cleanupCeilingMs), 'Unknown');
  assert.equal(await route('TimeGate', ctx, cleanupCeilingMs + 1), 'Unknown');
});

test('PageCheck bounds paging and PageRoute selects the exact page shape', async () => {
  const ctx = await initialized();
  assert.equal(await route('PageCheck', { ...ctx, token: 'opaque', pages: 1 }), 'PageGate');
  assert.equal(await route('PageCheck', { ...ctx, token: 'opaque', pages: 20 }), 'ScanUnknown');
  assert.equal(await route('PageCheck', { ...ctx, token: null, pages: 3 }), 'HasOwned');
  assert.equal(await route('PageRoute', { ...ctx, token: null }), 'DiscoverFirst');
  assert.equal(await route('PageRoute', { ...ctx, token: 'opaque' }), 'DiscoverNext');
});

test('every read gate stops at the ORIGINAL cleanup ceiling and never renews it', async () => {
  const ctx = await initialized();
  for (const gate of ['PageGate', 'OwnedGate', 'EniGate']) {
    assert.equal(await route(gate, ctx, cleanupCeilingMs - 1), gate === 'PageGate' ? 'PageRoute'
      : gate === 'OwnedGate' ? 'DescribeOwned' : 'ReadEni', gate);
    assert.equal(await route(gate, ctx, cleanupCeilingMs), 'Unknown', gate);
    assert.equal(await route(gate, ctx, cleanupCeilingMs + 30000), 'Unknown', gate);
  }
  assert.equal(await route('EniSelect', { ...ctx, owned: [{ instanceId, rootVolumeId, networkInterfaceIds: [eni] }],
    eniIndex: 0 }), 'EniGate');
  assert.equal(await route('EniSelect', { ...ctx, owned: [{ instanceId, rootVolumeId, networkInterfaceIds: [eni] }],
    eniIndex: 1 }), 'RoundEnd');
});

const tags = [{ Key: 'MeriProvisionToken', Value: provisionToken }, { Key: 'MeriHostId', Value: hostId },
  { Key: 'MeriGeneration', Value: String(generation) }, { Key: 'MeriAllocationSha256', Value: allocationSha256 }];
const owned = (over = {}) => ({ InstanceId: instanceId, ImageId: input.launch.ImageId,
  VpcId: input.placement.vpcId, SubnetId: input.placement.subnetId, RootDeviceName: '/dev/xvda',
  BlockDeviceMappings: [{ DeviceName: '/dev/xvda', Ebs: { VolumeId: rootVolumeId, DeleteOnTermination: true } }],
  Tags: tags.map(tag => ({ ...tag })),
  NetworkInterfaces: [{ NetworkInterfaceId: eni, Attachment: { DeviceIndex: 0 },
    OwnerId: accountId, VpcId: input.placement.vpcId, SubnetId: input.placement.subnetId,
    Groups: [{ GroupId: sg }] }], State: { Name: 'running' }, ...over });
const page = rows => ({ Reservations: [{ OwnerId: accountId, Instances: rows }] });

test('RetainOwned keeps exactly the positively tagged instance and the accepted token', async () => {
  const ctx = await initialized();
  const foreign = owned(); foreign.Tags[0].Value = 'f'.repeat(64);
  const observed = await applyTask('DiscoverFirst', ctx, { ...page([foreign, owned()]), NextToken: 'opaque+/=' });
  assert.equal(observed.pages, 1);
  const retained = await evaluate(S.RetainOwned.Assign.ctx, observed);
  assert.equal(retained.owned.length, 1);
  assert.equal(retained.owned[0].instanceId, instanceId);
  assert.deepEqual(retained.owned[0].networkInterfaceIds, [eni]);
  assert.equal(retained.owned[0].rootVolumeId, rootVolumeId);
  assert.equal(retained.token, 'opaque+/='); assert.equal(retained.index, 0);
  const lastPage = await evaluate(S.RetainOwned.Assign.ctx, await applyTask('DiscoverNext', observed, page([owned()])));
  assert.equal(lastPage.owned.length, 1); assert.equal(lastPage.token, null);
  // A page with no positively tagged instance never invents an owned row.
  const empty = await evaluate(S.RetainOwned.Assign.ctx, await applyTask('DiscoverFirst', ctx, page([foreign])));
  assert.deepEqual(empty.owned, []); assert.equal(empty.token, null);
});

test('a host with several network interfaces keeps every id and the per-ENI loop indexes each one', async () => {
  const ids = [eni, 'eni-fedcba98765432100', 'eni-11111111111111111'];
  const many = owned({ NetworkInterfaces: ids.map((id, deviceIndex) => ({ NetworkInterfaceId: id,
    Attachment: { DeviceIndex: deviceIndex }, OwnerId: accountId, VpcId: input.placement.vpcId,
    SubnetId: input.placement.subnetId, Groups: [{ GroupId: sg }] })) });
  const retained = await evaluate(S.RetainOwned.Assign.ctx,
    await applyTask('DiscoverFirst', await initialized(), page([many])));
  assert.deepEqual(retained.owned[0].networkInterfaceIds, ids);
  for (const eniIndex of ids.keys()) {
    assert.equal(await route('EniSelect', { ...retained, index: 0, eniIndex }), 'EniGate');
    const args = await evaluate(S.ReadEni.Arguments, { ...retained, index: 0, eniIndex });
    assert.deepEqual(args.NetworkInterfaceIds, [ids[eniIndex]]);
  }
  assert.equal(await route('EniSelect', { ...retained, index: 0, eniIndex: ids.length }), 'RoundEnd');
});

test('CheckOwned accepts only one exact identity with the exact tags, placement and one allowed group', async () => {
  const base = { ...(await initialized()), index: 0,
    owned: [{ instanceId, rootVolumeId, networkInterfaceIds: [eni] }] };
  const check = async value => route('CheckOwned', await applyTask('DescribeOwned', base, value));
  assert.equal(await check(page([owned()])), 'IsTerminated');
  const rejects = {
    empty: {},
    foreignOwner: { Reservations: [{ OwnerId: '111111111111', Instances: [owned()] }] },
    extraInstance: { Reservations: [{ OwnerId: accountId, Instances: [owned(), owned()] }] },
    changedGeneration: page([owned({ Tags: [{ ...tags[0] }, { ...tags[1] },
      { Key: 'MeriGeneration', Value: '2' }, { ...tags[3] }] })]),
    missingToken: page([owned({ Tags: tags.slice(1) })]),
    wrongImage: page([owned({ ImageId: 'ami-foreign' })]),
    wrongPlacement: page([owned({ SubnetId: 'subnet-foreign' })]),
    foreignGroup: page([owned({ NetworkInterfaces: [{ OwnerId: accountId, VpcId: input.placement.vpcId,
      SubnetId: input.placement.subnetId, Groups: [{ GroupId: 'sg-foreign' }] }] })]),
    foreignOwnerNi: page([owned({ NetworkInterfaces: [{ OwnerId: '111111111111', VpcId: input.placement.vpcId,
      SubnetId: input.placement.subnetId, Groups: [{ GroupId: sg }] }] })]) };
  for (const [name, value] of Object.entries(rejects))
    assert.equal(await check(value), 'MarkUncertain', name);
});

test('ENI observations step per resource and never count presence or an unqualified error as absence', async () => {
  const ctx = await initialized();
  const absent = await evaluate(S.EniAbsent.Assign.ctx, { ...ctx, eniIndex: 0 });
  assert.equal(absent.eniIndex, 1);
  const present = await evaluate(S.EniPresent.Assign.ctx, { ...ctx, eniIndex: 0 });
  assert.equal(present.eniIndex, 1); assert.equal(present.roundValid, false);
  const unknown = await evaluate(S.EniUnknown.Assign.ctx, { ...ctx, eniIndex: 0 });
  assert.equal(unknown.roundValid, false); assert.equal(unknown.eniUnknown, true);
  assert.equal(await route('EniError', { ...ctx, lastError: { Error: 'InvalidNetworkInterfaceID.NotFound' } }),
    'EniAbsent');
  for (const error of ['InvalidNetworkInterfaceID.Unavailable', 'AccessDenied', 'Throttling'])
    assert.equal(await route('EniError', { ...ctx, lastError: { Error: error } }), 'EniUnknown', error);
});

test('root absence is mapped from the one documented wire code only; every other outcome stays unproven', async () => {
  const base = { ...(await initialized()), owned: [{ instanceId, rootVolumeId, networkInterfaceIds: [eni] }] };
  const rootState = async volumes => route('RootState', await applyTask('ReadRoot', base, { Volumes: volumes }));
  assert.equal(await rootState([{ VolumeId: rootVolumeId, State: 'deleted' }]), 'RootAbsent');
  assert.equal(await rootState([{ VolumeId: rootVolumeId, State: 'in-use' }]), 'RootPresent');
  assert.equal(await rootState([]), 'RootPresent');
  assert.equal(await route('RootState', { ...base, last: { Volumes: [{ VolumeId: 'vol-fedcba98765432100',
    State: 'deleted' }] } }), 'RootPresent');
  const rootError = async error => route('RootError', await applyCatch('ReadRoot', base, error));
  assert.equal(await rootError({ Error: 'InvalidVolume.NotFound' }), 'RootAbsent');
  for (const error of ['InvalidVolume.Unavailable', 'AccessDenied', 'ClientError', 'InvalidVolume.NotFound.Foo'])
    assert.equal(await rootError({ Error: error }), 'RootPresent', error);
  // No invented code is embedded: the definition names only these two documented wire codes.
  const codes = JSON.stringify(def).match(/Invalid(?:Volume|NetworkInterfaceID)\.[A-Za-z.]+/gu) ?? [];
  assert.deepEqual([...new Set(codes)].sort(), ['InvalidNetworkInterfaceID.NotFound', 'InvalidVolume.NotFound']);
  // An unqualified/absent wire code is retained as uncertainty, not converted into a positive absence.
  assert.match(S.RootPresent.Assign.ctx, /uncertain/);
});

// Executed statement of the OPEN Phase 2 producer gap, so it cannot be closed silently.
test('the confirmed graph output still omits discoveryComplete and physicalEvidence', async () => {
  const ctx = { ...(await initialized()), owned: [{ instanceId, rootVolumeId, networkInterfaceIds: [eni] }],
    rootAbsentRounds: 2, roundValid: true };
  const out = await evaluate(S.Confirmed.Output, ctx);
  assert.equal(out.schema, 'meri-native-watchdog-result/1');
  assert.equal(out.cleanup, 'TERMINATED_AND_CORRELATED_ABSENT');
  assert.equal(Object.hasOwn(out, 'physicalEvidence'), false, 'producer evidence is still absent');
  assert.equal(Object.hasOwn(out, 'discoveryComplete'), false, 'discovery completeness is still absent');
  const unknown = await evaluate(S.Unknown.Output, { ...ctx, uncertain: true, terminations: 1 });
  assert.equal(unknown.cleanup, 'UNKNOWN');
  assert.equal(Object.hasOwn(unknown, 'physicalEvidence'), false);
});
