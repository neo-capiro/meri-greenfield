// @ts-check
/** Worker-side admission of what an intent port returns. The control mount and canonical owners already validate it;
 * this only refuses anything that is not a prepare-only outcome for this run's tenant and conversation, so an owner
 * or port that applied an effect, or answered for another tenant, is never shown to the model as prepared.
 *
 * Accepted shapes (LOCAL PROPOSAL P-INT-1, pending dot):
 * - command:  `{status:'approval_required', proposal}` with a canonical public or private task-update proposal whose action matches.
 * - schedule: `{status:'approval_required', proposal}` with the schedule tool's pending `approval_required` output.
 * - document: `{status:'draft', version}` with an immutable artifact version in `generationStatus:'draft'`. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertProposalIntegrity,canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators,scheduleToolValidators,researchShareValidators,researchActionValidators,legiwatchValidators,savedNoteValidators,watchValidators,bizdevValidators,legislativeDocumentValidators,clientRecordValidators,validateShape as toolShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertMailSendProposal,assertTaskUpdateProposal} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {assertMemoryReviewResult} from '../../../../packages/contracts/commands-0.2/memory-review-result.mjs';
const ACTIONS=Object.freeze({mail_send:'mail.send',create_task:'task.create',update_task:'task.update',save_chat_attachments:'artifact.file'});
const refuse=()=>{throw Object.assign(Error('INVALID_RESULT'),{code:'INVALID_RESULT'});};
/** @param {any} b @param {any} binding */
const sameRun=(b,binding)=>b?.tenantId===binding.tenantId&&b?.actorId===binding.actorId&&b?.conversationId===binding.conversationId;
/** @param {any[]} scopes @param {string} tenantId */
const currentScopes=(scopes,binding,current)=>Array.isArray(scopes)&&scopes.length>0&&scopes.every(s=>{
 validateShape('Scope',s);return s.tenantId===binding.tenantId&&current.some(c=>canonicalSha256(c)===canonicalSha256(s));
});
/**
 * @param {'note'|'command'|'schedule'|'document'|'artifact'|'memory'|'research-sharing'|'research-action'|'legiwatch'|'watch'|'client-record'|'bizdev'|'legislative-document'} owner @param {{id:string,version:string}} operation @param {unknown} value @param {any} binding
 * @param {{scopes:any[],nowMs:number}} current
 * @returns {{status:'approval_required'|'draft'|'analysis_pending'|'review_pending'|'saved'|'withheld'|'blocked'|'unknown'|'failed'|'read',reference:string,value:any}}
 */
export function assertPreparedResult(owner,operation,value,binding,current){
 try{
  if(!Array.isArray(current?.scopes)||!current.scopes.length||!Number.isSafeInteger(current.nowMs))refuse();
  for(const s of current.scopes){validateShape('Scope',s);if(s.tenantId!==binding.tenantId)refuse();}
  const v=/** @type {any} */(data(value));
  if(owner==='watch'){
   watchValidators.assertOutput(v);const p=v.proposal;
   if(p.operation!==operation.id||operation.version!=='0.2.0'||!sameRun(p.binding,binding)||!currentScopes(p.scopes,binding,current.scopes)||Date.parse(p.createdAt)>current.nowMs||Date.parse(p.expiresAt)<=current.nowMs)refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='legiwatch'){
   legiwatchValidators.assertOutput(v);const p=v.proposal;
   if(p.operation!==operation.id||operation.version!=='0.2.0'||!sameRun(p.binding,binding)||!currentScopes(p.scopes,binding,current.scopes)||Date.parse(p.createdAt)>current.nowMs||Date.parse(p.expiresAt)<=current.nowMs)refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='client-record'){
   clientRecordValidators.assertOutput(v);const p=v.proposal;
   if(p.operation!==operation.id||operation.version!=='0.2.0'||!sameRun(p.binding,binding)||!currentScopes(p.scopes,binding,current.scopes)||Date.parse(p.createdAt)>current.nowMs||Date.parse(p.expiresAt)<=current.nowMs)refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='bizdev'){
   bizdevValidators.assertOutput(v);const p=v.proposal;
   if(p.operation!==operation.id||operation.version!=='0.2.0'||!sameRun(p.binding,binding)||!currentScopes(p.scopes,binding,current.scopes)||Date.parse(p.createdAt)>current.nowMs||Date.parse(p.expiresAt)<=current.nowMs)refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='legislative-document'){
   legislativeDocumentValidators.assertOutput(operation.id,v);const p=v.proposal;
   if(p.operation!==operation.id||operation.version!=='0.2.0'||!sameRun(p.binding,binding)||!currentScopes(p.scopes,binding,current.scopes)||Date.parse(p.createdAt)>current.nowMs||Date.parse(p.expiresAt)<=current.nowMs)refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='research-sharing'){
   toolShape('ResearchSharePrepared',v);const p=researchShareValidators.assertProposal(v.proposal);
   if(p.operation!==operation.id||operation.version!=='0.2.0'||!sameRun(p.binding,binding)||!currentScopes(p.scopes,binding,current.scopes)||Date.parse(p.createdAt)>current.nowMs||Date.parse(p.expiresAt)<=current.nowMs)refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='research-action'){
   if(v.status==='read'){
    const read=researchActionValidators.managementRead(v);validateShape('RunBinding',read.binding);
    if(operation.id!==read.operation||operation.version!=='0.2.0'||!sameRun(read.binding,binding)||!currentScopes(read.scopes,binding,current.scopes)||Date.parse(read.observedAt)>current.nowMs||Date.parse(read.expiresAt)<=current.nowMs)refuse();
    return {status:'read',reference:read.request.conversationId,value:read};
   }
   toolShape('ResearchActionPrepared',v);const p=researchActionValidators.assertProposal(v.proposal);
   if(p.operation!==operation.id||operation.version!=='0.2.0'||!sameRun(p.binding,binding)||!currentScopes(p.scopes,binding,current.scopes)||Date.parse(p.createdAt)>current.nowMs||Date.parse(p.expiresAt)<=current.nowMs)refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='memory'){
   assertMemoryReviewResult(v);
   if(operation.id!=='save_memory'||operation.version!=='0.2.0'||!sameRun(v.binding,binding)||!currentScopes(v.scopes,binding,current.scopes))refuse();
   return {status:'review_pending',reference:v.result.candidateId,value:v};
  }
  if(owner==='command'){
   own(v,['status','proposal']);const p=v.proposal;
   if(operation.id==='mail_send')assertMailSendProposal(p,{binding:p?.command?.binding});else if(operation.id==='update_task')assertTaskUpdateProposal(p,{binding:p?.command?.binding});else assertProposalIntegrity(p);
   if(v.status!=='approval_required'||p.command.action!==ACTIONS[/** @type {keyof typeof ACTIONS} */(operation.id)]||!sameRun(p.command.binding,binding)||!currentScopes(p.command.scopes,binding,current.scopes)||p.requiredApprover?.tenantId!==binding.tenantId||Date.parse(p.createdAt)>current.nowMs||Date.parse(p.expiresAt)<=current.nowMs)refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='schedule'){
   own(v,['status','proposal'],['request']);const p=v.proposal;
   toolShape('ScheduleMutationOutput',p);
   if(v.request!==undefined)scheduleToolValidators.normalizeRequest(operation.id,v.request);
   if(v.status!=='approval_required'||p?.status!=='approval_required'||p.operation!==operation.id||typeof p.proposalId!=='string'||typeof p.intentSha256!=='string'||
    p.projection?.owner?.tenantId!==binding.tenantId||p.projection.owner.actorId!==binding.actorId||!currentScopes(p.projection.scopes,binding,current.scopes))refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='artifact'&&v.status==='analysis_pending'){
   own(v,['status','binding','scopes','result']);artifactValidators.analysisResult(v.result);
   if(operation.id!=='run_analysis'||!sameRun(v.binding,binding)||!currentScopes(v.scopes,binding,current.scopes)||v.result.outputs.some(o=>!currentScopes(o.object.scopes,binding,v.scopes)))refuse();
   return {status:'analysis_pending',reference:v.result.intentSha256,value:v};
  }
  if(owner==='document'||owner==='artifact'){
   own(v,['status','version']);const r=v.version;
   if(v.status!=='draft'||r?.generationStatus!=='draft'||typeof r.versionId!=='string'||!sameRun(r.binding,binding)||!currentScopes(r.scopes,binding,current.scopes))refuse();
   return {status:'draft',reference:r.versionId,value:v};
  }
  if(owner==='note'){
   // A saved note is a static PASS, not a proposal: the recorded result is the closed saved-note envelope and
   // its own truthful status. It is admitted for this run's tenant, conversation and current scopes only.
   const e=savedNoteValidators.envelope(v);
   if(operation.id!=='save_note'||operation.version!=='0.2.0'||!sameRun(e.binding,binding)||!currentScopes(e.scopes,binding,current.scopes))refuse();
   return {status:e.status,reference:e.status==='saved'?e.noteId:e.proposalId,value:v};
  }
  return refuse();
 }catch{return refuse();}
}
