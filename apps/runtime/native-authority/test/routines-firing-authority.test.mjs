/** SYNTHETIC (D016-A item 5): the unattended firing authority and stop control over the REAL schedule owner, conversation store,
 * Temporal dispatcher and scheduled dispatch (scripted SQL/Temporal), with a scripted Core wire C following the Meri consumer's
 * proposed contract and a local Ed25519 signer. Proves the fence order, DENY vs UNAVAILABLE, consent bounds and the Stop order —
 * not a live Core route (none exists at 32cf3ca7) or key. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createScheduledDispatch} from '../../../control/schedules/scheduled-dispatch.mjs';
import {createScheduledJobLifecycle} from '../../../control/schedules/scheduled-job-lifecycle.mjs';
import {scheduledJobFixture,id} from '../../../control/schedules/test/scheduled-job-fixture.mjs';
import {createRoutinesFiringAuthority,createRoutinesUnattendedRunControl,ROUTINE_FIRING_DENIED} from '../routines-firing-authority.mjs';
import {routineFiringTrust,verifyRoutineFiringGrant,ROUTINE_CONSENT_MAX_SECONDS} from '../routines-firing-grant.mjs';
import {routineCancellationTrust} from '../routines-cancellation-proof.mjs';
import {compileRoutinesCoreConfiguration} from '../routines-configuration.mjs';
import {createRoutinesCoreClient,ROUTINES_CORE_ROUTES} from '../routines-core-client.mjs';
import {composeRoutinesWorkerOwners,SCHEDULE_SERVICE_OWNERS} from '../../schedule-service-owners.mjs';
import {coreSigner,CORE_ORIGIN} from './routines-core-fixture.mjs';

const code=c=>e=>e?.code===c,SECRET='synthetic-routines-service-secret',FIRE='capiro-meri-routine-fire+jwt',AUD='meri-schedule-firing';
/** Scripted Core wire C: issues a firing grant from the request while `state.consent` stands, following the proposed contract. */
function coreFiring(state){
 return async function fetchImpl(url,init){
  const record={url,headers:{...init.headers},body:JSON.parse(init.body)};state.requests.push(record);
  if(url!==CORE_ORIGIN+ROUTINES_CORE_ROUTES.unattendedGrant)return new Response('',{status:404});
  if(init.headers['x-internal-service-secret']!==SECRET||'authorization' in init.headers)return new Response('',{status:403});
  if(state.status)return new Response('{}',{status:state.status,headers:{'content-type':'application/json'}});
  const b=record.body,consent=state.consent;if(!consent||consent.revoked)return new Response('{"message":"refused"}',{status:403,headers:{'content-type':'application/json'}});
  const nowMs=state.now();let claims={tenantId:b.tenantId,ownerActorId:b.ownerActorId,scheduleId:b.scheduleId,generation:b.generation,intentSha256:b.intentSha256,projectionSha256:b.projectionSha256,
   occurrenceKey:b.occurrenceKey,phase:b.phase,scopes:consent.scopes,membershipRevision:'m1',consentId:consent.id,consentIssuedAtS:consent.issuedAtS,consentExpiresAtS:consent.expiresAtS,limits:consent.limits};
  if(state.rewrite)claims=state.rewrite(claims);
  const issued=state.signer.sign(claims,{nowMs,ttl:state.ttl??30,typ:FIRE,aud:AUD});
  return new Response(JSON.stringify({grant:issued.proof,jti:issued.jti,expiresAtMs:issued.exp*1000}),{status:200,headers:{'content-type':'application/json'}});
 };
}
async function harness({admit=true}={}){
 const h=await scheduledJobFixture({admit,allocated:admit}),signer=coreSigner({kid:'routine-fire-1'}),trust=routineFiringTrust(signer.pin),nowS=()=>Math.floor(h.now()/1000);
 const state={requests:[],signer,now:h.now,status:null,rewrite:null,ttl:undefined,consent:{id:id(700),scopes:h.scopes,issuedAtS:nowS()-60,expiresAtS:nowS()+7*86400,revoked:false,limits:{maxCostMicrousd:2000000,maxRuntimeSeconds:900,retryLimit:0}}};
 const wires=createRoutinesCoreClient({origin:CORE_ORIGIN,getServiceSecret:async()=>SECRET,now:h.now,fetchImpl:coreFiring(state),maxRequestMs:1000});
 // The schedule SQL fixture lacks the by-conversation occurrence SELECT; answer it from the fixture's own rows.
 const connect=h.scheduleSql.pool.connect;h.scheduleSql.pool.connect=async()=>{const sql=await connect();return {...sql,async query(text,args=[]){
  if(text.includes("effect->'binding'->>'conversationId'"))return {rows:structuredClone([...h.scheduleSql.state.occurrences.values()].filter(r=>r.tenant_id===args[0]&&r.effect.binding.conversationId===args[1]).slice(0,2))};
  return sql.query(text,args);}};};
 const authority=createRoutinesFiringAuthority({wires,trust,scheduleOwner:h.scheduleOwner,now:h.now,maxRequestMs:1000});
 const runControl=createRoutinesUnattendedRunControl({wires,trust,scheduleOwner:h.scheduleOwner,store:h.store,dispatcher:h.dispatcher,now:h.now,maxRequestMs:1000});
 const dispatch=createScheduledDispatch({scheduleOwner:h.scheduleOwner,store:h.store,dispatcher:h.dispatcher,runs:h.runs,authority,taskInstructions:{async read(){return {instruction:h.input.request.prompt};}},versions:h.template.versions,now:h.now,maxRequestMs:1000});
 const projection=h.occurrence.projection,occurrenceKey=h.identity.occurrenceKey;
 const authorize=(phase='before_admission',changes={})=>authority.authorize({phase,occurrence:h.identity.identity,occurrenceKey,projection,limitDeadline(){},...changes});
 const denial={authorized:false,occurrenceKey,code:ROUTINE_FIRING_DENIED};
 /** The owner's acknowledged pause/delete of the schedule (generation 2), through the real schedule owner. */
 async function cancelSchedule(mode){const intent={intentId:id(5800),operation:'cancel_scheduled_task',expectedGeneration:1,generation:2,previousProjectionSha256:hash(h.intent.projection),projection:{...h.intent.projection,state:mode==='pause'?'paused':'cancelled'},configuration:null,cancel:{mode,note:'Explicit approved cancellation',running:'leave',runs:[]}};await h.acknowledge(intent);}
 return {...h,state,signer,trust,wires,authority,runControl,dispatch,projection,occurrenceKey,authorize,denial,cancelSchedule,occurrenceState:()=>h.scheduleSql.state.occurrences.get(h.template.principal.tenantId+':'+occurrenceKey)?.state??null};
}

test('a firing grant verifies only within its consent (≤30 days), lease (≤30 s), purpose, pinned key and closed claims',()=>{
 const signer=coreSigner({kid:'routine-fire-1'}),trust=routineFiringTrust(signer.pin),NOW=Date.parse('2026-10-18T12:00:00.000Z'),s=Math.floor(NOW/1000);
 const claims=(changes={})=>({tenantId:'tenant-a',ownerActorId:'owner-a',scheduleId:id(1),generation:1,intentSha256:'a'.repeat(64),projectionSha256:'b'.repeat(64),occurrenceKey:'c'.repeat(64),phase:'before_start',
  scopes:[{tenantId:'tenant-a',kind:'client',resourceId:id(5),policyRevision:'p1'}],membershipRevision:'m1',consentId:id(700),consentIssuedAtS:s-3600,consentExpiresAtS:s+86400,limits:{maxCostMicrousd:2000000,maxRuntimeSeconds:900,retryLimit:0},...changes});
 const sign=(c,o={})=>signer.sign(c,{nowMs:NOW,typ:FIRE,aud:AUD,...o}).proof,refused=token=>assert.throws(()=>verifyRoutineFiringGrant(token,{trust,nowMs:NOW}),code('ROUTINE_FIRING_GRANT_REFUSED'));
 const v=verifyRoutineFiringGrant(sign(claims()),{trust,nowMs:NOW});assert.deepEqual(v.claims,claims());assert.equal(v.exp-v.iat,30);
 refused(sign(claims({consentExpiresAtS:s-3600+ROUTINE_CONSENT_MAX_SECONDS+1})));refused(sign(claims({consentExpiresAtS:s+10})));refused(sign(claims({consentExpiresAtS:s-3600})));
 refused(sign(claims(),{ttl:31}));refused(sign(claims(),{aud:'meri-schedule-run-control'}));refused(sign(claims(),{typ:'capiro-meri-routine-cancel+jwt'}));
 refused(sign(claims({phase:'before_release'})));refused(sign(claims({scopes:[]})));refused(sign(claims({limits:{maxCostMicrousd:0,maxRuntimeSeconds:900,retryLimit:0}})));refused(sign({...claims(),extra:1}));
 // The cancellation purpose's trust never verifies a firing grant, even over the same signer material; the pins must differ.
 assert.throws(()=>verifyRoutineFiringGrant(sign(claims()),{trust:routineCancellationTrust(signer.pin),nowMs:NOW}),code('ROUTINE_FIRING_GRANT_REFUSED'));
 const other=coreSigner({kid:'routine-cancel-1'}),both={origin:CORE_ORIGIN,serviceSecretFile:'/run/meri/routines-service-secret',cancellationProof:other.pin,unattendedGrant:signer.pin};
 assert.deepEqual(Object.keys(compileRoutinesCoreConfiguration({routines:{enabled:true,core:both}})).sort(),['cancellationProof','origin','serviceSecretFile','unattendedGrant']);
 for(const core of [{...both,unattendedGrant:{...signer.pin,kid:'routine-cancel-1'}},{...both,cancellationProof:{...other.pin,publicKey:signer.pin.publicKey}},{origin:both.origin,serviceSecretFile:both.serviceSecretFile}])
  assert.throws(()=>compileRoutinesCoreConfiguration({routines:{enabled:true,core}}),code('ROUTINES_CONFIGURATION'));
});

test('the authority answers the dispatch receipt exactly, under the service identity only, after the schedule fence and Core consent',async t=>{
 const h=await harness({admit:false});t.after(h.close);const before=h.now();
 const r=await h.authorize();assert.deepEqual(Object.keys(r).sort(),['authorized','checkedAtMs','expiresAtMs','occurrenceKey','owner','scopes']);
 assert.equal(r.authorized,true);assert.equal(r.occurrenceKey,h.occurrenceKey);assert.deepEqual(r.owner,h.template.principal);assert.deepEqual(r.scopes,h.scopes);
 assert.ok(r.checkedAtMs>=before&&r.expiresAtMs>r.checkedAtMs&&r.expiresAtMs<=before+30000);
 const sent=h.state.requests[0];assert.equal(sent.url,CORE_ORIGIN+ROUTINES_CORE_ROUTES.unattendedGrant);assert.equal(sent.headers['x-internal-service-secret'],SECRET);assert.equal('authorization' in sent.headers,false);
 assert.deepEqual(Object.keys(sent.body).sort(),['generation','intentSha256','occurrenceKey','ownerActorId','phase','projectionSha256','scheduleId','tenantId']);
 assert.equal(sent.body.intentSha256,hash(h.intent));assert.equal(sent.body.projectionSha256,hash(h.projection));assert.equal(sent.body.phase,'before_admission');
 // The real scheduled dispatch accepts the receipt at both phases and dispatches the occurrence.
 const out=await h.dispatch.dispatch({occurrence:h.occurrence});assert.equal(out.outcome,'DISPATCHED');
 assert.deepEqual(h.state.requests.slice(1).map(q=>q.body.phase),['before_admission','before_start']);assert.equal(h.occurrenceState(),'DISPATCHED');
});

test('pause, delete, a changed projection, revoked or narrower consent and 403 are DENY; a mismatched grant, 404 and 5xx are UNAVAILABLE',async t=>{
 const h=await harness({admit:false});t.after(h.close);
 const denied=async label=>assert.deepEqual(await h.authorize(),h.denial,label);
 h.state.consent.revoked=true;await denied('revoked');h.state.consent.revoked=false;
 h.state.status=403;await denied('403');h.state.status=null;
 h.state.rewrite=c=>({...c,scopes:[{...c.scopes[0],resourceId:id(99)}]});await denied('scope change');
 h.state.rewrite=c=>({...c,limits:{...c.limits,maxRuntimeSeconds:10}});await denied('narrower limits');
 h.state.rewrite=c=>({...c,generation:2});await assert.rejects(h.authorize(),code('ROUTINE_FIRING_GRANT'));h.state.rewrite=null;
 for(const status of [404,500,503]){h.state.status=status;await assert.rejects(h.authorize(),code('ROUTINES_CORE_UNAVAILABLE'));}
 h.state.status=null;h.state.ttl=0;await assert.rejects(h.authorize(),code('ROUTINE_FIRING_GRANT_REFUSED'));h.state.ttl=undefined;
 // Meri's own fence denies before Core is asked: a projection other than the schedule's current one.
 const asked=h.state.requests.length;assert.deepEqual(await h.authorize('before_start',{projection:{...h.projection,maxCostMicrousd:1}}),h.denial);assert.equal(h.state.requests.length,asked);
 // A revoked consent refuses the real dispatch with the dispatch owner's own code.
 h.state.consent.revoked=true;const out=await h.dispatch.dispatch({occurrence:h.occurrence});h.state.consent.revoked=false;
 assert.equal(out.outcome,'REFUSED');assert.equal(out.code,'SCHEDULE_AUTHORITY_REFUSED');
 // An unavailable Core leaves the occurrence UNKNOWN (no evidence), never refused or dispatched.
 h.state.status=503;const unknown=await h.dispatch.dispatch({occurrence:h.occurrence});h.state.status=null;assert.equal(unknown.outcome,'UNKNOWN');
 // The owner's acknowledged pause (generation 2) denies an occurrence of generation 1 before Core is asked.
 await h.cancelSchedule('pause');const count=h.state.requests.length;assert.deepEqual(await h.authorize(),h.denial);assert.equal(h.state.requests.length,count);
});
test('the owner\'s acknowledged delete denies before Core is asked',async t=>{
 const h=await harness({admit:false});t.after(h.close);await h.cancelSchedule('delete');
 assert.deepEqual(await h.authorize(),h.denial);assert.equal(h.state.requests.length,0);
});

test('the unattended stop maps the run to its occurrence, needs a before_stop grant, then journals cancelled and asks the dispatcher',async t=>{
 const h=await harness();t.after(h.close);await h.scheduled.dispatch({occurrence:h.occurrence});await h.running();
 const jobs=createScheduledJobLifecycle({store:h.store,runControl:h.runControl,retirement:h.options.retirement,now:h.now,maxRequestMs:1000});
 const receipt=await jobs.cancel({...h.selection,deadlineMs:h.now()+1000});
 assert.equal(receipt.state,'SETTLED');assert.equal(h.row(h.identity.binding).projection.state,'cancelled');assert.deepEqual(h.calls.retire,[h.identity.binding]);
 const stop=h.state.requests.find(q=>q.body.phase==='before_stop');assert.ok(stop);assert.equal(stop.body.occurrenceKey,h.occurrenceKey);assert.equal('authorization' in stop.headers,false);
 assert.equal(h.calls.cancel.length,0,'the session-based fixture control is never used');
 // Without consent nothing is journaled; a run that is not a scheduled occurrence is never stopped here; no Core route is UNAVAILABLE.
 h.state.consent.revoked=true;await assert.rejects(h.runControl.cancel({binding:h.identity.binding,deadlineMs:h.now()+1000}),code('ROUTINE_FIRING_DENIED'));h.state.consent.revoked=false;
 await assert.rejects(h.runControl.cancel({binding:{...h.identity.binding,conversationId:id(4242)},deadlineMs:h.now()+1000}),code('ROUTINE_FIRING_NOT_SCHEDULED'));
 h.state.status=404;await assert.rejects(h.runControl.cancel({binding:h.identity.binding,deadlineMs:h.now()+1000}),code('ROUTINES_CORE_UNAVAILABLE'));
});

test('the worker-owner composer is inert, needs routines.core.unattendedGrant plus both lane-1 owners, and yields the exact runtimePorts record',async t=>{
 const h=await harness();t.after(h.close);
 const configuration={limits:{startupMs:1000,shutdownMs:1000,requestMs:1000,requestBytes:131072},scheduledDispatch:{enabled:true,conversationTaskQueue:'meri-conversations',maxConcurrentActivities:1},
  routines:{enabled:true,core:{origin:CORE_ORIGIN,serviceSecretFile:'/run/meri/routines-service-secret',unattendedGrant:h.signer.pin}}};
 const transport={fetchImpl:coreFiring(h.state),readSecret:async()=>Buffer.from(SECRET)},lane1={runAdmission:{async admit(){}},retirement:h.options.retirement};
 // Production composes both owners over ONE database; the fixtures split schedules and conversations, so route by relation.
 const pool={async connect(){let client;const staged=[];return {async query(text,values=[]){
  if(!client){
   if(text==='BEGIN'||text.startsWith('BEGIN ISOLATION')||text.startsWith('SET LOCAL')||text.startsWith('SELECT pg_advisory_xact_lock(')){staged.push([text,values]);return {rows:[],rowCount:0};}
   if(text==='ROLLBACK'||text==='COMMIT')return {rows:[],rowCount:0};
   client=await (text.includes('meri_schedules.')?h.scheduleSql.pool:h.pool).connect();for(const args of staged)await client.query(...args);
  }
  return client.query(text,values);
 },release(error){client?.release(error);}};}};
 const owners=composeRoutinesWorkerOwners({configuration,pool,client:h.temporal.client,now:h.now,transport,...lane1});
 assert.deepEqual(Object.keys(owners).sort(),['authority','client','now','pool','retirement','runAdmission','runControl']);assert.equal(h.state.requests.length,0);
 assert.deepEqual(Object.keys(SCHEDULE_SERVICE_OWNERS).sort(),['authority','retirement','runAdmission','runControl']);
 const {unattendedGrant:_,...cancelOnly}=configuration.routines.core;
 for(const bad of [{configuration:{...configuration,routines:{enabled:false}}},{configuration:{...configuration,routines:{enabled:true}}},
  {configuration:{...configuration,routines:{enabled:true,core:{...cancelOnly,cancellationProof:coreSigner().pin}}}},{runAdmission:undefined},{retirement:undefined}])
  assert.throws(()=>composeRoutinesWorkerOwners({configuration,pool,client:h.temporal.client,now:h.now,transport,...lane1,...bad}),code('SCHEDULE_SERVICE_UNAVAILABLE'));
 const r=await owners.authority.authorize({phase:'before_start',occurrence:h.identity.identity,occurrenceKey:h.occurrenceKey,projection:h.projection,limitDeadline(){}});assert.equal(r.authorized,true);
});
