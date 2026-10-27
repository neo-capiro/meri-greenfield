/** Real runtime/document/current-session/artifact owners; scripted identity, SQL and bytes only. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {nativeDocumentFixture} from '../../../artifacts/test/native-document-fixture.mjs';
import {createRuntimeDocumentRevisionSource} from '../revision-source.mjs';
import {createRuntimeDocumentIntentPreparers} from '../intent-preparers.mjs';
async function fixture(){
 const f=nativeDocumentFixture({scopes:[{tenantId:'synthetic-tenant',kind:'client',resourceId:'33333333-3333-4333-8333-000000000090',policyRevision:'r1'}]}),first=await f.run(),binding=f.context.binding,now=f.options.now;
 const selectedClientId=f.context.scopes[0].resourceId,credential='action_session_'+'a'.repeat(43),expiry=now()+30000;
 const state={denied:false,resolved:[],phases:[],release:null};
 const sessions={async authenticateSession(){if(state.denied)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});return {principal:{sessionId:'synthetic-session',tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},sessionRevision:'synthetic-current',checkedAtMs:now(),expiresAtMs:expiry};},
  async readCurrentState({authentication}){return {authenticationSha256:hash(authentication),binding,scopes:f.context.scopes,selectedClientId,checkedAtMs:now(),expiresAtMs:expiry};}};
 const limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 const optionsOwner={async resolve(call){state.resolved.push(call);return {documentOptions:{sessions,selectedClientId,artifactOptions:{...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},now,limits,enabled:true},
  async recheck({phase}){state.phases.push(phase);if(phase==='release')await state.release?.();if(state.denied)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};}};
 const selection={artifactId:first.version.artifactId,versionId:first.version.versionId,objectSha256:first.version.object.sha256};
 const config={sessions,optionsOwner,now,limits},reader=createRuntimeDocumentRevisionSource(config),call={credential,selection,deadlineMs:expiry};
 const runtime=()=>createRuntimeDocumentIntentPreparers({...config,binding,selectedClientId,revision:selection,
  nativeCredentials:{nativeCredentialFor(){return {credential:'synthetic-native',expiresAtMs:expiry};}},
  async borrowSession(){return {credential,expiresAtMs:expiry,context:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,selectedClientId}};}});
 return {f,first,state,reader,call,selection,runtime};
}
test('trusted source reader uses inspect authority and exact immutable source with admission/release and no write',async()=>{
 const h=await fixture(),before=h.f.state.executions.length;const result=await h.reader.read(h.call);
 assert.deepEqual(result.request,h.f.call.request);assert.equal(result.specSha256,hash(h.f.call.request));assert.equal(result.headVersionId,h.first.version.versionId);
 assert.deepEqual(h.state.phases,['admission','release']);assert.equal(h.state.resolved[0].intent,'inspect');assert.equal(h.f.state.executions.length,before);
});
test('runtime replacement calls revise with exact parent through the existing application, never create',async()=>{
 const h=await fixture(),word=h.runtime().find(p=>p.operation.id==='create_word'),result=await word.prepare({deliveryId:'sdk:'+'d'.repeat(64),arguments:{...h.f.call.request,content:{text:'Replacement\n'}}});
 assert.equal(result.version.parentVersionId,h.first.version.versionId);assert.equal(result.version.artifactId,h.first.version.artifactId);assert.deepEqual(h.state.resolved.map(x=>x.intent),['inspect','revise']);
 assert.equal(h.state.resolved[1].body.baseVersionId,h.first.version.versionId);assert.equal(h.f.state.executions.length,2);
});
test('runtime current-source revocation and a stale parent stop before any revision route',async()=>{
 const denied=await fixture();denied.state.release=()=>{denied.state.denied=true;};await assert.rejects(denied.runtime().find(p=>p.operation.id==='create_word').prepare({deliveryId:'sdk:'+'e'.repeat(64),arguments:denied.f.call.request}),{code:'ACCESS_DENIED',effect:'none'});assert.deepEqual(denied.state.resolved.map(x=>x.intent),['inspect']);assert.equal(denied.f.state.executions.length,1);
 const stale=await fixture();await stale.f.run({...stale.f.call,deliveryId:'other',baseVersionId:stale.selection.versionId});await assert.rejects(stale.runtime().find(p=>p.operation.id==='create_word').prepare({deliveryId:'sdk:'+'f'.repeat(64),arguments:stale.f.call.request}),{code:'CONFLICT',effect:'none'});assert.deepEqual(stale.state.resolved.map(x=>x.intent),['inspect']);assert.equal(stale.f.state.executions.length,2);
});
test('private source does not release a substituted selected object or after release-time revocation',async()=>{
 const wrong=await fixture();await assert.rejects(wrong.reader.read({...wrong.call,selection:{...wrong.selection,objectSha256:'f'.repeat(64)}}),{code:'ACCESS_DENIED'});
 const denied=await fixture();denied.state.release=()=>{denied.state.denied=true;};await assert.rejects(denied.reader.read(denied.call),{code:'ACCESS_DENIED'});
});
