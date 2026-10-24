import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationPurgeRow,tombstone} from '../conversation-purge-rows.mjs';
import {hash} from '../boundary.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const k={kind:'conversation',tenantId:'synthetic-tenant',subjectId:id(1)};
const content=(table,className,key,row)=>({className,target:{className,table,key,rowSha256:hash(row)}});

test('content-free registration and consumed initial input facts retain their exact immutable identities',()=>{
 for(const [table,key] of [['initial_inputs',{run_id:id(2)}],['initial_run_bindings',{generation:1}],['native_executions',{run_id:id(2)}]]){
  const row={tenant_id:k.tenantId,conversation_id:k.subjectId,...key,record:{digest:'a'.repeat(64)}};
  const className=table==='native_executions'?'nativeJournals':'conversation';
  const target=conversationPurgeRow(k,content(`meri_conversations.${table}`,className,key,row));
  assert.equal(target.sql,null);assert.equal(target.erased(row),true);assert.throws(()=>target.erased({...row,record:{prompt:'unexpected'}}),/RETENTION_ROW_CHANGED/);
 }
});

test('run erasure preserves accounting, binding and consumed request identity; only bodies are replaced',()=>{
 const projection={binding:{conversationId:k.subjectId,runId:id(2)},state:'completed'},request={prompt:'private'};
 const step={className:'conversation',target:{className:'conversation',table:'runs',runId:id(2),projectionSha256:hash(projection),requestSha256:hash(request)}};
 const r=conversationPurgeRow(k,step),row={projection,projection_sha256:hash(projection),request_sha256:hash(request),request,continuation:{files:[]},continuation_sha256:'c'.repeat(64)};
 r.verify(row);assert.equal(r.erased(row),false);assert.match(r.sql,/SET request=\$4::jsonb,continuation=NULL,continuation_sha256=NULL/);
 assert.doesNotMatch(r.sql,/sdk_usage|sdk_charge|projection=|request_sha256=|request_id=/);
 assert.equal(r.erased({...row,request:tombstone(k.subjectId),continuation:null,continuation_sha256:null}),true);
 assert.equal(r.erased({...row,request:tombstone(id(9)),continuation:null,continuation_sha256:null}),false);
 assert.throws(()=>r.verify({...row,request:{prompt:'changed without digest'}}),/RETENTION_ROW_CHANGED/);
});

test('command and lookup tombstones retain consumed keys and erase result/prompt bodies without claiming an unknown effect settled',()=>{
 for(const [table,key,mode] of [['meri_commands.command_journal',{actor_id:'actor',idempotency_key:'used'},'command'],['meri_task_lookup.lookups',{lookup_id:id(3)},'lookup']]){
  const row={...key,payload:{prompt:'private'},state:mode==='command'?'OUTCOME':'RESULT',outcome:{private:'result'},record:{private:'result'}};
  const r=conversationPurgeRow(k,content(table,'receipts',key,row));r.verify(row);assert.equal(r.mode,mode);
  assert.match(r.sql,/^UPDATE /);assert.doesNotMatch(r.sql,/DELETE|idempotency_key=\$LAST|state=/);
  const erased={...row,payload:tombstone(k.subjectId),outcome:tombstone(k.subjectId),record:tombstone(k.subjectId)};
  assert.equal(r.erased(erased),true);assert.equal(r.erased({...erased,payload:tombstone(id(9))}),false);
  const pending={...row,state:'UNKNOWN'},p=conversationPurgeRow(k,content(table,'receipts',key,pending));assert.throws(()=>p.verify(pending),/RETENTION_PURGE_BLOCKED/);
 }
});

test('intent outcomes use existing one-way REDACTED state, preserving delivery fence and content-free operation digest',()=>{
 const key={actor_id:'actor',delivery_id:`sdk:${'d'.repeat(64)}`},row={...key,state:'PREPARED',outcome:{result:'private'},outcome_purged_at:null};
 const r=conversationPurgeRow(k,content('meri_intents.preparations','receipts',key,row));r.verify(row);
 assert.equal(r.erased(row),false);assert.match(r.sql,/state='REDACTED',outcome=NULL,outcome_purged_at=clock_timestamp\(\)/);
 assert.doesNotMatch(r.sql,/record=|record_sha256=|delivery_id=\$LAST/);
 assert.equal(r.erased({...row,state:'REDACTED',outcome:null,outcome_purged_at:new Date()}),true);
});

test('foreign subjects, unknown tables, altered row bytes and column injection cannot widen a target',()=>{
 const row={entry:{text:'private'}},step=content('meri_conversations.sdk_session_entries','sdkSession',{run_id:id(2),session_id:id(3),subpath:'',sequence:1},row);
 const r=conversationPurgeRow(k,step);assert.throws(()=>r.verify({...row,entry:{text:'changed'}}),/RETENTION_ROW_CHANGED/);
 assert.equal(conversationPurgeRow({...k,kind:'artifact'},step),null);
 assert.equal(conversationPurgeRow(k,{...step,target:{...step.target,table:'public.users'}}),null);
 assert.throws(()=>conversationPurgeRow(k,{...step,target:{...step.target,key:{...step.target.key,'x OR true':1}}}),/RETENTION_INVALID_REQUEST/);
 assert.match(r.where,/r.tenant_id=\$1 AND r.conversation_id=\$2/);assert.deepEqual(r.args().slice(0,2),[k.tenantId,k.subjectId]);
});
