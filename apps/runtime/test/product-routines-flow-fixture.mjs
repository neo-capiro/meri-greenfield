/** Receiving-candidate composition: actual foreground factory, admission/journals, scheduled jobs, SDK activity and inbox owners.
 * SQL, Core/policy facts, Temporal protocol, SDK frames/runtime preparation and native stop are synthetic external boundaries.
 * No worker/listener, provider query, database, process, credentials or live issuance is started. */
import assert from 'node:assert/strict';
import {scheduledJobFixture,id,hash} from '../../control/schedules/test/scheduled-job-fixture.mjs';
import {createPreparedSchedulePoolFixture} from '../../control/intents/test/prepared-schedule-fixture.mjs';
import {temporalScheduleService} from '../../control/schedules/test/temporal-schedule-wire-fixture.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createPostgresScheduleOwner} from '../../control/schedules/postgres-schedule-owner.mjs';
import {createNativeIdentityContext} from '../native-authority/identity-context.mjs';
import {createCoreMembershipGate} from '../../control/product-access/core-membership.mjs';
import {createActionSessionOwner} from '../../control/action-host/session/owner.mjs';
import {createRuntimeRoutinesFeature} from '../routines.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from '../product-applications.mjs';
import {createControlRouteApplications} from '../control-route-boundary.mjs';
import {composeScheduleService} from '../schedule-service.mjs';
import {createConversationActivity} from '../../worker/conversation/activity.mjs';
import {occurrenceIdentity,snapshotOccurrence} from '../../control/schedules/scheduled-occurrence.mjs';
import {workflowId} from '../../control/conversations/temporal-dispatch.mjs';
export {id,hash};

/** Extend only missing external SQL SELECTs; integrity, ownership and cursor decoding stay in canonical store owners. */
function extendSql(h){
 const scheduleConnect=h.scheduleSql.pool.connect;
 h.scheduleSql.pool.connect=async()=>{const sql=await scheduleConnect();return {...sql,async query(text,p=[]){
  if(text.startsWith('SELECT tenant_id,generation,occurrence_key'))return {rows:structuredClone([...h.scheduleSql.state.occurrences.values()].filter(r=>r.tenant_id===p[0]&&(text.includes("effect->'binding'")?r.effect.binding.conversationId===p[1]:r.schedule_id===p[1]&&r.state==='OPEN')).slice(0,2))};
  if(text.startsWith('SELECT projection,generation,active_intent FROM meri_schedules.projections'))return {rows:structuredClone([...h.scheduleSql.state.projections.values()].filter(r=>r.tenant_id===p[0]&&r.owner_actor_id===p[1]&&(p[2]===null||r.schedule_id>p[2])).sort((a,b)=>a.schedule_id.localeCompare(b.schedule_id)).slice(0,p[3]).map(r=>({projection:r.projection,generation:r.generation,active_intent:r.active_intent})))};
  return sql.query(text,p);
 }};};
 const conversationConnect=h.pool.connect;
 h.pool.connect=async()=>{const sql=await conversationConnect();return {...sql,async query(text,p=[]){
  if(text.startsWith('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND owner_actor_id=$2'))return {rows:structuredClone([...h.conversations.state.conversations.values()].filter(r=>r.tenant_id===p[0]&&r.owner_actor_id===p[1]&&r.projection.scopes.every(s=>s.kind!=='client'||p[2].includes(s.resourceId)))
   .sort((a,b)=>b.projection.createdAt.localeCompare(a.projection.createdAt)||b.conversation_id.localeCompare(a.conversation_id)).filter(r=>p[3]===null||r.projection.createdAt<p[3]||r.projection.createdAt===p[3]&&r.conversation_id<p[4]).slice(0,p[5]))};
  if(text.startsWith('SELECT e.*')){const rows=[];for(const run of h.conversations.state.runs.values())if(run.tenant_id===p[0]&&run.conversation_id===p[1])for(const event of h.conversations.state.events.get([run.tenant_id,run.conversation_id,run.run_id].join(':'))??[])rows.push({...event,tenant_id:run.tenant_id,conversation_id:run.conversation_id,run_id:run.run_id,global:run.sequence_base+event.sequence});return {rows:structuredClone(rows.sort((a,b)=>a.global-b.global).filter(r=>r.global>p[2]).slice(0,p[3]))};}
  return sql.query(text,p);
 }};};
}
function sharedPool(h,preparations){return {async connect(){let sql;const staged=[];return {
 async query(text,p=[]){
  if(!sql){if(text.startsWith('BEGIN')||text.startsWith('SET LOCAL')||text.startsWith('SELECT pg_advisory')){staged.push([text,p]);return {rows:[]};}
   if(text==='COMMIT'||text==='ROLLBACK')return {rows:[]};
   const target=text.includes('meri_conversations.')?h.pool:text.includes('meri_schedules.')?h.scheduleSql.pool:text.includes('meri_intents.preparations')?preparations.pool:null;assert.ok(target,'unknown SQL fixture domain');
   sql=await target.connect();for(const args of staged)await sql.query(...args);
  }return sql.query(text,p);
 },release(error){sql?.release(error);},
 };}};}

export async function productRoutinesFlowFixture(){
 const h=await scheduledJobFixture({admit:false,allocated:false});
 // The reused protocol fixture auto-seeds a compatibility schedule. Start this new receiving scenario with empty external rows.
 h.scheduleSql.state.projections.clear();h.scheduleSql.state.intents.clear();extendSql(h);
 const preparations=createPreparedSchedulePoolFixture(),pool=sharedPool(h,preparations),store=createPostgresConversationStore({pool,now:h.now}),owner=createPostgresScheduleOwner({pool});
 const state={fetches:[],policies:[],nextId:8000,queries:0,queryCloses:0,clientVisible:true,revoked:false,retained:true,nativeStops:0},now=h.now,newId=()=>id(state.nextId++);
 const commandBinding={...h.allocation.run,attemptId:id(82),workerId:id(83),writerFence:1},commandContext={binding:commandBinding,clientResolution:{reference:h.template.selectedClientId,clientId:h.template.selectedClientId}};
 const fetchImpl=async(url,init)=>{
  const body=JSON.parse(init.body);state.fetches.push({path:new URL(url).pathname,body});if(state.revoked||init.headers.authorization!=='Bearer synthetic-native')return new Response('',{status:403});
  const stamp={checkedAtMs:now(),expiresAtMs:now()+60000},principal=h.template.principal;let value;
  if(url.endsWith('/membership'))value={...principal,status:'active',role:'standard_user',permissions:[],clientIds:state.clientVisible?[h.template.selectedClientId]:[],membershipRevision:state.clientVisible?'m1':'m2',...stamp};
  else if(url.endsWith('/identity'))value={principal,identityRevision:'i1',...stamp};
  else{assert.ok(url.endsWith('/context'));if(body.conversationId!==commandBinding.conversationId)return new Response('',{status:403});value={principal,identityRevision:'i1',identitySha256:body.identitySha256,conversationId:commandBinding.conversationId,selectedClientId:h.template.selectedClientId,contextRevision:'c1',...stamp};}
  return Response.json(value);
 };
 const identity=createNativeIdentityContext({origin:'https://core.synthetic.invalid',fetchImpl,commandContext,now,limits:{maxRequestMs:5000,maxFactBytes:65536},enabled:true,currentOwner:{async currentRun(binding){assert.deepEqual(binding,commandBinding);return JSON.stringify({binding,policyRevision:h.template.policyRevision,checkedAtMs:now(),deadlineMs:now()+60000});}}});
 const gate=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext:identity,fetchImpl,now,limits:{maxRequestMs:5000,maxFactBytes:65536}});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,membership:{admit:gate.admit,recheck:gate.recheck},now,limits:{maxSessions:4,maxRequestMs:5000,maxTtlMs:60000,maxFactBytes:65536}}),session=await sessions.issue({identityCredential:'synthetic-native',deadlineMs:now()+5000});
 const policy={async check({selection,selectionSha256}){
  assert.equal(selectionSha256,hash(selection));state.policies.push(selection);const mutation=!['list_scheduled_tasks','cancel_scheduled_task'].includes(selection.operation);
  return {authorized:!state.revoked&&state.clientVisible,selectionSha256,binding:commandBinding,scopes:h.scopes,selectedClientId:h.template.selectedClientId,
   destinationResolution:mutation?{reference:selection.request.destinationReference,destinationId:'meri-inbox'}:null,limits:mutation?{maxCostMicrousd:h.allocation.budgets.maxCostMicroUSD,maxRuntimeSeconds:h.allocation.budgets.maxRuntimeSeconds,retryLimit:0}:null,checkedAtMs:now(),expiresAtMs:now()+10000};
 }};
 const temporal=temporalScheduleService(),executions=new Map(),baseWorkflow=h.temporal.client.workflow;
 const workflow={async start(type,options){const result=await baseWorkflow.start(type,options);if(!executions.has(options.workflowId))executions.set(options.workflowId,id(9000+executions.size));return result;},getHandle(id,runId){const original=baseWorkflow.getHandle(id,runId);return {async describe(){const result=await original.describe();assert.equal(runId===undefined||runId===executions.get(id),true);return {...result,runId:executions.get(id),startTime:new Date(now())};},cancel:original.cancel};}};
 const client={connection:temporal.scheduleClient.connection,schedule:temporal.scheduleClient,workflow},abort=new AbortController();
 const runControl={async cancel(call){const result=await h.options.runControl.cancel(call);abort.abort();return result;}},retirement={async retire(call){state.nativeStops++;return h.options.retirement.retire(call);}};
 const context={commandContext,allocationJson:h.template.allocationJson,template:h.template.task,workflow:{taskQueue:'meri-schedules',workflowIdPrefix:'meri/receiving'},policy,limits:{maxRequestMs:5000,maxFactBytes:65536,retryLimit:0}};
 const feature=createRuntimeRoutinesFeature({enabled:true,pool,client,context,now,newId,runControl,retirement,limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const retention={async assertServable(){if(!state.retained)throw Error('synthetic retention suppressed');}},core={async assertCurrent(){throw Error('No Core conversation is created for this occurrence');}};
 const configuration={version:1,profile:'isolated-preview',sourceEnabled:false,versions:h.template.versions,limits:{startupMs:1000,shutdownMs:1000,requestMs:1000,requestBytes:131072},native:{maxResponseBytes:2097152},
  temporal:{taskQueue:'meri-schedules'},scheduledDispatch:{enabled:true,conversationTaskQueue:'meri-conversations',maxConcurrentActivities:1}};
 const ports=captureRuntimePorts({routinesApplicationFactory:feature,conversationMembership:gate,conversationCurrentness:core}),app=createRuntimeProductApplications({configuration,sessions,ports,conversationStore:store,retention,now}),routes=createControlRouteApplications({assembly:app,candidate:{handle(){throw Error('private route was used');}}});
 const dispatch=composeScheduleService({configuration,runtimePorts:{authority:h.firingAuthority,runAdmission:h.adapter,runControl,retirement,pool,client,now}});
 const post=(path,body,credential=session.credential)=>routes.public.handle(new Request('https://meri.synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 async function occurrence(proposalId){const retained=await owner.readIntent({tenantId:h.template.principal.tenantId,intentId:proposalId},()=>{});assert.equal(retained.state,'ACKNOWLEDGED');const intent=retained.intent;
  const o=snapshotOccurrence({workflowId:intent.configuration.workflow.workflowId+'/firing/1',temporalScheduleId:intent.projection.temporalScheduleId,scheduledAt:new Date(now()).toISOString(),projection:intent.projection,generation:intent.generation,task:intent.configuration.task});return {occurrence:o,identity:occurrenceIdentity(o)};
 }
 async function execute(binding,{active=false}={}){
  await h.claim(binding);h.f.state.context.binding=binding;const issued=await h.f.sessions.issue({identityCredential:'synthetic-native-worker'}),ready=Promise.withResolvers(),stopped=Promise.withResolvers();
  const runOwner={load:({binding,signal})=>h.f.service.loadForExecution({credential:issued.credential,binding,signal}),append:({binding,event,signal})=>h.f.service.publish({credential:issued.credential,binding,event,signal})};
  const activity=createConversationActivity({runOwner,now,newId,prepareRuntime:async()=>({binding,versions:h.template.versions,cwd:'/workspace/conversations/'+binding.conversationId,proxyUrl:'https://proxy.synthetic.invalid',proxyCredential:'synthetic-task-capability',model:'synthetic-no-provider',sessionStore:{async load(){return null;},async append(){}},deadlineMs:now()+30000,maxTurns:2,maxCostMicroUSD:h.allocation.budgets.maxCostMicroUSD,maxOutputBytes:1024}),
   query(){state.queries++;return {async *[Symbol.asyncIterator](){yield {type:'assistant',parent_tool_use_id:null,message:{id:'routine-output',content:[{type:'text',text:active?'Partial routine result.':'Completed routine result.'},{type:'thinking',thinking:'PRIVATE_MODEL_REASONING'}]}};ready.resolve();if(active)await stopped.promise;yield {type:'result',subtype:'success',is_error:false};},close(){state.queryCloses++;stopped.resolve();}};}});
  const work=activity({binding,signal:abort.signal});work.catch(()=>{});await Promise.race([ready.promise,work]);return {work,ready:ready.promise};
 }
 return {h,state,preparations,pool,store,owner,gate,sessions,session,feature,ports,app,dispatch,temporal,client,executions,post,occurrence,execute,now,
  async close(){abort.abort();sessions.close();h.close();}};
}
