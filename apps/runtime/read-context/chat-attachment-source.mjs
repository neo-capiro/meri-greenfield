/** CONTROL-only source observation from the existing Core attachment owner. No credential or source ID is a grant. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,token=v=>typeof v==='string'&&/^[\x21-\x7e]{1,8192}$/u.test(v);
const refuse=code=>{throw nativeReadFault(code);},instant=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function assertChatAttachmentSource(raw,{binding,selectedClientId,sourceConversationId,started,now,deadlineMs}){
 try{const r=data(own(raw,['version','currentTurn','scope','asOf','checkedAtMs','expiresAtMs']));own(r.currentTurn,['conversationId','selectedClientId']);own(r.scope,['tenantId','userId','conversationId','clientId','conversationVersion']);
  if(r.version!==2||r.currentTurn.conversationId!==binding.conversationId||r.currentTurn.selectedClientId!==selectedClientId||r.scope.tenantId!==binding.tenantId||r.scope.userId!==binding.actorId||r.scope.conversationId!==sourceConversationId||r.scope.clientId!==selectedClientId||!UUID.test(sourceConversationId)||!instant(r.scope.conversationVersion)||!instant(r.asOf)||
   Date.parse(r.asOf)<started||Date.parse(r.asOf)>now()||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs!==Date.parse(r.asOf)||r.checkedAtMs<started||r.checkedAtMs>now()||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now()||r.expiresAtMs>deadlineMs||r.expiresAtMs>Date.parse(r.asOf)+30000)refuse('ACCESS_DENIED');return r;
 }catch{refuse('ACCESS_DENIED');}
}
export function createChatAttachmentSourceReader({available,origin,fetchImpl,now,maxRequestMs,binding,selectedClientId}){
 if(typeof available!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)refuse('CONFIGURATION');
 const base=origin===undefined?null:retainedOrigin(origin);if(available&&(!base||typeof fetchImpl!=='function'||!binding||selectedClientId!==null&&!UUID.test(selectedClientId)))refuse('CONFIGURATION');
 return async function readChatAttachmentSource(raw){let life,acquired;try{
  if(!available)refuse('UNAVAILABLE');const call=own(raw,['credential','serviceSecret','sourceConversationId','deadlineMs'],['signal']);nativeSignal(call.signal);
  if(!token(call.credential)||!token(call.serviceSecret)||typeof call.sourceConversationId!=='string'||!UUID.test(call.sourceConversationId)||!Number.isSafeInteger(call.deadlineMs))refuse('INVALID_ARGUMENTS');
  const started=now(),cutoff=Math.min(call.deadlineMs,started+maxRequestMs);life=createOperationLifetime({now,deadlineMs:cutoff,signal:call.signal,errorFactory:nativeReadFault});
  const body={version:2,currentTurn:{conversationId:binding.conversationId,selectedClientId},source:{kind:'clio_conversation',conversationId:call.sourceConversationId}};
  acquired=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(base+'/api/clio/attachments/read-context',{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
   headers:{authorization:'Bearer '+call.credential,'x-internal-service-secret':call.serviceSecret,'x-meri-deadline-at':String(cutoff),'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify(body)}));
   pending.then(response=>{if(life.signal.aborted)try{cancelBody(responseBody(response));}catch{}},()=>{});return pending;});
  if([401,403,404,409].includes(acquired.status))refuse('ACCESS_DENIED');if(acquired.status!==200||acquired.redirected)refuse('UNAVAILABLE');
  const result=assertChatAttachmentSource(await readJsonResponse(acquired,{lifetime:life,maxResponseBytes:4096}),{binding,selectedClientId,sourceConversationId:call.sourceConversationId,started,now,deadlineMs:cutoff});
  life.limitDeadline(result.expiresAtMs);life.check();return result;
 }catch(error){throw nativeReadFault(nativeReadFailureCode(error)??'UNAVAILABLE');}finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life?.close();}};
}
