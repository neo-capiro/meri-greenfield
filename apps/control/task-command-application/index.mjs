/** Unmounted Fetch application for task-update proposals. The existing approval store and command executor decide effects. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {CommandError,own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertTaskUpdateProposal,assertTaskUpdateExecution} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {jsonBody,response,errorResponse,fail} from '../action-application/http.mjs';
import {clippedCommand} from '../action-application/session.mjs';
import {taskRequest} from './http.mjs';
import {taskSession} from './session.mjs';
export function createTaskCommandApplication(configuration){
 const {resolveSession,now,limits}=own(configuration,['resolveSession','now','limits']),bounds=data(limits);
 own(bounds,['maxRequestMs','maxRequestBytes','maxResponseBytes']);
 if(typeof resolveSession!=='function'||typeof now!=='function'||Object.values(bounds).some(v=>!Number.isSafeInteger(v)||v<1)||bounds.maxRequestMs>60000||bounds.maxRequestBytes>16777216||bounds.maxResponseBytes>16777216)fail('APPLICATION_CONFIGURATION',500);
 return Object.freeze({async handle(request){
  let life;const state={};
  try{
   const info=taskRequest(request),at=now();if(!Number.isSafeInteger(at)||at<0)fail('APPLICATION_CLOCK',500);
   let cutoff=at+bounds.maxRequestMs;
   life=createOperationLifetime({deadlineMs:cutoff,now,signal:info.signal,errorFactory:code=>new CommandError(code)});
   const shrink=next=>{cutoff=Math.min(cutoff,next);life.limitDeadline(cutoff);life.check();};
   const body=data(await jsonBody(info,bounds.maxRequestBytes,life,life.check));own(body,[info.intent==='prepare'?'arguments':'proposal']);life.check();
   const started=now();let raw;
   try{raw=await life.run(signal=>resolveSession({credential:info.credential,intent:info.intent,signal,deadlineMs:cutoff}));}
   catch{life.check();fail('UNAUTHENTICATED',401);}
   const session=taskSession(raw,info.intent,started,now,shrink),options=clippedCommand(session.commandOptions,()=>cutoff,life.check),commands=createCommandToolInterface(options);
   let result;
   if(info.intent==='prepare'){
    state.prepareStarted=true;result=await life.run(async signal=>{const out=await commands.prepare(body.arguments,{signal});state.knownResult=true;return out;});
   }else{
    assertTaskUpdateProposal(body.proposal,options.commandContext);life.check();
    const authorization=data(await life.run(signal=>session.authorizeExecution({proposal:body.proposal,signal,deadlineMs:cutoff})));
    own(authorization,['execution','credential']);assertTaskUpdateExecution(body.proposal,authorization.execution,options.commandContext);
    if(typeof authorization.credential!=='string'||!authorization.credential||canonicalSha256(authorization.execution.executorBinding)!==canonicalSha256(session.binding))fail('EXECUTION_AUTHORITY_REFUSED',403);
    life.check();state.executionStarted=true;
    result=await life.run(async signal=>{const out=await commands.executeApproved(body.proposal,authorization.execution,authorization.credential,signal);if(out.status==='observed')state.knownResult=true;return out;});
   }
   life.check();const admitted=data(result);if(Buffer.byteLength(JSON.stringify(admitted))>bounds.maxResponseBytes)fail('RESPONSE_TOO_LARGE',413);life.check();return response(admitted);
  }catch(error){return errorResponse(error,state);}finally{life?.close();}
 }});
}
