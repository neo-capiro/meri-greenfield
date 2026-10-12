// Scripted official-client/server boundaries; no browser, socket or native binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserLifetime, closeFixtureServer } from './browser-lifetime.mjs';
import { runBoundedSequence } from './browser.mjs';
const parked = () => new Promise(() => {});
const tick = () => new Promise(resolve => setImmediate(resolve));

test('preabort denies startup without calling the supplied port', async () => {
  const a = new AbortController(); a.abort(); let calls = 0;
  const life = createBrowserLifetime({ signal: a.signal, deadlineMs: 50, graceMs: 10 });
  await assert.rejects(life.run('connect', () => { calls++; }), /aborted/); assert.equal(calls, 0); await life.close();
});
test('one monotonic deadline bounds every MCP asynchronous boundary', async () => {
  for (const name of ['connect', 'listTools', 'callTool', 'server startup']) {
    const life = createBrowserLifetime({ deadlineMs: 10, graceMs: 5 });
    await assert.rejects(life.run(name, parked), /deadline/);
    const result = await life.close(); assert.equal(result.confirmed, false); assert.deepEqual(result.pendingAtClose, [name]);
  }
});
test('owned client and server both close even if one close parks', async () => {
  const life = createBrowserLifetime({ deadlineMs: 100, graceMs: 10 }); let serverClosed = 0;
  life.own('client', {}, parked); life.own('server', {}, () => { serverClosed++; });
  const result = await life.close(); assert.equal(serverClosed, 1); assert.equal(result.confirmed, false);
  assert.equal(result.resources[0].ok, false); assert.equal(result.resources[1].ok, true); assert.strictEqual(await life.close(), result);
});
test('late server acquisition is closed while returned UNKNOWN stays immutable', async () => {
  const life = createBrowserLifetime({ deadlineMs: 5, graceMs: 10 }); let resolveServer; let closes = 0; const server = {};
  const acquisition = life.acquire('server', () => new Promise(resolve => { resolveServer = resolve; }), value => { assert.equal(value, server); closes++; });
  await assert.rejects(acquisition, /deadline/); const result = await life.close(); const before = JSON.stringify(result);
  resolveServer(server); await tick(); assert.equal(closes, 1); assert.equal(result.confirmed, false); assert.equal(JSON.stringify(result), before);
});
test('late MCP startup completion triggers a fresh bounded close', async () => {
  const life = createBrowserLifetime({ deadlineMs: 5, graceMs: 5 }); let resolveConnect; let closes = 0;
  life.own('client', {}, () => { closes++; });
  const connecting = life.run('connect', () => new Promise(resolve => { resolveConnect = resolve; }), { lateCleanup: () => { closes++; } });
  await assert.rejects(connecting, /deadline/); assert.equal((await life.close()).confirmed, false);
  resolveConnect(); await tick(); assert.equal(closes, 2);
});
test('abort interrupts a pending MCP tool and rejects subsequent work', async () => {
  const a = new AbortController(); const life = createBrowserLifetime({ deadlineMs: 100, graceMs: 5, signal: a.signal });
  const pending = life.run('callTool', parked); await tick(); a.abort();
  await assert.rejects(pending, /aborted/); await assert.rejects(life.run('later', () => {}), /aborted/); assert.equal((await life.close()).confirmed, false);
});
test('stderr overflow fails the active operation and keeps retained bytes bounded', async () => {
  const life = createBrowserLifetime({ deadlineMs: 100, graceMs: 5 }); const pending = life.run('connect', parked); await tick();
  life.captureStderr(Buffer.alloc(65537)); await assert.rejects(pending, /stderr exceeded/); assert.ok(Buffer.byteLength(life.stderr) <= 65536); await life.close();
});
test('server close needs its callback, not the return value', async () => {
  const life = createBrowserLifetime({ deadlineMs: 100, graceMs: 5 });
  life.own('server', { close() { return true; } }, closeFixtureServer); assert.equal((await life.close()).confirmed, false);
});
test('server callback error retains cleanup uncertainty', async () => {
  const life = createBrowserLifetime({ deadlineMs: 100, graceMs: 5 });
  life.own('server', { close(cb) { cb(Error('close failed')); } }, closeFixtureServer);
  const r = await life.close(); assert.equal(r.confirmed, false); assert.match(r.resources[0].error, /close failed/);
});
test('successful MCP work and cleanup claim API observations only', async () => {
  const life = createBrowserLifetime({ deadlineMs: 100, graceMs: 5 });
  life.own('client', {}, () => {}); life.own('server', { close(cb) { cb(); } }, closeFixtureServer);
  assert.equal(await life.run('listTools', () => 7), 7); const r = await life.close(); assert.equal(r.confirmed, true); assert.match(r.scope, /API-close-only/);
  await assert.rejects(life.run('late call', () => {}), /closed/);
});
test('actual browser step driver stops after deadline without a later tool call', async () => {
  const life = createBrowserLifetime({ deadlineMs: 5, graceMs: 5 }); let later = 0;
  await assert.rejects(runBoundedSequence([{ name: 'park', run: () => life.run('tool', parked) }, { name: 'later', run: () => { later++; } }]), /deadline/);
  assert.equal(later, 0); await life.close();
});

test('expired deadline between operations remains a failed probe even with clean API close', async () => {
  const life = createBrowserLifetime({ deadlineMs: 5, graceMs: 5 });
  assert.equal(await life.run('quick work', () => 1), 1);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await life.close()).confirmed, true); assert.match(life.failure, /deadline/);
});

test('synchronous close cannot outrun its elapsed cleanup deadline by blocking timers', async () => {
  const life = createBrowserLifetime({ deadlineMs: 100, graceMs: 5 });
  life.own('blocked close', {}, () => { const end = performance.now() + 10; while (performance.now() < end) {} });
  const result = await life.close(); assert.equal(result.confirmed, false); assert.match(result.resources[0].error, /deadline/);
});
