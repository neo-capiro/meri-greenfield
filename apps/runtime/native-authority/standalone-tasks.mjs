/** Attended task preparation reuses the initial binding, metadata and intent journal. No run or provider invocation is created. */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertNativeApprovalProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {authenticatedCurrentState} from '../../control/action-host/session/owner.mjs';
import {createNativeTaskPreparers} from './native-task-preparers.mjs';
import {createIntentMount} from '../../control/intents/mount.mjs';
import {createIntentResultReleaseAuthority} from '../../control/intents/result-release-authority.mjs';
import {createPostgresIntentJournalStore,createPostgresCommandProposalReader} from '../../control/intents/postgres-journal.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {fail} from '../../control/action-application/http.mjs';
import {createTaskCommandApplication} from '../../control/task-command-application/index.mjs';
import {intentsComposition} from '../product-ports/intents.mjs';
const same=(a,b)=>hash(a)===hash(b),deny=()=>{throw intentFault('ACCESS_DENIED','none');};
export const publicTaskDelivery=(operation,requestId)=>'sdk:'+hash({kind:'public-task-preparation',operation,requestId});

export function createStandaloneTaskSessions({context,sessions,store,retention,shared=intentsComposition(context)}){
 const {pool,now,configuration}=context,readCurrent=authenticatedCurrentState(sessions),journalStore=createPostgresIntentJournalStore({pool}),custody=createPostgresCommandProposalReader({pool});
 if(!shared.tasks||!shared.owner||!store.initialBindings||typeof retention?.assertServable!=='function'||typeof retention?.withRelease!=='function')throw intentFault('UNAVAILABLE');
 return async function resolveSession({credential,intent,signal,deadlineMs}){
  let pinned,expiresAtMs=Number.MAX_SAFE_INTEGER;
  const check=()=>{signal?.throwIfAborted();if(now()>=Math.min(expiresAtMs,deadlineMs))throw intentFault('DEADLINE');};
  const serve=async()=>{if(retention)await retention.assertServable({tenantId:pinned.binding.tenantId,kind:'conversation',subjectId:pinned.binding.conversationId});check();};
  async function fresh(signal){
   const started=now();let authentication,current;
   if(readCurrent)({authentication,current}=data(await readCurrent({credential,signal,deadlineMs:Math.min(expiresAtMs,deadlineMs)})));
   else{authentication=data(await sessions.authenticateSession({credential,signal,deadlineMs:Math.min(expiresAtMs,deadlineMs)}));current=data(await sessions.readCurrentState({authentication,signal,deadlineMs:Math.min(expiresAtMs,deadlineMs)}));}
   validateShape('RunBinding',current.binding);assertNativeConversationScope(current);
   if(current.authenticationSha256!==hash(authentication)||['tenantId','actorId','conversationId','runId'].some(k=>authentication.principal?.[k]!==current.binding[k]))deny();
   for(const r of [authentication,current])if(!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now())deny();
   const selected=data({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId});
   if(pinned&&!same(pinned,selected))deny();pinned??=selected;expiresAtMs=Math.min(expiresAtMs,authentication.expiresAtMs,current.expiresAtMs);await serve();return {...selected,checkedAtMs:now(),expiresAtMs};
  }
  const first=await fresh(signal),{binding,scopes,selectedClientId}=first,policyRevision=scopes[0].policyRevision;
  const principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:scopes.filter(s=>s.kind==='client').map(s=>s.resourceId.toLowerCase())};
  let preparationDeadline;
  async function preparation(signal){
   await fresh(signal);
   const current=await store.readOptional(binding,{after:0,limit:1},check);
   if(current===null){
    const initial=await store.initialBindings.readPreparation({binding},check);if(initial===null||initial.record.selectedClientId!==selectedClientId||initial.record.policyRevision!==policyRevision)deny();
    preparationDeadline??=Math.min(expiresAtMs,initial.record.expiresAtMs);
   }else{
    const history=await store.history.transcript({principal,conversationId:binding.conversationId,after:0,limit:1},check);
    if(!same(history.latestRun.binding,binding)||!same(current.run.scopes,scopes)||current.run.state==='cancelled'||history.pendingTurn!==null)deny();
    preparationDeadline??=expiresAtMs;
   }
   if(preparationDeadline<=now())deny();return {binding,policyRevision,deadlineMs:preparationDeadline,checkedAtMs:now()};
  }
  async function currentRights({signal,policyRevision:revision}){if(revision!==policyRevision)deny();const current=await fresh(signal);return {tenantId:binding.tenantId,actorId:binding.actorId,scopes,checkedAtMs:current.checkedAtMs,expiresAtMs:current.expiresAtMs};}
  async function prepare({requestId,arguments:args,signal}){
   const operation={id:'update_task',version:'0.2.0'},deliveryId=publicTaskDelivery(operation,requestId);
   const key={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId};
   const prior=await journalStore.read({key,signal});await fresh(signal);
   if(prior!==null){
    if(!same(prior.record.operation,operation))throw intentFault('CONFLICT');
    // A claimed delivery cannot be prepared again, including after its initial binding expires or is superseded.
    if(prior.state==='PENDING'||prior.state==='UNKNOWN')throw intentFault('UNKNOWN');
    if(prior.state==='FAILED'){
     if(prior.record.argumentsSha256!==hash({binding,arguments:args}))throw intentFault('CONFLICT');
     throw intentFault(prior.outcome.code);
    }
    const proposal=prior.outcome.result.proposal;
    const retained=await custody.readPreparedCommand({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,proposalId:proposal?.proposalId,signal});
    if(retained===null||!same(retained.key,key)||!same(retained.record,prior.record)||!same(retained.outcome,prior.outcome)||proposal.command.action!=='task.update'||!same(proposal.command.scopes,scopes))deny();
    if(prior.record.argumentsSha256!==hash({binding:proposal.command.binding,arguments:args}))throw intentFault('CONFLICT');
    await fresh(signal);return retained.outcome.result;
   }
   await preparation(signal);
   const native=createNativeTaskPreparers({pool,binding,scopes,selectedClientId,policyRevision,expiresAtMs:preparationDeadline,currentRights,now,maxRequestMs:configuration.limits.requestMs});
   // The existing journal key is conversation-scoped. Include the full original binding in its immutable input hash.
   const preparers=native.map(p=>({...p,prepare:({arguments:value,...options})=>{if(!same(value.binding,binding))deny();return p.prepare({...options,arguments:value.arguments});}}));
   const mount=createIntentMount({binding,preparers,journalStore,now,enabled:true,limits:{maxRequestMs:configuration.limits.requestMs},resultRelease:createIntentResultReleaseAuthority({binding,now,currentRights,currentRun:async(_b,{signal})=>JSON.stringify(await preparation(signal))})});
   return mount.prepare({operation,arguments:{binding,arguments:args},deliveryId,signal});
  }
  async function execute({proposal,signal,deadlineMs}){
   assertNativeApprovalProposal(proposal);if(proposal.command.action!=='task.update'||['tenantId','actorId','conversationId'].some(k=>proposal.command.binding[k]!==binding[k]))deny();
   await fresh(signal);
   const retained=await custody.readPreparedCommand({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,proposalId:proposal.proposalId,signal});
   if(retained===null||!same(retained.outcome.result.proposal,proposal))deny();
   const deliveryId=retained.key.deliveryId,value={proposal,principal,deliveryId,signal,deadlineMs};
   const stored=await shared.tasks.read(value);await fresh(signal);
   if(stored!==null){if(stored.state==='OUTCOME')return {status:'observed',outcome:stored.outcome};if(stored.state==='UNKNOWN')return {status:'indeterminate',outcome:null};deny();}
   if(Date.parse(proposal.expiresAt)<=now())fail('COMMAND_APPROVAL_REFUSED',409);
   const result=await shared.owner.decide({principal,request:{conversationId:binding.conversationId,deliveryId,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved'},signal,deadlineMs});
   await fresh(signal);
   if(result.status==='executed')return {status:'observed',outcome:result.outcome};
   if(result.status==='indeterminate')return {status:'indeterminate',outcome:null};deny();
  }
  async function release(serialize,{signal,deadlineMs}){
   await fresh(signal);const subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId};
   if(!retention){check();return serialize();}
   return retention.withRelease([subject],async(fenceSignal,assertServable)=>{fenceSignal.throwIfAborted();check();await assertServable(subject);check();fenceSignal.throwIfAborted();return serialize();},{signal,deadlineMs});
  }
  return {binding,checkedAtMs:now(),expiresAtMs,prepare,execute,release};
 };
}

export function createStandaloneTaskApplication(options){
 const c=options.context.configuration;
 return createTaskCommandApplication({resolveSession:createStandaloneTaskSessions(options),now:options.context.now,limits:{maxRequestMs:c.limits.requestMs,maxRequestBytes:c.limits.requestBytes,maxResponseBytes:c.native.maxResponseBytes}});
}
