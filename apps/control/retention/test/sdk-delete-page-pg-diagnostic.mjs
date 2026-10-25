/** One real page only, on the caller's already locked/registered ordinary-role
 * transaction. The caller must force rollback after collecting this diagnostic. */
import assert from 'node:assert/strict';

export async function inspectSdkDeletePage(client,{sql,args}){
 assert.equal(sql,'DELETE FROM meri_conversations.sdk_session_entries r WHERE r.tenant_id=$1 AND r.conversation_id=$2 AND r.run_id=$3::uuid AND r.session_id=$4::uuid AND r.subpath=$5::text AND r.sequence=ANY($6::bigint[])');
 assert.equal(args.length,6);assert.ok(Array.isArray(args[5]));assert.equal(args[5].length,1000);
 const projection=(await client.query(`SELECT pg_column_size(s.projection) AS stored_bytes,
  octet_length(s.projection::text) AS text_bytes,pg_column_compression(s.projection) AS compression,
  current_user AS role,current_setting('statement_timeout') AS statement_timeout,
  current_setting('lock_timeout') AS lock_timeout,current_setting('plan_cache_mode') AS plan_cache_mode
  FROM meri_conversations.retention_subjects s WHERE s.tenant_id=$1 AND s.conversation_id=$2`,args.slice(0,2))).rows;
 assert.equal(projection.length,1);assert.equal(projection[0].role,'meri_control_runtime');
 assert.equal(projection[0].statement_timeout,'5s');assert.equal(projection[0].lock_timeout,'2s');
 const rows=(await client.query('EXPLAIN (ANALYZE,BUFFERS,TIMING,FORMAT JSON) '+sql,args)).rows;
 assert.equal(rows.length,1);const plan=rows[0]['QUERY PLAN'];assert.ok(Array.isArray(plan)&&plan.length===1);
 assert.equal(plan[0].Plan['Node Type'],'ModifyTable');assert.equal(plan[0].Plan.Operation,'Delete');
 const trigger=plan[0].Triggers.find(t=>t['Trigger Name']==='immutable_sdk_session_entries');
 assert.equal(trigger?.Calls,1000);
 return {pageRows:1000,projection:projection[0],plan};
}
