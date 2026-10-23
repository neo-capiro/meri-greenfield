/** Canonical run/store fixture on root's disposable migrated PG16 database. No model process or cloud calls. */
import pg from 'pg';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {productFixture} from '../../../gateway/budget/product-scripted-fixture.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createAdmittedTaskAuthority} from '../admitted-task-authority.mjs';
import {compileNativeTaskPlan} from '../task-allocator.mjs';
import {createRemoteNativeController} from '../remote-composition.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
export const control='synthetic-existing-control',sha=b=>createHash('sha256').update(b).digest('hex');
export async function fixture(t,{leaseMs=120000}={}){
 const socket=process.env.MERI_RUN_TEST_SOCKET;
 if(!/^\/tmp\/meri-step2-[a-z0-9-]+\/socket$/u.test(socket??''))throw Error('TASK_OWNED_DATABASE_REQUIRED');
 const pool=new pg.Pool({host:socket,database:'meri_step2_runtime',user:'postgres',max:12,connectionTimeoutMillis:2000});
 let root,authority;t.after(async()=>{try{await authority?.close();}finally{await pool.end();if(root)await rm(root,{recursive:true,force:true});}});
 const server=(await pool.query("SELECT current_setting('listen_addresses') AS listen,current_database() AS db,version() AS version")).rows[0];
 if(server.listen!==''||server.db!=='meri_step2_runtime'||!server.version.startsWith('PostgreSQL 16.'))throw Error('TASK_OWNED_DATABASE_REQUIRED');
 const seed=productFixture(),old=seed.invocation.binding,binding={...old,tenantId:'synthetic-'+randomUUID(),conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID()};
 let allocationText=JSON.stringify(seed.allocation);for(const key of ['tenantId','conversationId','runId','attemptId','workerId'])allocationText=allocationText.replaceAll(old[key],binding[key]);
 const allocation=JSON.parse(allocationText),at=Date.now(),expiry=at+leaseMs;
 allocation.budgets.maxRuntimeSeconds=120;allocation.manifest.budgets.maxRuntimeSeconds=120;allocation.manifestSha256=hash(allocation.manifest);allocation.schedule.expiresAt=new Date(at+120000).toISOString();
 const q={...seed.context().qualificationBinding,runId:binding.runId,workerArn:'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+randomUUID().replaceAll('-','')};
 const credential='synthetic-task-'+randomUUID(),facts={...seed.context(),grantId:randomUUID(),binding,qualificationBinding:q,allocationSha256:hash(allocation),capabilitySha256:sha(credential)};
 // Temporary lower allocation/revocation owner still uses this row until Step 4. The model/session run owner never reads it.
 await pool.query('INSERT INTO meri_product_budget.budget(id,cap_micro_usd) VALUES(1,1000000) ON CONFLICT DO NOTHING');
 await pool.query('INSERT INTO meri_product_budget.runs(run_id,attempt,worker_arn,fence,policy_revision) VALUES($1,$2,$3,$4,$5)',[q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision]);
 await pool.query("INSERT INTO meri_product_budget.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE')",[facts.grantId,q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision,facts.capabilitySha256,new Date(expiry)]);
 await pool.query('INSERT INTO meri_product_budget.tool_run_allocations(run_id,allocation_sha256,allocation,max_tool_calls,max_cost_micro_usd) VALUES($1,$2,$3,$4,$5)',[binding.runId,facts.allocationSha256,allocation,allocation.budgets.maxToolCalls,allocation.budgets.maxCostMicroUSD]);
 await pool.query('INSERT INTO meri_product_budget.tool_grant_bindings(grant_id,run_id,facts) VALUES($1,$2,$3)',[facts.grantId,binding.runId,facts]);
 root=await mkdtemp(join(tmpdir(),'meri-run-pg-'));const workspace=join(root,binding.conversationId),configDirectory=join(root,'config');await Promise.all([mkdir(workspace),mkdir(configDirectory)]);
 const clientId='11111111-1111-4111-8111-000000000006',principal={tenantId:binding.tenantId,actorId:binding.actorId},scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:q.policyRevision}],createdAt=new Date(at).toISOString();
 // Explicit synthetic Core transition response. Canonical lifecycle SQL remains real;
 // this fixture does not claim to qualify Core membership or client walls.
 const transitionAuthority={async readCurrent({binding:target}){
  if(target.tenantId!==binding.tenantId||target.actorId!==binding.actorId)throw Error('SYNTHETIC_TRANSITION_REFUSED');
  return {binding:target,scopes,selectedClientId:clientId,policyRevision:q.policyRevision,checkedAtMs:Date.now(),expiresAtMs:expiry};}};
 const store=createPostgresConversationStore({pool,transitionAuthority});
 const document={defaultTimezone:'UTC',capabilityPolicy:{}};
 await pool.query('INSERT INTO meri_settings.tenant_settings(tenant_id,revision,document,document_sha256,updated_at,updated_by,monthly_cap_micro_usd,sdk_max_turns,sdk_max_budget_micro_usd) VALUES($1,1,$2,$3,clock_timestamp(),$4,100000000,20,2000000)',[binding.tenantId,document,hash(document),binding.actorId]);
 await store.accept({conversation:{conversationId:binding.conversationId,owner:principal,scopes,createdAt,policyRevision:q.policyRevision},run:{binding,state:'queued',scopes,createdAt,policyRevision:q.policyRevision,versions},request:{requestId:randomUUID(),prompt:'/status',skill:null,window:null,windowRequest:null},event:{contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}},()=>{});
 const identity={origin:'https://authority.synthetic.invalid',commandContext:{binding,clientResolution:{reference:clientId,clientId}},credential:'synthetic-existing-identity',async fetchImpl(url,options){const body=JSON.parse(options.body),base={principal,identityRevision:'synthetic-identity',checkedAtMs:Date.now(),expiresAtMs:expiry};return Response.json(url.endsWith('/identity')?base:{...base,identitySha256:body.identitySha256,conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:'synthetic-context'});}};
 const operations=['load','runner/session/register','runner/session/load','runner/session/append','runner/session/list-subkeys'];
 authority=createAdmittedTaskAuthority({pool,allocationJson:JSON.stringify(allocation),grantFactsJsons:[JSON.stringify(facts)],grantId:facts.grantId,identity,operations,callerCapabilitySha256:sha(control),binding,expiresAtMs:expiry,limits:{maxRequestMs:5000,maxFactBytes:131072},enabled:true});
 const runtime={binding,versions,deadlineMs:expiry,maxOutputBytes:4096},preparationIntent={workspace,configParentDirectory:root,secureStorageDirectory:configDirectory,imageSha256:versions.imageDigest.slice(7),runnerSha256:'b'.repeat(64),authoritySha256:hash({scopes,selectedClientId:clientId,policyRevision:q.policyRevision})},plan={purpose:'canonical-run-fixture'};
 return {pool,binding,expiry,allocation,facts,store,authority,identity,operations,credential,runtime,plan,preparationIntent,root,workspace,configDirectory,sessionKey:{projectKey:'native.opaque.project',sessionId:randomUUID()},
  async status(state){await store.append(binding,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},()=>{});},
  async revoke(){await pool.query("UPDATE meri_product_budget.grants SET state='REVOKED' WHERE grant_id=$1",[facts.grantId]);}};
}
/** Existing control composition; only the ECS resource and task-image proof are synthetic. */
export async function admittedController(t){
 const f=await fixture(t),original=compileNativeTaskPlan({runtime:f.runtime,plan:f.plan,preparationIntent:f.preparationIntent}).original,key={binding:f.binding,allocationKey:original.executionKey};
 const resource={taskArn:f.facts.qualificationBinding.workerArn,createdAtMs:Date.now(),clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker'};
 const intent={...key,original,allocationSha256:f.facts.allocationSha256,qualification:{attempt:1,policyRevision:f.facts.qualificationBinding.policyRevision},grantIntents:[{grantId:f.facts.grantId,capabilitySha256:f.facts.capabilitySha256,expiresAtMs:f.expiry}],taskRequestSha256:'c'.repeat(64),expiresAtMs:f.expiry};
 await f.store.allocations.claim(intent,()=>{});await f.store.allocations.record({...key,state:'ALLOCATED',resource},()=>{});
 const admitted={original,resource:{...resource,grantFactsJsons:[JSON.stringify(f.facts)]}};await f.store.allocations.record({...key,state:'ADMITTED',resource:admitted.resource},()=>{});
 const counts={allocations:0,retirements:0};
 function makeController(){return createRemoteNativeController({runtimeConfiguration:{pool:f.pool,store:f.store,allocator:{async allocate(){counts.allocations++;return admitted;},async stop(){counts.retirements++;}},supervisor:f.authority,runtime:f.runtime,plan:f.plan,preparationIntent:f.preparationIntent,taskCapability:f.credential,controlCapabilitySha256:sha(control),verifyTask:async()=>({taskArn:resource.taskArn,imageSha256:f.preparationIntent.imageSha256,runnerSha256:f.preparationIntent.runnerSha256,checkedAtMs:Date.now(),expiresAtMs:f.expiry}),enabled:true,maxRequestMs:5000},transport:{original,origin:'https://synthetic-task.invalid',credential:control,fetchImpl(){throw Error('NO_REMOTE_PROCESS_TRANSPORT');}}});}
 return {...f,original,resource,key,counts,makeController,controller:makeController()};
}
