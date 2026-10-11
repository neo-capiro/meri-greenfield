// Executable injected phase driver; no import-time SDK/process/filesystem IO.
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { assertFixtureSentinelPayload, snapshotFixtureData } from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { captureNativeSessionFiles, restoreNativeSessionFiles } from '../checkpoint/native-session-files.mjs';
import { writeFixtureSentinel, readFixtureSentinel } from '../checkpoint/fixture-sentinel.mjs';
import { createResumeAdmissionVerifier } from '../checkpoint/resume-admission.mjs';
import { buildSpawnHook, confirmChildCleanup } from './sdk-capture.mjs';
import { CAPTURE_CONFIG_DIR, buildCaptureEnv } from './sdk-capture-options.mjs';
import { nativeStreamFacts } from './native-stream-observer.mjs';
import { ACTIVE_MARKER, CONTINUITY_MARKER, validateScenario, phaseContext,
  sessionBinding, buildInterruptionOptions } from './sdk-interruption-options.mjs';

function fail(code) { throw new Error(code); }
async function until(promise, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) fail('PHASE_DEADLINE');
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('PHASE_DEADLINE')), remaining);
  })]); } finally { clearTimeout(timer); }
}
function marker(message, expected) {
  return message?.type === 'stream_event' && message.event?.type === 'content_block_delta' &&
    message.event.delta?.type === 'text_delta' && message.event.delta.text === expected;
}
function receipt(value) {
  if (!value || !Array.isArray(value.still_queued) || value.still_queued.length !== 0 ||
      Object.keys(value).some(k => !['still_queued', 'cancelled'].includes(k)) ||
      (value.cancelled !== undefined && (!Array.isArray(value.cancelled) || value.cancelled.length !== 0))) {
    fail('INTERRUPT_RECEIPT_UNKNOWN');
  }
  return structuredClone(value);
}

/**
 * host.query is the REAL pinned public SDK query in a future remote composition.
 * gateway/checkpoint are borrowed trusted orchestration boundaries, not stores
 * or authority created here. Each invocation owns exactly its Query/native child.
 * A separate owner must stop task A before launching this in fresh task B.
 */
export async function runInterruptionPhase({ scenario: input, phase, port, host, gateway,
  checkpoint, bundle, reference, nativeObserver, fixtureFile, resumeAdmission, workspaceFiles = {
    write: writeFixtureSentinel, read: readFixtureSentinel }, sessionFiles = {
    capture: captureNativeSessionFiles, restore: restoreNativeSessionFiles } }) {
  const scenario = validateScenario(input), context = phaseContext(scenario, phase);
  buildCaptureEnv(port); // Pure port validation must precede restoration/allocation.
  for (const [object, names] of [[host, ['query', 'spawn']], [gateway, ['authorize']],
    [checkpoint, phase === 'interrupt' ? ['commit'] : ['verify']],
    [sessionFiles, ['capture', 'restore']], [workspaceFiles, ['write', 'read']]]) {
    if (!object || names.some(n => typeof object[n] !== 'function')) fail('COMPOSITION_REQUIRED');
  }
  if (nativeObserver !== undefined && (phase !== 'interrupt' || fixtureFile === undefined ||
      !nativeObserver || ['started', 'initialized', 'interrupted', 'exited', 'drained'].some(
        name => typeof nativeObserver[name] !== 'function'))) fail('NATIVE_OBSERVER_COMPOSITION');
  assertFixtureSentinelPayload(fixtureFile);
  const sentinel = snapshotFixtureData(fixtureFile);
  assertFixtureSentinelPayload(sentinel);
  const observeSentinel = operation => {
    const actual = workspaceFiles[operation](sentinel, { workspaceRoot: sessionBinding(scenario).cwd,
      deadline: performance.now() + Math.min(10000, scenario.phaseDeadlineMs - Date.now()) });
    if (actual && typeof actual.then === 'function') fail('ASYNC_WORKSPACE_FILES');
    assertFixtureSentinelPayload(actual);
    if (canonicalSha256(actual) !== canonicalSha256(sentinel)) fail('WORKSPACE_SENTINEL_MISMATCH');
    return actual;
  };
  const replacementAdmission = phase === 'resume'
    ? createResumeAdmissionVerifier({ admission: resumeAdmission, scenario }) : undefined;
  const authorize = async (ctx) => {
    if (await until(Promise.resolve().then(() => gateway.authorize(ctx)), scenario.phaseDeadlineMs) !== true) fail('AUTHORIZATION_DENIED');
  };
  await authorize(context); // Before restore, native query or any tool effect.
  if (phase === 'resume') {
    // B's gateway authenticates B only. The separately admitted owner challenges
    // A with A's credential; neither its key nor transport belongs in task B.
    await replacementAdmission.verify();
    if (await until(Promise.resolve().then(() => checkpoint.verify({ context, bundle, reference,
      fixtureFile: sentinel })), scenario.phaseDeadlineMs) !== true) fail('CHECKPOINT_NOT_VERIFIED');
    const restored = sessionFiles.restore(bundle, { ...sessionBinding(scenario), targetConfigDir: CAPTURE_CONFIG_DIR,
      deadline: performance.now() + Math.min(10000, scenario.phaseDeadlineMs - Date.now()) });
    if (restored && typeof restored.then === 'function') fail('ASYNC_SESSION_FILES');
    observeSentinel('write');
    await authorize(context); // Authority can change while restoration runs.
  } else observeSentinel('write');
  const controller = new AbortController(), record = {}, counters = { spawns: 0 };
  const actualSpawn = buildSpawnHook(counters, record, host.spawn, () => controller.abort());
  const processObservation = () => ({ instanceId: record.instanceId, pid: record.pid,
    startedAtMs: record.startedAtMs });
  const spawn = options => {
    const child = actualSpawn(options);
    nativeObserver?.started(processObservation());
    return child;
  };
  const options = buildInterruptionOptions({ scenario, phase, port, abortController: controller,
    spawnClaudeCodeProcess: spawn, canUseTool: async () => {
      await authorize(context);
      return { behavior: 'deny', message: 'No tool effects in interruption fixture' };
    } });
  let releaseInput;
  const messageUuid = randomUUID();
  const inputGate = new Promise(resolve => { releaseInput = resolve; });
  async function* prompt() {
    yield { type: 'user', uuid: messageUuid, parent_tool_use_id: null,
      message: { role: 'user', content: [{ type: 'text', text: phase === 'interrupt'
        ? `Remember synthetic continuity ${scenario.runUuid}. Emit ${ACTIVE_MARKER} then remain active.`
        : `Continue the previous synthetic conversation. Emit ${CONTINUITY_MARKER} and repeat its continuity value.` }] } };
    await inputGate;
  }
  let query, interrupted, result, active = false, continuity = false, initialized = false,
    bytes = 0, eventStreamExhausted = false;
  const messages = [];
  try {
    await authorize(context);
    query = host.query({ prompt: prompt(), options });
    if (!query || typeof query.interrupt !== 'function' || typeof query.close !== 'function') fail('QUERY_INTERFACE');
    const iterator = query[Symbol.asyncIterator]();
    while (true) {
      const next = await until(iterator.next(), scenario.phaseDeadlineMs);
      if (next.done) { eventStreamExhausted = true; break; }
      const msg = next.value, raw = JSON.stringify(msg);
      if (typeof raw !== 'string' || raw.length > 262144 || (bytes += Buffer.byteLength(raw)) > 4194304 || messages.length >= 256) fail('EVENT_BOUND');
      messages.push(structuredClone(msg));
      if (msg.type === 'system' && msg.subtype === 'mirror_error') fail('MIRROR_ERROR');
      if ((['system', 'stream_event', 'result'].includes(msg.type) || msg.session_id !== undefined) &&
          msg.session_id !== scenario.sessionId) fail('SESSION_CHANGED');
      if (msg.type === 'system' && msg.subtype === 'init') {
        if (initialized || msg.session_id !== scenario.sessionId) fail('SESSION_INIT');
        initialized = true;
        nativeObserver?.initialized(msg);
      }
      if (phase === 'interrupt' && marker(msg, ACTIVE_MARKER) && !active) {
        if (!initialized) fail('SESSION_INIT_REQUIRED');
        await authorize(context);
        active = true;
        const requestedAtMs = Date.now();
        interrupted = receipt(await until(query.interrupt(), scenario.phaseDeadlineMs));
        nativeObserver?.interrupted({ activeEvent: msg, requestedAtMs,
          acknowledgedAtMs: Date.now(), receipt: interrupted });
        releaseInput();
      }
      if (phase === 'resume' && marker(msg, CONTINUITY_MARKER)) continuity = true;
      if (msg.type === 'result') { result = msg; releaseInput(); }
    }
    if (phase === 'interrupt' && !active) fail('NO_ACTIVE_NATIVE_MARKER');
    if (phase === 'resume' && (!initialized || !continuity || result?.subtype !== 'success' || result.is_error !== false ||
        typeof result.result !== 'string' || !result.result.includes(scenario.runUuid))) fail('CONTINUITY_NOT_OBSERVED');
  } finally {
    releaseInput();
    try { query?.close(); } finally {
      controller.abort();
      if (record.child) {
        const cleanupAt = Math.min(scenario.cleanupDeadlineMs, Date.now() + 5000);
        // Give the supported close/abort lifecycle time to produce a real exit
        // before cleanup escalates. Forced cleanup cannot support native proof.
        if (!record.exited && record.exitPromise) {
          try { await until(record.exitPromise, Math.min(cleanupAt, Date.now() + 1000)); }
          catch { /* bounded escalation below still owns this child */ }
        }
        if (!await until(confirmChildCleanup(record, { graceMs: Math.max(1, cleanupAt - Date.now()) }), cleanupAt)) fail('NATIVE_EXIT_UNKNOWN');
        if (!record.stdioDone) fail('NATIVE_DRAIN_UNKNOWN');
        await until(record.stdioDone, cleanupAt);
      }
    }
  }
  if (counters.spawns !== 1 || record.violation) fail('NATIVE_SPAWN_UNKNOWN');
  if (record.stderrOverflow || record.stderrReadError || record.stdoutOverflow ||
      record.stdoutReadError || record.processError) fail('NATIVE_IO_FAILED');
  if (!eventStreamExhausted) fail('NATIVE_EVENT_DRAIN_UNKNOWN');
  if (phase === 'interrupt') {
    // Exit/drain is necessary but not proof of all subagent/workspace quiescence.
    // The trusted commit boundary must refuse unsupported/incomplete checkpoints.
    if (nativeObserver) {
      if (!record.exited || record.cleanupForced) fail('NATIVE_EXIT_OBSERVATION_REQUIRED');
      await until(nativeObserver.exited({ process: processObservation(), exitCode: record.exitCode,
        signal: record.signalCode ?? null, forced: false, exitedAtMs: record.exitedAtMs }), scenario.phaseDeadlineMs);
    }
    const capturedSentinel = observeSentinel('read');
    const captured = sessionFiles.capture({ ...sessionBinding(scenario), configDir: CAPTURE_CONFIG_DIR,
      deadline: performance.now() + Math.min(10000, scenario.phaseDeadlineMs - Date.now()) });
    if (!captured || typeof captured !== 'object' || typeof captured.then === 'function') fail('ASYNC_SESSION_FILES');
    if (nativeObserver) await until(nativeObserver.drained({ process: processObservation(),
      eventStreamExhausted, ...nativeStreamFacts(record), bundle: captured,
      fixtureFile: capturedSentinel }), scenario.phaseDeadlineMs);
    await authorize(context);
    const committed = await until(checkpoint.commit({ context, bundle: captured,
      fixtureFile: capturedSentinel }), scenario.phaseDeadlineMs);
    if (committed === undefined || committed === null || typeof committed === 'boolean') fail('CHECKPOINT_REFERENCE_REQUIRED');
    return { status: 'PARTIAL_NATIVE_FILES_CAPTURED', context, messageUuid, interrupted, messages, bundle: captured,
      reference: committed, ...(nativeObserver ? { nativeEvidence: nativeObserver.records } : {}),
      completeRecoveryCheckpoint: false };
  }
  observeSentinel('read');
  return { status: 'NATIVE_CONTINUITY_OBSERVED', context, messageUuid, messages, completeRecoveryCheckpoint: false };
}

export function main(argv = process.argv.slice(2), output = process.stdout) {
  if (argv.length === 1 && argv[0] === '--help') {
    output.write('SDK interruption qualification: import runInterruptionPhase in the separately reviewed remote owner composition.\n');
    return 0;
  }
  output.write('COMPOSITION_REQUIRED: trusted gateway/checkpoint, real SDK and managed two-task owner are required.\n');
  return 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
