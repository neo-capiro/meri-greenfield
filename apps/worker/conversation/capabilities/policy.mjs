// @ts-check
/** Validated, default-off SDK capability policy. The policy is trusted run data read by the activity;
 * it names which supported SDK features this run may use and never carries paths, credentials or authority. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
export const SUBAGENT_TYPES=Object.freeze(['research','analysis','artifact_production','verification']);
export const WORKSPACE_TOOLS=Object.freeze(['Read','Write','Edit','Glob','Grep','Bash']);
export const MAX_PARALLEL_SUBAGENTS=4;
const FLAGS=Object.freeze(['subagents','auditHooks','compactionHooks','skillPlugin','workspaceTools','subagentProgress']);
const LISTS=Object.freeze(['subagentTypes','workspaceToolNames','skillNames']);
const SKILL_NAME=/^[a-z0-9][a-z0-9-]{0,63}$/u;
/** @param {unknown} value @param {readonly string[]|null} universe @param {number} max */
function allowlist(value,universe,max){
 if(!Array.isArray(value)||value.length<1||value.length>max||new Set(value).size!==value.length||value.some(v=>typeof v!=='string'||(universe?!universe.includes(v):!SKILL_NAME.test(v))))fail('CAPABILITY_POLICY_REFUSED');
 return Object.freeze([...value]);
}
/** @typedef {{subagents:boolean,auditHooks:boolean,compactionHooks:boolean,skillPlugin:boolean,workspaceTools:boolean,subagentProgress:boolean,subagentTypes:readonly string[],maxParallelSubagents:number,workspaceToolNames:readonly string[],skillNames:readonly string[]|null}} CapabilityPolicy */
/** Every flag defaults to false; every allowlist defaults to the bounded catalog (`skillNames: null` = every original).
 * Idempotent: a validated policy validates to itself. @param {unknown} value @returns {CapabilityPolicy} */
export function assertCapabilityPolicy(value){
 const p=own(value,[],[...FLAGS,...LISTS,'maxParallelSubagents']);
 for(const flag of FLAGS)if(p[flag]!==undefined&&typeof p[flag]!=='boolean')fail('CAPABILITY_POLICY_REFUSED');
 const parallel=p.maxParallelSubagents??2;if(!Number.isSafeInteger(parallel)||parallel<1||parallel>MAX_PARALLEL_SUBAGENTS)fail('CAPABILITY_POLICY_REFUSED');
 const policy={subagents:p.subagents===true,auditHooks:p.auditHooks===true,compactionHooks:p.compactionHooks===true,skillPlugin:p.skillPlugin===true,workspaceTools:p.workspaceTools===true,subagentProgress:p.subagentProgress===true,
  subagentTypes:p.subagentTypes===undefined?SUBAGENT_TYPES:allowlist(p.subagentTypes,SUBAGENT_TYPES,SUBAGENT_TYPES.length),maxParallelSubagents:parallel,
  workspaceToolNames:p.workspaceToolNames===undefined?WORKSPACE_TOOLS:allowlist(p.workspaceToolNames,WORKSPACE_TOOLS,WORKSPACE_TOOLS.length),
  skillNames:p.skillNames===undefined||p.skillNames===null?null:allowlist(p.skillNames,null,32)};
 if(policy.subagentProgress&&!policy.subagents)fail('CAPABILITY_POLICY_REFUSED');
 return Object.freeze(policy);
}
/** Conservative reader: the saved execution record may carry `capabilities`; anything else means no capability.
 * The `Run` contract is closed, so the control owner supplies the policy beside `run`, never inside it.
 * @param {unknown} saved @returns {CapabilityPolicy|undefined} */
export function readCapabilityPolicy(saved){
 if(!saved||typeof saved!=='object'||!Object.hasOwn(saved,'capabilities'))return undefined;
 const value=/** @type {{capabilities:unknown}} */(saved).capabilities;
 return value===undefined?undefined:assertCapabilityPolicy(value);
}
