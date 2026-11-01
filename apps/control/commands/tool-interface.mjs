/** Raw agent arguments to an immutable proposal. Native approval receivers own execution. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {CommandError,data,deny,instant,nativeSignal,own,safe} from './protocol.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function createCommandToolInterface(options){
 const {operation,action,commandContext,validators,assertProposal,approvalMetadataOwner,now,limits}=own(options,
  ['operation','action','commandContext','validators','assertProposal','approvalMetadataOwner','now','limits']);
 const trusted=data({operation,action,commandContext,limits});own(trusted.operation,['id','version']);own(trusted.limits,['maxRequestMs','maxFactBytes']);
 if(typeof action!=='string'||typeof trusted.operation.id!=='string'||trusted.operation.version!=='0.2.0'||typeof now!=='function'||typeof assertProposal!=='function'||
  typeof validators?.normalizeCommandToolInput!=='function'||typeof validators?.assertCommandToolProposal!=='function'||typeof approvalMetadataOwner?.prepare!=='function'||
  !Number.isSafeInteger(trusted.limits.maxRequestMs)||trusted.limits.maxRequestMs<1||trusted.limits.maxRequestMs>3600000||
  !Number.isSafeInteger(trusted.limits.maxFactBytes)||trusted.limits.maxFactBytes<1||trusted.limits.maxFactBytes>16*1024*1024)deny('COMMAND_CONFIGURATION');
 const binding=trusted.commandContext.binding;
 const normalize=request=>{const value=data(validators.normalizeCommandToolInput(action,request,{commandContext:trusted.commandContext}));own(value,['input','metadata']);own(value.input,['arguments','attachments']);return value.input;};
 function record(raw,started,lifetime,request){
  const value=data(raw);if(Buffer.byteLength(JSON.stringify(value))>trusted.limits.maxFactBytes)deny('COMMAND_RESOURCE_LIMIT');
  own(value,['operation','action','binding','request','inputSha256','commandId','idempotencyKey','proposalId','scopes','createdAt','expiresAt','requiredApprover','checkedAtMs']);
  const at=now();
  if(!Number.isSafeInteger(at)||!Number.isSafeInteger(value.checkedAtMs)||value.checkedAtMs<started||value.checkedAtMs>at||
   !same(value.operation,trusted.operation)||value.action!==action||!same(value.binding,binding)||(request!==undefined&&!same(value.request,request))||
   instant(value.createdAt)>at||instant(value.expiresAt)<=at||instant(value.expiresAt)<=instant(value.createdAt))deny('COMMAND_PREPARATION_REFUSED');
  lifetime.limitDeadline(instant(value.expiresAt));
  const input=normalize(value.request);if(value.inputSha256!==canonicalSha256(input))deny('COMMAND_PREPARATION_REFUSED');
  const command={contractVersion:['task.update','mail.send'].includes(action)?'0.2.0':'0.1.0',commandId:value.commandId,binding,action,
   arguments:input.arguments,attachments:input.attachments,scopes:value.scopes,idempotencyKey:value.idempotencyKey};
  const proposal={proposalId:value.proposalId,command,commandSha256:canonicalSha256(command),createdAt:value.createdAt,expiresAt:value.expiresAt,requiredApprover:value.requiredApprover};
  assertProposal(proposal,trusted.commandContext);
  validators.assertCommandToolProposal(action,proposal,value.request,{commandContext:trusted.commandContext,command});
  if(!Array.isArray(command.scopes)||command.scopes.some(scope=>scope.tenantId!==binding.tenantId))deny('COMMAND_PREPARATION_REFUSED');
  lifetime.check();if(lifetime.signal.aborted)deny('CANCELLED');return data({request:value.request,proposal});
 }
 async function run(signal,body){
  nativeSignal(signal);const deadlineMs=now()+trusted.limits.maxRequestMs;
  const lifetime=createOperationLifetime({deadlineMs,now,signal,errorFactory:code=>new CommandError(code)});
  try{return await body(lifetime,deadlineMs);}catch(error){throw safe(error);}finally{lifetime.close();}
 }
 async function prepare(value,options={}){
  const {signal}=own(options,[],['signal']),request=data(value),input=normalize(request);
  return run(signal,async(lifetime,deadlineMs)=>{
   const started=now();
   const raw=await lifetime.run(signal=>approvalMetadataOwner.prepare({operation:trusted.operation,action,binding,request,input,inputSha256:canonicalSha256(input),deadlineMs,signal}));
   const admitted=record(raw,started,lifetime,request);return data({status:'approval_required',proposal:admitted.proposal});
  });
 }
 return Object.freeze({prepare});
}
