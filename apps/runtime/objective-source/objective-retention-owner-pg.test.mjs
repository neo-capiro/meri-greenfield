/** Actual ordinary-role Objective admission/inventory/purge and serving exclusion.
 * Core authority, Temporal dispatch and the external ledger sink are explicit
 * synthetic ports. This is not authenticated/model/preview acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as id} from 'node:crypto';
import pg from '../node_modules/pg/lib/index.js';
import {runStartFixture} from './test/run-start-fixture.mjs';
import {createObjectiveRunStartRecord} from './run-starts.mjs';
import {createPostgresObjectiveRunStartStore} from './postgres-run-starts.mjs';
import {createObjectiveNativeAdmission} from '../native-authority/objective-admission.mjs';
import {createObjectiveRunOwner} from '../objective-generation/run-owner.mjs';
import {createObjectiveGenerationReadback} from '../objective-generation/retained-result.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {createPostgresRetentionJournal} from '../../control/retention/postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../../control/retention/postgres-watermark.mjs';
import {createMemoryLedgerSink} from '../../control/retention/ledger.mjs';
import {createRetentionStartup} from '../../control/retention/startup.mjs';
import {createConversationPurgeFacts} from '../../control/retention/inventory-source.mjs';
import {hash,subjectKey} from '../../control/retention/boundary.mjs';

const SOCKET='/tmp/meri-expired-trash-pg-20261024/socket',DATABASE='meri_expired_trash_fixture';
const supplied=process.env.MERI_EXPIRED_TRASH_PG_SOCKET!==undefined||process.env.MERI_EXPIRED_TRASH_PG_DATABASE!==undefined;
if(supplied&&(process.platform!=='linux'||process.env.MERI_EXPIRED_TRASH_PG_SOCKET!==SOCKET||process.env.MERI_EXPIRED_TRASH_PG_DATABASE!==DATABASE))throw Error('OBJECTIVE_RETENTION_PG_TARGET_REFUSED');
const enabled=supplied&&process.platform==='linux',day=86400000,check=()=>{};
const insert=(c,table,row)=>{const keys=Object.keys(row);return c.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));};
const without=(v,key)=>Object.fromEntries(Object.entries(v).filter(([k])=>k!==key));
function fresh(){
 const f=runStartFixture({tenantId:id(),actorId:id(),generationJobId:id(),requestId:id(),clientId:id()}),at=Date.now();
 f.selection.sourceAdmission.admittedAtMs=at-1000;f.selection.sourceAdmission.effectExpiresAtMs=at+150000;
 f.selection.request.requestedAtMs=at;f.selection.request.originalExpiresAtMs=at+150000;f.selection.request.inputSha256=hash(without(f.selection.request,'inputSha256'));
 f.record=createObjectiveRunStartRecord({binding:f.binding,generationJobId:f.generationJobId,selection:f.selection,nowMs:at});
 f.subject={tenantId:f.tenantId,kind:'conversation',subjectId:f.binding.conversationId,ownerActorId:f.actorId};f.principal={tenantId:f.tenantId,actorId:f.actorId};return f;
}

test('Objective actual owner retention composition',{skip:!enabled&&'requires exact disposable Unix PG16 fixture',timeout:60000},async t=>{
 const pool=new pg.Pool({host:SOCKET,database:DATABASE,user:'meri_control_runtime',max:6,connectionTimeoutMillis:2000,query_timeout:5000,options:'-c statement_timeout=4000 -c lock_timeout=2000'});t.after(()=>pool.end());
 const identity=(await pool.query("SELECT current_user,current_database() database,current_setting('listen_addresses') listen,current_setting('server_version_num')::int version,inet_server_addr() address")).rows[0];
 assert.equal(identity.current_user,'meri_control_runtime');assert.equal(identity.database,DATABASE);assert.equal(identity.listen,'');assert.equal(identity.address,null);assert.ok(identity.version>=160000&&identity.version<170000);
 let clock=null;const now=()=>clock??Date.now(),journal=createPostgresRetentionJournal({pool,now}),coreRecords=new Map();
 const coreFacts={async read(s){const r=coreRecords.get(s.subjectId);assert.ok(r);return {...r,checkedAtMs:now()};}};
 const storage={permissions:{deleteObjectVersion:true},async holdsFor(){return {legalHold:false,objectLockRetainUntilMs:null};},async headVersion(){assert.fail('no object exists in this fixture');},async deleteVersion(){assert.fail('no object exists in this fixture');}};
 const facts=createConversationPurgeFacts({pool,journal,core:coreFacts,storage,keyFor:o=>o.objectId,now});
 const startup=createRetentionStartup({journal,watermark:createPostgresWatermarkStore({journal}),ledgerSink:createMemoryLedgerSink(),ownership:journal,now,purge:{enabled:true,storage,rows:journal.rows,facts,keyFor:o=>o.objectId,async finalize(s,trash){assert.equal(coreRecords.get(s.subjectId).trashRequestId,trash.requestId);}}});await startup.start();
 const store=createPostgresConversationStore({pool}),runStarts=createPostgresObjectiveRunStartStore({enabled:true,pool});
 function owner(f,{deny=false,failAdmission=false}={}){
  const state={current:0,accepted:false,dispatches:0};
  const authority={async currentRecord(){state.current++;if(deny||failAdmission&&state.current>1)throw Error('synthetic current authority refusal');
   return {generationJobId:f.generationJobId,tenantId:f.tenantId,actorId:f.actorId,clientId:f.clientId,consentId:f.selection.sourceAdmission.consentId,controlVersion:f.selection.sourceAdmission.controlVersion,effectExpiresAtMs:f.record.effectExpiresAtMs};}};
  const admission=createObjectiveNativeAdmission({pool,store,authority,template:{versions,policyRevision:'policy1',configurationSha256:'c'.repeat(64),runWindowMs:60000}});
  const core={async accept(){const r=await store.readOptional(f.binding,{after:0,limit:1},check);assert.equal(r.run.state,'queued');state.accepted=true;},async readAcceptance(){assert.equal(state.accepted,true);}};
  const runtime=createObjectiveRunOwner({enabled:true,runStarts,admission,core,dispatcher:{async start(){assert.equal(state.accepted,true);state.dispatches++;}},store,retention:startup.gate});
  return {runtime,state,start:()=>runtime.start({binding:f.binding,generationJobId:f.generationJobId,acceptedRequest:{requestId:f.acceptedRequest.requestId,prompt:f.acceptedRequest.prompt},selection:f.selection})};
 }
 const count=(table,f)=>pool.query(`SELECT count(*)::int n FROM ${table} WHERE tenant_id=$1 AND conversation_id=$2`,[f.tenantId,f.binding.conversationId]).then(r=>r.rows[0].n);
 async function suppress(f){const at=Date.now()-31*day,trashRequestId=id();coreRecords.set(f.binding.conversationId,{status:'trashed',trashRequestId,revision:'2',trashedAt:new Date(at).toISOString(),restoreUntil:new Date(at+30*day).toISOString()});
  clock=at;try{return await startup.suppression.suppress({principal:f.principal,subject:f.subject,reason:'conversation-trash:'+trashRequestId});}finally{clock=null;}
 }
 const inventory=f=>journal.withTransition(subjectKey(f.subject),()=>facts.inventoryFor(f.subject));
 await t.test('refused current authority leaves neither custody nor private prompt',async()=>{
  const f=fresh(),h=owner(f,{deny:true});await assert.rejects(h.start());assert.equal(await count('meri_conversations.conversations',f),0);assert.equal(await count('meri_objective_source.run_starts',f),0);assert.equal(h.state.dispatches,0);
 });
 await t.test('failed admission retains a real zero-run subject; actual inventory and purge erase its prompt only',async()=>{
  const f=fresh(),h=owner(f,{failAdmission:true});await assert.rejects(h.start());assert.equal(await count('meri_conversations.conversations',f),1);assert.equal(await count('meri_conversations.runs',f),0);assert.equal(h.state.dispatches,0);
  const before=(await pool.query('SELECT * FROM meri_objective_source.run_starts WHERE generation_job_id=$1',[f.generationJobId])).rows[0],inv=await inventory(f);
  assert.ok(inv.rowTargets.some(r=>r.table==='meri_objective_source.run_starts'));assert.equal(JSON.stringify(inv).includes(f.acceptedRequest.prompt),false);
  await suppress(f);assert.equal((await startup.purge.sweepSubject(f.subject)).state,'EXECUTED');
  const after=(await pool.query('SELECT * FROM meri_objective_source.run_starts WHERE generation_job_id=$1',[f.generationJobId])).rows[0];assert.deepEqual(after.record,{retentionTombstone:true,conversationId:f.binding.conversationId});assert.deepEqual({...after,record:before.record},before);
  await assert.rejects(runStarts.putOnce({record:f.record}));await assert.rejects(runStarts.readByJob({generationJobId:f.generationJobId}));assert.equal(await count('meri_conversations.runs',f),0);
 });
 await t.test('accepted run readback holds the actual serving lock; suppression then blocks reads and settled purge retains identities',async()=>{
  const f=fresh(),h=owner(f),document={defaultTimezone:'UTC',capabilityPolicy:{}};
  await insert(pool,'meri_settings.tenant_settings',{tenant_id:f.tenantId,revision:1,document,document_sha256:hash(document),updated_at:new Date(),updated_by:f.actorId,monthly_cap_micro_usd:100000000});
  assert.deepEqual(await h.start(),{kind:'started'});assert.equal(h.state.dispatches,1);assert.equal(await count('meri_conversations.runs',f),1);assert.ok((await inventory(f)).rowTargets.some(r=>r.table==='meri_objective_source.run_starts'));
  const entered=Promise.withResolvers(),release=Promise.withResolvers();let suppressionDone=false;
  const reader=createObjectiveGenerationReadback({runStarts,store:{...store,async read(...args){const r=await store.read(...args);entered.resolve();await release.promise;return r;}},objects:{async get(){assert.fail('acceptance does not read objects');}},retention:startup.gate});
  const input={schemaVersion:1,generationJobId:f.generationJobId,sourceAdmissionSha256:f.record.sourceAdmissionSha256},reading=reader.acceptance(input);await entered.promise;
  const suppression=suppress(f).then(r=>{suppressionDone=true;return r;});
  try{const deadline=Date.now()+1000;let waiting=0;while(!waiting&&Date.now()<deadline){waiting=(await pool.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND NOT granted")).rows[0].n;if(!waiting)await new Promise(r=>setTimeout(r,10));}assert.ok(waiting>0);assert.equal(suppressionDone,false);
  }finally{release.resolve();}
  assert.deepEqual((await reading).record,f.record);await suppression;await assert.rejects(reader.acceptance(input));await assert.rejects(h.runtime.read({binding:f.binding}));
  assert.equal((await startup.purge.sweepSubject(f.subject)).state,'BLOCKED','queued execution still blocks purge');
  await store.append(f.binding,{eventId:id(),createdAt:new Date().toISOString(),type:'run.status',data:{state:'failed',reasonCode:'SYNTHETIC'}},check);
  const {versions:unused,...execution}=createExecutionBinding({binding:f.binding,versions,plan:{fixture:true},expiresAtMs:Date.now()+30000,runtimeSessionId:'conversation-'+hash(f.binding)}),record={...execution,phase:'settled',native:{state:'failed'}};
  await insert(pool,'meri_conversations.native_executions',{tenant_id:f.tenantId,conversation_id:f.binding.conversationId,run_id:f.binding.runId,execution_key:record.executionKey,execution_id:record.executionId,record,record_sha256:hash(record)});
  assert.equal((await startup.purge.sweepSubject(f.subject)).state,'EXECUTED');assert.equal(await count('meri_conversations.runs',f),1);await assert.rejects(runStarts.read({binding:f.binding}));
 });
 await t.test('historical unregistered prompt refuses canonical inventory without synthesizing custody or expiry',async()=>{
  const f=fresh();await runStarts.putOnce({record:f.record});await assert.rejects(inventory(f));assert.equal(await count('meri_conversations.conversations',f),0);assert.equal(await count('meri_objective_source.run_starts',f),1);
 });
});
