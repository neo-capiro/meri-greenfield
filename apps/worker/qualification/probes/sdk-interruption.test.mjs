import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runInterruptionPhase, main } from './sdk-interruption.mjs';
import { validateScenario, buildInterruptionOptions, ACTIVE_MARKER, CONTINUITY_MARKER } from './sdk-interruption-options.mjs';
import { buildCaptureOptions, buildCaptureEnv } from './sdk-capture-options.mjs';

const runUuid = 'c446abef-2b04-4843-9849-fb8ec423b178';
const sessionId = '6355ba81-d7fd-4ad3-ae7c-e27a5ed5692f';
function scenario() { const t0Ms = Date.now() - 1000; return { runUuid, sessionId, t0Ms,
  deadlineMs: t0Ms + 720000, cleanupDeadlineMs: t0Ms + 900000, phaseDeadlineMs: Date.now() + 2000 }; }
const init = { type: 'system', subtype: 'init', session_id: sessionId };
const delta = text => ({ type: 'stream_event', session_id: sessionId,
  event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } });
function fixture(phase = 'interrupt') {
  const events = [], child = new EventEmitter(); child.exitCode = null;
  child.kill = () => { events.push('kill'); child.exitCode = 0; child.emit('exit', 0, null); };
  const messages = [init, delta(phase === 'interrupt' ? ACTIVE_MARKER : CONTINUITY_MARKER)];
  if (phase === 'resume') messages.push({ type: 'result', subtype: 'success', is_error: false,
    session_id: sessionId, result: `Continuity ${runUuid}` });
  const f = { scenario: scenario(), phase, port: 1234, events, messages,
    bundle: { opaque: 'unknown bytes preserved by canonical adapter' }, reference: { immutable: 'ref' },
    gateway: { authorize: async ctx => { events.push(`auth:${ctx.attempt}`); return ctx.attempt === (phase === 'interrupt' ? 1 : 2); } },
    checkpoint: { commit: async () => { events.push('commit'); return { immutable: 'ref' }; },
      verify: async () => { events.push('verify'); return true; } },
    sessionFiles: { capture: () => { events.push('capture'); return f.bundle; },
      restore: () => { events.push('restore'); } },
    host: { spawn: (_options, record) => { record.stdioDone = Promise.resolve(); return child; },
      query: ({ options }) => {
        events.push('query');
        options.spawnClaudeCodeProcess({ command: 'FAKE', args: [], env: options.env, cwd: options.cwd });
        return { async *[Symbol.asyncIterator]() { yield* messages; },
          interrupt: async () => { events.push('interrupt'); return { still_queued: [] }; },
          close: () => { events.push('close'); child.exitCode = 0; child.emit('exit', 0, null); } };
      } } };
  return f;
}
test('only supported persistence/resume deltas from canonical options', () => {
  const s = scenario(), args = { scenario: s, port: 1234, abortController: {},
    spawnClaudeCodeProcess() {}, canUseTool() {} };
  const original = buildCaptureOptions({ ...args, env: buildCaptureEnv(1234), mcpServers: {}, sessionId });
  for (const phase of ['interrupt', 'resume']) {
    const actual = buildInterruptionOptions({ ...args, phase });
    for (const key of Object.keys(original)) if (!['persistSession', 'sessionId', 'title'].includes(key)) assert.deepEqual(actual[key], original[key], key);
    assert.equal(actual.persistSession, true);
    assert.equal(phase === 'resume' ? actual.resume : actual.sessionId, sessionId);
    assert.equal(Object.hasOwn(actual, phase === 'resume' ? 'sessionId' : 'resume'), false);
  }
});
test('scenario refuses accepted run, unknown fields, deadlines and malformed IDs', () => {
  const s = scenario();
  for (const change of [{ runUuid: 'f1bdbc76-068f-4d04-bc91-5abd2608f05f' }, { extra: true },
    { sessionId: 'opaque-not-sdk-uuid' }, { deadlineMs: s.deadlineMs + 1 }, { cleanupDeadlineMs: s.cleanupDeadlineMs + 1 },
    { phaseDeadlineMs: Date.now() - 1 }, { t0Ms: true }, { phaseDeadlineMs: Date.now() + 60001 }]) {
    assert.throws(() => validateScenario({ ...s, ...change }), /SCENARIO_BINDING/);
  }
});
test('interrupt closes/drains before capture and commit, all checkpoints partial', async () => {
  const f = fixture(), result = await runInterruptionPhase(f);
  assert.equal(result.status, 'PARTIAL_NATIVE_FILES_CAPTURED'); assert.equal(result.completeRecoveryCheckpoint, false);
  assert.ok(f.events.indexOf('interrupt') < f.events.indexOf('close'));
  assert.ok(f.events.indexOf('close') < f.events.indexOf('capture'));
  assert.ok(f.events.indexOf('capture') < f.events.indexOf('commit'));
  assert.equal(f.events.filter(e => e === 'query').length, 1);
});
test('replacement verifies checkpoint/stale fence, restores then reauthorizes before query', async () => {
  const f = fixture('resume'), result = await runInterruptionPhase(f);
  assert.equal(result.status, 'NATIVE_CONTINUITY_OBSERVED'); assert.equal(result.completeRecoveryCheckpoint, false);
  assert.ok(f.events.indexOf('auth:1') < f.events.indexOf('restore'));
  assert.ok(f.events.indexOf('verify') < f.events.indexOf('restore'));
  assert.ok(f.events.indexOf('restore') < f.events.lastIndexOf('auth:2'));
  assert.ok(f.events.lastIndexOf('auth:2') < f.events.indexOf('query'));
});
test('initial denial prevents restore/query/capture', async () => {
  const f = fixture('resume'); f.gateway.authorize = async () => false;
  await assert.rejects(runInterruptionPhase(f), /AUTHORIZATION_DENIED/); assert.deepEqual(f.events, []);
});
test('stale fence acceptance prevents restore and replacement query', async () => {
  const f = fixture('resume'); f.gateway.authorize = async () => true;
  await assert.rejects(runInterruptionPhase(f), /STALE_FENCE_NOT_DENIED/);
  assert.equal(f.events.includes('restore'), false); assert.equal(f.events.includes('query'), false);
});
test('unverified checkpoint refuses before restore', async () => {
  const f = fixture('resume'); f.checkpoint.verify = async () => false;
  await assert.rejects(runInterruptionPhase(f), /CHECKPOINT_NOT_VERIFIED/); assert.equal(f.events.includes('restore'), false);
});
test('revocation after restore refuses before query', async () => {
  const f = fixture('resume'); let calls = 0;
  f.gateway.authorize = async ctx => ctx.attempt === 2 && ++calls === 1;
  await assert.rejects(runInterruptionPhase(f), /AUTHORIZATION_DENIED/); assert.equal(f.events.includes('query'), false);
});
test('foreign init and absent init cannot trigger interrupt', async () => {
  for (const messages of [[{ ...init, session_id: runUuid }, delta(ACTIVE_MARKER)], [delta(ACTIVE_MARKER)]]) {
    const f = fixture(); f.messages.splice(0, f.messages.length, ...messages);
    await assert.rejects(runInterruptionPhase(f), /SESSION_CHANGED|SESSION_INIT_REQUIRED/);
    assert.equal(f.events.includes('interrupt'), false); assert.equal(f.events.includes('capture'), false);
    assert.equal(f.events.includes('close'), true);
  }
});
test('unsupported interrupt receipt and queued work refuse checkpoint', async () => {
  for (const answer of [undefined, { still_queued: [runUuid] }, { still_queued: [], extra: true }]) {
    const f = fixture(), original = f.host.query;
    f.host.query = args => ({ ...original(args), interrupt: async () => answer });
    await assert.rejects(runInterruptionPhase(f), /INTERRUPT_RECEIPT_UNKNOWN/); assert.equal(f.events.includes('capture'), false);
  }
});
test('mirror error/no active operation deny while closing owned query', async () => {
  for (const messages of [[init], [init, { type: 'system', subtype: 'mirror_error' }]]) {
    const f = fixture(); f.messages.splice(0, f.messages.length, ...messages);
    await assert.rejects(runInterruptionPhase(f), /NO_ACTIVE_NATIVE_MARKER|MIRROR_ERROR/);
    assert.equal(f.events.includes('close'), true); assert.equal(f.events.includes('capture'), false);
  }
});
test('continuity requires successful final native result and previous value', async () => {
  const f = fixture('resume'); f.messages[2].result = 'wrong previous value';
  await assert.rejects(runInterruptionPhase(f), /CONTINUITY_NOT_OBSERVED/);
});
test('boolean commit cannot masquerade as checkpoint reference', async () => {
  const f = fixture(); f.checkpoint.commit = async () => true;
  await assert.rejects(runInterruptionPhase(f), /CHECKPOINT_REFERENCE_REQUIRED/);
});
test('safe help and missing configuration allocate nothing', () => {
  const lines = [], out = { write: text => lines.push(text) };
  assert.equal(main(['--help'], out), 0); assert.equal(main([], out), 2);
  assert.equal(lines.length, 2);
});
test('invalid transport refuses before restoration or authorization', async () => {
  const f = fixture('resume'); f.port = 0;
  await assert.rejects(runInterruptionPhase(f), /invalid loopback port/); assert.deepEqual(f.events, []);
});
test('async restore cannot race native query', async () => {
  const f = fixture('resume'); f.sessionFiles.restore = () => Promise.resolve();
  await assert.rejects(runInterruptionPhase(f), /ASYNC_SESSION_FILES/); assert.equal(f.events.includes('query'), false);
});
test('deadline refuses pending native read and closes its owned child', async () => {
  const f = fixture(); f.scenario.phaseDeadlineMs = Date.now() + 20;
  const original = f.host.query;
  f.host.query = args => ({ ...original(args), [Symbol.asyncIterator]() {
    return { next: () => new Promise(() => {}) }; } });
  await assert.rejects(runInterruptionPhase(f), /PHASE_DEADLINE/);
  assert.equal(f.events.includes('close'), true); assert.equal(f.events.includes('capture'), false);
});
test('unconfirmed native exit blocks checkpoint even after interrupt receipt', async () => {
  const f = fixture(), original = f.host.query;
  f.host.query = args => ({ ...original(args), close: () => { throw new Error('OWNED_CLOSE_FAILED'); } });
  await assert.rejects(runInterruptionPhase(f), /OWNED_CLOSE_FAILED/);
  assert.equal(f.events.includes('capture'), false);
});
