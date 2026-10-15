// @ts-check
/** SDK `plugins`/`skills` bound to the immutable image copy of the original skill plugin. The directory is a
 * trusted runtime fact outside the conversation workspace; nothing is discovered from cwd or filesystem settings.
 * Skills are enabled by their plugin-qualified names through the SDK `skills` option (the supported way to turn
 * skills on), and the Skill tool admits only those exact names. */
import {isAbsolute} from 'node:path';
import {describeSkillPlugin,PLUGIN_NAME} from '../../../../packages/skills/plugin.mjs';
export const SKILL_TOOL='Skill';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
/** @param {unknown} directory @param {string} cwd @returns {string} */
export function assertSkillPluginDirectory(directory,cwd){
 if(typeof directory!=='string'||!isAbsolute(directory)||directory.includes('/../')||directory.endsWith('/')||directory.includes('\0')||directory===cwd||directory.startsWith(cwd+'/')||cwd.startsWith(directory+'/'))fail('SKILL_PLUGIN_DIRECTORY_REFUSED');
 return directory;
}
/** @param {import('./policy.mjs').CapabilityPolicy} policy @param {{skillPluginDirectory:unknown,cwd:string}} facts */
export function createSkillPlugin(policy,{skillPluginDirectory,cwd}){
 const path=assertSkillPluginDirectory(skillPluginDirectory,cwd),available=describeSkillPlugin().skills.map(skill=>skill.name);
 const names=policy.skillNames===null?available:[...policy.skillNames];if(names.some(name=>!available.includes(name)))fail('SKILL_PLUGIN_NAME_REFUSED');
 const skills=names.map(name=>`${PLUGIN_NAME}:${name}`);
 /** @param {unknown} input */
 const admitted=input=>{if(!input||typeof input!=='object'||Array.isArray(input))return false;const skill=/** @type {{skill?:unknown}} */(input).skill;return typeof skill==='string'&&(skills.includes(skill)||names.includes(skill));};
 return Object.freeze({plugins:[{type:/** @type {const} */('local'),path,skipMcpDiscovery:true}],skills,tools:[SKILL_TOOL],allowedTools:[],
  /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
  canUseTool:async(name,input)=>name===SKILL_TOOL&&admitted(input)?{behavior:'allow',updatedInput:input}:{behavior:'deny',message:'Skill not admitted'}});
}
