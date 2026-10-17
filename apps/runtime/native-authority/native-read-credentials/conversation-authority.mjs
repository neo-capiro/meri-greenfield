/** Private native conversation observation over the existing fixed authority HTTP client. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertAuthorityIdentityReceipt,assertAuthorityContextReceipt} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {assertCorePrincipal} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,SHA=/^[a-f0-9]{64}$/u;
const refuse=code=>{throw nativeReadFault(code);},same=(a,b)=>hash(a)===hash(b);

/** Closed private projection for the current CONTROL owner, without a credential or hash echo. */
export function assertNativeConversationAuthority(raw,{started,now,conversationId,clientId}){
 try{
  const v=data(own(raw,['principal','identityRevision','conversationId','selectedClientId','contextRevision','checkedAtMs','expiresAtMs']));
  assertAuthorityIdentityReceipt({principal:v.principal,identityRevision:v.identityRevision,checkedAtMs:v.checkedAtMs,expiresAtMs:v.expiresAtMs});assertCorePrincipal(v.principal);
  const at=now();
  if(!Number.isSafeInteger(started)||started<0||!Number.isSafeInteger(at)||at<started||v.checkedAtMs<started||v.checkedAtMs>at||v.expiresAtMs<=at||!SHA.test(v.identityRevision)||
   ![conversationId,clientId].every(id=>typeof id==='string'&&UUID.test(id))||v.conversationId!==conversationId||v.selectedClientId!==clientId||typeof v.contextRevision!=='string'||v.contextRevision.length<1||v.contextRevision.length>256)refuse('ACCESS_DENIED');
  return v;
 }catch(error){throw nativeReadFault(nativeReadFailureCode(error)??'ACCESS_DENIED');}
}

/** authorityClient is the borrowed, already constructed canonical HTTP adapter; never closed here. */
export function createConversationAuthorityReader({available,authorityClient,now,maxRequestMs}){
 const ports=authorityClient===null?null:own(authorityClient,['readIdentity','readContext']);
 if(typeof available!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000||available&&(!ports||Object.values(ports).some(method=>typeof method!=='function')))refuse('CONFIGURATION');
 return async function readConversation(raw){let life;try{
  if(!available)refuse('UNAVAILABLE');
  let call;try{call=own(raw,['credential','conversationId','clientId','deadlineMs'],['signal']);nativeSignal(call.signal);}catch{refuse('INVALID_ARGUMENTS');}
  if(typeof call.credential!=='string'||!/^\S{1,8192}$/u.test(call.credential)||!['conversationId','clientId'].every(key=>typeof call[key]==='string'&&UUID.test(call[key]))||!Number.isSafeInteger(call.deadlineMs))refuse('INVALID_ARGUMENTS');
  if(call.signal?.aborted)refuse('CANCELLED');
  const began=now();if(!Number.isSafeInteger(began)||began<0)refuse('ACCESS_DENIED');let authorityExpiry=call.deadlineMs,cutoff=Math.min(call.deadlineMs,began+maxRequestMs);
  life=createOperationLifetime({now,deadlineMs:cutoff,signal:call.signal,errorFactory:nativeReadFault});
  function fact(raw,validator,started){
   const receipt=validator(data(raw)),at=now();assertCorePrincipal(receipt.principal);
   if(!SHA.test(receipt.identityRevision)||!Number.isSafeInteger(at)||at<0||receipt.checkedAtMs<started||receipt.checkedAtMs>at||receipt.expiresAtMs<=at)refuse('ACCESS_DENIED');
   authorityExpiry=Math.min(authorityExpiry,receipt.expiresAtMs);cutoff=Math.min(cutoff,authorityExpiry);life.limitDeadline(cutoff);return receipt;
  }
  async function identify(){const started=now();return fact(await life.run(signal=>ports.readIdentity({credential:call.credential,deadlineMs:cutoff,signal})),assertAuthorityIdentityReceipt,started);}
  const before=await identify(),identitySha256=hash(before),started=now();
  const context=fact(await life.run(signal=>ports.readContext({credential:call.credential,identitySha256,conversationId:call.conversationId,clientId:call.clientId,deadlineMs:cutoff,signal})),assertAuthorityContextReceipt,started);
  if(!same(context.principal,before.principal)||context.identityRevision!==before.identityRevision||context.identitySha256!==identitySha256||context.conversationId!==call.conversationId||context.selectedClientId!==call.clientId)refuse('ACCESS_DENIED');
  const after=await identify();
  if(!same(after.principal,before.principal)||after.identityRevision!==before.identityRevision)refuse('ACCESS_DENIED');
  life.check();
  return assertNativeConversationAuthority({principal:after.principal,identityRevision:after.identityRevision,conversationId:context.conversationId,selectedClientId:context.selectedClientId,contextRevision:context.contextRevision,checkedAtMs:Math.min(before.checkedAtMs,context.checkedAtMs,after.checkedAtMs),expiresAtMs:authorityExpiry},{started:began,now,conversationId:call.conversationId,clientId:call.clientId});
 }catch(error){throw nativeReadFault(nativeReadFailureCode(error)??'UNAVAILABLE');}finally{life?.close();}};
}
