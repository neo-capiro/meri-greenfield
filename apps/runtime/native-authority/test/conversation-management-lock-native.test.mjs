/** Composed native PostgreSQL 16 regression: advisory-lock self-deadlock fix, end-to-end through
 * createPostgresConversationStore -> createCoreConversationManagement -> createObjectiveCorePorts
 * -> createPostgresObjectiveRunStartStore (both ABSENT and persisted STARTED).
 *
 * Covers:
 *   RED  - pre-fix path self-deadlocks on real PG advisory lock
 *   GREEN General ABSENT   - true private-user General chat (no selectedClient) claim+accept succeeds
 *   GREEN client ABSENT    - client-scoped ordinary chat claim+accept succeeds (no objectiveCore record)
 *   GREEN Objective STARTED - saved Objective binding: real persisted PG row claim+accept (synthetic HTTP Core)
 *   GREEN accept path      - both initialInputs.claim and accept work without deadlock
 *   Negative              - Core 401/403 proved denial codes
 *
 * Required env (all three must be set to run native cases; omit all to skip):
 *   MERI_CHAT_LOCK_NATIVE_HOST   (default 127.0.0.1)
 *   MERI_CHAT_LOCK_NATIVE_PORT   (must be exact owned fixture)
 *   MERI_CHAT_LOCK_NATIVE_DB     (must be exact owned fixture; full meri_conversations + meri_settings + meri_objective_source schemas)
 *
 * Safety: unique tenants per test; no DELETE/TRUNCATE/DROP; no live network/AWS/Core.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createPostgresConversationStore} from '../../../../apps/control/conversations/postgres-store.mjs';
import {createCoreConversationManagement} from '../conversation-management.mjs';
import {createObjectiveCorePorts} from '../../objective-generation/core-ports.mjs';
import {createPostgresObjectiveRunStartStore} from '../../objective-source/postgres-run-starts.mjs';
import {objectiveRunIdentity,createObjectiveRunStartRecord} from '../../objective-source/run-starts.mjs';
import {coreRepliesFixture,NOW as CORE_NOW} from '../../../../apps/control/objective-generation/test/core-replies-fixture.mjs';
import {runStartFixture} from '../../objective-source/test/run-start-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {requestInputHash} from '../../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {versions} from '../../../../apps/control/conversations/test/store-fixture.mjs';

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
const POLICY_REVISION='a'.repeat(64);
const NATIVE_SKIP=allUndefined;

before(async()=>{
 if(NATIVE_SKIP)return;
 pool=new pg.Pool({host:HOST,port:PORT,database:DB,user:'postgres',max:8,idleTimeoutMillis:5000});
 const g=(await pool.query(`SELECT current_setting('server_version_num')::int AS v,
   current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port,
   to_regclass('meri_conversations.runs') IS NOT NULL AS has_conv,
   to_regclass('meri_objective_source.run_starts') IS NOT NULL AS has_obj,
   to_regclass('meri_settings.tenant_settings') IS NOT NULL AS has_settings`)).rows[0];
 assert.ok(g.v>=160000&&g.v<170000,`PostgreSQL 16 required, got ${g.v}`);
 assert.equal(g.db,'meri_chat_lock_regression');assert.equal(g.role,'postgres');
 assert.equal(g.host,'127.0.0.1');assert.equal(g.port,54332);
 assert.equal(g.has_conv,true);assert.equal(g.has_obj,true);assert.equal(g.has_settings,true);
});

after(async()=>{if(pool)await pool.end();});

// ---- Helpers ---------------------------------------------------------------------------

/** Unique binding per test, no DB write required. */
function freshBinding(){
 const tenantId='lr-comp-'+randomUUID().slice(0,8);
 const actorId='lr-actor-'+randomUUID().slice(0,8);
 const conversationId=randomUUID();
 return {tenantId,actorId,conversationId,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
}

/** Seed tenant_settings so model admission succeeds. */
async function seedTenant(tenantId){
 await pool.query(
  'INSERT INTO meri_settings.tenant_settings(tenant_id,revision,document,document_sha256,updated_at,updated_by,monthly_cap_micro_usd) VALUES($1,1,$2,$3,clock_timestamp(),$4,1000000000) ON CONFLICT DO NOTHING',
  [tenantId,{},hash({}),tenantId]
 );
}

/** Build a full Core current-session receipt satisfying currentReceipt() validation. */
function makeCoreReceipt({binding,selectedClientId,now}){
 const HASH='a'.repeat(64);
 return {
  principal:{tenantId:binding.tenantId,actorId:binding.actorId},
  role:'standard_user',
  permissions:[],
  clientIds:selectedClientId?[selectedClientId]:[],
  identityRevision:HASH,
  membershipRevision:HASH,
  contextRevision:HASH,
  conversationId:binding.conversationId,
  selectedClientId:selectedClientId??null,
  checkedAtMs:now,
  expiresAtMs:now+30000,
 };
}

/** Create management with a synthetic fetchImpl (no live HTTP). */
function makeManagement({binding,selectedClientId,coreStatus=200,objectiveCore,now=Date.now}){
 const nowMs=now();
 const receipt=makeCoreReceipt({binding,selectedClientId,now:nowMs});
 const nativeCredentials={
  nativeCredentialFor:()=>({
   credential:'synthetic-bearer',
   expiresAtMs:Date.now()+30000,
  }),
 };
 const fetchImpl=async(url,opts)=>{
  // Handle /api/clio/application-authority/current (ordinary chat path)
  if(coreStatus===200){
   // Build receipt with fresh timestamps so checkedAtMs is within receiptSkewMs of now()
   const freshNow=Date.now();
   const freshReceipt={...receipt,checkedAtMs:freshNow,expiresAtMs:freshNow+30000};
   const body=JSON.stringify(freshReceipt);
   return new Response(body,{status:200,headers:{'content-type':'application/json;charset=utf-8','content-length':String(body.length)}});
  }
  return new Response(JSON.stringify({error:'denied'}),{status:coreStatus,headers:{'content-type':'application/json;charset=utf-8'}});
 };
 return createCoreConversationManagement({
  origin:'https://core.synthetic.invalid',
  getServiceSecret:async()=>'synthetic-service-secret-key-x',
  policyRevision:POLICY_REVISION,
  nativeCredentials,
  objectiveCore,
  fetchImpl,
  now,
  maxRequestMs:3000,
 });
}

/** Build a run input suitable for store.accept(). */
function makeRunInput(binding){
 const at=new Date().toISOString();
 const scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:randomUUID(),policyRevision:POLICY_REVISION}];
 const event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt:at,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
 return {
  conversation:{conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt:at,policyRevision:POLICY_REVISION},
  run:{binding,state:'queued',scopes,createdAt:at,policyRevision:POLICY_REVISION,versions},
  request:{requestId:randomUUID(),prompt:'composed lock regression',skill:null,window:null,windowRequest:null},
  event,
  scopes,
 };
}

const check=()=>{};

// ---- RED: pre-fix lock acquisition on a new connection self-deadlocks ---------------------
test('RED: assertConversationActive without q deadlocks when conversation advisory lock is held',{skip:NATIVE_SKIP},async()=>{
 // Directly show the deadlock: hold the advisory lock on C1, then call
 // objectiveCore.forBinding (pre-fix: no q) which tries read() on a new C2 connection.
 const binding=freshBinding();
 await seedTenant(binding.tenantId);
 const runStartStore=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:binding.tenantId,maxRequestMs:1800});
 // Pre-fix objectiveCore: forBinding calls runStarts.read() WITHOUT q, spawning a new pool connection
 const prefixObjectiveCore={
  async forBinding({binding:b}){
   // No q supplied — pre-fix path: acquires a new pool connection and tries the advisory lock
   return runStartStore.read({binding:b});
  },
 };
 const conversationKey=b=>`${b.tenantId}:${b.conversationId}`;
 const c=await pool.connect();let c1ok=false,deadlockError=null;
 try{
  await c.query('BEGIN');
  await c.query('SET LOCAL lock_timeout=\'1000ms\'');
  await c.query('SET LOCAL statement_timeout=\'1500ms\'');
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[conversationKey(binding)]);
  // Now simulate what the pre-fix assertConversationActive does: calls objectiveCore.forBinding WITHOUT q
  try{await prefixObjectiveCore.forBinding({binding});}catch(e){deadlockError=e;}
  await c.query('COMMIT');c1ok=true;
 }finally{c.release(c1ok?undefined:new Error('tx aborted'));}
 assert.ok(deadlockError,'pre-fix path must produce a lock/timeout error');
 const msg=String(deadlockError?.code??'')+' '+String(deadlockError?.message??'');
 assert.ok(/OBJECTIVE_RUN_START_UNAVAILABLE|55P03|57014|lock|timeout/iu.test(msg),'expected lock error; got: '+msg.trim());
});

// ---- GREEN General ABSENT (private-user, no selectedClient): full claim+accept ---------
test('GREEN General ABSENT: true private-user General claim+accept succeeds (no Objective row, no selectedClient)',{skip:NATIVE_SKIP},async()=>{
 const binding=freshBinding();
 await seedTenant(binding.tenantId);
 // General scope: private-user, no clientId. assertActiveBinding selectedClientId => null.
 const scopes=[{kind:'private-user',tenantId:binding.tenantId,resourceId:binding.actorId,policyRevision:POLICY_REVISION}];
 const runStartStore=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:binding.tenantId,maxRequestMs:1800});
 const objectiveCore=createObjectiveCorePorts({
  origin:'https://core.synthetic.invalid',
  getServiceSecret:async()=>'synthetic-service-secret-key-x',
  runStarts:runStartStore,
  now:()=>Date.now(),
  maxRequestMs:2000,
 });
 // General: selectedClientId=null (no selectedClientId prop means selected=null from no client scope)
 const management=makeManagement({binding,selectedClientId:null,objectiveCore,now:()=>Date.now()});
 const store=createPostgresConversationStore({pool,modelCatalog:MODEL_CATALOG,assertConversationActive:management.assertActiveBinding});
 const at=new Date().toISOString();
 const requestId=randomUUID();
 const requestBody={requestId,prompt:'general regression test',skill:null,window:null,windowRequest:null};
 const inputSha256=hash(requestBody),requestSha256=hash(requestBody);
 // General claim: no selectedClientId in proposedFacts (General/public conversation)
 const proposedFacts={binding,scopes,versions,selectedClientId:null,requestId,inputSha256,requestSha256,allocatedAtMs:Date.now(),expiresAtMs:Date.now()+60000};
 const claimed=await store.initialInputs.claim(proposedFacts,check);
 assert.equal(claimed.state,'RESERVED','General claim must succeed without deadlock');
 // accept also calls assertActiveBinding inside tx
 const event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt:at,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
 const accepted=await store.initialInputs.accept({
  conversation:{conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt:at,policyRevision:POLICY_REVISION},
  run:{binding,state:'queued',scopes,createdAt:at,policyRevision:POLICY_REVISION,versions},
  request:requestBody,event,selectedClientId:null,
 },check);
 assert.equal(accepted.replayed??false,false,'General accept must commit without deadlock');
});

// ---- GREEN client ABSENT: client-scoped chat claim+accept via production stores -----------
test('GREEN client ABSENT: client-scoped ordinary chat claim+accept with real Core authority succeeds',{skip:NATIVE_SKIP},async()=>{
 const binding=freshBinding();
 await seedTenant(binding.tenantId);
 const scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:randomUUID(),policyRevision:POLICY_REVISION}];
 const runStartStore=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:binding.tenantId,maxRequestMs:1800});
 const objectiveCore=createObjectiveCorePorts({
  origin:'https://core.synthetic.invalid',
  getServiceSecret:async()=>'synthetic-service-secret-key-x',
  runStarts:runStartStore,
  now:()=>Date.now(),
  maxRequestMs:2000,
 });
 const management=makeManagement({binding,selectedClientId:scopes[0].resourceId,objectiveCore,now:()=>Date.now()});
 const store=createPostgresConversationStore({pool,modelCatalog:MODEL_CATALOG,assertConversationActive:management.assertActiveBinding});
 const at=new Date().toISOString();
 const requestId=randomUUID();
 const requestBody={requestId,prompt:'client regression test',skill:null,window:null,windowRequest:null};
 const inputSha256=hash(requestBody),requestSha256=hash(requestBody);
 const proposedFacts={binding,scopes,versions,selectedClientId:scopes[0].resourceId,requestId,inputSha256,requestSha256,allocatedAtMs:Date.now(),expiresAtMs:Date.now()+60000};
 const claimed=await store.initialInputs.claim(proposedFacts,check);
 assert.equal(claimed.state,'RESERVED','client claim must succeed for ordinary chat ABSENT binding');
 const event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt:at,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
 const accepted=await store.initialInputs.accept({
  conversation:{conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt:at,policyRevision:POLICY_REVISION},
  run:{binding,state:'queued',scopes,createdAt:at,policyRevision:POLICY_REVISION,versions},
  request:requestBody,event,selectedClientId:scopes[0].resourceId,
 },check);
 assert.equal(accepted.replayed??false,false,'client accept must commit the new run without deadlock');
});

// ---- GREEN Objective STARTED: real persisted PG row claim+accept -------------------------
// Uses actual createPostgresObjectiveRunStartStore.putOnce with a valid record (clerkUserId=actorId)
// before conversation claim, then proves real production claim+accept succeeds.
test('GREEN Objective STARTED: real persisted run-start row via claim+accept with synthetic HTTP Core',{skip:NATIVE_SKIP},async()=>{
 // Build a valid fixture with unique random IDs to avoid conflicts on reruns.
 // runStartFixture() requires tenantId and actorId in UUID format (validated by canonical.tenantId uuid check).
 // It uses clerkUserId='synthetic-clerk-user' by default; we clone and correct to binding.actorId.
 const tenantId=randomUUID(); // must be UUID format (canonical.tenantId check)
 const actorId=randomUUID(); // must be UUID; clerkUserId will be set to this
 const generationJobId=randomUUID();
 const clientId=randomUUID();
 const fixtureRequestId=randomUUID(); // unique per test run to avoid request_id cross-conversation conflict
 const f=runStartFixture({tenantId,actorId,generationJobId,clientId,requestId:fixtureRequestId});
 const binding=f.binding;
 await seedTenant(binding.tenantId);

 // Clone and fix the selection: clerkUserId must equal binding.actorId for PG constraint.
 // Also set time fields to current bounded clock so effectExpiresAtMs is future.
 const nowMs=Date.now();
 const WINDOW=180000; // 3 minutes, well within policy
 const sel=structuredClone(f.selection);
 sel.sourceAdmission.clerkUserId=binding.actorId; // satisfy PG constraint: clerkUserId=actorId
 sel.sourceAdmission.admittedAtMs=nowMs-1000;
 sel.sourceAdmission.effectExpiresAtMs=nowMs+WINDOW;
 sel.request.requestedAtMs=nowMs-500;
 sel.request.originalExpiresAtMs=nowMs+WINDOW;
 sel.request.inputSha256=requestInputHash(sel.request); // recompute after originalExpiresAtMs change
 // createObjectiveRunStartRecord validates and seals the record
 const record=createObjectiveRunStartRecord({binding,generationJobId:f.generationJobId,selection:sel,nowMs});
 // Persist the run-start BEFORE conversation claim (occupancy guard: putOnce must precede claim)
 const runStartStore=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:binding.tenantId,maxRequestMs:3000});
 const putResult=await runStartStore.putOnce({record});
 assert.equal(putResult.state,'STARTED','putOnce must succeed for fresh synthetic Objective');
 assert.ok(putResult.created,'putOnce must have inserted a new row');
 // Verify the row round-trips through real store read
 const readResult=await runStartStore.readByJob({generationJobId:f.generationJobId});
 assert.equal(readResult.state,'STARTED','readByJob must return STARTED after putOnce');
 assert.equal(hash(readResult.record),hash(record),'persisted record hash must match');

 // Build the Core /current response matching the persisted record
 const admission=record.selection.sourceAdmission;
 const coreCurrentResponse={
  schemaVersion:1,
  generationJobId:admission.generationJobId,
  tenantId:binding.tenantId,
  actorId:binding.actorId,
  clerkUserId:binding.actorId, // matches what we stored
  clientId:admission.canonical.clientId,
  role:'standard_user',
  consentId:admission.consentId,
  controlVersion:admission.controlVersion,
  checkedAtMs:nowMs,
  effectExpiresAtMs:admission.effectExpiresAtMs,
 };
 const objectiveCore=createObjectiveCorePorts({
  origin:'https://core.synthetic.invalid',
  getServiceSecret:async()=>'synthetic-service-secret-key-x',
  runStarts:runStartStore, // real PG store, not stub
  now:()=>Date.now(),
  maxRequestMs:3000,
  fetchImpl:async()=>{
   // Synthetic Core /current endpoint — returns valid response matching persisted record
   const freshNow=Date.now();
   const resp={...coreCurrentResponse,checkedAtMs:freshNow,effectExpiresAtMs:freshNow+WINDOW};
   return Response.json(resp,{status:200,headers:{'content-type':'application/json','content-length':String(JSON.stringify(resp).length)}});
  },
 });
 const scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:admission.canonical.clientId,policyRevision:POLICY_REVISION}];
 const management=makeManagement({binding,selectedClientId:admission.canonical.clientId,objectiveCore,now:()=>Date.now()});
 const store=createPostgresConversationStore({pool,modelCatalog:MODEL_CATALOG,assertConversationActive:management.assertActiveBinding});
 const at=new Date().toISOString();
 // objectiveAcceptedRequest: requestId and prompt come from the stored record's selection
 const requestId=record.selection.sourceAdmission.generationRequestId;
 const prompt=record.selection.executionContext.prompt;
 const requestBody={requestId,prompt,skill:null,window:null,windowRequest:null};
 const inputSha256=hash(requestBody),requestSha256=hash(requestBody);
 // Claim — uses the Objective binding's conversationId; assertActiveBinding calls runStarts.read with q
 const proposedFacts={binding,scopes,versions,selectedClientId:admission.canonical.clientId,requestId,inputSha256,requestSha256,allocatedAtMs:Date.now(),expiresAtMs:Date.now()+60000};
 const claimed=await store.initialInputs.claim(proposedFacts,check);
 assert.equal(claimed.state,'RESERVED','Objective STARTED claim must succeed with real PG row');
 // Accept also goes through the real lock chain
 const event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt:at,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
 const accepted=await store.initialInputs.accept({
  conversation:{conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt:at,policyRevision:POLICY_REVISION},
  run:{binding,state:'queued',scopes,createdAt:at,policyRevision:POLICY_REVISION,versions},
  request:requestBody,event,selectedClientId:admission.canonical.clientId,
 },check);
 assert.equal(accepted.replayed??false,false,'Objective STARTED accept must commit without deadlock');
});

// ---- Negative: Core 401 and 403 refuse admission without leaking the lock --------------
test('NEGATIVE: Core 401 from assertActiveBinding refuses admission cleanly (no lock leak)',{skip:NATIVE_SKIP},async()=>{
 const binding=freshBinding();
 await seedTenant(binding.tenantId);
 const runStartStore=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:binding.tenantId,maxRequestMs:1800});
 const objectiveCore=createObjectiveCorePorts({
  origin:'https://core.synthetic.invalid',
  getServiceSecret:async()=>'synthetic-service-secret-key-x',
  runStarts:runStartStore,
  now:()=>Date.now(),
  maxRequestMs:2000,
 });
 const selectedClientId=randomUUID();
 const management=makeManagement({binding,selectedClientId,coreStatus:401,objectiveCore,now:()=>Date.now()});
 // Prove denial directly: hold the advisory lock, call assertActiveBinding, verify it refuses
 const conversationKey=b=>`${b.tenantId}:${b.conversationId}`;
 const scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:selectedClientId,policyRevision:POLICY_REVISION}];
 const c=await pool.connect();let txOk=false,denialError=null;
 try{
  await c.query('BEGIN');
  await c.query("SET LOCAL lock_timeout='2000ms'");
  await c.query("SET LOCAL statement_timeout='3000ms'");
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[conversationKey(binding)]);
  const q=(text,values=[])=>c.query(text,values);
  try{await management.assertActiveBinding({binding,scopes,selectedClientId,q},check);}catch(e){denialError=e;}
  await c.query('COMMIT');txOk=true;
 }finally{c.release(txOk?undefined:new Error('tx aborted'));}
 // Core 401 must reach the authority check and deny; error must not be a deadlock/lock error
 assert.ok(denialError instanceof Error,'Core 401 must produce a denial error');
 const msg=String(denialError.message??'');
 assert.ok(
  !/OBJECTIVE_RUN_START_UNAVAILABLE|55P03|57014|lock|timeout/iu.test(msg),
  'Core 401 error must NOT be a lock/timeout error (that would indicate deadlock): '+msg
 );
 assert.ok(
  /AUTHORITY_REFUSED|UNAUTHENTICATED|ACCESS_DENIED|CONVERSATION_UNAVAILABLE|REFUSED/iu.test(msg),
  'Core 401 must surface a Core authority refusal; got: '+msg
 );
});

test('NEGATIVE: Core 403 refuses admission, prior lock is released (subsequent claim on same binding works with valid Core)',{skip:NATIVE_SKIP},async()=>{
 const binding=freshBinding();
 await seedTenant(binding.tenantId);
 const runStartStore=createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:binding.tenantId,maxRequestMs:1800});
 const objectiveCore=createObjectiveCorePorts({origin:'https://core.synthetic.invalid',getServiceSecret:async()=>'secret',runStarts:runStartStore,now:()=>Date.now(),maxRequestMs:2000});
 // First: prove Core 403 denial directly (no lock leak)
 const clientId=randomUUID();
 const scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:clientId,policyRevision:POLICY_REVISION}];
 const mgmt403=makeManagement({binding,selectedClientId:clientId,coreStatus:403,objectiveCore,now:()=>Date.now()});
 const conversationKey=b=>`${b.tenantId}:${b.conversationId}`;
 let denialError=null;
 const c1=await pool.connect();let txOk=false;
 try{
  await c1.query('BEGIN');
  await c1.query("SET LOCAL lock_timeout='2000ms'");
  await c1.query("SET LOCAL statement_timeout='3000ms'");
  await c1.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[conversationKey(binding)]);
  const q=(text,values=[])=>c1.query(text,values);
  try{await mgmt403.assertActiveBinding({binding,scopes,selectedClientId:clientId,q},check);}catch(e){denialError=e;}
  await c1.query('COMMIT');txOk=true;
 }finally{c1.release(txOk?undefined:new Error('tx aborted'));}
 assert.ok(denialError instanceof Error,'Core 403 must produce a denial error');
 const msg403=String(denialError.message??'');
 assert.ok(
  /AUTHORITY_REFUSED|ACCESS_DENIED|CONVERSATION_UNAVAILABLE|REFUSED/iu.test(msg403),
  'Core 403 must surface a Core authority refusal; got: '+msg403
 );
 // Lock must have been released — retry claim with valid Core must succeed immediately (no stall)
 const mgmtOk=makeManagement({binding,selectedClientId:clientId,objectiveCore,now:()=>Date.now()});
 const store=createPostgresConversationStore({pool,modelCatalog:MODEL_CATALOG,assertConversationActive:mgmtOk.assertActiveBinding});
 const facts={binding,scopes,versions,selectedClientId:clientId,requestId:randomUUID(),inputSha256:hash({prompt:'test'}),requestSha256:hash({prompt:'test'}),allocatedAtMs:Date.now(),expiresAtMs:Date.now()+60000};
 const claimed=await store.initialInputs.claim(facts,check);
 assert.equal(claimed.state,'RESERVED','after 403 the lock was cleanly released; second claim succeeds');
});
