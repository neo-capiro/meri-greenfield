import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runInterruptionPhase, main } from './sdk-interruption.mjs';
import { validateScenario, buildInterruptionOptions, ACTIVE_MARKER, CONTINUITY_MARKER } from './sdk-interruption-options.mjs';
import { buildCaptureOptions, buildCaptureEnv } from './sdk-capture-options.mjs';
import { fixture as wireFixture } from '../../../../packages/contracts/test/sdk-fixture-wire.test.mjs';

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
    fixtureFile: wireFixture().fixtureFile,
    bundle: { opaque: 'unknown bytes preserved by canonical adapter' }, reference: { immutable: 'ref' },
    gateway: { authorize: async ctx => { events.push(`auth:${ctx.attempt}`); return ctx.attempt === (phase === 'interrupt' ? 1 : 2); } },
    checkpoint: { commit: async () => { events.push('commit'); return { immutable: 'ref' }; },
      verify: async () => { events.push('verify'); return true; } },
    sessionFiles: { capture: () => { events.push('capture'); return f.bundle; },
      restore: () => { events.push('restore'); } },
    workspaceFiles: {
      write: file => { events.push('sentinel:write'); return file; },
      read: file => { events.push('sentinel:read'); return file; } },
    host: { spawn: (_options, record) => { record.stdioDone = Promise.resolve(); return child; },
      query: ({ options }) => {
        events.push('query');
        options.spawnClaudeCodeProcess({ command: 'FAKE', args: [], env: options.env, cwd: options.cwd });
        return { async *[Symbol.asyncIterator]() { yield* messages; },
          interrupt: async () => { events.push('interrupt'); return { still_queued: [] }; },
          close: () => { events.push('close'); child.exitCode = 0; child.emit('exit', 0, null); } };
      } } };
  if (phase === 'resume') {
    const contexts = wireFixture();
    for (const context of [contexts.producer, contexts.current]) {
      context.runUuid = runUuid; context.namespace.sessionId = sessionId;
      context.clock = { t0Ms: f.scenario.t0Ms, deadlineMs: f.scenario.deadlineMs,
        cleanupDeadlineMs: f.scenario.cleanupDeadlineMs };
      context.identity.admittedAtMs = f.scenario.t0Ms + (context.phase === 'resume' ? 1 : 0);
      context.identity.expiresAtMs = f.scenario.deadlineMs;
    }
    f.resumeAdmission = { producer: contexts.producer, current: contexts.current,
      staleWorkerChallenge: { verify: async ({ request }) => {
        // Synthetic owner port; this is not B's gateway or an A credential.
        events.push('auth:1');
        return { ...request, status: 'DENIED_STALE_BINDING',
          decisionId: '00000000-0000-4000-9000-000000000777', checkedAtMs: Date.now(),
          currentContext: structuredClone(contexts.current) };
      } } };
  }
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
  const s = scenario(), now = Date.now();
  for (const change of [{ runUuid: 'f1bdbc76-068f-4d04-bc91-5abd2608f05f' }, { extra: true },
    { sessionId: 'opaque-not-sdk-uuid' }, { deadlineMs: s.deadlineMs + 1 }, { cleanupDeadlineMs: s.cleanupDeadlineMs + 1 },
    { phaseDeadlineMs: now - 1 }, { t0Ms: true }, { phaseDeadlineMs: now + 60001 }]) {
    assert.throws(() => validateScenario({ ...s, ...change }, now), /SCENARIO_BINDING/);
  }
});
test('interrupt closes/drains before capture and commit, all checkpoints partial', async () => {
  const f = fixture(), result = await runInterruptionPhase(f);
  assert.equal(result.status, 'PARTIAL_NATIVE_FILES_CAPTURED'); assert.equal(result.completeRecoveryCheckpoint, false);
  assert.ok(f.events.indexOf('interrupt') < f.events.indexOf('close'));
  assert.ok(f.events.indexOf('close') < f.events.indexOf('capture'));
  assert.ok(f.events.indexOf('capture') < f.events.indexOf('commit'));
  assert.equal(f.events.filter(e => e === 'query').length, 1);
  assert.ok(f.events.indexOf('sentinel:write') < f.events.indexOf('query'));
  assert.ok(f.events.indexOf('close') < f.events.indexOf('sentinel:read'));
  assert.ok(f.events.indexOf('sentinel:read') < f.events.indexOf('capture'));
});
test('replacement verifies checkpoint/stale fence, restores then reauthorizes before query', async () => {
  const f = fixture('resume'), result = await runInterruptionPhase(f);
  assert.equal(result.status, 'NATIVE_CONTINUITY_OBSERVED'); assert.equal(result.completeRecoveryCheckpoint, false);
  assert.ok(f.events.indexOf('auth:1') < f.events.indexOf('restore'));
  assert.ok(f.events.indexOf('verify') < f.events.indexOf('restore'));
  assert.ok(f.events.indexOf('restore') < f.events.lastIndexOf('auth:2'));
  assert.ok(f.events.lastIndexOf('auth:2') < f.events.indexOf('query'));
  assert.ok(f.events.indexOf('verify') < f.events.indexOf('sentinel:write'));
  assert.ok(f.events.indexOf('sentinel:write') < f.events.lastIndexOf('auth:2'));
  assert.ok(f.events.indexOf('close') < f.events.indexOf('sentinel:read'));
});

test('qualification requires a bounded sentinel before authorization or workspace effects', async () => {
  for (const value of [undefined, { ...wireFixture().fixtureFile, bytes: 65537 }]) {
    const f = fixture(); f.fixtureFile = value;
    await assert.rejects(runInterruptionPhase(f), value === undefined
      ? /FIXTURE_JSON_ONLY/ : /INVALID_FIXTURE_Sentinel/);
    assert.deepEqual(f.events, []);
  }
});

test('replacement sends its exact physical sentinel to checkpoint verification before restoration', async () => {
  const f = fixture('resume'); let verifiedFile;
  f.checkpoint.verify = async ({ fixtureFile }) => {
    verifiedFile = fixtureFile; throw new Error('FIXTURE_SENTINEL_MISMATCH');
  };
  await assert.rejects(runInterruptionPhase(f), /FIXTURE_SENTINEL_MISMATCH/);
  assert.deepEqual(verifiedFile, f.fixtureFile);
  assert.equal(f.events.includes('restore'), false);
  assert.equal(f.events.includes('sentinel:write'), false);
  assert.equal(f.events.includes('query'), false);
});

test('async workspace writes refuse before native query', async () => {
  const f = fixture(); f.workspaceFiles.write = () => Promise.resolve(f.fixtureFile);
  await assert.rejects(runInterruptionPhase(f), /ASYNC_WORKSPACE_FILES/);
  assert.equal(f.events.includes('query'), false);
});

test('tampered physical sentinel after native drain prevents capture and commit', async () => {
  const f = fixture();
  f.workspaceFiles.read = file => ({ ...file, sha256: '0'.repeat(64) });
  await assert.rejects(runInterruptionPhase(f), /FIXTURE_BYTES_MISMATCH/);
  assert.equal(f.events.includes('close'), true);
  assert.equal(f.events.includes('capture'), false);
  assert.equal(f.events.includes('commit'), false);
});
test('initial denial prevents restore/query/capture', async () => {
  const f = fixture('resume'); f.gateway.authorize = async () => false;
  await assert.rejects(runInterruptionPhase(f), /AUTHORIZATION_DENIED/); assert.deepEqual(f.events, []);
});
test('stale fence acceptance prevents restore and replacement query', async () => {
  const f = fixture('resume');
  f.resumeAdmission.staleWorkerChallenge.verify = async ({ request }) => ({ ...request,
    status: 'AUTHORIZED', decisionId: '00000000-0000-4000-9000-000000000777', checkedAtMs: Date.now() });
  await assert.rejects(runInterruptionPhase(f), /STALE_FENCE_NOT_DENIED/);
  assert.equal(f.events.includes('restore'), false); assert.equal(f.events.includes('query'), false);
});
test('B gateway never receives A context; missing owner admission refuses before restore/spawn', async () => {
  const f = fixture('resume'), seen = [], authorize = f.gateway.authorize;
  f.gateway.authorize = async context => { seen.push(context.attempt); return authorize(context); };
  await runInterruptionPhase(f);
  assert.ok(seen.length >= 2); assert.ok(seen.every(attempt => attempt === 2));
  const missing = fixture('resume'); delete missing.resumeAdmission;
  await assert.rejects(runInterruptionPhase(missing), /RESUME_ADMISSION_COMPOSITION/);
  assert.deepEqual(missing.events, []);
});
test('foreign or uncertain owner challenge refuses before restore/spawn', async () => {
  for (const failure of ['foreign', 'uncertain', 'missing']) {
    const f = fixture('resume'), original = f.resumeAdmission.staleWorkerChallenge.verify;
    f.resumeAdmission.staleWorkerChallenge.verify = async input => {
      if (failure === 'uncertain') throw new Error('OWNER_REPLY_UNKNOWN');
      if (failure === 'missing') return undefined;
      const response = await original(input);
      response.currentContext.identity.grantId = '00000000-0000-4000-9000-000000000999';
      return response;
    };
    await assert.rejects(runInterruptionPhase(f));
    assert.equal(f.events.includes('restore'), false); assert.equal(f.events.includes('query'), false);
  }
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

test('post-interrupt mirror errors are consumed and refuse capture/commit', async () => {
  const f = fixture();
  f.messages.push({ type: 'system', subtype: 'mirror_error', session_id: sessionId });
  await assert.rejects(runInterruptionPhase(f), /MIRROR_ERROR/);
  assert.equal(f.events.includes('interrupt'), true);
  assert.equal(f.events.includes('capture'), false); assert.equal(f.events.includes('commit'), false);
});
test('stream input gate releases at interrupt and iterator drains after final result', async () => {
  const f = fixture(), original = f.host.query;
  let exhausted = false, prompt;
  f.host.query = args => {
    prompt = args.prompt[Symbol.asyncIterator]();
    const query = original(args);
    return { ...query, async *[Symbol.asyncIterator]() {
      await prompt.next(); yield* f.messages;
      assert.equal((await prompt.next()).done, true, 'streaming input closes after the interrupt receipt');
      yield { type: 'result', subtype: 'success', is_error: false, session_id: sessionId, result: 'partial' };
      yield { type: 'system', subtype: 'synthetic-after-result', session_id: sessionId };
      exhausted = true;
    } };
  };
  const result = await runInterruptionPhase(f);
  assert.equal(exhausted, true);
  assert.equal(result.messages.at(-1).subtype, 'synthetic-after-result');
});
test('a hanging iterator after interrupt cannot publish a checkpoint', async () => {
  const f = fixture(), original = f.host.query;
  f.scenario.phaseDeadlineMs = Date.now() + 20;
  f.host.query = args => ({ ...original(args), async *[Symbol.asyncIterator]() {
    yield* f.messages; await new Promise(() => {});
  } });
  await assert.rejects(runInterruptionPhase(f), /PHASE_DEADLINE/);
  assert.equal(f.events.includes('interrupt'), true); assert.equal(f.events.includes('commit'), false);
});
test('stderr overflow/read failure refuses publication even with observed process exit', async () => {
  for (const field of ['stderrOverflow', 'stderrReadError', 'stdoutReadError', 'stdoutOverflow', 'processError']) {
    const f = fixture(), original = f.host.spawn;
    f.host.spawn = (options, record) => { record[field] = true; return original(options, record); };
    await assert.rejects(runInterruptionPhase(f), /NATIVE_IO_FAILED/);
    assert.equal(f.events.includes('capture'), false); assert.equal(f.events.includes('commit'), false);
  }
});
function observedFixture() {
  const f = fixture(), observations = [], original = f.host.spawn;
  f.host.spawn = (options, record) => {
    const child = original(options, record); child.pid = 123;
    Object.assign(record, { stdoutTotalBytes: 0, stdoutSha256: 'a'.repeat(64), stdoutEnded: true,
      stdoutClosed: true, stderrTotalBytes: 0, stderrSha256: 'b'.repeat(64), stderrEnded: true, stderrClosed: true });
    return child;
  };
  f.nativeObserver = { records: Object.freeze(['synthetic source observations']),
    started: value => observations.push(['started', value]),
    initialized: value => observations.push(['init', value]),
    interrupted: value => observations.push(['interrupt', value]),
    exited: async value => observations.push(['exit', value]),
    drained: value => { observations.push(['drain', value]); f.events.push('observed-drain'); } };
  return { f, observations };
}
test('optional trusted observer receives exact events, exit and captured bytes before commit', async () => {
  const { f, observations } = observedFixture();
  const result = await runInterruptionPhase(f);
  assert.deepEqual(observations.map(([name]) => name), ['started', 'init', 'interrupt', 'exit', 'drain']);
  assert.equal(observations[1][1], f.messages[0]);
  assert.equal(observations[2][1].activeEvent, f.messages[1]);
  assert.equal(observations[3][1].forced, false);
  assert.equal(observations[4][1].bundle, f.bundle);
  assert.deepEqual(observations[4][1].fixtureFile, f.fixtureFile);
  assert.notEqual(observations[4][1].fixtureFile, f.fixtureFile);
  assert.equal(Object.isFrozen(observations[4][1].fixtureFile), true);
  assert.equal(observations[4][1].eventStreamExhausted, true);
  assert.ok(f.events.indexOf('observed-drain') < f.events.indexOf('commit'));
  assert.deepEqual(result.nativeEvidence, f.nativeObserver.records);
  assert.equal(result.completeRecoveryCheckpoint, false);
});
test('optional observer refuses missing EOF/close and failed namespace inspection before commit', async () => {
  for (const failure of ['EOF', 'namespace']) {
    const { f } = observedFixture();
    if (failure === 'EOF') {
      const original = f.host.spawn;
      f.host.spawn = (options, record) => { const child = original(options, record); record.stdoutEnded = false; return child; };
    } else f.nativeObserver.exited = async () => { throw new Error('NATIVE_NAMESPACE_REQUIRED'); };
    await assert.rejects(runInterruptionPhase(f), /NATIVE_STREAM_OBSERVATION_REQUIRED|NATIVE_NAMESPACE_REQUIRED/);
    assert.equal(f.events.includes('commit'), false);
  }
});
test('optional observer requires separately supplied exact sentinel before allocation', async () => {
  const { f } = observedFixture(); delete f.fixtureFile;
  await assert.rejects(runInterruptionPhase(f), /NATIVE_OBSERVER_COMPOSITION/);
  assert.deepEqual(f.events, []);
});
test('forced cleanup and unobserved exit cannot issue native exit/drain proof', async () => {
  for (const mode of ['forced', 'unobserved']) {
    const { f, observations } = observedFixture(), original = f.host.query;
    f.host.query = args => {
      const query = original(args);
      return { ...query, close: () => {
        f.events.push('close');
        if (mode === 'unobserved') {
          // A cached property without an exit event remains insufficient.
          // Borrow the fake spawned child through a separate injected adapter.
          f.fakeChild.exitCode = 0;
        }
      } };
    };
    if (mode === 'unobserved') {
      const spawn = f.host.spawn;
      f.host.spawn = (options, record) => { const child = spawn(options, record); f.fakeChild = child; return child; };
    }
    await assert.rejects(runInterruptionPhase(f), /NATIVE_EXIT_OBSERVATION_REQUIRED/);
    assert.deepEqual(observations.map(([name]) => name), ['started', 'init', 'interrupt']);
    assert.equal(f.events.includes('commit'), false);
  }
});
