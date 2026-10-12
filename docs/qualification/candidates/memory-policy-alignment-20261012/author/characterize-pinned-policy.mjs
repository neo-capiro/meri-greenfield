/** Read-only, synthetic characterization. No private implementation is written or logged. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import * as asyncHooks from 'node:async_hooks';
import vm from 'node:vm';
import ts from '../../../../../packages/contracts/node_modules/typescript/lib/typescript.js';

const repository = process.env.MEMORY_POLICY_REFERENCE_REPO ?? '/workspace/capirov2';
const ref = 'fd8765ec01d292013758606204f2c9d886cd31c1';
const source = path => execFileSync('git', ['-C', repository, 'show', `${ref}:${path}`], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'pipe'] });
const cache = new Map(); const loaded = [];
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const body = source(path);
  loaded.push({ path, sha256: createHash('sha256').update(body).digest('hex') });
  const output = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; const module = { exports };
  function require(name) {
    if (name === 'node:async_hooks') return asyncHooks;
    if (name === '@capiro/meriv2-core') return new Proxy({}, { get() { throw new Error('ExternalDependencyRefused'); } });
    if (name.startsWith('./') || name.startsWith('../')) return load(posix.normalize(posix.join(posix.dirname(path), name)).replace(/\.js$/, '.ts'));
    throw new Error('ExternalDependencyRefused');
  }
  vm.runInNewContext(output, { exports, module, require }, { timeout: 1000, filename: path });
  cache.set(path, module.exports); return module.exports;
}

try {
  const manifest = JSON.parse(readFileSync(new URL('../../../../handover/20261012/PRIVATE-SOURCE-REFERENCES.json', import.meta.url)));
  const references = manifest.files.map(file => {
    const body = source(file.path); const sha256 = createHash('sha256').update(body).digest('hex');
    const gitBlob = execFileSync('git', ['-C', repository, 'rev-parse', `${ref}:${file.path}`], { encoding: 'utf8', timeout: 3000 }).trim();
    assert.equal(sha256, file.sha256); assert.equal(Buffer.byteLength(body), file.bytes); assert.equal(gitBlob, file.gitBlob);
    return { path: file.path, sha256, gitBlob, bytes: file.bytes, match: true };
  });
  const { evaluateGovernedMemoryAuthorization: evaluate } = load('apps/api/src/memory/memory-authorization.helpers.ts');
  const { isMemoryReviewAdminRole: adminRole } = load('apps/api/src/memory/memory-review-admin-policy.ts');
  const rows = [];
  const base = { userId: 'synthetic-actor', role: 'standard_user', operation: 'approve',
    subject: { memoryClass: 'institutional_authoritative', scope: 'client', ownerUserId: 'synthetic-actor',
      clientId: 'synthetic-client', status: 'pending', legalHold: false, proposedByUserId: 'synthetic-other' },
    ethicalWallAllowed: true, clientStatus: 'active', grantPermissions: ['approve', 'review'], impersonating: false, actorRole: null };
  function probe(id, changes, subjectChanges, expectedAllowed) {
    const facts = { ...base, ...changes, subject: { ...base.subject, ...subjectChanges } };
    const observed = evaluate(facts); assert.equal(observed.allowed, expectedAllowed, id);
    rows.push({ id, observed });
  }
  for (const role of ['user_admin', 'capiro_admin', 'standard_user', 'client_portal_user', 'admin', 'USER_ADMIN', 'user_admin ']) {
    const expectedAdmin = role === 'user_admin' || role === 'capiro_admin';
    assert.equal(adminRole(role), expectedAdmin);
    for (const scope of ['firm', 'client']) for (const self of [true, false]) {
      probe(`${scope}:${role}:${self ? 'own' : 'other'}`, { role },
        { scope, clientId: scope === 'client' ? 'synthetic-client' : null, proposedByUserId: self ? 'synthetic-actor' : 'synthetic-other' },
        expectedAdmin || (scope === 'client' && !self));
    }
  }
  for (const role of ['standard_user', 'user_admin', 'capiro_admin']) {
    probe(`wall:${role}`, { role, ethicalWallAllowed: false }, {}, false);
    for (const clientStatus of ['archived', 'suspended']) probe(`${clientStatus}:${role}`, { role, clientStatus }, {}, false);
    probe(`no-live-grant:${role}`, { role, grantPermissions: [] }, {}, role !== 'standard_user');
    probe(`private-owner:${role}`, { role }, { scope: 'user_private', clientId: null }, true);
    probe(`private-other:${role}`, { role }, { scope: 'user_private', ownerUserId: 'synthetic-other', clientId: null }, false);
  }
  probe('impersonating-effective-standard', { role: 'user_admin', impersonating: true, actorRole: 'standard_user' }, { proposedByUserId: 'synthetic-actor' }, false);
  probe('impersonating-effective-admin', { role: 'standard_user', impersonating: true, actorRole: 'capiro_admin' }, { proposedByUserId: 'synthetic-actor' }, true);
  probe('helper-null-actor-role-falls-back', { role: 'user_admin', impersonating: true, actorRole: null }, { proposedByUserId: 'synthetic-actor' }, true);
  probe('helper-null-client-status-not-full-context-proof', { clientStatus: null }, {}, true);
  const { evaluateMemoryCandidate } = load('apps/api/src/memory/memory-candidate-rules.ts');
  const candidateRows = [];
  for (const scope of ['firm', 'client', 'personal']) for (const isAdmin of [false, true]) {
    for (const sourceKind of ['explicit_user', 'model_extraction', 'learning_signal', 'automation']) {
      const observed = evaluateMemoryCandidate({ scope, isAdmin, sourceKind, confidence: 1, minConfidence: 0.5 });
      const expected = scope !== 'personal' || ['model_extraction', 'learning_signal'].includes(sourceKind) ? 'WARN' : 'PASS';
      assert.equal(observed.outcome, expected, `${scope}:${isAdmin}:${sourceKind}`);
      candidateRows.push({ scope, isAdmin, sourceKind, outcome: observed.outcome });
    }
  }
  console.log(JSON.stringify({ ref, references, loaded, authorizationRows: rows, candidateRows,
    limitations: ['Synthetic pure-helper execution only; no canonical service, DB, assignment or wall query executed.',
      'Missing/expired/revoked grant filtering is a service obligation, not a property of this helper’s supplied array.',
      'Reject and withdraw have additional distinct service/DB checks; helper approve/review output is not a rejection capability.'] }, null, 2));
} catch (error) {
  // VM/transpiler diagnostics can echo private source. Intentionally suppress message/stack/body.
  console.error(JSON.stringify({ status: 'FAIL', failureClass: error?.name ?? 'Unknown', ref,
    diagnosticRedaction: 'Private source message, stack and body intentionally omitted; original source remains in read-only Git objects.' }));
  process.exitCode = 1;
}
