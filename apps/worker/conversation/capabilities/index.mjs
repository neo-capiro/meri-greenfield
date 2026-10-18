// @ts-check
/** Composes the enabled capabilities into one additive Options fragment. The policy is run data; the run owner,
 * binding, workspace, plugin directory, Bash sandbox attestation and SDK configuration directories are trusted
 * runtime facts. An all-off policy yields `{}`. Bash enters `tools` only when `bash-sandbox.mjs` admits it; otherwise
 * the composer applies the policy without Bash, so neither the parent nor any subagent can name it. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertCapabilityPolicy} from './policy.mjs';
import {createWorkspaceTools,assertWorkspaceRoot,BUILTIN_TOOL_NAMES} from './workspace-tools.mjs';
import {createBashSandbox} from './bash-sandbox.mjs';
import {createSubagents} from './subagents.mjs';
import {createSkillPlugin,assertSkillPluginDirectory,assertSkillPluginPath} from './skill-plugin.mjs';
import {createAuditHooks,createCompactionHooks,createSubagentLifecycleHooks} from './hooks.mjs';
import {assertCapabilityFragment,mergeHookSets,mergeSettings,chainPermissions} from './fragment.mjs';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
/** @typedef {import('@anthropic-ai/claude-agent-sdk').HookCallbackMatcher} HookCallbackMatcher */
/** @typedef {{tools:string[],allowedTools:string[],canUseTool:import('@anthropic-ai/claude-agent-sdk').CanUseTool,hooks?:Record<string,HookCallbackMatcher[]>,agents?:Record<string,import('@anthropic-ai/claude-agent-sdk').AgentDefinition>,plugins?:import('@anthropic-ai/claude-agent-sdk').SdkPluginConfig[],skills?:string[],settings?:Record<string,unknown>,managedSettings?:Record<string,unknown>,sandbox?:import('@anthropic-ai/claude-agent-sdk').SandboxSettings,env?:Record<string,string>}} ToolPiece */
/** @param {import('./policy.mjs').CapabilityPolicy} p */
const withoutBash=p=>p.bash?assertCapabilityPolicy({...p,bash:false}):p;
/** @param {unknown} policy @param {unknown} facts */
export function createSdkCapabilities(policy,facts){return compose(policy,facts,assertSkillPluginDirectory);}
/** G3: the same composition for the in-image measurement (apps/runtime/build/first-chat-launch-measurement.mjs), which projects the
 * options of a run whose workspace and skill plugin copy it never creates: the plugin path is checked lexically only. The options are
 * identical to createSdkCapabilities' for the same facts (a run's real directories are verified by createSdkCapabilities and by
 * options.mjs); nothing but the measurement may use it. @param {unknown} policy @param {unknown} facts */
export function projectSdkCapabilities(policy,facts){return compose(policy,facts,assertSkillPluginPath);}
/** @param {unknown} policy @param {unknown} facts @param {(directory:unknown,cwd:string)=>string} verifyPlugin */
function compose(policy,facts,verifyPlugin){
 const requested=assertCapabilityPolicy(policy),f=own(facts,['runOwner','binding','cwd','now','newId'],['skillPluginDirectory','bashSandbox','bashEgress','bashApprovals','sdkConfigDirectory','sdkSecureStorageDirectory','brokerSocketDirectory']);
 if(typeof f.runOwner?.append!=='function'||typeof f.now!=='function'||typeof f.newId!=='function')fail('CAPABILITY_CONFIGURATION');validateShape('RunBinding',f.binding);assertWorkspaceRoot(f.cwd);
 const protectedPaths={...(f.sdkConfigDirectory===undefined?{}:{sdkConfigDirectory:f.sdkConfigDirectory}),...(f.sdkSecureStorageDirectory===undefined?{}:{sdkSecureStorageDirectory:f.sdkSecureStorageDirectory}),
  ...(f.brokerSocketDirectory===undefined?{}:{brokerSocketDirectory:f.brokerSocketDirectory})};
 // Networked Bash also needs the run's egress proxy fact and the approval port (bash-sandbox.mjs); both are trusted runtime facts.
 const bash=createBashSandbox(requested,{cwd:f.cwd,attestation:f.bashSandbox,protectedPaths,egress:f.bashEgress,approvals:f.bashApprovals,binding:f.binding,now:f.now}),p=bash?requested:withoutBash(requested);
 /** @type {Error|undefined} */let failure;
 // The first failure of any kind latches: a refused event, or a hook validation/projection error. After it no
 // further event is attempted and `check()` throws, so the activity cannot complete, checkpoint or publish output.
 /** @type {import('./hooks.mjs').LatchPort} */
 const latch=error=>{failure??=Object.assign(Error('CAPABILITY_HOOK_FAILED'),{code:'CAPABILITY_HOOK_FAILED',cause:error});};
 /** @type {import('./hooks.mjs').PublishPort} */
 const publish=async(type,data,signal)=>{try{if(failure)throw failure;await f.runOwner.append({binding:f.binding,event:{eventId:f.newId(),createdAt:new Date(f.now()).toISOString(),type,data},signal});}catch{failure??=Object.assign(Error('CAPABILITY_EVENT_REFUSED'),{code:'CAPABILITY_EVENT_REFUSED'});throw failure;}};
 const ports={publish,latch};
 /** @type {ToolPiece[]} */const pieces=[];/** @type {Record<string,HookCallbackMatcher[]>[]} */const hookSets=[];
 if(p.workspaceTools)pieces.push(createWorkspaceTools(p,{cwd:f.cwd}));
 if(bash)pieces.push(bash);
 if(p.subagents){pieces.push(createSubagents(p,{latch}));hookSets.push(createSubagentLifecycleHooks(ports));}
 if(p.skillPlugin){if(f.skillPluginDirectory===undefined)fail('SKILL_PLUGIN_DIRECTORY_REQUIRED');pieces.push(createSkillPlugin(p,{skillPluginDirectory:f.skillPluginDirectory,cwd:f.cwd},verifyPlugin));}
 if(p.auditHooks)hookSets.push(createAuditHooks(ports));
 if(p.compactionHooks)hookSets.push(createCompactionHooks(ports));
 /** @type {Record<string,unknown>} */const options={};
 if(pieces.length){
  const tools=[...new Set(pieces.flatMap(piece=>piece.tools))];
  options.tools=tools;options.allowedTools=[...new Set(pieces.flatMap(piece=>piece.allowedTools))];options.disallowedTools=BUILTIN_TOOL_NAMES.filter(name=>!tools.includes(name));
  options.canUseTool=chainPermissions(pieces.map(piece=>piece.canUseTool));
  for(const piece of pieces){if(piece.agents)options.agents=piece.agents;if(piece.plugins)options.plugins=piece.plugins;if(piece.skills)options.skills=piece.skills;if(piece.sandbox)options.sandbox=piece.sandbox;if(piece.env)options.env=piece.env;}
  for(const key of /** @type {const} */(['settings','managedSettings'])){const sets=pieces.flatMap(piece=>piece[key]?[piece[key]]:[]);if(sets.length)options[key]=mergeSettings(sets);}
 }
 const hooks=mergeHookSets([...pieces.flatMap(piece=>piece.hooks?[piece.hooks]:[]),...hookSets]);if(Object.keys(hooks).length)options.hooks=hooks;
 if(p.subagentProgress)options.agentProgressSummaries=true;
 return Object.freeze({policy:p,bashAdmitted:bash!==undefined,options:assertCapabilityFragment(options),check(){if(failure)throw failure;}});
}
