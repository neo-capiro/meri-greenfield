/** Browser launcher data derived from verified immutable assets. No grants or runtime activation. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {listSkills,selectSkill} from './index.mjs';
import {originalRuntimeSupports} from './runtime-support.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function generateSkillCatalog({check=false}={}){
 const rows=listSkills().map(pin=>{
  const selected=selectSkill(pin.skillId,pin.skillVersion),runtimeSupported=originalRuntimeSupports(pin);
  return {...selected.pin,label:pin.skillId.replace(/^quick_skill\./u,'').replaceAll('_',' '),runtimeSupported,available:false,
   unavailableReason:runtimeSupported?'CURRENT_INSTALLATION_REQUIRED':'RUNTIME_NOT_QUALIFIED',subjectKinds:selected.manifest.subjectKinds,
   windowBases:selected.manifest.windowBases,requiredSources:selected.manifest.requiredSources,operations:selected.manifest.allowedOperations};
 });
 const files=['assets.json','index.mjs','runtime-support.mjs','generate-browser-catalog.mjs'],sources=[];
 for(const path of files){const b=await readFile(new URL(path,import.meta.url));sources.push({path,sha256:hash(b)});}
 const outputs=new Map([
  ['skill-catalog.mjs',`// Generated from packages/skills; availability requires a fresh installation receipt.\nconst freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};\nexport const skillCatalog=freeze(${JSON.stringify({schemaVersion:1,skills:rows},null,2)});\n`],
  ['skill-catalog.d.ts',`// Generated launcher data. No authorization is implied.\nexport type SkillCatalogEntry=Readonly<{skillId:string;skillVersion:string;manifestSha256:string;proseSha256:string;catalogSha256:string;label:string;runtimeSupported:boolean;available:false;unavailableReason:'CURRENT_INSTALLATION_REQUIRED'|'RUNTIME_NOT_QUALIFIED';subjectKinds:readonly string[];windowBases:readonly string[];requiredSources:readonly Readonly<{sourceId:string;authority:string;purpose:string}>[];operations:readonly Readonly<{id:string;version:string}>[]}>;\nexport declare const skillCatalog:Readonly<{schemaVersion:1;skills:readonly SkillCatalogEntry[]}>;\n`],
  ['skill-catalog.metadata.json',JSON.stringify({schemaVersion:1,sources,identities:new Set(rows.map(r=>r.skillId)).size,versions:rows.length},null,2)+'\n'],
 ]);
 for(const [file,content] of outputs){const target=new URL('../contracts/dist/'+file,import.meta.url);if(check){if(await readFile(target,'utf8')!==content)throw Error('SKILL_CATALOG_GENERATED_DRIFT');}else await writeFile(target,content);}
 return {identities:new Set(rows.map(r=>r.skillId)).size,versions:rows.length};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-browser-catalog.mjs [--check|--help]. Offline generation; exit 1 on invalid arguments or drift.');
 else if(args.length>1||args.length&&args[0]!=='--check'){console.error('Invalid arguments');process.exitCode=1;}
 else generateSkillCatalog({check:args[0]==='--check'}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});
}
