// @ts-check
/** Bounded built-in file tools confined to the conversation workspace by the SDK's own permission system:
 * `permissions.blockReadsOutsideWorkingDirectories` refuses Read/Grep/Glob outside the working directory in every
 * permission mode, and `Read(//<cwd>/**)` / `Edit(//<cwd>/**)` allow rules pre-approve file access inside it (Edit
 * rules also govern Write). Any other call falls through to the permission callback, which denies it. The SDK
 * evaluates resolved paths, so this replaces the former textual path gate and its PreToolUse duplicate.
 * Bash is not a file tool: it is admitted only through `bash-sandbox.mjs` with its own policy flag. */
import {isAbsolute,resolve} from 'node:path';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {WORKSPACE_TOOLS} from './policy.mjs';
/** Built-in tool names declared by the pinned SDK tool schemas; every name outside the run's `tools` is also disallowed. */
export const BUILTIN_TOOL_NAMES=Object.freeze(['Agent','Bash','ExitPlanMode','Edit','Read','Write','Glob','Grep','TaskStop','ListMcpResources','RefreshMcpTools','NotebookEdit','ReadMcpResourceDir','ReadMcpResource','ReportFindings','TodoWrite','WebFetch','WebSearch','AskUserQuestion','SendFeedback','ClaudeDesign','Projects','EnterPlanMode','TaskCreate','TaskGet','TaskUpdate','TaskList','Workflow','CronCreate','CronDelete','CronList','ScheduleWakeup','RemoteTrigger','ShowOnboardingRolePicker','OfferChromeSetup','ReadNotifications','Monitor','ProposeSkills','ProposeGoal','Artifact','PushNotification','EnterWorktree','ExitWorktree','Skill']);
export const FILE_TOOLS=WORKSPACE_TOOLS;
const WRITE_TOOLS=Object.freeze(['Write','Edit']);
/** @param {string} cwd */
export function assertWorkspaceRoot(cwd){if(typeof cwd!=='string'||!isAbsolute(cwd)||cwd.includes('/../')||cwd.endsWith('/')||cwd.includes('\0')||/[()*?[\]{}!\\]/u.test(cwd)||resolve(cwd)!==cwd)throw Object.assign(Error('WORKSPACE_ROOT_REFUSED'),{code:'WORKSPACE_ROOT_REFUSED'});return cwd;}
/** Absolute-path permission rules use a leading `//`; the cwd itself starts with `/`. @param {'Read'|'Edit'} tool @param {string} cwd */
export const workspaceRule=(tool,cwd)=>`${tool}(/${cwd}/**)`;
/** Restrictive permission switches; also sent as parent policy-tier locks. */
export const WORKSPACE_PERMISSION_LOCKS=Object.freeze({blockReadsOutsideWorkingDirectories:true,disableBypassPermissionsMode:'disable'});
/** Closed shape of `settings.permissions` (with allow rules) or `managedSettings.permissions` (locks only).
 * @param {unknown} value @param {{withRules:boolean}} mode */
export function assertWorkspacePermissions(value,{withRules}){
 const p=own(value,['blockReadsOutsideWorkingDirectories','disableBypassPermissionsMode'],withRules?['allow']:[]);
 if(p.blockReadsOutsideWorkingDirectories!==true||p.disableBypassPermissionsMode!=='disable')throw Object.assign(Error('CAPABILITY_FRAGMENT_REFUSED'),{code:'CAPABILITY_FRAGMENT_REFUSED'});
 if(p.allow!==undefined&&(!Array.isArray(p.allow)||p.allow.length<1||p.allow.length>2||new Set(p.allow).size!==p.allow.length||p.allow.some(rule=>typeof rule!=='string'||!/^(?:Read|Edit)\(\/\/[^()*?[\]{}!\\\0]+\/\*\*\)$/u.test(rule))))throw Object.assign(Error('CAPABILITY_FRAGMENT_REFUSED'),{code:'CAPABILITY_FRAGMENT_REFUSED'});
 return value;
}
/** @param {import('./policy.mjs').CapabilityPolicy} policy @param {{cwd:string}} facts */
export function createWorkspaceTools(policy,{cwd}){
 assertWorkspaceRoot(cwd);const tools=FILE_TOOLS.filter(name=>policy.workspaceToolNames.includes(name));
 const allow=[workspaceRule('Read',cwd),...(tools.some(tool=>WRITE_TOOLS.includes(tool))?[workspaceRule('Edit',cwd)]:[])];
 return Object.freeze({tools,allowedTools:[],
  settings:{permissions:{...WORKSPACE_PERMISSION_LOCKS,allow}},managedSettings:{permissions:{...WORKSPACE_PERMISSION_LOCKS}},
  /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
  canUseTool:async()=>({behavior:'deny',message:'Outside the conversation workspace'})});
}
