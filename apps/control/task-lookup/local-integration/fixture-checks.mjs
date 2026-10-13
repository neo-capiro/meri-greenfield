/** Read-only admission/readback. Source migration hashes are not installation provenance. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {data,keys,digest,method} from '../binding.mjs';
export const migrationPaths=Object.freeze({
 qualification:'apps/proxy/qualification/state/migrations/0001_qualification_state.sql',
 budget:'apps/proxy/qualification/state/migrations/0002_tool_budget.sql',
 invocation:'apps/proxy/qualification/state/migrations/0003_tool_invocations.sql',
 lookup:'apps/control/task-lookup/migrations/0001_task_lookup.sql',
});
const root=new URL('../../../../',import.meta.url);
export function assertLocalDescriptor(value,now=Date.now()){
 const d=data(value);keys(d,['mode','host','port','database','user','systemIdentifier','serverStartTime','serverVersion','deadlineMs','migrationSha256']);
 assert.equal(d.mode,'synthetic-local-action');assert.equal(d.host,'127.0.0.1');assert.equal(d.database,'meri_qualification_test');assert.equal(d.user,'qualification_owner');
 assert(Number.isSafeInteger(d.port)&&d.port>=1&&d.port<=65535);
 assert.match(d.systemIdentifier,/^[0-9]{1,20}$/);assert.match(d.serverVersion,/^[1-9][0-9]{5}$/);
 assert.equal(new Date(d.serverStartTime).toISOString(),d.serverStartTime);
 assert(Number.isSafeInteger(now)&&Number.isSafeInteger(d.deadlineMs)&&d.deadlineMs>now&&d.deadlineMs-now<=900000);
 keys(d.migrationSha256,Object.keys(migrationPaths));Object.values(d.migrationSha256).forEach(digest);return d;
}
export async function verifyFixture(pool,d,run){
 for(const [key,path]of Object.entries(migrationPaths)){
  const bytes=await run(()=>readFile(new URL(path,root)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),d.migrationSha256[key],`source migration ${key}`);
 }
 const query=method(pool,'query');
 const result=await run(()=>query("SELECT current_database() AS database,current_user AS username,inet_server_addr()::text AS address,inet_server_port() AS port,current_setting('server_version_num') AS version,pg_postmaster_start_time() AS started,current_setting('fsync') AS fsync,current_setting('synchronous_commit') AS synchronous_commit,(SELECT system_identifier::text FROM pg_control_system()) AS system_identifier"));
 assert.equal(result.rows.length,1);const r=result.rows[0];
 assert.equal(r.database,d.database);assert.equal(r.username,d.user);assert.equal(r.address,d.host);assert.equal(r.port,d.port);assert.equal(r.version,d.serverVersion);
 assert(r.started instanceof Date);assert.equal(r.started.toISOString(),d.serverStartTime);assert.equal(r.system_identifier,d.systemIdentifier);assert.equal(r.fsync,'on');assert.equal(r.synchronous_commit,'on');
 // All source owners must already be installed. No schema creation or ALTER here.
 const required={
  budget:'id,cap_micro_usd,consumed_micro_usd,quarantined',runs:'run_id,attempt,worker_arn,fence,policy_revision',
  grants:'grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state',
  requests:'request_id,grant_id,run_id,state,hold_micro_usd,actual_micro_usd',
  tool_run_allocations:'run_id,allocation_sha256,allocation,started_at,max_tool_calls,max_cost_micro_usd',
  tool_grant_bindings:'grant_id,run_id,facts',
  tool_reservations:'invocation_id,reservation_id,grant_id,run_id,facts,operation,arguments_sha256,hold_micro_usd,max_output_bytes,state,charged_micro_usd,output_bytes,created_at,settled_at',
  tool_invocations:'invocation_id,run_id,producer_key_sha256,delivery,facts,raw_request_sha256,operation,deadline_ms,created_at,reservation_id,arguments_sha256,completion',
  budget_liabilities:'kind,slot,run_id,grant_id,state,hold_micro_usd,consumed_micro_usd',
 };
 for(const [table,columns]of Object.entries(required))await run(()=>query(`SELECT ${columns} FROM meri_qualification.${table} LIMIT 0`));
 await run(()=>query('SELECT tenant_id,lookup_id,result_reference,payload,state,record FROM meri_task_lookup.lookups LIMIT 0'));
 await run(()=>query('SELECT tenant_id,run_id,sequence,event_id,lookup_id,kind,event FROM meri_task_lookup.events LIMIT 0'));
 return Object.freeze({identityMatched:true,fsync:true,synchronousCommit:true,requiredRelations:11,migrationSourceHashesMatched:true,installationProvenanceVerified:false});
}
export async function readCaseRows(pool,c,run){
 const query=method(pool,'query'),b=c.lookup.context.binding,lookupId=c.lookup.context.lookupId;
 const rows=await run(()=>query('SELECT state,payload,record FROM meri_task_lookup.lookups WHERE tenant_id=$1 AND lookup_id=$2',[b.tenantId,lookupId]));
 const events=await run(()=>query('SELECT sequence::text,event_id,kind,event FROM meri_task_lookup.events WHERE tenant_id=$1 AND lookup_id=$2 ORDER BY sequence',[b.tenantId,lookupId]));
 const invocations=await run(()=>query('SELECT invocation_id,reservation_id,arguments_sha256,completion FROM meri_qualification.tool_invocations WHERE run_id=$1',[b.runId]));
 const reservations=await run(()=>query('SELECT invocation_id,reservation_id,state,hold_micro_usd::text,charged_micro_usd::text,output_bytes::text FROM meri_qualification.tool_reservations WHERE run_id=$1',[b.runId]));
 return {lookups:rows.rows,events:events.rows,invocations:invocations.rows,reservations:reservations.rows};
}
