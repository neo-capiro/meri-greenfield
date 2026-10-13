/** New unactivated API. Canonical owners retain authorization, persistence and effects. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {CommandError,data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {commandToolValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createActionFollowthrough} from '../action-followthrough/index.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {prepare as prepareLookup} from '../task-lookup/binding.mjs';
import {requestInfo,jsonBody,response,errorResponse,fail} from './http.mjs';
import {session,clippedCommand} from './session.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function createActionApplication(configuration){
 const {resolveSession,now,limits}=own(configuration,['resolveSession','now','limits']),bounds=data(limits);own(bounds,['maxRequestMs','maxRequestBytes','maxResponseBytes']);
 if(typeof resolveSession!=='function'||typeof now!=='function'||Object.values(bounds).some(x=>!Number.isSafeInteger(x)||x<1)||bounds.maxRequestMs>60000||bounds.maxRequestBytes>16*1024*1024||bounds.maxResponseBytes>16*1024*1024)fail('APPLICATION_CONFIGURATION',500);
 return Object.freeze({async handle(request){
  let lifetime;const state={};
  try{
   const info=requestInfo(request),start=now();if(!Number.isSafeInteger(start)||start<0)fail('APPLICATION_CLOCK',500);
   let cutoff=start+bounds.maxRequestMs;
   lifetime=createOperationLifetime({deadlineMs:cutoff,now,signal:info.signal,errorFactory:code=>new CommandError(code)});
   const check=()=>{const at=now();if(!Number.isSafeInteger(at)||at>=cutoff)throw new CommandError('DEADLINE');lifetime.check();if(lifetime.signal.aborted)throw new CommandError('CANCELLED');};
   const shrink=next=>{lifetime.limitDeadline(next);cutoff=Math.min(cutoff,next);check();};
   const body=data(await jsonBody(info,bounds.maxRequestBytes,lifetime,check));
   own(body,info.intent==='query'?['request']:info.intent==='draft'?['selection']:info.intent==='prepare'?['draft']:['proposal'],info.intent==='draft'?['edits']:[]);check();
   const calledAt=now();let fact;
   try{fact=await lifetime.run(signal=>resolveSession({credential:info.credential,intent:info.intent,signal,deadlineMs:cutoff}));}catch(error){check();fail('UNAUTHENTICATED',401);}
   const current=session(fact,info.intent,calledAt,now,shrink,check),ctx={...current.readContext,deadlineMs:Math.min(current.readContext.deadlineMs,cutoff)};
   shrink(ctx.deadlineMs);const options=clippedCommand(current.commandOptions,()=>cutoff,check);let result;
   if(info.intent==='query'){
    const context={...current.lookupContext,deadlineMs:Math.min(current.lookupContext.deadlineMs,cutoff)};prepareLookup(body.request,context,now());check();
    state.queryStarted=true;const stored=await lifetime.run(signal=>current.lookup.lookup({request:body.request,context,credential:current.lookupCredential,signal}));state.queryStored=true;check();
    result=await lifetime.run(signal=>current.lookup.read({resultReference:stored.resultReference,context:ctx,signal}));
    if(result.resultReference!==stored.resultReference||result.resultSha256!==stored.resultSha256)fail('RESULT_CORRELATION_REFUSED',502);
   }else if(info.intent==='draft'||info.intent==='prepare'){
    const flow=createActionFollowthrough({lookup:current.lookup,readContext:ctx,selectedClientId:current.selectedClientId,commandOptions:options,now,limits:{maxRequestMs:Math.max(1,cutoff-now()),maxFactBytes:bounds.maxResponseBytes}});check();
    if(info.intent==='draft')result=await lifetime.run(signal=>flow.draft(body.selection,body.edits??{},{signal}));
    else{state.prepareStarted=true;result=await lifetime.run(signal=>flow.prepare(body.draft,{signal}));}
   }else{
    const command=body.proposal?.command;commandToolValidators.assertCommandToolProposal('task.create',body.proposal,command?.arguments,{commandContext:options.commandContext});check();
    const authorized=data(await lifetime.run(signal=>current.authorizeExecution({proposal:body.proposal,signal,deadlineMs:cutoff})));own(authorized,['execution','credential']);validateShape('CommandExecutionRequest',authorized.execution);
    if(typeof authorized.credential!=='string'||!authorized.credential||!same(authorized.execution.executorBinding,current.readContext.currentBinding))fail('EXECUTION_AUTHORITY_REFUSED',403);check();
    const commands=createCommandToolInterface(options);state.executionStarted=true;
    result=await lifetime.run(async signal=>{const out=await commands.executeApproved(body.proposal,authorized.execution,authorized.credential,signal);if(out.status==='observed')state.knownResult=true;return out;});
   }
   check();const admitted=data(result),json=JSON.stringify(admitted);if(Buffer.byteLength(json)>bounds.maxResponseBytes)fail('RESPONSE_TOO_LARGE',413);check();
   return response(admitted);
  }catch(error){return errorResponse(error,state);}finally{lifetime?.close();}
 }});
}
