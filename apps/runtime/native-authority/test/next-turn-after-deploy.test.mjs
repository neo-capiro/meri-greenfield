// A conversation survives a deploy (O102, adj-e-SESSION-REFUSED-AFTER-CANCEL.md §4 step 4): every image release changes the runtime
// versions' imageDigest (and may change skillsDigest), and the next turn runs under the new release's versions. Its SDK session depends
// only on the SDK, CLI, contract and checkpoint formats (packages/contracts/session-continuity.mjs), so the next turn still resumes the
// conversation's latest published checkpoint, through the real next-run owner and journal, continuation runtime, checkpoint restorer and
// task router (next-turn-composition-fixture.mjs). Live 2026-10-21 (candidate 9 → 10): every conversation started before the deploy was
// refused after it. Control's session issuance (prepared-candidate.mjs, adj-e §4b) is E's; this covers the next-run journal and lineage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {conversation, id} from './next-turn-composition-fixture.mjs';
import {versions} from '../../../control/conversations/test/lifecycle-fixture.mjs';

const imageOnly = {...versions, imageDigest: 'sha256:' + '5'.repeat(64)}, released = {...imageOnly, skillsDigest: 'c'.repeat(64)};

async function resumesTurnOne(r, first) {
  assert.ok(r.lineage, 'the next turn continues the conversation: it has next-turn lineage');
  assert.deepEqual(r.lineage.nextTurn.checkpoint.binding, first.binding);
  assert.deepEqual(r.lineage.nextTurn.checkpoint.versions, versions, 'the checkpoint was captured under the earlier release');
  const prepared = await r.prepare();
  assert.equal(prepared.sdkSessionKey.sessionId, id(850), 'the SDK resumes turn 1\'s session under the new release');
  assert.equal((await r.restoration()).state, 'RESTORED');
  assert.deepEqual(r.restored[0].files.map(file => Buffer.from(file.base64, 'base64').toString()), ['captured']);
}

test('turn 1 completes, an image-only redeploy ships, turn 2 runs under the new image and resumes turn 1\'s session', async t => {
  const c = await conversation(t), first = await c.firstCompleted();
  c.deploy(imageOnly);
  const second = await c.acceptNext('A second prompt after the redeploy');
  await resumesTurnOne(await c.runner(second, id(851)), first);
});

test('turn 1 completes, a release with new image and skills digests ships, turn 2 resumes turn 1\'s session', async t => {
  const c = await conversation(t), first = await c.firstCompleted();
  c.deploy(released);
  const second = await c.acceptNext('A second prompt after the release');
  await resumesTurnOne(await c.runner(second, id(851)), first);
});

test('turn 1 completes, turn 2 fails, a release ships: turn 3 resumes turn 1\'s session', async t => {
  const c = await conversation(t), first = await c.firstCompleted();
  const second = await c.acceptNext('A second prompt');
  await c.endTurn(second, 'failed', 'EXECUTION_FAILED');
  c.deploy(released);
  const third = await c.acceptNext('A third prompt after the release');
  await resumesTurnOne(await c.runner(third, id(852)), first);
});

test('a release that changes the SDK or CLI refuses the next turn with NEXT_TURN_SDK_CHANGED, before anything is resumed', async t => {
  for (const change of [{sdk: '0.3.296'}, {cli: '2.1.296'}]) {
    const c = await conversation(t);
    await c.firstCompleted();
    c.deploy({...imageOnly, ...change});
    await assert.rejects(c.acceptNext('A second prompt after an SDK bump'), /NEXT_TURN_SDK_CHANGED/);
  }
});
