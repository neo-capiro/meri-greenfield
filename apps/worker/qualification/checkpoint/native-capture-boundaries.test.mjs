import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { captureNativeSessionFiles as capture } from './native-session-files.mjs';

const sessionId = '5be61438-0098-4239-bdb1-01b32604209e';
const binding = { sessionId, cwd: '/workspace/conversation', projectKey: '-workspace-conversation' };
const transcript = Buffer.from('opaque unchanged transcript\n');

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meri-native-boundary-'));
  const borrowed = path.join(root, 'borrowed');
  const configDir = path.join(borrowed, 'config');
  const projects = path.join(configDir, 'projects');
  const project = path.join(projects, binding.projectKey);
  const main = path.join(project, `${sessionId}.jsonl`);
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(main, transcript);
  try { return fn({ root, borrowed, configDir, projects, project, main, options: { ...binding, configDir } }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function duringIO(method, change, fn) {
  const original = fs[method];
  let changed = false;
  fs[method] = (...args) => {
    const count = original(...args);
    if (!changed) { changed = true; change(); }
    return count;
  };
  syncBuiltinESMExports();
  try { fn(); assert.equal(changed, true, `change ran after real ${method}`); }
  finally { fs[method] = original; syncBuiltinESMExports(); }
}
const duringRead = (change, fn) => duringIO('readSync', change, fn);
const afterClose = (change, fn) => duringIO('closeSync', change, fn);

function sibling(parent) {
  fs.mkdirSync(path.join(parent, 'unrelated-fixture'));
  // Ensure the same real mutation is observable on coarse-timestamp filesystems.
  fs.utimesSync(parent, new Date(), new Date(Date.now() + 2000));
}

test('unrelated sibling creation above the owned config does not change captured bytes', () => fixture(({ borrowed, main, options }) => {
  const before = fs.statSync(borrowed, { bigint: true });
  const expected = capture(options);
  duringRead(() => sibling(borrowed), () => assert.deepEqual(capture(options), expected));
  const after = fs.statSync(borrowed, { bigint: true });
  assert.equal(after.dev, before.dev);
  assert.equal(after.ino, before.ino);
  assert.notEqual(after.mtimeNs, before.mtimeNs);
  assert.deepEqual(fs.readFileSync(main), transcript);
}));

for (const location of ['configDir', 'projects', 'project']) {
  test(`mutation within owned ${location} remains a capture refusal`, () => fixture(f => {
    duringRead(() => sibling(f[location]), () => assert.throws(() => capture(f.options), { code: 'SOURCE_CHANGED' }));
  }));
}

test('replacing a borrowed ancestor while preserving its child namespace is refused', () => fixture(({ root, borrowed, configDir, main, options }) => {
  const moved = path.join(root, 'moved-parent');
  const beforeFile = fs.statSync(main, { bigint: true });
  const beforeParent = fs.statSync(borrowed, { bigint: true });
  // Windows refuses directory renames while its descendant file is open.
  afterClose(() => {
    fs.renameSync(borrowed, moved);
    fs.mkdirSync(borrowed);
    fs.renameSync(path.join(moved, 'config'), configDir);
  }, () => assert.throws(() => capture(options), { code: 'SOURCE_CHANGED' }));
  assert.equal(fs.statSync(main, { bigint: true }).ino, beforeFile.ino);
  assert.notEqual(fs.statSync(borrowed, { bigint: true }).ino, beforeParent.ino);
  assert.deepEqual(fs.readFileSync(main), transcript);
}));

test('replacing a borrowed ancestor with a junction remains a refusal', () => fixture(({ root, borrowed, options }) => {
  const moved = path.join(root, 'moved-parent');
  afterClose(() => {
    fs.renameSync(borrowed, moved);
    fs.symlinkSync(moved, borrowed, 'junction');
  }, () => assert.throws(() => capture(options), /PATH_ALIAS|LINK_OR_TYPE|SOURCE_CHANGED/));
}));

test('same-length transcript writes remain a refusal', () => fixture(({ main, options }) => {
  duringRead(() => {
    fs.writeFileSync(main, Buffer.alloc(transcript.length, 120));
    fs.utimesSync(main, new Date(), new Date(Date.now() + 2000));
  }, () => assert.throws(() => capture(options), { code: 'SOURCE_CHANGED' }));
}));
