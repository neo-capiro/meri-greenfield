/** Actual PostgreSQL view/grant qualification in one explicitly enabled, disposable, network-none container.
 * No host port, bind mount, persistent volume or shared database is used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PLAN,migrationBody} from '../../../../../infra/product-preview/first-chat-migrate.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {versions,id} from '../../../../control/conversations/test/store-fixture.mjs';

const file='../migrations/0003_native_routine_facts.sql',source=readFileSync(new URL(file,import.meta.url),'utf8');
test('routine facts append ordinal 53 without broadening the existing Core facts grants',()=>{
 const last=PLAN.at(-1);assert.equal(last.ordinal,53);assert.equal(last.stage,'integration');
 assert.equal(last.path,'apps/runtime/native-authority/read-delegation/migrations/0003_native_routine_facts.sql');
 assert.equal(last.pinned,createHash('sha256').update(source).digest('hex'));
 assert.match(migrationBody(source),/CREATE VIEW meri_read_delegation_facts\.routine_runs_v1 WITH \(security_barrier = true\)/u);
 assert.doesNotMatch(source,/GRANT (?!SELECT ON TABLE meri_read_delegation_facts\.routine_runs_v1 TO capiro_app;)|CREATE ROLE|ALTER TABLE|\br\.request\b|\bi\.intent\b/u);
});

test('actual PG native routine facts preserve canonical hashes, current writer, successor and narrow Core grants',
 {skip:process.env.MERI_ROUTINE_FACTS_PG!=='1',timeout:120000},async t=>{
 const name='meri-routine-facts-53-'+randomUUID(),label='meri-test-owner='+name;
 const call=(args,input)=>{const p=spawnSync(process.platform==='win32'?'wsl.exe':'docker',process.platform==='win32'?['-d','Codex-Gates','--','docker',...args]:args,
  {input,encoding:'utf8',timeout:30000,maxBuffer:1024*1024,windowsHide:true});if(p.error)throw p.error;return p;};
 const docker=(args,input)=>{const p=call(args,input);assert.equal(p.status,0,p.stderr);return p.stdout.trim();};
 const sql=(text,{refused=false}={})=>{const p=call(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','routine_facts_53'],text);
  if(refused){assert.notEqual(p.status,0);assert.match(p.stderr,refused===true?/permission denied/u:refused);return;}
  assert.equal(p.status,0,p.stderr);return p.stdout.trim();};
 const literal=v=>"'"+String(v).replaceAll("'","''")+"'",json=v=>literal(JSON.stringify(v))+'::jsonb';
 const asCore=text=>sql('SET ROLE capiro_app; '+text),query=text=>JSON.parse(asCore('SELECT coalesce(jsonb_agg(x),\'[]\'::jsonb) FROM ('+text+') x;'));
 let created=false;
 try{
  assert.equal(docker(['ps','-aq','--filter','name=^/'+name+'$']),'');
  docker(['run','-d','--name',name,'--label',label,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=routine_facts_53','pgvector/pgvector:pg16']);created=true;
  for(let n=0;n<40;n++){if(call(['exec',name,'pg_isready','-U','postgres','-d','routine_facts_53']).status===0)break;await new Promise(r=>setTimeout(r,250));}
  assert.match(sql('SHOW server_version;'),/^16\./u);
  sql('CREATE ROLE meri_product_migrator NOLOGIN; CREATE ROLE capiro_app NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE routine_unrelated NOLOGIN; GRANT CREATE ON DATABASE routine_facts_53 TO meri_product_migrator;');
  const base=['0001_conversations.sql','0002_lifecycle.sql','0003_selected_outputs.sql','0004_sdk_sessions.sql','0005_selected_reads.sql','0006_native_executions.sql','0007_native_preparation.sql','0008_native_prepared_launch.sql','0009_next_runs.sql'];
  for(const name of base)sql('SET ROLE meri_product_migrator; '+readFileSync(new URL('../../../../control/conversations/migrations/'+name,import.meta.url),'utf8'));
  for(const name of ['0001_schedule_owner.sql','0002_occurrences.sql'])sql('SET ROLE meri_product_migrator; '+readFileSync(new URL('../../../../control/schedules/migrations/'+name,import.meta.url),'utf8'));
  sql('SET ROLE meri_product_migrator; CREATE SCHEMA meri_read_delegation_facts; REVOKE ALL ON SCHEMA meri_read_delegation_facts FROM PUBLIC; GRANT USAGE ON SCHEMA meri_read_delegation_facts TO capiro_app;');
  sql('SET ROLE meri_product_migrator; '+source);
  const fixtures=[];
  for(const tenantId of ['synthetic-routine-a','synthetic-routine-b']){
   const binding={tenantId,actorId:'synthetic-owner',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},scopes=[{tenantId,kind:'client',resourceId:id(5),policyRevision:'synthetic-policy'}];
   const owner={tenantId,actorId:binding.actorId},createdAt='2026-10-24T00:00:00.000Z',run={binding,state:'running',scopes,createdAt,policyRevision:'synthetic-policy',versions};
   const projection={scheduleId:id(6),owner,temporalScheduleId:tenantId,timezone:'UTC',scopes,state:'active',maxCostMicrousd:1000,maxRuntimeSeconds:60,retryLimit:0,destinationId:'meri-inbox',createdAt};
   const occurrence={workflowId:'synthetic-workflow',temporalScheduleId:tenantId,scheduledAt:createdAt,projection,generation:1,task:{taskId:id(7),manifestSha256:'a'.repeat(64),version:1}};
   const effect={binding,requestId:id(8),eventId:id(9),workflowId:'synthetic-conversation'},key=hash({tenantId}),executionKey=hash(binding);
   const execution={binding,executionKey,executionId:executionKey,planSha256:'b'.repeat(64),expiresAtMs:1800000060000,runtimeSessionId:'synthetic-runtime-session-'+tenantId,phase:'started',native:null};
   sql(`SET ROLE meri_product_migrator; INSERT INTO meri_conversations.conversations VALUES (${literal(tenantId)},'${id(1)}','synthetic-owner','{}','synthetic');
    INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256) VALUES (${literal(tenantId)},'${id(1)}','${id(2)}',${json(run)},'${hash(run)}','${id(8)}','{"prompt":"DO_NOT_EXPOSE_SYNTHETIC_PROMPT"}','synthetic');
    INSERT INTO meri_schedules.projections VALUES (${literal(tenantId)},'${id(6)}',${literal(tenantId)},'synthetic-owner',1,${json(projection)},'${hash(projection)}',NULL);
    INSERT INTO meri_schedules.occurrences(tenant_id,occurrence_key,schedule_id,generation,occurrence,effect,effect_sha256,state) VALUES (${literal(tenantId)},'${key}','${id(6)}',1,${json(occurrence)},${json(effect)},'${hash(effect)}','OPEN');
    INSERT INTO meri_conversations.native_executions VALUES (${literal(tenantId)},'${id(1)}','${id(2)}','${executionKey}','${executionKey}',${json(execution)},'${hash(execution)}');`);
   fixtures.push({tenantId,binding,run,projection,occurrence,effect,execution,key});
  }
  await t.test('canonical objects and hashes survive the service-only view; tenant selectors do not cross-join',()=>{
   for(const f of fixtures){const rows=query(`SELECT * FROM meri_read_delegation_facts.routine_runs_v1 WHERE tenant_id=${literal(f.tenantId)}`);assert.equal(rows.length,1);const r=rows[0];
    for(const [object,digest]of [['projection','projection_sha256'],['effect','effect_sha256'],['run_projection','run_projection_sha256'],['execution_record','execution_record_sha256']])assert.equal(hash(r[object]),r[digest]);
    assert.deepEqual(r.execution_record,f.execution);assert.deepEqual(r.occurrence,f.occurrence);assert.equal(r.current_writer,true);assert.equal(r.no_successor,true);assert.doesNotMatch(JSON.stringify(r),/DO_NOT_EXPOSE|prompt|instruction/u);}
  });
  await t.test('Core has no base schema/table/write access; unrelated role cannot select facts',()=>{
   assert.equal(asCore("SELECT has_schema_privilege(current_user,'meri_conversations','USAGE'),has_schema_privilege(current_user,'meri_schedules','USAGE'),has_table_privilege(current_user,'meri_read_delegation_facts.routine_runs_v1','SELECT');"),'f|f|t');
   assert.equal(asCore("SELECT has_table_privilege(current_user,'meri_read_delegation_facts.routine_runs_v1','INSERT'),has_table_privilege(current_user,'meri_read_delegation_facts.routine_runs_v1','UPDATE'),has_table_privilege(current_user,'meri_read_delegation_facts.routine_runs_v1','DELETE');"),'f|f|f');
   for(const statement of ['SELECT * FROM meri_conversations.runs','SELECT * FROM meri_schedules.projections'])sql('SET ROLE capiro_app; '+statement+';',{refused:true});
   for(const statement of ['DELETE FROM meri_read_delegation_facts.routine_runs_v1','INSERT INTO meri_read_delegation_facts.routine_runs_v1(tenant_id) VALUES (\'x\')'])sql('SET ROLE capiro_app; '+statement+';',{refused:/cannot (delete from|insert into) view/u});
   sql('SET ROLE routine_unrelated; SELECT * FROM meri_read_delegation_facts.routine_runs_v1;',{refused:true});
   assert.equal(sql("SELECT reloptions FROM pg_class WHERE oid='meri_read_delegation_facts.routine_runs_v1'::regclass;"),'{security_barrier=true}');
  });
  await t.test('a reservation immediately prevents no_successor, including before target run creation',()=>{
   const f=fixtures[0];sql(`SET ROLE meri_product_migrator; INSERT INTO meri_conversations.next_runs VALUES (${literal(f.tenantId)},'${id(1)}','${id(2)}','${id(12)}','{}','${'c'.repeat(64)}','RESERVED');`);
   const [r]=query(`SELECT current_writer,no_successor FROM meri_read_delegation_facts.routine_runs_v1 WHERE tenant_id=${literal(f.tenantId)}`);assert.deepEqual(r,{current_writer:true,no_successor:false});
  });
  await t.test('a newer writer changes current_writer without rewriting the original effect',()=>{
   const f=fixtures[1],newRun={...f.run,binding:{...f.binding,runId:id(12),writerFence:2}};
   sql(`SET ROLE meri_product_migrator; INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256) VALUES (${literal(f.tenantId)},'${id(1)}','${id(12)}',${json(newRun)},'${hash(newRun)}','${id(18)}','{}','synthetic');`);
   const [r]=query(`SELECT current_writer,no_successor,effect FROM meri_read_delegation_facts.routine_runs_v1 WHERE tenant_id=${literal(f.tenantId)}`);assert.equal(r.current_writer,false);assert.equal(r.no_successor,true);assert.deepEqual(r.effect,f.effect);
  });
  await t.test('changed schedule and corrupted digest remain observable for Core refusal, never silently repaired',()=>{
   const f=fixtures[0];sql(`SET ROLE meri_product_migrator; UPDATE meri_schedules.projections SET generation=2,active_intent='${id(19)}',projection_sha256='${'d'.repeat(64)}' WHERE tenant_id=${literal(f.tenantId)};`);
   const [r]=query(`SELECT * FROM meri_read_delegation_facts.routine_runs_v1 WHERE tenant_id=${literal(f.tenantId)}`);assert.equal(r.generation,2);assert.equal(r.active_intent,id(19));assert.notEqual(hash(r.projection),r.projection_sha256);assert.equal(r.occurrence.generation,1);
  });
  t.diagnostic('Owned disposable container '+name+'; PostgreSQL 16; network none; no host mount/port; no persistent services changed.');
 }finally{
  if(created){const identity=JSON.parse(docker(['inspect',name]))[0];assert.equal(identity.Config.Labels['meri-test-owner'],name);assert.equal(identity.HostConfig.NetworkMode,'none');assert.deepEqual(identity.HostConfig.Tmpfs,{'/var/lib/postgresql/data':''});assert.equal(identity.Mounts.length,0);
   docker(['rm','-f',name]);assert.equal(docker(['ps','-aq','--filter','name=^/'+name+'$']),'');t.diagnostic('Owned container removed and absence verified: '+name);}
 }
});
