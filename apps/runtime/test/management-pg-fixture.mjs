/** Test-only co-location fixture: canonical Core Prisma/metadata exports, Meri PostgreSQL adapters and suppression owner. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import pg from '../node_modules/pg/lib/index.js';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createPostgresRetentionJournal} from '../../control/retention/postgres-journal.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../../control/retention/ledger.mjs';
import {createSuppressionOwner} from '../../control/retention/suppression.mjs';
import {createServingGate} from '../../control/retention/reconciliation.mjs';
import {createCoreConversationManagementOwner,conversationManagementOwnership,createConversationManagementComposition} from '../conversation-management-composition.mjs';
import {prepareOriginalInputFacts} from '../../control/conversations/initial-input-facts.mjs';
import {hash} from '../../control/conversations/boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
const root=new URL('../../../',import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const check=()=>{};
export const gate=()=>{let release;return {promise:new Promise(r=>release=r),release:()=>release()};};
export async function managementPgFixture(config){
 const url=new URL(config.url),pin=JSON.parse(await readFile(new URL('management-core-pin.json',import.meta.url),'utf8'));
 assert.ok(['postgres:','postgresql:'].includes(url.protocol)&&url.hostname==='127.0.0.1'&&/^\/wave2_m2_management_[a-f0-9]{8,32}$/.test(url.pathname)&&url.search==='','explicit fresh loopback test database required');
 assert.equal(config.coreCommit,pin.commit);assert.equal(config.coreTree,pin.tree);assert.equal(typeof config.coreRoot,'string');
 for(const f of pin.files)assert.equal(sha(await readFile(resolve(config.coreRoot,f.path))),f.sha256,'pinned Core source '+f.path);
 const pool=new pg.Pool({connectionString:url.toString(),max:12});let prisma;
 try{
  const version=Number((await pool.query('SHOW server_version_num')).rows[0].server_version_num);assert.ok(version>=160000&&version<170000);
  const present=await pool.query("SELECT to_regclass('public.tenants') AS core,to_regnamespace('meri_conversations') AS meri");assert.equal(present.rows[0].core,null);assert.equal(present.rows[0].meri,null,'never reuse a populated database');
  await pool.query(await readFile(new URL('management-pg-fixture.sql',import.meta.url),'utf8'));
  for(const f of pin.files.filter(f=>f.path.endsWith('/migration.sql')))await pool.query(await readFile(resolve(config.coreRoot,f.path),'utf8'));
  const names=['0001_conversations','0002_lifecycle','0003_selected_outputs','0004_sdk_sessions','0005_selected_reads','0006_native_executions','0007_native_preparation','0008_native_prepared_launch','0009_next_runs','0010_retention','0011_run_issuance','0013_retention_recovery_watermark','0016_initial_inputs','0017_initial_run_bindings','0020_initial_generations'];
  for(const name of names)await pool.query(await readFile(new URL('apps/control/conversations/migrations/'+name+'.sql',root),'utf8'));
  const core=await import(pathToFileURL(resolve(config.coreRoot,'apps/api/.wave2-management-build/meri/conversation-management/service.js')).href);
  const {PrismaService}=await import(pathToFileURL(resolve(config.coreRoot,'apps/api/.wave2-management-build/prisma/prisma.service.js')).href);
  prisma=new PrismaService({datasources:{db:{url:url.toString()}}});await prisma.$connect();
  const owner=createCoreConversationManagementOwner({prisma,core}),sink=createMemoryLedgerSink(),ledger=createRetentionLedger({sink,now:Date.now}),journal=createPostgresRetentionJournal({pool}),serving=createServingGate();
  const suppression=createSuppressionOwner({ledger,journal,ownership:conversationManagementOwnership(owner),serving,now:Date.now});
  const store=createPostgresConversationStore({pool,conversationManagement:{readMetadata:owner.readMetadata}}),composition=createConversationManagementComposition({owner,store,retention:{startup:{suppression}}});
  async function conversation({meri=false,legacy=false}={}){
   const principal={tenantId:randomUUID(),actorId:randomUUID()},conversationId=randomUUID(),binding={...principal,conversationId,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
   await pool.query('INSERT INTO tenants(id) VALUES($1)',[principal.tenantId]);await pool.query('INSERT INTO tenant_memberships(id,tenant_id,user_id) VALUES($1,$2,$3)',[randomUUID(),principal.tenantId,principal.actorId]);
   await pool.query('INSERT INTO clio_conversations(id,tenant_id,user_id,title) VALUES($1,$2,$3,$4)',[conversationId,principal.tenantId,principal.actorId,'Synthetic owner title']);
   if(!legacy)await pool.query("INSERT INTO clio_conversation_bootstrap_receipts(tenant_id,actor_user_id,request_id,conversation_id,scope_kind,client_id) VALUES($1,$2,$3,$4,'general',null)",[principal.tenantId,principal.actorId,randomUUID(),conversationId]);
   const scopes=[{tenantId:principal.tenantId,kind:'private-user',resourceId:principal.actorId,policyRevision:'policy1'}],createdAt=new Date().toISOString();
   const projection={conversationId,owner:principal,scopes,createdAt,policyRevision:'policy1'},subject={tenantId:principal.tenantId,kind:'conversation',subjectId:conversationId,ownerActorId:principal.actorId};
   if(meri)await pool.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[principal.tenantId,conversationId,principal.actorId,projection,hash(projection)]);
   const request=(operation,revision='0')=>({version:'meri.conversation-management.v1',conversationId,requestId:randomUUID(),operation,expectedRevision:revision,...(operation==='rename'?{title:'Changed synthetic title'}:{})});
   async function proposal(){const allocatedAtMs=Date.now(),input={requestId:randomUUID(),prompt:'Synthetic original'},request={...input,skill:null,window:null,windowRequest:null};
    const facts=await prepareOriginalInputFacts({binding,scopes,versions,selectedClientId:null,input,request,allocatedAtMs,expiresAtMs:allocatedAtMs+30000});
    const run={binding,scopes,versions,state:'queued',createdAt,policyRevision:'policy1'},event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
    return {facts,acceptance:{conversation:projection,run,request,event,selectedClientId:null}};
   }
   return {principal,conversationId,binding,projection,scopes,subject,request,proposal,manage:request=>composition.manage({principal,request}),metadata:()=>owner.readMetadata({principal,conversationId})};
  }
  return {pool,prisma,core,owner,sink,ledger,journal,serving,suppression,store,composition,conversation,async close(){await prisma.$disconnect();await pool.end();}};
 }catch(error){if(prisma)await prisma.$disconnect();await pool.end();throw error;}
}
