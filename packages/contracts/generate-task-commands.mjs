/** Additive task-update generator. Imports are inert; generation reads canonical owners and writes only task-command artifacts. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve,relative,isAbsolute} from 'node:path';
import {taskCommandSchema} from './task-command-application/schema.mjs';
import {createTaskCommandMetadata} from './task-command-application/protocol.mjs';
import {compileTaskCommandDeclarations} from './task-command-application/declarations.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
/** A borrowed installed toolchain may be selected without installing or changing package manifests. */
async function tooling(root){const locate=root?createRequire(resolve(root,'package.json')):createRequire(import.meta.url);const load=name=>import(pathToFileURL(locate.resolve(name)).href);return Promise.all([load('esbuild'),load('json-schema-to-typescript')]);}
export async function generateTaskCommandContracts({check=false,toolchainRoot,bundleRoot,typeModulesRoot,javascriptOnly=false,offline=false}={}){
 if(offline&&javascriptOnly)throw Error('Choose --offline or --javascript-only');
 // A check reproduces the artifact's backend. Normal generation deliberately keeps
 // the package's canonical esbuild/compiler default unless --offline is explicit.
 if(check){
  const recorded=JSON.parse(await readFile(new URL('dist/task-command-application.metadata.json',HERE),'utf8'));
  const mode=recorded.bundler==='rolldown'&&recorded.declarations==='json-schema-to-ts/typescript'?'offline':recorded.bundler==='rolldown'&&recorded.declarations==='not-generated'?'javascript-only':recorded.bundler==='esbuild'&&recorded.declarations==='json-schema-to-typescript'?'canonical':null;
  if(!mode)throw Error('Unknown recorded task-command generation backend');
  if(offline&&mode!=='offline'||javascriptOnly&&mode!=='javascript-only')throw Error('Requested task-command check backend differs from recorded artifacts');
  offline=mode==='offline';javascriptOnly=mode==='javascript-only';
 }
 if(offline&&(!bundleRoot||!typeModulesRoot))throw Error('Recorded offline generation requires MERI_CONTRACT_BUNDLE_ROOT (installed Rolldown/TypeScript) and MERI_CONTRACT_TYPE_MODULES (installed json-schema-to-ts/ts-algebra); no installation is performed');
 const offlineBundle=offline||javascriptOnly;
 const [{default:Ajv},{default:formats},{default:standalone},builder]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),offlineBundle?import(pathToFileURL(createRequire(resolve(bundleRoot??dir,'package.json')).resolve('rolldown')).href):tooling(toolchainRoot)]);
 const [esbuild,compiler]=offlineBundle?[]:builder;
 try{
  const originals=new Map(),sources=new Map();
  const record=async path=>{const raw=await readFile(new URL(path,HERE));sources.set(path,{path,sha256:hash(raw),bytes:raw.length});return raw;};
  for(const path of ['meri.schema.json','commands-0.2/task-update.schema.json']){const raw=await record(path),schema=JSON.parse(raw);originals.set(schema.$id,{schema,path});}
  const httpPaths=['../../apps/control/action-application/http.mjs',...['http','index','session'].map(name=>'../../apps/control/task-command-application/'+name+'.mjs')];
  let http='';for(const path of httpPaths)http+=(await record(path)).toString()+'\n';
  const statuses={REQUEST_FAILED:502},codeList=/const codes=new Set\(\[([^\]]+)\]\)/u.exec(http),outcomeList=/const outcomes=new Set\(\[([^\]]+)\]\)/u.exec(http);
  if(!codeList||!outcomeList)throw Error('Missing canonical task-command HTTP vocabulary');
  for(const match of codeList[1].matchAll(/'([^']+)'/gu))statuses[match[1]]=502;
  for(const match of http.matchAll(/fail\('([A-Z0-9_]+)'(?:,(\d+))?\)/gu))statuses[match[1]]=Number(match[2]??400);
  for(const match of http.matchAll(/code==='([A-Z0-9_]+)'\)status=(\d+)/gu))statuses[match[1]]=Number(match[2]);
  const runtime=await record('../../apps/runtime/product-applications.mjs');
  const mount=/code:'TASK_COMMAND_UNAVAILABLE',outcome:'NOT_DISPATCHED'\}\},\{status:(\d+)/u.exec(runtime.toString());if(!mount)throw Error('Missing canonical task-command runtime availability vocabulary');statuses.TASK_COMMAND_UNAVAILABLE=Number(mount[1]);
  const errorStatuses=Object.fromEntries(Object.entries(statuses).sort(([a],[b])=>a.localeCompare(b))),errorOutcomes=[...outcomeList[1].matchAll(/'([^']+)'/gu)].map(m=>m[1]);
  for(const path of ['generate-task-commands.mjs',...['README.md','protocol.mjs','schema.mjs','boundary.mjs','normalizer-snapshot.mjs','semantics.mjs','receive.mjs','declarations.mjs'].map(name=>'task-command-application/'+name),'commands-0.2/task-update-validation.mjs','document-application/boundary.mjs'])await record(path);
  const root=taskCommandSchema(errorStatuses,errorOutcomes),defs={},seen=new Map();
  function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;const out={};
   for(const[key,v]of Object.entries(value)){if(key!=='$ref'){out[key]=transform(v,owner);continue;}const[urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;if(id===root.$id){out[key]='#'+fragment;continue;}
    if(!seen.has(full)){const original=originals.get(id);if(!original)throw Error('Missing canonical schema '+id);const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);let target=original.schema;for(const token of fragment.split('/').slice(1))target=target[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}out[key]='#/$defs/'+seen.get(full);
   }return out;
  }
  root.$defs={...transform(root.$defs,root.$id),...defs};
  const names=Object.keys(root.$defs).filter(name=>!name.startsWith('Canonical_'));
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);const refs={};for(const name of names){const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs['validate'+name]=ref;}
  const generated=standalone(ajv,refs)+'\nexport const validators={'+names.map(name=>name+':validate'+name).join(',')+'};\n';
  let bundled;
  if(offlineBundle){
   const virtual='\0task-command-generated-',source=JSON.stringify(errorStatuses)+';export const errorOutcomes='+JSON.stringify(errorOutcomes)+';';
   const bundle=await builder.rolldown({cwd:dir,input:fileURLToPath(new URL('task-command-application/receive.mjs',HERE)),platform:'browser',plugins:[{name:'task-command-canonical-offline',resolveId(id){if(/^\.\/generated-(validator|status)\.mjs$/u.test(id))return virtual+(id.includes('validator')?'validator':'status');if(id==='../retrieval-0.2/operation-contracts.mjs')return fileURLToPath(new URL('task-command-application/normalizer-snapshot.mjs',HERE));},load(id){if(id===virtual+'validator')return generated;if(id===virtual+'status')return 'export const errorStatuses='+source;}}]});
   try{const result=await bundle.generate({format:'es',codeSplitting:false}),chunks=result.output.filter(o=>o.type==='chunk');if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('Task command browser external import');bundled={outputFiles:[{text:chunks[0].code.replace(/^\/\/#(?:end)?region[^\r\n]*\r?\n/gmu,'')}],metafile:{inputs:Object.fromEntries(Object.keys(chunks[0].modules).map(path=>[path,{}])),outputs:{browser:{imports:[]}}}};}finally{await bundle.close();}
  }else bundled=await esbuild.build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('task-command-application/receive.mjs',HERE),'utf8'),sourcefile:'task-command-application-receiver.mjs',resolveDir:resolve(dir,'task-command-application')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,plugins:[
   {name:'task-command-generated',setup(b){b.onResolve({filter:/^\.\/generated-(validator|status)\.mjs$/},a=>({path:a.path,namespace:'task-command-generated'}));b.onLoad({filter:/.*/,namespace:'task-command-generated'},a=>({contents:a.path.includes('validator')?generated:'export const errorStatuses='+JSON.stringify(errorStatuses)+';export const errorOutcomes='+JSON.stringify(errorOutcomes)+';',resolveDir:dir,loader:'js'}));}},
   {name:'task-command-normalizer-boundary',setup(b){b.onResolve({filter:/^\.\.\/retrieval-0\.2\/operation-contracts\.mjs$/},()=>({path:fileURLToPath(new URL('task-command-application/normalizer-snapshot.mjs',HERE))}));}},
  ]});
  if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Task command browser external import');
  const declarations=javascriptOnly?null:offline?await compileTaskCommandDeclarations(root,names,{typescriptRoot:bundleRoot,typeModulesRoot}):await compiler.compile({title:'TaskCommandApplicationEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:root.$defs},'TaskCommandApplicationEnvelope',{bannerComment:'// Generated additive task-command contract from canonical schemas. No authorization implied.',additionalProperties:false,style:{singleQuote:true}});
  const metadata=createTaskCommandMetadata(errorStatuses,errorOutcomes),api=`
export type TaskCommandRoute='prepare'|'execute';
export interface TaskCommandRequestMap {prepare:TaskCommandPrepareRequest;execute:TaskCommandExecuteRequest;}
export interface TaskCommandResponseMap {prepare:TaskCommandPrepareResponse;execute:TaskCommandExecuteResponse;}
export interface TaskCommandExpectationMap {prepare:{binding:Readonly<TaskCommandExpectedBinding>;request:TaskCommandPrepareRequest};execute:{binding:Readonly<TaskCommandExpectedBinding>;proposal:TaskUpdateApprovalProposal};}
export type TaskCommandResponse<R extends TaskCommandRoute>=TaskCommandResponseMap[R]|TaskCommandErrorResponse;
export declare class TaskCommandResponseError extends Error {readonly code:string;}
export declare const taskCommandVersion:'0.1.0';
export declare const taskCommandPaths:Readonly<{prepare:'/api/task-commands/prepare';execute:'/api/task-commands/execute'}>;
export declare const taskCommandMetadata:${JSON.stringify(metadata,null,2)};
export declare function receiveTaskCommandRequest<R extends TaskCommandRoute>(route:R,jsonText:unknown):Promise<TaskCommandRequestMap[R]>;
export declare function receiveTaskCommandResponse<R extends TaskCommandRoute>(route:R,httpStatus:number,jsonText:unknown,expectation:TaskCommandExpectationMap[R]):Promise<TaskCommandResponse<R>>;
`;
  const schemaBytes=JSON.stringify(root,null,2)+'\n',outputs=new Map([
   ['task-command-application.mjs','// Generated self-contained browser receiving boundary. No authority.\n'+bundled.outputFiles[0].text],
   ['task-command-application.schema.json',schemaBytes],
   ['task-command-application.metadata.json',JSON.stringify({...metadata,declarations:javascriptOnly?'not-generated':offline?'json-schema-to-ts/typescript':'json-schema-to-typescript',bundler:offlineBundle?'rolldown':'esbuild',sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),browserInputs:Object.keys(bundled.metafile.inputs).map(path=>{if(path.startsWith('\0'))return 'virtual:'+path.slice(1);const slash=path.replaceAll('\\','/'),modules=slash.lastIndexOf('/node_modules/');return modules>=0?slash.slice(modules+1):isAbsolute(path)?relative(dir,path).replaceAll('\\','/'):slash;}).sort(),browserImports:[]},null,2)+'\n'],
  ]);
  if(declarations!==null)outputs.set('task-command-application.d.ts',declarations+api);
  if(check){for(const[name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated task command drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
  return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
 }finally{esbuild?.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-task-commands.mjs [--check] [--offline|--javascript-only] | --help; --check selects the backend recorded in artifact metadata and rejects conflicting flags. Normal generation defaults to canonical esbuild/compiler at MERI_CONTRACT_TOOLCHAIN_ROOT. --offline uses installed Rolldown/TypeScript at MERI_CONTRACT_BUNDLE_ROOT and json-schema-to-ts/ts-algebra at MERI_CONTRACT_TYPE_MODULES; --javascript-only leaves declarations ungenerated. No installs/network; exit1 invalid arguments/drift.');else if(new Set(args).size!==args.length||args.some(a=>!['--check','--offline','--javascript-only'].includes(a))){process.stderr.write('Invalid arguments\n');process.exitCode=1;}else generateTaskCommandContracts({check:args.includes('--check'),offline:args.includes('--offline'),javascriptOnly:args.includes('--javascript-only'),toolchainRoot:process.env.MERI_CONTRACT_TOOLCHAIN_ROOT,bundleRoot:process.env.MERI_CONTRACT_BUNDLE_ROOT,typeModulesRoot:process.env.MERI_CONTRACT_TYPE_MODULES}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});}
