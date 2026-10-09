// W02-03 canonical OFFLINE compatibility tests (`npm test` / `npm run check`).
//
// Deterministic and hermetic: no Temporal server, database, Fargate task,
// Docker, model provider, browser or Office execution. The tests exercise real
// boundaries only: exact package/lock/pin alignment, the exact installed
// 1.24.0 type declarations, the inert source fixtures, the five-role
// deployment boundary rules, and a real compiler diagnostic check.
//
// The two `tsc` invocations below compile the pinned local compiler against the
// fixture files. They use no network and no server.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const PKG = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(PKG, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

const TSC = join(PKG, 'node_modules', 'typescript', 'bin', 'tsc');

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const pins = readJson('component-pins.json');
const fixture = readJson('deployment.fixture.json');

const DIRECT_TEMPORAL = ['@temporalio/activity', '@temporalio/client', '@temporalio/common', '@temporalio/worker', '@temporalio/workflow'];
const SDK_VERSION = '1.24.0';

// ---------------------------------------------------------------------------
// Exact package / lock / pin alignment
// ---------------------------------------------------------------------------

test('package.json pins the five exact @temporalio 1.24.0 packages and the exact compiler/types', () => {
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.dependencies, {
    '@temporalio/activity': '1.24.0',
    '@temporalio/client': '1.24.0',
    '@temporalio/common': '1.24.0',
    '@temporalio/worker': '1.24.0',
    '@temporalio/workflow': '1.24.0',
  });
  assert.deepEqual(pkg.devDependencies, { '@types/node': '24.19.2', typescript: '5.9.3' });
});

test('package-lock.json locks the same exact versions with sha512 integrity', () => {
  for (const [name, version] of [...Object.entries(pkg.dependencies), ...Object.entries(pkg.devDependencies)]) {
    const entry = lock.packages[`node_modules/${name}`];
    assert.ok(entry, `lock missing ${name}`);
    assert.equal(entry.version, version, `${name} lock version`);
    assert.match(entry.integrity || '', /^sha512-/, `${name} integrity`);
  }
});

test('component-pins.json agrees with package.json, lock and the recorded server pins', () => {
  assert.equal(pins.status, 'preparation-only');
  assert.equal(pins.server.version, '1.32.1');
  assert.equal(pins.server.sourceCommit, 'af08a5e5f2dd40f545f2afac7780daaa6987001e');
  assert.match(pins.server.imageIndexDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(pins.server.imageAmd64Digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(pins.adminTools.cliVersion, '1.9.1');
  assert.equal(pins.typescriptSdk.version, SDK_VERSION);
  assert.equal(pins.typescriptSdk.sourceCommit, '1fd1c81a0383f5f5c7923dd735472c7d1ffdc867');
  assert.equal(pins.compiler.version, pkg.devDependencies.typescript);
  assert.equal(pins.typesNode.version, pkg.devDependencies['@types/node']);
  const byName = Object.fromEntries(pins.typescriptSdk.participatingPackages.map((p) => [p.name, p]));
  for (const name of DIRECT_TEMPORAL) {
    assert.equal(byName[name].version, pkg.dependencies[name], `${name} pin version`);
    assert.equal(byName[name].integrity, lock.packages[`node_modules/${name}`].integrity, `${name} integrity matches lock`);
    assert.ok(byName[name].license, `${name} license recorded`);
  }
  assert.equal(pins.compiler.integrity, lock.packages['node_modules/typescript'].integrity);
  assert.equal(pins.typesNode.integrity, lock.packages['node_modules/@types/node'].integrity);
});

test('component-pins.json records the PostgreSQL schema/store candidates', () => {
  assert.equal(pins.postgres.plugin, 'postgres12');
  assert.equal(pins.postgres.majorVersion, 16);
  assert.equal(pins.postgres.candidateMinorVersion, '16.15');
  assert.equal(pins.postgres.schemaPrimaryVersion, '1.19');
  assert.equal(pins.postgres.schemaVisibilityVersion, '1.14');
});

// ---------------------------------------------------------------------------
// Exact installed 1.24.0 type declarations (not hypothetical APIs)
// ---------------------------------------------------------------------------

test('installed WorkerDeploymentOptions requires defaultVersioningBehavior when versioning is on', () => {
  const dts = read('node_modules/@temporalio/worker/lib/worker-options.d.ts');
  assert.match(dts, /export type WorkerDeploymentOptions = \{/);
  assert.match(dts, /workerDeploymentOptions\?: WorkerDeploymentOptions;/);
  assert.match(dts, /useWorkerVersioning: true;\s*\n\s*defaultVersioningBehavior: VersioningBehavior;/);
  assert.match(dts, /useWorkerVersioning: false;\s*\n\s*defaultVersioningBehavior\?: never;/);
});

test('installed TLSConfig / connection options expose the exact TLS + JWT fields', () => {
  const tls = read('node_modules/@temporalio/common/lib/internal-non-workflow/tls-config.d.ts');
  assert.match(tls, /export interface TLSConfig \{/);
  assert.match(tls, /serverNameOverride\?: string;/);
  assert.match(tls, /serverRootCACertificate\?: Uint8Array;/);
  assert.match(tls, /clientCertPair\?: \{[\s\S]*?crt: Uint8Array;[\s\S]*?key: Uint8Array;/);

  const clientConn = read('node_modules/@temporalio/client/lib/connection.d.ts');
  assert.match(clientConn, /export interface ConnectionOptions \{/);
  assert.match(clientConn, /tls\?: TLSConfig \| boolean \| null;/);
  assert.match(clientConn, /apiKey\?: string \| \(\(\) => string\);/);

  const workerConn = read('node_modules/@temporalio/worker/lib/connection-options.d.ts');
  assert.match(workerConn, /export interface NativeConnectionOptions \{/);
  assert.match(workerConn, /apiKey\?: string;/);
  assert.match(workerConn, /tls\?: TLSConfig \| boolean \| null;/);
});

test('installed VersioningBehavior / WorkerDeploymentVersion have the exact members', () => {
  const dts = read('node_modules/@temporalio/common/lib/worker-deployments.d.ts');
  assert.match(dts, /readonly PINNED: "PINNED";/);
  assert.match(dts, /readonly AUTO_UPGRADE: "AUTO_UPGRADE";/);
  assert.match(dts, /export interface WorkerDeploymentVersion \{[\s\S]*?readonly buildId: string;[\s\S]*?readonly deploymentName: string;/);
});

test('installed workflow API exposes the deterministic constructs the fixture uses', () => {
  const workflow = read('node_modules/@temporalio/workflow/lib/workflow.d.ts');
  for (const fn of ['proxyActivities', 'defineSignal', 'defineQuery', 'setHandler', 'sleep', 'condition', 'continueAsNew']) {
    assert.match(workflow, new RegExp(`export declare function ${fn}`), `${fn} declared`);
  }
  assert.match(read('node_modules/@temporalio/workflow/lib/errors.d.ts'), /export declare function isCancellation\(err: unknown\): boolean;/);
  assert.match(read('node_modules/@temporalio/workflow/lib/cancellation-scope.d.ts'), /class CancellationScope/);
});

// ---------------------------------------------------------------------------
// Inert source fixtures reference the real symbols and stay deterministic
// ---------------------------------------------------------------------------

test('client-options.ts uses real client/worker option types and TLS material', () => {
  const src = read('client-options.ts');
  assert.match(src, /from '@temporalio\/client'/);
  assert.match(src, /from '@temporalio\/worker'/);
  assert.match(src, /ConnectionOptions/);
  assert.match(src, /NativeConnectionOptions/);
  assert.match(src, /TLSConfig/);
  assert.match(src, /apiKey/);
  assert.match(src, /clientCertPair/);
  assert.match(src, /serverRootCACertificate/);
  assert.match(src, /serverNameOverride/);
  for (const fn of ['buildTlsConfig', 'buildExternalConnectionOptions', 'buildClientOptions', 'buildInternodeNativeConnectionOptions']) {
    assert.match(src, new RegExp(`export function ${fn}`), `${fn} exported`);
  }
  assert.doesNotMatch(src, /Connection\.connect|new Client|Worker\.create|NativeConnection\.connect/, 'must stay inert');
});

test('workflow.ts declares activity/signal/query/timer/cancellation/continue-as-new and no nondeterminism', () => {
  const src = read('workflow.ts');
  assert.match(src, /from '@temporalio\/workflow'/);
  for (const sym of ['proxyActivities', 'defineSignal', 'defineQuery', 'setHandler', 'sleep', 'condition', 'continueAsNew', 'CancellationScope', 'isCancellation']) {
    assert.match(src, new RegExp(sym), `${sym} referenced`);
  }
  assert.match(src, /CONTINUE_AS_NEW_AFTER_STAGES/);
  // Determinism: no wall-clock, randomness, ambient env or direct timers.
  assert.doesNotMatch(src, /Date\.now|new Date\(|Math\.random|process\.env|setTimeout|setInterval/, 'workflow must stay deterministic');
});

test('activities.ts uses the real activity context and stays inert', () => {
  const src = read('activities.ts');
  assert.match(src, /from '@temporalio\/activity'/);
  assert.match(src, /Context\.current\(\)/);
  for (const fn of ['recordCheckpoint', 'publishArtifact', 'collectApproval']) {
    assert.match(src, new RegExp(`export async function ${fn}`), `${fn} exported`);
  }
  assert.doesNotMatch(src, /fetch\(|child_process|require\(/, 'activities must not perform I/O in this fixture');
});

test('negative-types.ts carries @ts-expect-error fixtures and positive controls', () => {
  const src = read('negative-types.ts');
  const directives = src.match(/@ts-expect-error/g) || [];
  assert.ok(directives.length >= 10, `expected >=10 @ts-expect-error directives, found ${directives.length}`);
  assert.match(src, /goodWorkerDeploymentOptions/);
  assert.match(src, /defaultVersioningBehavior: VersioningBehavior\.PINNED/);
  assert.match(src, /buildId: 'w02-03-fixture'/);
});

// ---------------------------------------------------------------------------
// Five-role deployment boundary rules
// ---------------------------------------------------------------------------

const FIVE_ROLES = ['frontend', 'history', 'matching', 'internal-worker', 'internal-frontend'];
const PACKAGES = ['client', 'worker', 'workflow', 'activity', 'common'];
const ALLOWED_INGRESS = ['external', 'internode', 'internal-rpc'];

function validateDeployment(cfg) {
  const reasons = [];
  const add = (rule, message) => reasons.push({ rule, message });

  const roleNames = Object.keys(cfg.roles || {});
  const expected = [...FIVE_ROLES].sort().join(',');
  if ([...roleNames].sort().join(',') !== expected) add('R1', `roles must be exactly ${FIVE_ROLES.join(', ')}`);

  if (!Number.isInteger(cfg.historyShards) || cfg.historyShards <= 0) add('R8', 'historyShards must be a positive integer');

  const db = cfg.database || {};
  if (db.tlsHostnameVerification !== true) add('R9', 'database.tlsHostnameVerification must be true');
  if (db.separateRoles !== true) add('R9', 'database.separateRoles must be true');
  if (db.distinctMigrationIdentity !== true) add('R9', 'database.distinctMigrationIdentity must be true');
  if (db.schemaPrimaryVersion !== '1.19') add('R2', 'database.schemaPrimaryVersion must be 1.19');
  if (db.schemaVisibilityVersion !== '1.14') add('R2', 'database.schemaVisibilityVersion must be 1.14');

  for (const name of FIVE_ROLES) {
    const r = (cfg.roles || {})[name];
    if (!r) continue;
    if (!r.tls || r.tls.enabled !== true || r.tls.hostnameVerification !== true) add('R2', `${name}: TLS with hostname verification required`);
    if (!r.mtls || r.mtls.enabled !== true) add('R10', `${name}: internode mTLS required`);
    if (r.serverVersion !== '1.32.1') add('R2', `${name}: serverVersion must be 1.32.1`);
    for (const p of PACKAGES) {
      if (!r.packageSet || r.packageSet[p] !== SDK_VERSION) add('R2', `${name}: packageSet.${p} must be ${SDK_VERSION}`);
    }
    if (typeof r.ingress !== 'string' || !ALLOWED_INGRESS.includes(r.ingress)) add('R5', `${name}: ingress must be one of ${ALLOWED_INGRESS.join(',')}`);
    if (r.acceptsConversationIngress !== false) add('R5', `${name}: must not accept conversation/application ingress`);
  }

  const fe = (cfg.roles || {}).frontend;
  if (fe) {
    if (fe.ingress !== 'external') add('R3', 'frontend ingress must be external');
    if (typeof fe.externalAudience !== 'string' || fe.externalAudience.trim() === '') add('R3', 'frontend externalAudience must be nonempty');
    if (typeof fe.jwksUrl !== 'string' || !/^https:\/\/.+/.test(fe.jwksUrl)) add('R3', 'frontend jwksUrl must be a dedicated HTTPS URL');
    if (!Number.isFinite(fe.keyRefreshSeconds) || fe.keyRefreshSeconds <= 0) add('R3', 'frontend keyRefreshSeconds must be > 0');
    if (fe.claimMapper !== 'default') add('R3', 'frontend claimMapper must be default');
  }

  const ife = (cfg.roles || {})['internal-frontend'];
  if (ife) {
    if (ife.ingress !== 'internode') add('R4', 'internal-frontend ingress must be internode-only');
    if (ife.externalAudience !== undefined) add('R4', 'internal-frontend must not declare an external audience');
    if (ife.claimMapper !== 'internal') add('R4', 'internal-frontend must use the internal claim mapper');
    if (ife.acceptsConversationIngress !== false) add('R4', 'internal-frontend must never accept application/conversation ingress');
  }

  const w = cfg.trustedApplicationWorkers || {};
  if (!['worker', 'write'].includes(w.namespaceRole)) add('R6', 'trusted app worker namespace role must be worker or write');
  if (w.defaultAuthorizerAllowed === true) add('R6', 'RoleWorker1 cannot poll/complete/heartbeat with the default authorizer');

  const ex = cfg.conversationExecutors || {};
  if (ex.temporalIngress !== false) add('R7', 'conversation/browser/artifact executors must not poll Temporal directly');

  return { ok: reasons.length === 0, reasons };
}

function deepMerge(base, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], v);
    } else {
      base[k] = v;
    }
  }
  return base;
}

test('the base five-role fixture is well-formed and validates cleanly', () => {
  const result = validateDeployment(structuredClone(fixture));
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(fixture.historyShards, 128);
  assert.equal(Object.keys(fixture.roles).length, 5);
  assert.equal(fixture.trustedApplicationWorkers.replicas, 2);
  assert.equal(fixture.conversationExecutors.temporalIngress, false);
});

test('every prohibited boundary case is rejected with its expected rule', () => {
  assert.ok(fixture.prohibitedCases.length >= 15, 'need meaningful boundary coverage');
  for (const c of fixture.prohibitedCases) {
    const cfg = structuredClone(fixture);
    delete cfg.prohibitedCases;
    if (c.removeRole) delete cfg.roles[c.removeRole];
    if (c.patch) deepMerge(cfg, structuredClone(c.patch));
    const result = validateDeployment(cfg);
    assert.equal(result.ok, false, `${c.id} should be rejected`);
    assert.ok(result.reasons.some((r) => r.rule === c.rule), `${c.id} should report ${c.rule}, got ${JSON.stringify(result.reasons.map((r) => r.rule))}`);
  }
});

// ---------------------------------------------------------------------------
// Real compiler checks (local, offline)
// ---------------------------------------------------------------------------

test('the fixture typechecks cleanly with the pinned compiler (all negative directives used)', () => {
  const res = spawnSync(process.execPath, [TSC, '--noEmit', '-p', join(PKG, 'tsconfig.json')], { cwd: PKG, encoding: 'utf8' });
  assert.equal(res.status, 0, `${res.stdout || ''}${res.stderr || ''}`);
});

test('expected-diagnostic: a missing defaultVersioningBehavior fails, a correct one compiles', () => {
  assert.ok(existsSync(TSC), 'pinned typescript compiler installed');
  const runtime = join(PKG, '.runtime');
  mkdirSync(runtime, { recursive: true });
  const compile = (file) =>
    spawnSync(
      process.execPath,
      [TSC, '--noEmit', '--strict', '--skipLibCheck', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022', file],
      { cwd: PKG, encoding: 'utf8' },
    );

  const badFile = join(runtime, 'expect-fail.ts');
  writeFileSync(
    badFile,
    [
      "import type { WorkerDeploymentOptions } from '@temporalio/worker';",
      'const opts: WorkerDeploymentOptions = {',
      "  version: { deploymentName: 'meri-orchestration', buildId: 'x' },",
      '  useWorkerVersioning: true,',
      '};',
      'void opts;',
      '',
    ].join('\n'),
  );
  const bad = compile(badFile);
  assert.notEqual(bad.status, 0, 'compiler must reject a deployment without defaultVersioningBehavior');
  assert.match(`${bad.stdout || ''}${bad.stderr || ''}`, /TS2322|defaultVersioningBehavior/);
  rmSync(badFile, { force: true });

  const goodFile = join(runtime, 'expect-pass.ts');
  writeFileSync(
    goodFile,
    [
      "import type { WorkerDeploymentOptions } from '@temporalio/worker';",
      "import { VersioningBehavior } from '@temporalio/common';",
      'const opts: WorkerDeploymentOptions = {',
      "  version: { deploymentName: 'meri-orchestration', buildId: 'x' },",
      '  useWorkerVersioning: true,',
      '  defaultVersioningBehavior: VersioningBehavior.PINNED,',
      '};',
      'void opts;',
      '',
    ].join('\n'),
  );
  const good = compile(goodFile);
  assert.equal(good.status, 0, `${good.stdout || ''}${good.stderr || ''}`);
  rmSync(goodFile, { force: true });
});
