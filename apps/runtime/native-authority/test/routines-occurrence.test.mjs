/** The routine occurrence native operations end to end in one process: worker port -> actual native capability client -> private
 * control operation -> owner -> REAL scheduled admission (binding journal, initial inputs, conversation store, schedule owner over
 * the scripted SQL fixtures) under the REAL unattended firing authority over a scripted Core wire C; retirement through the
 * fixture's physical-stop recorder. No database, socket, Temporal server or live Core. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {scheduledJobFixture,id} from '../../../control/schedules/test/scheduled-job-fixture.mjs';
import {createScheduledDispatch} from '../../../control/schedules/scheduled-dispatch.mjs';
import {createScheduledJobLifecycle} from '../../../control/schedules/scheduled-job-lifecycle.mjs';
import {occurrenceIdentity} from '../../../control/schedules/scheduled-occurrence.mjs';
import {createNativeCapabilityClient} from '../../native-client.mjs';
import {capabilityDigest} from '../task-verifier.mjs';
import {routineFiringTrust} from '../routines-firing-grant.mjs';
import {ROUTINES_CORE_ROUTES} from '../routines-core-client.mjs';
import {composeRoutinesOccurrences,ROUTINES_OCCURRENCE_OWNERS} from '../routines-occurrence-composition.mjs';
import {createRoutinesOccurrenceApplication,ROUTINES_OCCURRENCE_PREFIX,ROUTINES_OCCURRENCE_OPERATIONS} from '../routines-occurrence-http.mjs';
import {createOccurrenceConsentAuthority,ADMISSION_PHASES} from '../routines-occurrence-owner.mjs';
import {createRoutinesOccurrencePorts} from '../routines-occurrence-ports.mjs';
import {composeRoutinesWorkerOwners,composeRoutinesWorkerRuntimePorts} from '../../schedule-service-owners.mjs';
import {coreSigner,CORE_ORIGIN} from './routines-core-fixture.mjs';

const code=c=>e=>e?.code===c,SECRET='synthetic-routines-service-secret',FIRE='capiro-meri-routine-fire+jwt',AUD='meri-schedule-firing';
const CONTROL='synthetic-control-capability-0123456789abcdef',origin='https://control.internal.invalid',copy=v=>structuredClone(v);
const counts=h=>({bindings:h.bindings.size,inputs:h.conversations.allocations.size,runs:h.conversations.state.runs.size});
/** Scripted Core wire C (as in routines-firing-authority.test.mjs): a grant from the request while `state.consent` stands. */
function coreFiring(state){
 return async function fetchImpl(url,init){
  const record={url,headers:{...init.headers},body:JSON.parse(init.body)};state.requests.push(record);
  if(url!==CORE_ORIGIN+ROUTINES_CORE_ROUTES.unattendedGrant)return new Response('',{status:404});
  if(init.headers['x-internal-service-secret']!==SECRET||'authorization' in init.headers)return new Response('',{status:403});
  if(state.status)return new Response('{}',{status:state.status,headers:{'content-type':'application/json'}});
  const b=record.body,consent=state.consent;if(!consent||consent.revoked)return new Response('{"message":"refused"}',{status:403,headers:{'content-type':'application/json'}});
  const claims={tenantId:b.tenantId,ownerActorId:b.ownerActorId,scheduleId:b.scheduleId,generation:b.generation,intentSha256:b.intentSha256,projectionSha256:b.projectionSha256,
   occurrenceKey:b.occurrenceKey,phase:b.phase,scopes:consent.scopes,membershipRevision:'m1',consentId:consent.id,consentIssuedAtS:consent.issuedAtS,consentExpiresAtS:consent.expiresAtS,limits:consent.limits};
  const issued=state.signer.sign(claims,{nowMs:state.now(),ttl:30,typ:FIRE,aud:AUD});
  return new Response(JSON.stringify({grant:issued.proof,jti:issued.jti,expiresAtMs:issued.exp*1000}),{status:200,headers:{'content-type':'application/json'}});
 };
}
/** Production composes every owner over ONE database; the fixtures split schedules and conversations, so route by relation. */
function multiplexed(h){
 return {async connect(){let client;const staged=[];return {async query(text,values=[]){
  if(!client){
   if(text==='BEGIN'||text.startsWith('BEGIN ISOLATION')||text.startsWith('SET LOCAL')||text.startsWith('SELECT pg_advisory_xact_lock(')){staged.push([text,values]);return {rows:[],rowCount:0};}
   if(text==='ROLLBACK'||text==='COMMIT')return {rows:[],rowCount:0};
   client=await (text.includes('meri_schedules.')?h.scheduleSql.pool:h.pool).connect();for(const args of staged)await client.query(...args);
  }
  return client.query(text,values);
 },release(error){client?.release(error);}};}};
}
async function harness(){
 const h=await scheduledJobFixture({admit:false,allocated:false}),signer=coreSigner({kid:'routine-fire-1'}),nowS=()=>Math.floor(h.now()/1000);
 const state={requests:[],signer,now:h.now,status:null,consent:{id:id(700),scopes:h.scopes,issuedAtS:nowS()-60,expiresAtS:nowS()+7*86400,revoked:false,limits:{maxCostMicrousd:2000000,maxRuntimeSeconds:900,retryLimit:0}}};
 // The schedule SQL fixture lacks the by-conversation occurrence SELECT; answer it from the fixture's own rows.
 const connect=h.scheduleSql.pool.connect;h.scheduleSql.pool.connect=async()=>{const sql=await connect();return {...sql,async query(text,args=[]){
  if(text.includes("effect->'binding'->>'conversationId'"))return {rows:copy([...h.scheduleSql.state.occurrences.values()].filter(r=>r.tenant_id===args[0]&&r.effect.binding.conversationId===args[1]).slice(0,2))};
  return sql.query(text,args);}};};
 const pool=multiplexed(h),transport={fetchImpl:coreFiring(state),readSecret:async()=>Buffer.from(SECRET)};
 const configuration={version:1,profile:'isolated-preview',sourceEnabled:false,versions:h.template.versions,limits:{startupMs:1000,shutdownMs:1000,requestMs:1000,requestBytes:131072},
  temporal:{taskQueue:'meri-schedules'},scheduledDispatch:{enabled:true,conversationTaskQueue:'meri-conversations',maxConcurrentActivities:1},
  routines:{enabled:true,core:{origin:CORE_ORIGIN,serviceSecretFile:'/run/meri/routines-service-secret',unattendedGrant:signer.pin}}};
 const owners={template:h.template,retirement:h.options.retirement};
 const control=composeRoutinesOccurrences({configuration,controlCapabilitySha256:capabilityDigest(CONTROL),pool,owners,transport,now:h.now});
 const urls=[];
 const native=createNativeCapabilityClient({configuration:{origin,maxResponseBytes:4194304},credential:CONTROL,now:h.now,
  fetch:async(url,init)=>{urls.push(url);return await control.application.handle(new Request(url,init))??Response.json({error:{code:'ROUTE_NOT_FOUND'}},{status:404});}});
 const ports=createRoutinesOccurrencePorts({native});
 const replay=()=>{const r=copy(h.request);for(const key of ['conversation','run','event'])r.input[key].createdAt=new Date(h.now()).toISOString();return r;};
 const phases=()=>state.requests.map(q=>q.body.phase);
 return {...h,state,signer,pool,transport,configuration,owners,control,native,urls,ports,replay,phases,occurrenceState:()=>h.scheduleSql.state.occurrences.get(h.template.principal.tenantId+':'+h.identity.occurrenceKey)?.state??null};
}

test('the worker port admits one occurrence through control under a fresh Core consent per phase, and replays it unchanged',async t=>{
 const h=await harness();t.after(h.close);assert.equal(h.control.state,'composed');const at=h.now();
 const first=await h.ports.runAdmission.admit(h.request);
 assert.deepEqual(first,{binding:h.identity.binding,requestSha256:hash(h.input.request),expiresAtMs:at+20000,replayed:false});
 assert.deepEqual(counts(h),{bindings:1,inputs:1,runs:1});assert.equal(h.occurrenceState(),'OPEN');
 assert.deepEqual(h.urls,[origin+'/v1/'+ROUTINES_OCCURRENCE_OPERATIONS.admit]);assert.ok(h.urls[0].startsWith(origin+ROUTINES_OCCURRENCE_PREFIX));
 assert.deepEqual(h.phases(),['before_admission','before_admission','before_admission'],'the three admission phases each take a fresh grant');
 for(const q of h.state.requests){assert.equal(q.body.occurrenceKey,h.identity.occurrenceKey);assert.equal(q.headers['x-internal-service-secret'],SECRET);assert.equal('authorization' in q.headers,false);}
 const saved=await h.store.readOptional(first.binding,{after:0,limit:1},()=>{});assert.equal(saved.request.prompt,h.input.request.prompt);
 h.advance(1000);const again=await h.ports.runAdmission.admit(h.replay());
 assert.deepEqual(again,{...first,replayed:true});assert.deepEqual(counts(h),{bindings:1,inputs:1,runs:1});assert.equal(h.phases().length,6);
 assert.equal(Object.isFrozen(first.binding),true);
});

test('a foreign occurrence is refused before Core is asked; retirement is bound to this owner\'s own scheduled occurrences',async t=>{
 const h=await harness();t.after(h.close);
 const foreign=copy(h.occurrence);foreign.projection.owner={...foreign.projection.owner,actorId:'other-owner'};
 await assert.rejects(h.ports.runAdmission.admit({...copy(h.request),occurrence:foreign,occurrenceKey:occurrenceIdentity(foreign).occurrenceKey}),code('ROUTINES_OCCURRENCE_FOREIGN'));
 // The port itself refuses a key that is not the occurrence's own before any call.
 await assert.rejects(h.ports.runAdmission.admit({...copy(h.request),occurrenceKey:'a'.repeat(64)}),code('ROUTINES_OCCURRENCE_REQUEST'));
 assert.equal(h.state.requests.length,0);assert.equal(h.urls.length,1);assert.deepEqual(counts(h),{bindings:0,inputs:0,runs:0});
 await assert.rejects(h.ports.retirement.retire({binding:{...h.identity.binding,conversationId:id(4242)}}),code('ROUTINES_OCCURRENCE_NOT_SCHEDULED'));
 await assert.rejects(h.ports.retirement.retire({binding:{...h.identity.binding,actorId:'other-owner'}}),code('ROUTINES_OCCURRENCE_FOREIGN'));
 assert.deepEqual(h.calls.retire,[]);
});

test('a revoked or expired consent refuses the admission as AUTHORITY with nothing written; an unavailable Core is UNKNOWN',async t=>{
 const h=await harness();t.after(h.close);
 h.state.consent.revoked=true;await assert.rejects(h.ports.runAdmission.admit(h.request),code('SCHEDULE_ADMISSION_AUTHORITY'));h.state.consent.revoked=false;
 assert.deepEqual(counts(h),{bindings:0,inputs:0,runs:0});assert.equal(h.occurrenceState(),null);assert.deepEqual(h.phases(),['before_admission']);
 // A consent that ended is no longer a verifiable grant (exp past consentExpiresAtS): no evidence, so UNKNOWN, still nothing written.
 const expiresAtS=h.state.consent.expiresAtS;h.state.consent.expiresAtS=Math.floor(h.now()/1000)-1;
 await assert.rejects(h.ports.runAdmission.admit(h.request),code('SCHEDULE_ADMISSION_UNKNOWN'));h.state.consent.expiresAtS=expiresAtS;
 for(const status of [404,503]){h.state.status=status;await assert.rejects(h.ports.runAdmission.admit(h.request),code('SCHEDULE_ADMISSION_UNKNOWN'));}
 h.state.status=null;assert.deepEqual(counts(h),{bindings:0,inputs:0,runs:0});assert.equal(h.occurrenceState(),null);
 // Consent restored: the same occurrence admits.
 assert.equal((await h.ports.runAdmission.admit(h.request)).replayed,false);
});

test('retirement re-proves the physical stop through control only for a run of a scheduled occurrence',async t=>{
 const h=await harness();t.after(h.close);
 await h.ports.runAdmission.admit(h.request);await h.claim();
 assert.deepEqual(await h.ports.retirement.retire({binding:h.identity.binding,deadlineMs:h.now()+1000}),{physicalStopProven:true});
 assert.deepEqual(h.calls.retire,[h.identity.binding]);assert.equal(h.urls.length,2);
 const saved=await h.store.allocations.read({binding:h.identity.binding,allocationKey:hash(h.identity.binding)},()=>{});
 assert.equal(saved.record.state,'RETIRED');assert.equal(saved.record.resource.physicalStopProven,true);
 assert.deepEqual(await h.ports.retirement.retire({binding:h.identity.binding}),{physicalStopProven:true},'a repeated retirement is idempotent');
 // A retirement that cannot prove the stop is carried as the owner's own code, never as success.
 h.hooks.retire=()=>{throw Object.assign(Error('EXECUTION_ALLOCATION_CLEANUP_UNKNOWN'),{code:'EXECUTION_ALLOCATION_CLEANUP_UNKNOWN'});};
 await assert.rejects(h.ports.retirement.retire({binding:h.identity.binding}),code('EXECUTION_ALLOCATION_CLEANUP_UNKNOWN'));
 h.hooks.retire=()=>{throw Error('private failure detail');};
 await assert.rejects(h.ports.retirement.retire({binding:h.identity.binding}),e=>e.code==='NATIVE_UNAVAILABLE'&&!e.message.includes('private'));
});

test('the worker\'s composed owners dispatch, hold and settle an occurrence through control\'s admission and retirement',async t=>{
 const h=await harness();t.after(h.close);
 const owners=composeRoutinesWorkerOwners({configuration:h.configuration,pool:h.pool,client:h.temporal.client,now:h.now,transport:h.transport,...h.ports});
 const jobOwner=createScheduledJobLifecycle({store:h.store,runControl:owners.runControl,retirement:owners.retirement,now:h.now,maxRequestMs:1000});
 const dispatch=createScheduledDispatch({scheduleOwner:h.scheduleOwner,store:h.store,dispatcher:h.dispatcher,runs:h.runs,authority:owners.authority,taskInstructions:{async read(){return {instruction:h.input.request.prompt};}},
  versions:h.template.versions,runAdmission:owners.runAdmission,jobOwner,now:h.now,maxRequestMs:1000});
 const out=await dispatch.dispatch({occurrence:h.occurrence});assert.equal(out.outcome,'ACTIVE');assert.deepEqual(out.binding,h.identity.binding);
 assert.deepEqual(h.phases(),['before_admission','before_admission','before_admission','before_admission','before_start'],'worker, control x3, worker');
 assert.deepEqual(counts(h),{bindings:1,inputs:1,runs:1});assert.equal(h.temporal.workflows.size,1);assert.equal(h.occurrenceState(),'OPEN');
 assert.equal((await dispatch.dispatch({occurrence:h.occurrence})).outcome,'ACTIVE','replay admits nothing new');assert.equal(h.conversations.state.runs.size,1);
 await h.claim();await h.running();
 // Cancellation: the unattended stop (before_stop grant), then retirement through control, then the job settles.
 const cancelled=await dispatch.cancel({occurrence:h.occurrence});assert.equal(cancelled.outcome,'DISPATCHED');
 assert.equal(h.row(h.identity.binding).projection.state,'cancelled');assert.deepEqual(h.calls.retire,[h.identity.binding]);
 assert.ok(h.urls.includes(origin+'/v1/'+ROUTINES_OCCURRENCE_OPERATIONS.retire));assert.equal(h.phases().at(-1),'before_stop');assert.equal(h.occurrenceState(),'DISPATCHED');
 // The production factory refuses without the service's native client and composes the exact record with it.
 assert.throws(()=>composeRoutinesWorkerRuntimePorts({configuration:h.configuration,pool:h.pool,client:h.temporal.client}),code('SCHEDULE_SERVICE_UNAVAILABLE'));
 assert.throws(()=>composeRoutinesWorkerRuntimePorts({configuration:h.configuration,pool:h.pool,client:h.temporal.client,native:h.native,extra:1}),code('SCHEDULE_SERVICE_CONFIGURATION'));
 const record=composeRoutinesWorkerRuntimePorts({configuration:h.configuration,pool:h.pool,client:h.temporal.client,native:h.native,now:h.now});
 assert.deepEqual(Object.keys(record).sort(),['authority','client','now','pool','retirement','runAdmission','runControl']);assert.equal(record.pool,h.pool);
});

test('the native operations require the exact control capability, POST JSON and closed bodies; composition states follow the declaration',async t=>{
 const h=await harness();t.after(h.close);const url=origin+'/v1/'+ROUTINES_OCCURRENCE_OPERATIONS.retire,body=JSON.stringify({binding:h.identity.binding});
 const call=(init={},target=url)=>h.control.application.handle(new Request(target,{method:'POST',headers:{authorization:'Bearer '+CONTROL,'content-type':'application/json'},body,...init}));
 const r=await call();assert.equal(r.status,200);assert.deepEqual(await r.json(),{refused:{code:'ROUTINES_OCCURRENCE_NOT_SCHEDULED'}});
 for(const init of [{headers:{authorization:'Bearer wrong-capability','content-type':'application/json'}},{headers:{'content-type':'application/json'}},
  {headers:{authorization:'Bearer '+CONTROL,'content-type':'text/plain'}},{body:JSON.stringify({binding:h.identity.binding,extra:1})},{body:'{'}])assert.equal((await call(init)).status,503);
 assert.equal((await call({},url+'?x=1')).status,503);assert.equal(await call({},origin+'/v1/routines/occurrences/other'),null);
 const digest=capabilityDigest(CONTROL),disabled=createRoutinesOccurrenceApplication({controlCapabilitySha256:digest});
 assert.equal(disabled.state(),'disabled');assert.equal(await disabled.handle(new Request(url,{method:'POST',body})),null,'disabled: the boundary answers 404, nothing is read');
 assert.throws(()=>createRoutinesOccurrenceApplication({controlCapabilitySha256:digest,enabled:true}),code('ROUTINES_OCCURRENCE_UNAVAILABLE'));
 assert.deepEqual(Object.keys(ROUTINES_OCCURRENCE_OWNERS).sort(),['consent','retirement','template']);assert.deepEqual(ADMISSION_PHASES,['before_claim','before_accept','before_release']);
 const {routines:_,...undeclared}=h.configuration;
 assert.equal(composeRoutinesOccurrences({configuration:undeclared,controlCapabilitySha256:digest,pool:h.pool,owners:h.owners}).state,'disabled');
 assert.equal(composeRoutinesOccurrences({configuration:{...h.configuration,routines:{enabled:false,core:h.configuration.routines.core}},controlCapabilitySha256:digest,pool:h.pool,owners:h.owners}).state,'disabled');
 const {unattendedGrant:__,...cancelOnly}=h.configuration.routines.core;
 assert.equal(composeRoutinesOccurrences({configuration:{...h.configuration,routines:{enabled:true,core:{...cancelOnly,cancellationProof:coreSigner().pin}}},controlCapabilitySha256:digest,pool:h.pool,owners:h.owners}).state,'disabled');
 // Declared without the candidate's owners: mounted, every call refuses with no evidence, the worker port reports the transport fault.
 const waiting=composeRoutinesOccurrences({configuration:h.configuration,controlCapabilitySha256:digest,pool:h.pool});assert.equal(waiting.state,'owners-unavailable');assert.deepEqual(waiting.tables,[]);
 assert.equal((await waiting.application.handle(new Request(url,{method:'POST',headers:{authorization:'Bearer '+CONTROL,'content-type':'application/json'},body}))).status,503);
 const port=createRoutinesOccurrencePorts({native:createNativeCapabilityClient({configuration:{origin,maxResponseBytes:4194304},credential:CONTROL,now:h.now,fetch:async(u,i)=>await waiting.application.handle(new Request(u,i))??new Response('',{status:404})})});
 await assert.rejects(port.runAdmission.admit(h.request),code('NATIVE_UNAVAILABLE'));assert.deepEqual(counts(h),{bindings:0,inputs:0,runs:0});
 // A malformed candidate template refuses composition itself, not every later admission.
 assert.throws(()=>composeRoutinesOccurrences({configuration:h.configuration,controlCapabilitySha256:digest,pool:h.pool,owners:{...h.owners,template:{...h.template,destinationId:'ui-guessed-inbox'}}}),code('SCHEDULE_ADMISSION_CONFIGURATION'));
 assert.throws(()=>composeRoutinesOccurrences({configuration:h.configuration,controlCapabilitySha256:digest,pool:h.pool,owners:{template:h.template}}),code('ROUTINES_OCCURRENCE_CONFIGURATION'));
 assert.deepEqual(h.control.tables,['meri_schedules.projections','meri_schedules.intents','meri_schedules.occurrences','meri_conversations.initial_run_bindings','meri_conversations.initial_inputs']);
});

test('the consent authority answers the admission\'s closed receipt from the grant, never from the selection',async t=>{
 const h=await harness();t.after(h.close);
 const seen=[];const firing={async authorize(q){seen.push(q);return {authorized:true,occurrenceKey:q.occurrenceKey,owner:h.template.principal,scopes:h.scopes,checkedAtMs:h.now(),expiresAtMs:h.now()+30000};}};
 const authority=createOccurrenceConsentAuthority({firing,template:h.template,occurrence:h.occurrence,occurrenceKey:h.identity.occurrenceKey,now:h.now});
 const selection={phase:'before_claim',occurrenceKey:h.identity.occurrenceKey,binding:h.identity.binding,intentSha256:hash(h.intent),effectSha256:hash(h.effect),requestSha256:hash(h.input.request),configurationSha256:h.template.configurationSha256,
  allocationSha256:hash(h.allocation),scopes:h.scopes,selectedClientId:h.template.selectedClientId,policyRevision:h.template.policyRevision,versions:h.template.versions,task:h.template.task,destinationId:h.template.destinationId,expiresAtMs:h.now()+20000};
 const receipt=await authority.authorize({phase:'before_claim',selection,selectionSha256:hash(selection)});
 assert.deepEqual(Object.keys(receipt).sort(),['authorized','binding','checkedAtMs','configurationSha256','expiresAtMs','policyRevision','scopes','selectedClientId','selectionSha256']);
 assert.equal(receipt.authorized,true);assert.deepEqual(receipt.binding,h.identity.binding);assert.deepEqual(receipt.scopes,h.scopes);assert.equal(receipt.selectedClientId,h.template.selectedClientId);
 assert.deepEqual(seen.map(q=>q.phase),['before_admission']);assert.deepEqual(seen[0].occurrence,h.identity.identity);assert.deepEqual(seen[0].projection,h.occurrence.projection);
 const denied={async authorize(q){return {authorized:false,occurrenceKey:q.occurrenceKey,code:'SCHEDULE_AUTHORITY_REFUSED'};}};
 const r=await createOccurrenceConsentAuthority({firing:denied,template:h.template,occurrence:h.occurrence,occurrenceKey:h.identity.occurrenceKey,now:h.now}).authorize({phase:'before_accept',selection:{...selection,phase:'before_accept'},selectionSha256:hash({...selection,phase:'before_accept'})});
 assert.equal(r.authorized,false);assert.equal(Object.keys(r).length,9);
 const refused=async(firingPort,changes={},phase='before_claim')=>{const s={...selection,phase,...changes};await assert.rejects(createOccurrenceConsentAuthority({firing:firingPort,template:h.template,occurrence:h.occurrence,occurrenceKey:h.identity.occurrenceKey,now:h.now}).authorize({phase,selection:s,selectionSha256:hash(s)}),/ROUTINES_OCCURRENCE_(REQUEST|AUTHORITY)/u);};
 await refused(firing,{},'before_admission');await refused(firing,{occurrenceKey:'b'.repeat(64)});await refused(firing,{binding:{...h.identity.binding,runId:id(77)}});await refused(firing,{selectedClientId:id(78)});
 await refused(firing,{policyRevision:'other'});await refused(firing,{configurationSha256:'d'.repeat(64)});await refused(firing,{scopes:[...h.scopes,{...h.scopes[0],resourceId:id(79)}]});
 const grant=changes=>({async authorize(q){return {authorized:true,occurrenceKey:q.occurrenceKey,owner:h.template.principal,scopes:h.scopes,checkedAtMs:h.now(),expiresAtMs:h.now()+30000,...changes};}});
 await refused(grant({scopes:[{...h.scopes[0],resourceId:id(80)}]}));await refused(grant({scopes:[{...h.scopes[0],policyRevision:'other'}]}));await refused(grant({owner:{tenantId:'tenant-a',actorId:'other'}}));
 await refused(grant({occurrenceKey:'c'.repeat(64)}));await refused(grant({expiresAtMs:h.now()}));await refused(grant({extra:1}));await refused({async authorize(){return {authorized:true};}});
 assert.throws(()=>createOccurrenceConsentAuthority({firing,template:h.template,occurrence:h.occurrence,occurrenceKey:'a'.repeat(64)}),code('ROUTINES_OCCURRENCE_CONFIGURATION'));
 assert.throws(()=>createOccurrenceConsentAuthority({firing:{},template:h.template,occurrence:h.occurrence,occurrenceKey:h.identity.occurrenceKey}),code('ROUTINES_OCCURRENCE_CONFIGURATION'));
});

test('the worker port refuses open replies, carries typed refusals and needs a native client',async t=>{
 const h=await harness();t.after(h.close);
 const reply=value=>createRoutinesOccurrencePorts({native:{async call(){return value;}}});
 const admitted={binding:h.identity.binding,requestSha256:hash(h.input.request),expiresAtMs:h.now()+1000,replayed:false};
 assert.deepEqual(await reply({admitted}).runAdmission.admit(h.request),admitted);
 for(const value of [{admitted:{...admitted,binding:{...h.identity.binding,runId:id(99)}}},{admitted:{...admitted,requestSha256:'e'.repeat(64)}},{admitted:{...admitted,replayed:'no'}},{admitted,extra:1},{admitted:{...admitted,extra:1}},{},null,'started',{refused:{code:'bad code'}},{refused:{}}])
  await assert.rejects(reply(value).runAdmission.admit(h.request),code('ROUTINES_OCCURRENCE_REPLY'));
 for(const value of [{retired:{physicalStopProven:false}},{retired:{}},{admitted},{retired:{physicalStopProven:true},refused:{code:'X'}}])await assert.rejects(reply(value).retirement.retire({binding:h.identity.binding}),code('ROUTINES_OCCURRENCE_REPLY'));
 await assert.rejects(reply({refused:{code:'SCHEDULE_ADMISSION_STALE'}}).runAdmission.admit(h.request),code('SCHEDULE_ADMISSION_STALE'));
 await assert.rejects(reply({refused:{code:'PREPARED_RUN_BINDINGS_INITIAL_STOP_REFUSED'}}).retirement.retire({binding:h.identity.binding}),code('PREPARED_RUN_BINDINGS_INITIAL_STOP_REFUSED'));
 const sent=[];const recorder=createRoutinesOccurrencePorts({native:{async call(operation,input,options){sent.push({operation,input,options});return {retired:{physicalStopProven:true}};}}});
 await recorder.retirement.retire({binding:h.identity.binding,deadlineMs:h.now()+500});
 assert.deepEqual(sent,[{operation:'routines/occurrences/retire',input:{binding:h.identity.binding},options:{deadlineMs:h.now()+500}}]);
 await assert.rejects(recorder.runAdmission.admit({...h.request,input:{...h.input,extra:1}}),code('ROUTINES_OCCURRENCE_REQUEST'));
 await assert.rejects(recorder.retirement.retire({binding:{...h.identity.binding,tenantId:''}}),code('ROUTINES_OCCURRENCE_REQUEST'));assert.equal(sent.length,1);
 assert.throws(()=>createRoutinesOccurrencePorts({}),code('ROUTINES_OCCURRENCE_UNAVAILABLE'));assert.throws(()=>createRoutinesOccurrencePorts({native:{call:'synthetic'}}),code('ROUTINES_OCCURRENCE_UNAVAILABLE'));
 // The trust record and scope grammar the worker's authority shares with control are the same pin.
 assert.equal(routineFiringTrust(h.signer.pin).kid,'routine-fire-1');
});
