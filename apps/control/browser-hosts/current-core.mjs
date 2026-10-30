/** Reuse the current native credential and Core client. No credential storage,
 * renewal or alternate identity/policy authority lives here. */
import {currentReceipt} from '../action-host/application-adapters/current-receipt.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {fail} from './allocation.mjs';
export function createCurrentBrowserCoreAccess({core,nativeCredentials,now}){
 const readCurrent=storageMethod(core,'readCurrent'),nativeCredentialFor=storageMethod(nativeCredentials,'nativeCredentialFor');
 return async({binding,selectedClientId,life})=>{
  const before=await life.run(signal=>nativeCredentialFor({binding,selectedClientId,signal}));
  if(typeof before?.credential!=='string'||!before.credential||!Number.isSafeInteger(before.expiresAtMs)||before.expiresAtMs<=now())fail();
  life.limitDeadline(before.expiresAtMs);const started=now();
  const authority=currentReceipt(await life.run(signal=>readCurrent({credential:before.credential,conversationId:binding.conversationId,clientId:selectedClientId,signal,deadlineMs:life.deadline()})));
  if(authority.principal.tenantId!==binding.tenantId||authority.principal.actorId!==binding.actorId||
   authority.conversationId!==binding.conversationId||authority.selectedClientId!==selectedClientId||
   authority.checkedAtMs<started||authority.checkedAtMs>now())fail();
  life.limitDeadline(authority.expiresAtMs);
  const recheck=async()=>{
   const after=await life.run(signal=>nativeCredentialFor({binding,selectedClientId,signal}));
   if(after?.credential!==before.credential||!Number.isSafeInteger(after.expiresAtMs)||after.expiresAtMs<=now())fail();
   life.limitDeadline(after.expiresAtMs);life.check();return after.expiresAtMs;
  };
  const expiresAtMs=Math.min(authority.expiresAtMs,before.expiresAtMs,await recheck());
  return Object.freeze({receipt:Object.freeze({...authority,expiresAtMs}),recheck});
 };
}
