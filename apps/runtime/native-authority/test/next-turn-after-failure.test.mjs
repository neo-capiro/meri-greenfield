// A next turn after a failed or cancelled turn continues the conversation's latest published checkpoint (O97, 2026-10-21): turn 1
// completes through the real end-of-turn chain, turn 2 fails or is Stopped, and turn 3's runner resumes turn 1's SDK session with its
// workspace, through the real next-run owner and journal, control's continuation runtime and checkpoint restorer and the task router
// (next-turn-composition-fixture.mjs). The failed or cancelled run itself has no checkpoint and is never the lineage.
// Live 2026-10-21 (candidate 9, conversation 307e2e94): turn 2 failed at native prepare; turn 3's reservation carried no checkpoint and
// it started a new SDK session (b5d80e62), not turn 1's (241c8292): everything Meri knew about the conversation was gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import {conversation, id} from './next-turn-composition-fixture.mjs';

for (const [label, state, reasonCode] of [['fails', 'failed', 'EXECUTION_FAILED'], ['is cancelled by Stop', 'cancelled', 'USER_CANCELLED']]) {
  test(`turn 1 completes and turn 2 ${label}: turn 3 resumes turn 1's session with its history`, async t => {
    const c = await conversation(t), first = await c.firstCompleted();
    const second = await c.acceptNext('A second prompt about the first answer');
    await c.endTurn(second, state, reasonCode);
    const third = await c.acceptNext('A third prompt after the second turn ' + state);
    assert.equal(third.writerFence, 3);
    const r = await c.runner(third, id(852));
    assert.ok(r.lineage, 'turn 3 continues the conversation: it has next-turn lineage');
    // Turn 1, not the failed or cancelled turn 2, is the lineage: its checkpoint and its request (the continued context).
    assert.deepEqual(r.lineage.nextTurn.checkpoint.binding, first.binding);
    assert.deepEqual(r.lineage.nextTurn.sourceRequest, first.request);
    const prepared = await r.prepare();
    assert.equal(prepared.sdkSessionKey.sessionId, id(850), 'the SDK resumes turn 1\'s session');
    assert.equal(prepared.restoreReceipt.checkpointSha256, r.lineage.nextTurn.checkpointSha256);
    assert.equal((await r.restoration()).state, 'RESTORED');
    // Turn 1's workspace reached turn 3's runner through the router.
    assert.equal(r.restored.length, 1);
    assert.deepEqual(r.restored[0].files.map(file => Buffer.from(file.base64, 'base64').toString()), ['captured']);
  });
}
