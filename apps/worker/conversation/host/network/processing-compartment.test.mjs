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
const expectedNamespacePath = `/run/netns/meri-processing-${canonicalSha256(binding).slice(0, 12)}`;

function ports({createFails = false, topologyFail = false, noopDelete = false, recreate = false,
  deleteFails = false, absentError = null} = {}) {
  const calls = [];
  const state = {dev: '41', ino: '42', links: [{ifname: topologyFail ? 'eth0' : 'lo'}], v4: [], v6: [], present: false};
  const execute = async ({file, args}) => {
    calls.push([file, ...args].join(' '));
    if (args[0] === 'netns' && args[1] === 'add') {
      if (createFails) throw Object.assign(Error('EEXIST'), {code: 'HOST_NETWORK_COMMAND_FAILED'});
      state.present = true;
      return {stdout: '', stderr: ''};
    }
    if (args[0] === 'netns' && args[1] === 'delete') {
      if (deleteFails) throw Object.assign(Error('BUSY'), {code: 'HOST_NETWORK_COMMAND_FAILED'});
      if (!noopDelete) state.present = false;
      if (recreate) state.present = true;
      return {stdout: '', stderr: ''};
    }
    if (args[0] === '-d') return {stdout: JSON.stringify(state.links), stderr: ''};
    if (args[0] === '-j' || args[0] === '-6') return {stdout: JSON.stringify(args[0] === '-6' ? state.v6 : state.v4), stderr: ''};
    return {stdout: '', stderr: ''};
  };
  const readNamespace = path => {
    state.path = path || state.path;
    if (!state.present) throw Object.assign(Error('HOST_NETWORK_NAMESPACE_UNKNOWN'), {code: 'HOST_NETWORK_NAMESPACE_UNKNOWN'});
    return {namespacePath: expectedNamespacePath, namespaceDev: state.dev, namespaceIno: state.ino};
  };
  const namespaceAbsent = path => {
    assert.equal(path, state.path, 'the observer is asked about the EXACT owned namespace path');
    if (absentError) { const error = Error(absentError); error.code = absentError; throw error; }
    return !state.present;
  };
  return {calls, state, execute, readNamespace, namespaceAbsent};
}
const open = (p, extra = {}) => prepareProcessingCompartment({allocation, binding, execute: p.execute,
  readNamespace: p.readNamespace, namespaceAbsent: p.namespaceAbsent, ...extra});

test('a processing compartment is loopback-only with no routes and verifies on every call', async () => {
  const p = ports();
  const compartment = await open(p);
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
  assert.equal(p.state.present, true, 'the synthetic namespace exists after add');
});

test('an added interface, an installed route or a changed namespace identity refuses verification', async () => {
  for (const mutate of [
    p => { p.state.links = [{ifname: 'lo'}, {ifname: 'eth0'}]; },
    p => { p.state.v4 = [{dst: 'default'}]; },
    p => { p.state.dev = '99'; },
  ]) {
    const p = ports();
    const compartment = await open(p);
    await compartment.verify();
    mutate(p);
    await assert.rejects(compartment.verify(), error => ['HOST_NETWORK_TOPOLOGY_REFUSED', 'HOST_NETWORK_NAMESPACE_UNKNOWN'].includes(error?.code));
  }
});

test('a failed netns add owns nothing and never deletes a namespace', async () => {
  const p = ports({createFails: true});
  await assert.rejects(open(p), error => error?.code === 'HOST_NETWORK_SETUP_FAILED');
  assert.equal(p.calls.some(call => call.includes('netns delete')), false, 'no namespace was created, so none is deleted');
  assert.equal(p.state.present, false);
});

test('close is idempotent, reports the exact owned absence, and a later verify refuses', async () => {
  const p = ports();
  const compartment = await open(p);
  assert.deepEqual(await compartment.close(), {closed: true});
  assert.equal(p.state.present, false, 'the namespace was deleted');
  assert.deepEqual(await compartment.close(), {closed: true});
  await assert.rejects(compartment.verify(), error => error?.code === 'HOST_NETWORK_UNVERIFIED');
});

test('close ACK while the exact namespace is still present or recreated is UNKNOWN, and replay sticks', async () => {
  for (const options of [{noopDelete: true}, {recreate: true}]) {
    const p = ports(options);
    const compartment = await open(p);
    const first = await compartment.close();
    assert.deepEqual(first, {closed: false, code: 'HOST_NETWORK_CLEANUP_UNKNOWN'});
    const replay = await compartment.close();
    assert.deepEqual(replay, first, 'the settled unknown result is replayed, not recomputed');
  }
});

test('a readback EACCES/EIO is UNKNOWN, never a removal claim', async () => {
  for (const code of ['EACCES', 'EIO']) {
    const p = ports({absentError: code});
    const compartment = await open(p);
    assert.deepEqual(await compartment.close(), {closed: false, code: 'HOST_NETWORK_CLEANUP_UNKNOWN'}, code);
  }
});

test('a failing delete command is UNKNOWN', async () => {
  const p = ports({deleteFails: true});
  const compartment = await open(p);
  assert.deepEqual(await compartment.close(), {closed: false, code: 'HOST_NETWORK_CLEANUP_UNKNOWN'});
});

test('a missing or invalid absence observer refuses BEFORE any netns add', async () => {
  for (const observer of [null, 'lstat', 42]) {
    const p = ports();
    await assert.rejects(open(p, {namespaceAbsent: observer}), error => error?.code === 'HOST_NETWORK_CONFIGURATION');
    assert.equal(p.calls.some(call => call.includes('netns add')), false, 'no namespace is created for an unverifiable close');
    assert.equal(p.calls.length, 0);
  }
});

test('setup unwind after a successful add reports removed only when the exact namespace is absent', async () => {
  const removed = ports({topologyFail: true});
  const error = await open(removed).then(() => null, e => e);
  assert.ok(error, 'the setup fails');
  assert.equal(error.partialCleanup, 'removed');
  assert.equal(removed.state.present, false, 'the namespace this call created was deleted');

  const stillPresent = ports({topologyFail: true, noopDelete: true});
  const presentError = await open(stillPresent).then(() => null, e => e);
  assert.equal(presentError.partialCleanup, 'unknown');

  const deleteFails = ports({topologyFail: true, deleteFails: true});
  const deleteError = await open(deleteFails).then(() => null, e => e);
  assert.equal(deleteError.partialCleanup, 'unknown');

  const observerFails = ports({topologyFail: true, absentError: 'EACCES'});
  const observerError = await open(observerFails).then(() => null, e => e);
  assert.equal(observerError.partialCleanup, 'unknown');
});
