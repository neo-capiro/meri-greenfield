/** Historical applied migration ACL regression for the retired model-owner role.
 *
 * Needs a disposable PostgreSQL 16 whose database is named capiro and an admin login that can create roles and databases:
 *   MERI_D2_TEST_ADMIN_URL=postgres://<admin>:<password>@127.0.0.1:<port>/capiro node --test <this file>
 * Skipped without it. It applies the real meri stage (ordered migrations, seed, phase_meri_grants) through runStage, then
 * runs the retained journals as meri_model_budget_owner before and after phase_owner_conversation_reads.
 * This preserves applied-schema history and negative grants; it does not qualify an active AgentCore owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {ROOT,OWNER_READS_SCRIPT,PASSWORD_VARIABLES,loadPlan,passwordVariables,runPsqlScript,runStage} from './first-chat-migrate.mjs';
import {createInitialRunBindingJournal} from '../../apps/control/conversations/initial-run-binding-journal.mjs';
import {createPostgresConversationStore} from '../../apps/control/conversations/postgres-store.mjs';

const adminUrl=process.env.MERI_D2_TEST_ADMIN_URL;
const pg=createRequire(resolve(ROOT,'apps/runtime/package.json'))('pg');

/** The owner's pool, recording every statement PostgreSQL refused for privilege (SQLSTATE 42501). */
function recordingPool(options){
 const pool=new pg.Pool({...options,max:2}),denied=[],wrapped=new WeakSet();
 return {denied,end:()=>pool.end(),async connect(){
  const client=await pool.connect();
  if(!wrapped.has(client)){
   wrapped.add(client);const query=client.query.bind(client);
   client.query=async(...args)=>{try{return await query(...args);}catch(error){
    if(error?.code==='42501')denied.push(String(args[0]?.text??args[0]).replace(/\s+/gu,' '));throw error;}};
  }
  return client;
 }};
}

test('historical owner-read grants remain narrow and idempotent in the applied migration',
 {skip:!adminUrl&&'set MERI_D2_TEST_ADMIN_URL to a disposable PostgreSQL 16 database named capiro'},async()=>{
 const admin=new URL(adminUrl);assert.equal(admin.pathname,'/capiro');
 const base={host:admin.hostname,port:Number(admin.port||5432)};
 const connect=async database=>{const client=new pg.Client({...base,user:decodeURIComponent(admin.username),
  password:decodeURIComponent(admin.password),database});await client.connect();return client;};
 const env=Object.fromEntries(Object.values(PASSWORD_VARIABLES).map(key=>[key,randomBytes(30).toString('base64url')]));
 await runStage({stage:'meri',plan:loadPlan(),variables:passwordVariables(env),connect});
 // Current journal queries require 0020. Apply its schema only here: the test still isolates the owner GRANT phase below.
 const schema=await connect('capiro');try{await schema.query(readFileSync(resolve(ROOT,'apps/control/conversations/migrations/0020_initial_generations.sql'),'utf8'));}finally{await schema.end();}

 const owner=recordingPool({...base,user:'meri_model_budget_owner',password:env.MERI_D2_MODEL_OWNER_PASSWORD,database:'capiro'});
 const pool=owner;
 const check=()=>{};
 const binding={tenantId:randomUUID(),actorId:randomUUID(),conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),
  workerId:randomUUID(),writerFence:1};
 const principal={tenantId:binding.tenantId,actorId:binding.actorId},selectedClientId=randomUUID();
 const journal=createInitialRunBindingJournal({pool,now:Date.now}),store=createPostgresConversationStore({pool,now:Date.now});
 const attempt=async call=>{const before=owner.denied.length;let error;try{await call();}catch(caught){error=caught;}return {error,denied:owner.denied.slice(before)};};
 try{
  // phase_meri_grants alone: the owner's placement/currentness reads are refused exactly where live refused them.
  let r=await attempt(()=>journal.readConversation({principal,conversationId:binding.conversationId,selectedClientId},check));
  assert.ok(r.error);
  assert.deepEqual(r.denied,['SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY generation DESC LIMIT 1 FOR UPDATE']);
  r=await attempt(()=>store.nextRuns.current(binding,check));
  assert.ok(r.error);
  assert.deepEqual(r.denied,['SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3']);
  // The rest of the owner's conversation reads were already granted (live passed them before the refusal).
  for(const call of [()=>store.readOptional(binding,{limit:1},check),()=>store.allocations.read({binding,allocationKey:'a'.repeat(64)},check)])
   assert.deepEqual((await attempt(call)).denied,[]);

  const phase=()=>runPsqlScript({text:readFileSync(resolve(ROOT,OWNER_READS_SCRIPT),'utf8'),variables:{phase_owner_conversation_reads:'1'},connect});
  await phase();await phase(); // GRANT is idempotent; a repeated run changes nothing.

  r=await attempt(()=>journal.readConversation({principal,conversationId:binding.conversationId,selectedClientId},check));
  assert.equal(r.error,undefined);assert.deepEqual(r.denied,[]);
  // No reservation exists: the journal's own refusal, never a privilege refusal.
  r=await attempt(()=>store.nextRuns.current(binding,check));
  assert.match(String(r.error?.code??r.error?.message),/NEXT_RUN_NOT_LATEST/u);assert.deepEqual(r.denied,[]);
  // The owner may lock a binding row but holds no write on either table (the trigger rejects any binding UPDATE).
  const client=await owner.connect();
  try{
   for(const sql of ['DELETE FROM meri_conversations.initial_run_bindings','INSERT INTO meri_conversations.next_runs DEFAULT VALUES',
    'UPDATE meri_conversations.next_runs SET state=state'])
    await assert.rejects(client.query(sql),error=>error.code==='42501',sql);
  }finally{client.release();}
 }finally{await owner.end();}
});
