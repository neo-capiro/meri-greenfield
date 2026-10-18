/** SYNTHETIC: the routines read-consent port (routine-consents.mjs) over the real consent owner (consent.mjs), the real Core
 * client and the real action-session owner; Core is the delegation fixture's consent routes. No socket, live Core or credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {applicationFixture,binding,scopes,id} from '../../../../control/conversations/test/application-fixture.mjs';
import {origin as coreOrigin} from '../../native-read-credentials/test/fixture.mjs';
import {createReadDelegationCoreClient} from '../core-client.mjs';
import {createReadDelegationConsents} from '../consent.mjs';
import {createRoutineReadConsents} from '../routine-consents.mjs';
import {READ_DELEGATION_LIMITS,READ_DELEGATION_ROUTES,operationsDigest} from '../contract.mjs';
import {delegationCoreFixture} from './fixture.mjs';
const DAY=86400000,NATIVE='synthetic-native',code=c=>e=>e?.code===c,POLICY='b'.repeat(64),PROJECTION='c'.repeat(64);
function allocationJson(now,allowedOperations){
 const selected=selectSkill('quick_skill.relationship_brief','1.0.0'),manifest={...selected.manifest,...(allowedOperations?{allowedOperations}:{})};
 return JSON.stringify({run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,binding[k]])),manifest,manifestSha256:hash(manifest),catalogSha256:selected.pin.catalogSha256,budgets:manifest.budgets,
  schedule:{revision:'a'.repeat(64),expiresAt:new Date(now+60000).toISOString(),operations:[{operation:manifest.allowedOperations[0],chargeMicrousd:1}]}});
}
async function harness({allowedOperations}={}){
 const f=await applicationFixture(),clientId=scopes[0].resourceId;let clock=Date.now();const now=()=>clock;
 const core=delegationCoreFixture({now,binding,clientId,runDeadlineMs:clock+3600000,principal:{tenantId:binding.tenantId,actorId:binding.actorId},reservations:new Map(),liveBearers:new Set([NATIVE]),
  authority:async()=>new Response('',{status:404}),tools:async()=>new Response('',{status:404})});
 const client=createReadDelegationCoreClient({origin:coreOrigin,fetchImpl:core.fetchImpl,now,enabled:true,getServiceSecret:async()=>'SYNTHETIC_SERVICE'});
 const port=createRoutineReadConsents({consents:createReadDelegationConsents({client,now}),nativeCredentials:f.sessions,allocationJson:allocationJson(clock,allowedOperations),now});
 const attended={binding,selectedClientId:clientId};
 const approve=extra=>port.approve({attended,scheduleId:id(60),clientId,policyRevision:POLICY,scheduleProjectionSha256:PROJECTION,scheduleEndsAtMs:null,deadlineMs:now()+2000,...extra});
 return {f,core,port,attended,clientId,now,approve,calls:()=>core.state.calls,close:f.close};
}
test('approve carries the owner\'s live bearer and the service identity, binds the template\'s read operations and bounds expiry to 30 days or the schedule end',async t=>{
 const h=await harness();t.after(h.close);
 const r=await h.approve();
 assert.deepEqual(Object.keys(r),['consentId','state','createdAtMs','expiresAtMs','operationsDigest']);assert.ok(Object.isFrozen(r));
 assert.equal(r.state,'active');assert.equal(r.createdAtMs,h.now());assert.equal(r.expiresAtMs,h.now()+READ_DELEGATION_LIMITS.consentMaxMs);assert.equal(r.operationsDigest,operationsDigest(h.port.operations));
 assert.equal(h.port.operations.length,11);assert.ok(Object.isFrozen(h.port.operations));
 const call=h.calls().at(-1);assert.equal(call.path,READ_DELEGATION_ROUTES.consents);assert.equal(call.headers.authorization,'Bearer '+NATIVE);assert.equal(call.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
 assert.ok(!JSON.stringify(call).includes(h.f.credential),'the action-session credential never leaves');
 assert.deepEqual(h.core.state.consents.get(r.consentId).request,{schemaVersion:1,scheduleId:id(60),clientId:h.clientId,operationsDigest:r.operationsDigest,policyRevision:POLICY,scheduleProjectionSha256:PROJECTION,requestedExpiresAtMs:h.now()+READ_DELEGATION_LIMITS.consentMaxMs});
 // The schedule's end bounds the consent; a second consent for the schedule supersedes the first at Core.
 const short=await h.approve({scheduleEndsAtMs:h.now()+5*DAY});assert.equal(short.expiresAtMs,h.now()+5*DAY);assert.equal(h.core.state.consents.get(r.consentId).state,'superseded');
 // An ended schedule or a malformed end is refused before any request.
 const before=h.calls().length;
 await assert.rejects(h.approve({scheduleEndsAtMs:h.now()}),code('INVALID_ARGUMENTS'));await assert.rejects(h.approve({scheduleEndsAtMs:'soon'}),code('INVALID_ARGUMENTS'));
 assert.equal(h.calls().length,before);
});
test('narrow carries only the service identity; resume needs the live login; without a live session approve and resume refuse before any request',async t=>{
 const h=await harness();t.after(h.close);
 const {consentId}=await h.approve();
 assert.deepEqual(await h.port.narrow({consentId,state:'paused',deadlineMs:h.now()+2000}),{consentId,state:'paused'});
 let call=h.calls().at(-1);assert.equal(call.path,`${READ_DELEGATION_ROUTES.consents}/${consentId}/state`);assert.equal(call.headers.authorization,undefined,'no user bearer on a narrowing');assert.equal(call.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
 assert.equal(h.core.state.consents.get(consentId).state,'paused');
 assert.deepEqual(await h.port.resume({attended:h.attended,consentId,deadlineMs:h.now()+2000}),{consentId,state:'active'});
 call=h.calls().at(-1);assert.equal(call.headers.authorization,'Bearer '+NATIVE);assert.equal(h.core.state.consents.get(consentId).state,'active');
 // Malformed narrowing and resume inputs are refused locally.
 const before=h.calls().length;
 await assert.rejects(h.port.narrow({consentId:'nope',state:'paused'}),code('INVALID_ARGUMENTS'));await assert.rejects(h.port.narrow({consentId,state:'active'}),code('INVALID_ARGUMENTS'));
 await assert.rejects(h.port.resume({attended:h.attended,consentId:'nope'}),code('INVALID_ARGUMENTS'));await assert.rejects(h.port.resume({attended:{binding,selectedClientId:'x'},consentId}),code('ACCESS_DENIED'));
 assert.equal(h.calls().length,before);
 // The owner's session ends: widening refuses with no request; narrowing still works on the service identity alone.
 h.f.sessions.revoke(h.f.credential);
 await assert.rejects(h.approve(),code('ACCESS_DENIED'));await assert.rejects(h.port.resume({attended:h.attended,consentId}),code('ACCESS_DENIED'));assert.equal(h.calls().length,before);
 assert.deepEqual(await h.port.narrow({consentId,state:'revoked'}),{consentId,state:'revoked'});assert.equal(h.core.state.consents.get(consentId).state,'revoked');
 assert.deepEqual(h.core.state.consents.get(consentId).history,['active','paused','active','revoked']);
 // Revoked never changes again (Core 409).
 await assert.rejects(h.port.narrow({consentId,state:'paused'}),code('ACCESS_DENIED'));
});
test('a Core outage is UNAVAILABLE; a template naming a non-read operation can never be consented; malformed ports are refused',async t=>{
 const h=await harness();t.after(h.close);
 h.core.state.consentStatus=503;await assert.rejects(h.approve(),code('UNAVAILABLE'));h.core.state.consentStatus=null;
 const w=await harness({allowedOperations:[{id:'create_word',version:'0.2.0'},{id:'search_memory',version:'0.2.0'}]});t.after(w.close);
 const before=w.calls().length;await assert.rejects(w.approve(),code('ACCESS_DENIED'));assert.equal(w.calls().length,before,'refused before any request');
 const consents=createReadDelegationConsents({client:createReadDelegationCoreClient({origin:coreOrigin,fetchImpl:h.core.fetchImpl,now:h.now,enabled:true,getServiceSecret:async()=>'s'}),now:h.now});
 for(const bad of [{consents:{},nativeCredentials:h.f.sessions,allocationJson:allocationJson(h.now()),now:h.now},{consents,nativeCredentials:{},allocationJson:allocationJson(h.now()),now:h.now},
  {consents,nativeCredentials:h.f.sessions,allocationJson:allocationJson(h.now()),now:'x'},{consents,nativeCredentials:h.f.sessions,allocationJson:allocationJson(h.now())}])
  assert.throws(()=>createRoutineReadConsents(bad),code('CONFIGURATION'));
});
