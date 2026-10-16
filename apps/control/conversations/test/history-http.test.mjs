/** SYNTHETIC public Fetch composition: canonical sessions, next-run/store journals, membership and scripted SQL. No real DB/services. */
import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,binding,scopes,versions,id} from './application-fixture.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {createNextRunOwner} from '../next-run.mjs';
import {createMembershipGate} from '../../product-access/membership.mjs';
import {createConversationHistoryService} from '../history/service.mjs';
import {createConversationHistoryApplication} from '../history/http.mjs';
import {hash} from '../boundary.mjs';
import {lifecycleFixture} from './lifecycle-fixture.mjs';
async function fixture({lifecycle=false}={}){
 const f=await (lifecycle?lifecycleFixture():applicationFixture()),state=f.state;let serial=1000;
 // Script only the two newly added read queries; canonical write/next-run SQL keeps its existing independent fixture.
 const pool={async connect(){const c=await f.pool.connect();return {...c,async query(sql,p){
  if(sql.includes('owner_actor_id=$2'))return {rows:[...state.conversations.values()].filter(r=>r.tenant_id===p[0]&&r.owner_actor_id===p[1]&&r.projection.scopes.every(s=>s.kind!=='client'||p[2].includes(s.resourceId)))
   .sort((a,b)=>b.projection.createdAt.localeCompare(a.projection.createdAt)||b.conversation_id.localeCompare(a.conversation_id))
   .filter(r=>p[3]===null||r.projection.createdAt<p[3]||r.projection.createdAt===p[3]&&r.conversation_id<p[4]).slice(0,p[5])};
  if(sql.startsWith('SELECT e.*')){await state.onHistoryRead?.();const entries=[];for(const r of state.runs.values())if(r.tenant_id===p[0]&&r.conversation_id===p[1])for(const e of state.events.get([r.tenant_id,r.conversation_id,r.run_id].join(':'))??[])
   entries.push({...e,tenant_id:r.tenant_id,conversation_id:r.conversation_id,run_id:r.run_id,global:r.sequence_base+e.sequence});
   return {rows:entries.sort((a,b)=>a.global-b.global).filter(e=>e.global>p[2]).slice(0,p[3])};}
  return c.query(sql,p);
 }};}};
 const store=createPostgresConversationStore({pool}),owner=createNextRunOwner({store,versions,newId:()=>id(serial++),retirement:{async verifyRetired(){throw Error('not admitted');}},revocation:{async verifyRevoked(){throw Error('not admitted');}}});
 state.member={tenantId:binding.tenantId,actorId:binding.actorId,status:'active',role:'member',permissions:[],clientIds:[id(5)],membershipRevision:'m1'};
 const gate=createMembershipGate({now:Date.now,limits:{maxRequestMs:1000,maxFactBytes:65536},verifyToken:async({credential})=>{if(credential!=='native')throw Error('invalid');return {tenantId:state.member.tenantId,actorId:state.member.actorId,checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};},
  readMembership:async()=>({...state.member,checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000})});
 state.retentionChecks=0;const retention={async assertServable(){state.retentionChecks++;if(state.suppressed)throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}};
 const service=createConversationHistoryService({store,nextRunOwner:owner,gate,retention}),app=createConversationHistoryApplication({service,gate,now:Date.now,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const post=(path,body,token='native')=>app.handle(new Request(`https://meri.invalid/api/conversations/${path}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}));
 async function turn(n){const source=state.context.binding;if(n===1)await f.service.submit({credential:f.credential,input:f.input});
  const issued=n===1?{credential:f.credential}:await f.sessions.issue({identityCredential:'synthetic-native'});
  if(n!==1)await f.service.submit({credential:issued.credential,input:{requestId:id(serial++),prompt:`prompt ${n}`}});
  await f.service.cancel({credential:issued.credential});
  const admitted=await owner.admitTurn({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,sourceRunId:source.runId});
  state.context.binding=admitted.targetBinding;return {source,admitted};
 }
 return {...f,store,owner,post,turn,gate,historyService:service};
}
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

for(const corrupt of ['conversation-shape','run-shape','request-hash','event-shape','pending-shape'])test(`canonical ${corrupt} is an integrity500, without foreign database details`,async()=>{
 const f=await fixture();try{await f.turn(1);const r=f.state.runs.values().next().value;
  if(corrupt==='conversation-shape'){const c=f.state.conversations.values().next().value;c.projection.createdAt='invalid';c.projection_sha256=hash(c.projection);}
  if(corrupt==='run-shape'){r.projection.state='invalid';r.projection_sha256=hash(r.projection);}
  if(corrupt==='request-hash')r.request_sha256='0'.repeat(64);
  if(corrupt==='event-shape'){const e=f.state.events.values().next().value[0];e.event.sequence='bad';e.event_sha256=hash(e.event);}
  if(corrupt==='pending-shape')f.state.nextRuns.values().next().value.reservation=null;
  const response=await f.post('transcript',{conversationId:binding.conversationId});assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_STORE_CORRUPT'}});
 }finally{f.close();}
});

async function continued(f,mode){await f.running();const pause=id(2300);await f.control({controlId:pause,intent:'pause'});await f.claim(pause);await f.checkpoint(pause);
 const proof=f.proofs.get(id(220));return f.control({controlId:id(2301),intent:mode,checkpointId:proof.checkpoint.checkpointId,checkpointSha256:proof.checkpointSha256});}

test('resume, lost receipt and reload retain one logical prompt; identical-text new turn remains distinct',async()=>{
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

test('fork starts a conversation-local prompt identity while retaining exact external source lineage',async()=>{
 const f=await fixture({lifecycle:true});try{const result=await continued(f,'fork'),response=await f.post('transcript',{conversationId:result.targetBinding.conversationId});assert.equal(response.status,200);const page=await response.json();
  assert.equal(page.turns.length,1);const t=page.turns[0];assert.deepEqual(t.promptLineage,{kind:'fork',logicalRequestId:t.request.requestId,sourceBinding:binding,sourceRequestId:f.input.requestId});assert.equal(t.sequenceBase,0);
 }finally{f.close();}
});

for(const corrupt of ['digest','request','source-binding','context'])test(`resumed canonical ${corrupt} substitution refuses prompt lineage`,async()=>{
 const f=await fixture({lifecycle:true});try{const result=await continued(f,'resume'),row=[...f.state.runs.values()].find(r=>r.run_id===result.targetBinding.runId);
  if(corrupt==='digest')row.continuation_sha256='0'.repeat(64);
  if(corrupt==='request')row.continuation.sourceRequest.prompt='substituted';
  if(corrupt==='source-binding'){const envelope=row.continuation.continuation;envelope.checkpoint.binding.workerId=id(2399);envelope.checkpointSha256=hash(envelope.checkpoint);}
  if(corrupt==='context')row.continuation.continuation.contextSha256='0'.repeat(64);
  if(corrupt!=='digest')row.continuation_sha256=hash(row.continuation);
  const response=await f.post('transcript',{conversationId:binding.conversationId});assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_STORE_CORRUPT'}});
 }finally{f.close();}
});
