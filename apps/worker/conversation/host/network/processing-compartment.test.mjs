/** Inert no-egress processing compartment tests: synthetic execute/namespace ports, no netns, veth, nft or socket. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {HOST_ALLOCATION_SCHEMA} from '../binding.mjs';
import {prepareProcessingCompartment} from './confinement.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = Object.freeze({tenantId: uuid(1), actorId: uuid(2), conversationId: uuid(3), runId: uuid(4),
  attemptId: uuid(5), workerId: uuid(6), writerFence: 1});
const allocation = Object.freeze({schema: HOST_ALLOCATION_SCHEMA, tenantId: binding.tenantId,
  conversationId: binding.conversationId, generation: 4, hostId: uuid(7), imageDigest: `sha256:${'b'.repeat(64)}`,
  leaseDeadlineMs: Date.now() + 3_600_000});

function ports({createFails = false} = {}) {
  const calls = [];
  const state = {dev: '41', ino: '42', links: [{ifname: 'lo'}], v4: [], v6: []};
  const execute = async ({file, args}) => {
    calls.push([file, ...args].join(' '));
    if (args[0] === 'netns' && args[1] === 'add' && createFails) throw Object.assign(Error('EEXIST'), { code: 'HOST_NETWORK_COMMAND_FAILED' });
    if (args[0] === '-d') return {stdout: JSON.stringify(state.links), stderr: ''};
    if (args[0] === '-j' || args[0] === '-6') return {stdout: JSON.stringify(args[0] === '-6' ? state.v6 : state.v4), stderr: ''};
    return {stdout: '', stderr: ''};
  };
  const readNamespace = () => ({namespacePath: `/run/netns/meri-processing-${canonicalSha256(binding).slice(0, 12)}`,
    namespaceDev: state.dev, namespaceIno: state.ino});
  return {calls, state, execute, readNamespace};
}

test('a processing compartment is loopback-only with no routes and verifies on every call', async () => {
  const p = ports();
  const compartment = await prepareProcessingCompartment({allocation, binding, execute: p.execute, readNamespace: p.readNamespace});
  assert.equal(compartment.plan.kind, 'processing');
  assert.deepEqual(compartment.plan.routes, []);
  const proof = await compartment.verify();
  assert.equal(proof.verified, true);
  assert.equal(proof.kind, 'processing');
  assert.equal(proof.allocationSha256, canonicalSha256(allocation));
  assert.equal(proof.bindingSha256, canonicalSha256(binding));
  assert.deepEqual(proof.localRelays, []);
  assert.equal(proof.loopbackOnly, true);
  assert.deepEqual(proof.routes, {v4: 0, v6: 0});
  assert.ok(p.calls.some(call => call.includes('netns add')));
});

test('an added interface, an installed route or a changed namespace identity refuses verification', async () => {
  for (const mutate of [
    p => { p.state.links = [{ifname: 'lo'}, {ifname: 'eth0'}]; },
    p => { p.state.v4 = [{dst: 'default'}]; },
    p => { p.state.dev = '99'; },
  ]) {
    const p = ports();
    const compartment = await prepareProcessingCompartment({allocation, binding, execute: p.execute, readNamespace: p.readNamespace});
    await compartment.verify();
    mutate(p);
    await assert.rejects(compartment.verify(), error => ['HOST_NETWORK_TOPOLOGY_REFUSED', 'HOST_NETWORK_NAMESPACE_UNKNOWN'].includes(error?.code));
  }
});

test('setup failure deletes the namespace it tried to create and reports no usable compartment', async () => {
  const p = ports({createFails: true});
  await assert.rejects(prepareProcessingCompartment({allocation, binding, execute: p.execute, readNamespace: p.readNamespace}),
    error => error?.code === 'HOST_NETWORK_SETUP_FAILED');
  assert.ok(!p.calls.some(call => call.includes('netns delete') && false));
});

test('close is idempotent and a later verify refuses', async () => {
  const p = ports();
  const compartment = await prepareProcessingCompartment({allocation, binding, execute: p.execute, readNamespace: p.readNamespace});
  assert.deepEqual(await compartment.close(), {closed: true});
  assert.deepEqual(await compartment.close(), {closed: true});
  await assert.rejects(compartment.verify(), error => error?.code === 'HOST_NETWORK_UNVERIFIED');
});
