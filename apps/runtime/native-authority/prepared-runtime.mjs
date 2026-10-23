/** Existing admitted task owner. The runner calls the native SDK directly after admission. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {compileNativeTaskPlan} from './task-allocator.mjs';
import {createNativeRuntimeProvider} from './runtime-provider.mjs';
import {executionFault} from './remote-task-boundary.mjs';
import {capabilityDigest} from './task-verifier.mjs';
export function createPreparedNativeRuntime(configuration){
 const c=own(configuration,['store','allocator','supervisor','runtime','plan','preparationIntent','taskCapability','verifyTask'],['continuation','enabled','now','maxRequestMs']);
 const now=c.now??Date.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000,compiled=compileNativeTaskPlan({runtime:c.runtime,plan:c.plan,preparationIntent:c.preparationIntent}),{original,runtime,preparationIntent}=compiled;
 const allocate=storageMethod(c.allocator,'allocate'),retire=storageMethod(c.allocator,'stop'),read=storageMethod(c.store.allocations,'read'),verify=storageMethod(c.supervisor.taskVerifier,'verify');
 if(typeof enabled!=='boolean'||typeof now!=='function'||typeof c.verifyTask!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw executionFault('PREPARATION_CONFIGURATION');
 const key={binding:original.binding,allocationKey:original.executionKey};let admitted,allocating,closed=false;
 const same=(a,b)=>hash(a)===hash(b),check=signal=>{if(!enabled||closed||signal?.aborted||now()>=original.expiresAtMs)throw executionFault('PREPARATION_REFUSED');};
 async function operation(signal,body){nativeSignal(signal);const life=createOperationLifetime({now,signal,deadlineMs:Math.min(now()+maxRequestMs,original.expiresAtMs),errorFactory:()=>executionFault('PREPARATION_UNKNOWN')});try{check(signal);return await body(life);}finally{life.close();}}
 async function current(life){
  const started=now(),receipt=assertWorkerAuthorization(await life.run(signal=>verify({capability:c.taskCapability,binding:original.binding,operation:'load',inputSha256:hash({binding:original.binding}),signal})),{binding:original.binding,operation:'load',inputSha256:hash({binding:original.binding}),started,now});
  // Every operation re-verifies against the admitted run; a receipt must be valid now (it never outlives the run or grant lease).
  if(receipt.expiresAtMs<=now()||hash({scopes:receipt.scopes,selectedClientId:receipt.selectedClientId,policyRevision:receipt.policyRevision})!==preparationIntent.authoritySha256)throw executionFault('PREPARATION_REFUSED');
  const saved=await life.run(()=>read(key,life.check));if(saved.record?.state!=='ADMITTED'||!same(saved.record.original,original)||!admitted||saved.record.resource.taskArn!==admitted.resource.taskArn)throw executionFault('PREPARATION_REFUSED');
  const began=now(),proof=data(own(await life.run(signal=>c.verifyTask({original,resource:saved.record.resource,signal})),['taskArn','imageSha256','runnerSha256','checkedAtMs','expiresAtMs']));
  if(proof.taskArn!==saved.record.resource.taskArn||proof.imageSha256!==preparationIntent.imageSha256||proof.runnerSha256!==preparationIntent.runnerSha256||!Number.isSafeInteger(proof.checkedAtMs)||proof.checkedAtMs<began||proof.checkedAtMs>now()||!Number.isSafeInteger(proof.expiresAtMs)||proof.expiresAtMs<original.expiresAtMs)throw executionFault('PREPARATION_REFUSED');
  life.check();check(life.signal);return {saved,receipt};
 }
 async function prepareAllocation({signal}={}){if(allocating||closed)throw executionFault('PREPARATION_REFUSED');if(admitted)return admitted;allocating=true;try{admitted=await allocate({signal});return admitted;}finally{allocating=false;}}
 const provider=createNativeRuntimeProvider({runtime,admission:c.supervisor.admission,taskCapabilitySha256:capabilityDigest(c.taskCapability),enabled,...(c.continuation?{continuation:c.continuation}:{})});
 const runtimePort=Object.freeze({taskCapabilitySha256:provider.taskCapabilitySha256,async runtime(value){return operation(value.signal,async life=>{await current(life);const result=await life.run(signal=>provider.runtime({...value,signal}));await current(life);return result;});}});
 const preparationAuthorizer=Object.freeze({async admitted(value){const v=own(value,['original'],['signal']);if(!same(v.original,original))throw executionFault('PREPARATION_REFUSED');return operation(v.signal,async life=>{await current(life);return {original,taskArn:admitted.resource.taskArn,checkedAtMs:now(),expiresAtMs:original.expiresAtMs};});}});
 return Object.freeze({original,plan:compiled.plan,prepareAllocation,runtime:runtimePort,preparationAuthorizer,async close(){closed=true;await retire();}});
}
