/** Product transcript/event persistence. Borrowed pg-compatible pool; no connection on import. */
import {assertRun,bounded,hash,same,fail,nextState,terminal,validateShape,uuid,own} from './boundary.mjs';
import {createLifecycleJournal,HOLD_CHECKPOINT_FAILED} from './lifecycle/journal.mjs';
import {createSelectedOutputJournal} from './skills/retention.mjs';
import {createExecutionJournal} from './execution-journal.mjs';
import {createNativePreparationJournals} from './native-preparation-journal.mjs';
import {createCompletionJournal} from './completion-journal.mjs';
import {createNextRunJournal} from './next-run-journal.mjs';
import {createConversationHistoryStore} from './history/store.mjs';
import {productFailure} from '../product-access/errors.mjs';
import {createOriginalInputJournal} from './initial-input-journal.mjs';
import {assertOriginalInputActive} from './initial-input-facts.mjs';
export function createPostgresConversationStore({pool,transitionAuthority,now=Date.now}){
 if(typeof pool?.connect!=='function')fail('STORE_CONFIGURATION');
 async function tx(binding,check,body){let c,begun=false,committing=false,reusable=false,failure,result;
  try{check();c=await pool.connect();check();await c.query('BEGIN');begun=true;check();await c.query("SET LOCAL statement_timeout = '5s'");await c.query("SET LOCAL lock_timeout = '2s'");check();
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${binding.tenantId}:${binding.conversationId}`]);check();result=await body(c);check();committing=true;await c.query('COMMIT');reusable=true;check();
  }catch(e){failure=!committing&&productFailure(e)?e:Object.assign(new Error(committing?'STORE_COMMIT_UNKNOWN':e.code??'STORE_UNAVAILABLE'),{code:committing?'STORE_COMMIT_UNKNOWN':e.code??'STORE_UNAVAILABLE'});if(begun&&!committing)try{await c.query('ROLLBACK');reusable=true;}catch{}}
  finally{if(c)try{c.release(reusable?undefined:failure);}catch{failure??=Object.assign(new Error('STORE_RELEASE_UNKNOWN'),{code:'STORE_RELEASE_UNKNOWN'});}}
  if(failure)throw failure;return bounded(result,2097152);
 }
 const rowRun=row=>{if(!row||hash(row.projection)!==row.projection_sha256||hash(row.request)!==row.request_sha256)fail('STORE_CORRUPT');assertRun(row.projection);const b=row.projection.binding;if(row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId||row.request_id!==row.request.requestId||!Number.isSafeInteger(Number(row.last_sequence))||Number(row.last_sequence)<1)fail('STORE_CORRUPT');return row;};
 async function accept({conversation,run,request,event},check,selectedClientId){
  let allocation=null;const callerCheck=check;check=()=>{callerCheck();if(allocation)assertOriginalInputActive(allocation.facts,now());};
  validateShape('Conversation',conversation);assertRun(run);const b=run.binding;request=bounded(request);
  if(conversation.owner.tenantId!==b.tenantId||conversation.owner.actorId!==b.actorId||conversation.conversationId!==b.conversationId||!same(conversation.scopes,run.scopes)||conversation.policyRevision!==run.policyRevision||run.state!=='queued')fail('CONVERSATION_BINDING_REFUSED');
  return tx(b,check,async c=>{
   allocation=selectedClientId===undefined?null:await initialInputs.match(c,{run,request,selectedClientId},check);check();
   const old=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows[0];check();
   if(old){if(hash(old.projection)!==old.projection_sha256||old.owner_actor_id!==b.actorId||!same({...old.projection,createdAt:conversation.createdAt},conversation))fail('CONVERSATION_SCOPE_REFUSED');}
   else{await c.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[b.tenantId,b.conversationId,b.actorId,conversation,hash(conversation)]);check();}
   const existing=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND (request_id=$3 OR run_id=$4) FOR UPDATE',[b.tenantId,b.conversationId,request.requestId,b.runId])).rows;check();
   if(existing.length){const r=rowRun(existing[0]);if(existing.length!==1||r.request_id!==request.requestId||!same({...r.request,window:request.window},request)||!same(r.projection.binding,b)||!same(r.projection.versions,run.versions))fail('REQUEST_REPLAY_REFUSED');if(allocation&&(allocation.state!=='ACCEPTED'||!same(r.request,request)))fail('INITIAL_INPUT_CORRUPT');return {run:r.projection,request:r.request,lastSequence:Number(r.last_sequence),replayed:true};}
   if(allocation&&allocation.state!=='RESERVED')fail('INITIAL_INPUT_CORRUPT');
   const prior=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[b.tenantId,b.conversationId])).rows;check();if(prior.length)fail('NEXT_RUN_NOT_RESERVED');
   validateShape('UIEvent',event);if(!same(event.binding,b)||!same(event.scopes,run.scopes)||event.sequence!==1||event.type!=='run.status'||event.data.state!=='queued')fail('EVENT_BINDING_REFUSED');
   await c.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1)',[b.tenantId,b.conversationId,b.runId,run,hash(run),request.requestId,request,hash(request)]);check();
   await c.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[b.tenantId,b.conversationId,b.runId,1,event.eventId,event,hash(event)]);check();if(allocation)await initialInputs.accepted(c,allocation,check);return {run,request,lastSequence:1,replayed:false};
  });
 }
 async function findRequest(binding,requestId,check){const b=bounded(binding);validateShape('RunBinding',b);uuid(requestId);return tx(b,check,async c=>{const rows=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND request_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,requestId])).rows;check();if(!rows.length)return null;if(rows.length!==1)fail('STORE_CORRUPT');const r=rowRun(rows[0]);if(!same(r.projection.binding,b))fail('STALE_WRITER');return {run:r.projection,request:r.request,lastSequence:Number(r.last_sequence),replayed:true};});}
 async function appendEvent(binding,input,check,expectedScopes,allowHeldCancel=false){const b=bounded(binding);validateShape('RunBinding',b);const i=bounded(input);uuid(i.eventId);
  return tx(b,check,async c=>{const r=rowRun((await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows[0]);check();if(!same(r.projection.binding,b))fail('STALE_WRITER');if(expectedScopes&&!same(r.projection.scopes,expectedScopes))fail('SCOPE_REFUSED');
   // The hold fences all worker output; its only worker exit is the explicit uncheckpointed-hold failure, verified below.
   const holdFailure=i.type==='run.status'&&i.data?.state==='failed'&&i.data?.reasonCode===HOLD_CHECKPOINT_FAILED;if(holdFailure&&!r.hold_control_id)fail('HOLD_FAILURE_REFUSED');
   if(r.hold_control_id&&!holdFailure&&!(allowHeldCancel&&i.type==='run.status'&&i.data?.state==='cancelled'&&i.data?.reasonCode==='USER_CANCELLED'))fail('RUN_HELD');
   const event={contractVersion:'0.1.0',eventId:i.eventId,binding:b,sequence:Number(r.last_sequence)+1,createdAt:i.createdAt,scopes:r.projection.scopes,type:i.type,data:i.data};validateShape('UIEvent',event);
   const old=(await c.query('SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND event_id=$4',[b.tenantId,b.conversationId,b.runId,i.eventId])).rows[0];check();
   if(old){if(hash(old.event)!==old.event_sha256||old.event_id!==old.event.eventId||Number(old.sequence)!==old.event.sequence||!same({...event,sequence:old.event.sequence},old.event))fail('EVENT_REPLAY_REFUSED');return old.event;}
   if(r.sequence_end!=null)fail('RUN_RANGE_CLOSED');
   if(terminal(r.projection.state))nextState(r.projection.state,event);
   if(r.hold_completion_id&&!(i.type==='run.status'&&['failed','cancelled'].includes(i.data?.state)))fail('RUN_HELD');
   const projection={...r.projection,state:nextState(r.projection.state,event)};if(!Number.isSafeInteger(event.sequence))fail('EVENT_LIMIT');
   if(holdFailure)await lifecycle.failUncheckpointedHold(c,b,r,check);
   // A queued run that turns terminal before any allocation claim records its no-authority evidence in this same transaction.
   if(r.projection.state==='queued'&&['failed','cancelled'].includes(projection.state))await preparation.allocations.foreclose(c,b,event,check);
   await c.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[b.tenantId,b.conversationId,b.runId,event.sequence,event.eventId,event,hash(event)]);check();
   await c.query('UPDATE meri_conversations.runs SET projection=$4,projection_sha256=$5,last_sequence=$6 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[b.tenantId,b.conversationId,b.runId,projection,hash(projection),event.sequence]);check();return event;});
 }
 async function readState(binding,{after=0,limit=100}={},check,optional=false){const b=bounded(binding);validateShape('RunBinding',b);if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>100)fail('INVALID_CURSOR');
  return tx(b,check,async c=>{const current=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[b.tenantId,b.conversationId,b.runId])).rows;check();if(optional&&current.length===0)return null;if(current.length!==1)fail('STORE_CORRUPT');const r=rowRun(current[0]);if(!same(r.projection.binding,b))fail('STALE_WRITER');
   if(after>Number(r.last_sequence))fail('INVALID_CURSOR');const rows=(await c.query('SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND sequence>$4 ORDER BY sequence LIMIT $5',[b.tenantId,b.conversationId,b.runId,after,limit+1])).rows;check();let sequence=after;
   for(const e of rows){validateShape('UIEvent',e.event);if(hash(e.event)!==e.event_sha256||e.event_id!==e.event.eventId||Number(e.sequence)!==e.event.sequence||e.event.sequence!==++sequence||!same(e.event.binding,b)||!same(e.event.scopes,r.projection.scopes))fail('STORE_CORRUPT');}
   if(rows.length===0&&after<Number(r.last_sequence))fail('STORE_CORRUPT');if(rows.length<limit+1&&sequence!==Number(r.last_sequence))fail('STORE_CORRUPT');const events=rows.slice(0,limit).map(e=>e.event);return {run:r.projection,request:r.request,events,nextSequence:events.at(-1)?.sequence??after,hasMore:rows.length>limit,lastSequence:Number(r.last_sequence)};});
 }
 const read=(binding,cursor,check)=>readState(binding,cursor,check),readOptional=(binding,cursor,check)=>readState(binding,cursor,check,true);
 const append=(binding,input,check,expectedScopes)=>appendEvent(binding,input,check,expectedScopes);
 const lifecycle=createLifecycleJournal({tx,rowRun,transitionAuthority,now,cancelAppend:(binding,event,check,scopes)=>appendEvent(binding,event,check,scopes,true)});
 const preparation=createNativePreparationJournals({tx,rowRun});
 const initialInputs=createOriginalInputJournal({tx,rowRun,now}),originalInputPorts=Object.freeze({claim:initialInputs.claim,read:initialInputs.read,accept(raw,check){const i=own(raw,['conversation','run','request','event','selectedClientId']);uuid(i.selectedClientId);return accept(i,check,i.selectedClientId);}});
 return Object.freeze({accept:(input,check)=>accept(input,check),initialInputs:originalInputPorts,append,read,readOptional,findRequest,history:createConversationHistoryStore({tx,rowRun}),nextRuns:createNextRunJournal({tx,rowRun}),completions:createCompletionJournal({tx,rowRun}),...preparation,executions:createExecutionJournal({tx,rowRun,verifyPreparedClaim:preparation.allocations.verifyExecutionClaim}),selectedOutputs:createSelectedOutputJournal({tx,rowRun}),lifecycle});
}
