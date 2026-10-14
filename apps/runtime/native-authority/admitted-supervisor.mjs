/** One canonical admission owner shared by control, task verifier and launch preparation. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {createPostgresAdmittedRunOwner} from '../../gateway/budget/admitted-run-owner.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {createNativeIdentityContext} from './identity-context.mjs';
import {createNativeTaskVerifier,taskFault} from './task-verifier.mjs';
import {createNativeTaskVerifierApplication} from './task-verifier-http.mjs';
import {compileNativeLaunch} from './launch-configuration.mjs';
import {createNativeSessionLauncher} from './session-launcher.mjs';
import {createDurableSdkSessionOwner} from './session-owner.mjs';
export function createAdmittedSessionSupervisor(configuration){
 const c=own(configuration,['pool','allocationJson','grantFactsJsons','grantId','identity','operations','callerCapabilitySha256','launchConfiguration','limits'],['enabled','now']);
 const enabled=c.enabled??false,now=c.now??Date.now,i=own(c.identity,['origin','commandContext','fetchImpl','credential']),limits=data(own(c.limits,['maxRequestMs','maxFactBytes']));
 const commandContext=data(i.commandContext);own(commandContext,['binding','clientResolution']);
 const pinned=compileNativeLaunch(c.launchConfiguration),{facts}=parseAdmittedGrantSet(c),grant=facts.find(f=>f.grantId===c.grantId);
 if(!grant||facts.some(f=>f.capabilitySha256===c.callerCapabilitySha256)||hash(grant.binding)!==hash(pinned.binding)||hash(commandContext.binding)!==hash(pinned.binding))throw taskFault('CONFIGURATION');
 const admission=createPostgresAdmittedRunOwner({pool:c.pool,allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons,namespace:'product',limits,now});
 const identityContext=createNativeIdentityContext({origin:i.origin,commandContext,fetchImpl:i.fetchImpl,currentOwner:{currentRun:admission.currentTaskRun},enabled,now,limits});
 const preparation=new AbortController();
 const taskVerifier=createNativeTaskVerifier({allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons,grantId:c.grantId,identityCredential:i.credential,currentOwner:admission,identityContext,operations:c.operations,expiresAtMs:pinned.expiresAtMs,enabled,now,maxRequestMs:limits.maxRequestMs,signal:preparation.signal});
 const application=createNativeTaskVerifierApplication({verifier:taskVerifier,callerCapabilitySha256:c.callerCapabilitySha256,taskCapabilitySha256:grant.capabilitySha256,enabled,now,maxRequestMs:limits.maxRequestMs});
 let prepared=false,closed=false,launcher;
 // Stable read port may be mounted before launch; it cannot install a witness.
 const registration=Object.freeze({read(value){if(closed||!launcher)throw taskFault('UNAVAILABLE');return launcher.registration.read(value);}});
 const sdkSessionOwner=createDurableSdkSessionOwner({admission,authority:taskVerifier,registration,enabled,now,maxRequestMs:limits.maxRequestMs});
 async function prepareLaunch(value){
  const input=own(value,['capability'],['signal']);nativeSignal(input.signal);
  if(!enabled||!pinned.enabled||closed||prepared)throw taskFault('UNAVAILABLE');prepared=true;
  const operation='load',inputSha256=hash({binding:pinned.binding}),started=now();
  const signal=AbortSignal.any([preparation.signal,input.signal,pinned.signal].filter(Boolean));
  const receipt=assertWorkerAuthorization(await taskVerifier.verify({capability:input.capability,binding:pinned.binding,operation,inputSha256,signal}),{binding:pinned.binding,operation,inputSha256,started,now});
  if(closed||input.signal?.aborted||pinned.signal?.aborted||now()>=Math.min(pinned.expiresAtMs,receipt.expiresAtMs))throw taskFault('REFUSED');
  launcher=createNativeSessionLauncher({binding:pinned.binding,workspace:pinned.workspace,configDirectory:pinned.configDirectory,...(pinned.secureStorageDirectory!==pinned.configDirectory?{secureStorageDirectory:pinned.secureStorageDirectory}:{}),launch:pinned.launch,versions:pinned.versions,executableSha256:pinned.executableSha256,
   shutdownMs:pinned.shutdownMs,limits:pinned.limits,expiresAtMs:Math.min(pinned.expiresAtMs,receipt.expiresAtMs),enabled:true,now,
   ...(input.signal||pinned.signal?{signal:AbortSignal.any([input.signal,pinned.signal].filter(Boolean))}:{})});
  return launcher;
 }
 return Object.freeze({admission,identityContext,taskVerifier,application,prepareLaunch,registration,productPorts:Object.freeze({identityContext,sdkSessionOwner}),
  async close(){closed=true;preparation.abort();return launcher?.close();},status:()=>Object.freeze({prepared,closed,launcher:launcher?.status()??null})});
}
