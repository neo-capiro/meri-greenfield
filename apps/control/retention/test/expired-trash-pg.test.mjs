// Exact disposable Unix PG16 target only. Storage/Core are explicit fixture ports;
// every inventory, lock, target, trigger and row effect uses the ordinary SQL role.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as id} from 'node:crypto';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../postgres-watermark.mjs';
import {createRetentionStartup} from '../startup.mjs';
import {createMemoryLedgerSink} from '../ledger.mjs';
import {createConversationPurgeFacts} from '../inventory-source.mjs';
import {recomputePlan} from '../purge.mjs';
import {hash,subjectKey} from '../boundary.mjs';
import {createExecutionBinding} from '../../conversations/execution-boundary.mjs';
import {versions} from '../../conversations/test/store-fixture.mjs';
import {makePayload} from '../../commands/approval-metadata/binding.mjs';
import {record as artifactRecord} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {createSuppressionOwner} from '../suppression.mjs';
import {buildCandidate} from '../../memory/candidate.mjs';
import {createPostgresMemoryJournal} from '../../memory/postgres-journal.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {scanConversationContentRows,decodeConversationContentRows} from '../../conversations/retention-content-rows.mjs';
import {inspectRetentionTargetLookup} from './retention-target-index-pg.mjs';

const SOCKET='/tmp/meri-expired-trash-pg-20261024/socket',DATABASE='meri_expired_trash_fixture';
const supplied=process.env.MERI_EXPIRED_TRASH_PG_SOCKET!==undefined||process.env.MERI_EXPIRED_TRASH_PG_DATABASE!==undefined;
if(supplied&&(process.platform!=='linux'||process.env.MERI_EXPIRED_TRASH_PG_SOCKET!==SOCKET||process.env.MERI_EXPIRED_TRASH_PG_DATABASE!==DATABASE))throw Error('MERI_EXPIRED_TRASH_PG_TARGET_REFUSED');
const enabled=supplied&&process.platform==='linux';
const day=86400000,real=Date.now(),old=real-31*day;
let clock=null;
const now=()=>clock??Date.now();
const pool=new pg.Pool({host:SOCKET,database:DATABASE,user:'meri_control_runtime',max:1,connectionTimeoutMillis:2000,query_timeout:6000,options:'-c statement_timeout=5000 -c lock_timeout=2000'});
const connect=pool.connect.bind(pool);let failLastMutation=false,observedDeletes=0;
let lookupInspected=false,inventorySqlTiming=null;const lookupDiagnostics=[];
const journalPool={async connect(){const c=await connect();return {release:error=>c.release(error),query:async(sql,args)=>{
 if(!lookupInspected&&sql.startsWith('DELETE FROM meri_conversations.sdk_session_entries')){
  const page=JSON.parse(args[2]);if(page.length>=1000){lookupDiagnostics.push(await inspectRetentionTargetLookup(c,{tenantId:args[0],conversationId:args[1],page}));lookupInspected=true;}
 }
 if(failLastMutation&&sql.startsWith('DELETE FROM meri_conversations.sdk_session_entries'))observedDeletes++;
 if(failLastMutation&&sql.startsWith('UPDATE meri_commands.approval_metadata')){failLastMutation=false;throw Error('synthetic final-statement outage');}
 if(!inventorySqlTiming)return c.query(sql,args);
 const timing=inventorySqlTiming,kind=sql.includes('AS orphan')?'orphan':sql.includes('retention_row_bytes')?'metadata':sql.startsWith('SELECT r.* FROM meri_conversations.sdk_')?'body':'other';
 const started=performance.now();let result;
 try{return result=await c.query(sql,args);}finally{const ms=performance.now()-started,part=timing[kind]??={queries:0,rows:0,ms:0,maxMs:0};
  part.queries++;part.rows+=result?.rows?.length??0;part.ms+=ms;part.maxMs=Math.max(part.maxMs,ms);}
}};}};
const insert=async(table,row)=>{const keys=Object.keys(row);return pool.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));};
const count=async(table,f)=>Number((await pool.query(`SELECT count(*) FROM ${table} WHERE tenant_id=$1 AND conversation_id=$2`,[f.b.tenantId,f.b.conversationId])).rows[0].count);
const journal=createPostgresRetentionJournal({pool:journalPool,now});
const watermark=createPostgresWatermarkStore({journal}),sink=createMemoryLedgerSink();
const coreRecords=new Map(),objects=new Map(),deleted=[];
let finalizeAttempts=0,loseFinalize=false,readHook=null;
const core={async read(s){await readHook?.(s);const r=coreRecords.get(s.subjectId);assert.ok(r);return {...r,checkedAtMs:now()};}};
const storage={permissions:{deleteObjectVersion:true},async holdsFor(){return {legalHold:false,objectLockRetainUntilMs:null};},
 async headVersion({key,versionId}){return {outcome:objects.has(key+'@'+versionId)?'PRESENT':'ABSENT'};},
 async deleteVersion({key,versionId}){deleted.push(key+'@'+versionId);objects.delete(key+'@'+versionId);return {outcome:'DELETED'};}};
const keyFor=o=>o.objectId;
const sourceFacts=createConversationPurgeFacts({pool,journal,core,storage,keyFor,now});
let measureSubject=null,inventoryTimings=[],inventorySqlTimings=[];
const facts={...sourceFacts,async inventoryFor(subject,options){const started=performance.now();
 const measured=subject.subjectId===measureSubject;if(measured)inventorySqlTiming={};
 try{return await sourceFacts.inventoryFor(subject,options);}finally{if(measured){inventoryTimings.push(performance.now()-started);inventorySqlTimings.push(inventorySqlTiming);inventorySqlTiming=null;}}
}};
let loseRowAck=false,rowEffects=0;
const rows={...journal.rows,async purge(...args){rowEffects++;const result=await journal.rows.purge(...args);if(loseRowAck){loseRowAck=false;throw Error('synthetic lost committed row acknowledgement');}return result;}};
const makeStartup=()=>createRetentionStartup({journal,watermark,ledgerSink:sink,ownership:journal,now,purge:{enabled:true,storage,rows,facts,keyFor,
 async finalize(s,trash){finalizeAttempts++;assert.equal(coreRecords.get(s.subjectId).trashRequestId,trash.requestId);if(loseFinalize){loseFinalize=false;throw Error('synthetic lost Core finalize acknowledgement');}}}});
let startup=makeStartup();
async function seed({empty=false,general=false}={}){
 const b={tenantId:id(),actorId:id(),conversationId:id(),runId:id(),attemptId:id(),workerId:id(),writerFence:1};
 const client=general?null:id(),policyRevision='fixture-policy',scopes=[{tenantId:b.tenantId,kind:general?'private-user':'client',resourceId:client??b.actorId,policyRevision}];
 const createdAt=new Date(old-1000).toISOString(),conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes,policyRevision,createdAt};
 const tuple={tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId},principal={tenantId:b.tenantId,actorId:b.actorId},subject={tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId,ownerActorId:b.actorId};
 await insert('meri_conversations.conversations',{tenant_id:b.tenantId,conversation_id:b.conversationId,owner_actor_id:b.actorId,projection:conversation,projection_sha256:hash(conversation)});
 const f={b,client,scopes,policyRevision,tuple,principal,subject,conversation};
 if(!empty){
  const run={binding:b,state:'failed',scopes,policyRevision,versions,createdAt},request={requestId:id(),prompt:'Private prompt to erase',skill:null,window:null};
  const event={contractVersion:'0.1.0',eventId:id(),binding:b,sequence:1,createdAt,scopes,type:'run.status',data:{state:'failed',reasonCode:'SYNTHETIC'}};
  await insert('meri_conversations.runs',{...tuple,projection:run,projection_sha256:hash(run),request_id:request.requestId,request,request_sha256:hash(request),last_sequence:1});
  await insert('meri_conversations.events',{...tuple,sequence:1,event_id:event.eventId,event,event_sha256:hash(event)});
  const {versions:unused,...identity}=createExecutionBinding({binding:b,versions,plan:{fixture:true},expiresAtMs:old+10000,runtimeSessionId:'conversation-'+hash(b)}),record={...identity,phase:'settled',native:{state:'failed'}};
  await insert('meri_conversations.native_executions',{...tuple,execution_key:record.executionKey,execution_id:record.executionId,record,record_sha256:hash(record)});
  Object.assign(f,{run,request,record});
 }
 const trashRequestId=id();coreRecords.set(b.conversationId,{status:'trashed',trashRequestId,revision:'2',trashedAt:new Date(old).toISOString(),restoreUntil:new Date(old+30*day).toISOString()});
 clock=old;try{await startup.suppression.suppress({principal,subject,reason:'conversation-trash:'+trashRequestId});}finally{clock=null;}
 return f;
}
async function content(f,{entryCount=2,nearTranscriptLimit=false,streamPaths=['']}={}){
 const {b,tuple,scopes,client,policyRevision}=f,key={projectKey:'-workspace-conversation',sessionId:id()};
 const owner={binding:b,scopes,selectedClientId:client,policyRevision,key,executionSha256:hash(f.record),expiresAtMs:old+10000};
 assert.ok(Number.isSafeInteger(entryCount)&&entryCount>0&&entryCount<=100000);
 assert.ok(streamPaths.length>0&&streamPaths.length<=entryCount&&new Set(streamPaths).size===streamPaths.length);
 // Keep at most one append page in memory. Fixed entry bytes include UUID and
 // role differences; array separators stay inside the supported 32 MiB load.
 const entryBytes=nearTranscriptLimit?Math.floor((32*1024*1024-entryCount-2)/entryCount):160;
 const entryAt=i=>{const entry={type:i%2?'assistant':'user',uuid:id(),message:{content:'Private SDK text '}};
  entry.message.content+='x'.repeat(entryBytes-Buffer.byteLength(JSON.stringify(entry)));assert.equal(Buffer.byteLength(JSON.stringify(entry)),entryBytes);return entry;};
 const bytes=entryCount*entryBytes,transcriptBytes=bytes+entryCount+1;assert.ok(transcriptBytes<=32*1024*1024);
 await insert('meri_conversations.sdk_sessions',{...tuple,session_id:key.sessionId,project_key:key.projectKey,owner,owner_sha256:hash(owner),entries_count:entryCount,bytes});
 let batches=0;
 for(const [streamIndex,subpath] of streamPaths.entries()){
  const start=Math.floor(streamIndex*entryCount/streamPaths.length),streamCount=Math.floor((streamIndex+1)*entryCount/streamPaths.length)-start,streamKey={...key,...(subpath?{subpath}:{})};
  await insert('meri_conversations.sdk_session_streams',{...tuple,session_id:key.sessionId,subpath,last_sequence:streamCount});
  for(let offset=0;offset<streamCount;offset+=1000){
   const entries=Array.from({length:Math.min(1000,streamCount-offset)},(_,i)=>entryAt(start+offset+i)),rows=entries.map((entry,i)=>({sequence:offset+i+1,entry_uuid:entry.uuid,entry,entry_sha256:hash(entry)}));
   await pool.query('INSERT INTO meri_conversations.sdk_session_entries(tenant_id,conversation_id,run_id,session_id,subpath,sequence,entry_uuid,entry,entry_sha256) SELECT $1,$2::uuid,$3::uuid,$4::uuid,$5::text,page.sequence,page.entry_uuid,page.entry,page.entry_sha256 FROM jsonb_to_recordset($6::jsonb) AS page(sequence bigint,entry_uuid text,entry jsonb,entry_sha256 text)',[b.tenantId,b.conversationId,b.runId,key.sessionId,subpath,JSON.stringify(rows)]);
   const appendId=id(),requestSha256=hash({binding:b,key:streamKey,appendId,entries}),receipt={binding:b,key:streamKey,requestSha256,committed:true,appendId,entriesSha256:hash(entries),offset:offset+entries.length,added:entries.length};
   await insert('meri_conversations.sdk_session_batches',{...tuple,session_id:key.sessionId,append_id:receipt.appendId,request_sha256:receipt.requestSha256,receipt,receipt_sha256:hash(receipt)});batches++;
  }
 }
 f.sdk={key,entryCount,bytes,transcriptBytes,batches};
 const output={recipe:'original-selected-output-retention/1',request:f.request,pending:{sourceBinding:b,preparationSha256:'a'.repeat(64)},prepared:{context:{binding:b,scopes,assets:[]}},reads:[]};
 await insert('meri_conversations.selected_outputs',{...tuple,preparation_sha256:'a'.repeat(64),projection:output,projection_sha256:hash(output)});
 const request={preparationSha256:'a'.repeat(64),artifactRequestSha256:'b'.repeat(64),sourceContextSha256:'c'.repeat(64),baseVersionId:null,title:'Private draft title',format:'docx'};
 const record={operation:{id:'create_word',version:'0.2.0'},action:'document.draft',binding:b,request,inputSha256:hash({arguments:request,attachments:[]}),commandId:id(),idempotencyKey:'fixture-'+id(),proposalId:id(),scopes,createdAt:new Date(old).toISOString(),expiresAt:new Date(old+600000).toISOString(),requiredApprover:{tenantId:b.tenantId,actorId:b.actorId}};
 const payload=makePayload(record,{binding:b,scopes});
 await insert('meri_commands.approval_metadata',{tenant_id:b.tenantId,actor_id:b.actorId,proposal_id:record.proposalId,command_id:record.commandId,idempotency_key:record.idempotencyKey,command_sha256:payload.commandSha256,payload_sha256:hash(payload),payload});
 f.approval={record,payload};
}
async function capture(f,object){
 const {b,scopes}=f,input={controlId:id(),intent:'pause'};
 const files={workspace:{contractVersion:'0.1.0',manifestId:id(),binding:b,logicalCwd:'/workspace/conversation',entries:[{path:'private.txt',kind:'file',executable:false,object}],scopes,createdAt:new Date(old).toISOString()},tasks:[]};
 const projection={input,inputSha256:hash(input),sourceBinding:b,scopes,sourceSelectedClientId:f.client,sourceRequest:f.request,sourceRequestSha256:hash(f.request),contextSha256:hash({window:null,skill:null,scopes}),versions,captureSequence:1,command:null,commandSha256:null,approval:null,state:'UNKNOWN',checkpointId:null,proof:null,target:null,retirement:null,replayed:false,fileCapture:{requestSha256:hash(files),sessionId:id(),files}};
 await insert('meri_conversations.controls',{...f.tuple,control_id:input.controlId,projection,projection_sha256:hash(projection)});
 return files;
}
const plan=async f=>journal.withTransition(subjectKey(f.subject),async()=>{const inventory=await facts.inventoryFor(f.subject);await facts.sharedFor(f.subject,inventory);return recomputePlan(facts,f.subject,await journal.get(subjectKey(f.subject)),now());});

test('ordinary-role expired Trash row transaction and durable recovery',{timeout:120000,skip:!enabled&&'requires exact disposable Unix PG16 expiry fixture'},async t=>{
 t.after(()=>pool.end());
 t.after(()=>{for(const diagnostic of lookupDiagnostics)t.diagnostic('exact target lookup plans '+JSON.stringify(diagnostic));});
 t.afterEach(()=>{loseRowAck=false;loseFinalize=false;failLastMutation=false;readHook=null;clock=null;});
 await t.test('target and role are isolated, nonowner and nonprivileged',async()=>{
  const r=(await pool.query("SELECT current_user,current_database() database,current_setting('listen_addresses') listen,current_setting('server_version_num')::int version,inet_server_addr() address")).rows[0];
  assert.equal(r.current_user,'meri_control_runtime');assert.equal(r.database,DATABASE);assert.equal(r.listen,'');assert.equal(r.address,null);assert.ok(r.version>=160000&&r.version<170000);
  const role=(await pool.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user')).rows[0];assert.ok(Object.values(role).every(v=>v===false));
  await startup.start();
 });
 await t.test('zero-run General registration purges without a fabricated run and preserves its identity',async()=>{
  const f=await seed({empty:true,general:true});const p=await plan(f);assert.equal(p.state,'PLANNED');assert.equal(p.rowSteps.length,1);
  const r=await startup.purge.sweepSubject(f.subject);assert.equal(r.state,'EXECUTED');assert.equal(r.coreFinalized,true);
  assert.equal(await count('meri_conversations.conversations',f),1);assert.equal(await count('meri_conversations.runs',f),0);
 });
 await t.test('SDK, selected output, event and immutable approval bodies erase atomically; replay identities remain',async()=>{
  const f=await seed();await content(f);const p=await plan(f);assert.equal(p.state,'PLANNED');
  const sdk=p.rowSteps.filter(s=>s.className==='sdkSession');assert.equal(sdk.length,1);assert.deepEqual(sdk[0].target.sdk.counts,{sessions:1,streams:1,entries:2,batches:1});
  for(const table of ['events','meri_conversations.selected_outputs','meri_commands.approval_metadata'])assert.ok(p.rowSteps.some(s=>s.target.table===table),table);
  await assert.rejects(pool.query('DELETE FROM meri_conversations.sdk_session_entries WHERE tenant_id=$1',[f.b.tenantId]),/SDK_MIRROR|PURGE_TARGET/);
  const result=await startup.purge.sweepSubject(f.subject);assert.equal(result.state,'EXECUTED');assert.equal(result.coreFinalized,true);
  for(const table of ['sdk_sessions','sdk_session_streams','sdk_session_entries','sdk_session_batches','selected_outputs','events'])assert.equal(await count('meri_conversations.'+table,f),0,table);
  const run=(await pool.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1',[f.b.tenantId])).rows[0];assert.deepEqual(run.request,{retentionTombstone:true,conversationId:f.b.conversationId});assert.equal(run.request_sha256,hash(f.request));assert.equal(run.request_id,f.request.requestId);
  assert.equal(await count('meri_conversations.native_executions',f),1);
  const approval=(await pool.query('SELECT * FROM meri_commands.approval_metadata WHERE tenant_id=$1',[f.b.tenantId])).rows[0];assert.deepEqual(approval.payload,run.request);assert.equal(approval.command_sha256,f.approval.payload.commandSha256);
  await assert.rejects(pool.query('UPDATE meri_commands.approval_metadata SET payload=$2 WHERE tenant_id=$1',[f.b.tenantId,f.approval.payload]),/TOMBSTONE|IMMUTABLE/);
  await assert.rejects(pool.query('UPDATE meri_conversations.runs SET request=$2 WHERE tenant_id=$1',[f.b.tenantId,f.request]),/TOMBSTONE|IMMUTABLE/);
  const effects=rowEffects;assert.equal((await startup.purge.sweepSubject(f.subject)).coreFinalized,true);assert.equal(rowEffects,effects);
 });
 await t.test('maximum-character multibyte stream path retains exact hash-index lookup and erases normally',async()=>{
  const subpath=Array.from({length:1024},(_,i)=>String.fromCodePoint(0x100+(i*509)%1024)).join('');
  assert.equal(subpath.length,1024);assert.equal(Buffer.byteLength(subpath),2048);
  const f=await seed();await content(f,{entryCount:4,streamPaths:['',subpath]});const p=await plan(f);
  assert.deepEqual(p.rowSteps.find(s=>s.className==='sdkSession').target.sdk.counts,{sessions:1,streams:2,entries:4,batches:2});
  assert.equal((await startup.purge.sweepSubject(f.subject)).coreFinalized,true);
  for(const table of ['sdk_sessions','sdk_session_streams','sdk_session_entries','sdk_session_batches'])assert.equal(await count('meri_conversations.'+table,f),0,table);
 });
 await t.test('100000-entry near-32-MiB SDK expires through ordinary-role source, compact plan, exact purge and full absence',async t=>{
  const fixtureStarted=performance.now(),f=await seed();await content(f,{entryCount:100000,nearTranscriptLimit:true});
  t.diagnostic(`fixture construction ${Math.round(performance.now()-fixtureStarted)} ms; transcript ${f.sdk.transcriptBytes} bytes; ${f.sdk.batches} append pages`);
  assert.ok(f.sdk.transcriptBytes>31*1024*1024);measureSubject=f.subject.subjectId;inventoryTimings=[];inventorySqlTimings=[];
  try{
   const planStarted=performance.now(),p=await plan(f);t.diagnostic(`source/plan ${Math.round(performance.now()-planStarted)} ms`);
   const sdk=p.rowSteps.filter(s=>s.className==='sdkSession');assert.equal(p.state,'PLANNED');assert.equal(sdk.length,1);
   assert.deepEqual(sdk[0].target.sdk.counts,{sessions:1,streams:1,entries:100000,batches:100});assert.equal(sdk[0].target.sdk.entryBytes,f.sdk.bytes);
   assert.ok(Buffer.byteLength(JSON.stringify(p))<8*1024*1024,'compact plan fits the existing ledger record bound');
   const purgeStarted=performance.now(),result=await startup.purge.sweepSubject(f.subject),purgeMs=performance.now()-purgeStarted;
   t.diagnostic(`production sweep ${Math.round(purgeMs)} ms; actual inventory scans ${inventoryTimings.map(ms=>ms.toFixed(1)).join(', ')} ms; progressing wall clock, normal 20s sweep/5s snapshot/5s statements`);
   assert.equal(result.state,'EXECUTED');assert.equal(result.coreFinalized,true);assert.ok(purgeMs<20000);
   for(const table of ['sdk_sessions','sdk_session_streams','sdk_session_entries','sdk_session_batches'])assert.equal(await count('meri_conversations.'+table,f),0,table);
   const ledgerRows=await sink.read();assert.ok(ledgerRows.every(row=>Buffer.byteLength(JSON.stringify(row))<8*1024*1024));assert.ok(Buffer.byteLength(JSON.stringify(ledgerRows))<64*1024*1024);
   const effects=rowEffects;assert.equal((await startup.purge.sweepSubject(f.subject)).coreFinalized,true);assert.equal(rowEffects,effects);
  }finally{t.diagnostic(`actual inventory scan timings, including any refused scan: ${inventoryTimings.map(ms=>ms.toFixed(1)).join(', ')} ms`);
   t.diagnostic('inventory SQL timings '+JSON.stringify(inventorySqlTimings));measureSubject=null;inventoryTimings=[];inventorySqlTimings=[];inventorySqlTiming=null;}
 });
 await t.test('missing or false tombstone markers cannot rewrite protected bodies outside erasure',async()=>{
  const f=await seed();await content(f);
  for(const body of [{},{retentionTombstone:false}]){
   await assert.rejects(pool.query('UPDATE meri_commands.approval_metadata SET payload=$2 WHERE tenant_id=$1',[f.b.tenantId,body]),/CONTENT_IMMUTABLE/);
   await assert.rejects(pool.query('UPDATE meri_conversations.runs SET request=$2 WHERE tenant_id=$1',[f.b.tenantId,body]),/CONTENT_IMMUTABLE/);
  }
  await assert.rejects(pool.query('UPDATE meri_conversations.runs SET continuation=$2,continuation_sha256=$3 WHERE tenant_id=$1',[f.b.tenantId,{private:'replacement'},hash({private:'replacement'})]),/CONTENT_IMMUTABLE/);
  await pool.query('UPDATE meri_conversations.runs SET projection=projection,projection_sha256=projection_sha256 WHERE tenant_id=$1',[f.b.tenantId]);
  assert.equal((await pool.query('SELECT payload FROM meri_commands.approval_metadata WHERE tenant_id=$1',[f.b.tenantId])).rows[0].payload.record.request.title,'Private draft title');
 });
 await t.test('local candidate content erases inside the ordinary-role row transaction and preserves replay identity',async()=>{
  const f=await seed(),memory=createPostgresMemoryJournal({pool});
  const built=buildCandidate({candidateId:id(),principal:f.principal,scope:'client',clientId:f.client,content:'Private local memory candidate',key:null,ttlDays:null,sources:[],origin:{kind:'conversation',conversationId:f.b.conversationId,runId:f.b.runId,commandId:id(),commandSha256:'b'.repeat(64)},idempotencyKey:'candidate-'+id(),createdAt:new Date(old).toISOString()});
  const input={...built,requestSha256:'c'.repeat(64)};await memory.insert(input);
  await assert.rejects(pool.query('UPDATE meri_memory.candidates SET candidate=NULL,candidate_purged_at=clock_timestamp() WHERE tenant_id=$1',[f.b.tenantId]),/target unavailable|PURGE_TARGET/);
  const p=await plan(f);assert.equal(p.rowSteps.filter(s=>s.className==='meriMemoryCandidates').length,1);
  assert.equal((await startup.purge.sweepSubject(f.subject)).coreFinalized,true);
  const row=(await pool.query('SELECT * FROM meri_memory.candidates WHERE tenant_id=$1',[f.b.tenantId])).rows[0];
  assert.equal(row.candidate,null);assert.ok(row.candidate_purged_at);assert.equal(row.idempotency_key,built.candidate.idempotencyKey);assert.equal(row.candidate_sha256,built.candidateSha256);assert.equal(row.request_sha256,input.requestSha256);
  await assert.rejects(memory.insert(input),e=>productFailure(e)?.code==='MEMORY_PROPOSAL_NOT_FOUND');
  await assert.rejects(pool.query('UPDATE meri_memory.candidates SET candidate=$2,candidate_purged_at=NULL WHERE tenant_id=$1',[f.b.tenantId,built.candidate]));
  assert.equal((await startup.purge.sweepSubject(f.subject)).coreFinalized,true);
 });
 await t.test('lost committed row acknowledgement recovers by actual erased-body readback without repeating effects',async()=>{
  const f=await seed();await content(f,{entryCount:4097});const p=await plan(f);assert.equal(p.rowSteps.filter(s=>s.className==='sdkSession').length,1);loseRowAck=true;const before=rowEffects;
  await assert.rejects(startup.purge.sweepSubject(f.subject),e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&e.cause?.message==='synthetic lost committed row acknowledgement');assert.equal(rowEffects,before+1);assert.equal(await count('meri_conversations.sdk_session_entries',f),0);
  for(const table of ['sdk_sessions','sdk_session_streams','sdk_session_entries','sdk_session_batches'])assert.equal(await count('meri_conversations.'+table,f),0,table);
  const recovered=await startup.purge.sweepSubject(f.subject);assert.equal(recovered.state,'EXECUTED');assert.equal(recovered.coreFinalized,true);assert.equal(rowEffects,before+1);
 });
 await t.test('lost Core finalize acknowledgement retries finalization but never content erasure',async()=>{
  const f=await seed();loseFinalize=true;await assert.rejects(startup.purge.sweepSubject(f.subject),e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&e.cause?.message==='synthetic lost Core finalize acknowledgement');const n=rowEffects,attempts=finalizeAttempts;
  assert.equal((await startup.purge.sweepSubject(f.subject)).coreFinalized,true);assert.equal(rowEffects,n);assert.equal(finalizeAttempts,attempts+1);
 });
 await t.test('unexpired authoritative Trash and changed request generation refuse effects',async()=>{
  const f=await seed(),current=coreRecords.get(f.b.conversationId);current.trashedAt=new Date(real-day).toISOString();current.restoreUntil=new Date(real+29*day).toISOString();
  const n=rowEffects;assert.equal((await startup.purge.sweepSubject(f.subject)).state,'BLOCKED');assert.equal(rowEffects,n);assert.equal((await pool.query('SELECT request FROM meri_conversations.runs WHERE tenant_id=$1',[f.b.tenantId])).rows[0].request.prompt,f.request.prompt);
  current.trashRequestId=id();await assert.rejects(startup.purge.sweepSubject(f.subject),{code:'RETENTION_TRASH_GENERATION_REFUSED'});assert.equal(rowEffects,n);
 });
 await t.test('pre-expiry sweep leaves no purge fence and ordinary Restore release still succeeds',async()=>{
  const f=await seed(),current=coreRecords.get(f.b.conversationId);current.trashedAt=new Date(real-day).toISOString();current.restoreUntil=new Date(real+29*day).toISOString();
  assert.equal((await startup.purge.sweepSubject(f.subject)).state,'BLOCKED');assert.equal((await journal.get(subjectKey(f.subject))).purge,null);
  assert.equal((await startup.suppression.release({principal:f.principal,subject:f.subject,reason:'restore-in-window'})).state,'RELEASED');
  assert.equal(await count('meri_conversations.events',f),1);
 });
 await t.test('actual canonical artifact reference preserves its version while the source private rows erase',async()=>{
  const f=await seed(),object={objectId:id(),versionId:'fixture-object-version',sha256:'d'.repeat(64),bytes:5,scopes:f.scopes};await capture(f,object);objects.set(object.objectId+'@'+object.versionId,true);
  const record=artifactRecord();Object.assign(record.version,{artifactId:id(),versionId:id(),binding:f.b,scopes:f.scopes,object});record.inspection.sha256=object.sha256;record.inspection.bytes=object.bytes;
  await insert('meri_artifacts.versions',{version_id:record.version.versionId,artifact_id:record.version.artifactId,tenant_id:f.b.tenantId,actor_id:f.b.actorId,conversation_id:f.b.conversationId,request_sha256:record.requestSha256,record,record_sha256:hash(record)});
  const p=await plan(f);assert.equal(p.state,'PLANNED');assert.equal(p.steps.length,0);assert.equal(p.retainedObjects.length,1);assert.deepEqual(p.retainedObjects[0].heldBy,[`${f.b.tenantId}:artifact:${record.version.artifactId}`]);
  const before=deleted.length,r=await startup.purge.sweepSubject(f.subject);assert.equal(r.state,'EXECUTED');assert.equal(deleted.length,before);assert.equal(objects.has(object.objectId+'@'+object.versionId),true);assert.equal(await count('meri_conversations.controls',f),0);
  assert.equal((await pool.query('SELECT record_sha256 FROM meri_artifacts.versions WHERE version_id=$1',[record.version.versionId])).rows[0].record_sha256,hash(record));
 });
 await t.test('ordinary prepared intent becomes a non-replayable tombstone without changing its consumed delivery',async()=>{
  const f=await seed(),record={operation:{id:'create_word',version:'0.2.0'},argumentsSha256:'d'.repeat(64)},delivery='sdk:'+'d'.repeat(64);
  const row={tenant_id:f.b.tenantId,actor_id:f.b.actorId,conversation_id:f.b.conversationId,delivery_id:delivery,record,record_sha256:hash(record),state:'PREPARED',settled_at:new Date(old),outcome:{result:{text:'Private prepared content'},release:{binding:f.b,scopes:f.scopes,expiresAtMs:old+1000}}};
  await insert('meri_intents.preparations',{...row,state:'PENDING',settled_at:null,outcome:null});
  await pool.query("UPDATE meri_intents.preparations SET state='PREPARED',outcome=$2,settled_at=$3 WHERE tenant_id=$1",[f.b.tenantId,row.outcome,new Date(old)]);
  assert.equal((await startup.purge.sweepSubject(f.subject)).state,'EXECUTED');
  const r=(await pool.query('SELECT * FROM meri_intents.preparations WHERE tenant_id=$1',[f.b.tenantId])).rows[0];assert.equal(r.state,'REDACTED');assert.equal(r.outcome,null);assert.ok(r.outcome_purged_at);assert.deepEqual(r.record,record);assert.equal(r.delivery_id,delivery);
  await assert.rejects(insert('meri_intents.preparations',{...row,state:'PENDING',settled_at:null,outcome:null}),{code:'23505'});
  await assert.rejects(pool.query("UPDATE meri_intents.preparations SET state='PREPARED',outcome=$2 WHERE tenant_id=$1",[f.b.tenantId,row.outcome]),/TERMINAL|TOMBSTONE/);
 });
 await t.test('actual guarded REDACTED intent row remains valid in the inventory decoder',async()=>{
  const f=await seed(),record={operation:{id:'save_memory',version:'0.2.0'},argumentsSha256:'e'.repeat(64)},delivery='sdk:'+'e'.repeat(64);
  await insert('meri_intents.preparations',{tenant_id:f.b.tenantId,actor_id:f.b.actorId,conversation_id:f.b.conversationId,delivery_id:delivery,record,record_sha256:hash(record),state:'PENDING',settled_at:null,outcome:null});
  const outcome={result:{text:'Private memory preparation'},release:{binding:f.b,scopes:f.scopes,expiresAtMs:old+1000}};
  await pool.query("UPDATE meri_intents.preparations SET state='PREPARED',outcome=$2,settled_at=$3 WHERE tenant_id=$1",[f.b.tenantId,outcome,new Date(old)]);
  const raw=await scanConversationContentRows(pool,async(reader,sql,_cursor,initial)=>{
   const result=await reader.query(sql,[f.b.tenantId,f.b.conversationId,...initial]);assert.ok(result.rows.length<=32);return result.rows;
  });
  const run=(await pool.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1',[f.b.tenantId])).rows[0];
  const p=await plan(f),step=p.rowSteps.find(s=>s.target.table==='meri_intents.preparations');assert.ok(step);
  assert.equal((await startup.purge.sweepSubject(f.subject)).coreFinalized,true);
  const row=(await pool.query('SELECT * FROM meri_intents.preparations WHERE tenant_id=$1',[f.b.tenantId])).rows[0];
  assert.equal(row.state,'REDACTED');assert.equal(row.outcome,null);assert.deepEqual(row.record,record);assert.equal(row.delivery_id,delivery);
  // Verify the actual stored terminal shape against its actual preceding owned
  // run snapshot; full erasure has deliberately tombstoned that run's request.
  raw['meri_intents.preparations']=[row];
  assert.doesNotThrow(()=>decodeConversationContentRows(raw,{subject:f.subject,projection:f.conversation},new Map([[f.b.runId,{row:run,projection:run.projection}]])));
  assert.equal(await journal.rows.present(subjectKey(f.subject),step),false);
 });
 await t.test('one altered row rolls back every content effect, then exact current inventory can retry',async()=>{
  const f=await seed();await content(f);const p=await plan(f),original=f.approval.payload;
  // A malformed claimed target cannot partially consume earlier FK children.
  const altered=structuredClone(p);altered.rowSteps.find(x=>x.target.table==='meri_commands.approval_metadata').target.rowSha256='f'.repeat(64);
  await assert.rejects(journal.rows.purge(subjectKey(f.subject),altered));
  assert.equal(await count('meri_conversations.sdk_session_entries',f),2);assert.equal(await count('meri_conversations.events',f),1);
  assert.deepEqual((await pool.query('SELECT payload FROM meri_commands.approval_metadata WHERE tenant_id=$1',[f.b.tenantId])).rows[0].payload,original);
  assert.equal((await startup.purge.sweepSubject(f.subject)).state,'EXECUTED');
 });
 await t.test('late statement failure rolls back prior real deletes in the one row transaction',async()=>{
  const f=await seed();await content(f,{entryCount:4097});failLastMutation=true;observedDeletes=0;
  await assert.rejects(startup.purge.sweepSubject(f.subject),e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&e.cause?.message==='synthetic final-statement outage');assert.ok(observedDeletes>=5,'all five earlier SDK entry pages executed inside the rolled-back transaction');
  assert.equal(await count('meri_conversations.sdk_session_entries',f),4097);assert.equal(await count('meri_conversations.sdk_sessions',f),1);assert.equal(await count('meri_conversations.sdk_session_streams',f),1);assert.equal(await count('meri_conversations.sdk_session_batches',f),5);assert.equal(await count('meri_conversations.events',f),1);
  assert.equal((await pool.query('SELECT payload FROM meri_commands.approval_metadata WHERE tenant_id=$1',[f.b.tenantId])).rows[0].payload.record.request.title,'Private draft title');
  assert.equal((await startup.purge.sweepSubject(f.subject)).state,'EXECUTED');
 });
 await t.test('Restore release winning exclusion invalidates stale purge without content effects',async()=>{
  const f=await seed();const p=await plan(f);await startup.suppression.release({principal:f.principal,subject:f.subject,reason:'conversation-restore:'+id()});coreRecords.get(f.b.conversationId).status='active';
  const n=rowEffects;await assert.rejects(startup.purge.execute(p),{code:'RETENTION_NOT_SUPPRESSED'});assert.equal(rowEffects,n);assert.equal(await count('meri_conversations.events',f),1);
 });
 await t.test('concurrent Restore waits for the existing subject lock and cannot release completed purge',async()=>{
  const f=await seed(),rival=new pg.Pool({host:SOCKET,database:DATABASE,user:'meri_control_runtime',max:1,connectionTimeoutMillis:2000});
  const rivalJournal=createPostgresRetentionJournal({pool:rival,now}),suppression=createSuppressionOwner({journal:rivalJournal,ledger:startup.ledger,ownership:rivalJournal,serving:startup.serving,now});
  let release,entered;const held=new Promise(r=>release=r),reached=new Promise(r=>entered=r);let once=true;
  readHook=async s=>{if(s.subjectId===f.b.conversationId&&once){once=false;entered();await held;}};
  let restore,erasure;
  try{
   erasure=startup.purge.sweepSubject(f.subject);await reached;
   restore=suppression.release({principal:f.principal,subject:f.subject,reason:'concurrent-restore'});restore.catch(()=>{});
   const observer=new pg.Client({host:SOCKET,database:DATABASE,user:'meri_control_runtime'});await observer.connect();
   try{let waiting=false;for(let i=0;i<100;i++){const r=await observer.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND cardinality(pg_blocking_pids(pid))>0");if(r.rowCount){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}assert.equal(waiting,true,'actual PG lock wait observed');}finally{await observer.end();}
   release();assert.equal((await erasure).state,'EXECUTED');await assert.rejects(restore,{code:'RETENTION_PURGE_IN_PROGRESS'});
   assert.equal((await journal.get(subjectKey(f.subject))).state,'SUPPRESSED');
  }finally{release();readHook=null;await Promise.allSettled([erasure,restore].filter(Boolean));await rival.end();}
 });
 await t.test('DDL, parent deletion, accounting mutation and unplanned content deletion remain forbidden',async()=>{
  const f=await seed();
  for(const sql of ['CREATE TABLE meri_conversations.unapproved_purge_test(x int)','TRUNCATE meri_conversations.events',`DELETE FROM meri_conversations.conversations WHERE tenant_id='${f.b.tenantId}'`,`DELETE FROM meri_conversations.runs WHERE tenant_id='${f.b.tenantId}'`])await assert.rejects(pool.query(sql));
  await assert.rejects(pool.query('DELETE FROM meri_conversations.events WHERE tenant_id=$1',[f.b.tenantId]));
  assert.equal(await count('meri_conversations.events',f),1);
 });
});
