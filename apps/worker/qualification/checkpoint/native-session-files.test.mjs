import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { captureNativeSessionFiles as capture, restoreNativeSessionFiles as restore } from './native-session-files.mjs';

const sessionId = '5be61438-0098-4239-bdb1-01b32604209e';
const foreign = '6be61438-0098-4239-bdb1-01b32604209e';
const binding = { sessionId, cwd: '/workspace/conversation', projectKey: '-workspace-conversation' };
const main = Buffer.from('{"type":"compact-boundary","unknown":{"verbatim":true}}\r\n\0\xff', 'latin1');
function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meri-native-files-'));
  const configDir = path.join(root, 'config');
  const project = path.join(configDir, 'projects', binding.projectKey);
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, `${sessionId}.jsonl`), main);
  const options = { ...binding, configDir };
  try { return fn({ root, project, options, targetConfigDir: path.join(root, 'restored') }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const clone = b => JSON.parse(JSON.stringify(b));
function noTarget(target, fn) { assert.throws(fn); assert.equal(fs.existsSync(target), false); }

test('opaque main, nested subagent, meta sidecar and empty directory round trip exactly', () => fixture(({ project, options, targetConfigDir }) => {
  const subtree = path.join(project, sessionId);
  fs.mkdirSync(path.join(subtree, 'subagents', 'nested'), { recursive: true });
  fs.mkdirSync(path.join(subtree, 'empty'));
  fs.writeFileSync(path.join(subtree, 'subagents', 'nested', 'agent-abc.jsonl'), Buffer.from([0, 255, 13, 10]));
  fs.writeFileSync(path.join(subtree, 'subagents', 'nested', 'agent-abc.meta.json'), '{"future": 7}\n');
  fs.writeFileSync(path.join(project, `${foreign}.jsonl`), 'foreign must never be captured');
  fs.writeFileSync(path.join(options.configDir, 'settings.json'), 'not copied');
  const b = capture(options);
  assert.equal(b.files.length, 3); assert.equal(b.totalBytes, b.files.reduce((n, f) => n + f.bytes, 0));
  assert.ok(Object.isFrozen(b.files)); assert.ok(Object.isFrozen(b.binding));
  const out = restore(b, { ...binding, targetConfigDir });
  assert.equal(out.files, 3); assert.equal('quiescent' in out, false); assert.equal('durable' in out, false);
  const again = capture({ ...binding, configDir: targetConfigDir });
  assert.deepEqual(again, b); assert.equal(fs.existsSync(path.join(targetConfigDir, 'settings.json')), false);
}));

test('missing main and empty main refuse', () => fixture(({ project, options }) => {
  fs.unlinkSync(path.join(project, `${sessionId}.jsonl`)); assert.throws(() => capture(options), { code: 'ENOENT' });
  fs.writeFileSync(path.join(project, `${sessionId}.jsonl`), ''); assert.throws(() => capture(options), { code: 'EMPTY_MAIN' });
}));
test('session and project binding are exact', () => fixture(({ options, targetConfigDir }) => {
  assert.throws(() => capture({ ...options, projectKey: 'foreign' }), { code: 'BINDING' });
  assert.throws(() => capture({ ...options, sessionId: '../escape' }), { code: 'BINDING' });
  noTarget(targetConfigDir, () => restore(capture(options), { ...binding, sessionId: foreign, targetConfigDir }));
}));
test('all corruption is refused before target allocation', () => fixture(({ options, targetConfigDir }) => {
  for (const change of [b => b.files[0].sha256 = '0'.repeat(64), b => b.files[0].base64 = 'AAAA', b => b.files[0].bytes++, b => b.totalBytes++, b => b.files = []]) {
    const b = clone(capture(options)); change(b); noTarget(targetConfigDir, () => restore(b, { ...binding, targetConfigDir }));
  }
}));
test('foreign/traversal/alias/NFC/ancestor-conflicting inventory refuses before writes', () => fixture(({ options, targetConfigDir }) => {
  for (const name of [`${foreign}.jsonl`, `${sessionId}/../outside`, `${sessionId}/CON`, `${sessionId}/a:b`, `${sessionId}/e\u0301`, `${sessionId}/a\\b`, `${sessionId}/trailing.`, `${sessionId}/missing/file`]) {
    const b = clone(capture(options)); b.files[0].path = name;
    noTarget(targetConfigDir, () => restore(b, { ...binding, targetConfigDir }));
  }
  const b = clone(capture(options)); b.files.push({ ...b.files[0] });
  noTarget(targetConfigDir, () => restore(b, { ...binding, targetConfigDir }));
  const alias = clone(capture(options));
  alias.directories = [sessionId];
  alias.files.push({ ...alias.files[0], path: `${sessionId}/A` }, { ...alias.files[0], path: `${sessionId}/a` });
  noTarget(targetConfigDir, () => restore(alias, { ...binding, targetConfigDir }));
}));
test('hard-linked main is rejected', () => fixture(({ root, project, options }) => {
  fs.linkSync(path.join(project, `${sessionId}.jsonl`), path.join(root, 'outside-link'));
  assert.throws(() => capture(options), { code: 'NOT_SINGLE_REGULAR_FILE' });
}));
test('ancestor junction and subtree junction are rejected without reading target', () => fixture(({ root, project, options }) => {
  const external = path.join(root, 'external'); fs.mkdirSync(external);
  fs.symlinkSync(external, path.join(project, sessionId), 'junction');
  assert.throws(() => capture(options), { code: 'LINK_OR_TYPE' });
  fs.unlinkSync(path.join(project, sessionId));
  const alias = path.join(root, 'alias'); fs.symlinkSync(options.configDir, alias, 'junction');
  assert.throws(() => capture({ ...options, configDir: alias }), /LINK_OR_TYPE|PATH_ALIAS/);
}));
test('known external session state refuses instead of silently omitting it', () => fixture(({ options }) => {
  const external = path.join(options.configDir, 'file-history', sessionId); fs.mkdirSync(external, { recursive: true });
  assert.throws(() => capture(options), { code: 'UNSUPPORTED_EXTERNAL_SESSION_STATE' });
}));
test('file replacement during a real read is refused', () => fixture(({ project, options }) => {
  const original = fs.readSync, mainPath = path.join(project, `${sessionId}.jsonl`); let replaced = false;
  fs.readSync = function(...args) {
    const count = original(...args);
    if (!replaced) { replaced = true; fs.renameSync(mainPath, path.join(project, 'old-inode')); fs.writeFileSync(mainPath, main); }
    return count;
  }; syncBuiltinESMExports();
  try { assert.throws(() => capture(options), { code: 'SOURCE_CHANGED' }); }
  finally { fs.readSync = original; syncBuiltinESMExports(); }
}));
test('file, aggregate, member, depth and deadline policies bound real capture', () => fixture(({ project, options }) => {
  assert.throws(() => capture({ ...options, limits: { fileBytes: 1 } }), { code: 'BYTE_BOUND' });
  assert.throws(() => capture({ ...options, limits: { totalBytes: 1 } }), { code: 'BYTE_BOUND' });
  assert.throws(() => capture({ ...options, deadline: performance.now() - 1 }), { code: 'DEADLINE' });
  assert.throws(() => capture({ ...options, deadline: Infinity }), { code: 'DEADLINE' });
  assert.throws(() => capture({ ...options, limits: { files: 257 } }), { code: 'LIMIT_POLICY' });
  fs.mkdirSync(path.join(project, sessionId, 'a', 'b'), { recursive: true });
  fs.writeFileSync(path.join(project, sessionId, 'a', 'b', 'x'), 'x');
  assert.throws(() => capture({ ...options, limits: { depth: 2 } }), { code: 'MEMBER_BOUND' });
  assert.throws(() => capture({ ...options, limits: { members: 1 } }), { code: 'MEMBER_BOUND' });
  assert.throws(() => capture({ ...options, limits: { files: 1 } }), { code: 'FILE_BOUND' });
}));
test('existing restore target is never overwritten or cleaned', () => fixture(({ options, targetConfigDir }) => {
  fs.mkdirSync(targetConfigDir); fs.writeFileSync(path.join(targetConfigDir, 'owned-elsewhere'), 'keep');
  assert.throws(() => restore(capture(options), { ...binding, targetConfigDir }), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(path.join(targetConfigDir, 'owned-elsewhere'), 'utf8'), 'keep');
}));
test('partial restore write failure cleans only created paths and retains borrowed parent', () => fixture(({ root, options, targetConfigDir }) => {
  const b = capture(options), original = fs.writeFileSync;
  fs.writeFileSync = function(...args) { if (typeof args[0] === 'number') throw new Error('synthetic write failure'); return original(...args); };
  syncBuiltinESMExports();
  try {
    assert.throws(() => restore(b, { ...binding, targetConfigDir }), e => e.message === 'synthetic write failure' && e.cleanupComplete === true);
    assert.equal(fs.existsSync(targetConfigDir), false); assert.equal(fs.existsSync(root), true);
  } finally { fs.writeFileSync = original; syncBuiltinESMExports(); }
}));
test('cleanup refuses a substituted identity and preserves the foreign file', () => fixture(({ options, targetConfigDir }) => {
  const b = capture(options), original = fs.writeFileSync;
  const output = path.join(targetConfigDir, 'projects', binding.projectKey, `${sessionId}.jsonl`);
  fs.writeFileSync = function(...args) {
    if (typeof args[0] === 'number') {
      fs.renameSync(output, `${output}.created-original`); original(output, 'foreign'); throw new Error('substitution');
    }
    return original(...args);
  }; syncBuiltinESMExports();
  try {
    assert.throws(() => restore(b, { ...binding, targetConfigDir }), e => e.message === 'substitution' && e.cleanupComplete === false);
    assert.equal(fs.readFileSync(output, 'utf8'), 'foreign');
  } finally { fs.writeFileSync = original; syncBuiltinESMExports(); }
}));
test('builtin-only module imports without application filesystem calls', async () => {
  const source = fs.readFileSync(new URL('./native-session-files.mjs', import.meta.url), 'utf8');
  assert.deepEqual([...source.matchAll(/from '([^']+)'/g)].map(m => m[1]), ['node:fs', 'node:path', 'node:crypto', 'node:perf_hooks']);
  const originals = new Map(['openSync','mkdirSync','lstatSync','writeFileSync','opendirSync'].map(k => [k, fs[k]]));
  const sourcePath = fileURLToPath(new URL('./native-session-files.mjs', import.meta.url));
  for (const [k, original] of originals) fs[k] = (...args) => {
    // Node's loader must read exactly this source; application IO stays denied.
    if (k === 'openSync' && args[1] === 'r') {
      const requested = args[0] instanceof URL ? fileURLToPath(args[0]) : path.resolve(String(args[0]));
      if (requested === sourcePath) return original(...args);
    }
    throw new Error(`import IO:${k}`);
  };
  syncBuiltinESMExports();
  try {
    const fresh = await import('./native-session-files.mjs?inert-import-check');
    assert.deepEqual(Object.keys(fresh).sort(), ['captureNativeSessionFiles','restoreNativeSessionFiles']);
    assert.equal(createHash('sha256').update(source).digest('hex').length, 64);
  } finally { for (const [k,v] of originals) fs[k] = v; syncBuiltinESMExports(); }
});
