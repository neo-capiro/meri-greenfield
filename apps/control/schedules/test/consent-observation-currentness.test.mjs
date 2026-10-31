import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoutineConsentObservation,consentFacet} from '../consent-observation.mjs';

const now=Date.parse('2026-10-31T12:00:00Z');
const principal={tenantId:'tenant-synthetic',actorId:'owner-synthetic'};
const scheduleId='10000000-0000-4000-8000-000000000001';
function firing(generation=1,scope='client-one'){
 const projection={scheduleId,owner:principal,scopes:[{kind:'client',resourceId:scope}]};
 return {projection,generation,intent:{intentId:'synthetic-intent-'+generation,generation,projection}};
}
const answer=(generation=1)=>({schemaVersion:1,state:'active',pinsMatched:true,observedAtMs:now,generation,
 consentGeneration:generation,issuedAtMs:now-1000,expiresAtMs:now+1000,scopeCount:1,cause:null,rightsSha256:'a'.repeat(64)});
const call={principal,scheduleId,generation:1,deadlineMs:now+5000,check(){}};
const stale=value=>{assert.equal(value.state,'unknown');assert.equal(value.stale,true);assert.equal(value.generation,1);assert.equal(value.rightsSha256,null);};

test('consent observations keep Core clock semantics at exact expiry and reject contradictory active windows',()=>{
 assert.equal(consentFacet(answer(),1).state,'active');
 const expired={...answer(),state:'expired',expiresAtMs:now,rightsSha256:null};
 assert.equal(consentFacet(expired,1).state,'expired');
 for(const patch of [{expiresAtMs:now},{issuedAtMs:now+1},{consentGeneration:2}]){
  assert.equal(consentFacet({...answer(),...patch},1).state,'unknown');
 }
 assert.equal(consentFacet({...expired,expiresAtMs:now+1},1).state,'unknown');
});

test('a response for another requested generation cannot become the displayed consent',()=>{
 stale(consentFacet(answer(2),1));
});

test('a generation that moved after listing is unknown without asking Core about the replacement',async()=>{
 let asks=0;
 const observer=createRoutineConsentObservation({readFiring:async()=>firing(2),observe:async()=>{asks++;return answer(2);}});
 stale(await observer.one(call));assert.equal(asks,0);
});

test('a generation changed during a successful Core observation is not released as active',async()=>{
 let current=firing(),asks=0;
 const observer=createRoutineConsentObservation({readFiring:async()=>current,observe:async()=>{asks++;current=firing(2);return answer();}});
 stale(await observer.one(call));assert.equal(asks,1);
});

test('changed scope or missing custody during the read cannot release the original active consent',async()=>{
 for(const changed of [firing(1,'client-two'),null]){
  let current=firing(),asks=0;
  const observer=createRoutineConsentObservation({readFiring:async()=>current,observe:async()=>{asks++;current=changed;return answer();}});
  stale(await observer.one(call));assert.equal(asks,1);
 }
});

test('list projection and owner must match the consent custody before a Core read',async()=>{
 const foreignOwner=firing(),foreignTenant=firing();
 foreignOwner.projection.owner={...principal,actorId:'other-owner'};
 foreignTenant.projection.owner={...principal,tenantId:'other-tenant'};
 // Each foreign intent still hashes to its own projection: this exercises owner isolation, not a corrupt digest.
 for(const current of [firing(1,'client-two'),foreignOwner,foreignTenant]){
  let asks=0;
  const observer=createRoutineConsentObservation({readFiring:async()=>current,observe:async()=>{asks++;return answer();}});
  const rows=await observer.observe({rows:[{projection:firing().projection,generation:1}],...call});
  stale(rows[0].consent);assert.equal(asks,0);
 }
});

test('unchanged reads remain repeatable and perform no renewal, schedule or run mutation',async()=>{
 let asks=0;
 const observer=createRoutineConsentObservation({readFiring:async()=>firing(),observe:async()=>{asks++;return answer();}});
 const first=await observer.one(call),second=await observer.one(call);
 assert.deepEqual(first,second);assert.equal(first.state,'active');assert.equal(asks,2);
});

test('Core denial stays unknown and absent remains distinct from a stale stored generation',async()=>{
 const absent={...answer(),state:'absent',pinsMatched:false,consentGeneration:null,issuedAtMs:null,expiresAtMs:null,scopeCount:null,rightsSha256:null};
 const observer=observe=>createRoutineConsentObservation({readFiring:async()=>firing(),observe});
 assert.equal((await observer(async()=>{throw Error('denied');}).one(call)).state,'unknown');
 assert.equal((await observer(async()=>absent).one(call)).state,'absent');
 stale(await observer(async()=>({...absent,consentGeneration:2})).one(call));
});
