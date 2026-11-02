/** Opt-in real SQL proof of the settlement selection on a newly created, marked database inside a disposable PostgreSQL 16
 * cluster (config JSON: host, port, user and optional password). Applies the immutable 0001/0006/0009 DDL it reads, seeds
 * rows directly and drops only the database it created. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {listUnprogressedRuns,UNCLAIMED_RUN_AGE_MS,EXPIRED_CLAIM_GRACE_MS} from '../unprogressed-runs.mjs';
import {hash} from '../boundary.mjs';
const config=process.env.MERI_UNPROGRESSED_RUNS_PG_CONFIG;
test('owned PG16: the selection takes exactly the runs nothing can progress and nothing a live or held run owns',{skip:!config},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);const c=JSON.parse(await readFile(config,'utf8'));assert.equal(c.host,'127.0.0.1');
 const connection={host:c.host,port:c.port,user:c.user,...(c.password?{password:c.password}:{}),connectionTimeoutMillis:5000};
 const database='meri_unprogressed_'+randomBytes(6).toString('hex'),marker='meri-unprogressed-runs-selection-proof',admin=new pg.Client({...connection,database:'postgres'});
 await admin.connect();let made=false,pool;
 try{
  await admin.query(`CREATE DATABASE ${database}`);made=true;await admin.query(`COMMENT ON DATABASE ${database} IS '${marker}'`);
  pool=new pg.Pool({...connection,database,max:2});
  const version=Number((await pool.query("SELECT current_setting('server_version_num') AS v")).rows[0].v);assert(version>=160000&&version<170000);
  for(const name of ['0001_conversations.sql','0006_native_executions.sql','0009_next_runs.sql'])await pool.query(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const nowMs=Date.parse('2026-11-02T15:00:00.000Z'),tenantId='settle-'+randomUUID(),actorId='actor-'+randomUUID(),expected=new Set(),all=[];
  async function seed(label,{state,ageMs,claim,select}){
   const b={tenantId,actorId,conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
   const conversation={conversationId:b.conversationId},run={binding:b,state,createdAt:new Date(nowMs-ageMs).toISOString()},request={requestId:randomUUID(),prompt:label};
   await pool.query('INSERT INTO meri_conversations.conversations VALUES($1,$2,$3,$4,$5)',[tenantId,b.conversationId,actorId,conversation,hash(conversation)]);
   await pool.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[tenantId,b.conversationId,b.runId,run,hash(run),request.requestId,request,hash(request)]);
   if(claim){const record={binding:b,executionKey:hash(b),executionId:hash(b),planSha256:'a'.repeat(64),expiresAtMs:nowMs+claim.expiresInMs,runtimeSessionId:'conversation-'+hash(b),phase:claim.phase,native:claim.phase==='settled'?{state}:null};
    await pool.query('INSERT INTO meri_conversations.native_executions(tenant_id,conversation_id,run_id,execution_key,execution_id,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[tenantId,b.conversationId,b.runId,record.executionKey,record.executionId,record,hash(record)]);}
   all.push(b.runId);if(select)expected.add(b.runId);
  }
  const old=UNCLAIMED_RUN_AGE_MS+60000,expired=-(EXPIRED_CLAIM_GRACE_MS+60000);
  await seed('admitted, never dispatched, past the unclaimed bound',{state:'queued',ageMs:old,select:true});
  await seed('admitted recently: a dispatch may still claim it',{state:'queued',ageMs:UNCLAIMED_RUN_AGE_MS-60000,select:false});
  await seed('claimed, lease expired, never started',{state:'queued',ageMs:old,claim:{phase:'unknown',expiresInMs:expired},select:true});
  await seed('claimed, lease just expired inside the workflow reconcile grace',{state:'queued',ageMs:old,claim:{phase:'unknown',expiresInMs:-60000},select:false});
  await seed('running with a live lease',{state:'running',ageMs:old,claim:{phase:'started',expiresInMs:3600000},select:false});
  await seed('running past its lease',{state:'running',ageMs:old,claim:{phase:'started',expiresInMs:expired},select:true});
  await seed('failed with an unsettled invocation past its lease',{state:'failed',ageMs:old,claim:{phase:'stopping',expiresInMs:expired},select:true});
  await seed('completed and settled',{state:'completed',ageMs:old,claim:{phase:'settled',expiresInMs:expired},select:false});
  await seed('failed without a claim',{state:'failed',ageMs:old,select:false});
  await seed('paused (a held checkpoint is not abandoned)',{state:'paused',ageMs:old,claim:{phase:'settled',expiresInMs:expired},select:false});
  await seed('waiting for approval',{state:'waiting-for-approval',ageMs:old,select:false});
  const picked=await listUnprogressedRuns(pool,{nowMs,limit:100});
  assert.deepEqual(new Set(picked.map(b=>b.runId)),expected);assert.ok(picked.every(b=>b.tenantId===tenantId&&Number.isSafeInteger(b.writerFence)));
  assert.equal((await listUnprogressedRuns(pool,{nowMs,limit:2})).length,2,'one pass is bounded');
  // A superseded run (a successor closed its sequence range) is never a candidate.
  const [superseded]=[...expected];await pool.query('UPDATE meri_conversations.runs SET sequence_end=sequence_base+last_sequence WHERE run_id=$1',[superseded]);
  assert.ok(!(await listUnprogressedRuns(pool,{nowMs,limit:100})).some(b=>b.runId===superseded));
  await assert.rejects(listUnprogressedRuns(pool,{nowMs,limit:0}),/SETTLEMENT_CONFIGURATION/);
  t.diagnostic(`seeded ${all.length} runs; selected ${expected.size}`);
 }finally{
  await pool?.end();
  if(made){const marked=await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1",[database]);assert.equal(marked.rows[0]?.marker,marker);await admin.query(`DROP DATABASE ${database}`);}
  await admin.end();
 }
});
