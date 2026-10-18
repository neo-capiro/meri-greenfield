/** Partial campaign-list adapter over synthetic HTTP; selector observations never grant client access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {nativeReadFailureCode} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';
import {GatewayDenied} from '../../../dispatch/operation-result.mjs';
import {createClientReferenceReader} from '../../../../runtime/native-authority/native-read-credentials/client-reference.mjs';
import {captureOutreachListClientReference,captureOutreachListClientSelection} from '../request-context.mjs';
import {storedCase,id,clientId} from './fixture.mjs';
const foreign='d1234567-b123-4c12-8d12-e123456789ab';
function namedCase(request={clientId:' Synthetic client ',status:'draft',limit:'2.9'}){
 return storedCase(id,{request,resolution:{reference:captureOutreachListClientReference(request),clientId}});
}
function perCall(f,capture=()=>{}){
 return f.handler({getCredentials:undefined,credentialsForCall:(operation,call)=>{capture({operation,call});return f.transport.getCredentials;}});
}

test('canonical reference capture admits names without manufacturing a selected client or expanding the partial boundary',()=>{
 for(const raw of [' Synthetic client ','Caf\u00e9 \u{1f33f} client','x'.repeat(79)+' \u{1f33f} remainder',clientId.toUpperCase()+' '.repeat(60)+'ignored']){
  const request={clientId:raw,status:' draft '},expected=raw.trim().slice(0,80).trim();
  assert.equal(captureOutreachListClientReference(request),expected);
  if(expected!==clientId.toUpperCase())assert.throws(()=>captureOutreachListClientSelection(request),{message:'UNAVAILABLE'});
 }
 for(const request of [{},{clientId:null},{clientId:''},{clientId:' '},{clientId:'Name',outreachId:null},{clientId:'Name',outreachId:''},{clientId:'Name',outreachId:clientId}])
  assert.throws(()=>captureOutreachListClientReference(request),{message:'UNAVAILABLE'});
 for(const request of [{clientId:3},{clientId:'Name',outreachId:{}},{clientId:'Name',tenantId:'other'}])
  assert.throws(()=>captureOutreachListClientReference(request),{message:'INVALID_ARGUMENTS'});
});

test('named selection accepts only the exact inert closed reference and lowercase UUID; UUID stays independent of an observation',()=>{
 const request={clientId:' Synthetic client '},resolution={reference:'Synthetic client',clientId};
 const out=captureOutreachListClientSelection(request,resolution);assert.deepEqual(out,resolution);assert.ok(Object.isFrozen(out));
 assert.deepEqual(captureOutreachListClientSelection({clientId:` ${clientId.toUpperCase()} `}),{reference:clientId.toUpperCase(),clientId});
 for(const value of [null,[],{reference:'Other',clientId},{reference:resolution.reference,clientId:clientId.toUpperCase()},
  {reference:resolution.reference,clientId:'not-uuid'},{reference:resolution.reference},{...resolution,authorized:true}])
  assert.throws(()=>captureOutreachListClientSelection(request,value),{message:'ACCESS_DENIED'});
 let effects=0;const getter={get reference(){effects++;return resolution.reference;},clientId};
 const proxy=new Proxy(resolution,{ownKeys(){effects++;return Object.keys(resolution);}});
 for(const value of [getter,proxy])assert.throws(()=>captureOutreachListClientSelection(request,value),{message:'ACCESS_DENIED'});
 for(const value of [{get clientId(){effects++;return resolution.reference;}},new Proxy(request,{ownKeys(){effects++;return ['clientId'];}})])
  assert.throws(()=>captureOutreachListClientReference(value),{message:'INVALID_ARGUMENTS'});
 assert.equal(effects,0);
});

test('named campaign list needs per-call credentials and rewrites only the domain client while private proof stays raw',async()=>{
 const f=namedCase(),call=f.call();let captured;
 await assert.rejects(f.handler()(call),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 const out=JSON.parse(await perCall(f,value=>captured=value)(call)),[proof]=f.credentialCalls;
 assert.equal(captured.call,call);assert.deepEqual(captured.operation,f.operation);
 assert.deepEqual(f.wire[0].body,{...f.arguments,clientId});assert.equal(f.wire[0].url,'https://native-core.example.invalid/api/clio/tools/query_outreach');
 assert.equal(proof.requestSha256,hash(f.arguments));assert.notEqual(proof.requestSha256,hash(f.wire[0].body));
 assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,f.normalizationContext);
 assert.equal(f.arguments.clientId,' Synthetic client ');assert.equal(call.request,f.arguments);
 assert.deepEqual(out,{binding:f.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(Object.hasOwn(out.result,'clientResolution'),false);assert.equal(Object.hasOwn(out.result,'complete'),false);
});

test('named clipping and Unicode use the canonical reference while every other raw selector is retained',async()=>{
 for(const clientId of ['  Caf\u00e9 \u{1f33f} Client  ','Long client '.repeat(12),'x'.repeat(79)+' \u{1f33f} remainder']){
  const request={clientId,status:' draft ',limit:'2.9'},f=namedCase(request);
  assert.equal(f.normalizationContext.clientResolution.reference,clientId.trim().slice(0,80).trim());
  await perCall(f)(f.call());assert.deepEqual(f.wire[0].body,{...request,clientId:f.normalizationContext.clientResolution.clientId});
  assert.equal(f.wire[0].body.status,' draft ');assert.equal(f.wire[0].body.limit,'2.9');
 }
});

test('named and UUID calls cannot combine a static credential fallback with a per-call port',()=>{
 const f=namedCase();assert.throws(()=>f.handler({credentialsForCall:()=>f.transport.getCredentials}),{message:'GATEWAY_CONFIGURATION'});
 const g=storedCase();assert.throws(()=>g.handler({credentialsForCall:()=>g.transport.getCredentials}),{message:'GATEWAY_CONFIGURATION'});
 assert.equal(f.credentialCalls.length,0);assert.equal(g.credentialCalls.length,0);
});

test('foreign selection, personal/multiple-client subjects and missing client resources refuse before credentials or campaign reads',async()=>{
 for(const mode of ['foreign-selection','foreign-subject','personal','resource','multiple','missing-source']){
  const f=namedCase(),call=structuredClone(f.call()),a=call.authority;
  if(mode==='foreign-selection'){
   call.normalizationContext.clientResolution.clientId=foreign;
   const normalized=f.contract.normalizeInput(call.request,call.normalizationContext);call.input=normalized.input;call.argumentsSha256=normalized.argumentsSha256;
  }
  if(mode==='foreign-subject')a.subject.entityIds=[foreign];
  if(mode==='personal')Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId]});
  if(mode==='resource')for(const scopes of [a.subject.scopes,a.claims.scopes,a.decision.scopes])scopes[0].resourceId=foreign;
  if(mode==='multiple')a.subject.entityIds.push(foreign);
  if(mode==='missing-source')a.sourceIds=[];
  // The existing canonical subject schema rejects a multi-ID client subject before this adapter.
  await assert.rejects(perCall(f)(call),{message:mode==='multiple'?'INTERNAL_ERROR':'ACCESS_DENIED'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('raw/client context substitution and per-call credential proof drift never reach the campaign endpoint',async()=>{
 const f=namedCase(),call=f.call();for(const changes of [
  {request:{...f.arguments,clientId:'Another client'}},
  {normalizationContext:{clientResolution:{reference:'Other',clientId}}},
  {normalizationContext:{...f.normalizationContext,authorized:true}},
  {input:{...call.input,clientId:foreign}},{argumentsSha256:'0'.repeat(64)},
 ])await assert.rejects(perCall(f)({...call,...changes}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 const g=namedCase();g.state.credentialMutator=proof=>proof.requestSha256=hash({...g.arguments,clientId});
 await assert.rejects(perCall(g)(g.call()),{message:'ACCESS_DENIED'});assert.equal(g.wire.length,0);
});

// This composed source test exercises the actual bounded check-ref decoder, not a second permission owner.
// Root's separate current-task/member owner supplies and rechecks the production per-call port.
function resolverPort(f,{result={ok:true,clientId},available=true,status=201}={}){
 // Gateway's base fixture uses readable non-UUID identity placeholders; native identity receipts require UUIDs.
 const calls=[],principal={tenantId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actorId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
 Object.assign(f.binding,principal);Object.assign(f.authority.subject,principal);Object.assign(f.authority.decision.actor,principal);
 for(const scopes of [f.authority.subject.scopes,f.authority.claims.scopes,f.authority.decision.scopes])for(const scope of scopes)scope.tenantId=principal.tenantId;
 const reader=createClientReferenceReader({available,origin:f.transport.origin,now:f.now,maxRequestMs:1000,
  authorityClient:{async readIdentity(){calls.push('identity');return {principal,identityRevision:'a'.repeat(64),checkedAtMs:f.now(),expiresAtMs:f.now()+1000};}},
  async fetchImpl(url,init){calls.push({url,init,body:JSON.parse(init.body)});return Response.json(result,{status});}});
 const execute=f.handler({getCredentials:undefined,credentialsForCall:(operation,original)=>async proof=>{
  let observed;try{observed=await reader({credential:'SYNTHETIC_NATIVE_USER',reference:captureOutreachListClientReference(original.request),deadlineMs:proof.deadlineMs,signal:proof.signal});}
  catch(error){throw new GatewayDenied(nativeReadFailureCode(error)??'UNAVAILABLE');}
  assert.deepEqual(operation,f.operation);assert.equal(observed.clientId,proof.normalizationContext.clientResolution.clientId);
  return f.transport.getCredentials(proof);
 }});
 return {calls,execute};
}

test('existing check-ref accepts Nest201 and passes the exact captured name before campaign UUID projection',async()=>{
 const f=namedCase({clientId:'  Caf\u00e9 \u{1f33f} client  ',status:'draft'}),r=resolverPort(f);
 const out=JSON.parse(await r.execute(f.call()));assert.deepEqual(out.result,f.page);
 assert.equal(r.calls[0],'identity');assert.equal(r.calls[2],'identity');assert.equal(r.calls.length,3);
 assert.equal(r.calls[1].url,f.transport.origin+'/api/clio/clients/check-ref');assert.deepEqual(r.calls[1].body,{ref:'Caf\u00e9 \u{1f33f} client'});
 assert.equal(r.calls[1].init.credentials,'omit');assert.equal(r.calls[1].init.redirect,'error');assert.equal(r.calls[1].init.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');
 assert.deepEqual(f.wire[0].body,{...f.arguments,clientId});assert.equal(f.credentialCalls[0].requestSha256,hash(f.arguments));
});

for(const reason of ['PRIVATE ambiguous client','PRIVATE no matching client'])test(`native false remains opaque UNAVAILABLE: ${reason.includes('ambiguous')?'ambiguous':'missing'}`,async()=>{
 const f=namedCase(),r=resolverPort(f,{result:{ok:false,reason}});
 await assert.rejects(r.execute(f.call()),{message:'UNAVAILABLE'});assert.equal(r.calls.length,2);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('absent reference reader and native HTTP failures cannot borrow static campaign credentials',async()=>{
 for(const options of [{available:false},{status:403}]){
  const f=namedCase(),r=resolverPort(f,options);await assert.rejects(r.execute(f.call()),{message:'UNAVAILABLE'});
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);if(options.available===false)assert.equal(r.calls.length,0);
 }
});

test('malformed closed native resolver results never become a campaign lookup or successful empty list',async()=>{
 for(const result of [{ok:true,clientId:'not-uuid'},{ok:true,clientId:clientId.toUpperCase()},
  {ok:true,clientId,authorized:true},{ok:false,reason:'PRIVATE',clientId},{ok:false,reason:null},{ok:'true',clientId}]){
  const f=namedCase(),r=resolverPort(f,{result});await assert.rejects(r.execute(f.call()));
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);assert.equal(r.calls.length,2);
 }
});

test('explicit UUID projects the exact selected client with either credential composition and no name observation',async()=>{
 const request={clientId:` ${clientId.toUpperCase()} `,status:'draft'},f=storedCase(id,{request});
 await f.handler()(f.call());await perCall(f)(f.call());assert.equal(f.wire.length,2);
 for(const call of f.wire)assert.deepEqual(call.body,{...request,clientId});
 for(const proof of f.credentialCalls)assert.equal(proof.requestSha256,hash(request));
});

test('named receiving keeps client/status/count barriers and cancellation/deadline/resource limits',async()=>{
 for(const mutate of [p=>p.campaigns[0].clientId=foreign,p=>p.campaigns[0].status='sent',p=>p.total=2,p=>p.campaigns[0].client={id:clientId}]){
  const f=namedCase();f.state.resultMutator=mutate;await assert.rejects(perCall(f)(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
 }
 const f=namedCase();await assert.rejects(perCall(f)({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.credentialCalls.length,0);
 const g=namedCase(),abort=new AbortController();g.state.afterSource=()=>abort.abort();await assert.rejects(perCall(g)({...g.call(),signal:abort.signal}),{message:'CANCELLED'});
 const h=namedCase();h.state.afterSource=()=>h.state.now=h.authority.deadlineMs;await assert.rejects(perCall(h)(h.call()),{message:'DEADLINE'});
 const j=namedCase();await assert.rejects(j.handler({getCredentials:undefined,credentialsForCall:()=>j.transport.getCredentials,maxResponseBytes:8})(j.call()),{message:'RESOURCE_LIMIT'});
});
