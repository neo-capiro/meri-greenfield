/** Connected proof of the Control-side browser publication owner over the REAL canonical storage adapter:
 * createPostgresArtifactVersions over the inert SQL fixture and the REAL publication journal/CAS, plus the REAL
 * immutable object store and the REAL ArtifactService. Only SQL/S3/Core responses are inert; no target service is
 * stubbed and no versions adapter is hand-written. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createLocalArtifactStore} from '../../artifacts/local-store.mjs';
import {sqlFixture,NOW} from '../../artifacts/storage/test/sql-fixture.mjs';
import {validators} from '../../artifacts/test/artifact-harness.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createBrowserArtifactPublication} from '../browser-artifact-publication.mjs';

const sha256=b=>createHash('sha256').update(b).digest('hex');
const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',
 conversationId:'33333333-3333-4333-8333-000000000001',runId:'33333333-3333-4333-8333-000000000002',
 attemptId:'33333333-3333-4333-8333-000000000003',workerId:'33333333-3333-4333-8333-000000000004',writerFence:1};
const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:'synthetic-client',policyRevision:'synthetic-policy'}];
const bytes=Buffer.from('hello browser import\n');
const downloadKey=filename=>hash({schema:'meri-browser-download/1',tenantId:binding.tenantId,
 conversationId:binding.conversationId,runId:binding.runId,filename,sha256:sha256(bytes)});

async function ownerOver(t,f,{over={}}={}){
 const dir=await mkdtemp(join(tmpdir(),'meri-browser-pub-')),root=join(dir,'store');
 const store=await createLocalArtifactStore({root,canonicalSha256:hash});
 t.after(async()=>{await store.dispose();await rm(dir,{recursive:true,force:true});});
 const versions=f.create(),state={now:NOW,rechecks:[],resolved:null};
 const authorize=async({action,resource,binding:b,scopes:s,requestSha256,deadlineMs})=>({receiptId:'synthetic-authority',
  decision:'allow',action,binding:b,scopesSha256:hash(s),resourceSha256:hash(resource),requestSha256,
  expiresAtMs:Math.min(deadlineMs,state.now+30000)});
 const makeContext=()=>({binding,scopes,evidence:[],assets:[],deadlineMs:state.now+60000,maxBytes:8388608});
 const resolve=async input=>{state.resolved=input;return {documentOptions:{artifactOptions:{context:makeContext(),
  validators,authorize,versions,objects:store.objects,
  executor:{async execute(){throw Error('synthetic: ingest never renders')}},
  now:()=>state.now,ids:()=>({artifactId:'synthetic',versionId:'synthetic',objectId:'synthetic'})}},
  async recheck(value){state.rechecks.push(value);}};};
 const publication=createBrowserArtifactPublication({resolve,
  sessions:{nativeCredentialFor:()=>({credential:'synthetic-bearer',expiresAtMs:state.now+30000})},
  now:()=>state.now,requestMs:30000});
 const request={binding,scopes,filename:'notes.txt',format:'txt',mimeType:'text/plain; charset=utf-8',
  bytes:Buffer.from(bytes),origin:'https://app.capiro.example',policySha256:'a'.repeat(64),
  deadlineMs:NOW+60000,idempotencyKey:downloadKey('notes.txt'),...over};
 return {f,versions,publication,request,state};
}

test('accepted bytes become ONE committed version through the canonical PG adapter and publication journal',async t=>{
 const f=sqlFixture(),o=await ownerOver(t,f);
 const ack=await o.publication.ingest(o.request);
 assert.equal(typeof ack.versionId,'string');
 assert.equal(ack.sha256,sha256(bytes));
 assert.equal(f.state.versions.size,1,'exactly one projected SQL version row');
 assert.equal(f.durable.state.index.decisions.length,1);
 const decision=f.durable.state.index.decisions[0];
 assert.equal(decision.invocation.kind,'browser-import');
 assert.equal(decision.invocation.idempotencyKey,o.request.idempotencyKey);
 assert.equal(decision.record.spec.sourceKind,'meri.browser-download/1');
 assert.deepEqual(o.state.rechecks.map(r=>r.phase),['admission','release']);
 assert.equal(o.state.rechecks[0].intent,'browser-import');
 assert.equal(o.state.rechecks[0].requestSha256,o.state.resolved.requestSha256);
 assert.equal(o.state.rechecks[0].resource,null);
 const stored=await o.versions.read(ack.versionId);
 assert.equal(stored.version.versionId,ack.versionId);
 assert.equal(stored.spec.sha256,sha256(bytes));
});

test('a retry inside the original run deadline reconciles; past it a fresh write is refused',async t=>{
 const f=sqlFixture(),o=await ownerOver(t,f);
 const first=await o.publication.ingest(o.request);
 o.state.now=NOW+10000;
 const again=await o.publication.ingest(o.request);
 assert.equal(again.versionId,first.versionId);
 assert.equal(again.reconciled,true);
 assert.equal(f.state.versions.size,1);
 assert.equal(f.durable.state.index.decisions.length,1);
 o.state.now=NOW+61000;
 await assert.rejects(()=>o.publication.ingest({...o.request,filename:'other.txt',
  idempotencyKey:downloadKey('other.txt')}),/BROWSER_ARTIFACT_DEADLINE/u);
 assert.equal(f.state.versions.size,1);
});

test('a recreated owner retries the SAME durable identity with no second effect',async t=>{
 const f=sqlFixture(),o=await ownerOver(t,f);
 const first=await o.publication.ingest(o.request);
 const restarted=await ownerOver(t,f);
 restarted.state.now=NOW+5000;
 const again=await restarted.publication.ingest(o.request);
 assert.notEqual(restarted.versions,o.versions);
 assert.equal(again.versionId,first.versionId);
 assert.equal(f.state.versions.size,1);
 assert.equal(f.durable.state.index.decisions.length,1);
});

test('mismatched canonical context and missing owners refuse without any projection write',async t=>{
 const f=sqlFixture(),bad=await ownerOver(t,f,{over:{scopes:[{...scopes[0],policyRevision:'other'}]}});
 await assert.rejects(()=>bad.publication.ingest(bad.request),/BROWSER_ARTIFACT_CONTEXT/u);
 assert.equal(f.state.versions.size,0);
 assert.equal(f.durable.state.index.decisions.length,0);
 assert.throws(()=>createBrowserArtifactPublication({resolve:()=>{},sessions:{},now:()=>NOW,requestMs:1000}),
  /BROWSER_ARTIFACT_CONFIGURATION/u);
});
