import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFixtureSentinel as write, readFixtureSentinel as read } from './fixture-sentinel.mjs';

const hash = raw => createHash('sha256').update(raw).digest('hex');
const sentinel = (raw = Buffer.from('SYNTHETIC-CONTINUITY\r\n\0\xff', 'latin1')) => ({
  path: 'qualification/continuity.txt', bytes: raw.length, sha256: hash(raw), base64: raw.toString('base64') });
const options = workspaceRoot => ({ workspaceRoot, deadline: performance.now() + 1000 });
const output = root => path.join(root, 'qualification', 'continuity.txt');
function fixture(fn) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'meri-sentinel-'));
  const a = path.join(parent, 'A'), b = path.join(parent, 'B');
  fs.mkdirSync(a, { mode: 0o700 }); fs.mkdirSync(b, { mode: 0o700 });
  try { return fn({ parent, a, b, file: sentinel() }); }
  finally { fs.rmSync(parent, { recursive: true, force: true }); }
}
function patch(name, replacement, fn) {
  const original = fs[name]; fs[name] = (...args) => replacement(original, ...args);
  syncBuiltinESMExports();
  try { return fn(); } finally { fs[name] = original; syncBuiltinESMExports(); }
}

test('two physical fresh workspaces retain exact binary bytes and nonexecuting private modes', () => fixture(({ a, b, file }) => {
  const first = write(file, options(a));
  assert.deepEqual(first, file); assert.equal(Object.isFrozen(first), true);
  const captured = read(file, options(a));
  assert.deepEqual(captured, file);
  assert.deepEqual(write(captured, options(b)), file);
  assert.deepEqual(read(captured, options(b)), file);
  assert.deepEqual(fs.readFileSync(output(a)), fs.readFileSync(output(b)));
  assert.equal(fs.statSync(output(a)).mode & 0o7777, 0o600);
  assert.equal(fs.statSync(path.dirname(output(a))).mode & 0o7777, 0o700);
  assert.equal('completeRecoveryCheckpoint' in first, false);
  assert.equal('durable' in first, false);
}));

test('file and both created-directory metadata are actually fsynced before success', () => fixture(({ a, file }) => {
  const synced = [];
  patch('fsyncSync', (original, fd) => { synced.push(fs.fstatSync(fd).isDirectory() ? 'directory' : 'file'); return original(fd); }, () => {
    assert.deepEqual(write(file, options(a)), file);
  });
  assert.deepEqual(synced, ['file', 'directory', 'directory']);
}));

test('caller DTO mutation after validation cannot change the owned write or readback', () => fixture(({ a, file }) => {
  const expected = structuredClone(file); let mutated = false;
  patch('openSync', (original, ...args) => {
    if (!mutated) {
      mutated = true; Object.assign(file, sentinel(Buffer.from('caller changed after snapshot')));
      file.path = '../outside';
    }
    return original(...args);
  }, () => assert.deepEqual(write(file, options(a)), expected));
  assert.deepEqual(read(expected, options(a)), expected);
  assert.deepEqual(fs.readFileSync(output(a)), Buffer.from(expected.base64, 'base64'));
}));

test('maximum canonical 65,536-byte sentinel succeeds; larger input refuses before allocation', () => fixture(({ a, b }) => {
  const maximum = sentinel(Buffer.alloc(65536, 0x9b));
  assert.deepEqual(write(maximum, options(a)), maximum);
  assert.throws(() => write(sentinel(Buffer.alloc(65537)), options(b)), /INVALID_FIXTURE_Sentinel/);
  assert.deepEqual(fs.readdirSync(b), []);
}));

test('invalid shape, digest, encoding and accessors refuse without filesystem calls', () => fixture(({ a, file }) => {
  const invalid = [undefined, { ...file, path: '../outside' }, { ...file, extra: true },
    { ...file, bytes: 0 }, { ...file, bytes: file.bytes + 1 }, { ...file, sha256: '0'.repeat(64) },
    { ...file, base64: `${file.base64}\n` }];
  let getters = 0;
  const accessor = { ...file }; Object.defineProperty(accessor, 'base64', { enumerable: true,
    get() { getters++; return file.base64; } }); invalid.push(accessor);
  patch('lstatSync', () => { throw new Error('UNEXPECTED_FILESYSTEM'); }, () => {
    for (const data of invalid) assert.throws(() => write(data, options(a)), e => e.message !== 'UNEXPECTED_FILESYSTEM');
  });
  assert.equal(getters, 0); assert.deepEqual(fs.readdirSync(a), []);
}));

test('oversized base64 refuses before canonical copying, decoding or filesystem access', () => fixture(({ a, file }) => {
  const large = 'A'.repeat(87388), originalStringify = JSON.stringify, originalFrom = Buffer.from;
  let serialized = 0, decoded = 0;
  JSON.stringify = function(value, ...args) {
    if (value === large) { serialized++; throw new Error('UNEXPECTED_CANONICAL_COPY'); }
    return originalStringify(value, ...args);
  };
  Buffer.from = function(value, ...args) {
    if (value === large) { decoded++; throw new Error('UNEXPECTED_BASE64_ALLOCATION'); }
    return originalFrom(value, ...args);
  };
  try {
    patch('lstatSync', () => { throw new Error('UNEXPECTED_FILESYSTEM'); }, () => {
      assert.throws(() => write({ ...file, base64: large }, options(a)), /INVALID_FIXTURE_Sentinel/);
    });
  } finally { JSON.stringify = originalStringify; Buffer.from = originalFrom; }
  assert.equal(serialized, 0); assert.equal(decoded, 0); assert.deepEqual(fs.readdirSync(a), []);
}));

test('proxy inputs are refused without invoking traps or filesystem operations', () => fixture(({ a, file }) => {
  let traps = 0;
  const handler = Object.fromEntries(['get', 'getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor'].map(name =>
    [name, () => { traps++; throw new Error(`UNEXPECTED_PROXY_TRAP:${name}`); }]));
  patch('lstatSync', () => { throw new Error('UNEXPECTED_FILESYSTEM'); }, () => {
    assert.throws(() => write(new Proxy(file, handler), options(a)), /FIXTURE_JSON_ONLY/);
    assert.throws(() => write(file, new Proxy(options(a), handler)), /SENTINEL_OPTIONS/);
  });
  assert.equal(traps, 0); assert.deepEqual(fs.readdirSync(a), []);
}));

test('expired, overlong and malformed deadlines/options refuse before filesystem allocation', () => fixture(({ a, file }) => {
  const invalid = [{ workspaceRoot: a, deadline: performance.now() - 1 },
    { workspaceRoot: a, deadline: Infinity }, { workspaceRoot: a, deadline: performance.now() + 60000 },
    { ...options(a), override: 'outside' }, options(`${a}/.`), options('relative'), options('/')];
  let getters = 0;
  const accessor = { workspaceRoot: a }; Object.defineProperty(accessor, 'deadline', { enumerable: true,
    get() { getters++; return performance.now() + 1000; } }); invalid.push(accessor);
  patch('lstatSync', () => { throw new Error('UNEXPECTED_FILESYSTEM'); }, () => {
    for (const value of invalid) assert.throws(() => write(file, value), e => e.message !== 'UNEXPECTED_FILESYSTEM');
  });
  assert.equal(getters, 0); assert.deepEqual(fs.readdirSync(a), []);
}));

test('missing borrowed root is never created and existing sentinel is never overwritten', () => fixture(({ parent, a, file }) => {
  const missing = path.join(parent, 'missing');
  assert.throws(() => write(file, options(missing)), { code: 'ENOENT' });
  assert.equal(fs.existsSync(missing), false);
  write(file, options(a));
  assert.throws(() => write(sentinel(Buffer.from('foreign')), options(a)), { code: 'EEXIST' });
  assert.deepEqual(read(file, options(a)), file);
  assert.equal(fs.existsSync(a), true);
}));

test('preexisting qualification directory is borrowed and remains untouched', () => fixture(({ a, file }) => {
  const dir = path.join(a, 'qualification'); fs.mkdirSync(dir, { mode: 0o700 });
  fs.writeFileSync(path.join(dir, 'owned-elsewhere'), 'keep');
  assert.throws(() => write(file, options(a)), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(path.join(dir, 'owned-elsewhere'), 'utf8'), 'keep');
}));

test('workspace and ancestor aliases refuse without changing their targets', () => fixture(({ parent, a, file }) => {
  const alias = path.join(parent, 'alias'); fs.symlinkSync(a, alias);
  assert.throws(() => write(file, options(alias)), /SENTINEL_LINK_OR_TYPE|SENTINEL_PATH_ALIAS/);
  const ancestorAlias = path.join(parent, 'ancestor-alias'); fs.symlinkSync(parent, ancestorAlias);
  assert.throws(() => write(file, options(path.join(ancestorAlias, 'A'))), /SENTINEL_PATH_ALIAS/);
  assert.deepEqual(fs.readdirSync(a), []);
}));

test('qualification and file symlinks refuse without reading or writing external bytes', () => fixture(({ parent, a, b, file }) => {
  const external = path.join(parent, 'external'); fs.mkdirSync(external, { mode: 0o700 });
  fs.symlinkSync(external, path.join(a, 'qualification'));
  assert.throws(() => write(file, options(a)), { code: 'EEXIST' });
  assert.throws(() => read(file, options(a)), /SENTINEL_LINK_OR_TYPE/);
  assert.deepEqual(fs.readdirSync(external), []);
  write(file, options(b)); fs.renameSync(output(b), path.join(parent, 'original'));
  fs.symlinkSync(path.join(parent, 'original'), output(b));
  assert.throws(() => read(file, options(b)), /SENTINEL_REGULAR_REQUIRED/);
  assert.deepEqual(fs.readFileSync(path.join(parent, 'original')), Buffer.from(file.base64, 'base64'));
}));

test('hard links, directories, executable modes and oversized physical files refuse', () => fixture(({ parent, a, file }) => {
  write(file, options(a));
  const hardlink = path.join(parent, 'hardlink'); fs.linkSync(output(a), hardlink);
  assert.throws(() => read(file, options(a)), /SENTINEL_REGULAR_REQUIRED/); fs.unlinkSync(hardlink);
  fs.chmodSync(output(a), 0o700); assert.throws(() => read(file, options(a)), /SENTINEL_REGULAR_REQUIRED/);
  fs.chmodSync(output(a), 0o600); fs.writeFileSync(output(a), Buffer.alloc(65537));
  assert.throws(() => read(file, options(a)), /SENTINEL_CONTENT_MISMATCH/);
  fs.unlinkSync(output(a)); fs.mkdirSync(output(a));
  assert.throws(() => read(file, options(a)), /SENTINEL_REGULAR_REQUIRED/);
}));

test('a physical FIFO refuses before open and never waits for a writer', () => fixture(({ a, file }) => {
  fs.mkdirSync(path.join(a, 'qualification'), { mode: 0o700 });
  // Coreutils mkfifo creates only this owned test entry; no SDK/network process.
  execFileSync('/usr/bin/mkfifo', [output(a)], { timeout: 1000 });
  const started = performance.now();
  assert.throws(() => read(file, options(a)), /SENTINEL_REGULAR_REQUIRED/);
  assert.ok(performance.now() - started < 1000);
  assert.equal(fs.lstatSync(output(a)).isFIFO(), true);
}));

test('same-size tampering and substituted inode during read are refused', () => fixture(({ a, file }) => {
  write(file, options(a)); fs.writeFileSync(output(a), Buffer.alloc(file.bytes));
  assert.throws(() => read(file, options(a)), /SENTINEL_CONTENT_MISMATCH/);
  fs.writeFileSync(output(a), Buffer.from(file.base64, 'base64'));
  let substituted = false;
  patch('readSync', (original, ...args) => {
    const n = original(...args);
    if (!substituted) { substituted = true; fs.renameSync(output(a), `${output(a)}.old`); fs.writeFileSync(output(a), Buffer.from(file.base64, 'base64'), { mode: 0o600 }); }
    return n;
  }, () => assert.throws(() => read(file, options(a)), /SENTINEL_FILE_CHANGED/));
  assert.equal(fs.existsSync(`${output(a)}.old`), true);
}));

test('partial write and fsync failures clean created entries but retain borrowed roots', () => fixture(({ a, b, file }) => {
  for (const [root, method] of [[a, 'writeSync'], [b, 'fsyncSync']]) {
    patch(method, () => { throw new Error('SYNTHETIC_WRITE_FAILURE'); }, () => {
      assert.throws(() => write(file, options(root)), e => e.message === 'SYNTHETIC_WRITE_FAILURE' && e.cleanupComplete === true);
    });
    assert.deepEqual(fs.readdirSync(root), []); assert.equal(fs.existsSync(root), true);
  }
}));

test('failure cleanup preserves substituted foreign file and reports incomplete cleanup', () => fixture(({ a, file }) => {
  let substituted = false;
  patch('writeSync', (original, ...args) => {
    if (substituted) return original(...args);
    substituted = true;
    fs.renameSync(output(a), `${output(a)}.owned-original`);
    fs.writeFileSync(output(a), 'foreign', { mode: 0o600 }); throw new Error('SYNTHETIC_SUBSTITUTION');
  }, () => assert.throws(() => write(file, options(a)), e => e.message === 'SYNTHETIC_SUBSTITUTION' && e.cleanupComplete === false));
  assert.equal(fs.readFileSync(output(a), 'utf8'), 'foreign');
  assert.equal(fs.existsSync(`${output(a)}.owned-original`), true);
}));

test('descriptor anchoring detects a renamed qualification directory and retains foreign paths', () => fixture(({ a, file }) => {
  let substituted = false;
  patch('writeSync', (original, ...args) => {
    const n = original(...args); if (substituted) return n;
    substituted = true; const dir = path.join(a, 'qualification');
    fs.renameSync(dir, `${dir}.owned-original`); fs.mkdirSync(dir, { mode: 0o700 });
    fs.writeFileSync(path.join(dir, 'foreign'), 'keep'); return n;
  }, () => assert.throws(() => write(file, options(a)), e => /SENTINEL_DIRECTORY_CHANGED/.test(e.message) && e.cleanupComplete === false));
  assert.equal(fs.readFileSync(path.join(a, 'qualification', 'foreign'), 'utf8'), 'keep');
  assert.equal(fs.existsSync(path.join(a, 'qualification.owned-original')), true);
}));

test('read-only verification never creates a missing qualification directory', () => fixture(({ a, file }) => {
  assert.throws(() => read(file, options(a)), { code: 'ENOENT' }); assert.deepEqual(fs.readdirSync(a), []);
}));

test('module imports without workspace operations or ambient CLI setup', async () => {
  const sourcePath = fileURLToPath(new URL('./fixture-sentinel.mjs', import.meta.url));
  const contractPath = fileURLToPath(new URL('../../../../packages/contracts/qualification-sdk/validate.mjs', import.meta.url));
  const names = ['openSync', 'mkdirSync', 'lstatSync', 'realpathSync', 'fsyncSync', 'writeSync'];
  const originals = new Map(names.map(name => [name, fs[name]]));
  for (const name of names) fs[name] = (...args) => {
    if (name === 'realpathSync' && [sourcePath, contractPath].includes(String(args[0]))) return originals.get(name)(...args);
    if (name === 'openSync' && args[1] === 'r') {
      const requested = args[0] instanceof URL ? fileURLToPath(args[0]) : path.resolve(String(args[0]));
      if (requested === sourcePath) return originals.get(name)(...args);
    }
    throw new Error(`IMPORT_WORKSPACE_IO:${name}`);
  };
  syncBuiltinESMExports();
  try {
    const loaded = await import('./fixture-sentinel.mjs?inert');
    assert.deepEqual(Object.keys(loaded).sort(), ['readFixtureSentinel', 'writeFixtureSentinel']);
  } finally { for (const [name, original] of originals) fs[name] = original; syncBuiltinESMExports(); }
});
