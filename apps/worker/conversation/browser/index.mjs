/** Composable browser fragment for the conversation's single SDK query. The capability is on by default and its
 * destinations are denied by default (policy.mjs), but the activation gate (activation.mjs) is held until real egress
 * controls are qualified, so today every call returns a held fragment that contributes no server, tool, hook or
 * download path. Every fragment carries a UI-facing `status`. */
import {isAbsolute} from 'node:path';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {validateBrowserPolicy,browserStatus,DEFAULT_BROWSER_POLICY} from './policy.mjs';
import {BROWSER_ACTIVATION,activationOpen} from './activation.mjs';
import {browserPaths,disposeBrowserState} from './workspace.mjs';
import {buildOpenBrowserFragment} from './fragment.mjs';
export {disposeBrowserState,browserPaths};
const fail=()=>{throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});};
const refusing=code=>Object.freeze({async accept(){throw Object.assign(new Error(code),{code});}});
const inert=(fields,code)=>Object.freeze({enabled:false,...fields,mcpServers:Object.freeze({}),allowedTools:Object.freeze([]),disallowedTools:Object.freeze([]),hooks:Object.freeze({}),downloads:refusing(code)});
/** Validates the trusted context, then returns: a disabled fragment for a disabled policy, a held fragment while the
 * shipped activation record is held (there is no argument that opens it), otherwise the composed fragment.
 * Nothing is created or launched here. */
export function createBrowserCapability(context){
 const {binding,cwd,policy=DEFAULT_BROWSER_POLICY,now}=context??{};
 try{validateShape('RunBinding',binding);}catch{fail();}
 if(typeof cwd!=='string'||!isAbsolute(cwd)||!cwd.endsWith(`/${binding.conversationId}`)||cwd.includes('/../')||cwd.includes('\0')||typeof now!=='function')fail();
 const p=validateBrowserPolicy(policy);
 if(!p.enabled)return inert({activation:'not-applicable',policy:p,status:Object.freeze({...browserStatus(p),activation:'not-applicable'})},'BROWSER_DOWNLOADS_DISABLED');
 if(!activationOpen(BROWSER_ACTIVATION))return inert({activation:'held',reason:BROWSER_ACTIVATION.reason,policy:p,status:Object.freeze({...browserStatus(p),activation:'held'})},'BROWSER_ACTIVATION_HELD');
 return buildOpenBrowserFragment({...context,policy:p});
}
