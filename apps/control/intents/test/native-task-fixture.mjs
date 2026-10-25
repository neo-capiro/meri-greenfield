import {createIntentApprovalOwner} from '../approval.mjs';
import {makePayload,canonicalSha256 as hash} from '../../commands/approval-metadata/binding.mjs';
import {normalizeTaskCreateInput,normalizeTaskUpdateInput} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {binding,scopes,id} from '../../conversations/test/application-fixture.mjs';
export const NOW=Date.parse('2026-10-24T12:00:00.000Z'),deliveryId='sdk:'+'a'.repeat(64);
export function nativeTaskFixture({action='task.create',general=false}={}){
 const admittedScopes=general?[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}]:scopes;
 const request=action==='task.create'?{title:'Reviewed task'}:{taskId:id(900),title:'Updated task',status:'done'};
 const context=action==='task.create'?{binding,clientResolution:null}:{binding};
 const args=(action==='task.create'?normalizeTaskCreateInput:normalizeTaskUpdateInput)(request,context);
 const metadata=makePayload({operation:{id:action==='task.create'?'create_task':'update_task',version:'0.2.0'},action,binding,request,inputSha256:hash({arguments:args,attachments:[]}),
  commandId:id(901),idempotencyKey:'native-task-once',proposalId:id(902),scopes:admittedScopes,createdAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId}},context);
 const r=metadata.record,command={contractVersion:action==='task.create'?'0.1.0':'0.2.0',commandId:r.commandId,binding,action,arguments:args,attachments:[],scopes:admittedScopes,idempotencyKey:r.idempotencyKey};
 const proposal={proposalId:r.proposalId,command,commandSha256:metadata.commandSha256,createdAt:r.createdAt,expiresAt:r.expiresAt,requiredApprover:r.requiredApprover};
 const decision={proposalId:r.proposalId,commandSha256:metadata.commandSha256,decision:'approved',decidedAt:new Date(NOW).toISOString(),expiresAt:r.expiresAt,approver:r.requiredApprover,policyRevision:admittedScopes[0].policyRevision};
 const result=action==='task.create'?{id:id(903),...args,status:'todo',createdAt:new Date(NOW).toISOString()}:
  {id:args.taskId,title:args.patch.title,status:args.patch.status,dueDate:null,clientId:null,updatedAt:new Date(NOW).toISOString()};
 const outcome={execution:{kind:'native-task',proposalId:r.proposalId,commandSha256:metadata.commandSha256,idempotencyKey:r.idempotencyKey,binding,completedAt:new Date(NOW).toISOString(),approvalDecisionSha256:hash(decision)},result};
 const state={stored:null,decision:null,dispatches:0,loseAck:false,mutate:null,legacyCalls:0};
 const entry={deliveryId,createdAt:r.createdAt,record:{operation:r.operation},state:'PREPARED',outcome:{result:{status:'approval_required',proposal}}};
 const principal={...r.requiredApprover,role:'member',permissions:[],clientIds:general?[]:scopes.filter(s=>s.kind==='client').map(s=>s.resourceId),membershipRevision:'m1'};
 const owner=createIntentApprovalOwner({journal:{async read(){return structuredClone(entry);},async list(){return {entries:[structuredClone(entry)],next:null};}},
  decisions:{async record(input){state.decision??={...decision,decision:input.decision};return {decision:state.decision,checkedAtMs:NOW,revoked:false};},async readDecision(){return state.decision;}},
  tasks:{async execute(){state.dispatches++;state.stored??=structuredClone(outcome);if(state.loseAck){state.loseAck=false;throw Error('lost Core response');}const value=structuredClone(state.stored);state.mutate?.(value);return {status:'observed',outcome:value};},async read(){return state.stored===null?null:{state:'OUTCOME',outcome:structuredClone(state.stored)};}},
  now:()=>NOW,limits:{maxRequestMs:5000},enabled:true});
 const decideRequest={conversationId:binding.conversationId,deliveryId,proposalId:r.proposalId,commandSha256:metadata.commandSha256,decision:'approved'};
 const listRequest={conversationId:binding.conversationId};
 return {owner,principal,proposal,decision,outcome,state,metadata,decideRequest,listRequest};
}
