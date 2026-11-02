// @ts-check
/** Browser-only host helpers composed by apps/runtime/browser-host-service/composition.mjs: admitted private-workspace
 * preparation after an authenticated browser-purpose currentness read, and the measured workspace readback that must
 * complete before the process observer is armed. Importing this module is inert. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readBrowserWorkspaceIsolation,BROWSER_WORKSPACE_READBACK_SCHEMA} from '../browser-workspace/readback.mjs';
import {prepareBrowserWorkspace} from '../browser-workspace/prepare.mjs';
import {assertBrowserHostCurrent} from '../binding.mjs';

const fault=(code,cause)=>Object.assign(new Error(code),{code,...(cause?{cause}:{})});
const fail=code=>{throw fault(code);};
const stopped=signal=>{if(signal?.aborted)fail('HOST_BOOTSTRAP_REVOKED');};
/** Admit private-state preparation only after an authenticated browser-purpose read for this policy digest. */
export async function prepareAdmittedBrowserWorkspace({allocation,binding,cwd,paths,browserClient,
 policySha256,maxFreshMs,now,signal,sdkUid,sdkGid,browserUid,browserGid,
 prepare=prepareBrowserWorkspace}){
 if(typeof browserClient?.readCurrent!=='function'||typeof prepare!=='function'||typeof now!=='function')
  fail('HOST_BROWSER_WORKSPACE_PREP_REFUSED');
 const current=await browserClient.readCurrent({allocation:structuredClone(allocation),
  binding:structuredClone(binding),policySha256,signal});
 assertBrowserHostCurrent({allocation,binding,policySha256,current,nowMs:now(),maxFreshMs});
 stopped(signal);
 // Synchronous root-only preparation finishes before either native launcher is constructed.
 const prepared=prepare({cwd,conversationId:binding.conversationId,sdkUid,sdkGid,browserUid,browserGid});
 if(prepared?.cwd!==cwd||!Object.keys(paths).every(key=>prepared.paths?.[key]===paths[key])||
  !/^[1-9][0-9]*$/u.test(prepared.cwdInode)||
  !/^[1-9][0-9]*$/u.test(prepared.stateInode))fail('HOST_BROWSER_WORKSPACE_PREP_REFUSED');
 return prepared;
}
/** The native broker waits at preexec READY until this exact readback and process-observer arm both complete. */
export async function armBrowserAfterWorkspaceReadback({allocation,binding,hostIdentity,cwd,paths,
 browserUid,browserGid,sdkUid,sdkGid,leaderPid,browserObserver,preparedWorkspace,
 readWorkspace=readBrowserWorkspaceIsolation,now=Date.now}){
 if(typeof readWorkspace!=='function'||typeof browserObserver?.arm!=='function'||typeof now!=='function')
  fail('HOST_BROWSER_WORKSPACE_UNPROVEN');
 const receipt=await readWorkspace({allocation,binding,hostIdentity,cwd,paths,
  browserUid,browserGid,sdkUid,sdkGid,leaderPid});
 let observed;try{observed=data(receipt);}catch{fail('HOST_BROWSER_WORKSPACE_UNPROVEN');}
 const at=now();
 if(observed?.schema!==BROWSER_WORKSPACE_READBACK_SCHEMA||
  observed.allocationSha256!==canonicalSha256(allocation)||
  observed.bindingSha256!==canonicalSha256(binding)||
  observed.hostIdentitySha256!==canonicalSha256(hostIdentity)||
  observed.cwd!==cwd||observed.profile!==paths.profile||observed.output!==paths.output||
  observed.home!==paths.home||observed.browserUid!==browserUid||
  observed.browserGid!==browserGid||observed.sdkUid!==sdkUid||observed.sdkGid!==sdkGid||
  observed.leaderPid!==leaderPid||typeof observed.browserMountNamespace!=='string'||
  !/^mnt:\[[1-9][0-9]*\]$/u.test(observed.browserMountNamespace)||
  !/^[1-9][0-9]*$/u.test(observed.browserStartTicks)||
  !/^[1-9][0-9]*$/u.test(observed.overlayMountId)||
  !/^[1-9][0-9]*$/u.test(observed.stateMountId)||
  observed.overlayMountId===observed.stateMountId||
  !/^[1-9][0-9]*$/u.test(observed.originalCwdInode)||
  !/^[1-9][0-9]*$/u.test(observed.stateInode)||
  (preparedWorkspace&&(preparedWorkspace.cwd!==cwd||
   preparedWorkspace.cwdInode!==observed.originalCwdInode||
   preparedWorkspace.stateInode!==observed.stateInode))||
  !Number.isSafeInteger(observed.observedAtMs)||observed.observedAtMs>at||
  observed.observedAtMs<at-1000)fail('HOST_BROWSER_WORKSPACE_UNPROVEN');
 return browserObserver.arm({leaderPid});
}
