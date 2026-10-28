/** Additive conversation-intents distribution (list/decide). Imports never generate or connect to services; generation reads the
 * canonical HTTP/approval owners and writes only intents-application artifacts. Canonical esbuild/json-schema-to-typescript backend only. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve,relative,isAbsolute} from 'node:path';
import {intentsSchema,INTENT_PHASES} from './intents-application/schema.mjs';
import {createIntentsMetadata} from './intents-application/protocol.mjs';
import * as application from '../../apps/control/intents/application-protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function tooling(root){const locate=root?createRequire(resolve(root,'package.json')):createRequire(import.meta.url),load=name=>import(pathToFileURL(locate.resolve(name)).href);return Promise.all([load('esbuild'),load('json-schema-to-typescript')]);}
export async function generateIntentsContracts({check=false,toolchainRoot}={}){
 const [{default:Ajv},{default:formats},{default:standalone},[esbuild,compiler]]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),tooling(toolchainRoot)]);
 try{
  const sources=new Map(),record=async path=>{const raw=await readFile(new URL(path,HERE));sources.set(path,{path,sha256:hash(raw),bytes:raw.length});return raw;};
  const originals=new Map();
  for(const path of ['retrieval-0.2/note-action.schema.json','retrieval-0.2/watch-action.schema.json','retrieval-0.2/legislative-document-action.schema.json','retrieval-0.2/bizdev-action.schema.json','retrieval-0.2/client-record-action.schema.json','retrieval-0.3/client-record-action.schema.json','retrieval-0.2/legiwatch-relevance.schema.json','retrieval-0.2/legiwatch-action.schema.json','retrieval-0.2/research-portfolio-sharing.schema.json','retrieval-0.2/research-portfolio-action.schema.json','meri.schema.json','commands-0.2/task-create.schema.json','commands-0.2/task-update.schema.json','commands-0.2/mail-send.schema.json','commands-0.2/document-draft.schema.json','commands-0.2/memory-propose.schema.json','commands-0.2/artifact-file.schema.json','artifacts-0.2/artifact.schema.json','schedules-0.2/tool-interface.schema.json','schedules-0.2/lifecycle.schema.json','schedules-0.2/inspection.schema.json']){const raw=await record(path),schema=JSON.parse(raw);originals.set(schema.$id,{schema,path});}
  const errors=(await record('../../apps/control/product-access/errors.mjs')).toString(),fieldPattern=/const FIELD=\/(.+)\/u;/u.exec(errors)?.[1];if(!fieldPattern)throw Error('Missing canonical product error field pattern');
  for(const name of ['INTENTS_PATHS','INTENTS_LIMITS','INTENTS_ERROR_OUTCOMES','INTENTS_ERROR_STATUSES','INTENTS_APPROVABLE_ACTIONS','INTENTS_FAILURE_CODES'])if(application[name]===undefined)throw Error('Missing canonical intents declaration '+name);
  const config={paths:application.INTENTS_PATHS,limits:application.INTENTS_LIMITS,errorStatuses:application.INTENTS_ERROR_STATUSES,errorOutcomes:application.INTENTS_ERROR_OUTCOMES,failureCodes:application.INTENTS_FAILURE_CODES,approvableActions:application.INTENTS_APPROVABLE_ACTIONS,fieldPattern};
  const metadata=createIntentsMetadata(config);
  for(const path of ['generate-intents.mjs',...['README.md','schema.mjs','protocol.mjs','boundary.mjs','semantics.mjs','routines.mjs','receive.mjs'].map(name=>'intents-application/'+name),'document-application/boundary.mjs',
   'schedules-0.2/application-protocol.mjs','../../apps/control/schedules/application.mjs','../../apps/control/schedules/application-http.mjs','artifacts-0.2/artifact-formats.mjs','commands-0.2/document-draft-validation.mjs','commands-0.2/mail-send-validation.mjs','commands-0.2/memory-review-result.mjs',
   '../../apps/control/intents/application-protocol.mjs','../../apps/control/intents/http.mjs','../../apps/control/intents/approval.mjs','../../apps/control/intents/faults.mjs','../../apps/control/product-access/http.mjs'])await record(path);
  // Canonical shapes are copied into this schema as local definitions so the distribution has no external schema reference.
  const root=intentsSchema(config),defs={},seen=new Map();
  function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;const out={};
   for(const[key,v]of Object.entries(value)){if(key!=='$ref'){out[key]=transform(v,owner);continue;}const[urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;if(id===root.$id){out[key]='#'+fragment;continue;}
    if(!seen.has(full)){const original=originals.get(id);if(!original)throw Error('Missing canonical schema '+id);const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);let target=original.schema;for(const token of fragment.split('/').slice(1))target=target[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}out[key]='#/$defs/'+seen.get(full);
   }return out;}
  root.$defs={...transform(root.$defs,root.$id),...defs};
  const names=Object.keys(root.$defs).filter(name=>!name.startsWith('Canonical_'));
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);const refs={};for(const name of names){const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs['validate'+name]=ref;}
  const generated=standalone(ajv,refs)+'\nexport const validators={'+names.map(name=>name+':validate'+name).join(',')+'};\n';
  const protocol='import {createIntentsMetadata} from '+JSON.stringify(fileURLToPath(new URL('intents-application/protocol.mjs',HERE)))+';export const intentsPaths=Object.freeze('+JSON.stringify(config.paths)+');export const intentsMetadata=createIntentsMetadata('+JSON.stringify(config)+');';
  // preserveSymlinks keeps every input under this package's own node_modules path, so the bundle's comments and CommonJS labels read
  // `node_modules/<package>/...` whatever checkout, worktree or link layout supplied the installed packages.
  const bundled=await esbuild.build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('intents-application/receive.mjs',HERE),'utf8'),sourcefile:'intents-application-receiver.mjs',resolveDir:resolve(dir,'intents-application')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,preserveSymlinks:true,
   plugins:[{name:'intents-generated',setup(b){b.onResolve({filter:/^\.\/generated-(validator|protocol)\.mjs$/},a=>({path:a.path,namespace:'intents-generated'}));b.onLoad({filter:/.*/,namespace:'intents-generated'},a=>({contents:a.path.includes('validator')?generated:protocol,resolveDir:dir,loader:'js'}));}}]});
  if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Intents browser external import');
  // Output must not depend on where the checkout sits: no parent-relative, drive-letter or home-directory path in any comment or module label.
  const leak=/^(?:\/\/ |\s+")[^\n]*(?:\.\.\/|(?<![A-Za-z0-9])[A-Za-z]:[\\/](?!\/)|\/(?:home|Users)\/)/mu.exec(bundled.outputFiles[0].text);if(leak)throw Error('Intents bundle embeds checkout layout: '+leak[0].slice(0,120));
  const declarations=await compiler.compile({title:'IntentsApplicationEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:root.$defs},'IntentsApplicationEnvelope',{bannerComment:'// Generated additive intents contract from its canonical HTTP/approval owners. No authority implied.',additionalProperties:false,style:{singleQuote:true}});
  // The canonical compiler emits the referenced declaration and elides alias-only definitions.
  // Restore the public aliases using those emitted names without copying their schema or pinning generated hashes.
  const exported=[...declarations.matchAll(/export (?:interface|type) ([A-Za-z0-9_]+)/gu)].map(match=>match[1]);
  const typeKey=name=>name.replaceAll('_','').toLowerCase();
  const aliases=['IntentsWatchProposal','IntentsLegiwatchProposal','IntentsBizdevProposal','IntentsResearchShareProposal','IntentsResearchActionProposal','RoutinesProposal','RoutinesApproveResponse','RoutinesListRequest','RoutinesListResponse'].map(name=>{
   if(exported.includes(name))return '';
   const canonical=root.$defs[name].$ref.split('/').at(-1),matches=exported.filter(value=>typeKey(value)===typeKey(canonical));
   if(matches.length!==1)throw Error('Missing canonical declaration for '+name);
   return 'export type '+name+'='+matches[0]+';';
  }).join('\n');
  const api=`
${aliases}
export type RoutinesRoute='prepare'|'approve'|'list'|'reconcile';
export interface RoutinesRequestMap {prepare:RoutinesPrepareRequest;approve:RoutinesApproveRequest;list:RoutinesListRequest;reconcile:RoutinesReconcileRequest;}
export interface RoutinesResponseMap {prepare:RoutinesPrepareResponse;approve:RoutinesApproveResponse;list:RoutinesListResponse;reconcile:RoutinesReconcileResponse;}
export interface RoutinesExpectationMap {prepare:{request:RoutinesPrepareRequest};approve:{request:RoutinesApproveRequest;proposal:RoutinesProposal};list:{request:RoutinesListRequest};reconcile:{request:RoutinesReconcileRequest;proposal:RoutinesProposal};}
export type RoutinesResponse<R extends RoutinesRoute>=RoutinesResponseMap[R]|RoutinesErrorResponse;
export declare const routinesPaths:Readonly<{prepare:'/api/routines/prepare';approve:'/api/routines/approve';list:'/api/routines/list';reconcile:'/api/routines/reconcile'}>;
export declare const routinesMetadata:Readonly<{version:'0.1.0';routes:typeof routinesPaths;limits:{requestBytes:131072;responseBytes:2097152}}>;
export declare function receiveRoutinesRequest<R extends RoutinesRoute>(route:R,jsonText:unknown):Promise<RoutinesRequestMap[R]>;
export declare function receiveRoutinesResponse<R extends RoutinesRoute>(route:R,httpStatus:number,jsonText:unknown,expectation:RoutinesExpectationMap[R]):Promise<RoutinesResponse<R>>;
export declare const routineManagementSessionPath:'/api/routines/session';
export declare function receiveRoutineManagementSessionRequest(jsonText:unknown):RoutinesManagementSessionRequest;
export declare function receiveRoutineManagementSessionReceipt(jsonText:unknown,expected:RoutinesManagementContext,at:number):RoutinesManagementSessionReceipt;
export type IntentsRoute='list'|'decide';
export interface IntentsRequestMap {list:IntentsListRequest;decide:IntentsDecideRequest;}
export interface IntentsResponseMap {list:IntentsListResponse;decide:IntentsDecideResponse;}
export interface IntentsExpectationMap {list:{request:IntentsListRequest};decide:{request:IntentsDecideRequest;proposal:IntentsProposal};}
export type IntentsResponse<R extends IntentsRoute>=IntentsResponseMap[R]|IntentsErrorResponse;
export declare class IntentsResponseError extends Error {readonly code:string;}
export declare const intentsVersion:'0.1.0';
export declare const intentsPaths:Readonly<${JSON.stringify(config.paths)}>;
export declare const intentsMetadata:${JSON.stringify(metadata,null,2)};
export declare function receiveIntentsRequest<R extends IntentsRoute>(route:R,jsonText:unknown):Promise<IntentsRequestMap[R]>;
export declare function receiveIntentsResponse<R extends IntentsRoute>(route:R,httpStatus:number,jsonText:unknown,expectation:IntentsExpectationMap[R]):Promise<IntentsResponse<R>>;
`;
  const schemaBytes=JSON.stringify(root,null,2)+'\n',outputs=new Map([
   ['intents-application.mjs','// Generated self-contained browser receiving boundary. No authority or deployment acceptance.\n'+bundled.outputFiles[0].text],['intents-application.d.ts',declarations+api],['intents-application.schema.json',schemaBytes],
   ['intents-application.metadata.json',JSON.stringify({...metadata,bundler:'esbuild',declarations:'json-schema-to-typescript',phases:INTENT_PHASES,sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),
    browserInputs:Object.keys(bundled.metafile.inputs).map(path=>{if(path.startsWith('\0'))return 'virtual:'+path.slice(1);const slash=path.replaceAll('\\','/'),modules=slash.lastIndexOf('/node_modules/');return modules>=0?slash.slice(modules+1):isAbsolute(path)?relative(dir,path).replaceAll('\\','/'):slash;}).sort(),browserImports:[]},null,2)+'\n'],
  ]);
  if(check){for(const[name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated intents drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
  return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
 }finally{esbuild?.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-intents.mjs [--check] | --help. Generation uses the canonical esbuild/json-schema-to-typescript tools (MERI_CONTRACT_TOOLCHAIN_ROOT optionally selects them). No installs/network; exit 1 on invalid arguments or drift.');
 else if(new Set(args).size!==args.length||args.some(a=>a!=='--check')){process.stderr.write('Invalid arguments\n');process.exitCode=1;}
 else generateIntentsContracts({check:args.includes('--check'),toolchainRoot:process.env.MERI_CONTRACT_TOOLCHAIN_ROOT}).then(r=>console.log(JSON.stringify(r,null,1)),e=>{process.stderr.write(String(e?.message??e)+'\n');process.exitCode=1;});}
