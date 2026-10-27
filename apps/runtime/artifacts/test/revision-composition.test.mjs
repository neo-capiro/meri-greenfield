/** Production run owner over real action-session/artifact owners; scripted persistence and bytes only. */
import {randomUUID} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {nativeDocumentFixture} from '../../../artifacts/test/native-document-fixture.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createDocumentRevisionRunOwner} from '../revision-composition.mjs';
const clientId='33333333-3333-4333-8333-000000000090';
async function fixture(t){
 const f=nativeDocumentFixture({scopes:[{tenantId:'synthetic-tenant',kind:'client',resourceId:clientId,policyRevision:'r1'}]}),first=await f.run(),binding=f.context.binding,now=f.options.now;
 const state={denied:false,reads:0,phases:[],release:null},expiry=now()+30000;
 const sessions=createActionSessionOwner({mode:'process-local',now,refusals:()=>{},limits:{maxSessions:8,maxRequestMs:5000,maxTtlMs:30000,maxFactBytes:131072},
  async verifyIdentity(){if(state.denied)throw Error('DENIED');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'current',checkedAtMs:now(),expiresAtMs:expiry};},
  async resolveContext({identity}){return {identitySha256:hash(identity),binding,scopes:f.context.scopes,selectedClientId:clientId,contextRevision:'current',checkedAtMs:now(),expiresAtMs:expiry};}});t.after(()=>sessions.close());
 const session=await sessions.issue({identityCredential:'synthetic-native',hints:{conversationId:binding.conversationId,runId:binding.runId,clientId}});
 const selection={artifactId:first.version.artifactId,versionId:first.version.versionId,objectSha256:first.version.object.sha256};
 state.saved={run:{binding,scopes:f.context.scopes},request:{requestId:'33333333-3333-4333-8333-000000000800',prompt:'Revise',skill:null,window:null,windowRequest:null,documentRevision:selection}};
 const store={async read(_binding,_query,check){state.reads++;check();return structuredClone(state.saved);}},limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 const optionsOwner={async resolve(call){assert.equal(call.credential,session.credential);assert.equal(call.intent,'inspect');return {documentOptions:{sessions,selectedClientId:clientId,artifactOptions:{...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},now,limits,enabled:true},async recheck({phase}){state.phases.push(phase);if(phase==='release')await state.release?.();}};}};
 const owner=createDocumentRevisionRunOwner({bound:()=>({sessions,store}),optionsOwner,now,limits}),call={binding,selection,deadlineMs:expiry};
 return {f,state,sessions,session,selection,owner,call};
}
test('stored selection reads the original spec through the existing session and current document owner without another session or write',async t=>{
 const h=await fixture(t);assert.deepEqual(await h.owner.selectionFor(h.call),h.selection);const before=h.sessions.status().sessions,executions=h.f.state.executions.length;
 const result=await h.owner.read(h.call);assert.deepEqual(result,{selection:h.selection,request:h.f.call.request,specSha256:hash(h.f.call.request)});assert.deepEqual(h.state.phases,['admission','release']);assert.equal(h.sessions.status().sessions,before);assert.equal(h.f.state.executions.length,executions);
});
test('ordinary stored input is selector-free; changed binding/selection/skill and mixed source scopes refuse before artifact resolution',async t=>{
 const h=await fixture(t);delete h.state.saved.request.documentRevision;assert.equal(await h.owner.selectionFor(h.call),null);await assert.rejects(h.owner.read(h.call),{code:'ACCESS_DENIED'});
 h.state.saved.request.documentRevision=h.selection;
 for(const mutate of [()=>h.state.saved.run.binding={...h.call.binding,writerFence:2},()=>h.state.saved.request.documentRevision={...h.selection,objectSha256:'f'.repeat(64)},()=>h.state.saved.request.skill={skillId:'quick_skill.commitments_audit'},()=>h.state.saved.run.scopes.push({...h.state.saved.run.scopes[0],kind:'private-user',resourceId:h.call.binding.actorId})]){
  const saved=structuredClone(h.state.saved);mutate();await assert.rejects(h.owner.read(h.call),{code:'ACCESS_DENIED'});h.state.saved=saved;
 }assert.deepEqual(h.state.phases,[]);
});
test('missing original action session and release-time revocation withhold source',async t=>{
 const absent=await fixture(t);absent.sessions.revoke(absent.session.credential);await assert.rejects(absent.owner.read(absent.call),{code:'SESSION_UNAVAILABLE'});assert.deepEqual(absent.state.phases,[]);
 const denied=await fixture(t);denied.state.release=()=>{denied.state.denied=true;};await assert.rejects(denied.owner.read(denied.call));assert.deepEqual(denied.state.phases,['admission','release']);assert.equal(denied.f.state.executions.length,1);
});
