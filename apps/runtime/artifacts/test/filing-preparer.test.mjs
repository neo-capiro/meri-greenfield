/** Actual action-session borrowing and native metadata preparation; storage/Core are deliberately unavailable.
 * These tests qualify refusal before canonical custody, not native-file inspection or filing execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createMetadataPoolFixture,id,NOW} from '../../../control/commands/approval-metadata/test/fixture.mjs';
import {createRuntimeAttachmentFilingPreparer} from '../filing-preparer.mjs';
const deliveryId=`sdk:${'a'.repeat(64)}`;
async function fixture(t){
 const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const selectedClientId=id(5),policyRevision='policy-1',scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:selectedClientId,policyRevision}];
 const state={now:NOW,resolves:0,lookups:0,onLookup:null},now=()=>state.now;
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:10,maxRequestMs:2000,maxTtlMs:20000,maxFactBytes:131072},
  async verifyIdentity(){return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'identity',checkedAtMs:now(),expiresAtMs:now()+30000};},
  async resolveContext({identity}){return {identitySha256:canonicalSha256(identity),binding,scopes,selectedClientId,contextRevision:'context',checkedAtMs:now(),expiresAtMs:now()+30000};}});
 t.after(()=>sessions.close());const original=await sessions.issue({identityCredential:'native-user',hints:{}}),sql=createMetadataPoolFixture();
 const config={pool:sql.pool,binding,scopes,selectedClientId,policyRevision,expiresAtMs:NOW+60000,now,
  async readCurrent(){return {binding,scopes,selectedClientId,policyRevision,checkedAtMs:now(),expiresAtMs:now()+10000};},
  bound:{sessions,store:{}},optionsOwner:{async resolve(){state.resolves++;throw Error('Canonical application must not be reached');}},
  async resolveVersion(call){state.lookups++;await state.onLookup?.(call);return id(8);},
  limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:1048576}};
 const object={objectId:id(6),versionId:'native-file-v1',sha256:'a'.repeat(64),bytes:12,scopes};
 const request={clientId:selectedClientId,conversationId:binding.conversationId,objects:[object]};
 return {sessions,original,sql,config,state,request,prepare:signal=>createRuntimeAttachmentFilingPreparer(config).prepare({arguments:request,deliveryId,signal})};
}

test('runtime filing requires the actual bound session borrower and construction does no work',async t=>{
 const f=await fixture(t);createRuntimeAttachmentFilingPreparer(f.config);
 for(const extra of [{bound:null},{bound:{sessions:{}}},{resolveVersion:null}])assert.throws(()=>createRuntimeAttachmentFilingPreparer({...f.config,...extra}),{code:'INTENT_CONFIGURATION'});
 assert.equal(f.state.lookups,0);assert.equal(f.state.resolves,0);assert.equal(f.sql.calls.length,0);
});

test('Core upload ceiling and tighter response bounds refuse oversized references before lookup or metadata',async t=>{
 for(const limit of [1048576,16777216]){
  const f=await fixture(t);f.config.limits.maxResponseBytes=limit;f.request.objects[0].bytes=Math.min(10485760,limit)+1;
  await assert.rejects(f.prepare(),e=>e.effect==='none');
  assert.equal(f.state.lookups,0);assert.equal(f.state.resolves,0);assert.equal(f.sql.calls.length,0);assert.equal(f.sql.rows.size,0);
 }
});

test('session revocation during version lookup prevents custody inspection and approval metadata',async t=>{
 const f=await fixture(t);f.state.onLookup=()=>f.sessions.revoke(f.original.credential);
 await assert.rejects(f.prepare(),e=>e.effect==='none');
 assert.equal(f.state.lookups,1);assert.equal(f.state.resolves,0);assert.equal(f.sql.calls.length,0);assert.equal(f.sql.rows.size,0);
});

test('a newer borrowed credential cannot replace the selected session during version lookup',async t=>{
 const f=await fixture(t);let replacement;
 f.state.onLookup=async()=>{f.state.now++;replacement=await f.sessions.issue({identityCredential:'new-native-user',hints:{}});};
 await assert.rejects(f.prepare(),e=>e.effect==='none');assert.notEqual(replacement.credential,f.original.credential);
 assert.equal(f.state.resolves,0);assert.equal(f.sql.calls.length,0);assert.equal(f.sql.rows.size,0);
 assert.equal(f.sessions.status().sessions,2,'the preparer does not mint or revoke sessions');
});

test('cancelled parked version lookup cannot inspect or insert after its late completion',async t=>{
 const f=await fixture(t),controller=new AbortController();let entered,release;
 const started=new Promise(r=>{entered=r;}),parked=new Promise(r=>{release=r;});f.state.onLookup=async()=>{entered();await parked;};
 const pending=f.prepare(controller.signal);await started;controller.abort();
 await assert.rejects(pending,e=>e.code==='CANCELLED'&&e.effect==='none');release();await new Promise(r=>setImmediate(r));
 assert.equal(f.state.resolves,0);assert.equal(f.sql.calls.length,0);assert.equal(f.sql.rows.size,0);
});
