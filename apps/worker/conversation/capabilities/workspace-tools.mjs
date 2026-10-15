// @ts-check
/** Bounded built-in workspace tools. One textual path rule serves both the permission callback and a
 * PreToolUse gate, so read-only tools the CLI auto-allows are still confined to the conversation workspace.
 * This is a path gate, not a sandbox: the qualified host sandbox remains a separate acceptance gate. */
import {isAbsolute,resolve} from 'node:path';
import {WORKSPACE_TOOLS} from './policy.mjs';
/** Built-in tool names declared by the pinned SDK tool schemas; every name outside the run's `tools` is also disallowed. */
export const BUILTIN_TOOL_NAMES=Object.freeze(['Agent','Bash','ExitPlanMode','Edit','Read','Write','Glob','Grep','TaskStop','ListMcpResources','RefreshMcpTools','NotebookEdit','ReadMcpResourceDir','ReadMcpResource','ReportFindings','TodoWrite','WebFetch','WebSearch','AskUserQuestion','SendFeedback','ClaudeDesign','Projects','EnterPlanMode','TaskCreate','TaskGet','TaskUpdate','TaskList','Workflow','CronCreate','CronDelete','CronList','ScheduleWakeup','RemoteTrigger','ShowOnboardingRolePicker','OfferChromeSetup','ReadNotifications','Monitor','ProposeSkills','ProposeGoal','Artifact','PushNotification','EnterWorktree','ExitWorktree','Skill']);
const PATH_FIELD=Object.freeze({Read:'file_path',Write:'file_path',Edit:'file_path',Glob:'path',Grep:'path'}),GLOB_FIELD=Object.freeze({Glob:'pattern',Grep:'glob'});
// Parent traversal, home/variable/command expansion, NUL, and a directory change with no target (home or OLDPWD) are refused.
const BASH_DENIED=/\.\.|~|\$|`|\0|(?:^|[\s;&|(])(?:cd|pushd|popd)(?:\s+-)?\s*(?=$|[;&|)])/u,BASH_ABSOLUTE=/(?<![\w./-])\/[^\s'"`;|&<>)]*/gu,BASH_ALLOWED_DEVICES=Object.freeze(['/dev/null']);
/** @param {string} cwd */
export function assertWorkspaceRoot(cwd){if(typeof cwd!=='string'||!isAbsolute(cwd)||cwd.includes('/../')||cwd.endsWith('/')||cwd.includes('\0')||resolve(cwd)!==cwd)throw Object.assign(Error('WORKSPACE_ROOT_REFUSED'),{code:'WORKSPACE_ROOT_REFUSED'});return cwd;}
/** @param {string} cwd @param {unknown} path */
const inside=(cwd,path)=>typeof path==='string'&&!!path&&!path.includes('\0')&&isAbsolute(path)&&(resolve(path)===cwd||resolve(path).startsWith(cwd+'/'));
/** True when the tool call stays inside the workspace; unknown tools and malformed inputs are outside.
 * @param {string} tool @param {unknown} input @param {string} cwd */
export function withinWorkspace(tool,input,cwd){
 if(!input||typeof input!=='object'||Array.isArray(input))return false;const i=/** @type {Record<string,unknown>} */(input);
 if(tool==='Bash'){const command=i.command;if(typeof command!=='string'||!command||command.length>4096||BASH_DENIED.test(command))return false;
  return [...command.matchAll(BASH_ABSOLUTE)].every(([path])=>BASH_ALLOWED_DEVICES.includes(path)||inside(cwd,path));}
 const field=PATH_FIELD[/** @type {keyof typeof PATH_FIELD} */(tool)];if(field===undefined)return false;
 // A file glob is resolved against the search root, so it must itself be relative and non-escaping.
 const glob=i[GLOB_FIELD[/** @type {keyof typeof GLOB_FIELD} */(tool)]??''];if(glob!==undefined&&(typeof glob!=='string'||isAbsolute(glob)||/\.\.|~|\0/u.test(glob)))return false;
 const path=i[field];return path===undefined&&(tool==='Glob'||tool==='Grep')?true:inside(cwd,path);
}
/** @param {import('./policy.mjs').CapabilityPolicy} policy @param {{cwd:string}} facts */
export function createWorkspaceTools(policy,{cwd}){
 assertWorkspaceRoot(cwd);const tools=WORKSPACE_TOOLS.filter(name=>policy.workspaceToolNames.includes(name)),matcher=`^(${tools.join('|')})$`;
 /** @type {import('@anthropic-ai/claude-agent-sdk').HookCallback} */
 const gate=async input=>{const i=/** @type {import('@anthropic-ai/claude-agent-sdk').PreToolUseHookInput} */(input);
  if(i.hook_event_name==='PreToolUse'&&tools.includes(i.tool_name)&&withinWorkspace(i.tool_name,i.tool_input,cwd))return {};
  return {hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Outside the conversation workspace'}};};
 return Object.freeze({tools,allowedTools:tools,hooks:{PreToolUse:[{matcher,hooks:[gate]}]},
  /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
  canUseTool:async(name,input)=>tools.includes(name)&&withinWorkspace(name,input,cwd)?{behavior:'allow',updatedInput:input}:{behavior:'deny',message:'Outside the conversation workspace'}});
}
