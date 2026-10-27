import test from 'node:test';import assert from 'node:assert/strict';
import {createRunIndexApplication} from '../http.mjs';import {projectRunRow} from '../projection.mjs';
import {createConversationHistoryService} from '../../history/service.mjs';
import {ProductError} from '../../../product-access/errors.mjs';
import {row,principal,request,id} from './fixture.mjs';
import {createRuntimeProductApplications} from '../../../../runtime/product-applications.mjs';
import {captureRuntimePorts} from '../../../../runtime/product-applications.mjs';
function fixture({runtime=false}={}){
 const entries=[projectRunRow(row(2),principal),projectRunRow(row(1,{general:true,usage:'absent'}),principal)],state={reads:0,membership:0,metadata:0,fenced:false,revoked:false,suppressed:new Set(),archived:new Set(),afterRead:null};
 const gate={async admit({credential}){if(credential!=='SYNTHETIC')throw new ProductError('UNAUTHENTICATED');return {principal,expiresAtMs:2000};},async recheck(){state.membership++;if(state.revoked)throw new ProductError('MEMBERSHIP_REVOKED');}};
 const currentness={async assertCurrent(){throw Error('existing metadata owner should provide ordinary currentness');}};
 const management={assertActiveBinding(){throw Error('read-only');},forRequest(){return {async metadata(conversationId){assert.equal(state.fenced,true);state.metadata++;if(state.revoked)throw new ProductError('ACCESS_DENIED');return {conversationId,clientId:conversationId===id(102)?principal.clientIds[0]:null,status:state.archived.has(conversationId)?'archived':'active'};}};}};
 const retention={async assertServable({subjectId}){if(state.suppressed.has(subjectId))throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});},async withRelease(subjects,release){state.fenced=true;try{return await release(undefined,v=>retention.assertServable(v));}finally{state.fenced=false;}}};
 const store={history:{async list(){throw Error('no conversation inventory');},async transcript(){throw Error('no transcript scan');}},runs:{async list(){state.reads++;state.afterRead?.();return {entries,nextCursor:null};},async detail({request:r}){state.reads++;state.afterRead?.();return entries.find(e=>e.summary.runId===r.runId);}}};
 const history=createConversationHistoryService({store,gate,retention}),limits={maxRequestMs:1000,maxRequestBytes:4096,maxResponseBytes:131072};
 const app=runtime?createRuntimeProductApplications({configuration:{sourceEnabled:false,limits:{requestMs:1000,requestBytes:4096},native:{maxResponseBytes:131072}},sessions:{},ports:captureRuntimePorts({conversationMembership:gate,conversationCurrentness:currentness,conversationManagement:management}),conversationStore:store,retention,now:()=>1000}):createRunIndexApplication({store,history,gate,currentness,management,retention,now:()=>1000,limits});
 const read=(route='list',body=request,credential='SYNTHETIC')=>app.handle(new Request('https://example.invalid/api/conversations/runs/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {state,read};
}
test('native authenticated public mount releases exact durable run index through current Core + retention fence',async()=>{
 for(const runtime of [false,true]){const f=fixture({runtime}),r=await f.read();assert.equal(r.status,200,await r.clone().text());const value=await r.json();assert.equal(value.runs.length,2);assert.equal(value.observedAt,'1970-01-01T00:00:01.000Z');assert.equal(f.state.metadata,2);assert.equal(f.state.membership,1);assert.equal(f.state.reads,1);assert.equal(r.headers.get('cache-control'),'no-store');}
});
test('archive and retention remove rows, final revocation withholds entire result, invalid selectors never reach the owner',async()=>{
 for(const key of ['archived','suppressed']){const f=fixture();f.state[key].add(id(102));const r=await f.read();assert.equal(r.status,200,await r.clone().text());assert.deepEqual((await r.json()).runs.map(v=>v.runId),[id(201)]);}
 const denied=fixture();denied.state.afterRead=()=>denied.state.revoked=true;const r=await denied.read();assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/runId|sdkEstimateUsd/);
 const f=fixture();assert.equal((await f.read('list',{...request,actorId:'forged'})).status,400);assert.equal((await f.read('list',request,'foreign')).status,401);assert.equal(f.state.reads,0);
});
test('detail remains an exact current read and never represents physical cancellation or execution authority',async()=>{
 const f=fixture(),r=await f.read('detail',{schemaVersion:'meri.run-detail/1',conversationId:id(101),runId:id(201)});assert.equal(r.status,200,await r.clone().text());const value=await r.json();assert.equal(value.run.runId,id(201));assert.equal(value.continuation.physicalStopVerified,false);assert.equal(value.run.usage.recording,'not-recorded');
});
