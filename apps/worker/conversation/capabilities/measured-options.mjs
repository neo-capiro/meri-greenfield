// @ts-check
/** G3, for the in-image measurement (apps/runtime/build/first-chat-launch-measurement.mjs) only: the SDK options a first-chat run builds
 * for one capability profile, so the measured sdkOptionsSha256 is the runner's. Without a profile it is exactly
 * buildConversationOptions(runtime) (the unchanged first-chat options). With one it adds exactly what activity.mjs adds:
 *  - the capability fragment: index.mjs projectSdkCapabilities, the createSdkCapabilities composition with the skill plugin path checked
 *    lexically (the measurement creates no directory; every run verifies its real copy), given the runtime facts a run has
 *    (`skillPluginDirectory` only when the profile enables the skill plugin, as conversation-runner.mjs prepareRuntime supplies it);
 *  - the profile MCP mounts: mounts.mjs createProfileMounts with no port, since availability never changes what is mounted.
 * options.mjs only checks the fragment's `plugins` against the runtime's skillPluginDirectory fact (a real directory it verifies), so the
 * fragment's plugins are set on the options after buildConversationOptions; apps/runtime/test/capability-sdk-pin.test.mjs proves the
 * resulting template equals the template of options a real activity built over real directories. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {buildConversationOptions} from '../options.mjs';
import {assertCapabilityPolicy} from './policy.mjs';
import {projectSdkCapabilities} from './index.mjs';
import {createProfileMounts} from './mounts.mjs';
/** The receipt's inputs.capabilityProfileSha256: the canonical digest of the profile exactly as given. @param {unknown} profile */
export const capabilityProfileSha256=profile=>canonicalSha256(profile);
/** @param {any} runtime the product runtime (options.mjs) @param {{profile?:unknown,scopes:any[],skillPluginDirectory:string,newId:()=>string}} facts
 * @returns {Promise<{options:Record<string,any>,close:()=>Promise<void>}>} `close` releases the in-process MCP servers */
export async function projectRunOptions(runtime,{profile,scopes,skillPluginDirectory,newId}){
 if(profile===undefined)return {options:buildConversationOptions(runtime,new AbortController()),async close(){}};
 const policy=assertCapabilityPolicy(profile),now=()=>0;
 const capabilities=projectSdkCapabilities(policy,{runOwner:{async append(){}},binding:runtime.binding,cwd:runtime.cwd,...(policy.skillPlugin?{skillPluginDirectory}:{}),
  ...(runtime.sdkConfigDirectory===undefined?{}:{sdkConfigDirectory:runtime.sdkConfigDirectory,sdkSecureStorageDirectory:runtime.sdkSecureStorageDirectory}),now,newId});
 const mounts=await createProfileMounts({policy,binding:runtime.binding,scopes,now,deadlineMs:runtime.deadlineMs});
 const close=async()=>{try{await mounts.reads?.close();}finally{await mounts.intents?.close();}};
 try{
  const {plugins,...fragment}=capabilities.options;
  const options=buildConversationOptions(runtime,new AbortController(),undefined,undefined,fragment,mounts.reads?.sdkOptions??undefined,mounts.intents?.sdkOptions??undefined);
  if(plugins!==undefined)options.plugins=plugins;
  return {options,close};
 }catch(error){await close();throw error;}
}
