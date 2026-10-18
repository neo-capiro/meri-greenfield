// @ts-check
/** SDK `plugins`/`skills` bound to the immutable image copy of the original skill plugin. The directory is a
 * trusted runtime fact outside the conversation workspace; nothing is discovered from cwd or filesystem settings.
 * Skills are enabled by their plugin-qualified names through the SDK `skills` option, the supported way to turn
 * skills on: the SDK itself turns each listed name into a `Skill(<name>)` allow rule, hides unlisted skills from the
 * model and rejects them in the Skill tool. A Skill call that still reaches the permission callback is therefore
 * unlisted and is denied; no custom name matching remains. */
import {isAbsolute,join} from 'node:path';
import {realpathSync,lstatSync,readdirSync} from 'node:fs';
import {lstat,readdir,readFile,chmod} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {describeSkillPlugin,materializeSkillPlugin,PLUGIN_NAME} from '../../../../packages/skills/plugin.mjs';
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
/** The lexical part of assertSkillPluginDirectory alone: an absolute, normalized path disjoint from the workspace path. Only the
 * in-image measurement uses it on its own (index.mjs projectSdkCapabilities), to project the options of a run whose directories it
 * never creates; every run verifies the real directories with assertSkillPluginDirectory.
 * @param {unknown} directory @param {string} cwd @returns {string} */
export function assertSkillPluginPath(directory,cwd){
 if(typeof directory!=='string'||!isAbsolute(directory)||directory.includes('/../')||directory.endsWith('/')||directory.includes('\0')||directory===cwd||directory.startsWith(cwd+'/')||cwd.startsWith(directory+'/'))fail('SKILL_PLUGIN_DIRECTORY_REFUSED');
 return directory;
}
/** The trusted prepared plugin directory, canonicalised: it must already be its own realpath (no alias or symlink
 * on the way), a real directory whose tree holds only regular files and directories, and disjoint from the
 * writable conversation workspace after resolving both. Both must exist; a missing workspace is refused.
 * @param {unknown} directory @param {string} cwd @returns {string} */
export function assertSkillPluginDirectory(directory,cwd){
 assertSkillPluginPath(directory,cwd);
 let real,workspace;try{real=existingDirectory(directory);workspace=existingDirectory(cwd);}catch{fail('SKILL_PLUGIN_DIRECTORY_REFUSED');}
 if(real!==directory||real===workspace||real.startsWith(workspace+'/')||workspace.startsWith(real+'/'))fail('SKILL_PLUGIN_DIRECTORY_REFUSED');
 try{assertPlainTree(real);}catch{fail('SKILL_PLUGIN_DIRECTORY_REFUSED');}
 return real;
}
/** @param {import('./policy.mjs').CapabilityPolicy} policy @param {{skillPluginDirectory:unknown,cwd:string}} facts
 * @param {(directory:unknown,cwd:string)=>string} [verify] assertSkillPluginDirectory; assertSkillPluginPath only for the measurement projection */
export function createSkillPlugin(policy,{skillPluginDirectory,cwd},verify=assertSkillPluginDirectory){
 const path=verify(skillPluginDirectory,cwd),available=describeSkillPlugin().skills.map(skill=>skill.name);
 const names=policy.skillNames===null?available:[...policy.skillNames];if(names.some(name=>!available.includes(name)))fail('SKILL_PLUGIN_NAME_REFUSED');
 const skills=names.map(name=>`${PLUGIN_NAME}:${name}`);
 return Object.freeze({plugins:[{type:/** @type {const} */('local'),path,skipMcpDiscovery:true}],skills,tools:[SKILL_TOOL],allowedTools:[],
  /** @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool} */
  canUseTool:async()=>({behavior:'deny',message:'Skill not admitted'})});
}
/** G3: the run's read-only skill plugin copy. The runner (conversation-runner.mjs prepareRuntime) materializes the image's original
 * skills (`packages/skills`: assets.json catalog pins, the same assets `skillsDigest` measures) into the one run-invariant path
 * `sdkSkillPluginDirectory(configParentDirectory)` under the admitted private SDK configuration parent, then seals it read-only and
 * verifies the exact tree before any SDK option is built. The path carries no per-run value, so the `--plugin-dir-no-mcp` launch
 * argument stays inside the one measured launch template; the SDK option template places it (sdk-option-template.mjs).
 * An existing copy (a later run of the same task) is never rewritten: it must verify exactly, or the run refuses.
 *
 * Exact tree: `.claude-plugin/plugin.json` naming this plugin and version, and one `skills/<name>/SKILL.md` per described skill whose
 * bytes hash to that skill's catalog prose pin; nothing else, no symlink, owned by the runner uid, files 0400 and directories 0500.
 * The digest is canonicalSha256({schema, files:[{path, sha256}] sorted by path}). */
export const SKILL_PLUGIN_TREE_SCHEMA='meri.skill-plugin-tree.v1';
const FILE_MODE=0o400,DIRECTORY_MODE=0o500,POSIX=process.platform!=='win32';
/** @param {string} root @returns {Promise<{files:{path:string,abs:string}[],directories:{path:string,abs:string}[]}>} */
async function listTree(root,uid){
 /** @type {{path:string,abs:string}[]} */const files=[],directories=[];
 const walk=async(/** @type {string} */abs,/** @type {string} */rel,/** @type {number} */depth)=>{
  if(depth>MAX_PLUGIN_DEPTH)fail('SKILL_PLUGIN_TREE_REFUSED');
  for(const entry of await readdir(abs,{withFileTypes:true})){const a=join(abs,entry.name),r=rel?`${rel}/${entry.name}`:entry.name,s=await lstat(a);
   if(files.length+directories.length>=MAX_PLUGIN_ENTRIES)fail('SKILL_PLUGIN_TREE_REFUSED');
   if(s.isDirectory()){directories.push({path:r,abs:a});await walk(a,r,depth+1);}else if(s.isFile())files.push({path:r,abs:a});else fail('SKILL_PLUGIN_TREE_REFUSED');}};
 await walk(root,'',0);return {files,directories};
}
/** Seals a freshly materialized tree read-only, deepest entries first and the root last. @param {string} root */
async function seal(root){
 const {files,directories}=await listTree(root,undefined);
 for(const f of files)await chmod(f.abs,FILE_MODE);
 for(const d of [...directories].reverse())await chmod(d.abs,DIRECTORY_MODE);
 await chmod(root,DIRECTORY_MODE);
}
/** Verifies the exact read-only tree against the image's skill pins; returns its digest. @param {string} directory @param {{uid?:number}} [options] */
export async function verifySkillPluginTree(directory,{uid}={}){
 try{
  const root=await lstat(directory);if(root.isSymbolicLink()||!root.isDirectory()||realpathSync(directory)!==directory)fail('SKILL_PLUGIN_TREE_REFUSED');
  if(Number.isSafeInteger(uid)&&root.uid!==uid||(POSIX?(root.mode&0o777)!==DIRECTORY_MODE:false))fail('SKILL_PLUGIN_TREE_REFUSED');
  const plugin=describeSkillPlugin(),{files,directories}=await listTree(directory,uid);
  for(const d of directories){const s=await lstat(d.abs);if(Number.isSafeInteger(uid)&&s.uid!==uid||POSIX&&(s.mode&0o777)!==DIRECTORY_MODE)fail('SKILL_PLUGIN_TREE_REFUSED');}
  const expectedDirectories=['.claude-plugin','skills',...plugin.skills.map(s=>`skills/${s.name}`)].sort(),expectedFiles=['.claude-plugin/plugin.json',...plugin.skills.map(s=>`skills/${s.name}/SKILL.md`)].sort();
  if(JSON.stringify(directories.map(d=>d.path).sort())!==JSON.stringify(expectedDirectories)||JSON.stringify(files.map(f=>f.path).sort())!==JSON.stringify(expectedFiles))fail('SKILL_PLUGIN_TREE_REFUSED');
  /** @type {{path:string,sha256:string}[]} */const hashed=[];
  for(const f of files){const s=await lstat(f.abs);if(Number.isSafeInteger(uid)&&s.uid!==uid||(POSIX?(s.mode&0o777)!==FILE_MODE:(s.mode&0o222)!==0)||s.size>1048576)fail('SKILL_PLUGIN_TREE_REFUSED');
   const bytes=await readFile(f.abs),sha256=createHash('sha256').update(bytes).digest('hex');
   if(f.path==='.claude-plugin/plugin.json'){let m;try{m=JSON.parse(bytes.toString('utf8'));}catch{fail('SKILL_PLUGIN_TREE_REFUSED');}
    if(!m||typeof m!=='object'||Array.isArray(m)||JSON.stringify(Object.keys(m))!==JSON.stringify(['name','version','description'])||m.name!==PLUGIN_NAME||m.version!==plugin.version||typeof m.description!=='string'||m.description.length>1024)fail('SKILL_PLUGIN_TREE_REFUSED');}
   else{const skill=plugin.skills.find(s=>f.path===`skills/${s.name}/SKILL.md`);if(!skill||sha256!==skill.proseSha256)fail('SKILL_PLUGIN_TREE_REFUSED');}
   hashed.push({path:f.path,sha256});}
  hashed.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  return canonicalSha256({schema:SKILL_PLUGIN_TREE_SCHEMA,files:hashed});
 }catch(error){if(error?.code==='SKILL_PLUGIN_TREE_REFUSED')throw error;fail('SKILL_PLUGIN_TREE_REFUSED');}
}
/** The run's skill plugin directory, materialized read-only (or an existing copy verified) before the SDK starts.
 * @param {unknown} directory @param {{uid?:number}} [options] @returns {Promise<Readonly<{directory:string,digest:string}>>} */
export async function prepareRunSkillPlugin(directory,{uid=process.getuid?.()}={}){
 if(typeof directory!=='string'||!isAbsolute(directory)||directory.includes('/../')||directory.endsWith('/')||directory.includes('\0'))fail('SKILL_PLUGIN_DIRECTORY_REFUSED');
 let existing=true;try{await lstat(directory);}catch(error){if(/** @type {{code?:string}} */(error)?.code!=='ENOENT')fail('SKILL_PLUGIN_DIRECTORY_REFUSED');existing=false;}
 if(!existing){await materializeSkillPlugin({directory});try{await seal(directory);}catch{fail('SKILL_PLUGIN_TREE_REFUSED');}}
 return Object.freeze({directory,digest:await verifySkillPluginTree(directory,{uid})});
}
