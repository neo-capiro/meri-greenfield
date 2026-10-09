// W02-03 canonical OFFLINE compatibility tests (`npm test` / `npm run check`).
//
// Deterministic and hermetic: no Temporal server, database, Fargate task,
// Docker, model provider, browser or Office execution. The tests exercise real
// boundaries only: exact package/lock/pin alignment, the exact installed
// 1.24.0 type declarations, the inert source fixtures, the five-role deployment
// boundary rules (including the previously-accepted false positives), a real
// compiler diagnostic check, and the actual workflow's JavaScript control flow
// with deterministic SDK/activity stubs. Those probes do not initialize any
// real Temporal module or establish runtime, native-core or server compatibility.
//
// The `tsc` invocations below compile the pinned local compiler. They use no
// network and no server.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

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
const SERVER_VERSION = '1.32.1';

// ---------------------------------------------------------------------------
// Exact package / lock / pin alignment (exact values, not loose regexes)
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

test('component-pins.json records the exact server pins (exact equality, not regex)', () => {
  assert.equal(pins.status, 'preparation-only');
  assert.equal(pins.server.version, SERVER_VERSION);
  assert.equal(pins.server.sourceCommit, 'af08a5e5f2dd40f545f2afac7780daaa6987001e');
  assert.equal(pins.server.imageIndexDigest, 'sha256:acecbab5b0b8ae9cf4012b508866ca97feda3709577bf157b537239f40029049');
  assert.equal(pins.server.imageAmd64Digest, 'sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e');
  assert.equal(pins.server.configDigest, 'sha256:40cc19cacb6acbac3eaec7ea623b3d0f53448f387ea05d8fac8f596e23307b10');
  assert.equal(pins.adminTools.imageIndexDigest, 'sha256:9ef0dc5b063bf4ffd5c1512de72e0e73e225bd2c7006a18ce69bd592a8862a83');
  assert.equal(pins.adminTools.imageAmd64Digest, 'sha256:4fdaf9122f8beb448c823976232f6616a8cd94687f6984eeaf25c2b1457d5fed');
  assert.equal(pins.adminTools.cliVersion, '1.9.1');
  assert.equal(pins.typescriptSdk.version, SDK_VERSION);
  assert.equal(pins.typescriptSdk.sourceCommit, '1fd1c81a0383f5f5c7923dd735472c7d1ffdc867');
});

test('component-pins.json agrees with package.json, lock and the postgres candidates', () => {
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
  assert.equal(pins.postgres.plugin, 'postgres12');
  assert.equal(pins.postgres.majorVersion, 16);
  assert.equal(pins.postgres.candidateMinorVersion, '16.15');
  assert.equal(pins.postgres.schemaPrimaryVersion, '1.19');
  assert.equal(pins.postgres.schemaVisibilityVersion, '1.14');
});

test('the fixture server block is byte-identical to the pinned component digests', () => {
  for (const key of ['version', 'sourceCommit', 'imageIndexDigest', 'imageAmd64Digest', 'configDigest']) {
    assert.equal(fixture.server[key], pins.server[key], `fixture.server.${key} must equal pins.server.${key}`);
  }
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

test('client-options.ts uses real client/worker option types and a TS application-worker builder', () => {
  const src = read('client-options.ts');
  assert.match(src, /from '@temporalio\/client'/);
  assert.match(src, /from '@temporalio\/worker'/);
  assert.match(src, /TLSConfig/);
  assert.match(src, /clientCertPair/);
  assert.match(src, /serverRootCACertificate/);
  assert.match(src, /serverNameOverride/);
  for (const fn of ['buildTlsConfig', 'buildExternalConnectionOptions', 'buildClientOptions', 'buildApplicationWorkerConnectionOptions', 'buildInternodeNativeConnectionOptions']) {
    assert.match(src, new RegExp(`export function ${fn}`), `${fn} exported`);
  }
  // The TS application-worker builder carries TLS AND the short-lived bearer.
  const appWorker = src.slice(src.indexOf('buildApplicationWorkerConnectionOptions'), src.indexOf('buildInternodeNativeConnectionOptions'));
  assert.match(appWorker, /NativeConnectionOptions/);
  assert.match(appWorker, /tls: buildTlsConfig/, 'app-worker builder must set TLS');
  assert.match(appWorker, /apiKey: inputs\.jwt/, 'app-worker builder must set the bearer apiKey');
  // The internode builder is explicitly server-only, not app-worker auth.
  const internodeDoc = src.slice(0, src.indexOf('buildInternodeNativeConnectionOptions'));
  assert.match(internodeDoc, /SERVER \/ INTERNODE route only/);
  assert.match(internodeDoc, /NOT the authentication used by SDK application workers/);
  assert.doesNotMatch(src, /Connection\.connect|new Client|Worker\.create|NativeConnection\.connect/, 'must stay inert');
});

test('workflow.ts has a finite three-stage loop, bounded continuation, and cancel observation', () => {
  const src = read('workflow.ts');
  for (const sym of ['proxyActivities', 'defineSignal', 'defineQuery', 'setHandler', 'sleep', 'condition', 'continueAsNew', 'CancellationScope', 'isCancellation', 'ApplicationFailure']) {
    assert.match(src, new RegExp(sym), `${sym} referenced`);
  }
  assert.match(src, /export function planContinuation/);
  assert.match(src, /export const STAGES = 3;/);
  assert.match(src, /for \(let stage = 1; stage <= STAGES; stage \+= 1\)/);
  assert.match(src, /state\.checkpoints \+= 1;/);
  assert.match(src, /continueAsNew<typeof meriOrchestrationWorkflow>/);
  assert.match(src, /continuation: plan\.nextContinuation/);
  // Cancellation behavior is checked below by running this source with stubs;
  // counting references cannot establish that the final await boundaries work.
  // Signals never grant approval: the note signal only records; approval is authoritative.
  assert.match(src, /noteSignal/);
  assert.doesNotMatch(src, /approvalSignal/);
  assert.match(src, /decision !== 'approved'/);
  assert.doesNotMatch(src, /Date\.now|new Date\(|Math\.random|process\.env|setTimeout|setInterval/, 'workflow must stay deterministic');
});

test('activities.ts uses the real activity context and stays inert', () => {
  const src = read('activities.ts');
  assert.match(src, /from '@temporalio\/activity'/);
  assert.match(src, /Context\.current\(\)/);
  for (const fn of ['recordCheckpoint', 'publishArtifact', 'collectApproval']) {
    assert.match(src, new RegExp(`export async function ${fn}`), `${fn} exported`);
  }
  assert.doesNotMatch(src, /fetch\(|child_process|require\(/);
});

test('negative-types.ts carries the required negative fixtures and positive controls', () => {
  const src = read('negative-types.ts');
  const directives = src.match(/@ts-expect-error/g) || [];
  assert.ok(directives.length >= 15, `expected >=15 @ts-expect-error directives, found ${directives.length}`);
  for (const needed of ['badDeploymentMissingBehavior', 'badUseVersioningType', 'badNativeTlsType', 'badNativeApiKeyType', 'badAppWorkerAudienceType']) {
    assert.match(src, new RegExp(needed), `${needed} present`);
  }
  assert.match(src, /goodAppWorkerOptions/);
  assert.match(src, /goodWorkerDeploymentOptions/);
  assert.match(src, /defaultVersioningBehavior: VersioningBehavior\.PINNED/);
});

// ---------------------------------------------------------------------------
// Five-role deployment boundary rules
// ---------------------------------------------------------------------------

const FIVE_ROLES = ['frontend', 'history', 'matching', 'internal-worker', 'internal-frontend'];
const PACKAGES = ['client', 'worker', 'workflow', 'activity', 'common'];

function validateDeployment(cfg, pinSet) {
  const reasons = [];
  const add = (rule, message) => reasons.push({ rule, message });

  // R1 exactly the five roles
  if (Object.keys(cfg.roles || {}).sort().join(',') !== [...FIVE_ROLES].sort().join(',')) add('R1', `roles must be exactly ${FIVE_ROLES.join(', ')}`);

  // R8 history shards
  if (!Number.isInteger(cfg.historyShards) || cfg.historyShards <= 0) add('R8', 'historyShards must be a positive integer');

  // R11 no publicClient override that forces system workers onto the external frontend
  if (cfg.publicClientOverride !== false) add('R11', 'publicClientOverride must be false');
  if (Object.hasOwn(cfg, 'publicClient')) add('R11', 'publicClient must be absent so system workers use the internal frontend');

  // R12 top-level server pin matches component-pins exactly
  const s = cfg.server || {};
  const ps = (pinSet && pinSet.server) || {};
  for (const k of ['version', 'sourceCommit', 'imageIndexDigest', 'imageAmd64Digest', 'configDigest']) {
    if (s[k] !== ps[k]) add('R12', `server.${k} must match the pinned component value`);
  }

  // Database: plugin/schema/store binding (R2), independence (R14), TLS/roles (R9)
  const db = cfg.database || {};
  if (db.plugin !== 'postgres12') add('R2', 'database.plugin must be postgres12');
  if (db.schemaPrimaryVersion !== '1.19') add('R2', 'database.schemaPrimaryVersion must be 1.19');
  if (db.schemaVisibilityVersion !== '1.14') add('R2', 'database.schemaVisibilityVersion must be 1.14');
  if (!Array.isArray(db.stores) || db.stores.length !== 2 || !db.stores.includes('temporal') || !db.stores.includes('temporal_visibility')) add('R2', 'database.stores must be exactly temporal + temporal_visibility');
  if (db.newResources !== true) add('R14', 'database must be new independent resources');
  if (db.encrypted !== true) add('R14', 'database must be encrypted');
  if (db.multiAz !== true) add('R14', 'database must be Multi-AZ');
  if (db.tlsHostnameVerification !== true) add('R9', 'database.tlsHostnameVerification must be true');
  if (db.separateRoles !== true) add('R9', 'database.separateRoles must be true');
  if (db.distinctMigrationIdentity !== true) add('R9', 'database.distinctMigrationIdentity must be true');

  // Per-role requirements (R2 TLS/packages/version, R10 mTLS client auth, R13 explicit mapper/authorizer, R5 ingress)
  for (const name of FIVE_ROLES) {
    const r = (cfg.roles || {})[name];
    if (!r) continue;
    if (!r.tls || r.tls.enabled !== true || r.tls.hostnameVerification !== true) add('R2', `${name}: TLS with hostname verification required`);
    if (!r.mtls || r.mtls.enabled !== true || r.mtls.requireClientAuth !== true) add('R10', `${name}: mTLS with requireClientAuth true required`);
    if (r.serverVersion !== SERVER_VERSION) add('R2', `${name}: serverVersion must be ${SERVER_VERSION}`);
    for (const p of PACKAGES) {
      if (!r.packageSet || r.packageSet[p] !== SDK_VERSION) add('R2', `${name}: packageSet.${p} must be ${SDK_VERSION}`);
    }
    if (typeof r.claimMapper !== 'string' || r.claimMapper.trim() === '') add('R13', `${name}: explicit claimMapper required`);
    if (typeof r.authorizer !== 'string' || r.authorizer.trim() === '') add('R13', `${name}: explicit authorizer required`);
    if (r.acceptsConversationIngress !== false) add('R5', `${name}: must not accept conversation/application ingress`);
    const expectedIngress = name === 'frontend' ? 'external' : 'internode';
    if (r.ingress !== expectedIngress) add('R5', `${name}: ingress must be ${expectedIngress}`);
  }

  // R3 external frontend
  const fe = (cfg.roles || {}).frontend;
  if (fe) {
    if (fe.claimMapper !== 'default') add('R13', 'frontend claimMapper must be explicit default');
    if (fe.authorizer !== 'default') add('R13', 'frontend authorizer must be explicit default');
    if (typeof fe.externalAudience !== 'string' || fe.externalAudience.trim() === '') add('R3', 'frontend externalAudience must be nonempty');
    if (typeof fe.jwksUrl !== 'string' || !/^https:\/\/.+/.test(fe.jwksUrl)) add('R3', 'frontend jwksUrl must be a dedicated HTTPS URL');
    if (!Number.isFinite(fe.keyRefreshSeconds) || fe.keyRefreshSeconds <= 0) add('R3', 'frontend keyRefreshSeconds must be > 0');
  }

  // R4 internal frontend boundary
  const ife = (cfg.roles || {})['internal-frontend'];
  if (ife) {
    if (ife.ingress !== 'internode') add('R4', 'internal-frontend ingress must be internode-only');
    if (ife.externalAudience !== undefined) add('R4', 'internal-frontend must not declare an external audience');
    if (ife.claimMapper !== 'internal') add('R4', 'internal-frontend must use the internal claim mapper');
    if (ife.acceptsConversationIngress !== false) add('R4', 'internal-frontend must never accept application/conversation ingress');
  }

  // R15 internal-worker maps to the real Temporal worker role
  const iw = (cfg.roles || {})['internal-worker'];
  if (iw && iw.temporalRole !== 'worker') add('R15', 'internal-worker must map to Temporal role worker');

  // R6 trusted application workers
  const w = cfg.trustedApplicationWorkers || {};
  if (w.namespaceRole !== 'write') add('R6', 'trusted app worker namespaceRole must be exactly write (RoleWriter4)');
  if (w.workerOnlyRoleAllowedByDefaultAuthorizer !== false) add('R6', 'RoleWorker1 alone cannot poll/complete/heartbeat with the default authorizer');

  // R7 conversation executors
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

function deletePath(obj, path) {
  const parts = path.split('.');
  const last = parts.pop();
  const parent = parts.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (parent && typeof parent === 'object') delete parent[last];
}

test('the base five-role fixture is well-formed and validates cleanly', () => {
  const result = validateDeployment(structuredClone(fixture), pins);
  assert.equal(result.ok, true, JSON.stringify(result.reasons));
  assert.equal(fixture.historyShards, 128);
  assert.equal(Object.keys(fixture.roles).length, 5);
  assert.equal(fixture.roles['internal-worker'].temporalRole, 'worker');
  assert.equal(fixture.roles.frontend.mtls.requireClientAuth, true);
  assert.equal(fixture.publicClientOverride, false);
  assert.equal(Object.hasOwn(fixture, 'publicClient'), false);
  assert.equal(fixture.trustedApplicationWorkers.namespaceRole, 'write');
  assert.equal(fixture.trustedApplicationWorkers.workerOnlyRoleAllowedByDefaultAuthorizer, false);
});

test('every prohibited boundary case is rejected with its expected rule', () => {
  assert.ok(fixture.prohibitedCases.length >= 30, 'need meaningful boundary coverage');
  const seenRules = new Set();
  for (const c of fixture.prohibitedCases) {
    const cfg = structuredClone(fixture);
    delete cfg.prohibitedCases;
    if (c.removeRole) delete cfg.roles[c.removeRole];
    for (const p of c.omit || []) deletePath(cfg, p);
    if (c.patch) deepMerge(cfg, structuredClone(c.patch));
    const result = validateDeployment(cfg, pins);
    assert.equal(result.ok, false, `${c.id} should be rejected`);
    assert.ok(result.reasons.some((r) => r.rule === c.rule), `${c.id} should report ${c.rule}, got ${JSON.stringify([...new Set(result.reasons.map((r) => r.rule))])}`);
    seenRules.add(c.rule);
  }
  // The previously-accepted false positives must all be covered by an explicit case.
  for (const rule of ['R6', 'R10', 'R11', 'R12', 'R13', 'R14']) assert.ok(seenRules.has(rule), `missing prohibited case for ${rule}`);
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
    ["import type { WorkerDeploymentOptions } from '@temporalio/worker';", 'const opts: WorkerDeploymentOptions = {', "  version: { deploymentName: 'meri-orchestration', buildId: 'x' },", '  useWorkerVersioning: true,', '};', 'void opts;', ''].join('\n'),
  );
  const bad = compile(badFile);
  assert.notEqual(bad.status, 0, 'compiler must reject a deployment without defaultVersioningBehavior');
  assert.match(`${bad.stdout || ''}${bad.stderr || ''}`, /TS2322|defaultVersioningBehavior/);
  rmSync(badFile, { force: true });

  const goodFile = join(runtime, 'expect-pass.ts');
  writeFileSync(
    goodFile,
    ["import type { WorkerDeploymentOptions } from '@temporalio/worker';", "import { VersioningBehavior } from '@temporalio/common';", 'const opts: WorkerDeploymentOptions = {', "  version: { deploymentName: 'meri-orchestration', buildId: 'x' },", '  useWorkerVersioning: true,', '  defaultVersioningBehavior: VersioningBehavior.PINNED,', '};', 'void opts;', ''].join('\n'),
  );
  const good = compile(goodFile);
  assert.equal(good.status, 0, `${good.stdout || ''}${good.stderr || ''}`);
  rmSync(goodFile, { force: true });
});

// Transpile the actual source in memory. The only permitted runtime import is
// replaced by this small deterministic facade; neither @temporalio/workflow nor
// the activity module is loaded. This checks our branching and signal handling,
// not Temporal scheduling, replay, cancellation propagation or durability.
function loadOfflineWorkflow({ cancelAt = null } = {}) {
  const handlers = new Map();
  const calls = [];
  let sleeps = 0;
  let nextInput;
  const continued = new Error('offline Continue-as-New boundary');
  const cancel = () => {
    const handler = handlers.get('cancelRequested');
    assert.equal(typeof handler, 'function', 'workflow must register its cancel signal');
    handler();
  };
  const sdk = {
    proxyActivities: () => ({
      collectApproval: async () => {
        calls.push('collectApproval');
        return 'approved';
      },
      recordCheckpoint: async ({ sequence }) => {
        calls.push(`checkpoint:${sequence}`);
        if (cancelAt === 'checkpoint3' && sequence === 3) cancel();
      },
      publishArtifact: async () => {
        calls.push('publishArtifact');
        if (cancelAt === 'publish') cancel();
      },
    }),
    defineSignal: (name) => name,
    defineQuery: (name) => name,
    setHandler: (name, handler) => handlers.set(name, handler),
    // Model an elapsed initial cancellation window without real time or timers.
    condition: async () => false,
    sleep: async () => {
      sleeps += 1;
      calls.push(`sleep:${sleeps}`);
      if (cancelAt === 'sleep3' && sleeps === 3) cancel();
    },
    continueAsNew: async (input) => {
      calls.push(`continueAsNew:${input.continuation}`);
      nextInput = structuredClone(input);
      throw continued;
    },
    CancellationScope: { cancellable: (fn) => fn() },
    isCancellation: () => false,
    ActivityFailure: class extends Error {},
    ApplicationFailure: {
      create: ({ message, type, nonRetryable }) => Object.assign(new Error(message), { type, nonRetryable }),
    },
  };
  const { outputText, diagnostics } = ts.transpileModule(read('workflow.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
    fileName: 'workflow.ts',
  });
  assert.equal(diagnostics?.length ?? 0, 0, 'in-memory transpilation must be clean; separate tsc checks types');
  const wf = {};
  runInNewContext(outputText, {
    exports: wf,
    require: (name) => {
      assert.equal(name, '@temporalio/workflow', 'unexpected workflow runtime import');
      return sdk;
    },
  }, { filename: 'workflow.offline-probe.cjs' });
  return {
    wf,
    async run(input) {
      let outcome = 'complete';
      let result;
      try {
        result = await wf.meriOrchestrationWorkflow(input);
      } catch (err) {
        if (err !== continued) throw err;
        outcome = 'continue-as-new';
      }
      const query = handlers.get('state');
      assert.equal(typeof query, 'function', 'workflow must register its state query');
      return { outcome, result, nextInput, calls: [...calls], state: structuredClone(query()) };
    },
  };
}

test('offline stubbed workflow: planContinuation encodes the bounded continuation policy', () => {
  const { wf } = loadOfflineWorkflow();
  assert.equal(wf.STAGES, 3);
  assert.deepEqual([...wf.ALLOWED_CONTINUATIONS], [0, 1]);

  // continuation 0 (fresh) permits one Continue-as-New; continuation 1 completes.
  assert.deepEqual(structuredClone(wf.planContinuation(0)), { ok: true, action: 'continue-as-new', nextContinuation: 1, reason: null });
  assert.deepEqual(structuredClone(wf.planContinuation(1)), { ok: true, action: 'complete', nextContinuation: 1, reason: null });

  // negative / unsafe values are rejected.
  for (const bad of [-1, 2, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '0', null, undefined, {}, []]) {
    const plan = wf.planContinuation(bad);
    assert.equal(plan.ok, false, `continuation ${String(bad)} must be rejected`);
    assert.equal(plan.action, 'complete');
  }
});

test('actual workflow control flow with stubs: continuation 0 continues once, continuation 1 completes', async () => {
  const input = { runId: 'synthetic-run', tenantRef: 'synthetic-tenant', objectKey: 'synthetic-object', continuation: 0 };
  const first = await loadOfflineWorkflow().run(input);
  assert.equal(first.outcome, 'continue-as-new');
  assert.deepEqual(first.nextInput, { ...input, continuation: 1 });
  assert.deepEqual(first.calls, ['collectApproval', 'sleep:1', 'checkpoint:1', 'sleep:2', 'checkpoint:2', 'sleep:3', 'checkpoint:3', 'publishArtifact', 'continueAsNew:1']);
  assert.equal(first.state.checkpoints, 3);

  const second = await loadOfflineWorkflow().run(first.nextInput);
  assert.equal(second.outcome, 'complete');
  assert.match(second.result, /completed continuation 1 after 3 checkpoints/);
  assert.deepEqual(second.calls, first.calls.slice(0, -1));
  assert.equal(second.state.checkpoints, 3);
  assert.equal(second.state.stage, 'completed');
});

for (const cancelAt of ['sleep3', 'checkpoint3', 'publish']) {
  test(`actual workflow control flow with stubs: cancellation at ${cancelAt} stops before continuation`, async () => {
    const input = { runId: 'synthetic-run', tenantRef: 'synthetic-tenant', objectKey: 'synthetic-object', continuation: 0 };
    const observed = await loadOfflineWorkflow({ cancelAt }).run(input);
    assert.equal(observed.outcome, 'complete');
    assert.match(observed.result, /cancelled/);
    assert.equal(observed.state.cancelled, true);
    assert.equal(observed.calls.some((call) => call.startsWith('continueAsNew:')), false, 'a cancellation signal must not be discarded across Continue-as-New');
    if (cancelAt === 'publish') {
      assert.equal(observed.calls.filter((call) => call === 'publishArtifact').length, 1, 'this signal arrives after publication is already started');
    } else {
      assert.equal(observed.calls.includes(cancelAt === 'sleep3' ? 'sleep:3' : 'checkpoint:3'), true, 'the injected final-stage cancellation point must be reached');
      assert.equal(observed.calls.includes('publishArtifact'), false, 'a final-stage cancellation must prevent publication');
    }
  });
}
