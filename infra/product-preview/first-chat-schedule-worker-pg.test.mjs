/** Actual PG16, exact disposable socket only. All product calls use ordinary control/schedule logins.
 * Provisioning/LOGIN for these synthetic credentials is owned by the separate finite harness.
 * Core firing signatures and Temporal are explicit local fixtures: this is not browser/provider acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as id} from 'node:crypto';
import pg from '../../apps/runtime/node_modules/pg/lib/index.js';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {fixture,validators,approve} from '../../packages/contracts/test/schedule-tool-interface-fixtures.mjs';
import {versions} from '../../apps/control/conversations/test/store-fixture.mjs';
import {createPostgresScheduleOwner} from '../../apps/control/schedules/postgres-schedule-owner.mjs';
import {createApprovedScheduleInstructions} from '../../apps/control/schedules/approved-instructions.mjs';
import {createPostgresIntentJournalStore,createPostgresPreparedScheduleReader} from '../../apps/control/intents/postgres-journal.mjs';
import {createPostgresConversationStore} from '../../apps/control/conversations/postgres-store.mjs';
import {createScheduledJobLifecycle} from '../../apps/control/schedules/scheduled-job-lifecycle.mjs';
import {createScheduledDispatch} from '../../apps/control/schedules/scheduled-dispatch.mjs';
import {occurrenceIdentity} from '../../apps/control/schedules/scheduled-occurrence.mjs';
import {workflowId} from '../../apps/control/conversations/temporal-dispatch.mjs';
import {createRoutinesFiringAuthority,createRoutinesUnattendedRunControl} from '../../apps/runtime/native-authority/routines-firing-authority.mjs';
import {routineFiringTrust} from '../../apps/runtime/native-authority/routines-firing-grant.mjs';
import {coreSigner} from '../../apps/runtime/native-authority/test/routines-core-fixture.mjs';

const SOCKET='/tmp/meri-schedule-worker-pg-20261025/socket',DATABASE='meri_schedule_worker_fixture';
const enabled=process.env.MERI_SCHEDULE_WORKER_PG_SOCKET!==undefined;
if(enabled&&(process.platform!=='linux'||process.env.MERI_SCHEDULE_WORKER_PG_SOCKET!==SOCKET||process.env.MERI_SCHEDULE_WORKER_PG_DATABASE!==DATABASE))throw Error('SCHEDULE_PG_TARGET_REFUSED');
const check=()=>{},denied=e=>e?.code==='42501';

test('dedicated ordinary schedule role operates existing dispatch/recovery/Stop and has no admission or policy authority',{
 skip:!enabled&&'requires root-allocated disposable socket-only PG16 fixture',timeout:45000
},async t=>{
 const options={host:SOCKET,database:DATABASE,max:2,connectionTimeoutMillis:2000,query_timeout:6000,options:'-c statement_timeout=5000 -c lock_timeout=2000'};
 const pool=new pg.Pool({...options,user:'meri_schedule_runtime'}),control=new pg.Pool({...options,user:'meri_control_runtime'});
 t.after(async()=>{await pool.end();await control.end();});
 const identity=(await pool.query("SELECT current_user,session_user,current_database() AS database,current_setting('listen_addresses') AS listen,current_setting('server_version_num')::int AS version,inet_server_addr() AS address")).rows[0];
 assert.equal(identity.current_user,'meri_schedule_runtime');assert.equal(identity.session_user,'meri_schedule_runtime');
 assert.equal(identity.database,DATABASE);assert.equal(identity.listen,'');assert.equal(identity.address,null);assert.ok(identity.version>=160000&&identity.version<170000);
 const attrs=(await pool.query('SELECT rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
 assert.ok(Object.values(attrs).every(v=>v===false));
 assert.equal((await pool.query("SELECT pg_has_role(current_user,'meri_product_migrator','MEMBER') AS member")).rows[0].member,false);
 const schedule=createPostgresScheduleOwner({pool}),foreground=createPostgresScheduleOwner({pool:control}),store=createPostgresConversationStore({pool}),controlStore=createPostgresConversationStore({pool:control});
 const f=fixture(),ctx=f.context.scheduleContext,selectedClientId=id();
 ctx.projection.owner={tenantId:id(),actorId:id()};ctx.callerIdentity=ctx.projection.owner;
 ctx.projection.scopes=[{tenantId:ctx.projection.owner.tenantId,kind:'client',resourceId:selectedClientId,policyRevision:'p1'}];
 const prepared=validators.prepare(f.operation,f.request,f.context),intent=prepared.intent,p=intent.projection;
 const bindingRecord={intent,bindingSha256:hash(intent)};
 await foreground.claim(bindingRecord,check);await foreground.markDispatching(bindingRecord,check);await foreground.commitKnown(bindingRecord,check);
 const owner=p.owner,key={...owner,conversationId:id(),deliveryId:'sdk:'+hash(intent)},record={operation:{id:'schedule_task',version:'0.2.0'},argumentsSha256:prepared.requestSha256};
 const release={binding:{...owner,conversationId:key.conversationId,runId:id(),attemptId:id(),workerId:id(),writerFence:1},scopes:p.scopes,expiresAtMs:Date.now()-1000};
 const journal=createPostgresIntentJournalStore({pool:control});await journal.claim({key,record});
 await journal.settle({key,record,state:'PREPARED',outcome:{result:{status:'approval_required',proposal:prepared.proposal},release}});
 const instructions=createApprovedScheduleInstructions({scheduleOwner:schedule,preparations:createPostgresPreparedScheduleReader({pool})});
 const selection={tenantId:owner.tenantId,scheduleId:p.scheduleId,generation:1,task:intent.configuration.task,instructionSha256:intent.taskInstructionSha256};
 await t.test('canonical approved instruction custody and owner-scoped reads use actual database grants',async()=>{
  assert.deepEqual(await instructions.read(selection),{instruction:prepared.input.taskInstruction});
  assert.equal(await schedule.readFiring({tenantId:id(),scheduleId:p.scheduleId},check),null);
  assert.deepEqual((await schedule.list({owner:{...owner,actorId:id()},afterScheduleId:null,limit:10},check)).rows,[]);
  await assert.rejects(instructions.read({...selection,tenantId:id()}));
 });
 const occurrence={workflowId:'synthetic-schedule-worker',temporalScheduleId:p.temporalScheduleId,scheduledAt:new Date().toISOString(),projection:p,generation:1,task:intent.configuration.task};
 const identityOf=occurrenceIdentity(occurrence),b=identityOf.binding,effect={binding:b,requestId:identityOf.requestId,eventId:identityOf.eventId,workflowId:workflowId(b)};
 const opened={tenantId:owner.tenantId,scheduleId:p.scheduleId,generation:1,occurrenceKey:identityOf.occurrenceKey,occurrence,effect};
 await t.test('occurrence barrier is idempotent and durable across new owner instances; control INSERT remains denied',async()=>{
  assert.deepEqual(await schedule.openOccurrence(opened,check),{state:'OPEN',blocking:null});
  assert.deepEqual(await createPostgresScheduleOwner({pool}).openOccurrence(opened,check),{state:'OPEN',blocking:null});
  const saved=await schedule.readOccurrenceForConversation({tenantId:b.tenantId,conversationId:b.conversationId},check);assert.deepEqual(saved.effect,effect);
  const next={...occurrence,workflowId:'synthetic-next'};const nextIdentity=occurrenceIdentity(next);
  assert.equal((await schedule.openOccurrence({...opened,occurrenceKey:nextIdentity.occurrenceKey,occurrence:next,effect:{binding:nextIdentity.binding,requestId:nextIdentity.requestId,eventId:nextIdentity.eventId,workflowId:workflowId(nextIdentity.binding)}},check)).state,'BLOCKED');
  await assert.rejects(control.query('INSERT INTO meri_schedules.occurrences DEFAULT VALUES'),denied);
 });
 const at=Date.now(),createdAt=new Date(at).toISOString(),scopes=p.scopes,request={requestId:effect.requestId,prompt:prepared.input.taskInstruction,skill:null,window:null,windowRequest:null};
 const conversation={conversationId:b.conversationId,owner,scopes,createdAt,policyRevision:'p1'},run={binding:b,state:'running',scopes,createdAt,policyRevision:'p1',versions};
 // Fixture seeding through the ordinary foreground login. The tested schedule login cannot create any of these records.
 const insert=async(table,row)=>{const columns=Object.keys(row);await control.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map((_,n)=>'$'+(n+1)).join(',')})`,Object.values(row));};
 await insert('meri_conversations.conversations',{tenant_id:b.tenantId,conversation_id:b.conversationId,owner_actor_id:b.actorId,projection:conversation,projection_sha256:hash(conversation)});
 await insert('meri_conversations.runs',{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,projection:run,projection_sha256:hash(run),request_id:request.requestId,request,request_sha256:hash(request),last_sequence:1});
 const event={contractVersion:'0.1.0',eventId:effect.eventId,binding:b,sequence:1,createdAt,scopes,type:'run.status',data:{state:'running',reasonCode:null}};
 await insert('meri_conversations.events',{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,sequence:1,event_id:event.eventId,event,event_sha256:hash(event)});
 const facts={binding:b,scopes,versions,selectedClientId,requestId:request.requestId,inputSha256:hash(request),requestSha256:hash(request),allocatedAtMs:at,expiresAtMs:at+60000};
 await insert('meri_conversations.initial_inputs',{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,request_id:request.requestId,allocation:facts,allocation_sha256:hash(facts),state:'ACCEPTED',accepted_request_sha256:hash(request)});
 const native={binding:b,executionKey:hash(b),executionId:hash(b),planSha256:'a'.repeat(64),expiresAtMs:at+60000,runtimeSessionId:'synthetic-schedule-session-00000001',phase:'started',native:null};
 await insert('meri_conversations.native_executions',{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,execution_key:native.executionKey,execution_id:native.executionId,record:native,record_sha256:hash(native)});
 const signer=coreSigner({kid:'schedule-pg-fire'}),trust=routineFiringTrust(signer.pin),coreState={deny:false,unavailable:false,calls:0},calls={cancel:0,retire:0};
 const wires={async unattendedGrant(q){coreState.calls++;if(coreState.unavailable)throw Error('synthetic Core unavailable');if(coreState.deny)throw Object.assign(Error('refused'),{code:'ROUTINES_CORE_REFUSED'});
  const nowMs=Date.now(),s=Math.floor(nowMs/1000);const claims={tenantId:q.tenantId,ownerActorId:q.ownerActorId,scheduleId:q.scheduleId,generation:q.generation,intentSha256:q.intentSha256,projectionSha256:q.projectionSha256,occurrenceKey:q.occurrenceKey,phase:q.phase,scopes,membershipRevision:'synthetic-current',consentId:id(),consentIssuedAtS:s-60,consentExpiresAtS:s+3600,limits:{maxCostMicrousd:p.maxCostMicrousd,maxRuntimeSeconds:p.maxRuntimeSeconds,retryLimit:p.retryLimit}};
  const signed=signer.sign(claims,{nowMs,ttl:30,typ:'capiro-meri-routine-fire+jwt',aud:'meri-schedule-firing'});return {grant:signed.proof};
 }};
 const authority=createRoutinesFiringAuthority({wires,trust,scheduleOwner:schedule,now:Date.now,maxRequestMs:5000});
 const dispatcher={async start(){throw Error('must not start admitted running work');},async cancel(){assert.equal((await controlStore.read(b,{limit:10},check)).run.state,'cancelled');calls.cancel++;return {workflow:'CANCEL_REQUESTED'};}};
 const runControl=createRoutinesUnattendedRunControl({wires,trust,scheduleOwner:schedule,store,dispatcher,now:Date.now,maxRequestMs:5000});
 const retirement={async retire(){calls.retire++;await control.query('UPDATE meri_conversations.native_executions SET record=$1,record_sha256=$2 WHERE tenant_id=$3 AND conversation_id=$4 AND run_id=$5',[{...native,phase:'settled',native:{state:'cancelled',stopped:true}},hash({...native,phase:'settled',native:{state:'cancelled',stopped:true}}),b.tenantId,b.conversationId,b.runId]);}};
 const jobOwner=createScheduledJobLifecycle({store,runControl,retirement,now:Date.now,maxRequestMs:5000});
 const dispatch=createScheduledDispatch({scheduleOwner:schedule,store,dispatcher,runs:{async describe(){return 'PRESENT';}},authority,taskInstructions:instructions,versions,now:Date.now,maxRequestMs:5000,runAdmission:{async admit(){throw Error('must use control admission');}},jobOwner});
 await t.test('current Core grant permits exact owner only; denial/unavailability never produce a cancellation write',async()=>{
  const input={phase:'before_start',occurrence:identityOf.identity,occurrenceKey:identityOf.occurrenceKey,projection:p};assert.equal((await authority.authorize(input)).authorized,true);
  coreState.deny=true;assert.equal((await authority.authorize(input)).authorized,false);
  await assert.rejects(runControl.cancel({binding:b,deadlineMs:Date.now()+5000}));assert.equal((await store.read(b,{limit:10},check)).run.state,'running');
  coreState.deny=false;coreState.unavailable=true;await assert.rejects(authority.authorize(input));coreState.unavailable=false;
  await assert.rejects(runControl.cancel({binding:{...b,actorId:id()},deadlineMs:Date.now()+5000}));assert.equal(calls.cancel,0);
 });
 await t.test('actual canonical recovery keeps active work OPEN, then Stop journals before Temporal and releases only after retirement',async()=>{
  assert.equal((await dispatch.reconcile({occurrence})).outcome,'ACTIVE');
  const result=await dispatch.cancel({occurrence});assert.equal(result.outcome,'DISPATCHED');assert.equal(calls.cancel,1);assert.equal(calls.retire,1);
  assert.equal((await store.read(b,{limit:10},check)).run.state,'cancelled');
  assert.equal((await schedule.readOccurrenceForConversation({tenantId:b.tenantId,conversationId:b.conversationId},check)).state,'DISPATCHED');
  assert.equal((await dispatch.reconcile({occurrence})).outcome,'DISPATCHED');
 });
 await t.test('paused generation refuses new firing before Core; stale or foreign bindings do not mutate retained work',async()=>{
  const paused={...intent,intentId:id(),operation:'cancel_scheduled_task',expectedGeneration:1,generation:2,previousProjectionSha256:hash(p),projection:{...p,state:'paused'},configuration:null,cancel:{mode:'pause',note:'synthetic pause',running:'leave',runs:[]}};
  const bound={intent:paused,bindingSha256:hash(paused)};await foreground.claim(bound,check);await foreground.markDispatching(bound,check);await foreground.commitKnown(bound,check);
  const before=coreState.calls;assert.equal((await authority.authorize({phase:'before_admission',occurrence:identityOf.identity,occurrenceKey:identityOf.occurrenceKey,projection:p})).authorized,false);assert.equal(coreState.calls,before);
  assert.equal(await store.readOptional({...b,tenantId:id()},{limit:1},check),null);
  await assert.rejects(store.lifecycle.cancel({...b,actorId:id()},{eventId:id(),createdAt,type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}},check,scopes));
 });
 await t.test('FOR UPDATE lock columns work but actual identity UPDATE is rejected even on empty selections',async()=>{
  for(const [table,column] of [['controls','control_id'],['initial_inputs','request_id'],['native_executions','execution_id']]){
   await pool.query(`SELECT * FROM meri_conversations.${table} LIMIT 0 FOR UPDATE`);
   await assert.rejects(pool.query(`UPDATE meri_conversations.${table} SET ${column}=${column} WHERE false`),e=>e.code==='P0001'&&e.message==='MERI_LOCK_COLUMN_UPDATE_REFUSED');
  }
 });
 await t.test('ordinary role cannot admit, approve, change policy/retention, widen scope, erase rows, or assume control/migrator',async()=>{
  for(const sql of ['INSERT INTO meri_conversations.conversations DEFAULT VALUES','INSERT INTO meri_conversations.runs DEFAULT VALUES',
   'INSERT INTO meri_conversations.initial_inputs DEFAULT VALUES','INSERT INTO meri_conversations.native_executions DEFAULT VALUES',
   'UPDATE meri_conversations.runs SET request=request','UPDATE meri_conversations.runs SET tenant_id=tenant_id',
   'UPDATE meri_conversations.controls SET projection=projection','UPDATE meri_schedules.projections SET generation=generation',
   'INSERT INTO meri_intents.preparations DEFAULT VALUES','SELECT * FROM meri_settings.tenant_settings',
   'SELECT * FROM meri_commands.approval_metadata','SELECT * FROM meri_conversations.retention_subjects',
   'DELETE FROM meri_schedules.occurrences','TRUNCATE meri_conversations.events','CREATE TABLE meri_schedules.forbidden(id int)',
   'SET ROLE meri_control_runtime','SET ROLE meri_product_migrator'])await assert.rejects(pool.query(sql),denied,sql);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'meri\\_%' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)")).rows[0].n,0);
 });
});
