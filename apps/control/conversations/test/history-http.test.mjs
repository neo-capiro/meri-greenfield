/** SYNTHETIC public Fetch composition: canonical sessions, next-run/store journals, membership and scripted SQL. No real DB/services. */
import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,binding,scopes,versions,id} from './application-fixture.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {createNextRunOwner} from '../next-run.mjs';
import {createMembershipGate} from '../../product-access/membership.mjs';
import {ProductError} from '../../product-access/errors.mjs';
import {createConversationHistoryService} from '../history/service.mjs';
import {createConversationHistoryApplication} from '../history/http.mjs';
import {hash} from '../boundary.mjs';
import {createMemoryRetentionJournal} from '../../retention/memory-journal.mjs';
import {createRetentionReadGate,createSuppressionOwner} from '../../retention/suppression.mjs';
import {createServingGate} from '../../retention/reconciliation.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../../retention/ledger.mjs';
import {lifecycleFixture} from './lifecycle-fixture.mjs';
import {allocateOriginal} from './terminal-settlement-harness.mjs';
import {createNativeLifecycleAdmission} from '../../../runtime/product-ports/lifecycle.mjs';
import {continuesSession} from '../../../../packages/contracts/session-continuity.mjs';
import {assertConversationHistoryResponse} from '../../../../packages/contracts/conversation-history/validate.mjs';
import {assertContinuationEnvelope} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
/** The actor's private scope, the only General conversation scope (assertNativeConversationScope). */
const privateScopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:scopes[0].policyRevision}];
async function fixture({lifecycle=false,extraClient=false,general=false}={}){
 const f=await (lifecycle?lifecycleFixture({extraClient,scopes:general?privateScopes:undefined,selectedClientId:general?null:undefined}):applicationFixture({initialInput:true})),state=f.state;let serial=1000;
 if(!lifecycle){const original=f.service;let initialAllocation;
  // The original submit requires the canonical durable input allocation; successors already have next-run reservations.
  f.service={...original,async submit(call){if(state.runs.size===0){initialAllocation??=original.allocateInput({credential:call.credential,input:call.input});await initialAllocation;}return original.submit(call);}};
 }
 // Script only the two newly added read queries; canonical write/next-run SQL keeps its existing independent fixture.
 const pool={async connect(){const c=await f.pool.connect();return {...c,async query(sql,p){
  if(sql.startsWith('SELECT * FROM meri_conversations.controls')&&!sql.includes('FOR UPDATE'))await state.onHistoryCustodyRead?.();
  if(sql.includes('owner_actor_id=$2'))return {rows:[...state.conversations.values()].filter(r=>r.tenant_id===p[0]&&r.owner_actor_id===p[1]&&r.projection.scopes.every(s=>s.kind!=='client'||p[2].includes(s.resourceId)))
   .sort((a,b)=>b.projection.createdAt.localeCompare(a.projection.createdAt)||b.conversation_id.localeCompare(a.conversation_id))
   .filter(r=>p[3]===null||r.projection.createdAt<p[3]||r.projection.createdAt===p[3]&&r.conversation_id<p[4]).slice(0,p[5])};
  if(sql.startsWith('SELECT e.*')){await state.onHistoryRead?.();const entries=[];for(const r of state.runs.values())if(r.tenant_id===p[0]&&r.conversation_id===p[1])for(const e of state.events.get([r.tenant_id,r.conversation_id,r.run_id].join(':'))??[])
   entries.push({...e,tenant_id:r.tenant_id,conversation_id:r.conversation_id,run_id:r.run_id,global:r.sequence_base+e.sequence});
   return {rows:entries.sort((a,b)=>a.global-b.global).filter(e=>e.global>p[2]).slice(0,p[3])};}
  return c.query(sql,p);
 }};}};
 const store=createPostgresConversationStore({pool}),owner=createNextRunOwner({store,versions,newId:()=>id(serial++)});
 state.member={tenantId:binding.tenantId,actorId:binding.actorId,status:'active',role:'member',permissions:[],clientIds:extraClient?[id(5),id(7)]:[id(5)],membershipRevision:'m1'};
 state.memberCredentialReads=[];const gate=createMembershipGate({now:Date.now,limits:{maxRequestMs:1000,maxFactBytes:65536},verifyToken:async({credential})=>{if(credential!=='native')throw Error('invalid');return {tenantId:state.member.tenantId,actorId:state.member.actorId,checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};},
  readMembership:async({credential})=>{state.memberCredentialReads.push(credential);await state.onMembershipRead?.(state.memberCredentialReads.length);return {...state.member,checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};}});
 state.retentionChecks=0;const memoryJournal=createMemoryRetentionJournal(),journal={...memoryJournal,withTransition(key,fn){state.onRetentionTransition?.(key);return memoryJournal.withTransition(key,fn);}},serving=createServingGate();
 const retentionGate=createRetentionReadGate({journal:{...journal,async get(key){return state.suppressed?{state:'SUPPRESSED'}:journal.get(key);}},serving});
 const observeRetention=async(subject,assert)=>{state.retentionChecks++;await state.onRetentionRead?.(subject);return assert(subject);};
 const retention={...retentionGate,
  assertServable:subject=>observeRetention(subject,retentionGate.assertServable),
  withRelease:(subjects,release,options)=>retentionGate.withRelease(subjects,(signal,assertLocked)=>release(signal,subject=>observeRetention(subject,assertLocked)),options)};
 const retentionOwner=createSuppressionOwner({journal,serving,ledger:createRetentionLedger({sink:createMemoryLedgerSink(),now:Date.now}),ownership:{async ownerOf(){return binding.actorId;}},now:Date.now});
 state.coreState='active';state.coreClientId=id(5);state.coreReads=[];
 const currentness={async assertCurrent({credential,principal,conversationId,scopes,signal,deadlineMs}){
  state.coreReads.push({credential,principal,conversationId,scopes,signal,deadlineMs});await state.onCoreRead?.();
  if(state.coreError)throw state.coreError;
  if(credential!=='native'||principal.tenantId!==binding.tenantId||principal.actorId!==binding.actorId||conversationId!==binding.conversationId&&![...state.conversations.values()].some(row=>row.conversation_id===conversationId)||
   !scopes.some(scope=>scope.tenantId===principal.tenantId&&(general?scope.kind==='private-user'&&scope.resourceId===principal.actorId:scope.kind==='client'&&scope.resourceId===state.coreClientId))||state.coreState!=='active')throw Error('Core context unavailable');
 }};
 const turnOwner={async admitTurn(input){const result=await owner.admitTurn(input);await state.onTurnAdmitted?.();return result;}};
 const service=createConversationHistoryService({store,nextRunOwner:turnOwner,gate,retention}),app=createConversationHistoryApplication({service,gate,currentness,now:Date.now,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const post=async(path,body,token='native')=>{const response=await app.handle(new Request(`https://meri.invalid/api/conversations/${path}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}));
  if(response.status===200)assertConversationHistoryResponse(path==='next-turn'?'nextTurn':path,await response.clone().json(),body);return response;};
 async function turn(n){const source=state.context.binding;if(n===1)await f.service.submit({credential:f.credential,input:f.input});
  const issued=n===1?{credential:f.credential}:await f.sessions.issue({identityCredential:'synthetic-native'});
  if(n!==1)await f.service.submit({credential:issued.credential,input:{requestId:id(serial++),prompt:`prompt ${n}`}});
  await f.service.cancel({credential:issued.credential});
  const admitted=await owner.admitTurn({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,sourceRunId:source.runId});
  state.context.binding=admitted.targetBinding;return {source,admitted};
 }
 return {...f,store,owner,post,turn,gate,currentness,historyService:service,retentionOwner};
}
test('history enforces its public byte caps when startup permits larger transport limits',async()=>{
 const f=await fixture();try{let calls=0,retained;const app=createConversationHistoryApplication({gate:f.gate,currentness:f.currentness,now:Date.now,limits:{maxRequestMs:2000,maxRequestBytes:1048576,maxResponseBytes:8388608},service:{async list(call){assert.equal(Object.hasOwn(call,'credential'),false);assert.equal(typeof call.recheckConversation,'function');retained=call.recheckConversation;calls++;return {oversized:'x'.repeat(2097152)};}}});
  const post=body=>app.handle(new Request('https://meri.invalid/api/conversations/list',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body}));
  assert.equal((await post('{}'+' '.repeat(131071))).status,413);assert.equal(calls,0);
  const response=await post('{}');assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:{code:'PRODUCT_UNAVAILABLE'}});assert.equal(calls,1);
  await assert.rejects(retained({conversationId:binding.conversationId,scopes}));assert.equal(f.state.coreReads.length,0,'closed requests cannot reuse the native bearer');
 }finally{f.close();}
});
test('three turns page and reload over one monotonic cursor while original UIEvent sequences and requests stay intact',async()=>{
 const f=await fixture();try{await f.turn(1);await f.turn(2);await f.turn(3);let after=0,seen=[],requests=new Map();
  do{const response=await f.post('transcript',{conversationId:binding.conversationId,after,limit:3});assert.equal(response.status,200);const page=await response.json();
   for(const t of page.turns)requests.set(t.run.binding.runId,t.request);seen.push(...page.events);after=page.nextSequence;
   assert.equal(page.pendingTurn.state,'RESERVED');assert.equal(page.latestRun.binding.runId,f.state.runs.values().toArray().at(-1).run_id);
   if(!page.hasMore)break;
  }while(true);
  assert.deepEqual(seen.map(e=>e.sequence),[1,2,3,4,5,6]);assert.deepEqual(seen.map(e=>e.event.sequence),[1,2,1,2,1,2]);
  assert.deepEqual([...requests.values()].map(r=>r.prompt),['Hello','prompt 2','prompt 3']);
  const reload=await (await f.post('transcript',{conversationId:binding.conversationId,after:4})).json();assert.deepEqual(reload.events.map(e=>e.sequence),[5,6]);
  const ack=await (await f.post('transcript',{conversationId:binding.conversationId,after:6})).json();assert.deepEqual(ack.events,[]);assert.equal(ack.nextSequence,6);
  assert.equal((await f.post('transcript',{conversationId:binding.conversationId,after:7})).status,400);
  await assert.rejects(f.store.append(binding,{eventId:id(1990),createdAt:new Date().toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'late'}},()=>{}),/RUN_RANGE_CLOSED/);
 }finally{f.close();}
});
test('lost turn ACK and later replay recover the same source mapping without a new reservation',async()=>{
 const f=await fixture();try{const first=await f.turn(1),before=f.state.nextRuns.size;
  const replay=await (await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId})).json();assert.deepEqual(replay.targetBinding,first.admitted.targetBinding);assert.equal(replay.replayed,true);assert.equal(f.state.nextRuns.size,before);
  await f.turn(2);await f.turn(3);const accepted=await (await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId})).json();
  assert.equal(accepted.state,'ACCEPTED');assert.deepEqual(accepted.targetBinding,first.admitted.targetBinding);assert.equal(f.state.nextRuns.size,3);
  await assert.rejects(f.owner.currentRun(accepted.targetBinding),/NEXT_RUN_NOT_LATEST/,'historical replay grants no writer authority');
 }finally{f.close();}
});

test('next-turn uses the same native bearer for membership before effect and final release',async()=>{
 const f=await fixture();try{await f.turn(1);const response=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId});assert.equal(response.status,200);assert.deepEqual(f.state.memberCredentialReads,['native','native','native']);}finally{f.close();}
});
test('history requires a read-only currentness owner and confines the native bearer to product HTTP',async()=>{
 const f=await fixture();try{
  assert.throws(()=>createConversationHistoryApplication({service:f.historyService,gate:f.gate,now:Date.now,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}}),/PRODUCT_CONFIGURATION/);
  await f.service.submit({credential:f.credential,input:f.input});
  const response=await f.post('transcript',{conversationId:binding.conversationId});assert.equal(response.status,200);
  assert.equal(f.state.coreReads.length,1,'read-only transcript checks Core once inside final fenced release');assert.equal(f.state.coreReads[0].credential,'native');assert.deepEqual(f.state.coreReads[0].scopes,scopes);
 }finally{f.close();}
});
test('archived or unavailable Core context withholds saved pages and cannot admit a next turn',async()=>{
 const f=await fixture();try{await f.service.submit({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});
  const before=f.state.nextRuns.size;
  for(const coreState of ['archived','unavailable']){
   f.state.coreState=coreState;
   for(const path of ['list','transcript','next-turn']){
    const response=await f.post(path,path==='list'?{}:{conversationId:binding.conversationId,...(path==='next-turn'?{sourceRunId:binding.runId}:{})});
    assert.equal(response.status,503,`${coreState} ${path}`);const body=await response.json();assert.equal(body.error.code,'CONVERSATION_UNAVAILABLE');
    if(path==='next-turn')assert.equal(body.error.outcome,'NOT_DISPATCHED');
   }
   assert.equal(f.state.nextRuns.size,before);
  }
 }finally{f.close();}
});
test('Core client mismatch refuses transcript and next-turn even with saved ownership',async()=>{
 const f=await fixture();try{await f.service.submit({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});
  f.state.coreClientId=id(88);const before=f.state.nextRuns.size;
  for(const path of ['transcript','next-turn']){const response=await f.post(path,{conversationId:binding.conversationId,...(path==='next-turn'?{sourceRunId:binding.runId}:{})});assert.equal(response.status,503);}
  assert.equal(f.state.nextRuns.size,before);
 }finally{f.close();}
});
test('saved conversations with multiple client scopes use configured Core client authority',async()=>{
 const f=await fixture({lifecycle:true,extraClient:true});try{await f.running();
  const transcript=await f.post('transcript',{conversationId:binding.conversationId});assert.equal(transcript.status,200);
  assert.equal((await transcript.json()).conversation.scopes.length,2);assert.deepEqual(f.state.coreReads.at(-1).scopes,f.state.context.scopes);
  const list=await f.post('list',{});assert.equal(list.status,200);assert.equal((await list.json()).conversations.length,1);
 }finally{f.close();}
});
test('Core archive after saved read withholds transcript; archive after turn admission withholds its result',async()=>{
 const f=await fixture();try{await f.service.submit({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});
  f.state.onHistoryRead=()=>{f.state.coreState='archived';};
  const withheld=await f.post('transcript',{conversationId:binding.conversationId});assert.equal(withheld.status,503);assert.equal((await withheld.json()).error.code,'CONVERSATION_UNAVAILABLE');
  f.state.onHistoryRead=null;f.state.coreState='active';f.state.onTurnAdmitted=()=>{f.state.coreState='archived';};
  const before=f.state.nextRuns.size,response=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId});
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE',outcome:'RESULT_NOT_RELEASED'}});
  assert.equal(f.state.nextRuns.size,before+1,'the accepted mapping remains durable after result withholding');
  f.state.onTurnAdmitted=null;f.state.coreState='active';
  const replay=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId});assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);assert.equal(f.state.nextRuns.size,before+1);
 }finally{f.close();}
});
test('owned Core denial after turn admission retains its code and RESULT_NOT_RELEASED',async()=>{
 const f=await fixture();try{await f.service.submit({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});
  f.state.onTurnAdmitted=()=>{f.state.coreError=new ProductError('ACCESS_DENIED','UNKNOWN');};
  const before=f.state.nextRuns.size,response=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId});
  assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:{code:'ACCESS_DENIED',outcome:'RESULT_NOT_RELEASED'}});
  assert.equal(f.state.nextRuns.size,before+1);
 }finally{f.close();}
});
test('a Stop whose claimed original is not yet retired answers next-turn with a retryable NOT_DISPATCHED conflict and no reservation',async()=>{
 const f=await fixture();try{await f.service.submit({credential:f.credential,input:f.input});await allocateOriginal(f.store,binding);await f.service.cancel({credential:f.credential});
  const response=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId});
  assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_TURN_CONFLICT',outcome:'NOT_DISPATCHED'}});assert.equal(f.state.nextRuns.size,0);
 }finally{f.close();}
});
test('membership revoked after saved read refuses next-turn before admission',async()=>{
 const f=await fixture();try{await f.service.submit({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});
  f.state.onCoreRead=()=>{f.state.member.status='removed';};const before=f.state.nextRuns.size;
  const response=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId});
  assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:{code:'MEMBERSHIP_REVOKED',outcome:'NOT_DISPATCHED'}});
  assert.equal(f.state.nextRuns.size,before);
 }finally{f.close();}
});
for(const field of ['tenant','actor','client'])test(`current ${field} denial prevents disclosure or next-turn effects`,async()=>{
 const f=await fixture();try{await f.turn(1);const before=f.state.nextRuns.size;
  if(field==='tenant')f.state.member.tenantId='other';if(field==='actor')f.state.member.actorId='other';if(field==='client')f.state.member.clientIds=[];
  const listed=await (await f.post('list',{})).json();assert.deepEqual(listed.conversations,[]);
  for(const path of ['transcript','next-turn']){const response=await f.post(path,{conversationId:binding.conversationId,...(path==='next-turn'?{sourceRunId:binding.runId}:{})});assert.equal(response.status,404);}
  assert.equal(f.state.nextRuns.size,before);
 }finally{f.close();}
});
test('member removal and retention suppression refuse history release',async()=>{
 const f=await fixture();try{await f.turn(1);f.state.member.status='removed';assert.equal((await f.post('transcript',{conversationId:binding.conversationId})).status,403);
  f.state.member.status='active';f.state.suppressed=true;assert.equal((await f.post('transcript',{conversationId:binding.conversationId})).status,503);assert.deepEqual((await (await f.post('list',{})).json()).conversations,[]);
 }finally{f.close();}
});
for(const path of ['transcript','list'])test(`suppression during awaited Core currentness withholds saved ${path}`,async()=>{
 const f=await fixture();try{await f.turn(1);f.state.retentionChecks=0;f.state.coreReads=[];const retentionOrder=[];f.state.onRetentionRead=()=>retentionOrder.push(f.state.coreReads.length);
  f.state.onCoreRead=async()=>{await Promise.resolve();f.state.suppressed=true;};
  const response=await f.post(path,path==='list'?{}:{conversationId:binding.conversationId});
  if(path==='list'){assert.equal(response.status,200);assert.deepEqual((await response.json()).conversations,[]);}
  else{assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE'}});}
  assert.equal(f.state.retentionChecks,path==='transcript'?3:2,'all prior retention checks plus the post-Core fence check remain');
  assert.deepEqual(retentionOrder,path==='transcript'?[0,0,1]:[0,1],'retention is checked again after the only fresh Core observation');
 }finally{f.close();}
});
test('suppression during final next-turn Core currentness withholds its admitted result',async()=>{
 const f=await fixture();try{await f.service.submit({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});
  f.state.coreReads=[];f.state.onCoreRead=async()=>{if(f.state.coreReads.length===3){await Promise.resolve();f.state.suppressed=true;}};
  const before=f.state.nextRuns.size,response=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId});
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE',outcome:'RESULT_NOT_RELEASED'}});
  assert.equal(f.state.nextRuns.size,before+1,'admission remains durable after result withholding');
 }finally{f.close();}
});
test('suppression during pre-admission next-turn Core currentness prevents reservation',async()=>{
 const f=await fixture();try{await f.service.submit({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});
  f.state.coreReads=[];f.state.onCoreRead=async()=>{if(f.state.coreReads.length===2){await Promise.resolve();f.state.suppressed=true;}};
  const before=f.state.nextRuns.size,response=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId});
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE',outcome:'NOT_DISPATCHED'}});
  assert.equal(f.state.nextRuns.size,before);
 }finally{f.close();}
});
test('forged cursor, scope hints, corrupt event and identity substitution cannot become a successful page',async()=>{
 const f=await fixture();try{await f.turn(1);
  assert.equal((await f.post('transcript',{conversationId:binding.conversationId,after:-1})).status,400);
  assert.equal((await f.post('list',{tenantId:binding.tenantId})).status,400);
  assert.equal((await f.post('list',{},'forged')).status,403);
  const e=f.state.events.values().next().value[0];e.event.binding.actorId='other';e.event_sha256=hash(e.event);
  assert.equal((await f.post('transcript',{conversationId:binding.conversationId})).status,500);
 }finally{f.close();}
});
test('discovery cursor pages owned conversations deterministically without dropping identity',async()=>{
 const f=await fixture();try{await f.turn(1);const b={...binding,conversationId:id(2000),runId:id(2001),attemptId:id(2002),workerId:id(2003)},createdAt='2026-10-15T00:00:00.000Z';
  const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes,createdAt,policyRevision:'policy1'},run={binding:b,versions,scopes,createdAt,policyRevision:'policy1',state:'queued'};
  await f.store.accept({conversation,run,request:{requestId:id(2004),prompt:'older',skill:null,window:null,windowRequest:null},event:{contractVersion:'0.1.0',eventId:id(2005),binding:b,scopes,sequence:1,createdAt,type:'run.status',data:{state:'queued',reasonCode:null}}},()=>{});
  const first=await (await f.post('list',{limit:1})).json();assert.equal(first.conversations[0].conversationId,binding.conversationId);assert.ok(first.nextBefore);
  const second=await (await f.post('list',{limit:1,before:first.nextBefore})).json();assert.equal(second.conversations[0].conversationId,b.conversationId);assert.equal(second.nextBefore,null);
 }finally{f.close();}
});
test('concurrent explicit turn admission reserves exactly one durable target',async()=>{
 const f=await fixture();try{await f.service.submit({credential:f.credential,input:f.input});await f.service.cancel({credential:f.credential});
  const pages=await Promise.all(Array.from({length:3},async()=>{const response=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:binding.runId});assert.equal(response.status,200);return response.json();}));
  assert.equal(new Set(pages.map(p=>p.targetBinding.runId)).size,1);assert.equal(f.state.nextRuns.size,1);assert.equal(f.state.runs.size,1);
 }finally{f.close();}
});
test('submit ACK recovery keeps exact request identity and refuses prompt substitution or a new turn on its queued target',async()=>{
 const f=await fixture();try{const {admitted}=await f.turn(1),issued=await f.sessions.issue({identityCredential:'synthetic-native'}),input={requestId:id(2200),prompt:'immutable next prompt'};
  f.state.startUnknown=true;await assert.rejects(f.service.submit({credential:issued.credential,input}));assert.equal(f.state.runs.size,2);
  f.state.startUnknown=false;const recovered=await f.service.submit({credential:issued.credential,input});assert.equal(recovered.replayed,true);assert.deepEqual(recovered.run.binding,admitted.targetBinding);
  await assert.rejects(f.service.submit({credential:issued.credential,input:{...input,prompt:'substituted'}}),/REQUEST_REPLAY_REFUSED/);
  const refused=await f.post('next-turn',{conversationId:binding.conversationId,sourceRunId:admitted.targetBinding.runId});assert.equal(refused.status,409);
  assert.deepEqual(await refused.json(),{error:{code:'CONVERSATION_TURN_CONFLICT',outcome:'NOT_DISPATCHED'}});assert.equal(f.state.nextRuns.size,1);
 }finally{f.close();}
});
for(const [path,input] of [['list',{limit:null}],['transcript',{conversationId:binding.conversationId,limit:null}],['transcript',{conversationId:binding.conversationId,after:null}]])
 test(`explicit null ${path} ${Object.hasOwn(input,'after')?'after':'limit'} is refused without coercion`,async()=>{
  const f=await fixture();try{await f.turn(1);const response=await f.post(path,input);assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_CURSOR_INVALID'}});}
  finally{f.close();}
 });

for(const field of ['actor','client'])for(const suppressed of [false,true])test(`foreign ${field}, suppression ${suppressed}: ownership denial has no retention observation`,async()=>{
 const f=await fixture();try{await f.turn(1);f.state.suppressed=suppressed;f.state.retentionChecks=0;
  if(field==='actor')f.state.member.actorId='other';else f.state.member.clientIds=[];
  for(const path of ['transcript','next-turn']){const response=await f.post(path,{conversationId:binding.conversationId,...(path==='next-turn'?{sourceRunId:binding.runId}:{})});assert.equal(response.status,404);assert.equal((await response.json()).error.code,'CONVERSATION_NOT_FOUND');}
  assert.equal(f.state.retentionChecks,0);
 }finally{f.close();}
});

test('membership revision changed during canonical read withholds the page with canonical409',async()=>{
 const f=await fixture();try{await f.turn(1);f.state.onHistoryRead=()=>{f.state.member.membershipRevision='m2';};const response=await f.post('transcript',{conversationId:binding.conversationId});
  assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:{code:'MEMBERSHIP_CHANGED'}});
 }finally{f.close();}
});

for(const path of ['transcript','list','next-turn'])test(`suppression during final membership recheck withholds ${path} result`,async()=>{
 const f=await fixture();try{
  if(path==='next-turn')await f.turn(1);else await f.service.submit({credential:f.credential,input:f.input});
  const reservations=f.state.nextRuns.size;
  f.state.onMembershipRead=count=>{if(count===(path==='next-turn'?3:2))f.state.suppressed=true;};
  const response=await f.post(path,path==='list'?{}:{conversationId:binding.conversationId,...(path==='next-turn'?{sourceRunId:binding.runId}:{})});
  assert.equal(f.state.suppressed,true,'suppression occurs after the service has returned its result');
  const body=await response.json();
  if(path==='list'){assert.equal(response.status,200);assert.deepEqual(body.conversations,[]);}
  else{assert.equal(response.status,503);assert.deepEqual(body,{error:{code:'CONVERSATION_UNAVAILABLE',...(path==='next-turn'?{outcome:'RESULT_NOT_RELEASED'}:{})}});}
  assert.equal(f.state.nextRuns.size,reservations,'the final release check never redispatches or repeats admission');
 }finally{f.close();}
});

for(const corrupt of ['conversation-shape','run-shape','request-hash','event-shape','pending-shape',...['scopes','versions','facts','policyRevision','reservedAt'].map(k=>'pending-missing-'+k)])test(`canonical ${corrupt} is an integrity500, without foreign database details`,async()=>{
 const f=await fixture();try{await f.turn(1);const r=f.state.runs.values().next().value;
  if(corrupt==='conversation-shape'){const c=f.state.conversations.values().next().value;c.projection.createdAt='invalid';c.projection_sha256=hash(c.projection);}
  if(corrupt==='run-shape'){r.projection.state='invalid';r.projection_sha256=hash(r.projection);}
  if(corrupt==='request-hash')r.request_sha256='0'.repeat(64);
  if(corrupt==='event-shape'){const e=f.state.events.values().next().value[0];e.event.sequence='bad';e.event_sha256=hash(e.event);}
  if(corrupt==='pending-shape')f.state.nextRuns.values().next().value.reservation=null;
  if(corrupt.startsWith('pending-missing-')){const p=f.state.nextRuns.values().next().value;delete p.reservation[corrupt.slice('pending-missing-'.length)];p.reservation_sha256=hash(p.reservation);}
  const response=await f.post('transcript',{conversationId:binding.conversationId});assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_STORE_CORRUPT'}});
 }finally{f.close();}
});

async function continued(f,mode){await f.running();const pause=id(2300);await f.control({controlId:pause,intent:'pause'});await f.claim(pause);await f.checkpoint(pause);
 const proof=f.proofs.get(binding.runId);assert.equal(proof.kind,'native-session');return f.control({controlId:id(2301),intent:mode,checkpointId:proof.checkpointId,checkpointSha256:proof.checkpointSha256});}

test('native resume, lost receipt and reload retain one logical prompt; identical-text new turn remains distinct',async()=>{
 const f=await fixture({lifecycle:true});try{const result=await continued(f,'resume');assert.equal(result.state,'APPLIED');assert.equal(f.state.runs.size,2);
  const response=await f.post('transcript',{conversationId:binding.conversationId});assert.equal(response.status,200);const first=await response.json();
  assert.equal(first.turns.length,2);assert.notEqual(first.turns[0].request.requestId,first.turns[1].request.requestId);assert.equal(new Set(first.turns.map(t=>t.promptLineage.logicalRequestId)).size,1);
  assert.deepEqual(first.turns[1].promptLineage,{kind:'resume',logicalRequestId:first.turns[0].request.requestId,sourceBinding:binding,sourceRequestId:first.turns[0].request.requestId});
  const reload=await (await f.post('transcript',{conversationId:binding.conversationId})).json();assert.deepEqual(reload.turns,first.turns);assert.equal(f.state.runs.size,2,'lost lifecycle receipt recovered by read, not a second successor');
  const paged=[];let after=0;for(;;){const page=await (await f.post('transcript',{conversationId:binding.conversationId,after,limit:1})).json();paged.push(...page.turns);after=page.nextSequence;if(!page.hasMore)break;}
  assert.equal(new Set(paged.map(t=>t.promptLineage.logicalRequestId)).size,1);
  f.state.context.binding=result.targetBinding;const session=await f.sessions.issue({identityCredential:'synthetic-native'});await f.service.cancel({credential:session.credential});
  const admitted=await f.owner.admitTurn({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,sourceRunId:result.targetBinding.runId});
  f.state.context.binding=admitted.targetBinding;const next=await f.sessions.issue({identityCredential:'synthetic-native'});await f.service.submit({credential:next.credential,input:{requestId:id(2302),prompt:'Hello'}});
  const final=await (await f.post('transcript',{conversationId:binding.conversationId})).json();assert.equal(final.turns.length,3);assert.equal(new Set(final.turns.map(t=>t.request.prompt)).size,1);assert.equal(new Set(final.turns.map(t=>t.promptLineage.logicalRequestId)).size,2);
  assert.deepEqual(final.turns.at(-1).promptLineage,{kind:'submission',logicalRequestId:id(2302),sourceBinding:null,sourceRequestId:null});
 }finally{f.close();}
});

test('native fork starts a conversation-local prompt identity while retaining exact external source lineage',async()=>{
 const f=await fixture({lifecycle:true});try{const result=await continued(f,'fork'),response=await f.post('transcript',{conversationId:result.targetBinding.conversationId});assert.equal(response.status,200);const page=await response.json();
  assert.equal(page.turns.length,1);const t=page.turns[0];assert.deepEqual(t.promptLineage,{kind:'fork',logicalRequestId:t.request.requestId,sourceBinding:binding,sourceRequestId:f.input.requestId});assert.equal(t.sequenceBase,0);
 }finally{f.close();}
});

for(const corrupt of ['digest','request','source-binding','context'])test(`resumed canonical ${corrupt} substitution refuses prompt lineage`,async()=>{
 const f=await fixture({lifecycle:true});try{const result=await continued(f,'resume'),row=[...f.state.runs.values()].find(r=>r.run_id===result.targetBinding.runId);
  if(corrupt==='digest')row.continuation_sha256='0'.repeat(64);
  if(corrupt==='request')row.continuation.sourceRequest.prompt='substituted';
  if(corrupt==='source-binding'){const envelope=row.continuation.continuation;delete envelope.files;envelope.sdkSession.binding.workerId=id(2399);}
  if(corrupt==='context')row.continuation.continuation.contextSha256='0'.repeat(64);
  if(corrupt!=='digest')row.continuation_sha256=hash(row.continuation);
  const response=await f.post('transcript',{conversationId:binding.conversationId});assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_STORE_CORRUPT'}});
 }finally{f.close();}
});

for(const mode of ['resume','fork'])for(const corrupt of ['actor','scope','versions'])test(`native ${mode} rehashed ${corrupt} substitution refuses prompt lineage`,async()=>{
 const f=await fixture({lifecycle:true});try{const result=await continued(f,mode),row=[...f.state.runs.values()].find(r=>r.run_id===result.targetBinding.runId),envelope=row.continuation.continuation;
  // File custody is optional in this contract. Remove it so the independently valid native envelope reaches the history join.
  delete envelope.files;
  if(corrupt==='actor')envelope.sdkSession.binding.actorId=id(2399);
  if(corrupt==='scope')envelope.scopes[0].resourceId=id(2399);
  if(corrupt==='versions')envelope.versions.imageDigest='sha256:'+'f'.repeat(64);
  assertContinuationEnvelope(envelope);
  row.continuation_sha256=hash(row.continuation);
  const response=await f.post('transcript',{conversationId:result.targetBinding.conversationId});assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_STORE_CORRUPT'}});
 }finally{f.close();}
});

for(const path of ['transcript','list','next-turn'])test(`Core archive during final membership withholds ${path} at release`,async()=>{
 const f=await fixture();try{
  if(path==='next-turn')await f.turn(1);else await f.service.submit({credential:f.credential,input:f.input});
  const reservations=f.state.nextRuns.size;f.state.onMembershipRead=count=>{if(count===(path==='next-turn'?3:2))f.state.coreState='archived';};
  const response=await f.post(path,path==='list'?{}:{conversationId:binding.conversationId,...(path==='next-turn'?{sourceRunId:binding.runId}:{})});
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE',...(path==='next-turn'?{outcome:'RESULT_NOT_RELEASED'}:{})}});
  assert.equal(f.state.nextRuns.size,reservations);
 }finally{f.close();}
});

test('one list release fence holds every subject through final authorization and response serialization',async()=>{
 const f=await fixture();let suppression;try{await f.turn(1);
  const other={...binding,conversationId:id(2500),runId:id(2501),attemptId:id(2502),workerId:id(2503)},createdAt='2026-10-15T00:00:00.000Z';
  const conversation={conversationId:other.conversationId,owner:{tenantId:other.tenantId,actorId:other.actorId},scopes,createdAt,policyRevision:'policy1'},run={binding:other,versions,scopes,createdAt,policyRevision:'policy1',state:'queued'};
  await f.store.accept({conversation,run,request:{requestId:id(2504),prompt:'older',skill:null,window:null,windowRequest:null},event:{contractVersion:'0.1.0',eventId:id(2505),binding:other,scopes,sequence:1,createdAt,type:'run.status',data:{state:'queued',reasonCode:null}}},()=>{});
  let releasing=false,acknowledged=false,serialized=false,acknowledgedDuringB,transitionQueued;const queued=new Promise(resolve=>{transitionQueued=resolve;});
  f.state.onRetentionTransition=()=>transitionQueued();
  f.state.onMembershipRead=count=>{if(count===2)releasing=true;};
  f.state.onRetentionRead=async subject=>{if(releasing&&subject.subjectId===other.conversationId&&!suppression){
   suppression=f.retentionOwner.suppress({principal:{tenantId:binding.tenantId,actorId:binding.actorId},subject:{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId},reason:'suppress A while B waits'}).then(()=>{acknowledged=true;});
   await queued;await new Promise(setImmediate);acknowledgedDuringB=acknowledged;
  }};
  const original=f.historyService.recheckRelease;
  const service={...f.historyService,recheckRelease:call=>original({...call,publish:value=>{assert.equal(acknowledged,false);const response=call.publish(value);serialized=true;return response;}})};
  const app=createConversationHistoryApplication({service,gate:f.gate,currentness:f.currentness,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}});
  const response=await app.handle(new Request('https://meri.invalid/api/conversations/list',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:'{}'}));
  assert.equal(response.status,200);assert.equal(acknowledgedDuringB,false,'suppression of A remains queued while row B awaits');assert.equal(serialized,true);assert.equal((await response.json()).conversations.length,2);await suppression;assert.equal(acknowledged,true);
  f.state.onRetentionRead=null;const after=await f.post('list',{});assert.equal(after.status,200);assert.deepEqual((await after.json()).conversations.map(c=>c.conversationId),[other.conversationId]);
 }finally{await suppression?.catch(()=>{});f.close();}
});

/** The runtime's own admission owner over the fixture's synthetic fork bootstrap: target compatibility is the real owner's. */
function withAdmission(f,changed){const original=f.nativeAdmission.admit;let n=4000;
 Object.assign(f.nativeAdmission,createNativeLifecycleAdmission({store:f.store,versions:{...versions,...changed},runWindowMs:60000,newId:()=>id(n++),
  admitFork:async input=>{const value=await original({...input,mode:'fork'});return {binding:value.binding,bootstrap:value.bootstrap,expiresAtMs:value.expiresAtMs};}}));}
/** Pause/capture, then resume or fork through the actual admission owner; `changed` overrides the runtime's current versions. */
async function admitted(f,mode,changed=null){await f.running();const pause=id(2300),controlId=id(2301);
 await f.control({controlId:pause,intent:'pause'});await f.claim(pause);await f.checkpoint(pause);if(changed)withAdmission(f,changed);
 const proof=f.proofs.get(binding.runId),receipt=await f.control({controlId,intent:mode,checkpointId:proof.checkpointId,checkpointSha256:proof.checkpointSha256});
 return {proof,receipt,controlKey:`${binding.tenantId}:${controlId}`};}
const targetRow=(f,receipt)=>[...f.state.runs.values()].find(r=>r.run_id===receipt.targetBinding.runId);
const readTranscript=async(f,conversationId)=>{const response=await f.post('transcript',{conversationId});return {response,page:await response.json()};};
const refusesLineage=async(f,conversationId)=>{const {response,page}=await readTranscript(f,conversationId);assert.equal(response.status,500);assert.deepEqual(page,{error:{code:'CONVERSATION_STORE_CORRUPT'}});};

for(const [scope,general] of [['client',false],['General',true]])for(const mode of ['resume','fork'])for(const changed of [{imageDigest:`sha256:${'f'.repeat(64)}`},{skillsDigest:'c'.repeat(64)}])
test(`native ${scope} ${mode} keeps an independently admitted ${Object.keys(changed)[0]}-only successor readable`,async()=>{
 const f=await fixture({lifecycle:true,general});try{const {receipt}=await admitted(f,mode,changed);assert.equal(receipt.state,'APPLIED');
  const field=Object.keys(changed)[0],row=targetRow(f,receipt),versions=row.continuation.continuation.versions;
  assert.notEqual(versions[field],row.projection.versions[field],'the allowed target change is stored, not normalized away');
  assert.equal(continuesSession(versions,row.projection.versions),true);
  const {response,page}=await readTranscript(f,receipt.targetBinding.conversationId);
  assert.equal(response.status,200,`${scope} ${mode} ${field}: status=${response.status} code=${page.error?.code??'none'}`);
  assert.equal(page.turns.length,mode==='resume'?2:1);
  const turn=page.turns.find(t=>t.run.binding.runId===receipt.targetBinding.runId);
  assert.deepEqual(turn.promptLineage,mode==='resume'?{kind:'resume',logicalRequestId:f.input.requestId,sourceBinding:binding,sourceRequestId:f.input.requestId}
   :{kind:'fork',logicalRequestId:turn.request.requestId,sourceBinding:binding,sourceRequestId:f.input.requestId});
 }finally{f.close();}
});

for(const [scope,general] of [['client',false],['General',true]])for(const changed of [{sdk:'99.0.0'},{cli:'99.0.0'}])
test(`native ${scope} refuses a ${Object.keys(changed)[0]} change before any successor is persisted`,async()=>{
 const f=await fixture({lifecycle:true,general});try{await assert.rejects(admitted(f,'resume',changed),/LIFECYCLE_EFFECT_UNKNOWN/);
  assert.equal(f.state.runs.size,1,'no successor run row is written');assert.equal(f.state.nextRuns.size,0,'no successor reservation is written');
  // A contracts/checkpointFormat change is refused even earlier: RuntimeVersions pins both to the contract constant,
  // strictly stronger than continuesSession's format check, so no such target can be constructed at all.
  assert.throws(()=>withAdmission(f,{contracts:'99.0.0'}),/RuntimeVersions/);
  assert.throws(()=>withAdmission(f,{checkpointFormat:'99.0.0'}),/RuntimeVersions/);
  const {response,page}=await readTranscript(f,binding.conversationId);assert.equal(response.status,200);assert.equal(page.turns.length,1);
 }finally{f.close();}
});

for(const [scope,general] of [['client',false],['General',true]])for(const mode of ['resume','fork'])
test(`native ${scope} ${mode}: substituted canonical source custody refuses prompt lineage`,async()=>{
 const f=await fixture({lifecycle:true,general});try{const {receipt,controlKey}=await admitted(f,mode,{imageDigest:`sha256:${'f'.repeat(64)}`});assert.equal(receipt.state,'APPLIED');
  // A custody attack rewrites the retained capture and the stored envelope, never the canonical control proof.
  const control=f.state.controls.get(controlKey),versions=control.projection.proof.versions;
  versions.imageDigest=`sha256:${'e'.repeat(64)}`;control.projection.versions.imageDigest=`sha256:${'e'.repeat(64)}`;control.projection_sha256=hash(control.projection);
  await refusesLineage(f,receipt.targetBinding.conversationId);
 }finally{f.close();}
});

for(const [scope,general] of [['client',false],['General',true]])for(const mode of ['resume','fork'])
test(`native ${scope} ${mode}: substituted admitted target versions refuse prompt lineage`,async()=>{
 const f=await fixture({lifecycle:true,general});try{const {receipt}=await admitted(f,mode,{imageDigest:`sha256:${'f'.repeat(64)}`});
  const row=targetRow(f,receipt);row.projection.versions.imageDigest=`sha256:${'d'.repeat(64)}`;row.projection_sha256=hash(row.projection);
  await refusesLineage(f,receipt.targetBinding.conversationId);
 }finally{f.close();}
});

for(const [scope,general] of [['client',false],['General',true]])for(const mode of ['resume','fork'])
test(`native ${scope} ${mode}: a missing canonical control refuses prompt lineage instead of inventing history`,async()=>{
 const f=await fixture({lifecycle:true,general});try{const {receipt,controlKey}=await admitted(f,mode,{imageDigest:`sha256:${'f'.repeat(64)}`});
  f.state.controls.delete(controlKey);await refusesLineage(f,receipt.targetBinding.conversationId);
 }finally{f.close();}
});

for(const [scope,general] of [['client',false],['General',true]])for(const field of ['sdk','cli'])
test(`native ${scope}: a target that cannot continue the captured session refuses prompt lineage (${field})`,async()=>{
 const f=await fixture({lifecycle:true,general});try{const {receipt,controlKey}=await admitted(f,'resume',{imageDigest:`sha256:${'f'.repeat(64)}`});
  // Admitted target and run agree, so only the source->target compatibility predicate can refuse this continuation.
  const control=f.state.controls.get(controlKey),row=targetRow(f,receipt);
  control.projection.target.versions[field]='99.0.0';control.projection_sha256=hash(control.projection);
  row.projection.versions[field]='99.0.0';row.projection_sha256=hash(row.projection);
  await refusesLineage(f,receipt.targetBinding.conversationId);
 }finally{f.close();}
});

test('history observes the canonical control read-only under the target-only transcript lock',async()=>{
 const f=await fixture({lifecycle:true});try{const {receipt}=await admitted(f,'fork',{imageDigest:`sha256:${'f'.repeat(64)}`});
  const before=f.state.calls.length,{response}=await readTranscript(f,receipt.targetBinding.conversationId);assert.equal(response.status,200);
  const calls=f.state.calls.slice(before).filter(sql=>sql.includes('meri_conversations.controls'));
  assert.ok(calls.some(sql=>sql.startsWith('SELECT * FROM meri_conversations.controls WHERE tenant_id=$1 AND control_id=$2')),'the canonical control is observed');
  assert.deepEqual(calls.filter(sql=>sql.includes('FOR UPDATE')),[],'no source-control row lock is taken');
 }finally{f.close();}
});

test('concurrent transcript reads of one continued conversation project the same canonical lineage',async()=>{
 const f=await fixture({lifecycle:true});try{const {receipt}=await admitted(f,'resume',{imageDigest:`sha256:${'f'.repeat(64)}`});
  const pages=await Promise.all(Array.from({length:3},async()=>{const {response,page}=await readTranscript(f,receipt.targetBinding.conversationId);assert.equal(response.status,200);return page;}));
  const ids=pages.map(page=>page.turns.find(t=>t.run.binding.runId===receipt.targetBinding.runId).promptLineage.logicalRequestId);
  assert.deepEqual(new Set(ids),new Set([f.input.requestId]));
 }finally{f.close();}
});

// Model an unavailable parent read projection, not a bare SQL DELETE: the real source-run foreign key and purge guards remain.
function removeParentReadModel(f){
 for(const [key,row] of f.state.conversations)if(row.conversation_id===binding.conversationId)f.state.conversations.delete(key);
 for(const [key,row] of f.state.runs)if(row.conversation_id===binding.conversationId){f.state.runs.delete(key);f.state.events.delete(key);}
}
for(const corrupt of ['envelope-mode','proof-session'])test(`canonical corruption classification: malformed ${corrupt} remains stored corruption`,async()=>{
 const f=await fixture({lifecycle:true});try{const {receipt,controlKey}=await admitted(f,'resume',{imageDigest:`sha256:${'f'.repeat(64)}`});
  if(corrupt==='envelope-mode'){const row=targetRow(f,receipt);row.continuation.continuation.mode='unsupported';row.continuation_sha256=hash(row.continuation);}
  else{const control=f.state.controls.get(controlKey);control.projection.proof.sdkSession.key.sessionId='malformed';control.projection_sha256=hash(control.projection);}
  await refusesLineage(f,receipt.targetBinding.conversationId);
 }finally{f.close();}
});
test('canonical corruption classification: custody query transport failure remains unavailable',async()=>{
 const f=await fixture({lifecycle:true});try{const {receipt}=await admitted(f,'fork',{imageDigest:`sha256:${'f'.repeat(64)}`});let reads=0;
  f.state.onHistoryCustodyRead=async()=>{reads++;throw Object.assign(new Error('synthetic connection lost'),{code:'ECONNRESET'});};
  const {response,page}=await readTranscript(f,receipt.targetBinding.conversationId);assert.equal(reads,1);assert.equal(response.status,503);assert.deepEqual(page,{error:{code:'CONVERSATION_UNAVAILABLE'}});
 }finally{f.close();}
});
for(const [scope,general] of [['client',false],['General',true]]){
 test(`parent retention: native ${scope} fork remains readable with retained custody while its own suppression still fences release`,async()=>{
  const f=await fixture({lifecycle:true,general});try{const {receipt,controlKey}=await admitted(f,'fork',{imageDigest:`sha256:${'f'.repeat(64)}`});
   const principal={tenantId:binding.tenantId,actorId:binding.actorId},subject=subjectId=>({tenantId:binding.tenantId,kind:'conversation',subjectId});
   const custody=structuredClone(f.state.controls.get(controlKey));
   await f.retentionOwner.suppress({principal,subject:subject(binding.conversationId),reason:'parent removed'});
   removeParentReadModel(f);f.state.coreReads.length=0;
   const {response,page}=await readTranscript(f,receipt.targetBinding.conversationId);assert.equal(response.status,200);
   assert.equal(page.turns.length,1);assert.deepEqual(page.turns[0].promptLineage,{kind:'fork',logicalRequestId:page.turns[0].request.requestId,sourceBinding:binding,sourceRequestId:f.input.requestId});
   assert.ok(f.state.coreReads.length>0);assert.ok(f.state.coreReads.every(read=>read.conversationId===receipt.targetBinding.conversationId));
   assert.deepEqual(f.state.controls.get(controlKey),custody,'reading a child never recreates or changes parent custody');
   await f.retentionOwner.suppress({principal,subject:subject(receipt.targetBinding.conversationId),reason:'child removed'});
   const denied=await readTranscript(f,receipt.targetBinding.conversationId);assert.equal(denied.response.status,503);assert.deepEqual(denied.page,{error:{code:'CONVERSATION_UNAVAILABLE'}});
  }finally{f.close();}
 });
 test(`parent retention: native ${scope} fork refuses removed canonical custody after parent removal`,async()=>{
  const f=await fixture({lifecycle:true,general});try{const {receipt,controlKey}=await admitted(f,'fork',{imageDigest:`sha256:${'f'.repeat(64)}`});
   removeParentReadModel(f);assert.equal((await readTranscript(f,receipt.targetBinding.conversationId)).response.status,200,'retained custody is sufficient without parent read rows');
   f.state.controls.delete(controlKey);await refusesLineage(f,receipt.targetBinding.conversationId);
   assert.equal(f.state.controls.has(controlKey),false,'missing custody is neither repaired nor inferred from the self-hashed envelope');
  }finally{f.close();}
 });
}
