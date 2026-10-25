/** Diagnostic only: the caller supplies its already registered ordinary-role
 * purge transaction. Importing this module opens no database connection. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const TABLE='meri_conversations.sdk_session_entries';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const keys=['run_id','session_id','subpath','sequence'];
const modes=['auto','force_custom_plan','force_generic_plan'];

/** EXPLAIN does not execute the guard or mutate content. Extract its actual
 * stored SELECT, preserving the legacy OR, every authority filter and locks.
 * Only the five PL/pgSQL local references become prepared-statement parameters.
 * A savepoint permits setting/statement cleanup after a diagnostic SQL failure. */
export async function inspectRetentionTargetLookup(client,{tenantId,conversationId,page}){
 assert.equal(typeof client?.query,'function');assert.equal(typeof tenantId,'string');assert.ok(tenantId.length>0&&tenantId.length<=128);assert.match(conversationId,UUID);
 assert.ok(Array.isArray(page)&&page.length>0&&page.length<=1000);
 for(const key of page){assert.deepEqual(Object.keys(key).sort(),keys.slice().sort());assert.match(key.run_id,UUID);assert.match(key.session_id,UUID);
  assert.equal(typeof key.subpath,'string');assert.ok(key.subpath.length<=1024);assert.ok(Number.isSafeInteger(key.sequence)&&key.sequence>0&&key.sequence<=100000);}
 const first=page[0],name='retention_lookup_'+randomUUID().replaceAll('-','');let previous,prepared=false,result;
 await client.query(`SAVEPOINT ${name}`);
 try{
  previous=(await client.query("SELECT current_setting('plan_cache_mode') AS mode")).rows[0]?.mode;assert.ok(modes.includes(previous));
  const source=(await client.query("SELECT pg_get_functiondef('meri_conversations.expired_conversation_purge_target(text,jsonb,text)'::regprocedure) AS definition")).rows[0]?.definition;
  assert.equal(typeof source,'string');assert.ok(Buffer.byteLength(source)<=16384);
  const matches=[...source.matchAll(/\bRETURN EXISTS\s*\(([\s\S]*?)\n\s*\);/gu)];assert.equal(matches.length,1);
  const query=matches[0][1].trim();assert.ok(query.startsWith('SELECT 1 FROM meri_conversations.retention_purge_targets t'));
  assert.ok(query.endsWith('FOR UPDATE OF t,s'));assert.ok(!query.includes(';')&&!query.includes('--')&&!query.includes('/*'));
  const locals={p_table:'($1::text)',p_row:'($2::jsonb)',p_mode:'($3::text)',actual_key:'($4::jsonb)',conversation:'($5::text)'};
  // SQL string constants are copied verbatim, including doubled quote escapes.
  const sql=query.replace(/'(?:''|[^'])*'|\b(?:p_table|p_row|p_mode|actual_key|conversation)\b/gu,token=>locals[token]??token);
  const current=(await client.query(`SELECT to_jsonb(r)::text AS row_json,jsonb_build_object('run_id',r.run_id,'session_id',r.session_id,'subpath',r.subpath,'sequence',r.sequence)::text AS key_json FROM ${TABLE} r WHERE r.tenant_id=$1 AND r.conversation_id=$2::uuid AND r.run_id=$3::uuid AND r.session_id=$4::uuid AND r.subpath=$5 AND r.sequence=$6::bigint`,[tenantId,conversationId,first.run_id,first.session_id,first.subpath,first.sequence])).rows;
  assert.equal(current.length,1);const {row_json:row,key_json:key}=current[0];assert.equal(typeof row,'string');assert.equal(typeof key,'string');assert.deepEqual(JSON.parse(key),first);
  await client.query(`PREPARE ${name}(text,jsonb,text,jsonb,text) AS SELECT EXISTS (${sql})`);prepared=true;
  // Parameter values and the generated identifier are quoted by PostgreSQL,
  // never interpolated from JSON into executable SQL by JavaScript.
  const statement=(await client.query("SELECT format('EXPLAIN (FORMAT JSON, COSTS TRUE) EXECUTE %I(%L::text,%L::jsonb,%L::text,%L::jsonb,%L::text)',$1::text,$2::text,$3::jsonb::text,$4::text,$5::jsonb::text,$6::text) AS statement",[name,TABLE,row,'delete',key,conversationId])).rows[0]?.statement;
  assert.equal(typeof statement,'string');assert.ok(statement.startsWith('EXPLAIN (FORMAT JSON, COSTS TRUE) EXECUTE '));
  const plans={};for(const mode of modes.slice(1)){
   await client.query("SELECT set_config('plan_cache_mode',$1,true)",[mode]);
   const rows=(await client.query(statement)).rows;assert.equal(rows.length,1);const plan=rows[0]['QUERY PLAN'];assert.ok(Array.isArray(plan)&&plan.length===1&&plan[0]?.Plan);plans[mode]=plan;
  }
  result={pageRows:page.length,planCacheModeBefore:previous,plans};
 }catch(error){await client.query(`ROLLBACK TO SAVEPOINT ${name}`);throw error;}
 finally{
  try{if(previous!==undefined)await client.query("SELECT set_config('plan_cache_mode',$1,true)",[previous]);}
  finally{try{if(prepared)await client.query(`DEALLOCATE ${name}`);}finally{await client.query(`RELEASE SAVEPOINT ${name}`);}}
 }
 return result;
}
