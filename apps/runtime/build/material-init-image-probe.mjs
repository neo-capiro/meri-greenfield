// Packaged copy-up probe for the existing ordinary image build. Source only in this continuation: the physical
// container/volume path is authored but not executed here. Imports resolve inside the packaged /opt/meri tree.
// The image-owned upload directories are observed, never manufactured.
import {strict as assert} from 'node:assert';
import {createHash, X509Certificate} from 'node:crypto';
import {existsSync, lstatSync, openSync, closeSync, fstatSync, readFileSync, readSync, readdirSync, unlinkSync, writeFileSync} from 'node:fs';
import {constants} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {posix} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {materializeStaticProductMaterial, releaseStaticProductMaterial} from '../material-init.mjs';
import {compileProductMaterialPlan, verifyProductMaterial} from '../material-init-plan.mjs';
import {verifyControlCaBundle} from '../control-ca-bundle.mjs';
import {materialInitEnvironment} from '../material-init-cli.mjs';
import {validateConfiguration} from '../config.mjs';
import {imageProbeControlFixture} from './material-init-probe-fixture.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';

const root = '/run/meri';
const preserved = ['upload-definitions', 'upload-scratch'];
const roles = ['control', 'temporal-worker', 'schedule-worker'];
const runtimeUser = '1000:1000';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const certPattern = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----\n/u;

/** Exact image-owned layout: real directories, uid/gid 1000, mode 0700, empty, no symlink. Identities are returned. */
export function observeImageLayout(dir = root) {
  const rootStat = lstatSync(dir);
  assert.equal(rootStat.isDirectory(), true);
  assert.equal(rootStat.isSymbolicLink(), false);
  assert.equal(rootStat.uid, 1000);
  assert.equal(rootStat.gid, 1000);
  assert.equal(rootStat.mode & 0o7777, 0o700);
  assert.deepEqual(readdirSync(dir).sort(), preserved);
  const identity = (st, fd) => ({dev: st.dev, ino: st.ino, uid: st.uid, gid: st.gid, mode: st.mode & 0o7777});
  const rootFd = openSync(dir, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0));
  let rootIdentity;
  try { rootIdentity = identity(fstatSync(rootFd)); } finally { closeSync(rootFd); }
  const dirs = new Map();
  for (const name of preserved) {
    const path = posix.join(dir, name);
    const st = lstatSync(path);
    assert.equal(st.isDirectory(), true);
    assert.equal(st.isSymbolicLink(), false);
    assert.equal(st.uid, 1000);
    assert.equal(st.gid, 1000);
    assert.equal(st.mode & 0o7777, 0o700);
    assert.deepEqual(readdirSync(path), []);
    // No-follow directory handle: identity comes from the opened object, not a following stat.
    const fd = openSync(path, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0));
    try {
      const fst = fstatSync(fd);
      assert.equal(fst.dev, st.dev);
      assert.equal(fst.ino, st.ino);
      dirs.set(name, identity(fst));
    } finally { closeSync(fd); }
  }
  return {root: rootIdentity, dirs};
}

/** Identities must be the same objects and still empty at every later phase. */
export function expectedEntries(phase, plan, marker = 'owned-probe-marker') {
  const names = new Set(preserved);
  if (phase === 'marker') names.add(marker);
  if (phase === 'materialized') for (const file of plan.requiredFiles) names.add(posix.basename(file.path));
  if (!['preserved', 'marker', 'materialized'].includes(phase)) throw new Error('unknown phase');
  return [...names].sort();
}

export function assertLayoutHeld(layout, entries, dir = root) {
  const rootFd = openSync(dir, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0));
  let rootStat;
  try { rootStat = fstatSync(rootFd); } finally { closeSync(rootFd); }
  assert.equal(rootStat.dev, layout.root.dev);
  assert.equal(rootStat.ino, layout.root.ino);
  assert.equal(rootStat.uid, layout.root.uid);
  assert.equal(rootStat.gid, layout.root.gid);
  assert.equal(rootStat.mode & 0o7777, layout.root.mode);
  assert.deepEqual(readdirSync(dir).sort(), entries.slice().sort());
  for (const name of preserved) {
    const path = posix.join(dir, name);
    const st = lstatSync(path);
    const saved = layout.dirs.get(name);
    assert.ok(saved, 'layout identity missing');
    assert.equal(st.isDirectory(), true);
    assert.equal(st.isSymbolicLink(), false);
    assert.equal(st.dev, saved.dev);
    assert.equal(st.ino, saved.ino);
    assert.equal(st.uid, saved.uid);
    assert.equal(st.gid, saved.gid);
    assert.equal(st.mode & 0o7777, saved.mode);
    assert.deepEqual(readdirSync(path), []);
  }
}

export function publicAnchor() {
  const pem = readFileSync(fileURLToPath(new URL('../certs/rds-global-bundle.pem', import.meta.url)), 'utf8');
  const match = pem.match(certPattern);
  assert.ok(match, 'public certificate anchor missing');
  const bytes = Buffer.from(match[0]);
  const cert = new X509Certificate(bytes);
  return {bytes, pin: hash(cert.raw)};
}

/** Closed role configuration grounded in the packaged pure AgentCore fixture and the canonical validators. */
export function roleConfiguration(role, anchorPin) {
  const base = imageProbeControlFixture().configuration;
  base.native = Object.assign({}, base.native, {capabilityFile: root + '/capability.json'});
  base.database = {connectionFile: root + '/database-url'};
  base.temporal = Object.assign({}, base.temporal, {
    tls: {caFile: root + '/temporal-ca.pem', certFile: root + '/temporal-cert.pem', keyFile: root + '/temporal-key.pem'}});
  if (role === 'control') {
    base.native.serverCaFile = root + '/control-ca.pem';
    base.native.serverCaSha256 = anchorPin;
    return base;
  }
  if (role === 'temporal-worker') {
    const worker = Object.assign({}, base);
    delete worker.database; delete worker.sessions; delete worker.versions; delete worker.agentcore;
    delete worker.privateHttp; delete worker.models;
    worker.native = Object.assign({}, worker.native, {preparedKickoff: true});
    worker.http = Object.assign({}, worker.http, {port: 8081});
    return worker;
  }
  const schedule = {};
  for (const key of ['version', 'profile', 'limits', 'http', 'temporal', 'versions', 'database', 'native', 'scheduledDispatch']) {
    if (base[key] !== undefined) schedule[key] = structuredClone(base[key]);
  }
  schedule.sourceEnabled = false;
  schedule.http = Object.assign({}, schedule.http, {port: 8083});
  schedule.temporal = Object.assign({}, schedule.temporal, {taskQueue: 'synthetic-schedule'});
  schedule.scheduledDispatch = {enabled: true, conversationTaskQueue: 'synthetic-schedule-conversations',
    maxConcurrentActivities: 1};
  schedule.native = Object.assign({}, schedule.native, {serverCaFile: root + '/control-ca.pem', serverCaSha256: anchorPin});
  return schedule;
}

/** Canonical plan + independent pins for one role, with the public anchor bound before serialization. */
export function roleFixture(role) {
  const anchor = role === 'temporal-worker' ? null : publicAnchor();
  const configuration = validateConfiguration(roleConfiguration(role, anchor ? anchor.pin : undefined), role);
  const plan = compileProductMaterialPlan({role, configuration, runtimeUser});
  const files = plan.requiredFiles.map(file => ({path: file.path,
    base64: Buffer.from(file.path === plan.configurationPath ? JSON.stringify(configuration)
      : 'synthetic-static-material:' + file.path).toString('base64')}));
  if (anchor) {
    const entry = files.find(file => file.path === root + '/control-ca.pem');
    assert.ok(entry, 'anchor file is not in the canonical inventory');
    entry.base64 = anchor.bytes.toString('base64');
  }
  const contract = {schemaVersion: 1, role, runtimeUser, sourceCommit: '1'.repeat(40),
    imageDigest: 'sha256:' + '2'.repeat(64),
    sha256ByPath: Object.fromEntries(files.map(file => [file.path, hash(Buffer.from(file.base64, 'base64'))]))};
  return {plan, configuration, bundle: {files},
    expected: Object.assign({}, contract, {materialContractSha256: canonicalSha256(contract)})};
}

export function validateReady(receipt, plan, role) {
  return Boolean(receipt && receipt.ready === true && receipt.role === role &&
    receipt.fileCount === plan.requiredFiles.length);
}

export async function runProbe(role) {
  const facts = {schema: 'meri28-init-copyup-probe-v2', role, imageOwnedLayout: false, layoutPreserved: false,
    guardRefusedForeign: false, foreignMarkerPreserved: false, markerRemoved: false, directInit: false,
    directVerifier: false, directRelease: false, directCleanup: false, caRefusedBeforeMaterial: false,
    cliExit0: false, cliReady: false, cliVerifier: false, caVerifiedAfter: false, temporalNoCa: false};
  const emit = (code) => {
    process.stdout.write(JSON.stringify(Object.assign({}, facts, code ? {failure: code} : {})) + '\n');
    process.exit(code ? 1 : 0);
  };
  assert.ok(roles.includes(role), 'unknown role');
  assert.equal(process.platform, 'linux', 'linux required');
  assert.equal(process.arch, 'arm64', 'arm64 required');
  assert.equal(process.getuid?.(), 1000, 'uid 1000 required');
  assert.equal(process.getgid?.(), 1000, 'gid 1000 required');
  const identities = observeImageLayout();
  facts.imageOwnedLayout = true;
  // Actual root filesystem must be read-only, not merely launched with a flag.
  const mountInfo = readFileSync('/proc/self/mountinfo', 'utf8');
  const rootMount = mountInfo.split('\n').find(line => line.split(' ')[4] === '/');
  assert.ok(rootMount && /(^| )ro(,| )/.test(rootMount.split(' - ')[0]), 'root filesystem is not read-only');
  facts.rootReadOnly = true;

  const fixture = roleFixture(role);

  // The composite CA cannot be verified before materialization has produced its configuration.
  if (role !== 'temporal-worker') {
    let refused = null, refusedPath = false;
    try {
      await verifyControlCaBundle(fixture.configuration,
        {environment: {NODE_EXTRA_CA_CERTS: '/tmp/meri-control-ca/ca-bundle.pem'}});
    } catch (error) { refused = error.code; refusedPath = error.path === '/tmp/meri-control-ca'; }
    assert.equal(refused, 'ENOENT');
    assert.equal(refusedPath, true);
    if (existsSync('/tmp/meri-control-ca') || existsSync(fixture.plan.configurationPath)) emit('CA_BEFORE_MATERIAL');
    facts.caRefusedBeforeMaterial = true;
  }

  // Foreign marker: exclusive create, identity from the created handle, exact refusal, owned removal only.
  const marker = root + '/owned-probe-marker';
  const markerBytes = 'owned-probe-marker';
  try {
    const fd = openSync(marker, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    let created;
    try {
      created = fstatSync(fd);
      writeFileSync(fd, markerBytes);
    } finally { closeSync(fd); }
    assert.equal(created.isFile(), true);
    assert.equal(created.uid, 1000);
    assert.equal(created.gid, 1000);
    assert.equal(created.mode & 0o7777, 0o600);
    let refusal = null;
    try {
      await materializeStaticProductMaterial({expected: fixture.expected,
        delivery: {async fetch() { return fixture.bundle; }}});
    } catch (error) { refusal = error.code; }
    assert.equal(refusal, 'STATIC_INIT_DIRECTORY_NOT_EMPTY');
    const verifyFd = openSync(marker, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let now, content;
    try {
      now = fstatSync(verifyFd);
      const buffer = Buffer.alloc(markerBytes.length + 1);
      const read = readSync(verifyFd, buffer, 0, buffer.length, 0);
      content = buffer.subarray(0, read).toString('utf8');
      assert.equal(now.size, markerBytes.length);
      assert.equal(read, markerBytes.length);
    } finally { closeSync(verifyFd); }
    assert.equal(now.dev, created.dev);
    assert.equal(now.ino, created.ino);
    assert.equal(now.uid, created.uid);
    assert.equal(now.gid, created.gid);
    assert.equal(now.mode & 0o7777, 0o600);
    assert.equal(content, markerBytes);
    assertLayoutHeld(identities, expectedEntries('marker', fixture.plan));
    facts.guardRefusedForeign = true;
    facts.foreignMarkerPreserved = true;
    const again = lstatSync(marker);
    assert.equal(again.dev, created.dev);
    assert.equal(again.ino, created.ino);
    unlinkSync(marker);
    assertLayoutHeld(identities, expectedEntries('preserved', fixture.plan));
    facts.markerRemoved = true;
    assert.equal(existsSync(marker), false);
  } catch { emit('FOREIGN_GUARD'); }

  // Real initializer, full verifier, real same-process receipt release.
  try {
    const direct = await materializeStaticProductMaterial({expected: fixture.expected,
      delivery: {async fetch() { return fixture.bundle; }}});
    await verifyProductMaterial(fixture.plan, {expectedSha256ByPath: fixture.expected.sha256ByPath});
    facts.directInit = true;
    facts.directVerifier = true;
    const released = await releaseStaticProductMaterial(direct.receipt);
    assert.equal(released.removed, fixture.bundle.files.length);
    assertLayoutHeld(identities, expectedEntries('preserved', fixture.plan));
    facts.directRelease = true;
    facts.directCleanup = true;
    facts.layoutPreserved = true;
  } catch { emit('DIRECT_INIT'); }

  // Actual packaged CLI: synthetic material only, exact ready receipt, then its own material and CA output.
  const environment = {PATH: '/usr/bin:/bin',
    [materialInitEnvironment.expected]: JSON.stringify(fixture.expected),
    [materialInitEnvironment.bundle]: JSON.stringify(fixture.bundle)};
  const cliArgs = ['apps/runtime/material-init-cli.mjs', 'write'];
  if (role !== 'temporal-worker') cliArgs.push('--control-node-ca');
  const child = spawnSync(process.execPath, cliArgs, {env: environment, encoding: 'utf8', timeout: 120000});
  facts.cliExit0 = child.status === 0;
  try {
    const ready = JSON.parse(child.stdout);
    facts.cliReady = validateReady(ready, fixture.plan, role);
  } catch { facts.cliReady = false; }
  if (!facts.cliExit0 || !facts.cliReady) emit('CLI_READY');
  try {
    await verifyProductMaterial(fixture.plan, {expectedSha256ByPath: fixture.expected.sha256ByPath});
    facts.cliVerifier = true;
  } catch { emit('CLI_VERIFIER'); }

  if (role === 'temporal-worker') {
    facts.temporalNoCa = !existsSync('/tmp/meri-control-ca');
    if (!facts.temporalNoCa) emit('TEMPORAL_CA');
  } else {
    try {
      await verifyControlCaBundle(fixture.configuration,
        {environment: {NODE_EXTRA_CA_CERTS: '/tmp/meri-control-ca/ca-bundle.pem'}});
      facts.caVerifiedAfter = true;
    } catch { emit('CA_VERIFY'); }
  }
  assertLayoutHeld(identities, expectedEntries('materialized', fixture.plan));
  facts.layoutPreserved = true;
  emit(null);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await runProbe(process.argv[2]);
