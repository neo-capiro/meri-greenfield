/** Real local document/storage owners over explicitly scripted accounting and identity. */
import {randomUUID} from 'node:crypto';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {createLocalArtifactExecutor} from '../../../artifacts/local-executor.mjs';
import {createLocalArtifactStore} from '../../../artifacts/local-store.mjs';
import {createPostgresArtifactService} from '../../../artifacts/postgres-service.mjs';
import {createLocalDocumentPorts} from './ports.mjs';

const root = fileURLToPath(new URL('../../../../',import.meta.url));
export async function createLocalDocumentFixture({mode,pythonExecutable}) {
  if (mode !== 'synthetic-local' || typeof pythonExecutable !== 'string' || !isAbsolute(pythonExecutable) ||
      !process.env.MERI_REVIEW_SOURCE_ROOT || resolve(process.env.MERI_REVIEW_SOURCE_ROOT) !== resolve(root)) throw Error('LOCAL_DOCUMENT_CONFIGURATION');
  const {harness,uuid} = await import('../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs');
  const ledger = harness(), started = Date.now(), deadlineMs = started + 25000;
  const now = () => {const at = Date.now(); ledger.setClock(at); return at;};
  now();
  const binding = structuredClone(ledger.f.binding), clientId = uuid('9');
  const scopes = [{tenantId: binding.tenantId,kind: 'client',resourceId: clientId,policyRevision: ledger.f.claims.policyRevision}];
  const entry = catalog.operations.find(e => e.operation.id === 'create_word');
  const descriptor = structuredClone({operation: entry.operation,requiredGrants: entry.requiredGrants,sourceRequirements: entry.sourceRequirements});
  Object.assign(ledger.f.claims,{scopes,issuedAt: new Date(started - 1000).toISOString(),expiresAt: new Date(deadlineMs).toISOString()});
  Object.assign(ledger.f.claims.budgets,{maxRuntimeSeconds: 30,maxOutputBytes: 1048576});
  Object.assign(ledger.f.subject,{kind: 'client',entityType: 'client',entityIds: [clientId],scopes});
  ledger.state().grant.expires_at = new Date(deadlineMs);
  ledger.allocation.budgets.maxRuntimeSeconds = 30;
  ledger.allocation.budgets.maxOutputBytes = 1048576;
  ledger.allocation.manifest.requiredSources = structuredClone(descriptor.sourceRequirements);
  ledger.allocation.manifest.allowedOperations = [descriptor.operation];
  ledger.allocation.manifest.subjectKinds = ['client'];
  ledger.allocation.manifest.budgets = structuredClone(ledger.allocation.budgets);
  ledger.allocation.manifestSha256 = canonicalSha256(ledger.allocation.manifest);
  ledger.allocation.schedule = {revision: 'b'.repeat(64),expiresAt: new Date(deadlineMs).toISOString(),operations: [{operation: descriptor.operation,chargeMicrousd: 10}]};
  ledger.invocation.allocationSha256 = canonicalSha256(ledger.allocation);
  const context = {binding,scopes,evidence: [],assets: [],deadlineMs,maxBytes: 1048576};
  const state = {closed: false,revoked: false,generations: 0,artifactChecks: 0,processReceipts: [],cleanup: null};
  const ports = createLocalDocumentPorts({ledger,descriptor,binding,scopes,clientId,deadlineMs,now,state});
  let directory,store;
  try {
    directory = await mkdtemp(join(tmpdir(),'meri-document-fixture-'));
    store = await createLocalArtifactStore({root: join(directory,'store'),canonicalSha256});
    // PPTX is outside this fixture. The existing executor only uses this path for that format.
    const executor = createLocalArtifactExecutor({pythonExecutable,nodeExecutable: process.execPath,
      pptxModulePath: join(directory,'pptx-not-configured'),tempRoot: directory,timeoutMs: 15000});
    const artifactOptions = {pool: ledger.pool,allocationJson: JSON.stringify(ledger.allocation),
      producerContext: {context: ledger.context(),producer: ledger.producer},descriptor,context,validators: artifactValidators,
      authority: ports.authority,authorize: ports.authorize,versions: store.versions,objects: store.objects,
      executor: {async execute(call) {state.generations++;const result = await executor.execute(call);state.processReceipts.push(result.processReceipt);return result;}},
      now,ids: () => ({artifactId: randomUUID(),versionId: randomUUID(),objectId: randomUUID()}),
      newReservationId: randomUUID,limits: {maxRequestMs: 15000,maxResponseBytes: 131072},sourceEnabled: true};
    await createPostgresArtifactService(artifactOptions).bindTrustedGrant(JSON.stringify(ledger.invocation));
    const stats = () => ({mode,sourceConnected: false,nativeDatabase: false,nativeQualified: false,
      generations: state.generations,artifactChecks: state.artifactChecks,versionCharges: ledger.state().reservations.size,
      settled: [...ledger.state().reservations.values()].filter(r => r.state === 'SETTLED').length,
      unknown: [...ledger.state().reservations.values()].filter(r => r.state === 'UNKNOWN').length,
      consumedMicroUsd: ledger.state().budget.consumed_micro_usd,
      allocations: ledger.state().allocation ? 1 : 0,grants: ledger.state().bindings.size,
      processReceipts: structuredClone(state.processReceipts),closed: state.closed,revoked: state.revoked,cleanup: state.cleanup});
    return {mode,artifactOptions,sessions: ports.sessions,selectedClientId: clientId,
      nativeCredential: ports.nativeCredential,credential: ledger.credential,now,
      limits: {maxRequestMs: 15000,maxRequestBytes: 131072,maxResponseBytes: 1048576},
      directory,stats,revoke() {state.revoked = true;},
      async close() {
        if (state.closed) return;
        state.closed = true; ports.sessions.close();
        const remaining = await readdir(directory);
        state.cleanup = {executorDirectoriesAbsent: remaining.every(name => name === 'store'),storeRemoved: false};
        await store.dispose(); await rm(directory,{recursive: true,force: true});state.cleanup.storeRemoved = true;
      },
    };
  } catch (error) {
    ports.sessions.close();if (store) await store.dispose();if (directory) await rm(directory,{recursive: true,force: true});throw error;
  }
}
