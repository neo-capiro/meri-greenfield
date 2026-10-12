// Scripted event ports only. No process/browser/renderer/OS group is launched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runOwnedProbeChild, MAX_CHILD_STDOUT, MAX_CHILD_STDERR } from './owned-probe-child.mjs';
import { runProbeScript, runQualificationChildren } from './runtime.mjs';
function child() { const c = new EventEmitter(); c.pid = 424242; c.stdout = new EventEmitter(); c.stderr = new EventEmitter(); return c; }
const ports = { script: 'artifacts.mjs', deadlineMs: 100, graceMs: 15, groupKill: () => true, probeGroup: () => false };
function closing({ code = 0, signal = null, payload = { ok: true }, effect } = {}) {
  return () => { const c = child(); setImmediate(() => { if (effect) effect(c); c.stdout.emit('data', Buffer.from(JSON.stringify(payload))); c.emit('close', code, signal); }); return c; };
}
test('fixed executable entries deny arbitrary scripts before spawn', async () => {
  for (const script of ['../browser.mjs', '/tmp/arbitrary.mjs', 'sdk-capture.mjs', null]) {
    let spawns = 0; const r = await runOwnedProbeChild({ ...ports, script, spawnFn: () => { spawns++; } });
    assert.equal(spawns, 0); assert.match(r.error, /allowlisted/);
  }
});
test('preabort and non-owned Linux process group never spawn', async () => {
  const a = new AbortController(); a.abort();
  for (const options of [{ signal: a.signal }, ...(process.platform === 'linux' ? [{ detached: false }] : [])]) {
    let spawns = 0; const r = await runOwnedProbeChild({ ...ports, ...options, spawnFn: () => { spawns++; } });
    assert.equal(spawns, 0); assert.ok(r.error);
  }
});
test('successful close needs exact owned child absence and bounded preserved output', async () => {
  const c = child(); const r = await runOwnedProbeChild({ ...ports, spawnFn: () => { setImmediate(() => { c.stdout.emit('data', Buffer.from('{"ok":true}')); c.emit('close', 0, null); }); return c; }, probeGroup: actual => { assert.equal(actual, c); return false; } });
  assert.equal(r.cleanupConfirmed, true); assert.equal(r.error, null); assert.equal(r.stdout, '{"ok":true}');
});
test('both stdout and stderr overflow fail despite later successful close', async () => {
  for (const [channel, cap] of [['stdout', MAX_CHILD_STDOUT], ['stderr', MAX_CHILD_STDERR]]) {
    let kills = 0; const r = await runOwnedProbeChild({ ...ports, spawnFn: closing({ effect: c => c[channel].emit('data', Buffer.alloc(cap + 1)) }), groupKill: () => { kills++; return true; } });
    assert.equal(r.overflow, true); assert.ok(r.error); assert.equal(kills, 1); assert.ok(Buffer.byteLength(r[channel]) <= cap);
  }
});
test('abort after spawn contains once and cannot be made successful by late output', async () => {
  const a = new AbortController(); const c = child(); let kills = 0;
  const pending = runOwnedProbeChild({ ...ports, signal: a.signal, spawnFn: () => c, groupKill: () => { kills++; return true; } });
  a.abort(); const r = await pending; const facts = JSON.stringify(r);
  c.stdout.emit('data', Buffer.from('{"ok":true}')); c.emit('close', 0, null); c.emit('error', Error('late'));
  assert.equal(kills, 1); assert.equal(r.aborted, true); assert.equal(r.cleanupConfirmed, false); assert.equal(JSON.stringify(r), facts);
});
test('stream error without close starts bounded containment immediately', async () => {
  const c = child(); let kills = 0; const pending = runOwnedProbeChild({ ...ports, spawnFn: () => c, groupKill: () => { kills++; return true; } });
  c.stderr.emit('error', Error('broken stderr')); const r = await pending;
  assert.equal(kills, 1); assert.equal(r.cleanupConfirmed, false); assert.match(r.error, /broken stderr/);
});
test('exit without close and unknown group retain cleanup UNKNOWN', async () => {
  for (const observation of [true, undefined]) {
    const c = child(); let kills = 0;
    const r = await runOwnedProbeChild({ ...ports, deadlineMs: 5, spawnFn: () => { setImmediate(() => c.emit('exit', 0, null)); return c; }, probeGroup: () => observation, groupKill: () => { kills++; return true; } });
    assert.equal(kills, 1); assert.equal(r.cleanupConfirmed, false); assert.equal(r.timedOut, true);
  }
});
test('runtime signal and overflow remain failed even with successful JSON and cleanup', async () => {
  for (const options of [{ signal: 'SIGTERM' }, { effect: c => c.stderr.emit('data', Buffer.alloc(MAX_CHILD_STDERR + 1)) }]) {
    const r = await runProbeScript('browser.mjs', { ...ports, spawnFn: closing(options) });
    assert.equal(r.cleanupConfirmed, true); assert.equal(r.status, 'fail');
  }
});
test('runtime continues after a contained semantic failure', async () => {
  const scripts = [];
  const r = await runQualificationChildren({ ...ports, spawnFn: (cmd, args) => { scripts.push(args[0]); return closing({ payload: { ok: scripts.length > 1 }, code: scripts.length > 1 ? 0 : 1 })(); } });
  assert.equal(scripts.length, 2); assert.match(scripts[0], /browser.mjs$/); assert.match(scripts[1], /artifacts.mjs$/);
  assert.equal(r[0].status, 'fail'); assert.equal(r[1].status, 'pass');
});
test('runtime unknown cleanup prevents another probe spawn', async () => {
  let spawns = 0; const r = await runQualificationChildren({ ...ports, spawnFn: () => { spawns++; return closing()(); }, probeGroup: () => undefined });
  assert.equal(spawns, 1); assert.equal(r[1].notRun, true); assert.match(r[1].detail, /NOT-RUN\/HOLD/);
});

test('late close after event-loop delay cannot beat the elapsed absolute deadline', async () => {
  const c = child(); const pending = runOwnedProbeChild({ ...ports, deadlineMs: 5, spawnFn: () => c });
  const until = performance.now() + 10; while (performance.now() < until) { /* scripted synchronous port delay */ }
  c.stdout.emit('data', Buffer.from('{"ok":true}')); c.emit('close', 0, null);
  const r = await pending; assert.equal(r.timedOut, true); assert.ok(r.error);
});

test('CLI cancellation absorbs repeated signals until disposal and preserves borrowed listeners', async () => {
  const { installProbeCancellation } = await import('./owned-probe-child.mjs');
  const events = new EventEmitter(); let borrowed = 0, aborts = 0;
  const borrowedHandler = () => { borrowed++; }; events.on('SIGINT', borrowedHandler);
  const cancellation = installProbeCancellation(events); cancellation.signal.addEventListener('abort', () => { aborts++; });
  events.emit('SIGTERM'); events.emit('SIGINT'); events.emit('SIGTERM');
  assert.equal(aborts, 1); assert.equal(borrowed, 1); assert.equal(events.listenerCount('SIGTERM'), 1);
  cancellation.dispose(); cancellation.dispose(); assert.equal(events.listenerCount('SIGTERM'), 0);
  assert.deepEqual(events.listeners('SIGINT'), [borrowedHandler]);
});
test('CLI cancellation bridge actually waits for child close and owned absence', async () => {
  const { installProbeCancellation } = await import('./owned-probe-child.mjs');
  const events = new EventEmitter(); const cancellation = installProbeCancellation(events); const c = child(); let kills = 0;
  const pending = runOwnedProbeChild({ ...ports, signal: cancellation.signal, spawnFn: () => c, groupKill: () => { kills++; return true; } });
  events.emit('SIGTERM'); events.emit('SIGINT'); c.emit('close', 0, null); const result = await pending;
  assert.equal(kills, 1); assert.equal(result.aborted, true); assert.equal(result.cleanupConfirmed, true); assert.ok(result.error);
  cancellation.dispose(); assert.equal(events.eventNames().length, 0);
});

test('Office cancellation interrupts a parked write and cannot emit the later end record', async () => {
  const { streamRecords } = await import('./office-export.mjs');
  const a = new AbortController(); const writes = []; let lateCallback;
  const stream = new EventEmitter(); stream.write = (line, cb) => { writes.push(line); lateCallback = cb; };
  const resultPromise = streamRecords(stream, [{ kind: 'capture' }, { kind: 'end' }], { deadlineMs: 100, signal: a.signal });
  a.abort(); const result = await resultPromise;
  assert.equal(result.ok, false); assert.match(result.error, /aborted/); assert.equal(writes.length, 1);
  lateCallback(); await new Promise(resolve => setImmediate(resolve)); assert.equal(writes.length, 1);
});
test('Office preabort emits no payload and cancellation in final callback refuses success', async () => {
  const { streamRecords } = await import('./office-export.mjs');
  const a = new AbortController(); a.abort(); let writes = 0;
  const denied = await streamRecords({ write() { writes++; } }, [{ kind: 'end' }], { deadlineMs: 100, signal: a.signal });
  assert.equal(denied.ok, false); assert.equal(writes, 0);
  const b = new AbortController(); const stream = { write(line, callback) { b.abort(); callback(); } };
  const uncertain = await streamRecords(stream, [{ kind: 'end' }], { deadlineMs: 100, signal: b.signal });
  assert.equal(uncertain.ok, false); assert.match(uncertain.error, /aborted/);
});

test('already-cancelled actual Office main allocates no directory or child', async () => {
  const { main } = await import('./office-export.mjs'); const a = new AbortController(); a.abort();
  let mkdirs = 0, spawns = 0; const lines = [];
  const code = await main({ signal: a.signal, mkdir() { mkdirs++; }, spawnFn() { spawns++; },
    writeStream: { write(line, callback) { lines.push(line); callback(); } } });
  assert.equal(code, 1); assert.equal(mkdirs, 0); assert.equal(spawns, 0); assert.equal(lines.length, 1); assert.match(lines[0], /aborted/);
});
