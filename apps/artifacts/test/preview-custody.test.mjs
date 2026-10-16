/** Synthetic PDF, artifact/object ports and real source-local claim store. No generator, renderer, DB or network. */
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createArtifactPreviewService} from '../preview/service.mjs';import {createLocalPreviewStore} from '../preview/local-store.mjs';
import {realPdf} from './pdf-fixtures.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function setup(t){
 const root=await mkdtemp(join(process.cwd(),'.preview-custody-')),path=join(root,'records');t.after(()=>rm(root,{recursive:true,force:true}));
 const source=realPdf(['synthetic preview custody']),binding={tenantId:'synthetic',actorId:'owner',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'tenant',resourceId:binding.tenantId,policyRevision:'1'}];
 const version=v.version({contractVersion:'0.1.0',artifactId:randomUUID(),versionId:randomUUID(),parentVersionId:null,binding,scopes,evidence:[],filename:'synthetic.pdf',mimeType:'application/pdf',generationStatus:'draft',previewStatus:'pending',createdAt:new Date().toISOString(),object:{objectId:randomUUID(),versionId:'source',sha256:sha(source),bytes:source.length,scopes}});
 const context=v.context({binding,scopes,evidence:[],assets:[],deadlineMs:Date.now()+60000,maxBytes:8388608});
 const state={puts:0,deny:false,lostPutAck:false,lostCommitAck:false,failInspect:false},bytes=new Map();
 const objects={async put({objectId,bytes:b,scopes:s}){state.puts++;bytes.set(objectId,Buffer.from(b));if(state.lostPutAck)throw Error('synthetic put ACK lost');return {objectId,versionId:'preview-v1',sha256:sha(b),bytes:b.length,scopes:s};},async get(o){return bytes.get(o.objectId);}};
 const artifacts={async download(){if(state.deny)throw Error('revoked');return {version,bytes:source};},async inspect(){if(state.deny)throw Error('revoked');if(state.failInspect&&state.puts>0)throw Error('synthetic inspection failure');return {version};}};
 const store=await createLocalPreviewStore({root:path,canonicalSha256:v.hash});
 const create=previews=>createArtifactPreviewService({validators:v,artifacts,objects,previews,ids:()=>({objectId:randomUUID(),versionId:randomUUID()}),now:Date.now});
 return {root,path,state,bytes,store,create,version,context,publish:service=>service.publish(version.versionId,context)};
}
test('synthetic: concurrent publishers across service instances claim one object and retain complete custody',async t=>{
 const a=await setup(t);
 const results=await Promise.allSettled([a.publish(a.create(a.store)),a.publish(a.create(a.store))]);
 assert.equal(a.state.puts,1,results.map(r=>String(r.reason?.cause?.stack)).join('\n'));assert.equal(results.filter(r=>r.status==='fulfilled').length>=1,true);
 for(const r of results)if(r.status==='rejected')assert.equal(r.reason.code,'ARTIFACT_EFFECT_UNKNOWN');
 const rows=await a.store.custody();assert.equal(rows.length,1);assert.equal(rows[0].state,'COMMITTED');
 assert.equal(rows[0].object.objectId,rows[0].claim.objectId);assert.equal(a.bytes.size,1);assert.equal(rows[0].record.preview.object.objectId,rows[0].claim.objectId);
 const other=await createLocalPreviewStore({root:a.path,canonicalSha256:v.hash});
 assert.equal((await a.publish(a.create(other))).status,'existing');assert.equal(a.state.puts,1);await other.dispose();assert.equal((await a.store.custody()).length,1,'disposing a borrowed root preserves custody');
});
test('synthetic: unknown put retains potential orphan identity across reopen without duplicate dispatch',async t=>{
 const a=await setup(t);a.state.lostPutAck=true;
 await assert.rejects(a.publish(a.create(a.store)),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&typeof e.objectId==='string');
 const recovered=await createLocalPreviewStore({root:a.path,canonicalSha256:v.hash}),custody=await recovered.custody();
 assert.equal(custody.length,1);assert.equal(custody[0].state,'UNKNOWN');assert.equal(custody[0].object,null);
 assert.equal(a.bytes.has(custody[0].claim.objectId),true,'the lost-ACK object remains discoverable by retained allocation');
 a.state.lostPutAck=false;await assert.rejects(a.publish(a.create(recovered)),{code:'ARTIFACT_EFFECT_UNKNOWN'});assert.equal(a.state.puts,1);
});
test('synthetic: a known orphan has exact object-version custody after post-write refusal',async t=>{
 const a=await setup(t);a.state.failInspect=true;await assert.rejects(a.publish(a.create(a.store)),{code:'ARTIFACT_EFFECT_UNKNOWN'});
 const rows=await a.store.custody();assert.equal(rows[0].state,'UNKNOWN');assert.equal(rows[0].object.versionId,'preview-v1');
 a.state.failInspect=false;await assert.rejects(a.publish(a.create(a.store)),{code:'ARTIFACT_EFFECT_UNKNOWN'});assert.equal(a.state.puts,1);
});
test('synthetic: commit ACK loss recovers the immutable record and current revocation still denies replay',async t=>{
 const a=await setup(t),lost={...a.store,async commit(...args){await a.store.commit(...args);throw Error('synthetic commit ACK lost');}};
 await assert.rejects(a.publish(a.create(lost)),{code:'ARTIFACT_EFFECT_UNKNOWN'});
 const recovered=await createLocalPreviewStore({root:a.path,canonicalSha256:v.hash});assert.equal((await a.publish(a.create(recovered))).status,'existing');assert.equal(a.state.puts,1);
 a.state.deny=true;await assert.rejects(a.publish(a.create(recovered)),/revoked/);assert.equal(a.state.puts,1);
});
test('synthetic: a legacy record-only port cannot enable publication without durable exclusion',async t=>{
 const a=await setup(t);assert.throws(()=>a.create({read:a.store.read,commit:a.store.commit}),{code:'ARTIFACT_CONFIGURATION'});assert.equal(a.state.puts,0);
});
test('synthetic: revocation while claiming prevents rendering/object dispatch and holds the original attempt',async t=>{
 const a=await setup(t),revoking={...a.store,async claim(...args){const result=await a.store.claim(...args);a.state.deny=true;return result;}};
 await assert.rejects(a.publish(a.create(revoking)),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.message==='revoked');assert.equal(a.state.puts,0);
 a.state.deny=false;await assert.rejects(a.publish(a.create(a.store)),{code:'ARTIFACT_EFFECT_UNKNOWN'});assert.equal(a.state.puts,0);assert.equal((await a.store.custody()).length,1);
});
