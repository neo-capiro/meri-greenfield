import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadPlan,runPsqlScript,migrationBody} from './first-chat-migrate.mjs';

test('schedule activation uses the existing phase interpreter without changing ordinary migration role restrictions',async()=>{
 const entry=loadPlan().find(e=>e.kind==='phase:schedule_worker_grants'),statements=[];
 await runPsqlScript({text:entry.text,variables:{phase_schedule_worker_grants:'1'},connect:async()=>({
  async query(q){statements.push(q);return {rows:[]};},async end(){}
 })});
 const sql=statements.join('\n');
 assert.match(sql,/BEGIN;[\s\S]*CREATE ROLE meri_schedule_runtime NOLOGIN[\s\S]*SET LOCAL ROLE meri_product_migrator;[\s\S]*COMMIT;/u);
 assert.doesNotMatch(sql,/PASSWORD|ALTER ROLE meri_control_runtime|GRANT .*TO meri_control_runtime/u);
 assert.throws(()=>migrationBody('BEGIN; SET LOCAL ROLE NONE; COMMIT;'),/MERI_D2_MIGRATION_TRANSACTION_SHAPE/u);
 assert.match(sql,/has_table_privilege\('meri_control_runtime','meri_schedules\.occurrences','INSERT'\)/u);
 const grants=statements.filter(q=>/^GRANT /u.test(q)).map(q=>q.replace(/\s+/gu,' ').trim());
 assert.deepEqual(grants,[
  'GRANT CONNECT ON DATABASE capiro TO meri_schedule_runtime;',
  'GRANT USAGE ON SCHEMA meri_schedules, meri_intents, meri_conversations TO meri_schedule_runtime;',
  'GRANT SELECT ON meri_schedules.projections, meri_schedules.intents, meri_intents.preparations TO meri_schedule_runtime;',
  'GRANT SELECT, INSERT ON meri_schedules.occurrences TO meri_schedule_runtime;',
  'GRANT UPDATE (state,updated_at) ON meri_schedules.occurrences TO meri_schedule_runtime;',
  'GRANT SELECT ON meri_conversations.runs, meri_conversations.events, meri_conversations.controls, meri_conversations.initial_inputs, meri_conversations.next_runs, meri_conversations.native_executions, meri_conversations.native_allocations TO meri_schedule_runtime;',
  'GRANT INSERT ON meri_conversations.events TO meri_schedule_runtime;',
  'GRANT UPDATE (projection,projection_sha256,last_sequence) ON meri_conversations.runs TO meri_schedule_runtime;',
  'GRANT UPDATE (control_id) ON meri_conversations.controls TO meri_schedule_runtime;',
  'GRANT UPDATE (request_id) ON meri_conversations.initial_inputs TO meri_schedule_runtime;',
  'GRANT UPDATE (execution_id) ON meri_conversations.native_executions TO meri_schedule_runtime;'
 ]);
});

test('production schedule composition keeps native admission/retirement and canonical current authority',()=>{
 const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
 const service=read('apps/runtime/schedule-service-owners.mjs'),worker=read('apps/runtime/schedule-worker.mjs');
 assert.match(service,/createRoutinesOccurrencePorts\(\{native:r.native\}\)/u);
 assert.match(service,/createRoutinesFiringAuthority/u);assert.match(service,/createRoutinesUnattendedRunControl/u);
 assert.match(worker,/runAdmission===undefined\?\{\}:\{runAdmission\}/u);
 assert.match(service,/store:createPostgresConversationStore/u);
 assert.match(read('apps/runtime/native-authority/routines-run-control.mjs'),/journalCancel=sdkMethod\(facet.value,'cancel'\)/u);
});
