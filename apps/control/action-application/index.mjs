/** Attended recommendation reads, reviewed drafts and explicit native task approval. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {CommandError,data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeApprovalProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {requestInfo,jsonBody,response,errorResponse,fail} from './http.mjs';
import {session} from './session.mjs';
export function createActionApplication(configuration){
 const {resolveSession,now,limits}=own(configuration,['resolveSession','now','limits']),bounds=data(limits);own(bounds,['maxRequestMs','maxRequestBytes','maxResponseBytes']);
 if(typeof resolveSession!=='function'||typeof now!=='function'||Object.values(bounds).some(x=>!Number.isSafeInteger(x)||x<1)||bounds.maxRequestMs>60000||bounds.maxRequestBytes>16*1024*1024||bounds.maxResponseBytes>16*1024*1024)fail('APPLICATION_CONFIGURATION',500);
 return Object.freeze({async handle(request){
  let lifetime;const state={};
  try{
   const info=requestInfo(request),start=now();if(!Number.isSafeInteger(start)||start<0)fail('APPLICATION_CLOCK',500);
   let cutoff=start+bounds.maxRequestMs;
   lifetime=createOperationLifetime({deadlineMs:cutoff,now,signal:info.signal,errorFactory:code=>new CommandError(code)});
   const check=lifetime.check,shrink=next=>{cutoff=Math.min(cutoff,next);lifetime.limitDeadline(cutoff);check();};
   const body=data(await jsonBody(info,bounds.maxRequestBytes,lifetime,check));
   own(body,info.intent==='query'?['request']:info.intent==='draft'?['selection']:info.intent==='prepare'?['requestId','draft']:['proposal'],info.intent==='draft'?['edits']:[]);
   if(info.intent==='prepare'&&(typeof body.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(body.requestId)))fail('INVALID_REQUEST');check();
   const calledAt=now();let fact;
   try{fact=await lifetime.run(signal=>resolveSession({credential:info.credential,intent:info.intent,signal,deadlineMs:cutoff}));}catch{check();fail('UNAUTHENTICATED',401);}
   const current=session(fact,calledAt,now,shrink);let result;
   if(info.intent==='query'){
    state.queryStarted=true;result=await lifetime.run(async signal=>{const out=await current.query({...body,signal});state.queryStored=true;return out;});
   }else if(info.intent==='draft')result=await lifetime.run(signal=>current.draft({...body,signal}));
   else if(info.intent==='prepare'){
    state.prepareStarted=true;result=await lifetime.run(async signal=>{const out=await current.prepare({requestId:body.requestId,arguments:body.draft,signal});state.knownResult=true;return out;});
   }else{
    assertNativeApprovalProposal(body.proposal);
    if(body.proposal.command.action!=='task.create'||['tenantId','actorId','conversationId'].some(k=>body.proposal.command.binding[k]!==current.binding[k]))fail('SESSION_SCOPE_REFUSED',403);
    check();state.executionStarted=true;
    result=await lifetime.run(async signal=>{const out=await current.execute({proposal:body.proposal,signal,deadlineMs:cutoff});if(out.status==='observed'||out.status==='not_executed')state.knownResult=true;return out;});
   }
   check();const admitted=data(result);if(Buffer.byteLength(JSON.stringify(admitted))>bounds.maxResponseBytes)fail('RESPONSE_TOO_LARGE',413);check();
   return await lifetime.run(signal=>current.release(()=>response(admitted),{signal,deadlineMs:cutoff}));
  }catch(error){return errorResponse(error,state);}finally{lifetime?.close();}
 }});
}
