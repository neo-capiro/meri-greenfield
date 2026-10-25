import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationPurgeRow,tombstone,sdkPurgePage} from '../conversation-purge-rows.mjs';
import {hash,subjectKey} from '../boundary.mjs';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {rowWorkflowIdentity} from '../purge.mjs';
import {summarizeSdkRetentionRows,sdkRetentionTables} from '../../conversations/retention-sdk-rows.mjs';
import {sdkRetentionFixture,createSdkRetentionReader,binding} from '../../conversations/test/retention-sdk-fixture.mjs';
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

/** Actual journal and SDK scanner over a transactional scripted pool. Exact
 * registration, FK order and rollback are observed here; PostgreSQL grants and
 * trigger execution remain the separate real-database gate. */
async function sdkJournalFixture(options={}){
 const f=await sdkRetentionFixture(options),subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId,ownerActorId:binding.actorId};
 if(options.batch){const header=f.raw.contentRows['meri_conversations.sdk_sessions'][0],entries=f.raw.contentRows['meri_conversations.sdk_session_entries'].filter(r=>r.subpath==='').slice(0,1000).map(r=>r.entry);
  const request={binding,key:header.owner.key,appendId:id(900),expectedOffset:0,entriesSha256:hash(entries),entries},requestSha256=hash(request);
  const receipt={binding,key:request.key,requestSha256,committed:true,appendId:request.appendId,entriesSha256:request.entriesSha256,offset:entries.length,added:entries.length};
  f.raw.contentRows['meri_conversations.sdk_session_batches'].push({tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,session_id:header.session_id,append_id:request.appendId,request_sha256:requestSha256,receipt,receipt_sha256:hash(receipt)});
 }
 const target=summarizeSdkRetentionRows(f.raw.contentRows,subject).targets[0],key=subjectKey(subject),policyVersion=1;
 const step={workflowId:rowWorkflowIdentity({tenantId:subject.tenantId,subjectId:subject.subjectId,target,policyVersion}),className:'sdkSession',target};
 const suppression={ledgerSequence:1,entrySha256:'a'.repeat(64)},plan={subject,policyVersion,planSha256:'b'.repeat(64),suppression,rowSteps:[step],steps:[]};
 const projection={state:'SUPPRESSED',ownerActorId:binding.actorId,...suppression,purge:{state:'PLANNED',planSha256:plan.planSha256,ledgerSequence:2}};
 const registrations=new Map(),calls=[],releases=[],reader=createSdkRetentionReader(f.raw);let before,transaction=0,deletedPages=0,maxTargets=0;
 const x={...f,subject,key,step,plan,registrations,calls,releases,hook:null,lostCommit:false,clock:Date.now,deletedPages:()=>deletedPages,maxTargets:()=>maxTargets};
 const restore=()=>{if(before){f.raw.contentRows=before.rows;registrations.clear();for(const [k,v] of before.registrations)registrations.set(k,v);before=null;}};
 const client={release(error){releases.push(error);if(error)restore();},async query(sql,args=[]){
  calls.push({sql,args,transaction});await x.hook?.({sql,args,transaction});
  if(sql.startsWith('BEGIN')){assert.equal(before,null);transaction++;before={rows:structuredClone(f.raw.contentRows),registrations:structuredClone([...registrations])};return {rows:[]};}
  if(sql==='ROLLBACK'){restore();return {rows:[]};}
  if(sql==='COMMIT'){before=null;if(x.lostCommit&&deletedPages)throw Error('commit reply lost');return {rows:[]};}
  if(sql.startsWith('SELECT * FROM meri_conversations.retention_subjects'))return {rows:[{state:'SUPPRESSED',projection,projection_sha256:hash(projection)}]};
  if(sql.startsWith('INSERT INTO meri_conversations.retention_purge_targets')){
   const page=sql.includes('jsonb_to_recordset')?JSON.parse(args[4]):[{workflow_id:args[0],target:JSON.parse(args[4])}];
   assert.ok(page.length<=1000);for(const r of page){assert.deepEqual(Object.keys(r.target).sort(),['key','mode','rowSha256','table']);assert.equal(r.target.mode,'delete');
    registrations.set(r.workflow_id,{...r,transaction,state:'PLANNED'});}maxTargets=Math.max(maxTargets,registrations.size);return {rows:[],rowCount:page.length};
  }
  if(sql.startsWith('DELETE FROM meri_conversations.sdk_')){
   const table=sql.match(/^DELETE FROM ([a-z_.]+)/u)[1],keys=JSON.parse(args[2]);assert.ok(keys.length>0&&keys.length<=1000);assert.deepEqual(args.slice(0,2),[subject.tenantId,subject.subjectId]);
   assert.match(sql,/USING jsonb_to_recordset\(\$3::jsonb\)/);const sought=new Set(keys.map(key=>JSON.stringify(key))),definition=sdkRetentionTables.find(t=>t.name===table);
   const permits=new Map([...registrations.values()].filter(r=>r.transaction===transaction&&r.state==='PLANNED'&&r.target.table===table).map(r=>[JSON.stringify(r.target.key),r]));
   const rowKey=row=>Object.fromEntries(definition.keys.map(([k])=>[k,row[k]])),matches=row=>row.tenant_id===subject.tenantId&&row.conversation_id===subject.subjectId&&sought.has(JSON.stringify(rowKey(row)));
   const all=f.raw.contentRows[table],prefix=all.slice(0,keys.length),contiguous=prefix.length===keys.length&&prefix.every(matches),removed=contiguous?prefix:all.filter(matches);
   for(const row of removed){
    const permit=permits.get(JSON.stringify(rowKey(row)));
    assert.ok(permit,'each row requires an exact registration in this transaction');assert.equal(permit.target.rowSha256,hash(JSON.parse(JSON.stringify(row))));}
   f.raw.contentRows[table]=contiguous?all.slice(keys.length):all.filter(row=>!matches(row));
   if(table.endsWith('.sdk_session_streams'))assert.equal(f.raw.contentRows['meri_conversations.sdk_session_entries'].length,0,'entries precede stream deletion');
   if(table.endsWith('.sdk_sessions'))for(const t of sdkRetentionTables.slice(1))assert.equal(f.raw.contentRows[t.name].length,0,'children precede owner deletion');
   deletedPages++;return {rows:[],rowCount:removed.length};
  }
  if(sql.startsWith('DELETE FROM meri_conversations.retention_purge_targets')){assert.deepEqual(args.slice(0,4),[subject.tenantId,subject.subjectId,plan.planSha256,projection.purge.ledgerSequence]);
   for(const workflow of args[4]){assert.notEqual(workflow,step.workflowId);assert.equal(registrations.get(workflow)?.transaction,transaction);registrations.delete(workflow);}return {rows:[],rowCount:args[4].length};}
  if(sql.startsWith('UPDATE meri_conversations.retention_purge_targets')){for(const workflow of Array.isArray(args[0])?args[0]:[args[0]])if(registrations.has(workflow))registrations.get(workflow).state=args[1]??'EXECUTED';return {rows:[]};}
  return reader.query(sql,args);
 }};
 before=null;x.journal=createPostgresRetentionJournal({pool:{connect:async()=>client},now:()=>x.clock(),maxRequestMs:60000});return x;
}

test('compact SDK purge uses bounded exact-key bulk pages and one atomic commit for all four tables',async t=>{
 const f=await sdkJournalFixture({count:4097,substream:true,batch:true});t.after(f.close);const expected=Object.values(f.step.target.sdk.counts).reduce((a,b)=>a+b,0);assert.equal(f.step.target.sdk.counts.batches,1);
 const result=await f.journal.rows.purge(f.key,f.plan);assert.equal(result.length,1);assert.equal(result[0].deleted,expected);assert.equal(result[0].state,'EXECUTED');
 assert.equal(await f.journal.rows.present(f.key,f.step),false);for(const table of sdkRetentionTables)assert.equal(f.raw.contentRows[table.name].length,0);
 const deletes=f.calls.filter(c=>c.sql.startsWith('DELETE FROM meri_conversations.sdk_'));
 assert.ok(deletes.length<15,'one DELETE per bounded page, not per entry');assert.equal(f.registrations.size,1);assert.ok(f.maxTargets()<=1001,'only the durable owner and one page of child permits stay visible');
 assert.ok([...f.registrations.values()].every(r=>r.state==='EXECUTED'));
 const first=f.calls.findIndex(c=>c.sql.startsWith('DELETE FROM')),tx=f.calls[first].transaction;
 for(const table of ['sdk_sessions','sdk_session_streams'])assert.ok(f.calls.slice(0,first).some(c=>c.transaction===tx&&c.sql.includes(`FROM meri_conversations.${table} `)&&c.sql.includes('FOR UPDATE')),'both owner and stream locks precede effects');
 assert.ok(f.releases.every(e=>e===undefined));
});

test('SDK preflight rejects a changed final page and a substituted summary before any mutation',async t=>{
 for(const alter of ['row','summary']){const f=await sdkJournalFixture({count:4097});t.after(f.close);
  if(alter==='row')f.raw.contentRows['meri_conversations.sdk_session_entries'].at(-1).entry.message.content='changed';
  else f.plan.rowSteps[0]={...f.step,target:{...f.step.target,sdk:{...f.step.target.sdk,rowsSha256:'f'.repeat(64)}}};
  await assert.rejects(f.journal.rows.preflight(f.key,f.plan),/RETENTION_ROW_CHANGED/);assert.equal(f.registrations.size,0);assert.equal(f.deletedPages(),0);
 }
});

test('a later page failure rolls back earlier SDK deletions and exact registrations',async t=>{
 const f=await sdkJournalFixture({count:4097});t.after(f.close);const original=hash(f.raw.contentRows);
 f.hook=({sql})=>{if(sql.startsWith('DELETE FROM meri_conversations.sdk_')&&f.deletedPages()===1)throw Error('later page failed');};
 await assert.rejects(f.journal.rows.purge(f.key,f.plan),/RETENTION_STORE_UNAVAILABLE/);
 assert.equal(f.deletedPages(),1);assert.equal(hash(f.raw.contentRows),original);assert.equal(f.registrations.size,0);assert.equal(await f.journal.rows.present(f.key,f.step),true);
 assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));assert.ok(f.releases.every(e=>e===undefined));
});

test('a late commitment mismatch rolls back even after the callback deleted all SDK rows',async t=>{
 const f=await sdkJournalFixture({count:4097});t.after(f.close);const original=hash(f.raw.contentRows);let changed=false;
 f.hook=({sql})=>{if(!changed&&f.deletedPages()===1&&sql.startsWith('SELECT')){changed=true;const row=f.raw.contentRows['meri_conversations.sdk_session_entries'].at(-1);row.entry.message.content='X'+row.entry.message.content.slice(1);row.entry_sha256=hash(row.entry);}};
 await assert.rejects(f.journal.rows.purge(f.key,f.plan),/RETENTION_ROW_CHANGED/);
 assert.ok(changed);assert.ok(f.deletedPages()>4,'validation fails after bounded mutation callbacks');assert.equal(hash(f.raw.contentRows),original);assert.equal(f.registrations.size,0);
});

test('compact recovery checks every SDK table, including children whose owner is absent',async t=>{
 for(const retained of sdkRetentionTables){const f=await sdkJournalFixture({count:3});t.after(f.close);
  // The producer fixture has no append batches; use a row only for presence,
  // which must never decode a missing-parent row as successful erasure.
  if(!f.raw.contentRows[retained.name].length)f.raw.contentRows[retained.name]=[{tenant_id:binding.tenantId,conversation_id:binding.conversationId,...f.step.target.key}];
  for(const table of sdkRetentionTables)if(table!==retained)f.raw.contentRows[table.name]=[];
  assert.equal(await f.journal.rows.present(f.key,f.step),true,retained.name);
  await assert.rejects(f.journal.rows.preflight(f.key,f.plan),/RETENTION_ROW_CHANGED/);assert.equal(f.deletedPages(),0);
  f.raw.contentRows[retained.name]=[];assert.equal(await f.journal.rows.present(f.key,f.step),false);
 }
});

test('lost compact purge COMMIT acknowledgement recovers from all-table absence without redispatch',async t=>{
 const f=await sdkJournalFixture({count:1001});t.after(f.close);f.lostCommit=true;
 await assert.rejects(f.journal.rows.purge(f.key,f.plan),/RETENTION_COMMIT_UNKNOWN/);assert.ok(f.releases.at(-1) instanceof Error);
 const deleted=f.deletedPages();f.lostCommit=false;assert.equal(await f.journal.rows.present(f.key,f.step),false);
 const replay=await f.journal.rows.purge(f.key,f.plan);assert.equal(replay[0].deleted,0);assert.equal(replay[0].state,'EXECUTED');assert.equal(f.deletedPages(),deleted);
});

test('progressing deadline between SDK pages stops dispatch and retires the in-flight transaction',async t=>{
 const f=await sdkJournalFixture({count:4097});t.after(f.close);const original=hash(f.raw.contentRows);let now=1000;f.clock=()=>now;
 f.hook=({sql})=>{if(f.deletedPages()===1&&sql.startsWith('DELETE FROM meri_conversations.retention_purge_targets'))now=2000;};
 await assert.rejects(f.journal.rows.purge(f.key,f.plan,{deadlineMs:1500}),/RETENTION_(DEADLINE|STORE_UNAVAILABLE)/);
 assert.equal(f.deletedPages(),1);assert.equal(hash(f.raw.contentRows),original);assert.equal(f.registrations.size,0);assert.ok(f.releases.at(-1) instanceof Error);
});

test('bulk SDK routing rejects duplicate, mixed, oversized and compact page targets',async t=>{
 const f=await sdkJournalFixture({count:1});t.after(f.close);const rows=f.raw.contentRows,entry=rows['meri_conversations.sdk_session_entries'][0];
 const target=content('meri_conversations.sdk_session_entries','sdkSession',{...f.step.target.key,subpath:entry.subpath,sequence:entry.sequence},entry).target;
 for(const page of [[],[target,target],Array(1001).fill(target),[f.step.target],[target,{...target,table:'public.users'}]])assert.throws(()=>sdkPurgePage(f.subject,page),/RETENTION_INVALID_REQUEST/);
});

test('100,000 SDK entries use bounded bulk SQL and ephemeral targets under a progressing deadline',{timeout:60000},async t=>{
 const f=await sdkJournalFixture({count:100000,text:'bounded synthetic transcript'});t.after(f.close);
 const started=performance.now(),deadlineMs=Date.now()+20000,result=await f.journal.rows.purge(f.key,f.plan,{deadlineMs});
 const elapsed=performance.now()-started,sql=f.calls.filter(c=>c.sql.startsWith('DELETE FROM meri_conversations.sdk_'));
 assert.equal(result[0].deleted,100002);assert.equal(result[0].state,'EXECUTED');assert.equal(sql.length,102);assert.ok(f.maxTargets()<=1001);
 assert.equal(f.registrations.size,1);assert.equal(await f.journal.rows.present(f.key,f.step),false);
 assert.ok(elapsed<20000,'the real advancing application clock stays within the supplied deadline');
 t.diagnostic(`scripted-pool 100,000-entry purge ${Math.round(elapsed)}ms; ${sql.length} bulk deletes; max ${f.maxTargets()} visible exact targets; PostgreSQL trigger timing remains untested`);
});
