/** Browser policy is resolved from the existing settings store and trusted
 * platform record. Core/currentness supplies the current role and exact run;
 * this reader creates no authority, credentials, host or activation override. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {DEFAULT_BROWSER_POLICY} from '../../worker/conversation/browser/policy.mjs';
import {assertPlatformBrowserLimits,resolveBrowserPolicy} from '../../worker/conversation/browser/resolution.mjs';
import {createPostgresSettingsStore} from '../../control/settings/postgres-store.mjs';
import {CORE_ROLES} from './capability-policy.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** Product default: browser capability on, no approved external destinations.
 * Browser activation and native qualification remain separate owners. */
export const DEFAULT_BROWSER_PLATFORM=assertPlatformBrowserLimits({maximum:DEFAULT_BROWSER_POLICY,defaults:DEFAULT_BROWSER_POLICY,
 roleCeilings:Object.fromEntries(CORE_ROLES.map(role=>[role,DEFAULT_BROWSER_POLICY]))});
export function compileBrowserPlatform(configuration){
 try{return assertPlatformBrowserLimits(data(configuration?.browserPlatform===undefined?DEFAULT_BROWSER_PLATFORM:configuration.browserPlatform));}
 catch{throw fault('BROWSER_PLATFORM_CONFIGURATION');}
}
export function createStaticBrowserPlatformLimits(platform){
 const limits=assertPlatformBrowserLimits(platform);
 return async function readBrowserPlatformLimits({signal}={}){nativeSignal(signal);signal?.throwIfAborted();return limits;};
}
export function createRunBrowserPolicy({platform,store,now=Date.now}){
 const limits=assertPlatformBrowserLimits(platform);
 if(typeof store?.read!=='function'||typeof now!=='function')throw fault('BROWSER_PRODUCER_CONFIGURATION');
 const read=store.read.bind(store);
 return async function readBrowserPolicy(input){
  const v=own(input,['binding','scopes','actorRole'],['signal','deadlineMs']);nativeSignal(v.signal);
  const {binding,scopes}=data({binding:v.binding,scopes:v.scopes});
  if(!Array.isArray(scopes)||scopes.length!==1||!CORE_ROLES.includes(v.actorRole))throw fault('BROWSER_POLICY_REQUEST');
  assertNativeConversationScope({binding,scopes,selectedClientId:scopes[0].kind==='client'?scopes[0].resourceId:null});
  if(v.deadlineMs!==undefined&&!Number.isSafeInteger(v.deadlineMs))throw fault('BROWSER_POLICY_REQUEST');
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs??now()+3000,now()+3000),errorFactory:fault});
  try{
   const saved=await life.run(signal=>read({kind:'tenant',tenantId:binding.tenantId,signal}));
   // Only an absent row or absent optional field inherits defaults. Corrupt or
   // failed reads must never be converted into an unrestricted policy.
   let tenant;
   if(saved===null)tenant={};
   else{
    if(!saved||!saved.document||typeof saved.document!=='object')throw fault('BROWSER_TENANT_SETTINGS_REFUSED');
    tenant=Object.hasOwn(saved.document,'browserPolicy')?data(own(saved.document.browserPolicy,[],['browser','roles'])):{};
   }
   const policy=resolveBrowserPolicy({platform:limits,tenant,role:v.actorRole});life.check();return policy;
  }finally{life.close();}
 };
}
/** Borrow the existing Control pool; constructing the reader does no I/O. */
export function createConfiguredRunBrowserPolicy(configuration,{pool,now=Date.now}){
 return createRunBrowserPolicy({platform:compileBrowserPlatform(configuration),store:createPostgresSettingsStore({pool}),now});
}
