/** Actual standalone session/preparation/journal/approval composition; only SQL, current authority and Core effects are scripted. */
import assert from 'node:assert/strict';
import {createStandaloneTaskApplication} from '../standalone-tasks.mjs';
import {createIntentApprovalOwner} from '../../../control/intents/approval.mjs';
import {createPostgresIntentJournalStore} from '../../../control/intents/postgres-journal.mjs';
import {createPreparedSchedulePoolFixture} from '../../../control/intents/test/prepared-schedule-fixture.mjs';
import {createMetadataPoolFixture} from '../../../control/commands/approval-metadata/test/fixture.mjs';
import {binding as original,scopes as clientScopes,id} from '../../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
export {id};
export function standaloneFixture({general=false,maxResponseBytes=262144,retention}={}){
 retention??={async assertServable(){},async withRelease(_subjects,release,{signal}){return release(signal,async()=>{});}};
 const state={now:1800000000000,revoked:false,started:false,decisions:0,effects:0,reads:0,unknown:false,readDown:false,afterExecute:null,afterMetadata:null};
 const binding={...original},scopes=general?[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:clientScopes[0].policyRevision}]:clientScopes,selectedClientId=general?null:id(5);
 const sql=createPreparedSchedulePoolFixture(),metadata=createMetadataPoolFixture();
 const pool={options:{connectionTimeoutMillis:30000,query_timeout:30000},async connect(){const intent=await sql.pool.connect(),meta=await metadata.pool.connect();return {async query(q,args){
  if((typeof q==='string'?q:q.text).includes('meri_commands.approval_metadata')){const answer=await meta.query(q);await state.afterMetadata?.();return answer;}return intent.query(q,args);
 },release(){intent.release();meta.release();}};}};
 const now=()=>state.now,context={configuration:{sourceEnabled:true,retention:{},intents:{enabled:true,core:{}},limits:{requestMs:3000,requestBytes:65536},native:{maxResponseBytes}},pool,now};
 const sessionBinding=()=>state.binding??binding;
 const sessions={async authenticateSession({credential}){if(credential!=='synthetic-session'||state.revoked)throw Error('refused');const b=sessionBinding();return {principal:{tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,runId:b.runId},checkedAtMs:now(),expiresAtMs:now()+60000};},
  async readCurrentState({authentication}){if(state.revoked)throw Error('refused');return {authenticationSha256:hash(authentication),binding:sessionBinding(),scopes,selectedClientId,checkedAtMs:now(),expiresAtMs:now()+60000};}};
 const store={async readOptional(){return null;},initialBindings:{async readPreparation({binding:b}){if(state.started)throw Error('already started');return {record:{binding:b,selectedClientId,policyRevision:scopes[0].policyRevision,expiresAtMs:now()+60000}};}}};
 const effects=new Map(),decisions={async record({proposal,decision,approver}){state.decisions++;const d={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision,approver,decidedAt:new Date(now()).toISOString(),expiresAt:proposal.expiresAt,policyRevision:scopes[0].policyRevision};return {decision:d,checkedAtMs:now(),revoked:false};}};
 const tasks={async read({proposal}){state.reads++;if(state.readDown)throw Error('unavailable');return state.unknown?{state:'UNKNOWN'}:effects.has(proposal.proposalId)?{state:'OUTCOME',outcome:structuredClone(effects.get(proposal.proposalId))}:null;},async execute({proposal,decision}){
  assert.equal(decision.decision,'approved');state.effects++;const c=proposal.command,completedAt=new Date(now()).toISOString();
  const result=c.action==='task.create'?{id:id(903),...c.arguments,status:'todo',createdAt:completedAt}:{id:c.arguments.taskId,title:'Original',status:'todo',dueDate:null,clientId:selectedClientId,...c.arguments.patch,updatedAt:completedAt};
  const outcome={execution:{kind:'native-task',proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:c.idempotencyKey,binding:c.binding,completedAt,approvalDecisionSha256:hash(decision)},result};
  effects.set(proposal.proposalId,outcome);await state.afterExecute?.();return {status:'observed',outcome};
 }};
 const shared={tasks,owner:createIntentApprovalOwner({journal:createPostgresIntentJournalStore({pool}),decisions,tasks,now,limits:{maxRequestMs:3000},enabled:true})};
 const app=createStandaloneTaskApplication({context,sessions,store,shared,retention});
 const raw={requestId:id(70),arguments:{taskId:id(21),title:' Updated ',status:'open'}};
 const request=(route,body,options={})=>new Request('https://meri.invalid/api/task-commands/'+route,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer synthetic-session'},body:JSON.stringify(body),...options});
 return {state,context,app,sessions,store,shared,retention,sql,metadata,binding,scopes,raw,effects,request,call:(route,body)=>app.handle(request(route,body))};
}
