/** Task-update transport over attended preparation and the canonical native approval/effect owner. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {isAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {CommandError,own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertTaskUpdateProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {jsonBody,response,errorResponse,fail} from '../action-application/http.mjs';
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
   const body=data(await jsonBody(info,bounds.maxRequestBytes,life,life.check));own(body,info.intent==='prepare'?['requestId','arguments']:['proposal']);
   if(info.intent==='prepare'&&(typeof body.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(body.requestId)))fail('INVALID_REQUEST');life.check();
   const started=now();let raw;
   try{raw=await life.run(signal=>resolveSession({credential:info.credential,intent:info.intent,signal,deadlineMs:cutoff}));}
   catch(error){life.check();if(isAuthorityUnavailable(error))fail('UNAVAILABLE',502);fail('UNAUTHENTICATED',401);}
   const session=taskSession(raw,info.intent,started,now,shrink);
   let result;
   if(info.intent==='prepare'){
    state.prepareStarted=true;result=await life.run(async signal=>{const out=await session.prepare({...body,signal,deadlineMs:cutoff});state.knownResult=true;return out;});
   }else{
    assertTaskUpdateProposal(body.proposal,{binding:body.proposal?.command?.binding});
    if(['tenantId','actorId','conversationId'].some(k=>body.proposal.command.binding[k]!==session.binding[k]))fail('SESSION_SCOPE_REFUSED',403);
    life.check();state.executionStarted=true;
    result=await life.run(async signal=>{const out=await session.execute({proposal:body.proposal,signal,deadlineMs:cutoff});if(out.status==='observed'||out.status==='not_executed')state.knownResult=true;return out;});
   }
   life.check();const admitted=data(result);if(Buffer.byteLength(JSON.stringify(admitted))>bounds.maxResponseBytes)fail('RESPONSE_TOO_LARGE',413);life.check();
   return await life.run(signal=>session.release(()=>response(admitted),{signal,deadlineMs:cutoff}));
  }catch(error){return errorResponse(error,state);}finally{life?.close();}
 }});
}
