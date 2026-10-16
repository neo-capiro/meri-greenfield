// @ts-check
/** Worker-side admission of what an intent port returns. The control mount and canonical owners already validate it;
 * this only refuses anything that is not a prepare-only outcome for this run's tenant and conversation, so an owner
 * or port that applied an effect, or answered for another tenant, is never shown to the model as prepared.
 *
 * Accepted shapes (LOCAL PROPOSAL P-INT-1, pending dot):
 * - command:  `{status:'approval_required', proposal}` with a public `Proposal` whose command action matches.
 * - schedule: `{status:'approval_required', proposal}` with the schedule tool's pending `approval_required` output.
 * - document: `{status:'draft', version}` with an immutable artifact version in `generationStatus:'draft'`. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
const ACTIONS=Object.freeze({create_task:'task.create',update_task:'task.update',save_memory:'memory.propose',save_chat_attachments:'artifact.file'});
const refuse=()=>{throw Object.assign(Error('INVALID_RESULT'),{code:'INVALID_RESULT'});};
/** @param {any} b @param {any} binding */
const sameRun=(b,binding)=>b?.tenantId===binding.tenantId&&b?.actorId===binding.actorId&&b?.conversationId===binding.conversationId;
/** @param {any[]} scopes @param {string} tenantId */
const tenantScopes=(scopes,tenantId)=>Array.isArray(scopes)&&scopes.length>0&&scopes.every(s=>s?.tenantId===tenantId);
/**
 * @param {'command'|'schedule'|'document'|'artifact'} owner @param {{id:string,version:string}} operation @param {unknown} value @param {any} binding
 * @returns {{status:'approval_required'|'draft',reference:string,value:any}}
 */
export function assertPreparedResult(owner,operation,value,binding){
 try{
  const v=/** @type {any} */(data(value));
  if(owner==='command'){
   own(v,['status','proposal']);const p=v.proposal;assertProposalIntegrity(p);
   if(v.status!=='approval_required'||p.command.action!==ACTIONS[/** @type {keyof typeof ACTIONS} */(operation.id)]||!sameRun(p.command.binding,binding)||!tenantScopes(p.command.scopes,binding.tenantId)||p.requiredApprover?.tenantId!==binding.tenantId)refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='schedule'){
   own(v,['status','proposal']);const p=v.proposal;
   if(v.status!=='approval_required'||p?.status!=='approval_required'||p.operation!==operation.id||typeof p.proposalId!=='string'||typeof p.intentSha256!=='string'||
    p.projection?.owner?.tenantId!==binding.tenantId||!tenantScopes(p.projection.scopes,binding.tenantId))refuse();
   return {status:'approval_required',reference:p.proposalId,value:v};
  }
  if(owner==='document'){
   own(v,['status','version']);const r=v.version;
   if(v.status!=='draft'||r?.generationStatus!=='draft'||typeof r.versionId!=='string'||!sameRun(r.binding,binding)||!tenantScopes(r.scopes,binding.tenantId))refuse();
   return {status:'draft',reference:r.versionId,value:v};
  }
  return refuse();
 }catch{return refuse();}
}
