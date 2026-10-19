/** Actual control/task/native/gateway/budget owners with scripted SQL and synthetic Core responses; no live source qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {storedCase,clientId,otherClientId} from '../../../../gateway/sources/research-legal-candidates/test/fixture.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {ownerFixture} from './fixture.mjs';

async function wired({named=false}={}){
 const request={query:'priority',clientId:named?'Client Alpha':clientId};
 const scene=storedCase({request,...(named?{resolution:{reference:'Client Alpha',clientId}}:{})});
 const f=await ownerFixture('search_research_sources',{scene});
 f.core.state.response=(value,path)=>Response.json(path.endsWith('/clients/check-ref')?{ok:true,clientId:f.core.state.resolvedClientId??clientId}:value);
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{'research-legal-candidates':{...transport,credentialsForCall:f.owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const mount=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:f.owner.nativeReadContextPorts});
 return {...f,handlers,invoke:()=>mount.execute({operation:f.operation,arguments:f.request,deliveryId:'research-candidates-current'})};
}

function noRelease(f){
 assert.equal(f.state.budget.consumed_micro_usd,0);
 for(const row of f.state.produced.values())assert.equal(row.completion,null);
}

test('selected-client candidate read traverses actual current authority and settles exactly once',async()=>{
 const f=await wired();
 try{
  const raw=await f.invoke(),out=JSON.parse(raw),reservation=[...f.state.reservations.values()][0];
  assert.deepEqual(out.result,f.page);assert.deepEqual(out.subject,f.authority.subject);
  assert.equal(out.result.results[0].clientId,clientId);assert.equal(out.result.results[1].clientId,null);
  assert.equal(f.wire.length,1);assert.deepEqual(f.wire[0].body,f.request);
  assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{clientResolution:{reference:clientId,clientId}});
  assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(raw));
  assert.equal(f.state.budget.consumed_micro_usd,1);
  assert.ok(f.handlers.get('search_research_sources@0.2.0').sourceFiles.some(row=>row.label.endsWith('research-legal-candidates/request-context.mjs')));
 }finally{f.scope.abort();}
});

test('current native client name resolver and handler retain the selected-client grant',async()=>{
 const f=await wired({named:true});
 try{
  // The scripted gateway business-policy fixture intentionally admits only UUID selectors.
  // As in existing name-resolution tests, exercise the actual current native owner and source
  // handler here; full mounted budget/release behavior is covered separately with the UUID.
  const current=JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(f.proof()));
  const normalized=f.contract.normalizeInput(f.request,current.context);
  const out=JSON.parse(await f.handlers.get('search_research_sources@0.2.0').execute({
   request:f.request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:current.context,
   authority:f.authority,signal:f.scope.signal,
  }));assert.deepEqual(out.result,f.page);
  assert.deepEqual(f.wire[0].body,{query:'priority',clientId});
  const references=f.core.state.calls.filter(row=>row.path.endsWith('/clients/check-ref'));
  assert.ok(references.length>=3);assert.ok(references.every(row=>row.body.ref==='Client Alpha'));
 }finally{f.scope.abort();}
});

test('hidden or foreign native client cannot create a source read or reservation',async()=>{
 for(const mode of ['hidden','foreign']){
  const f=await wired({named:mode==='foreign'});
  if(mode==='hidden')f.core.state.clientIds=[];
  else{f.core.state.clientIds=[clientId,otherClientId];f.core.state.resolvedClientId=otherClientId;}
  try{await assert.rejects(f.invoke());assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);noRelease(f);}
  finally{f.scope.abort();}
 }
});

test('post-source membership revocation withholds candidate content and preserves UNKNOWN hold',async()=>{
 const f=await wired();f.state.afterSource=()=>{f.core.state.clientIds=[];};
 try{
  await assert.rejects(f.invoke());assert.equal(f.wire.length,1);
  assert.equal([...f.state.reservations.values()][0].state,'UNKNOWN');noRelease(f);
 }finally{f.scope.abort();}
});

test('revoked task grant refuses before credentials, source IO or reservation',async()=>{
 const f=await wired();f.state.grant.state='REVOKED';
 try{await assert.rejects(f.invoke());assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);assert.equal(f.stateOwner.secrets,0);noRelease(f);}
 finally{f.scope.abort();}
});
