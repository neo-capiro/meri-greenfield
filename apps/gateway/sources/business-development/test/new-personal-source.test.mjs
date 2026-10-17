/** Personal source mechanics only. Actual inline Core conversation/prospect authorization is not simulated as a receipt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {captureBusinessDevelopmentResource} from '../request-context.mjs';
import {createBusinessDevelopmentHandlers} from '../handler.mjs';
import {storedCase,ids,clientId,conversationId} from './fixture.mjs';
const otherClient='e1234567-b123-4c12-8d12-e123456789ab';
function scopesFor(call,items){
 const a=call.authority,scopes=items.map(([kind,resourceId])=>({tenantId:a.subject.tenantId,policyRevision:a.policyRevision,kind,resourceId}));
 a.subject.scopes=scopes;a.claims.scopes=scopes;a.decision.scopes=scopes;
}

for(const id of ids)test(`${id}: personal uses exact native POST and current call credentials with no conversation receipt`,async()=>{
 const request={conversationId:conversationId.toUpperCase(),...(id===ids[1]?{limit:2}:{})},f=storedCase(id,{personal:true,request}),call=f.call();
 assert.deepEqual(captureBusinessDevelopmentResource(f.operation,request,f.authority.subject),{conversationId,clientId:null});
 assert.equal(Object.hasOwn(f,'nativeConversation'),false);assert.deepEqual(f.visibleClientIds,[]);
 const out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.equal(f.wire.length,1);assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,request);
 assert.notEqual(request.conversationId.toLowerCase(),f.authority.binding.conversationId);assert.equal(proof.requestSha256,canonicalSha256(request));assert.deepEqual(proof.normalizationContext,{});
 assert.equal(f.state.credentialOwnerCalls[0].call,call);assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 for(const key of ['nativeConversation','contextRevision','resourceRevision','identitySha256','prospectId'])assert.equal(Object.hasOwn(proof,key),false);
});

test('personal accepts only exact tenant and actor-private scopes, individually or combined',async()=>{
 for(const mode of ['tenant','private-user','both']){
  const f=storedCase(ids[0],{personal:true}),call=structuredClone(f.call()),a=call.authority;
  scopesFor(call,mode==='both'?[['tenant',a.binding.tenantId],['private-user',a.binding.actorId]]:mode==='tenant'?[['tenant',a.binding.tenantId]]:[['private-user',a.binding.actorId]]);
  assert.deepEqual(captureBusinessDevelopmentResource(f.operation,f.arguments,a.subject),{conversationId,clientId:null});
  assert.ok(Object.isFrozen(captureBusinessDevelopmentResource(f.operation,f.arguments,a.subject)));
  await f.handler()(call);assert.equal(f.wire.length,1);assert.equal(f.credentialCalls.length,1);
 }
});

test('personal cannot borrow client, mailbox, public, memory, document, foreign or empty scope authority',async()=>{
 for(const mode of ['client','mailbox','public','memory','document','foreign-tenant-resource','foreign-private-user','mixed-client','mixed-mailbox','empty']){
  const f=storedCase(ids[0],{personal:true}),call=structuredClone(f.call()),a=call.authority;
  const items=mode==='empty'?[]:mode==='foreign-tenant-resource'?[['tenant','another-tenant']]:mode==='foreign-private-user'?[['private-user','another-actor']]:
   mode==='mixed-client'?[['tenant',a.binding.tenantId],['client',clientId]]:mode==='mixed-mailbox'?[['private-user',a.binding.actorId],['mailbox',a.binding.actorId]]:[[mode,clientId]];
  scopesFor(call,items);assert.throws(()=>captureBusinessDevelopmentResource(f.operation,f.arguments,a.subject),{message:'ACCESS_DENIED'});
  await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.state.credentialOwnerCalls,undefined);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('personal cannot change canonical actor identity, widen to portfolio or downgrade a client capability',async()=>{
 for(const mode of ['foreign-user','wrong-entity-type','multiple-users','portfolio','client-capability']){
  const f=storedCase(ids[0],{personal:mode!=='client-capability'}),call=structuredClone(f.call()),a=call.authority;
  if(mode==='foreign-user')a.subject.entityIds=['other-actor'];
  if(mode==='wrong-entity-type')a.subject.entityType='client';
  if(mode==='multiple-users')a.subject.entityIds.push('other-actor');
  if(mode==='portfolio')Object.assign(a.subject,{kind:'portfolio',entityType:'client',entityIds:[clientId],rosterVersionId:conversationId});
  if(mode==='client-capability'){
   Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],scopes:[{tenantId:a.binding.tenantId,policyRevision:a.policyRevision,kind:'tenant',resourceId:a.binding.tenantId}]});
   a.decision.scopes=a.subject.scopes; // The original client capability remains unchanged and cannot cover this subject.
  }
  await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.state.credentialOwnerCalls,undefined);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('personal subject binding must still match the retained native call before any credential I/O',async()=>{
 const f=storedCase(ids[0],{personal:true}),call=structuredClone(f.call());
 call.authority.subject.actorId='different-actor';call.authority.subject.entityIds=['different-actor'];
 await assert.rejects(f.handler()(call));assert.equal(f.state.credentialOwnerCalls,undefined);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('personal context preserves null or nonnull native linked identities without reading a client profile',async()=>{
 for(const linkedClientId of [null,clientId,otherClient,clientId.toUpperCase()]){
  const f=storedCase(ids[0],{personal:true});f.state.resultMutator=p=>p.prospect.linkedClientId=linkedClientId;
  const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.prospect.linkedClientId,linkedClientId);assert.deepEqual(f.visibleClientIds,[]);
  assert.equal(Object.hasOwn(out.result.prospect,'client'),false);assert.equal(Object.hasOwn(out.result,'evidence'),false);
 }
});

test('personal retains complete DTO admission and preserves recent inference and pagination truth',async()=>{
 const f=storedCase(ids[1],{personal:true}),out=JSON.parse(await f.handler()(f.call()));
 assert.equal(out.result.alerts.returned,1);assert.equal(out.result.alerts.unreadCount,3);assert.equal(out.result.alerts.truncated,true);assert.equal(out.result.alerts.items[0].implication.inference,true);
 for(const id of ids){const g=storedCase(id,{personal:true});g.state.resultMutator=p=>p.clientProfile={private:true};await assert.rejects(g.handler()(g.call()),{message:'INVALID_RESULT'});}
 const h=storedCase(ids[0],{personal:true});h.state.resultMutator=p=>delete p.prospect.linkedClientId;await assert.rejects(h.handler()(h.call()),{message:'INVALID_RESULT'});
});

test('personal still requires the current credential owner and refuses static fallback, revocation and proof drift',async()=>{
 for(const id of ids){
  const f=storedCase(id,{personal:true}),{credentialsForCall,...transport}=f.transport;
  const [handler]=createBusinessDevelopmentHandlers({...transport,now:f.now,getCredentials:()=>{throw Error('STATIC_FALLBACK');}},[f.operation]);
  await assert.rejects(handler.execute(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
  const g=storedCase(id,{personal:true});g.state.resourceDenied=true;await assert.rejects(g.handler()(g.call()),{message:'ACCESS_DENIED'});assert.equal(g.credentialCalls.length,0);assert.equal(g.wire.length,0);
  const h=storedCase(id,{personal:true});h.state.credentialMutator=p=>p.subject.actorId='different-actor';await assert.rejects(h.handler()(h.call()),{message:'ACCESS_DENIED'});assert.equal(h.wire.length,0);
 }
});

test('personal preserves cancellation, original expiry and whole-result resource ceilings',async()=>{
 const f=storedCase(ids[0],{personal:true}),cancelled=new AbortController();cancelled.abort();await assert.rejects(f.handler()({...f.call(),signal:cancelled.signal}),{message:'CANCELLED'});assert.equal(f.credentialCalls.length,0);
 const g=storedCase(ids[0],{personal:true}),controller=new AbortController();g.state.afterSource=()=>controller.abort();await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
 const h=storedCase(ids[1],{personal:true});h.state.afterSource=()=>h.state.now=h.authority.deadlineMs;await assert.rejects(h.handler()(h.call()),{message:'DEADLINE'});
 const j=storedCase(ids[0],{personal:true});await assert.rejects(j.handler({maxResponseBytes:16})(j.call()),{message:'RESOURCE_LIMIT'});
});
