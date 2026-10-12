import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandAuthority, createSourceDisabledGateway } from '../index.mjs';
import { createCurrentToolAuthority } from '../authorization/current-tool-authority.mjs';
import { fixture, NOW, limits, uuid } from './fixtures.mjs';

function setup(actions = ['command.execute']) {
  const f = fixture(); f.claims.actions = actions;
  f.descriptor.operation = { id: 'task.create', version: '0.2.0' };
  f.descriptor.requiredGrants = ['command.execute'];
  const business = f.ports.authorizeBusiness;
  f.ports.authorizeBusiness = async (...args) => {
    const value = JSON.parse(await business(...args));
    value.decision.operation = 'task.create@0.2.0'; value.grants = ['command.execute'];
    return JSON.stringify(value);
  };
  const options = { authorityPorts: f.ports, now: () => f.state.now, maxFactBytes: 65536 };
  const authority = createCommandAuthority(options);
  const deadlines = [];
  const request = { credential: 'synthetic-capability', descriptor: f.descriptor,
    input: {}, signal: new AbortController().signal, limitDeadline: value => deadlines.push(value) };
  return { ...f, options, authority, request, deadlines };
}

test('command authority reuses all four fresh ports and publishes validated deadlines', async () => {
  const f = setup(); const result = await f.authority.check(f.request);
  assert.deepEqual(f.calls, ['capability', 'fence', 'policy', 'source-policy', 'fence']);
  assert.deepEqual(result.binding, f.binding);
  assert.deepEqual(result.claims.actions, ['command.execute']);
  assert.equal(result.decision.operation, 'task.create@0.2.0');
  assert.deepEqual(f.deadlines, [NOW + 10000, NOW + 10000]);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.claims));
});

for (const actions of [['tool.read'], ['command.propose'], ['artifact.publish']]) {
  test(`command authority refuses ${actions[0]} before later ports`, async () => {
    const f = setup(actions); await assert.rejects(f.authority.check(f.request), {name: 'GatewayDenied', message: 'ACCESS_DENIED'});
    assert.deepEqual(f.calls, ['capability']);
  });
}

test('original authority still requires tool.read when no action is configured', async () => {
  const f = setup();
  const original = createCurrentToolAuthority({ports: f.ports, now: f.options.now, maxFactBytes: 65536});
  await assert.rejects(original.check(f.request), {name: 'GatewayDenied', message: 'ACCESS_DENIED'});
  assert.deepEqual(f.calls, ['capability']);
});

test('fixed command authority cannot be changed through caller configuration', () => {
  const f = setup();
  assert.throws(() => createCommandAuthority({...f.options, capabilityAction: 'tool.read'}), {name: 'GatewayDenied', message: 'GATEWAY_CONFIGURATION'});
  for (const capabilityAction of ['', 'command.propose', 'artifact.publish', ['command.execute'], null]) {
    assert.throws(() => createCurrentToolAuthority({ports: f.ports, now: f.options.now,
      maxFactBytes: 65536, capabilityAction}), {name: 'GatewayDenied', message: 'GATEWAY_CONFIGURATION'});
  }
  assert.deepEqual(f.calls, []);
});

for (const kind of ['revoked', 'expired', 'stale-fence', 'source-disabled']) {
  test(`command authority retains ${kind} refusal`, async () => {
    const f = setup();
    if (kind === 'revoked') f.state.revoked = true;
    if (kind === 'expired') f.claims.expiresAt = new Date(NOW).toISOString();
    if (kind === 'stale-fence') f.state.fence = 2;
    if (kind === 'source-disabled') f.state.sourceEnabled = false;
    await assert.rejects(f.authority.check(f.request), {name: 'GatewayDenied', message: 'ACCESS_DENIED'});
  });
}

test('capability expiry is published before a parked command run fact', async () => {
  const f = setup(); const controller = new AbortController(); let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  let release; const parked = new Promise(resolve => { release = resolve; });
  const original = f.ports.currentRun;
  f.ports.currentRun = async (...args) => { entered(); await parked; return original(...args); };
  const pending = f.authority.identify({...f.request, signal: controller.signal});
  await waiting; assert.deepEqual(f.deadlines, [NOW + 10000]);
  // The canonical outer lifetime owns waiting/cancellation. This lower port does
  // not turn a cancellation into proof that parked external work has stopped.
  controller.abort(); release();
  await assert.rejects(pending, {name: 'GatewayDenied', message: 'ACCESS_DENIED'});
});

test('new authority factory does not activate the production gateway', async () => {
  const f = fixture(); const gateway = createSourceDisabledGateway({authorityPorts: f.ports,
    budget: f.budget, limits, now: () => f.state.now, newId: () => uuid('7')});
  assert.equal(gateway.sourceEnabled, false);
  assert.equal(gateway.status, 'SOURCE_ONLY_NO_PRODUCTION_ADAPTERS');
  assert.deepEqual(f.calls, []);
});
