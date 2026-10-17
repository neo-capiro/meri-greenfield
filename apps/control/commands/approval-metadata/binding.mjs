/** Task metadata correlation only; policy and execution remain external owners. */
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {validateCommandShape} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {taskKind} from './task-kind.mjs';
import {CommandError,data,deny,instant,own} from '../protocol.mjs';
export {canonicalSha256,CommandError,data,deny,instant,own};
export const operation=Object.freeze({id:'create_task',version:'0.2.0'}),action='task.create';
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function context(value,kindAction=action){const c=data(value);validateCommandShape(taskKind(kindAction).contextShape,c);return c;}
export function selected(value,c,kindAction=action){
 const v=data(value);own(v,['operation','action','binding']);
 if(!same(v.operation,taskKind(kindAction).operation)||v.action!==kindAction||!same(v.binding,c.binding))deny('COMMAND_PREPARATION_REFUSED');return v;
}
export function input(request,c,kindAction=action){return data({arguments:taskKind(kindAction).normalize(request,c),attachments:[]});}
export function immutablePayload(value){
 const p=data(value);own(p,['record','commandContext','commandSha256']);const r=p.record,kind=taskKind(r.action),c=context(p.commandContext,r.action);
 own(r,['operation','action','binding','request','inputSha256','commandId','idempotencyKey','proposalId','scopes','createdAt','expiresAt','requiredApprover']);
 selected({operation:r.operation,action:r.action,binding:r.binding},c,r.action);
 const normalized=input(r.request,c,r.action);if(canonicalSha256(normalized)!==r.inputSha256)deny('COMMAND_PREPARATION_REFUSED');
 const command={contractVersion:kind.contractVersion,commandId:r.commandId,binding:r.binding,action:r.action,arguments:normalized.arguments,attachments:normalized.attachments,scopes:r.scopes,idempotencyKey:r.idempotencyKey};
 kind.assertCommand(command,c);
 const proposal={proposalId:r.proposalId,command,commandSha256:canonicalSha256(command),createdAt:r.createdAt,expiresAt:r.expiresAt,requiredApprover:r.requiredApprover};
 kind.assertProposal(proposal,c);
 if(p.commandSha256!==proposal.commandSha256||instant(r.createdAt)>=instant(r.expiresAt)||r.requiredApprover.tenantId!==r.binding.tenantId)deny('COMMAND_PREPARATION_REFUSED');
 return p;
}
export function makePayload(record,c){
 const kind=taskKind(record.action),normalized=input(record.request,c,record.action),command={contractVersion:kind.contractVersion,commandId:record.commandId,binding:record.binding,action:record.action,arguments:normalized.arguments,attachments:normalized.attachments,scopes:record.scopes,idempotencyKey:record.idempotencyKey};
 return immutablePayload({record,commandContext:c,commandSha256:canonicalSha256(command)});
}
export function readKey(value){const k=data(value);own(k,['tenantId','actorId','proposalId']);validateShape('Identity',{tenantId:k.tenantId,actorId:k.actorId});assertReadIds({proposalId:k.proposalId,commandSha256:'0'.repeat(64)});return k;}
export function assertReadIds(value){
 if(typeof value.proposalId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.proposalId)||typeof value.commandSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.commandSha256))deny('COMMAND_PREPARATION_REFUSED');
}
export function policySelection(phase,call,payload=null){return data({phase,operation:call.operation,action:call.action,binding:call.binding,request:payload?.record.request??call.request??null,inputSha256:payload?.record.inputSha256??call.inputSha256??null,proposalId:payload?.record.proposalId??call.proposalId??null,commandSha256:payload?.commandSha256??call.commandSha256??null,recordSha256:payload?canonicalSha256(payload):null});}
export function policyReceipt(value,selection,started,at,payload){
 const r=data(value);own(r,['authorized','selectionSha256','binding','scopes','requiredApprover','proposalExpiresAt','checkedAtMs','expiresAtMs']);
 if(r.authorized!==true||r.selectionSha256!==canonicalSha256(selection)||!same(r.binding,selection.binding)||!Number.isSafeInteger(at)||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>at||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=at||instant(r.proposalExpiresAt)<=at)deny('COMMAND_PREPARATION_REFUSED');
 validateShape('Identity',r.requiredApprover);if(r.requiredApprover.tenantId!==r.binding.tenantId||!Array.isArray(r.scopes))deny('COMMAND_PREPARATION_REFUSED');
 for(const s of r.scopes){validateShape('Scope',s);if(s.tenantId!==r.binding.tenantId)deny('COMMAND_PREPARATION_REFUSED');}
 if(payload&&(!same(r.scopes,payload.record.scopes)||!same(r.requiredApprover,payload.record.requiredApprover)||r.proposalExpiresAt!==payload.record.expiresAt))deny('COMMAND_PREPARATION_REFUSED');return r;
}
