// Opaque transcript-file preparation only. No SDK import or import-time IO.
// The caller must exclusively own/quiesce the config namespace and prevent
// ancestor replacement. Unrelated siblings above configDir may remain active.
import * as fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const CAPS = Object.freeze({ files: 256, members: 512, fileBytes: 8 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024, depth: 12 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fail(code) { throw Object.assign(new Error(code), { code }); }
function policy(options) {
  const deadline = options.deadline ?? performance.now() + 10000;
  if (!Number.isFinite(deadline) || deadline <= performance.now() || deadline > performance.now() + 30000) fail('DEADLINE');
  const limits = { ...CAPS };
  for (const [key, value] of Object.entries(options.limits ?? {})) {
    if (!(key in CAPS) || !Number.isSafeInteger(value) || value < 1 || value > CAPS[key]) fail('LIMIT_POLICY');
    limits[key] = value;
  }
  return { limits, tick() { if (performance.now() >= deadline) fail('DEADLINE'); } };
}
function binding(value) {
  if (!value || typeof value !== 'object' || !UUID.test(value.sessionId) ||
      typeof value.cwd !== 'string' || !/^\/[A-Za-z0-9_/-]+$/.test(value.cwd) ||
      value.cwd.length > 200 || path.posix.normalize(value.cwd) !== value.cwd ||
      value.projectKey !== value.cwd.replace(/[^a-zA-Z0-9]/g, '-')) fail('BINDING');
  return Object.freeze({ cwd: value.cwd, projectKey: value.projectKey, sessionId: value.sessionId });
}
function absolute(p) {
  if (typeof p !== 'string' || !path.isAbsolute(p) || path.resolve(p) !== p) fail('ABSOLUTE_PATH');
  return p;
}
function identity(s) { return [s.dev, s.ino, s.mode, s.nlink, s.uid, s.gid, s.size, s.mtimeMs, s.ctimeMs].join(':'); }
function anchor(s) { return [s.dev, s.ino, s.mode, s.uid, s.gid].join(':'); }
function regular(s) { if (!s.isFile() || s.nlink !== 1) fail('NOT_SINGLE_REGULAR_FILE'); }
function checked(p, kind) {
  const s = fs.lstatSync(p);
  if (s.isSymbolicLink() || (kind === 'dir' ? !s.isDirectory() : !s.isFile())) fail('LINK_OR_TYPE');
  if (fs.realpathSync(p) !== p) fail('PATH_ALIAS');
  if (kind === 'file') regular(s);
  return s;
}
function optionalStat(p) { try { return fs.lstatSync(p); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
function ancestors(p, ownedRoot = p) {
  const result = []; let borrowed = false;
  for (let cursor = p;; cursor = path.dirname(cursor)) {
    const s = checked(cursor, 'dir');
    result.push([cursor, borrowed ? anchor(s) : identity(s), borrowed]);
    if (cursor === ownedRoot) borrowed = true;
    if (path.dirname(cursor) === cursor) break;
  }
  return result;
}
function unchanged(rows) {
  for (const [p, before, borrowed] of rows) {
    const after = borrowed ? anchor(checked(p, 'dir')) : identity(fs.lstatSync(p));
    if (after !== before) fail('SOURCE_CHANGED');
  }
}
function segment(name) {
  // Portable finite names also reject Windows device aliases, ADS and NFC collisions.
  if (typeof name !== 'string' || name.length > 128 || name.normalize('NFC') !== name ||
      !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name) || name.endsWith('.') ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) fail('MEMBER_PATH');
}
function member(name, b) {
  if (typeof name !== 'string') fail('MEMBER_PATH');
  name.split('/').forEach(segment);
  if (name !== b.sessionId && name !== `${b.sessionId}.jsonl` && !name.startsWith(`${b.sessionId}/`)) fail('FOREIGN_SESSION');
  return name.split('/');
}
function namesIn(p, state) {
  const dir = fs.opendirSync(p), names = [];
  try {
    for (;;) {
      state.tick(); const row = dir.readSync(); if (!row) break;
      segment(row.name); names.push(row.name);
      if (names.length > state.limits.members) fail('MEMBER_BOUND');
    }
  } finally { dir.closeSync(); }
  return names.sort();
}
function readStable(p, state) {
  state.tick();
  if (state.files >= state.limits.files) fail('FILE_BOUND');
  const before = checked(p, 'file');
  if (before.size > state.limits.fileBytes || state.bytes + before.size > state.limits.totalBytes) fail('BYTE_BOUND');
  const fd = fs.openSync(p, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
  try {
    const opened = fs.fstatSync(fd); regular(opened);
    if (identity(opened) !== identity(before)) fail('SOURCE_CHANGED');
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      state.tick();
      const n = fs.readSync(fd, bytes, offset, Math.min(65536, bytes.length - offset), offset);
      if (!n) fail('SOURCE_CHANGED');
      offset += n;
    }
    if (identity(fs.fstatSync(fd)) !== identity(opened) || identity(checked(p, 'file')) !== identity(before)) fail('SOURCE_CHANGED');
    state.bytes += bytes.length;
    state.files++;
    if (state.files > state.limits.files) fail('FILE_BOUND');
    state.observed.push([p, identity(before)]);
    return bytes;
  } finally { fs.closeSync(fd); }
}

export function captureNativeSessionFiles(options) {
  const b = binding(options), config = absolute(options.configDir);
  const state = { ...policy(options), bytes: 0, files: 0, members: 0, observed: [] };
  const project = path.join(config, 'projects', b.projectKey);
  // Shared parents can change metadata when other tasks allocate siblings.
  // Keep their identity/type/owner anchors; snapshot full owned-root metadata.
  const roots = ancestors(project, config);
  // These SDK namespaces need separate scoped capture/restore designs.
  for (const kind of ['file-history', 'scratch', 'session-env']) {
    const parent = path.join(config, kind);
    if (optionalStat(parent)) {
      checked(parent, 'dir');
      if (optionalStat(path.join(parent, b.sessionId))) fail('UNSUPPORTED_EXTERNAL_SESSION_STATE');
    }
  }
  const files = [], directories = [], portableNames = new Set();
  function visit(rel, depth) {
    state.tick(); member(rel, b);
    if (portableNames.has(rel.toLowerCase())) fail('CASE_ALIAS');
    portableNames.add(rel.toLowerCase());
    if (++state.members > state.limits.members || depth > state.limits.depth) fail('MEMBER_BOUND');
    const p = path.join(project, ...rel.split('/'));
    const s = fs.lstatSync(p);
    if (s.isDirectory() && !s.isSymbolicLink()) {
      checked(p, 'dir'); directories.push(rel);
      const names = namesIn(p, state);
      const before = identity(s);
      for (const name of names) visit(`${rel}/${name}`, depth + 1);
      if (identity(checked(p, 'dir')) !== before || JSON.stringify(namesIn(p, state)) !== JSON.stringify(names)) fail('SOURCE_CHANGED');
      state.observed.push([p, before]);
    } else {
      const bytes = readStable(p, state);
      files.push(Object.freeze({ path: rel, bytes: bytes.length, sha256: sha(bytes), base64: bytes.toString('base64') }));
    }
  }
  visit(`${b.sessionId}.jsonl`, 1);
  if (!files[0].bytes) fail('EMPTY_MAIN');
  const subtree = path.join(project, b.sessionId);
  if (optionalStat(subtree)) visit(b.sessionId, 1);
  state.tick(); unchanged(state.observed); unchanged(roots);
  return Object.freeze({ format: 'meri-native-session-files-v1', sdk: '0.3.295', cli: '2.1.295',
    binding: b, directories: Object.freeze(directories), files: Object.freeze(files), totalBytes: state.bytes });
}

export function restoreNativeSessionFiles(bundle, options) {
  const b = binding(options), state = policy(options), target = absolute(options.targetConfigDir);
  const same = bundle?.binding;
  if (bundle?.format !== 'meri-native-session-files-v1' || bundle.sdk !== '0.3.295' || bundle.cli !== '2.1.295' ||
      !same || Object.keys(b).some(k => same[k] !== b[k]) || !Array.isArray(bundle.files) || !Array.isArray(bundle.directories)) fail('BUNDLE_BINDING');
  if (bundle.files.length > state.limits.files || bundle.files.length + bundle.directories.length > state.limits.members) fail('MEMBER_BOUND');
  const dirs = new Set(), names = new Set(), portableNames = new Set(), staged = []; let total = 0;
  function reserveName(name) {
    if (portableNames.has(name.toLowerCase())) fail('CASE_ALIAS');
    portableNames.add(name.toLowerCase()); names.add(name);
  }
  for (const dir of bundle.directories) {
    state.tick(); const parts = member(dir, b);
    if (dir === `${b.sessionId}.jsonl` || parts.length > state.limits.depth || names.has(dir)) fail('MEMBER_PATH');
    dirs.add(dir); reserveName(dir);
  }
  for (const row of bundle.files) {
    state.tick(); const parts = member(row.path, b);
    if (row.path === b.sessionId || names.has(row.path) || parts.length > state.limits.depth || !Number.isSafeInteger(row.bytes) || row.bytes < 0 ||
        row.bytes > state.limits.fileBytes || typeof row.base64 !== 'string' || row.base64.length > Math.ceil(row.bytes / 3) * 4 ||
        !/^[0-9a-f]{64}$/.test(row.sha256)) fail('FILE_RECORD');
    const bytes = Buffer.from(row.base64, 'base64');
    if (bytes.length !== row.bytes || bytes.toString('base64') !== row.base64 || sha(bytes) !== row.sha256) fail('CONTENT_HASH');
    reserveName(row.path); total += bytes.length;
    if (total > state.limits.totalBytes) fail('BYTE_BOUND');
    staged.push({ path: row.path, bytes });
  }
  if (!staged.some(r => r.path === `${b.sessionId}.jsonl` && r.bytes.length > 0) || total !== bundle.totalBytes) fail('MISSING_MAIN_OR_TOTAL');
  for (const name of names) {
    const parts = name.split('/');
    for (let n = 1; n < parts.length; n++) if (!dirs.has(parts.slice(0, n).join('/'))) fail('MISSING_OR_CONFLICTING_ANCESTOR');
  }
  // Complete validation above precedes even target creation. Parent is borrowed.
  const parent = path.dirname(target), parents = ancestors(parent).map(([p]) => [p, anchor(checked(p, 'dir'))]), created = [];
  function mkdir(p) { state.tick(); fs.mkdirSync(p, { mode: 0o700 }); created.push([p, 'dir', anchor(checked(p, 'dir'))]); }
  try {
    mkdir(target); mkdir(path.join(target, 'projects'));
    const project = path.join(target, 'projects', b.projectKey); mkdir(project);
    for (const dir of [...dirs].sort((a, c) => a.split('/').length - c.split('/').length || a.localeCompare(c))) mkdir(path.join(project, ...dir.split('/')));
    for (const row of staged) {
      state.tick(); const p = path.join(project, ...row.path.split('/'));
      const fd = fs.openSync(p, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW ?? 0), 0o600);
      try {
        // Record the created identity even if write/fsync fails.
        created.push([p, 'file', anchor(fs.fstatSync(fd))]);
        fs.writeFileSync(fd, row.bytes); fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      const s = checked(p, 'file');
      if (anchor(s) !== created[created.length - 1][2]) fail('RESTORE_CHANGED');
      const verified = readStable(p, { ...state, bytes: 0, files: 0, observed: [] });
      if (!verified.equals(row.bytes)) fail('RESTORE_CONTENT');
    }
    state.tick();
    // Parent mtimes change from our own mkdir; identity guards use dev/ino/type.
    for (const [p, before] of parents) {
      if (anchor(checked(p, 'dir')) !== before) fail('PARENT_CHANGED');
    }
    return Object.freeze({ format: bundle.format, binding: b, targetConfigDir: target, files: staged.length, bytes: total });
  } catch (error) {
    let cleanupComplete = true;
    for (const [p, kind, expected] of created.reverse()) {
      try {
        const s = checked(p, kind);
        // Directory mtimes change from our own writes. Never remove a replaced inode.
        if (!expected || anchor(s) !== expected) fail('CLEANUP_IDENTITY_UNKNOWN');
        if (kind === 'file') fs.unlinkSync(p); else fs.rmdirSync(p);
      } catch { cleanupComplete = false; }
    }
    error.cleanupComplete = cleanupComplete;
    throw error;
  }
}
