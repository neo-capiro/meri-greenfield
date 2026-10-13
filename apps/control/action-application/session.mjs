/** Trusted session data correlates canonical owners; it does not decide their rights. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {normalizeTaskCreateInput} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {readContext as checkReadContext} from '../task-lookup/binding.mjs';
import {fail} from './http.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function session(value,intent,started,now,limitDeadline,check){
 const s=own(value,['lookup','lookupContext','lookupCredential','readContext','commandOptions','authorizeExecution','expiresAtMs','checkedAtMs']);
 const trusted=data({lookupContext:s.lookupContext,readContext:s.readContext,expiresAtMs:s.expiresAtMs,checkedAtMs:s.checkedAtMs});const at=now();
 if(!Number.isSafeInteger(at)||!Number.isSafeInteger(trusted.checkedAtMs)||trusted.checkedAtMs<started||trusted.checkedAtMs>at||!Number.isSafeInteger(trusted.expiresAtMs)||trusted.expiresAtMs<=at||typeof s.lookupCredential!=='string'||!s.lookupCredential||typeof s.authorizeExecution!=='function')fail('UNAUTHENTICATED',401);
 limitDeadline(trusted.expiresAtMs);check();const read=checkReadContext(trusted.readContext,at),lookup=trusted.lookupContext;validateShape('RunBinding',lookup.binding);
 if(!same(read.currentBinding,lookup.binding)||!same(read.scopes,lookup.scopes)||typeof lookup.selectedClientId!=='string')fail('SESSION_SCOPE_REFUSED',403);
 const options=own(s.commandOptions,['operation','action','outputShape','commandContext','validators','assertProposal','approvalMetadataOwner','executor','now','limits']);
 const commandContext=data(options.commandContext),binding=commandContext.binding;
 if(['tenantId','actorId','conversationId','runId'].some(k=>binding?.[k]!==read.currentBinding[k])||(intent!=='execute'&&!same(binding,read.currentBinding)))fail('SESSION_SCOPE_REFUSED',403);
 const client=lookup.selectedClientId.toLowerCase();if(commandContext.clientResolution?.reference!==client||commandContext.clientResolution?.clientId!==client)fail('SESSION_SCOPE_REFUSED',403);
 if(!read.scopes.some(x=>x.kind==='client'&&x.resourceId.toLowerCase()===client))fail('SESSION_SCOPE_REFUSED',403);
 normalizeTaskCreateInput({title:'Session validation',clientId:client,dueDate:null},commandContext);
 const ports=own(s.lookup,['lookup','read']);if(typeof ports.lookup!=='function'||typeof ports.read!=='function')fail('SESSION_SCOPE_REFUSED',403);
 check();return {...s,...trusted,commandOptions:{...options,...data({operation:options.operation,action:options.action,outputShape:options.outputShape,commandContext,limits:options.limits})},selectedClientId:client};
}
export function clippedCommand(options,cutoff,check){
 const metadata=own(options.approvalMetadataOwner,['prepare','read']);
 const method=name=>async value=>{check();const result=await metadata[name].call(options.approvalMetadataOwner,{...value,deadlineMs:Math.min(value.deadlineMs,cutoff())});check();return result;};
 return {...options,approvalMetadataOwner:{prepare:method('prepare'),read:method('read')}};
}
