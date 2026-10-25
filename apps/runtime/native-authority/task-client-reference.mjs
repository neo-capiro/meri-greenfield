/** Resolve task destinations through the existing attended Core client-reference owner. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createNativeToolAuthorityClient} from '../read-context/core-client.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {nativeReadFailureCode} from '../../../packages/contracts/runtime-0.2/reads.mjs';
const same=(a,b)=>hash(a)===hash(b),deny=()=>{throw intentFault('ACCESS_DENIED','none');};
export function createNativeTaskClientResolver({origin,nativeCredentials,fetchImpl=globalThis.fetch,now=Date.now,maxRequestMs=3000}){
 if(typeof nativeCredentials?.nativeCredentialFor!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1)throw intentFault('UNAVAILABLE');
 return async function resolveClientReference(raw){
  const v=own(raw,['binding','selectedClientId','reference','deadlineMs'],['signal']);nativeSignal(v.signal);validateShape('RunBinding',v.binding);
  if(typeof v.reference!=='string'||!v.reference.trim()||v.reference.trim()!==v.reference||v.reference.length>80||!Number.isSafeInteger(v.deadlineMs))throw intentFault('INVALID_ARGUMENTS');
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs,now()+Math.min(maxRequestMs,3000)),errorFactory:code=>intentFault(code)});
  const borrow=()=>{const token=data(own(nativeCredentials.nativeCredentialFor({binding:v.binding,selectedClientId:v.selectedClientId,signal:life.signal}),['credential','expiresAtMs']));
   if(typeof token.credential!=='string'||!/^\S{1,8192}$/u.test(token.credential)||!Number.isSafeInteger(token.expiresAtMs)||token.expiresAtMs<=now())deny();life.limitDeadline(token.expiresAtMs);return token;};
  try{
   const first=borrow(),deadlineMs=Math.min(v.deadlineMs,first.expiresAtMs,now()+Math.min(maxRequestMs,3000));
   const core=createNativeToolAuthorityClient({origin,fetchImpl,now,enabled:true,maxRequestMs:Math.min(maxRequestMs,3000),binding:v.binding,selectedClientId:v.selectedClientId});
   const call={credential:first.credential,deadlineMs};
   const before=await life.run(signal=>core.readCurrent({...call,signal}));
   const resolved=await life.run(signal=>core.readClientReference({...call,reference:v.reference,signal}));
   const after=await life.run(signal=>core.readCurrent({...call,signal}));
   const principal={tenantId:v.binding.tenantId,actorId:v.binding.actorId},final=borrow();
   if(!same(before.principal,principal)||!same(resolved.principal,principal)||!same(after.principal,principal)||
    before.identityRevision!==resolved.identityRevision||after.identityRevision!==resolved.identityRevision||
    !before.clientIds?.includes(resolved.clientId)||!after.clientIds?.includes(resolved.clientId)||
    v.selectedClientId!==null&&resolved.clientId!==v.selectedClientId||final.credential!==first.credential)deny();
   const expiresAtMs=Math.min(deadlineMs,before.expiresAtMs,resolved.expiresAtMs,after.expiresAtMs,final.expiresAtMs);life.limitDeadline(expiresAtMs);life.check();
   return data({reference:v.reference,clientId:resolved.clientId,checkedAtMs:now(),expiresAtMs});
  }catch(error){
   const code=nativeReadFailureCode(error)??error?.code;
   throw intentFault(['ACCESS_DENIED','INVALID_ARGUMENTS','DEADLINE','CANCELLED'].includes(code)?code:'UNAVAILABLE','none');
  }finally{life.close();}
 };
}
