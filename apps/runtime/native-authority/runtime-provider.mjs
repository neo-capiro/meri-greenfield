/** Fixed original runtime plan; current native task/admission required for every read. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {executionFault} from './execution-broker.mjs';
/** Shared inert validation before any allocation or borrowed-port invocation. */
export function compileNativeRuntimePlan(value){
 const r=data(own(value,['binding','versions','proxyUrl','proxyCredential','model','deadlineMs','maxTurns','maxCostMicroUSD','maxOutputBytes'],['sdkSessionKey']));
 validateShape('RunBinding',r.binding);validateShape('RuntimeVersions',r.versions);let url;
 try{url=new URL(r.proxyUrl);}catch{throw executionFault('RUNTIME_CONFIGURATION');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||typeof r.proxyCredential!=='string'||!/^\S{1,8192}$/u.test(r.proxyCredential)||typeof r.model!=='string'||!r.model||r.model.length>256||
  ['deadlineMs','maxTurns','maxCostMicroUSD','maxOutputBytes'].some(k=>!Number.isSafeInteger(r[k])||r[k]<1)||r.maxTurns>100||r.maxOutputBytes>1048576||r.versions.sdk!=='0.3.295'||r.versions.cli!=='2.1.295')throw executionFault('RUNTIME_CONFIGURATION');
 return r;
}
export function createNativeRuntimeProvider(configuration){
 const c=own(configuration,['broker','runtime','admission','taskCapabilitySha256'],['enabled','continuation']),r=compileNativeRuntimePlan(c.runtime),enabled=c.enabled??false,current=storageMethod(c.broker,'current'),allocation=storageMethod(c.admission,'currentAllocation');
 if(c.broker.taskCapabilitySha256!==c.taskCapabilitySha256||typeof enabled!=='boolean'||typeof c.taskCapabilitySha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.taskCapabilitySha256))throw executionFault('RUNTIME_CONFIGURATION');
 const continuation=c.continuation?storageMethod(c.continuation,'prepare'):null;
 return Object.freeze({async runtime(value){const input=own(value,['binding','versions'],['signal','continuation','nextTurn','sourceRequest','request','scopes']);nativeSignal(input.signal);if(!enabled||hash(data(input.binding))!==hash(r.binding)||hash(data(input.versions))!==hash(r.versions))throw executionFault('RUNTIME_REFUSED');
  const observed=await current({binding:r.binding,executionId:hash(r.binding),signal:input.signal});
  if(hash(observed.run.versions)!==hash(r.versions)||observed.record.expiresAtMs!==r.deadlineMs)throw executionFault('RUNTIME_REFUSED');
  const admitted=data(JSON.parse(await allocation(r.binding,{signal:input.signal})));const budgets=admitted.allocation.budgets;
  if(hash(admitted.binding)!==hash(r.binding)||admitted.deadlineMs<r.deadlineMs||r.maxTurns>budgets.maxTurns||r.maxCostMicroUSD>budgets.maxCostMicroUSD||r.maxOutputBytes>budgets.maxOutputBytes)throw executionFault('RUNTIME_BUDGET_REFUSED');
  if(!continuation&&['continuation','nextTurn','sourceRequest','request','scopes'].some(k=>Object.hasOwn(input,k)))throw executionFault('CONTINUATION_REFUSED');
  let restored;try{
   restored=continuation?await continuation(input):null;
   if(restored&&restored.restoreReceipt.expiresAtMs>r.deadlineMs)throw executionFault('CONTINUATION_REFUSED');
  }finally{await current({binding:r.binding,executionId:hash(r.binding),signal:input.signal});}
  return data({...r,...(restored??{sdkSessionKey:r.sdkSessionKey??null})});
 },taskCapabilitySha256:c.taskCapabilitySha256});
}
