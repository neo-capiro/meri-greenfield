// @ts-check
/** Composes the enabled capabilities into one additive Options fragment. The policy is run data; the
 * run owner, binding, workspace and plugin directory are trusted runtime facts. An all-off policy yields `{}`. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertCapabilityPolicy} from './policy.mjs';
import {createWorkspaceTools,assertWorkspaceRoot,BUILTIN_TOOL_NAMES} from './workspace-tools.mjs';
import {createSubagents} from './subagents.mjs';
import {createSkillPlugin} from './skill-plugin.mjs';
import {createAuditHooks,createCompactionHooks,createSubagentLifecycleHooks} from './hooks.mjs';
import {assertCapabilityFragment,mergeHookSets,chainPermissions} from './fragment.mjs';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
/** @typedef {{tools:string[],allowedTools:string[],canUseTool:import('@anthropic-ai/claude-agent-sdk').CanUseTool,hooks?:Record<string,import('@anthropic-ai/claude-agent-sdk').HookCallbackMatcher[]>,agents?:Record<string,import('@anthropic-ai/claude-agent-sdk').AgentDefinition>,plugins?:import('@anthropic-ai/claude-agent-sdk').SdkPluginConfig[],skills?:string[]}} ToolPiece */
/** @param {unknown} policy @param {unknown} facts */
export function createSdkCapabilities(policy,facts){
 const p=assertCapabilityPolicy(policy),f=own(facts,['runOwner','binding','cwd','now','newId'],['skillPluginDirectory']);
 if(typeof f.runOwner?.append!=='function'||typeof f.now!=='function'||typeof f.newId!=='function')fail('CAPABILITY_CONFIGURATION');validateShape('RunBinding',f.binding);assertWorkspaceRoot(f.cwd);
 /** @type {Error|undefined} */let failure;
 /** @type {import('./hooks.mjs').PublishPort} */
 const publish=async(type,data,signal)=>{try{if(failure)throw failure;await f.runOwner.append({binding:f.binding,event:{eventId:f.newId(),createdAt:new Date(f.now()).toISOString(),type,data},signal});}catch{failure??=Object.assign(Error('CAPABILITY_EVENT_REFUSED'),{code:'CAPABILITY_EVENT_REFUSED'});throw failure;}};
 /** @type {ToolPiece[]} */const pieces=[];/** @type {Record<string,import('@anthropic-ai/claude-agent-sdk').HookCallbackMatcher[]>[]} */const hookSets=[];
 if(p.workspaceTools)pieces.push(createWorkspaceTools(p,{cwd:f.cwd}));
 if(p.subagents){pieces.push(createSubagents(p));hookSets.push(createSubagentLifecycleHooks({publish}));}
 if(p.skillPlugin){if(f.skillPluginDirectory===undefined)fail('SKILL_PLUGIN_DIRECTORY_REQUIRED');pieces.push(createSkillPlugin(p,{skillPluginDirectory:f.skillPluginDirectory,cwd:f.cwd}));}
 if(p.auditHooks)hookSets.push(createAuditHooks({publish}));
 if(p.compactionHooks)hookSets.push(createCompactionHooks({publish}));
 /** @type {Record<string,unknown>} */const options={};
 if(pieces.length){
  const tools=[...new Set(pieces.flatMap(piece=>piece.tools))];
  options.tools=tools;options.allowedTools=[...new Set(pieces.flatMap(piece=>piece.allowedTools))];options.disallowedTools=BUILTIN_TOOL_NAMES.filter(name=>!tools.includes(name));
  options.canUseTool=chainPermissions(pieces.map(piece=>piece.canUseTool));
  for(const piece of pieces){if(piece.agents)options.agents=piece.agents;if(piece.plugins)options.plugins=piece.plugins;if(piece.skills)options.skills=piece.skills;}
 }
 const hooks=mergeHookSets([...pieces.flatMap(piece=>piece.hooks?[piece.hooks]:[]),...hookSets]);if(Object.keys(hooks).length)options.hooks=hooks;
 if(p.subagentProgress)options.agentProgressSummaries=true;
 return Object.freeze({policy:p,options:assertCapabilityFragment(options),check(){if(failure)throw failure;}});
}
