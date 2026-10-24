/** Run preparation facts only. Model/provider/limits come from the existing tenant settings owner. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {executionFault} from './remote-task-boundary.mjs';
/** Shared inert validation before any allocation or borrowed-port invocation. */
export function compileNativeRuntimePlan(value){
 const r=data(own(value,['binding','versions','deadlineMs','maxOutputBytes'],['sdkSessionKey']));
 validateShape('RunBinding',r.binding);validateShape('RuntimeVersions',r.versions);
 if(['deadlineMs','maxOutputBytes'].some(k=>!Number.isSafeInteger(r[k])||r[k]<1)||r.maxOutputBytes>1048576||r.versions.sdk!=='0.3.295'||r.versions.cli!=='2.1.295')throw executionFault('RUNTIME_CONFIGURATION');
 return r;
}
export function createNativeRuntimeProvider(configuration){
 const c=own(configuration,['runtime','admission','taskCapabilitySha256'],['enabled','continuation']),r=compileNativeRuntimePlan(c.runtime),enabled=c.enabled??false,current=storageMethod(c.admission,'currentRun');
 if(typeof enabled!=='boolean'||typeof c.taskCapabilitySha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.taskCapabilitySha256))throw executionFault('RUNTIME_CONFIGURATION');
 const continuation=c.continuation?storageMethod(c.continuation,'prepare'):null;
 return Object.freeze({async runtime(value){const input=own(value,['binding','versions'],['signal','continuation','nextTurn','sourceRequest','request','scopes']);nativeSignal(input.signal);if(!enabled||hash(data(input.binding))!==hash(r.binding)||hash(data(input.versions))!==hash(r.versions))throw executionFault('RUNTIME_REFUSED');
  const observed=data(JSON.parse(await current(r.binding,{signal:input.signal})));
  if(hash(observed.binding)!==hash(r.binding)||observed.deadlineMs<r.deadlineMs)throw executionFault('RUNTIME_REFUSED');
  if(!continuation&&['continuation','nextTurn','sourceRequest','request','scopes'].some(k=>Object.hasOwn(input,k)))throw executionFault('CONTINUATION_REFUSED');
  let restored;try{
   restored=continuation?await continuation(input):null;
   if(restored?.restoreReceipt&&restored.restoreReceipt.expiresAtMs>r.deadlineMs)throw executionFault('CONTINUATION_REFUSED');
  }finally{await current(r.binding,{signal:input.signal});}
  return data({...r,...(restored??{sdkSessionKey:r.sdkSessionKey??null})});
 },taskCapabilitySha256:c.taskCapabilitySha256});
}
