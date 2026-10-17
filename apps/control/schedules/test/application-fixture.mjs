/** Actual routines/session/context/journal/schedule owners over scripted external Core, SQL and protobuf Temporal boundaries.
 * No socket, driver, database, worker, live policy or credential provisioning. */
import assert from 'node:assert/strict';
import {createRoutinesService} from '../application.mjs';
import {createScheduleRuntimeContext} from '../runtime-context.mjs';
import {createPostgresScheduleOwner} from '../postgres-schedule-owner.mjs';
import {scheduleOwnerFixture} from './schedule-owner-fixture.mjs';
import {createPreparedSchedulePoolFixture} from '../../intents/test/prepared-schedule-fixture.mjs';
import {createPostgresIntentJournalStore,createPostgresScheduleProposalReader} from '../../intents/postgres-journal.mjs';
import {createActionSessionOwner} from '../../action-host/session/owner.mjs';
import {createNativeIdentityContext} from '../../../runtime/native-authority/identity-context.mjs';
import {createCoreMembershipGate} from '../../product-access/core-membership.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {temporalScheduleService} from './temporal-schedule-wire-fixture.mjs';
import {ScheduleNotFoundError} from './scheduled-dispatch-harness.mjs';

export const NOW=Date.parse('2026-10-17T12:00:00.000Z'),id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const binding={tenantId:'tenant-a',actorId:'owner-a',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},clientId=id(5);
export const routineRequest=()=>({taskInstruction:'  Summarize authorized activity.\n',destinationReference:'  Meri inbox  ',requestedLimits:{maxCostMicrousd:5000,maxRuntimeSeconds:120,retryLimit:2},
 policy:{spec:{calendars:[],intervals:[{every:60000,offset:0}],cronExpressions:[],skip:[],startAt:null,endAt:null,jitterMs:0,timezone:'UTC'},overlap:'SKIP',catchupWindowMs:60000,pauseOnFailure:true,remainingActions:null,paused:false,note:'Explicit test policy',runNow:false,runNowOverlap:'ALLOW_ALL'}});

/** Adds only the canonical list SELECT absent from the existing SQL fixture, plus explicit ACK fault injection. */
function schedulePool(sql,state){return {async connect(){
 const client=await sql.pool.connect();let loseAck=false;
 return {async query(text,values=[]){
  state.scheduleQueries.push({text,values:structuredClone(values)});
  if(text.startsWith('SELECT projection,generation,active_intent FROM meri_schedules.projections')){
   const rows=[...sql.state.projections.values()].filter(r=>r.tenant_id===values[0]&&r.owner_actor_id===values[1]&&(values[2]===null||r.schedule_id>values[2])).sort((a,b)=>a.schedule_id.localeCompare(b.schedule_id)).slice(0,values[3]).map(r=>structuredClone({projection:r.projection,generation:r.generation,active_intent:r.active_intent}));
   return {rows,rowCount:rows.length};
  }
  const result=await client.query(text,values);
  await state.scheduleQueryHook?.(text,values,result);
  if(state.loseScheduleCommit&&text.startsWith('UPDATE meri_schedules.intents SET state=$3')&&values[2]==='ACKNOWLEDGED'){state.loseScheduleCommit=false;loseAck=true;}
  if(state.loseScheduleCommit&&text.startsWith("UPDATE meri_schedules.intents SET state='ACKNOWLEDGED'")){state.loseScheduleCommit=false;loseAck=true;}
  if(text==='COMMIT'&&loseAck)throw Error('synthetic schedule COMMIT acknowledgement lost');return result;
 },release(error){client.release(error);}};
}};}

/** A single borrowed pool facade for the runtime factory. Domain transactions stay with their existing owners/fixtures. */
function routedPool(schedules,preparations){return {async connect(){
 let client;const staged=[];
 return {async query(text,values=[]){
  if(!client){
   if(text==='BEGIN'||text.startsWith('BEGIN ISOLATION')||text.startsWith('SET LOCAL')||text.startsWith('SELECT pg_advisory_xact_lock(')){staged.push([text,values]);return {rows:[],rowCount:0};}
   if(text==='ROLLBACK'||text==='COMMIT')return {rows:[],rowCount:0};
   const target=text.includes('meri_schedules.')?schedules:text.includes('meri_intents.preparations')?preparations:null;assert.ok(target,'unrecognized fixture SQL domain');
   client=await target.connect();for(const args of staged)await client.query(...args);
  }
  return client.query(text,values);
 },release(error){client?.release(error);}};
}};}

export async function applicationFixture(){
 const state={now:NOW,ids:100,fetches:[],policies:[],scheduleQueries:[],allowed:true,refusePhase:null,revoked:false,actorId:binding.actorId,policyRevision:'p1',membershipRevision:'m1',policyHook:null,scheduleQueryHook:null,loseCreateAck:false,failCreateBefore:false,loseScheduleCommit:false};
 const now=()=>state.now,newId=()=>id(state.ids++),scopes=()=>[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:state.policyRevision}],commandContext={binding,clientResolution:{reference:clientId,clientId}};
 const fetchImpl=async(url,init)=>{
  state.fetches.push({url,init});if(state.revoked||init.headers.authorization!=='Bearer synthetic-native')return new Response('',{status:403});
  const stamp={checkedAtMs:now(),expiresAtMs:NOW+60000},principal={tenantId:binding.tenantId,actorId:state.actorId};let value;
  if(url.endsWith('/membership'))value={...principal,status:'active',role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:state.membershipRevision,...stamp};
  else if(url.endsWith('/identity'))value={principal,identityRevision:'i1',...stamp};
  else{assert.ok(url.endsWith('/context'));const input=JSON.parse(init.body);value={principal,identityRevision:'i1',identitySha256:input.identitySha256,conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:'c1',...stamp};}
  return Response.json(value);
 };
 const identity=createNativeIdentityContext({origin:'https://core.synthetic.invalid',fetchImpl,commandContext,now,limits:{maxRequestMs:5000,maxFactBytes:65536},enabled:true,
  currentOwner:{async currentRun(selected){assert.deepEqual(selected,binding);return JSON.stringify({binding,policyRevision:state.policyRevision,checkedAtMs:now(),deadlineMs:NOW+60000});}}});
 const gate=createCoreMembershipGate({origin:'https://core.synthetic.invalid',identityContext:identity,fetchImpl,now,limits:{maxRequestMs:5000,maxFactBytes:65536}});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,membership:{admit:gate.admit,recheck:gate.recheck},now,limits:{maxSessions:4,maxRequestMs:5000,maxTtlMs:60000,maxFactBytes:65536}});
 const session=await sessions.issue({identityCredential:'synthetic-native',deadlineMs:NOW+5000});
 const sql=scheduleOwnerFixture(),preparations=createPreparedSchedulePoolFixture(),scheduleQueries=schedulePool(sql,state),pool=routedPool(scheduleQueries,preparations.pool),owner=createPostgresScheduleOwner({pool});
 const selected=selectSkill('quick_skill.relationship_brief','1.0.0'),manifest=selected.manifest;
 const allocationJson=JSON.stringify({run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(key=>[key,binding[key]])),manifest,manifestSha256:hash(manifest),catalogSha256:selected.pin.catalogSha256,budgets:manifest.budgets,
  schedule:{revision:'a'.repeat(64),expiresAt:new Date(NOW+60000).toISOString(),operations:[{operation:manifest.allowedOperations[0],chargeMicrousd:1}]}});
 const policy={async check(call){
  const {selection}=call;assert.equal(call.selectionSha256,hash(selection));state.policies.push(selection);
  const mutation=!['list_scheduled_tasks','cancel_scheduled_task'].includes(selection.operation),receipt={authorized:state.allowed&&selection.phase!==state.refusePhase,selectionSha256:call.selectionSha256,binding,scopes:scopes(),selectedClientId:clientId,
   destinationResolution:mutation?{reference:selection.request.destinationReference,destinationId:'meri-inbox'}:null,limits:mutation?{maxCostMicrousd:2000,maxRuntimeSeconds:90,retryLimit:1}:null,checkedAtMs:now(),expiresAtMs:NOW+10000};
  await state.policyHook?.(call);return receipt;
 }};
 const contextConfiguration={sessions,commandContext,allocationJson,template:{taskId:id(20),version:1,manifestSha256:hash(manifest)},workflow:{taskQueue:'meri-schedules',workflowIdPrefix:'meri/schedules'},scheduleOwner:owner,policy,now,newId,limits:{maxRequestMs:5000,maxFactBytes:65536,retryLimit:0}};
 const context=createScheduleRuntimeContext(contextConfiguration),temporal=temporalScheduleService();
 const scheduleClient={connection:temporal.scheduleClient.connection,getHandle:temporal.scheduleClient.getHandle.bind(temporal.scheduleClient),async create(options){
  if(state.failCreateBefore)throw Error('synthetic create unavailable before provider effect');
  const result=await temporal.scheduleClient.create(options);if(state.loseCreateAck){state.loseCreateAck=false;throw Error('synthetic provider acknowledgement lost');}return result;
 }};
 const workflowClient={connection:temporal.scheduleClient.connection,getHandle(){throw Error('unexpected workflow history reference');}};
 const config={contextOwner:context,journalStore:createPostgresIntentJournalStore({pool}),proposalReader:createPostgresScheduleProposalReader({pool}),scheduleOwner:owner,scheduleClient,workflowClient,scheduleNotFoundError:ScheduleNotFoundError,now,maxRequestMs:5000};
 const service=createRoutinesService(config),call=(method,request,credential=session.credential)=>service[method]({credential,request,deadlineMs:now()+4500});
 const prepare=(request=routineRequest(),operation='schedule_task',requestId='request-one')=>call('prepare',{requestId,operation,request});
 const body=(prepared,request=routineRequest(),operation=prepared.proposal.operation)=>({operation,request,proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256});
 const approve=(prepared,request=routineRequest())=>call('approve',{...body(prepared,request),decision:'approved'});
 return {config,context,owner,sql,now,newId,sessions,session,contextConfiguration,service,state,preparations,temporal,pool,client:{schedule:scheduleClient,workflow:workflowClient},call,prepare,body,approve,scopes,close:()=>sessions.close()};
}
