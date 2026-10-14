/** Transport to the existing genuine task verifier; shape/correlation grants no authority. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization,runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
const fault=code=>Object.assign(Error(code),{code});
export function createNativeTaskAuthority(configuration){
 const {native,enabled=false,now=Date.now,maxRequestMs=3000}=own(configuration,[],['native','enabled','now','maxRequestMs']);
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw fault('WORKER_AUTHORITY_CONFIGURATION');
 const call=native===undefined?null:storageMethod(native,'call');
 return Object.freeze({async verify(value){let life,unavailable=false;try{
  if(!enabled||!call){unavailable=true;throw fault('WORKER_AUTHORITY_UNAVAILABLE');}
  const {capability,binding,operation,inputSha256,signal,deadlineMs}=own(value,['capability','binding','operation','inputSha256'],['signal','deadlineMs']);nativeSignal(signal);
  const pinned=data(binding);validateShape('RunBinding',pinned);
  if(typeof capability!=='string'||!/^\S{1,8192}$/u.test(capability)||typeof operation!=='string'||!(Object.hasOwn(runOwnerOperations,operation)||sdkSessionOperations.some(name=>operation==='runner/session/'+name))||typeof inputSha256!=='string'||!/^[a-f0-9]{64}$/u.test(inputSha256)||deadlineMs!==undefined&&!Number.isSafeInteger(deadlineMs))throw fault('WORKER_AUTHORITY_REFUSED');
  const started=now(),cutoff=Math.min(deadlineMs??started+maxRequestMs,started+maxRequestMs);
  life=createOperationLifetime({now,deadlineMs:cutoff,signal,errorFactory:()=>fault('WORKER_AUTHORITY_REFUSED')});
  const result=await life.run(signal=>call('worker/authorize',{capability,binding:pinned,operation,inputSha256},{signal,deadlineMs:cutoff}));
  const receipt=assertWorkerAuthorization(result,{binding:pinned,operation,inputSha256,started,now});life.limitDeadline(receipt.expiresAtMs);life.check();return receipt;
 }catch{throw fault(unavailable?'WORKER_AUTHORITY_UNAVAILABLE':'WORKER_AUTHORITY_REFUSED');}finally{life?.close();}}});
}
