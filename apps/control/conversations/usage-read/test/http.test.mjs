import test from 'node:test';import assert from 'node:assert/strict';
import {fixture as storeFixture,payload,binding,request,id} from './fixture.mjs';
import {createPostgresConversationStore} from '../../postgres-store.mjs';
import {createConversationHistoryService} from '../../history/service.mjs';
import {createConversationUsageApplication} from '../http.mjs';
import {ProductError} from '../../../product-access/errors.mjs';
import {hash} from '../../boundary.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from '../../../../runtime/product-applications.mjs';
import {CONVERSATION_USAGE_PATH} from '../../../../../packages/contracts/conversation-usage/protocol.mjs';
async function fixture(options={}){
 const db=await storeFixture(options),state={principal:{tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[id(5)]},reads:0,currentness:0,membership:0,retention:0,metadata:0,fenced:false};
 const store={...db.store,async readUsage(...args){state.reads++;state.beforeUsage?.();const value=await db.store.readUsage(...args);state.afterUsage?.();return value;}};
 const gate={async admit({credential}){assert.equal(credential,'SYNTHETIC_CURRENT');if(state.admissionDenied)throw new ProductError('ACCESS_DENIED');return {principal:structuredClone(state.principal),expiresAtMs:9000};},async recheck({principal}){state.membership++;if(state.membershipDenied)throw new ProductError('MEMBERSHIP_REVOKED');if(JSON.stringify(principal)!==JSON.stringify(state.principal))throw new ProductError('MEMBERSHIP_CHANGED');}};
 const currentness={async assertCurrent({credential,conversationId,scopes}){assert.equal(credential,'SYNTHETIC_CURRENT');assert.equal(conversationId,binding.conversationId);assert.deepEqual(scopes,db.scopes);state.currentness++;if(state.currentDenied||state.currentness>1&&state.finalDenied)throw new ProductError('ACCESS_DENIED');}};
 const retention={async assertServable(){state.retention++;if(state.suppressed)throw new ProductError('CONVERSATION_NOT_FOUND');},async withRelease(subjects,release){assert.deepEqual(subjects,[{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId}]);state.fenced=true;try{const result=await release(undefined,()=>retention.assertServable());assert.ok(result instanceof Response);return result;}finally{state.fenced=false;}}};
 const management=options.management?{assertActiveBinding(){throw Error('no write allowed');},forRequest({credential}){assert.equal(credential,'SYNTHETIC_CURRENT');return {async metadata(){state.metadata++;assert.equal(state.fenced,true);if(state.metadataDenied)throw new ProductError('ACCESS_DENIED');return {conversationId:binding.conversationId,clientId:options.general?null:id(5),status:state.trashed?'trashed':'active'};}};}}:undefined;
 const history=createConversationHistoryService({store,gate,retention}),limits={maxRequestMs:1000,maxRequestBytes:4096,maxResponseBytes:131072};
 const app=options.runtimeMount?createRuntimeProductApplications({configuration:{sourceEnabled:false,limits:{requestMs:1000,requestBytes:4096},native:{maxResponseBytes:131072}},sessions:{},ports:captureRuntimePorts({conversationMembership:gate,conversationCurrentness:currentness,...(management?{conversationManagement:management}:{})}),conversationStore:store,retention,now:()=>1000})
  :createConversationUsageApplication({store,history,gate,currentness,management,retention,now:()=>1000,limits});
 const read=body=>app.handle(new Request('https://runtime.example.invalid'+CONVERSATION_USAGE_PATH,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_CURRENT','content-type':'application/json'},body:JSON.stringify(body??request)}));
 return {...db,state,read,sql:db.state.calls};
}
test('completed run usage reloads through the actual accounting reader and current fenced release without writes',async()=>{
 const f=await fixture(),before=structuredClone(f.row()),sqlStart=f.sql.length;
 const response=await f.read();assert.equal(response.status,200,await response.clone().text());const value=await response.json();assert.equal(value.recording,'recorded');assert.equal(value.runId,binding.runId);assert.equal(value.usage.runDelta.sdkEstimateUsd,0.3);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(f.state.reads,1);assert.equal(f.state.currentness,2);assert.equal(f.state.membership,1);assert.equal(f.state.retention,2);assert.deepEqual(f.row(),before);
 const fresh=createPostgresConversationStore({pool:f.pool});assert.deepEqual(await fresh.readUsage(binding,()=>{}),before.sdk_usage);assert.deepEqual(await (await f.read()).json(),value);assert.deepEqual(f.row(),before);
 assert.ok(f.sql.slice(sqlStart).every(sql=>!/^(INSERT|UPDATE|DELETE)/u.test(sql)),'reading never writes or records usage again');
});
test('actual runtime product mount uses current bearer and final Core metadata, never source or runner dispatch',async()=>{
 const f=await fixture({runtimeMount:true,management:true}),response=await f.read();assert.equal(response.status,200,await response.clone().text());assert.equal(f.state.currentness,1);assert.equal(f.state.metadata,1);assert.equal(f.state.reads,1);
});
test('no record, unavailable null and recorded zero survive the authenticated boundary distinctly',async()=>{
 for(const [options,recording,status,amount]of [[{record:false},'not-recorded',undefined,undefined],[{input:payload({unavailable:true})},'recorded','unavailable',undefined],[{input:payload({zero:true})},'recorded','recorded',0]]){
  const f=await fixture(options),r=await f.read();assert.equal(r.status,200);const value=await r.json();assert.equal(value.recording,recording);assert.equal(value.usage?.status,status);assert.equal(value.usage?.runDelta?.sdkEstimateUsd,amount);
 }
});
test('wrong tenant, actor, client, selector, revoked current access or retention refuse before usage read',async()=>{
 for(const change of [f=>f.state.principal.tenantId='foreign',f=>f.state.principal.actorId='foreign',f=>f.state.principal.clientIds=[],f=>f.state.admissionDenied=true,f=>f.state.currentDenied=true,f=>f.state.suppressed=true]){
  const f=await fixture();change(f);const r=await f.read();assert.notEqual(r.status,200);assert.equal(f.state.reads,0);assert.doesNotMatch(await r.text(),/model.alpha|private|sdkEstimate/);
 }
 const f=await fixture();for(const bad of [{...request,runId:id(99)},{...request,conversationId:id(99)},{...request,actorId:'forged'}])assert.notEqual((await f.read(bad)).status,200);assert.equal(f.state.reads,0);
});
test('membership, Core and retention changes after storage read withhold all projected facts',async()=>{
 for(const key of ['membershipDenied','finalDenied','suppressed']){const f=await fixture();f.state.afterUsage=()=>f.state[key]=true;const r=await f.read();assert.notEqual(r.status,200);assert.equal(f.state.reads,1);assert.doesNotMatch(await r.text(),/model.alpha|sdkEstimate|toolAudit/);}
 for(const change of [principal=>principal.tenantId='foreign',principal=>principal.actorId='foreign',principal=>principal.clientIds=[]]){const f=await fixture();f.state.afterUsage=()=>change(f.state.principal);const r=await f.read();assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:{code:'MEMBERSHIP_CHANGED'}});assert.equal(f.state.reads,1);}
 for(const key of ['metadataDenied','trashed']){const f=await fixture({management:true});f.state.afterUsage=()=>f.state[key]=true;const r=await f.read();assert.notEqual(r.status,200);assert.equal(f.state.reads,1);}
});
test('malformed usage, hash corruption and a replaced run row never release another run or private payload',async()=>{
 for(const change of [f=>{f.row().sdk_usage.toolsUsed.tools[0].arguments='PRIVATE';f.row().sdk_usage_sha256=hash(f.row().sdk_usage);},f=>f.row().sdk_usage_sha256='a'.repeat(64),f=>{f.row().projection.binding.runId=id(99);f.row().projection_sha256=hash(f.row().projection);}]){
  const f=await fixture();f.state.beforeUsage=()=>change(f);const r=await f.read();assert.notEqual(r.status,200);assert.doesNotMatch(await r.text(),/PRIVATE|model.alpha|sdkEstimate/);
 }
});
test('General owned run reads without an invented client and partial audit remains explicit',async()=>{
 const f=await fixture({general:true,input:payload({omitted:3})});f.state.principal.clientIds=[];const r=await f.read();assert.equal(r.status,200,await r.clone().text());const value=await r.json();assert.equal(value.toolAudit.omitted,3);assert.equal(value.toolAudit.partial,true);assert.equal(value.toolAudit.tools[1].durationMs,null);
});
