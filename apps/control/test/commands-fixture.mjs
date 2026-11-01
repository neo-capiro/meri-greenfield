/** Inert command/proposal data for active metadata, retained-reader and public contract tests. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import * as payloads from '../../../packages/contracts/commands-0.2/validate.mjs';
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const NOW=Date.parse('2026-10-12T20:00:00.000Z');
export function fixture(action='task.create',{policy='p1'}={}){
 const state={now:NOW};
 const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const scopes=[{tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:policy}];
 const context=action==='task.create'?{binding,clientResolution:null}:action==='memory.propose'?{binding,conversationClientId:id(9)}:action==='artifact.file'?{binding,destination:{clientId:id(9),conversationId:id(1)}}:{binding};
 const object={objectId:id(20),versionId:'v1',sha256:'a'.repeat(64),bytes:2,scopes};
 const args=action==='task.create'?payloads.normalizeTaskCreateInput({title:'Task'},context):action==='memory.propose'?payloads.normalizeMemoryProposeInput({content:'Memory',scope:'firm'},context):action==='artifact.file'?context.destination:payloads.normalizeTaskUpdateInput({taskId:id(21),title:'Updated',status:'open'},context);
 const command={contractVersion:action==='task.update'?'0.2.0':'0.1.0',commandId:id(5),binding,action,arguments:args,attachments:action==='artifact.file'?[object]:[],scopes,idempotencyKey:'delivery-1'};
 const proposal={proposalId:id(6),command,commandSha256:canonicalSha256(command),createdAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+45000).toISOString(),requiredApprover:{tenantId:'tenant',actorId:'reviewer'}};
 const execution={contractVersion:'0.1.0',requestId:id(7),capabilityId:id(8),executorBinding:binding,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:command.idempotencyKey};
 return {state,binding,scopes,context,command,proposal,execution};
}
