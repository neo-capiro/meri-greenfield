// @ts-check
/** Shape of the additive Options fragment and its merge with the mounted selected-skill options.
 * Own-keys only, no unknown keys, bounded lists; hooks merge by event name and permission callbacks chain. */
import {isAbsolute} from 'node:path';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {SUBAGENT_TYPES} from './policy.mjs';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
export const FRAGMENT_KEYS=Object.freeze(['tools','allowedTools','disallowedTools','canUseTool','hooks','agents','plugins','skills','agentProgressSummaries']);
export const CAPABILITY_HOOK_EVENTS=Object.freeze(['PreToolUse','PostToolUse','PostToolUseFailure','PreCompact','PostCompact','SubagentStart','SubagentStop']);
/** @param {unknown} v @param {number} max @param {RegExp} pattern */
const names=(v,max,pattern=/^[A-Za-z][A-Za-z0-9_]{0,63}$/u)=>Array.isArray(v)&&v.length<=max&&new Set(v).size===v.length&&v.every(t=>typeof t==='string'&&pattern.test(t));
/** @typedef {import('@anthropic-ai/claude-agent-sdk').HookCallbackMatcher} HookCallbackMatcher */
/** @typedef {import('@anthropic-ai/claude-agent-sdk').CanUseTool} CanUseTool */
/** @typedef {{tools?:string[],allowedTools?:string[],disallowedTools?:string[],canUseTool?:CanUseTool,hooks?:Record<string,HookCallbackMatcher[]>,agents?:Record<string,import('@anthropic-ai/claude-agent-sdk').AgentDefinition>,plugins?:import('@anthropic-ai/claude-agent-sdk').SdkPluginConfig[],skills?:string[],agentProgressSummaries?:boolean}} CapabilityFragment */
/** @param {unknown} value @returns {CapabilityFragment} */
export function assertCapabilityFragment(value){
 const f=own(value,[],[...FRAGMENT_KEYS]);
 for(const k of ['tools','allowedTools','disallowedTools'])if(f[k]!==undefined&&!names(f[k],64))fail('CAPABILITY_FRAGMENT_REFUSED');
 if(f.canUseTool!==undefined&&typeof f.canUseTool!=='function'||f.skills!==undefined&&!names(f.skills,32,/^[a-z0-9][a-z0-9-]{0,63}:[a-z0-9][a-z0-9-]{0,63}$/u)||f.agentProgressSummaries!==undefined&&f.agentProgressSummaries!==true)fail('CAPABILITY_FRAGMENT_REFUSED');
 if(f.hooks!==undefined)for(const matchers of Object.values(own(f.hooks,[],[...CAPABILITY_HOOK_EVENTS]))){
  if(!Array.isArray(matchers)||!matchers.length||matchers.length>8)fail('CAPABILITY_FRAGMENT_REFUSED');
  for(const matcher of matchers){const m=own(matcher,['hooks'],['matcher']);if(!Array.isArray(m.hooks)||!m.hooks.length||m.hooks.some(h=>typeof h!=='function')||m.matcher!==undefined&&(typeof m.matcher!=='string'||!m.matcher))fail('CAPABILITY_FRAGMENT_REFUSED');}}
 if(f.agents!==undefined)for(const definition of Object.values(own(f.agents,[],[...SUBAGENT_TYPES]))){
  const a=own(definition,['description','prompt','tools','disallowedTools','model','maxTurns','omitClaudeMd']);
  if(typeof a.description!=='string'||!a.description||typeof a.prompt!=='string'||!a.prompt||!names(a.tools,16)||!names(a.disallowedTools,64)||a.model!=='inherit'||!Number.isSafeInteger(a.maxTurns)||a.maxTurns<1||a.maxTurns>100||a.omitClaudeMd!==true)fail('CAPABILITY_FRAGMENT_REFUSED');}
 if(f.plugins!==undefined){if(!Array.isArray(f.plugins)||f.plugins.length!==1)fail('CAPABILITY_FRAGMENT_REFUSED');const p=own(f.plugins[0],['type','path','skipMcpDiscovery']);
  if(p.type!=='local'||typeof p.path!=='string'||!isAbsolute(p.path)||p.path.includes('/../')||p.path.endsWith('/')||p.skipMcpDiscovery!==true)fail('CAPABILITY_FRAGMENT_REFUSED');}
 return /** @type {CapabilityFragment} */(f);
}
/** Hook matcher sets merged by event name, preserving order. @param {Record<string,HookCallbackMatcher[]>[]} sets */
export function mergeHookSets(sets){
 /** @type {Record<string,HookCallbackMatcher[]>} */
 const out={};
 for(const set of sets)for(const [event,matchers] of Object.entries(set))out[event]=[...(out[event]??[]),...matchers];
 return out;
}
/** Permission callbacks chained in order: the first allow wins, otherwise the last decision (default deny) stands. @param {CanUseTool[]} deciders @returns {CanUseTool} */
export function chainPermissions(deciders){
 return async(name,input,options)=>{
  /** @type {import('@anthropic-ai/claude-agent-sdk').PermissionResult} */
  let decision={behavior:'deny',message:'Tool unavailable'};
  for(const decide of deciders){const next=await decide(name,input,options);if(next)decision=next;if(decision.behavior==='allow')break;}
  return decision;
 };
}
/** @param {{allowedTools?:string[],hooks?:Record<string,HookCallbackMatcher[]>,canUseTool?:CanUseTool}} mounted @param {CapabilityFragment} fragment */
export function mergeCapabilityFragment(mounted,fragment){
 const {hooks,allowedTools,canUseTool,...rest}=fragment;
 /** @type {Record<string,unknown>} */
 const merged={...rest};
 if(allowedTools!==undefined)merged.allowedTools=[...new Set([...(mounted.allowedTools??[]),...allowedTools])];
 if(hooks!==undefined)merged.hooks=mergeHookSets([mounted.hooks??{},hooks]);
 if(canUseTool!==undefined)merged.canUseTool=mounted.canUseTool===undefined?canUseTool:chainPermissions([mounted.canUseTool,canUseTool]);
 return merged;
}
