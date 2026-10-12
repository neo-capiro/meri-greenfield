// One fixed Linux qualification file, not a workspace snapshot implementation.
// The caller exclusively owns/quiesces the borrowed root and its ancestors.
// Imports perform no workspace IO; only descriptors opened here are closed here.
import * as fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { types } from 'node:util';
import { assertFixtureSentinelPayload, snapshotFixtureData } from '../../../../packages/contracts/qualification-sdk/validate.mjs';

const fail = code => { throw Object.assign(new Error(code), { code }); };
const anchor = s => [s.dev, s.ino, s.mode, s.uid, s.gid].join(':');
const identity = s => [anchor(s), s.nlink, s.size, s.mtimeMs, s.ctimeMs].join(':');
const fdPath = fd => `/proc/self/fd/${fd}`;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function inputs(supplied, options) {
  // Canonical shape and byte checks precede any descriptor or filesystem effect.
  assertFixtureSentinelPayload(supplied);
  const file = snapshotFixtureData(supplied); assertFixtureSentinelPayload(file);
  if (!options || types.isProxy(options) || Object.getPrototypeOf(options) !== Object.prototype ||
      Reflect.ownKeys(options).length !== 2) fail('SENTINEL_OPTIONS');
  const descriptors = Object.getOwnPropertyDescriptors(options);
  for (const name of ['workspaceRoot', 'deadline']) {
    const d = descriptors[name];
    if (!d?.enumerable || !Object.hasOwn(d, 'value')) fail('SENTINEL_OPTIONS');
  }
  const workspaceRoot = descriptors.workspaceRoot.value, deadline = descriptors.deadline.value;
  if (typeof workspaceRoot !== 'string' || workspaceRoot.length > 2048 ||
      workspaceRoot === '/' || !path.isAbsolute(workspaceRoot) ||
      path.resolve(workspaceRoot) !== workspaceRoot) fail('SENTINEL_ROOT');
  const now = performance.now();
  if (!Number.isFinite(deadline) || deadline <= now || deadline > now + 30000) fail('SENTINEL_DEADLINE');
  if (process.platform !== 'linux' || !fs.constants.O_NOFOLLOW || !fs.constants.O_DIRECTORY ||
      !fs.constants.O_NONBLOCK) fail('SENTINEL_LINUX_REQUIRED');
  return { workspaceRoot, file, tick() { if (performance.now() >= deadline) fail('SENTINEL_DEADLINE'); } };
}

function directory(p) {
  const s = fs.lstatSync(p);
  if (s.isSymbolicLink() || !s.isDirectory()) fail('SENTINEL_LINK_OR_TYPE');
  return s;
}
function regular(s) {
  if (!s.isFile() || s.nlink !== 1 || (s.mode & 0o7777) !== 0o600) fail('SENTINEL_REGULAR_REQUIRED');
}
function withRoot(state, operation) {
  state.tick();
  // An alias at any borrowed ancestor is refused before opening the root.
  for (let p = state.workspaceRoot;; p = path.dirname(p)) {
    state.tick(); directory(p);
    if (fs.realpathSync(p) !== p) fail('SENTINEL_PATH_ALIAS');
    if (path.dirname(p) === p) break;
  }
  const before = directory(state.workspaceRoot);
  const root = fs.openSync(state.workspaceRoot, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try {
    const owned = fs.fstatSync(root);
    if (!owned.isDirectory() || anchor(owned) !== anchor(before)) fail('SENTINEL_ROOT_CHANGED');
    const check = () => {
      state.tick();
      if (fs.realpathSync(fdPath(root)) !== state.workspaceRoot ||
          anchor(directory(state.workspaceRoot)) !== anchor(owned)) fail('SENTINEL_ROOT_CHANGED');
    };
    check(); return operation(root, check);
  } finally { fs.closeSync(root); }
}
function openQualification(root, state, checkRoot) {
  checkRoot();
  const named = `${fdPath(root)}/qualification`, before = directory(named);
  if ((before.mode & 0o7777) !== 0o700) fail('SENTINEL_DIRECTORY_MODE');
  const dir = fs.openSync(named, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(dir);
    if (!opened.isDirectory() || anchor(opened) !== anchor(before)) fail('SENTINEL_DIRECTORY_CHANGED');
    const check = () => {
      checkRoot();
      if (fs.realpathSync(fdPath(dir)) !== `${state.workspaceRoot}/qualification` ||
          anchor(directory(named)) !== anchor(opened)) fail('SENTINEL_DIRECTORY_CHANGED');
    };
    check(); return { dir, check };
  } catch (error) { fs.closeSync(dir); throw error; }
}
function readAt(dir, state, check) {
  check();
  const named = `${fdPath(dir)}/continuity.txt`, before = fs.lstatSync(named);
  regular(before);
  if (before.size !== state.file.bytes) fail('SENTINEL_CONTENT_MISMATCH');
  const file = fs.openSync(named, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const opened = fs.fstatSync(file); regular(opened);
    if (identity(opened) !== identity(before)) fail('SENTINEL_FILE_CHANGED');
    const raw = Buffer.alloc(state.file.bytes); let offset = 0;
    while (offset < raw.length) {
      state.tick();
      const n = fs.readSync(file, raw, offset, raw.length - offset, offset);
      if (!n) fail('SENTINEL_FILE_CHANGED');
      offset += n;
    }
    const after = fs.lstatSync(named); regular(after);
    if (identity(fs.fstatSync(file)) !== identity(opened) || identity(after) !== identity(before)) fail('SENTINEL_FILE_CHANGED');
    const actual = Object.freeze({ path: state.file.path, bytes: raw.length,
      sha256: digest(raw), base64: raw.toString('base64') });
    if (actual.sha256 !== state.file.sha256 || actual.base64 !== state.file.base64) fail('SENTINEL_CONTENT_MISMATCH');
    check(); return actual;
  } finally { fs.closeSync(file); }
}

/** Create/fsync/read back the fixed sentinel in a fresh qualification directory. */
export function writeFixtureSentinel(fixtureFile, options) {
  const state = inputs(fixtureFile, options);
  return withRoot(state, (root, checkRoot) => {
    const namedDir = `${fdPath(root)}/qualification`;
    let directoryCreated = false, createdDir, createdFile, opened;
    try {
      checkRoot(); fs.mkdirSync(namedDir, { mode: 0o700 }); directoryCreated = true;
      createdDir = anchor(directory(namedDir));
      opened = openQualification(root, state, checkRoot);
      const namedFile = `${fdPath(opened.dir)}/continuity.txt`;
      state.tick();
      const file = fs.openSync(namedFile, fs.constants.O_WRONLY | fs.constants.O_CREAT |
        fs.constants.O_EXCL | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600);
      try {
        createdFile = anchor(fs.fstatSync(file));
        const raw = Buffer.from(state.file.base64, 'base64'); let offset = 0;
        while (offset < raw.length) {
          state.tick();
          const n = fs.writeSync(file, raw, offset, raw.length - offset, offset);
          if (!n) fail('SENTINEL_WRITE_INCOMPLETE');
          offset += n;
        }
        state.tick(); fs.fsyncSync(file);
      } finally { fs.closeSync(file); }
      const actual = readAt(opened.dir, state, opened.check);
      state.tick(); fs.fsyncSync(opened.dir); fs.fsyncSync(root);
      opened.check(); return actual;
    } catch (error) {
      // Remove only created identities, through our anchored descriptors.
      // A replacement/foreign entry is retained and makes cleanup incomplete.
      let cleanupComplete = !directoryCreated || createdDir !== undefined;
      if (createdFile) {
        try {
          const namedFile = `${fdPath(opened.dir)}/continuity.txt`;
          if (anchor(fs.lstatSync(namedFile)) !== createdFile) fail('SENTINEL_CLEANUP_IDENTITY');
          fs.unlinkSync(namedFile);
        } catch { cleanupComplete = false; }
      }
      if (createdDir) {
        try {
          if (anchor(directory(namedDir)) !== createdDir) fail('SENTINEL_CLEANUP_IDENTITY');
          fs.rmdirSync(namedDir);
        } catch { cleanupComplete = false; }
      }
      error.cleanupComplete = cleanupComplete; throw error;
    } finally { if (opened) fs.closeSync(opened.dir); }
  });
}

/** Read/compare only the fixed sentinel; no filesystem entries are created. */
export function readFixtureSentinel(fixtureFile, options) {
  const state = inputs(fixtureFile, options);
  return withRoot(state, (root, checkRoot) => {
    const opened = openQualification(root, state, checkRoot);
    try { return readAt(opened.dir, state, opened.check); }
    finally { fs.closeSync(opened.dir); }
  });
}
