/** Resolve the sending mailbox of a mail proposal from the actor's own Core sending mailboxes. Core rechecks the
 * mailbox owner and address at approval and again at send; this only selects the exact sender the user will review. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createNativeToolAuthorityClient} from '../read-context/core-client.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {nativeReadFailureCode} from '../../../packages/contracts/runtime-0.2/reads.mjs';
const deny=()=>{throw intentFault('ACCESS_DENIED','none');};
/** Plain field-path details the model can act on. The candidate addresses are the user's own sending addresses, listed so the
 * model can ask a closed question; identifiers never appear. */
const addresses=list=>{const text=list.join(', ');return text.length>240?`${text.slice(0,237)}...`:text;};
export const MAIL_SENDER_REFUSALS=Object.freeze({
 none:()=>'senderEmail: no connected mailbox can send; ask the user to connect Outlook or Gmail in Settings, Connections',
 unknown:list=>`senderEmail: no connected mailbox sends from this address; connected sending addresses: ${addresses(list)}. Ask the user which one to use`,
 several:list=>`senderEmail: several mailboxes are connected (${addresses(list)}); ask the user which address to send from and supply it`,
});
const refuse=(reason,list=[])=>{throw intentFault('INVALID_ARGUMENTS','none',MAIL_SENDER_REFUSALS[reason](list));};
export function createNativeMailSenderResolver({origin,nativeCredentials,fetchImpl=globalThis.fetch,now=Date.now,maxRequestMs=3000}){
 if(typeof nativeCredentials?.nativeCredentialFor!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1)throw intentFault('UNAVAILABLE');
 return async function resolveMailSender(raw){
  const v=own(raw,['binding','selectedClientId','deadlineMs'],['senderEmail','signal']);nativeSignal(v.signal);validateShape('RunBinding',v.binding);
  if(v.senderEmail!==undefined&&(typeof v.senderEmail!=='string'||!v.senderEmail.trim()||v.senderEmail.length>254)||!Number.isSafeInteger(v.deadlineMs))throw intentFault('INVALID_ARGUMENTS','none');
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs,now()+Math.min(maxRequestMs,3000)),errorFactory:code=>intentFault(code)});
  const borrow=()=>{const token=data(own(nativeCredentials.nativeCredentialFor({binding:v.binding,selectedClientId:v.selectedClientId,signal:life.signal}),['credential','expiresAtMs']));
   if(typeof token.credential!=='string'||!/^\S{1,8192}$/u.test(token.credential)||!Number.isSafeInteger(token.expiresAtMs)||token.expiresAtMs<=now())deny();life.limitDeadline(token.expiresAtMs);return token;};
  try{
   const first=borrow(),call={credential:first.credential,deadlineMs:Math.min(v.deadlineMs,first.expiresAtMs,now()+Math.min(maxRequestMs,3000))};
   const core=createNativeToolAuthorityClient({origin,fetchImpl,now,enabled:true,maxRequestMs:Math.min(maxRequestMs,3000),binding:v.binding,selectedClientId:v.selectedClientId});
   const current=await life.run(signal=>core.readCurrent({...call,signal}));
   // Core's own sending predicate: connected, owned by the caller, holding a token and an address.
   const sending=await life.run(signal=>core.readSendingMailboxes({...call,signal}));
   if(hash(current.principal)!==hash({tenantId:v.binding.tenantId,actorId:v.binding.actorId})||borrow().credential!==first.credential)deny();
   const wanted=v.senderEmail?.trim().toLowerCase(),matches=wanted===undefined?sending:sending.filter(m=>m.accountEmail===wanted);
   const candidates=[...new Set(sending.map(m=>m.accountEmail))];
   if(!sending.length)refuse('none');
   if(!matches.length)refuse('unknown',candidates);
   if(matches.length>1)refuse('several',candidates);
   life.check();
   return data({senderConnectionId:matches[0].id,senderEmail:matches[0].accountEmail});
  }catch(error){
   if(error?.code==='INVALID_ARGUMENTS'&&error.effect==='none')throw error;
   const code=nativeReadFailureCode(error)??error?.code;
   throw intentFault(['ACCESS_DENIED','DEADLINE','CANCELLED'].includes(code)?code:'UNAVAILABLE','none');
  }finally{life.close();}
 };
}
