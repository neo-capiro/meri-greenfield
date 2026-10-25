/** Read-only codec for retained historical memory approval payloads. Retention must still validate and purge these rows;
 * native memory submission writes only the existing candidate journal and never creates command approval metadata. */
import {canonicalSha256,assertProposalIntegrity,validateShape} from '../../../packages/contracts/validate.mjs';
import {normalizeMemoryProposeInput,assertMemoryProposeCommand,validateCommandShape} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {data,deny,instant,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';

export const MEMORY_COMMAND_OPERATION=Object.freeze({id:'save_memory',version:'0.2.0'});
const ACTION='memory.propose';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const selected=(value,context)=>{
 const v=own(data(value),['operation','action','binding']);
 if(!same(v.operation,MEMORY_COMMAND_OPERATION)||v.action!==ACTION||!same(v.binding,context.binding))deny('COMMAND_PREPARATION_REFUSED');
 return v;
};
const input=(request,context)=>{
 const raw=data(request);
 // The selected conversation client is a trusted run fact, never an argument supplied by a model tool call.
 if(Object.hasOwn(raw,'clientId'))deny('COMMAND_PREPARATION_REFUSED');
 return data({arguments:normalizeMemoryProposeInput(raw,context),attachments:[]});
};
function contextOf(value){const context=data(value);validateCommandShape('MemoryProposeContext',context);return context;}

/** Validate both domains of the retained hash: raw request → normalized command and command → exact proposal. */
export function memoryMetadataPayload(value){
 const p=own(data(value),['record','commandContext','commandSha256']),c=contextOf(p.commandContext);
 const r=own(p.record,['operation','action','binding','request','inputSha256','commandId','idempotencyKey','proposalId','scopes','createdAt','expiresAt','requiredApprover']);
 selected({operation:r.operation,action:r.action,binding:r.binding},c);
 const normalized=input(r.request,c);
 if(canonicalSha256(normalized)!==r.inputSha256)deny('COMMAND_PREPARATION_REFUSED');
 const command={contractVersion:'0.1.0',commandId:r.commandId,binding:r.binding,action:ACTION,arguments:normalized.arguments,
  attachments:[],scopes:r.scopes,idempotencyKey:r.idempotencyKey};
 assertMemoryProposeCommand(command,c);
 const proposal={proposalId:r.proposalId,command,commandSha256:canonicalSha256(command),createdAt:r.createdAt,expiresAt:r.expiresAt,
  requiredApprover:r.requiredApprover};
 assertProposalIntegrity(proposal);
 if(p.commandSha256!==proposal.commandSha256||instant(r.createdAt)>=instant(r.expiresAt)||r.requiredApprover.tenantId!==r.binding.tenantId)deny('COMMAND_PREPARATION_REFUSED');
 return data(p);
}
