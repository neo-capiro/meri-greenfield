import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {actionSchema} from './action-application/schema.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function generateActionContracts({check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},{build},{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 const originals=new Map(),sources=new Map();
 for(const folder of ['', 'retrieval-0.2/','commands-0.2/'])for(const name of await readdir(new URL(folder,HERE))){if(!name.endsWith('.schema.json'))continue;const path=folder+name,raw=await readFile(new URL(path,HERE)),schema=JSON.parse(raw);originals.set(schema.$id,{schema,path,sha256:hash(raw),bytes:raw.length});}
 const httpFiles=['http.mjs','index.mjs','session.mjs'];let http='';for(const name of httpFiles){const path='../../apps/control/action-application/'+name,raw=await readFile(new URL(path,HERE));http+=raw.toString()+'\n';sources.set(path,{path,sha256:hash(raw),bytes:raw.length});}
 const statuses={REQUEST_FAILED:502};
 const list=/const codes=new Set\(\[([^\]]+)\]\)/u.exec(http);if(!list)throw Error('Missing canonical error vocabulary');
 for(const match of list[1].matchAll(/'([^']+)'/gu))statuses[match[1]]=502;
 for(const match of http.matchAll(/fail\('([A-Z_]+)'(?:,(\d+))?\)/gu))statuses[match[1]]=Number(match[2]??400);
 for(const match of http.matchAll(/code==='([A-Z_]+)'\)status=(\d+)/gu))statuses[match[1]]=Number(match[2]);
 const statusEntries=Object.fromEntries(Object.entries(statuses).sort(([a],[b])=>a.localeCompare(b)));
 const root=actionSchema(Object.keys(statusEntries)),defs={},seen=new Map();
 function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;
  const out={};for(const [key,v]of Object.entries(value)){if(key==='$ref'){
   const [urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;
   if(id===root.$id){out[key]='#'+fragment;continue;}
   if(!seen.has(full)){const original=originals.get(id);if(!original)throw Error('Missing schema owner '+id);const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);sources.set(original.path,{path:original.path,sha256:original.sha256,bytes:original.bytes});let target=original.schema;for(const token of fragment.split('/').slice(1))target=target[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}
   out[key]='#/$defs/'+seen.get(full);
  }else out[key]=transform(v,owner);}return out;}
 const primary=transform(root.$defs,root.$id);root.$defs={...primary,...defs};
 const names=['ActionQueryResponse','ActionDraftResponse','ActionPrepareResponse','ActionExecuteResponse','ActionErrorResponse'];
 const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);
 const exportNames=['validateQuery','validateDraft','validatePrepare','validateExecute','validateError'];const exports={};names.forEach((name,i)=>{const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});exports[exportNames[i]]=ref;});
 const generated=standalone(ajv,exports),statusSource='export const errorStatuses='+JSON.stringify(statusEntries)+';';
 const bundled=await build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('action-application/receive.mjs',HERE),'utf8'),sourcefile:'action-application-receiver.mjs',resolveDir:dir},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,plugins:[{name:'action-generated',setup(b){b.onResolve({filter:/^\.\/generated-(validator|status)\.mjs$/},a=>({path:a.path,namespace:'action-generated'}));b.onLoad({filter:/.*/,namespace:'action-generated'},a=>({contents:a.path.includes('validator')?generated:statusSource,resolveDir:dir,loader:'js'}));}}]});
 if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Action browser external import');
 const declarations=await compile({title:'ActionApplicationEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:root.$defs},'ActionApplicationEnvelope',{bannerComment:'// Generated from canonical action receiving schema. No authorization implied.',additionalProperties:false,style:{singleQuote:true}});
 const api="\nexport type ActionRoute = 'query' | 'draft' | 'prepare' | 'execute';\nexport interface ActionResponseMap { query: ActionQueryResponse; draft: ActionDraftResponse; prepare: ActionPrepareResponse; execute: ActionExecuteResponse; }\nexport type ActionResponse<R extends ActionRoute> = ActionResponseMap[R] | ActionErrorResponse;\nexport declare class ActionResponseError extends Error { readonly code: string; }\nexport declare function receiveActionResponse<R extends ActionRoute>(route:R,httpStatus:number,jsonText:unknown):Promise<ActionResponse<R>>;\n";
 const outputs=new Map([['action-application.mjs','// Generated browser receiving boundary; no authority.\n'+bundled.outputFiles[0].text],['action-application.d.ts',declarations+api],['action-application.schema.json',JSON.stringify(root,null,2)+'\n'],['action-application.metadata.json',JSON.stringify({packageVersion:'0.1.1',schemaId:root.$id,sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(JSON.stringify(root,null,2)+'\n'),browserInputs:Object.keys(bundled.metafile.inputs).sort()},null,2)+'\n']]);
 if(check){for(const [name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
 return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-actions.mjs [--check|--help]; offline deterministic build; exit1 invalid arguments/drift.');else if(args.length>1||(args.length&&args[0]!=='--check')){process.stderr.write('Invalid arguments\n');process.exitCode=1;}else generateActionContracts({check:args[0]==='--check'}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});}
