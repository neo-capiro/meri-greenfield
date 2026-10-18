/** Hash data options and declared callback surfaces, never invoke worker getters.
 *
 * G3 (one SDK-options pin for capability-bearing runs): the closed allowlist also admits exactly the option keys the run's capability
 * fragment (apps/worker/conversation/capabilities/index.mjs) and its MCP mounts (reads/runtime.mjs, intents/runtime.mjs) produce:
 *  data      disallowedTools, agents, plugins (the one local skill plugin), managedSettings (permission locks only),
 *            agentProgressSummaries; hashed verbatim (plugins/settings paths are placed by sdk-option-template.mjs).
 *  servers   mcpServers named meri_original_reads, meri_reads or meri_intents, each an in-process SDK server.
 *  hooks     every capability hook event; per matcher only its matcher text and its callback count are hashed.
 * Anything else (sandbox, a browser or other MCP server, another hook event or key) is refused SDK_OPTIONS_REFUSED. */
import {types} from 'node:util';
import {isAbsolute} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {executionFault} from './execution-broker.mjs';
import {SUBAGENT_TYPES} from '../../worker/conversation/capabilities/policy.mjs';
const callbacks=new Set(['abortController','sessionStore','canUseTool','mcpServers','hooks']);
const fields=['cwd','settingSources','settings','skills','allowedTools','tools','permissionMode','includePartialMessages','systemPrompt','model','maxTurns','maxBudgetUsd','sessionStoreFlush','env','resume','forkSession','resumeSessionAt','sessionId','outputFormat',
 'disallowedTools','agents','plugins','managedSettings','agentProgressSummaries'];
/** In-process SDK MCP servers a run may mount: the selected-skill reads, general reads and governed intents. */
export const SDK_MCP_SERVER_NAMES=Object.freeze(['meri_original_reads','meri_reads','meri_intents']);
/** Hook events a run's options may carry (capabilities/fragment.mjs CAPABILITY_HOOK_EVENTS; PreToolUse also from the MCP mounts). */
export const SDK_HOOK_EVENTS=Object.freeze(['PreToolUse','PostToolUse','PostToolUseFailure','PreCompact','PostCompact','SubagentStart','SubagentStop']);
const MAX_MATCHERS=16,MAX_HOOKS=8,TOOL=/^[A-Za-z][A-Za-z0-9_]{0,63}$/u;
const refuse=()=>{throw executionFault('SDK_OPTIONS_REFUSED');};
/** A real array read through its own data descriptors only (no proxy, no getter, no extra key), 1..max elements. */
const list=(value,max)=>{if(types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)refuse();const d=Object.getOwnPropertyDescriptors(value),n=d.length?.value;
 if(!Number.isSafeInteger(n)||n<1||n>max||Reflect.ownKeys(d).length!==n+1)refuse();return Array.from({length:n},(_,i)=>{if(!Object.hasOwn(d[String(i)]??{},'value'))refuse();return d[String(i)].value;});};
const callback=fn=>{if(typeof fn!=='function'||types.isProxy(fn))refuse();return 'approved-runner-callback';};
function projectServers(v){
 const servers=own(v,[],[...SDK_MCP_SERVER_NAMES]);if(!Object.keys(servers).length)refuse();
 return Object.fromEntries(Object.entries(servers).map(([name,value])=>{const s=own(value,['type','name','instance'],['timeout']);if(s.type!=='sdk'||s.name!==name)refuse();storageMethod(s.instance,'close');
  if(s.timeout!==undefined&&(!Number.isSafeInteger(s.timeout)||s.timeout<1||s.timeout>2147483647))refuse();return [name,{type:s.type,name:s.name,instance:'approved-runner-server',...(s.timeout===undefined?{}:{timeout:s.timeout})}];}));
}
/** Hook presence, event names and matchers, in order; a callback is never invoked or hashed. The single PreToolUse matcher of the
 * selected-skill mount projects exactly as before ({matcher, hooks:['approved-runner-callback']}). */
function projectHooks(v){
 const events=own(v,[],[...SDK_HOOK_EVENTS]);if(!Object.keys(events).length)refuse();
 return Object.fromEntries(Object.entries(events).map(([event,matchers])=>[event,list(matchers,MAX_MATCHERS).map(row=>{const m=own(row,['hooks'],['matcher']);
  if(m.matcher!==undefined&&(typeof m.matcher!=='string'||!m.matcher||m.matcher.length>512))refuse();
  return {...(m.matcher===undefined?{}:{matcher:m.matcher}),hooks:list(m.hooks,MAX_HOOKS).map(callback)};})]));
}
/** Closed shapes of the capability data keys; their values are then hashed verbatim. */
function assertCapabilityData(k,v){
 if(k==='disallowedTools'){const names=list(v,64);if(new Set(names).size!==names.length||names.some(t=>typeof t!=='string'||!TOOL.test(t)))refuse();}
 else if(k==='agentProgressSummaries'){if(v!==true)refuse();}
 else if(k==='plugins'){const [p]=list(v,1),plugin=own(p,['type','path','skipMcpDiscovery']);if(plugin.type!=='local'||typeof plugin.path!=='string'||!isAbsolute(plugin.path)||plugin.skipMcpDiscovery!==true)refuse();}
 else if(k==='managedSettings')own(v,['permissions']);
 else if(k==='agents'){if(!Object.keys(own(v,[],[...SUBAGENT_TYPES])).length)refuse();}
}
const CAPABILITY_DATA=new Set(['disallowedTools','agents','plugins','managedSettings','agentProgressSummaries']);
export function projectNativeSdkOptions(options){
 const o=own(options,[],[...fields,...callbacks]),result={};
 for(const [k,v]of Object.entries(o)){
  if(!callbacks.has(k)){if(k==='env'){if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))refuse();const env=own(v,[],Object.keys(v));result.env=Object.fromEntries(Object.entries(env).map(([name,value])=>{if(name==='ANTHROPIC_AUTH_TOKEN'){if(typeof value!=='string'||!value)refuse();return [name,'issued-task-credential'];}return [name,value===undefined?null:value];}));}else{if(CAPABILITY_DATA.has(k))assertCapabilityData(k,v);result[k]=v;}continue;}
  if(k==='canUseTool')result[k]=callback(v);
  else if(k==='abortController'){if(types.isProxy(v)||!(v instanceof AbortController))refuse();result[k]='owned-abort-controller';}
  else if(k==='sessionStore'){const s=own(v,['load','append'],['listSubkeys']);if(Object.values(s).some(fn=>typeof fn!=='function'||types.isProxy(fn)))refuse();result[k]=Object.keys(s).sort();}
  else if(k==='mcpServers')result[k]=projectServers(v);
  else result[k]=projectHooks(v);
 }
 return data(result);
}
