/** Existing preview claim port characterizations for the continuation plan. In-memory synthetic ports only; no storage writes,
 * DB, real PDF/renderer or provider. Deliberately unrendered bytes make a mistaken post-uncertainty continuation fail this phase check. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';import {createArtifactPreviewService} from '../preview/service.mjs';
function fixture(){const bytes=Buffer.from('synthetic unrendered bytes'),createdAt=new Date().toISOString(),binding={tenantId:'synthetic',actorId:'owner',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const scopes=[{tenantId:'synthetic',kind:'tenant',resourceId:'synthetic',policyRevision:'1'}],object={objectId:randomUUID(),versionId:'source-v1',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,scopes};
 const version=v.version({contractVersion:'0.1.0',artifactId:randomUUID(),versionId:randomUUID(),parentVersionId:null,binding,scopes,evidence:[],filename:'synthetic.pdf',mimeType:'application/pdf',generationStatus:'draft',previewStatus:'pending',createdAt,object});
 const context=v.context({binding,scopes,evidence:[],assets:[],deadlineMs:Date.now()+60000,maxBytes:8388608}),state={claim:null,claims:0,puts:0,deny:false};
 const artifacts={async download(){if(state.deny)throw Error('synthetic current authority revoked');return {version,bytes};},async inspect(){return {version};}};
 const previews={async read(){return null;},async claim(value){state.claims++;if(state.claim)return {claimed:false,claim:structuredClone(state.claim)};
  state.claim=structuredClone(value);throw Error('synthetic durable claim ACK lost');},async recordObject(){assert.fail('no object receipt is permitted');},async commit(){assert.fail('no publication is permitted');}};
 const service=createArtifactPreviewService({validators:v,artifacts,previews,objects:{async put(){state.puts++;assert.fail('no object write is permitted');},async get(){assert.fail('no object read is permitted');}},ids:()=>({objectId:randomUUID(),versionId:randomUUID()}),now:Date.now});
 return {state,service,version,context,publish:contextValue=>service.publish(version.versionId,contextValue??context)};}

test('synthetic continuation: lost durable claim ACK stops at the claim boundary and allowed replay retains original authority',async()=>{
 const f=fixture();await assert.rejects(f.publish(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.message==='synthetic durable claim ACK lost');
 const original=structuredClone(f.state.claim),next={...f.context,binding:{...f.context.binding,runId:randomUUID(),attemptId:randomUUID()},deadlineMs:f.context.deadlineMs+60000};
 await assert.rejects(f.publish(next),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.code==='ARTIFACT_PREVIEW_CLAIM_HELD'&&e.objectId===original.objectId);
 assert.deepEqual(f.state.claim,original);assert.equal(f.state.claims,2);assert.equal(f.state.puts,0);
});

test('synthetic continuation: current revocation after a lost claim ACK refuses before another custody operation',async()=>{
 const f=fixture();await assert.rejects(f.publish(),e=>e.cause.message==='synthetic durable claim ACK lost');const original=structuredClone(f.state.claim);f.state.deny=true;
 await assert.rejects(f.publish(),/synthetic current authority revoked/);assert.equal(f.state.claims,1);assert.equal(f.state.puts,0);assert.deepEqual(f.state.claim,original);
});
