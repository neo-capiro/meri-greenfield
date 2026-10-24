/** Actual PostgreSQL management lease assay. The provisioner owns schema/cleanup;
 * this test uses only the ordinary control role in an exact disposable database.
 * Ledger storage and Core metadata are explicit synthetic ports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../postgres-watermark.mjs';
import {createRetentionStartup} from '../startup.mjs';
import {createMemoryLedgerSink} from '../ledger.mjs';
import {createPostgresConversationStore} from '../../conversations/postgres-store.mjs';
import {createConversationManagementService} from '../../conversations/history/management.mjs';
import {prepareOriginalInputFacts} from '../../conversations/initial-input-facts.mjs';
import {versions} from '../../conversations/test/store-fixture.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {MANAGEMENT_VERSION} from '../../../../packages/contracts/conversation-history/protocol.mjs';

const SOCKET='/tmp/meri-management-pg-20261024/socket',DATABASE='meri_management_fixture';
const supplied=process.env.MERI_MANAGEMENT_PG_SOCKET!==undefined||process.env.MERI_MANAGEMENT_PG_DATABASE!==undefined;
if(supplied&&(process.platform==='win32'||process.env.MERI_MANAGEMENT_PG_SOCKET!==SOCKET||process.env.MERI_MANAGEMENT_PG_DATABASE!==DATABASE))throw Error('MERI_MANAGEMENT_PG_TARGET_REFUSED');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const check=()=>{};
test('management uses one PostgreSQL lease, releases exact locks and serializes real input admission',{skip:!supplied&&'requires the exact disposable Unix PG16 management fixture',timeout:30000},async t=>{
 const options={host:SOCKET,port:5432,database:DATABASE,user:'meri_control_runtime',password:'',connectionTimeoutMillis:3000,query_timeout:5000,options:'-c statement_timeout=5000 -c lock_timeout=2000'};
 // Recovery has its existing dedicated session; the management assay below uses max=1.
 const bootstrap=new pg.Pool({...options,max:4}),single=new pg.Pool({...options,max:1,application_name:'mf09-single-lease'}),observer=new pg.Pool({...options,max:1}),rival=new pg.Pool({...options,max:1});
 let bootstrapClosed=false;
 t.after(async()=>{await Promise.all([single.end(),observer.end(),rival.end(),...(bootstrapClosed?[]:[bootstrap.end()])]);});
 const identity=(await bootstrap.query("SELECT current_user,current_database() AS database,current_setting('listen_addresses') AS listen,current_setting('server_version_num')::int AS version")).rows[0];
 assert.equal(identity.current_user,'meri_control_runtime');assert.equal(identity.database,DATABASE);assert.equal(identity.listen,'');assert.ok(identity.version>=160000&&identity.version<170000);
 let selected=bootstrap,commitUnknown=false,borrowed=0,maxBorrowed=0;
 const pool={async connect(){const c=await selected.connect();borrowed++;maxBorrowed=Math.max(maxBorrowed,borrowed);return {async query(sql,args){const r=await c.query(sql,args);if(commitUnknown&&sql==='COMMIT'){commitUnknown=false;throw Error('synthetic lost COMMIT acknowledgement');}return r;},release(error){borrowed--;c.release(error);}};}};
 const journal=createPostgresRetentionJournal({pool}),watermark=createPostgresWatermarkStore({journal}),startup=createRetentionStartup({journal,watermark,ledgerSink:createMemoryLedgerSink(),ownership:journal,purge:{enabled:false}});
 await startup.start();await bootstrap.end();bootstrapClosed=true;selected=single;maxBorrowed=0;
 const principal={tenantId:randomUUID(),actorId:randomUUID(),clientIds:[]},conversationId=randomUUID(),policyRevision='synthetic-metadata-policy';
 const scopes=[{tenantId:principal.tenantId,kind:'private-user',resourceId:principal.actorId,policyRevision}],conversation={conversationId,owner:{tenantId:principal.tenantId,actorId:principal.actorId},scopes,policyRevision,createdAt:new Date().toISOString()};
 const subject={tenantId:principal.tenantId,kind:'conversation',subjectId:conversationId};let status='active';
 const assertActive=async()=>{if(status!=='active')throw Object.assign(Error('Core inactive'),{code:'CONVERSATION_SCOPE_REFUSED'});};
 const store=createPostgresConversationStore({pool,modelCatalog:MODEL_CATALOG,assertConversationActive:assertActive});
 await store.management.register({principal,conversation,recheckActive:assertActive},check);
 await t.test('real owner/projection/watermark operations reuse the held session with no open transaction during external IO',async()=>{
  let escaped;
  await startup.suppression.withTransition({principal:conversation.owner,subject},retained=>store.management.withConversation({principal,conversationId},async state=>{
   assert.equal(state.canManage,true);assert.equal(state.hasTranscript,false);escaped=retained.databaseLease;
   const activity=(await observer.query("SELECT xact_start,state FROM pg_stat_activity WHERE application_name='mf09-single-lease' AND datname=current_database()")).rows;
   assert.equal(activity.length,1);assert.equal(activity[0].xact_start,null);assert.equal(activity[0].state,'idle');
   await retained.suppress({reason:'conversation-trash:'+randomUUID()});assert.equal((await retained.current()).state,'SUPPRESSED');
   await retained.release({reason:'synthetic-confirmed-restore'});assert.equal((await retained.current()).state,'RELEASED');
  },check,retained.databaseLease));
  assert.equal(maxBorrowed,1);assert.equal(single.totalCount,1);assert.equal(single.waitingCount,0);
  await assert.rejects(escaped.query('SELECT 1'),/RETENTION_INVALID_REQUEST/);
 });
 await t.test('actual original-input admission waits for management and refuses after archive currentness changes',async()=>{
  const binding={...conversation.owner,conversationId,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1},allocatedAtMs=Date.now(),requestId=randomUUID();
  const facts=await prepareOriginalInputFacts({binding,scopes,versions,selectedClientId:null,input:{requestId,prompt:'Synthetic race'},request:{requestId,prompt:'Synthetic race',skill:null,window:null,windowRequest:null},allocatedAtMs,expiresAtMs:allocatedAtMs+20000});
  const entered=deferred(),finish=deferred();let checked=false;
  const metadata=()=>({conversationId,title:'Synthetic owned chat',status,revision:status==='active'?'0':'1',scopeKind:'general',clientId:null,updatedAt:conversation.createdAt,archivedAt:status==='archived'?conversation.createdAt:null,trashedAt:null,restoreUntil:null});
  const command={version:MANAGEMENT_VERSION,requestId:randomUUID(),conversationId,expectedRevision:'0',operation:'archive'};
  const core={metadata:async()=>metadata(),summaries:async()=>null,registration:async()=>({conversation,recheckActive:assertActive}),read:async()=>({current:metadata(),receipt:null,releaseRetention:false,suppressionRequestId:null}),apply:async()=>{entered.resolve();await finish.promise;status='archived';return {current:metadata(),receipt:{version:MANAGEMENT_VERSION,requestId:command.requestId,conversation:metadata()},releaseRetention:false,suppressionRequestId:null};}};
  const service=createConversationManagementService({store,suppression:startup.suppression});
  const management=service.manage({principal,request:command,management:core});await entered.promise;
  const competing=createPostgresConversationStore({pool:rival,modelCatalog:MODEL_CATALOG,assertConversationActive:async()=>{checked=true;await assertActive();}}).initialInputs.claim(facts,check);competing.catch(()=>{});
  await new Promise(r=>setTimeout(r,75));assert.equal(checked,false);
  finish.resolve();await management;await assert.rejects(competing,/CONVERSATION_SCOPE_REFUSED/);assert.equal(checked,true);
  assert.equal((await observer.query('SELECT count(*)::int AS n FROM meri_conversations.initial_inputs WHERE tenant_id=$1 AND conversation_id=$2',[principal.tenantId,conversationId])).rows[0].n,0);
 });
 await t.test('exception and real COMMIT with lost acknowledgement leave no reusable locked session',async()=>{
  await assert.rejects(startup.suppression.withTransition({principal:conversation.owner,subject},retained=>store.management.withConversation({principal,conversationId},async()=>{throw Error('Core timeout');},check,retained.databaseLease)),/RETENTION_STORE_UNAVAILABLE/);
  const key=`${principal.tenantId}:conversation:${conversationId}`;
  await journal.withTransition(key,async lease=>{await lease.tx(c=>c.query('SELECT 1'));});
  commitUnknown=true;await assert.rejects(journal.withTransition(key,()=>journal.get(key)),/RETENTION_COMMIT_UNKNOWN/);
  await journal.withTransition(key,()=>journal.get(key));
  assert.equal(single.waitingCount,0);assert.equal(borrowed,0);
  const locks=(await observer.query("SELECT count(*)::int AS n FROM pg_locks l JOIN pg_stat_activity a USING(pid) WHERE a.application_name='mf09-single-lease' AND l.locktype='advisory'")).rows[0].n;
  assert.equal(locks,0);assert.equal(maxBorrowed,1);
 });
});
