/** Source-only contract generation; no application build, install or network. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {federalWorkbenchSchema,retainedFederalSchema} from './federal-workbench/schema.mjs';
const here=fileURLToPath(new URL('./',import.meta.url)),hash=x=>createHash('sha256').update(x).digest('hex');
export async function generateFederalWorkbench({outDir=resolve(here,'dist'),check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},esbuild,compiler]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 try{
  const root=structuredClone(federalWorkbenchSchema),originals=new Map([[root.$id,root],[retainedFederalSchema.$id,retainedFederalSchema]]),sources=[];
  for(const path of ['meri.schema.json','artifacts-0.2/artifact.schema.json','retrieval-0.2/federal-draft-source.schema.json']){
   const raw=await readFile(resolve(here,path));const s=JSON.parse(raw);originals.set(s.$id,s);sources.push({path,sha256:hash(raw)});
  }
  const defs={},seen=new Map();
  function transform(value,owner){
   if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;
   return Object.fromEntries(Object.entries(value).map(([k,v])=>{
    if(k!=='$ref')return[k,transform(v,owner)];const [urn,pointer]=v.split('#'),id=urn||owner;
    if(id===root.$id)return[k,'#'+pointer];const full=id+'#'+pointer;
    if(!seen.has(full)){const name=pointer.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);
     let target=originals.get(id);for(const token of pointer.split('/').slice(1))target=target?.[token.replaceAll('~1','/').replaceAll('~0','~')];
     if(!target)throw Error('Missing schema '+full);defs[name]=transform(target,id);}
    return[k,'#/$defs/'+seen.get(full)];
   }));
  }
  root.$defs={...transform(root.$defs,root.$id),...defs};
  const ajv=new Ajv({strict:true,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);
  const entries={validateSource:'FederalCompilerSource',validateSourceEnvelope:'FederalSourceEnvelope',validateImport:'FederalImportRequest',validateImported:'FederalImportResult',validatePrepare:'FederalPrepareRequest',validateLoad:'FederalLoadRequest',validatePublish:'FederalPublishRequest',validateReview:'FederalReview',validatePublication:'FederalPublication',validateError:'FederalError'},refs={};
  for(const [name,def]of Object.entries(entries)){const ref=root.$id+'#/$defs/'+def;ajv.compile({$ref:ref});refs[name]=ref;}
  const generated=standalone(ajv,refs);
  const bundle=await esbuild.build({absWorkingDir:here,entryPoints:['federal-workbench/receive.mjs'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',metafile:true,preserveSymlinks:true,
   plugins:[{name:'federal-validator',setup(b){b.onResolve({filter:/^\.\/generated-validator\.mjs$/},()=>({path:'validator',namespace:'federal'}));b.onLoad({filter:/.*/,namespace:'federal'},()=>({contents:generated,resolveDir:here,loader:'js'}));}}]});
  if(Object.values(bundle.metafile.outputs).some(o=>o.imports.length))throw Error('External browser imports');
  const declarations=await compiler.compile(root,'FederalWorkbench',{bannerComment:'/* Generated from canonical schemas. */',unreachableDefinitions:true});
  const api=await readFile(resolve(here,'federal-workbench/api.d.ts'),'utf8');
  for(const path of ['federal-workbench/schema.mjs','federal-workbench/receive.mjs','federal-workbench/api.d.ts','generate-federal-workbench.mjs']){
   sources.push({path,sha256:hash(await readFile(resolve(here,path)))});
  }
  const files={'federal-workbench.mjs':bundle.outputFiles[0].text,'federal-workbench.d.ts':declarations+'\n'+api,
   'federal-workbench.schema.json':JSON.stringify(root,null,2)+'\n','federal-workbench.metadata.json':JSON.stringify({version:'1.1.0',sources},null,2)+'\n'};
  if(!check)await mkdir(outDir,{recursive:true});
  for(const [name,bytes]of Object.entries(files)){const path=resolve(outDir,name);if(check){if(await readFile(path,'utf8')!==bytes)throw Error('Contract drift: '+name);}else await writeFile(path,bytes);}
  return Object.keys(files);
 }finally{esbuild.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.length>1||args.length&&args[0]!=='--check')throw Error('Usage: node generate-federal-workbench.mjs [--check]');
 console.log(await generateFederalWorkbench({check:args[0]==='--check'}));
}
