// A second turn in the same conversation, after a first turn that completed through the real end-of-turn chain
// (next-turn-composition-fixture.mjs): turn 2 claims `starting`, and control's continuation runtime and checkpoint restorer restore
// turn 1's checkpoint into turn 2's runner receiver.
// Live 2026-10-21 05:58:53Z (candidate 8, conversation c80fce86): turn 2's runner/runtime answered 503 and the turn failed
// EXECUTION_FAILED at runtime-admission. The restoration journal refused its claim because the run was `starting`, not `queued`; no
// restoration row was written.
import test from 'node:test';
import assert from 'node:assert/strict';
import {conversation, id} from './next-turn-composition-fixture.mjs';

/** Turn 1 completed and retired, turn 2 accepted, loaded and claimed `starting`. */
async function secondTurn(t) {
  const c = await conversation(t);
  await c.firstCompleted();
  return c.runner(await c.acceptNext('A second prompt about the first answer'), id(851));
}

test('a second turn claimed `starting` restores the first turn\'s checkpoint through the router and is admitted', async t => {
  const r = await secondTurn(t);
  const prepared = await r.prepare();
  assert.equal(prepared.sdkSessionKey.sessionId, id(850), 'the SDK resumes the first turn\'s session');
  assert.equal(prepared.restoreReceipt.checkpointSha256, r.lineage.nextTurn.checkpointSha256);
  assert.equal((await r.restoration()).state, 'RESTORED');
  // The first turn's workspace reached the second turn's runner through the router.
  assert.equal(r.restored.length, 1);
  assert.deepEqual(r.restored[0].files.map(file => Buffer.from(file.base64, 'base64').toString()), ['captured']);
});

test('a restoration is still refused once the turn is running, and nothing is restored', async t => {
  const r = await secondTurn(t);
  await r.claim('running');
  await assert.rejects(r.prepare(), /NATIVE_PREPARATION_STATE_REFUSED/);
  assert.equal(await r.restoration(), null);
  assert.equal(r.restored.length, 0);
});
