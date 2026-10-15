// @ts-check
/** SDK `plugins`/`skills` bound to the immutable image copy of the original skill plugin. The directory is a
 * trusted runtime fact outside the conversation workspace; nothing is discovered from cwd or filesystem settings.
 * Skills are enabled by their plugin-qualified names through the SDK `skills` option, the supported way to turn
 * skills on: the SDK itself turns each listed name into a `Skill(<name>)` allow rule, hides unlisted skills from the
 * model and rejects them in the Skill tool. A Skill call that still reaches the permission callback is therefore
 * unlisted and is denied; no custom name matching remains. */
import {isAbsolute,join} from 'node:path';
import {realpathSync,lstatSync,readdirSync} from 'node:fs';
import {describeSkillPlugin,PLUGIN_NAME} from '../../../../packages/skills/plugin.mjs';
export const SKILL_TOOL='Skill';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
const MAX_PLUGIN_ENTRIES=1024,MAX_PLUGIN_DEPTH=8;
/** Canonical path of an existing real directory; anything else (missing, dangling, not a directory) throws. A missing
 * workspace is refused rather than compared lexically: its existing parent can be a symlink into the plugin (dot
 * P2a-R2), and runtime preparation creates the workspace before the SDK options are assembled (the SDK cannot start
 * in a missing cwd). @param {string} path */
const existingDirectory=path=>{const real=realpathSync(path);if(!lstatSync(real).isDirectory())throw Error('not a directory');return real;};
/** Refuses any symlink (or non-regular, non-directory entry) inside the plugin tree, bounded in size and depth.
 * @param {string} root */
function assertPlainTree(root){
 let entries=0;const walk=(/** @type {string} */dir,/** @type {number} */depth)=>{
  if(depth>MAX_PLUGIN_DEPTH)fail('SKILL_PLUGIN_DIRECTORY_REFUSED');
  for(const entry of readdirSync(dir,{withFileTypes:true})){if(++entries>MAX_PLUGIN_ENTRIES)fail('SKILL_PLUGIN_DIRECTORY_REFUSED');
   if(entry.isDirectory())walk(join(dir,entry.name),depth+1);else if(!entry.isFile())fail('SKILL_PLUGIN_DIRECTORY_REFUSED');}};
 walk(root,0);
}
/** The trusted prepared plugin directory, canonicalised: it must already be its own realpath (no alias or symlink
 * on the way), a real directory whose tree holds only regular files and directories, and disjoint from the
 * writable conversation workspace after resolving both. Both must exist; a missing workspace is refused.
 * @param {unknown} directory @param {string} cwd @returns {string} */
export function assertSkillPluginDirectory(directory,cwd){
 if(typeof directory!=='string'||!isAbsolute(directory)||directory.includes('/../')||directory.endsWith('/')||directory.includes('\0')||directory===cwd||directory.startsWith(cwd+'/')||cwd.startsWith(directory+'/'))fail('SKILL_PLUGIN_DIRECTORY_REFUSED');
 let real,workspace;try{real=existingDirectory(directory);workspace=existingDirectory(cwd);}catch{fail('SKILL_PLUGIN_DIRECTORY_REFUSED');}
 if(real!==directory||real===workspace||real.startsWith(workspace+'/')||workspace.startsWith(real+'/'))fail('SKILL_PLUGIN_DIRECTORY_REFUSED');
 try{assertPlainTree(real);}catch{fail('SKILL_PLUGIN_DIRECTORY_REFUSED');}
 return real;
}
/** @param {import('./policy.mjs').CapabilityPolicy} policy @param {{skillPluginDirectory:unknown,cwd:string}} facts */
export function createSkillPlugin(policy,{skillPluginDirectory,cwd}){
 const path=assertSkillPluginDirectory(skillPluginDirectory,cwd),available=describeSkillPlugin().skills.map(skill=>skill.name);
 const names=policy.skillNames===null?available:[...policy.skillNames];if(names.some(name=>!available.includes(name)))fail('SKILL_PLUGIN_NAME_REFUSED');
 const skills=names.map(name=>`${PLUGIN_NAME}:${name}`);
 return Object.freeze({plugins:[{type:/** @type {const} */('local'),path,skipMcpDiscovery:true}],skills,tools:[SKILL_TOOL],allowedTools:[],
  /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
  canUseTool:async()=>({behavior:'deny',message:'Skill not admitted'})});
}
