/** Explicit isolated local qualification. Uses an existing migrated PostgreSQL 16
 * database and an ordinary role; never provisions, migrates, deletes, or calls a model. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {lifecycleFixture,id} from '../../apps/control/conversations/test/lifecycle-fixture.mjs';
import {createPostgresConversationStore} from '../../apps/control/conversations/postgres-store.mjs';
import {MODEL_CATALOG} from '../../packages/contracts/test/model-selection-fixture.mjs';
import {sdkUsageSnapshot} from '../../apps/control/conversations/usage.mjs';
if(process.env.MERI_BROWSER_PG_ATTEST!=='isolated-local'||process.env.MERI_BROWSER_PG_HOST!=='127.0.0.1'||
 !/^wave6_browser_[a-z0-9_]+$/u.test(process.env.MERI_BROWSER_PG_DATABASE??''))throw Error('BROWSER_PG_ATTESTATION_REQUIRED');
const pool=new pg.Pool({host:process.env.MERI_BROWSER_PG_HOST,port:Number(process.env.MERI_BROWSER_PG_PORT),
 database:process.env.MERI_BROWSER_PG_DATABASE,user:process.env.MERI_BROWSER_PG_USER,max:4});
const check=()=>{},tenantId='browser-custody-qualification',binding={tenantId,actorId:'actor-'+randomUUID(),
 conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
const scopes=[{kind:'client',tenantId,resourceId:id(5),policyRevision:'policy1'}];
const payload=cost=>({usage:sdkUsageSnapshot({type:'result',session_id:id(223),total_cost_usd:cost/1e6,
 modelUsage:{'us.anthropic.claude-sonnet-4-6':{inputTokens:cost,outputTokens:2,cacheReadInputTokens:0,
 cacheCreationInputTokens:0,webSearchRequests:0,costUSD:cost/1e6,provider:'bedrock',costBasis:'list'}}}),toolsUsed:{tools:[],omitted:0}});
let f;
try{
 const role=(await pool.query("SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,current_setting('server_version_num')::int AS version FROM pg_roles WHERE rolname=current_user")).rows[0];
 assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);assert.equal(role.rolcreaterole,false);assert.equal(role.rolcreatedb,false);
 assert.ok(role.version>=160000&&role.version<170000);
 f=await lifecycleFixture({pool,binding,scopes,browserSessions:true});f.input.requestId=randomUUID();await f.running();
 f.state.checkCurrentBinding=b=>f.store.nextRuns.current(b,check);
 const controlId=randomUUID(),custody={schema:'meri-browser-custody/1',binding,controlId,ownerInstanceId:randomUUID(),
  hostId:randomUUID(),generation:1,leaseEpoch:1,policySha256:'a'.repeat(64),expiresAtMs:Date.now()+60000};
 await f.control({controlId,intent:'takeover.begin'});await f.claim(controlId);
 await f.service.recordUsage({credential:f.credential,binding,input:payload(300)});await f.checkpoint(controlId,custody);
 const freshStore=createPostgresConversationStore({pool,modelCatalog:MODEL_CATALOG});
 const selected={binding,scopes,selectedClientId:id(5)},first=await freshStore.lifecycle.browserCustody.read(selected,check);
 assert.equal(first.state,'held');assert.deepEqual(first.custody,custody);
 const returned={ownerInstanceId:custody.ownerInstanceId,leaseEpoch:2,snapshotSha256:'b'.repeat(64)};
 await f.service.returnTakeover({credential:f.credential,returned});
 await assert.rejects(freshStore.lifecycle.browserCustody.returning({...selected,returned:{...returned,ownerInstanceId:randomUUID()}},check));
 const results=await Promise.all([1,2].map(()=>freshStore.lifecycle.browserCustody.returning({...selected,returned},check)));
 assert.deepEqual(results,[returned,returned]);
 const resumed=await f.control({controlId:randomUUID(),intent:'takeover.end',checkpointId:first.checkpointId,checkpointSha256:first.checkpointSha256});
 assert.equal(resumed.state,'APPLIED');
 const target=resumed.targetBinding,execution=await freshStore.lifecycle.execution({...selected,binding:target},check);
 assert.deepEqual(execution.browserHandoff.custody,custody);assert.deepEqual(execution.browserHandoff.returned,returned);
 assert.deepEqual(execution.browserHandoff.targetBinding,target);assert.equal(execution.continuation.mode,'resume');
 f.state.context.binding=target;const session=await f.sessions.issue({identityCredential:'synthetic-current'});
 for(const state of ['starting','running'])await f.store.append(target,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},check);
 await f.service.recordUsage({credential:session.credential,binding:target,input:payload(500)});
 assert.equal((await freshStore.readUsage(target,check)).chargeMicroUsd,200);
 assert.equal((await f.service.recordUsage({credential:session.credential,binding:target,input:payload(500)})).replayed,true);
 await assert.rejects(freshStore.nextRuns.current(binding,check),/NEXT_RUN_NOT_LATEST/);
 await assert.rejects(freshStore.lifecycle.browserCustody.read({...selected,binding:{...binding,actorId:'foreign'}},check));
 assert.equal(Number((await pool.query('SELECT count(*) AS n FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,binding.conversationId])).rows[0].n),2);
 console.log(JSON.stringify({passed:true,postgresMajor:16,ordinaryRole:true,custodyRecovered:true,concurrentReplay:true,
  exactSuccessor:true,staleSourceRefused:true,crossActorRefused:true,usageDeltaMicroUsd:200,
  limits:'Scripted Core identity, SDK and native host; no browser, model, deployment or full host integration claim.'}));
}finally{f?.close();await pool.end();}
