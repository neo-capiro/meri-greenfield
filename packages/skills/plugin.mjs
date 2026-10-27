/** Native SDK plugin projection of the immutable originals. Names and prose come through the index
 * at materialization time; nothing is copied into Git, and model invocation stays disabled by the frontmatter. */
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isAbsolute,join} from 'node:path';
import {listSkills,selectSkill} from './index.mjs';
import assets from './assets.json' with {type:'json'};
import {canonicalSha256} from '../contracts/validate.mjs';
export const PLUGIN_NAME='meri-original-skills';
const FRONTMATTER=/^---\n([\s\S]*?)\n---\n/u,NAME=/^name:[ \t]*([a-z0-9][a-z0-9-]*)[ \t]*$/mu,NO_MODEL_INVOCATION=/^disable-model-invocation:[ \t]*true[ \t]*$/mu;
const fail=code=>{throw Object.assign(Error(code),{code});};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
/** @typedef {{name:string,version:string,skills:{skillId:string,skillVersion:string,name:string,proseSha256:string}[],excluded:{skillId:string,skillVersion:string,reason:string}[]}} SkillPluginDescription */
/** Derived from the immutable identity; a present frontmatter name must agree, and an asset without SDK frontmatter is listed as excluded.
 * @param {{selection?:any}} [options] @returns {Readonly<SkillPluginDescription>} */
export function describeSkillPlugin({selection}={}){
 const skills=[],excluded=[],order=[];
 const selected=selection===undefined?undefined:selectSkill(selection.skillId,selection.skillVersion);
 if(selected&&canonicalSha256(selected.pin)!==canonicalSha256(selection))fail('SKILL_PLUGIN_SELECTION_PIN');
 for(const {skillId,skillVersion} of listSkills()){
  const {prose,pin}=selectSkill(skillId,skillVersion),expected='meri-'+skillId.replace(/^quick_skill\./u,'').replaceAll('_','-'),front=FRONTMATTER.exec(prose)?.[1];
  if(front===undefined){excluded.push({skillId,skillVersion,reason:'NO_SDK_FRONTMATTER'});continue;}
  if(NAME.exec(front)?.[1]!==expected||!NO_MODEL_INVOCATION.test(front))fail('SKILL_PLUGIN_FRONTMATTER');
  if(!order.includes(skillId))order.push(skillId);
  const preferred=selected?.pin.skillId===skillId?selected.pin.skillVersion:assets.sdkDefaults?.[skillId];
  if(preferred!==undefined&&skillVersion!==preferred){excluded.push({skillId,skillVersion,reason:'NOT_SELECTED_SDK_VERSION'});continue;}
  skills.push({skillId,skillVersion,name:expected,proseSha256:pin.proseSha256});
 }
 if(selected&&!skills.some(s=>s.skillId===selected.pin.skillId&&s.skillVersion===selected.pin.skillVersion))fail('SKILL_PLUGIN_SELECTION_REFUSED');
 for(const [skillId,skillVersion]of Object.entries(assets.sdkDefaults??{}))if(!skills.some(s=>s.skillId===skillId&&(selected?.pin.skillId===skillId||s.skillVersion===skillVersion)))fail('SKILL_PLUGIN_DEFAULT_REFUSED');
 if(new Set(skills.map(s=>s.name)).size!==skills.length)fail('SKILL_PLUGIN_NAME_COLLISION');
 skills.sort((a,b)=>order.indexOf(a.skillId)-order.indexOf(b.skillId));
 return freeze({name:PLUGIN_NAME,version:'1.0.0',skills,excluded});
}
/** Writes `.claude-plugin/plugin.json` and `skills/<name>/SKILL.md` into a fresh owner-only directory; refuses an existing target and removes everything it created on failure.
 * @param {{directory:string,selection?:any}} options */
export async function materializeSkillPlugin({directory,selection}){
 if(typeof directory!=='string'||!isAbsolute(directory)||directory.includes('/../')||directory.endsWith('/')||directory.includes('\0'))fail('SKILL_PLUGIN_DIRECTORY_REFUSED');
 const plugin=describeSkillPlugin({selection});
 try{await mkdir(directory,{mode:0o700});}catch{fail('SKILL_PLUGIN_DIRECTORY_REFUSED');}
 try{
  await mkdir(join(directory,'.claude-plugin'),{mode:0o700});
  await writeFile(join(directory,'.claude-plugin','plugin.json'),JSON.stringify({name:plugin.name,version:plugin.version,description:'Immutable versioned Meri skills. Explicit persisted selection overrides the default; model invocation is disabled.'},null,2)+'\n',{mode:0o600,flag:'wx'});
  for(const skill of plugin.skills){
   const target=join(directory,'skills',skill.name),file=join(target,'SKILL.md');await mkdir(target,{recursive:true,mode:0o700});
   await writeFile(file,Buffer.from(selectSkill(skill.skillId,skill.skillVersion).prose,'utf8'),{mode:0o600,flag:'wx'});
   if(createHash('sha256').update(await readFile(file)).digest('hex')!==skill.proseSha256)fail('SKILL_PLUGIN_PROSE_PIN');
  }
  return freeze({directory,...plugin});
 }catch(error){await rm(directory,{recursive:true,force:true});throw error;}
}
