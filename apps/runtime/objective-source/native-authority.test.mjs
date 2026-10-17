/** The real native authority HTTP/context factories compose here. Synthetic
 * credentials and native HTTP replies are fixture-only; no live authority is
 * claimed and no network, database, task or issuer is invoked. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationAuthorityRoutes} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {id} from '../../../packages/contracts/strategy-operations-candidate/fixture-source.mjs';
import {objectiveProtectedFactsFixture} from './test/protected-facts-fixture.mjs';
import {createObjectiveSourceNativeAuthority} from './native-authority.mjs';

const SYNTHETIC_CREDENTIAL='SYNTHETIC_OBJECTIVE_NATIVE_IDENTITY_ONLY';
const unavailable={code:'OBJECTIVE_SOURCE_UNAVAILABLE',message:'OBJECTIVE_SOURCE_UNAVAILABLE'};

function fixture(){
 const f=objectiveProtectedFactsFixture(),pair=f.compile(),accepted=structuredClone(f.options.accepted);
 const source={generationJobId:f.raw.request.jobId,sourceAdmissionSha256:pair.objectiveGeneration.sourceAdmissionSha256,binding:accepted.run.binding};
 const state={now:f.options.nowMs,accepted,rows:0,fetches:0,identityReads:0,contextReads:0,identityRevision:'synthetic-native-identity-r1',contextRevision:'synthetic-native-context-r1',nativeWindowMs:5000,requests:[]};
 const acceptedRuns={async read(binding,options,check){state.rows++;assert.deepEqual(binding,source.binding);assert.deepEqual(options,{});check();await state.onRow?.(state);check();return structuredClone(state.accepted);}};
 const identity={origin:'https://objective-native.synthetic.invalid',credential:SYNTHETIC_CREDENTIAL,
  commandContext:{binding:source.binding,clientResolution:{reference:f.raw.request.principal.clientId,clientId:f.raw.request.principal.clientId}},
  async fetchImpl(url,options){
   state.fetches++;assert.equal(options.headers.authorization,'Bearer '+SYNTHETIC_CREDENTIAL);assert.equal(options.method,'POST');assert.equal(options.redirect,'error');
   const body=JSON.parse(options.body);state.requests.push({url,body});const principal={tenantId:source.binding.tenantId,actorId:source.binding.actorId};let result;
   if(url.endsWith(applicationAuthorityRoutes.identity)){state.identityReads++;await state.onIdentity?.(state);result={principal,identityRevision:state.identityRevision,checkedAtMs:state.now,expiresAtMs:state.now+state.nativeWindowMs};}
   else{
    assert.ok(url.endsWith(applicationAuthorityRoutes.context));state.contextReads++;await state.onContext?.(state);
    result={identitySha256:body.identitySha256,principal,identityRevision:state.identityRevision,conversationId:source.binding.conversationId,selectedClientId:identity.commandContext.clientResolution.clientId,
     contextRevision:state.contextRevision,checkedAtMs:state.now,expiresAtMs:state.now+state.nativeWindowMs};
   }
   if(state.changeResponse)result=state.changeResponse(result,state);return Response.json(result);
  }};
 const configuration={source,acceptedRuns,identity,enabled:true,now:()=>state.now,maxRequestMs:1000,maxFactBytes:131072};
 const create=(options={})=>createObjectiveSourceNativeAuthority({...configuration,...options});
 return {f,source,state,configuration,create,call:(purpose='active-source')=>({purpose,source})};
}

test('actual native identity/context factories recheck one fixed canonical source and selected client',async()=>{
 const f=fixture(),owner=f.create();assert.equal(owner.available(),true);
 const result=await owner.assertCurrent(f.call());
 assert.deepEqual(result,{binding:f.source.binding,clientId:f.f.raw.request.principal.clientId,checkedAtMs:f.state.now,expiresAtMs:f.state.now+1000});
 assert.equal(f.state.identityReads,2);assert.equal(f.state.contextReads,2);assert.ok(f.state.rows>=6);
 assert.ok(Object.isFrozen(result.binding));assert.ok(!JSON.stringify(result).includes(SYNTHETIC_CREDENTIAL));
 for(const request of f.state.requests.filter(r=>r.url.endsWith(applicationAuthorityRoutes.context))){
  assert.deepEqual(Object.keys(request.body).sort(),['clientId','conversationId','identitySha256']);
  assert.equal(request.body.clientId,result.clientId);assert.equal(request.body.conversationId,f.source.binding.conversationId);
 }
});

test('default disabled factory is inert before nested configuration, clock or owner inspection',async()=>{
 let effects=0;const identity=Object.defineProperty({},'origin',{enumerable:true,get(){effects++;throw Error('must remain inert');}});
 const owner=createObjectiveSourceNativeAuthority({identity,acceptedRuns:{get read(){effects++;throw Error('must remain inert');}},now(){effects++;return Date.now();}});
 assert.equal(owner.available(),false);await assert.rejects(owner.assertCurrent({}),unavailable);assert.equal(effects,0);
 const empty=createObjectiveSourceNativeAuthority();assert.equal(empty.available(),false);await assert.rejects(empty.assertCurrent({}),unavailable);
});

test('native read expiry is bounded by fresh native authority and not substituted original execution expiry',async()=>{
 const f=fixture();f.state.nativeWindowMs=250;const owner=f.create();
 const result=await owner.assertCurrent(f.call());assert.equal(result.expiresAtMs,f.state.now+250);assert.notEqual(result.expiresAtMs,f.f.options.issuance.expiresAtMs);
});

test('historical authority rechecks current membership after original execution expired without renewing it',async()=>{
 const f=fixture();f.state.accepted.run.state='completed';f.state.now=f.f.options.issuance.expiresAtMs+100000;
 const owner=f.create(),result=await owner.assertCurrent(f.call('historical-source'));
 assert.equal(result.checkedAtMs,f.state.now);assert.equal(result.expiresAtMs,f.state.now+1000);assert.ok(result.checkedAtMs>f.f.options.issuance.expiresAtMs);
 assert.deepEqual(Object.keys(result).sort(),['binding','checkedAtMs','clientId','expiresAtMs']);
 assert.equal(f.f.options.issuance.expiresAtMs,f.f.preparedFacts.original.expiresAtMs);
 await assert.rejects(owner.assertCurrent(f.call()),unavailable);
});

for(const purpose of ['historical-source','retained-result'])test(purpose+' rejects an active run before native reads',async()=>{
 const f=fixture();await assert.rejects(f.create().assertCurrent(f.call(purpose)),unavailable);assert.equal(f.state.fetches,0);
});

test('retained-result authority permits completed only; historical permits failed and cancelled',async()=>{
 for(const state of ['failed','cancelled','completed']){
  const f=fixture();f.state.accepted.run.state=state;const owner=f.create();assert.equal((await owner.assertCurrent(f.call('historical-source'))).clientId,f.f.raw.request.principal.clientId);
  if(state==='completed')assert.equal((await owner.assertCurrent(f.call('retained-result'))).clientId,f.f.raw.request.principal.clientId);
  else await assert.rejects(owner.assertCurrent(f.call('retained-result')),unavailable);
 }
});

for(const [name,mutate] of Object.entries({jobId:v=>{v.source.generationJobId=id(999);},admission:v=>{v.source.sourceAdmissionSha256='f'.repeat(64);},
 worker:v=>{v.source.binding.workerId=id(999);},purpose:v=>{v.purpose='caller-select-run';},extraBinding:v=>{v.binding=v.source.binding;},extraSource:v=>{v.source.clientId=id(999);}})){
 test('caller '+name+' cannot select another source or establish authority',async()=>{
  const f=fixture(),owner=f.create(),call=structuredClone(f.call());mutate(call);await assert.rejects(owner.assertCurrent(call),unavailable);
  assert.equal(f.state.rows,0);assert.equal(f.state.fetches,0);
 });
}

test('fixed source and command context are copied before late caller mutations',async()=>{
 const f=fixture(),call=structuredClone(f.call()),owner=f.create();f.configuration.source.generationJobId=id(999);f.configuration.identity.commandContext.clientResolution.clientId=id(998);
 // Fixture native authority must retain its original selected client too.
 f.state.changeResponse=result=>result.selectedClientId?{...result,selectedClientId:f.f.raw.request.principal.clientId}:result;
 assert.equal((await owner.assertCurrent(call)).clientId,f.f.raw.request.principal.clientId);
});

for(const [name,mutate] of Object.entries({identityActor:r=>{if(!r.selectedClientId)r.principal.actorId='foreign';},selectedClient:r=>{if(r.selectedClientId)r.selectedClientId=id(999);},
 identityRevision:r=>{if(r.selectedClientId)r.identityRevision='other-revision';},expired:r=>{r.expiresAtMs=r.checkedAtMs;},future:r=>{r.checkedAtMs++;},
 extraSecret:r=>{r.proxyCredential='synthetic-forbidden';}}))test('canonical native bridge refuses '+name+' response',async()=>{
 const f=fixture();f.state.changeResponse=result=>{mutate(result);return result;};await assert.rejects(f.create().assertCurrent(f.call()),unavailable);
});

test('late native revocation/revision changes cannot release fresh authority',async()=>{
 for(const change of ['identity','context','denial']){
  const f=fixture();f.state.onIdentity=state=>{if(state.identityReads===2){if(change==='identity')state.identityRevision='new-identity-revision';if(change==='denial')throw Error('synthetic-native-secret');}};
  f.state.onContext=state=>{if(state.contextReads===2&&change==='context')state.contextRevision='new-context-revision';};
  await assert.rejects(f.create().assertCurrent(f.call()),unavailable);
 }
});

test('transient backward clock during identity reply is refused even when restored before final reads',async()=>{
 const f=fixture();let pulse=false,observed=false;
 f.state.changeResponse=result=>{if(!result.selectedClientId&&!observed)pulse=true;return result;};
 const owner=f.create({now(){if(pulse){pulse=false;observed=true;return f.state.now-1;}return f.state.now;}});
 await assert.rejects(owner.assertCurrent(f.call()),unavailable);assert.equal(observed,true);
 assert.equal(f.state.identityReads,1);assert.equal(f.state.contextReads,0);
});

for(const [name,mutate] of Object.entries({binding:s=>{s.accepted.run.binding.workerId=id(999);},policy:s=>{s.accepted.run.policyRevision='f'.repeat(64);},
 scope:s=>{s.accepted.run.scopes[0].resourceId=id(999);},request:s=>{s.accepted.request.prompt='changed-original';},terminal:s=>{s.accepted.run.state='completed';}})){
 test('accepted '+name+' drift during native read refuses disclosure',async()=>{
  const f=fixture();f.state.onContext=state=>{if(state.contextReads===1)mutate(state);};await assert.rejects(f.create().assertCurrent(f.call()),unavailable);
 });
}

test('already aborted and timed out reads cannot release results and dispose owned deadlines',async()=>{
 const f=fixture();await assert.rejects(f.create().assertCurrent({...f.call(),signal:AbortSignal.abort()}),unavailable);assert.equal(f.state.rows,0);assert.equal(f.state.fetches,0);
 const g=fixture();let aborted=false;g.configuration.identity.fetchImpl=(_url,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>{aborted=true;reject(Error('synthetic transport cancelled'));},{once:true});});
 await assert.rejects(g.create({maxRequestMs:25}).assertCurrent(g.call()),unavailable);assert.equal(aborted,true);
});

test('concurrent calls retain separate per-read pins and return only the closed projection',async()=>{
 const f=fixture(),owner=f.create(),[a,b]=await Promise.all([owner.assertCurrent(f.call()),owner.assertCurrent(f.call())]);assert.deepEqual(a,b);assert.equal(f.state.fetches,8);
});
