/** Native PostgreSQL 16 regression: advisory-lock self-deadlock on run-start read during conversation admission.
 *
 * Before the fix, conversation admission held the `${tenantId}:${conversationId}` advisory lock and called
 * assertConversationActive -> objectiveCore.forBinding -> runStarts.read(), which opened a NEW pool connection
 * and tried to acquire the same advisory lock.  PostgreSQL lock_timeout surfaced as an unavailable error
 * within the admission transaction, killing ordinary chat and Objective admission alike.
 *
 * After the fix, `read({binding, q})` with the caller's transaction query function skips the advisory lock
 * acquisition entirely and executes the SELECT on the same already-locked connection.
 *
 * Required env (all three must be set to run native cases; omit all to skip):
 *   MERI_CHAT_LOCK_NATIVE_HOST  - TCP host (default 127.0.0.1)
 *   MERI_CHAT_LOCK_NATIVE_PORT  - TCP port (must be exact owned fixture)
 *   MERI_CHAT_LOCK_NATIVE_DB    - database name (must be exact owned fixture)
 *
 * Safety: every fixture uses unique per-test tenantId/actorId/generationJobId seeds; no DELETE/TRUNCATE/DROP.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createPostgresObjectiveRunStartStore} from '../postgres-run-starts.mjs';
import {objectiveRunIdentity} from '../run-starts.mjs';

// ---- Venue guard -----------------------------------------------------------------------
// Skip when ALL THREE dedicated vars are ALL undefined (intentional CI skip).
// Throw before connecting when ANY var is defined but names a wrong/empty target.
const HOST_RAW=process.env.MERI_CHAT_LOCK_NATIVE_HOST;
const PORT_RAW=process.env.MERI_CHAT_LOCK_NATIVE_PORT;
const DB_RAW=process.env.MERI_CHAT_LOCK_NATIVE_DB;
const allUndefined=HOST_RAW===undefined&&PORT_RAW===undefined&&DB_RAW===undefined;
if(!allUndefined&&(HOST_RAW!=='127.0.0.1'||PORT_RAW!=='54332'||DB_RAW!=='meri_chat_lock_regression'))
 throw new Error('MERI_CHAT_LOCK_NATIVE_TARGET_REFUSED');
const HOST=HOST_RAW??'127.0.0.1';
const PORT=Number(PORT_RAW??'0');
const DB=DB_RAW??'';

let pool;
const LOCK_TIMEOUT_MS=1000;
const NATIVE_SKIP=allUndefined;

before(async()=>{
 if(NATIVE_SKIP)return;
 pool=new pg.Pool({host:HOST,port:PORT,database:DB,user:'postgres',max:6,idleTimeoutMillis:5000});
 const guard=(await pool.query(`SELECT current_setting('server_version_num')::int AS v,
   current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port,
   to_regclass('meri_objective_source.run_starts') IS NOT NULL AS has_schema`)).rows[0];
 assert.ok(guard.v>=160000&&guard.v<170000,`PostgreSQL 16 required, got ${guard.v}`);
 assert.equal(guard.db,DB,`expected database ${DB}, got ${guard.db}`);
 assert.equal(guard.role,'postgres');assert.equal(guard.host,'127.0.0.1');assert.equal(guard.port,54332);
 assert.equal(guard.has_schema,true,'meri_objective_source.run_starts must exist');
});

after(async()=>{if(pool)await pool.end();});

const conversationKey=b=>`${b.tenantId}:${b.conversationId}`;

/** A unique binding per test derived from (tenantId, actorId, generationJobId).
 *  objectiveRunIdentity deterministically computes valid RunBinding UUIDs from these three inputs.
 *  No fixture record is needed — only the binding is used for ABSENT read tests. */
const ACTOR='lr-test-actor'; // constant actorId satisfies objectiveRunIdentity text() check
function f(n){
 const tenantId=`lr-tenant-${n}`,generationJobId=randomUUID();
 const identity=objectiveRunIdentity({tenantId,actorId:ACTOR,generationJobId});
 return {binding:identity.binding,tenantId,generationJobId};
}


/** Acquire the conversation advisory lock, then call runStarts.read() on a SEPARATE pool connection.
 *  Pre-fix: C2 tries to acquire the same lock already held by C1 -> lock_timeout. */
async function attemptReadUnderSeparateLock(runStarts,binding){
 const c1=await pool.connect();
 let c1ok=false;
 try{
  await c1.query('BEGIN');
  await c1.query("SET LOCAL lock_timeout='"+LOCK_TIMEOUT_MS+"ms'");
  await c1.query("SET LOCAL statement_timeout='"+(LOCK_TIMEOUT_MS+500)+"ms'");
  await c1.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[conversationKey(binding)]);
  let readResult,readError;
  try{readResult=await runStarts.read({binding});}catch(e){readError=e;}
  await c1.query('COMMIT');c1ok=true;
  return {readResult,readError};
 }finally{c1.release(c1ok?undefined:new Error('tx aborted'));}
}

/** Acquire the conversation advisory lock, then call runStarts.read({binding, q}) with the SAME connection.
 *  Post-fix path: reuses the already-locked connection -- no new lock acquisition. */
async function readInsideSameLock(runStarts,binding){
 const c=await pool.connect();
 let ok=false;
 try{
  await c.query('BEGIN');
  await c.query("SET LOCAL lock_timeout='"+LOCK_TIMEOUT_MS+"ms'");
  await c.query("SET LOCAL statement_timeout='"+(LOCK_TIMEOUT_MS+500)+"ms'");
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[conversationKey(binding)]);
  const q=(text,values=[])=>c.query(text,values);
  const result=await runStarts.read({binding,q});
  await c.query('COMMIT');ok=true;
  return result;
 }finally{c.release(ok?undefined:new Error('tx aborted'));}
}

// ---- RED: separate-connection read deadlocks on the advisory lock ----------------------
test('RED: read() without q self-deadlocks when caller holds advisory lock',{skip:NATIVE_SKIP},async()=>{
 const fix=f(1);
 const store=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:fix.tenantId,maxRequestMs:1800});
 const {readResult,readError}=await attemptReadUnderSeparateLock(store,fix.binding);
 assert.equal(readResult,undefined,'read() on a new connection must fail when C1 holds the lock');
 assert.ok(readError instanceof Error,'expected a lock/timeout error');
 const msg=String(readError?.code??'')+' '+String(readError?.message??'');
 assert.ok(
  /OBJECTIVE_RUN_START_UNAVAILABLE|55P03|57014|lock|timeout/iu.test(msg),
  'expected lock/timeout error; got: '+msg.trim()
 );
});

// ---- GREEN: same-connection read with q bypasses the lock acquisition ------------------
test('GREEN: ordinary chat (ABSENT) -- read with q inside same lock does not deadlock',{skip:NATIVE_SKIP},async()=>{
 const fix=f(2);
 const store=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:fix.tenantId,maxRequestMs:1800});
 const result=await readInsideSameLock(store,fix.binding);
 assert.deepEqual(result,{state:'ABSENT'},'ordinary chat binding must be ABSENT without deadlock');
});


test('GREEN: claim path simulation -- ABSENT ordinary chat with q succeeds inside admission tx',{skip:NATIVE_SKIP},async()=>{
 const fix=f(6);
 const store=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:fix.tenantId,maxRequestMs:1800});
 let qPassedCount=0;
 const simulatedAssertActiveBinding=async({binding,q})=>{
  if(typeof q==='function')qPassedCount++;
  const result=await store.read({binding,...(typeof q==='function'?{q}:{})});
  assert.equal(result.state,'ABSENT','ordinary chat must be ABSENT');
 };
 const c=await pool.connect();let ok=false;
 try{
  await c.query('BEGIN');
  await c.query("SET LOCAL lock_timeout='"+LOCK_TIMEOUT_MS+"ms'");
  await c.query("SET LOCAL statement_timeout='"+(LOCK_TIMEOUT_MS+500)+"ms'");
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[conversationKey(fix.binding)]);
  const q=(text,values=[])=>c.query(text,values);
  await simulatedAssertActiveBinding({binding:fix.binding,q});
  await c.query('COMMIT');ok=true;
 }finally{c.release(ok?undefined:new Error('tx aborted'));}
 assert.equal(qPassedCount,1,'q must have been forwarded through the fixed call chain');
});
