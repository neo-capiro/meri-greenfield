/** Funding delta over actual CONTROL/task/current-native owners; synthetic identity HTTP and scripted SQL only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {storedCase,ids,clientId} from '../../../gateway/sources/funding-opportunities/test/fixture.mjs';
import {ownerFixture,uuid} from '../native-read-credentials/test/fixture.mjs';

const read=async(f,proof=f.proof())=>JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(proof));
const make=id=>ownerFixture(id,{scene:storedCase(id)}),foreign=uuid('e');
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);}

for(const id of ids){
 test(`${id}: one trusted asOf survives advancing native identity/membership and credential rechecks`,async()=>{
  const f=await make(id);f.core.state.beforeResponse=()=>f.state.now++;
  try{
   const initial=await read(f),asOf=initial.context.asOf;
   assert.deepEqual(Object.keys(initial.context),['asOf']);assert.equal(asOf,new Date(Date.parse(asOf)).toISOString());
   assert.notEqual(asOf,f.normalizationContext.asOf,'fixture source time is not the private owner clock observation');
   assert.deepEqual(initial.subject.entityIds,[clientId]);assert.equal(initial.requestSha256,hash(f.request));
   f.state.now+=35;const again=await read(f);assert.deepEqual(again.context,initial.context);
   const membershipReads=f.core.state.calls.filter(call=>call.path.endsWith('/membership')).length;
   const credentials=await f.owner.getCredentials(f.credentials(again.context));
   assert.deepEqual(credentials.normalizationContext,initial.context);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,initial.context);
   assert.equal(credentials.requestSha256,hash(f.request));assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));
   assert.ok(f.core.state.calls.filter(call=>call.path.endsWith('/membership')).length>membershipReads,'credential acquisition rechecks current native membership');assert.equal(f.wire.length,0);
   const freshScope=new AbortController();
   try{f.state.now+=35;const fresh=await read(f,{...f.proof(),signal:freshScope.signal});assert.notEqual(fresh.context.asOf,asOf);}
   finally{freshScope.abort();}
  }finally{f.scope.abort();}
 });
 test(`${id}: changed context, original body, operation or digest cannot reuse an observed credential scope`,async()=>{
  for(const mode of ['asOf','body','operation','request-digest','arguments-digest']){
   const f=await make(id);
   try{
    const first=await read(f),proof=f.credentials(first.context);
    if(mode==='asOf')proof.normalizationContext={asOf:new Date(Date.parse(first.context.asOf)+1).toISOString()};
    if(mode==='body'){
     proof.request={...proof.request,clientId:foreign};proof.requestSha256=hash(proof.request);
     const normalized=f.contract.normalizeInput(proof.request,first.context);proof.input=normalized.input;proof.argumentsSha256=normalized.argumentsSha256;
    }
    if(mode==='operation')proof.operation={id:ids[(ids.indexOf(id)+1)%ids.length],version:'0.2.0'};
    if(mode==='request-digest')proof.requestSha256='0'.repeat(64);
    if(mode==='arguments-digest')proof.argumentsSha256='0'.repeat(64);
    await assert.rejects(f.owner.getCredentials(proof));noSource(f);
   }finally{f.scope.abort();}
  }
 });
 test(`${id}: client selectors require current native visibility and a coherent client resource before source credentials`,async()=>{
  for(const mode of ['invisible','foreign-subject','foreign-resource','personal']){
   const scene=storedCase(id),a=scene.authority;
   if(mode==='foreign-subject')a.subject.entityIds=[foreign];
   if(mode==='foreign-resource'){const scope={...a.subject.scopes[0],resourceId:foreign};a.subject.scopes=[scope];a.claims.scopes=[scope];a.decision.scopes=[scope];}
   if(mode==='personal')Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId]});
   const f=await ownerFixture(id,{scene});f.core.state.clientIds=mode==='invisible'?[]:[clientId,foreign];
   try{await assert.rejects(read(f),{message:'ACCESS_DENIED'});noSource(f);if(mode!=='invisible')assert.equal(f.stateOwner.nativeCredentials,0);}
   finally{f.scope.abort();}
  }
 });
}

test('funding context cannot be supplied from source output or an unobserved model-selected timestamp',async()=>{
 const f=await make(ids[0]);
 try{await assert.rejects(f.owner.getCredentials(f.credentials(f.normalizationContext)),{message:'ACCESS_DENIED'});noSource(f);assert.equal(f.core.state.calls.length,0);}
 finally{f.scope.abort();}
});

test('funding current membership drift across service-secret await withholds the correlated credential pair',async()=>{
 const f=await make(ids[0]);
 try{
  const initial=await read(f);f.stateOwner.beforeSecret=()=>f.core.state.membershipRevision='e'.repeat(64);
  await assert.rejects(f.owner.getCredentials(f.credentials(initial.context)),{message:'ACCESS_DENIED'});
  assert.equal(f.stateOwner.secrets,1);assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
 }finally{f.scope.abort();}
});
