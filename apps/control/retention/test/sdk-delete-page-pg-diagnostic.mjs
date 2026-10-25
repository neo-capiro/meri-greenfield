/** One real page only, on the caller's already locked ordinary-role
 * transaction. The caller must force rollback after collecting this diagnostic. */
import assert from 'node:assert/strict';

export async function inspectSdkPermitPage(client,{sql,args}){
 assert.equal(sql,"INSERT INTO meri_conversations.retention_purge_targets(workflow_id,tenant_id,conversation_id,class,target,plan_sha256,state,ledger_sequence) SELECT page.workflow_id,$1,$2,'sdkSession',page.target,$3,'PLANNED',$4 FROM jsonb_to_recordset($5::jsonb) AS page(workflow_id text,target jsonb) ON CONFLICT (workflow_id) DO UPDATE SET state='PLANNED',plan_sha256=EXCLUDED.plan_sha256,ledger_sequence=EXCLUDED.ledger_sequence,target=EXCLUDED.target");
 assert.equal(args.length,5);const page=JSON.parse(args[4]);assert.ok(Array.isArray(page));assert.equal(page.length,1000);
 assert.ok(page.every(row=>row.target?.table==='meri_conversations.sdk_session_entries'&&row.target.mode==='delete'));
 const rows=(await client.query('EXPLAIN (ANALYZE,BUFFERS,TIMING,FORMAT JSON) '+sql,args)).rows;
 assert.equal(rows.length,1);const plan=rows[0]['QUERY PLAN'];assert.ok(Array.isArray(plan)&&plan.length===1);
 assert.equal(plan[0].Plan['Node Type'],'ModifyTable');assert.equal(plan[0].Plan.Operation,'Insert');
 assert.equal(plan[0].Plan['Tuples Inserted'],1000);assert.equal(plan[0].Plan['Conflicting Tuples'],0);
 return {pageRows:plan[0].Plan['Tuples Inserted'],args,plan};
}

export async function inspectSdkDeletePage(client,{sql,args,permit}){
 assert.equal(sql,'DELETE FROM meri_conversations.sdk_session_entries r WHERE r.tenant_id=$1 AND r.conversation_id=$2 AND r.run_id=$3::uuid AND r.session_id=$4::uuid AND r.subpath=$5::text AND r.sequence=ANY($6::bigint[])');
 assert.equal(args.length,6);assert.ok(Array.isArray(args[5]));assert.equal(args[5].length,1000);
 assert.equal(permit?.pageRows,1000);assert.deepEqual(permit.args.slice(0,2),args.slice(0,2));
 assert.deepEqual(JSON.parse(permit.args[4]).map(row=>row.target.key),args[5].map(sequence=>({run_id:args[2],session_id:args[3],subpath:args[4],sequence})),
  'the explained INSERT and DELETE must describe the same exact page');
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
 return {pageRows:1000,projection:projection[0],permit:{pageRows:permit.pageRows,plan:permit.plan},plan};
}
