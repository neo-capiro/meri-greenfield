/** Additive data-access center distribution (read). Imports never generate or connect to services; generation reads the canonical
 * route/reader owners and writes only data-access-application artifacts. Canonical esbuild/json-schema-to-typescript backend only. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve,relative,isAbsolute} from 'node:path';
import {dataAccessSchema} from './data-access-application/schema.mjs';
import {createDataAccessMetadata} from './data-access-application/protocol.mjs';
import * as application from '../../apps/control/data-access/protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function tooling(root){const locate=root?createRequire(resolve(root,'package.json')):createRequire(import.meta.url),load=name=>import(pathToFileURL(locate.resolve(name)).href);return Promise.all([load('esbuild'),load('json-schema-to-typescript')]);}
export async function generateDataAccessContracts({check=false,toolchainRoot}={}){
 const [{default:Ajv},{default:formats},{default:standalone},[esbuild,compiler]]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),tooling(toolchainRoot)]);
 try{
  const sources=new Map(),record=async path=>{const raw=await readFile(new URL(path,HERE));sources.set(path,{path,sha256:hash(raw),bytes:raw.length});return raw;};
  const errors=(await record('../../apps/control/product-access/errors.mjs')).toString(),fieldPattern=/const FIELD=\/(.+)\/u;/u.exec(errors)?.[1];if(!fieldPattern)throw Error('Missing canonical product error field pattern');
  for(const name of ['DATA_ACCESS_PATH','DATA_ACCESS_LIMITS','DATA_ACCESS_ERROR_STATUSES','DATA_ACCESS_STATES','DATA_ACCESS_REQUIREMENTS'])if(application[name]===undefined)throw Error('Missing canonical data-access declaration '+name);
  const config={path:application.DATA_ACCESS_PATH,limits:application.DATA_ACCESS_LIMITS,errorStatuses:application.DATA_ACCESS_ERROR_STATUSES,states:application.DATA_ACCESS_STATES,requirements:application.DATA_ACCESS_REQUIREMENTS,fieldPattern};
  const metadata=createDataAccessMetadata(config);
  for(const path of ['generate-data-access.mjs',...['README.md','schema.mjs','protocol.mjs','receive.mjs'].map(name=>'data-access-application/'+name),'document-application/boundary.mjs',
   ...['protocol','reader','http'].map(name=>'../../apps/control/data-access/'+name+'.mjs'),'../../apps/runtime/product-ports/data-access.mjs','../../apps/runtime/product-ports/capability-policy.mjs',
   '../../apps/worker/conversation/reads/families.mjs','../../apps/worker/conversation/reads/family-guidance.mjs','../../apps/worker/conversation/reads/availability.mjs','../../apps/gateway/sources/capiro-data/handler.mjs',
   'retrieval-0.2/capiro-data-validation.mjs','../../apps/control/product-access/http.mjs'])await record(path);
  const root=dataAccessSchema(config),names=Object.keys(root.$defs);
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);const refs={};for(const name of names){const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs['validate'+name]=ref;}
  const generated=standalone(ajv,refs)+'\nexport const validators={'+names.map(name=>name+':validate'+name).join(',')+'};\n';
  const protocol='import {createDataAccessMetadata} from '+JSON.stringify(fileURLToPath(new URL('data-access-application/protocol.mjs',HERE)))+';export const dataAccessMetadata=createDataAccessMetadata('+JSON.stringify(config)+');';
  const bundled=await esbuild.build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('data-access-application/receive.mjs',HERE),'utf8'),sourcefile:'data-access-application-receiver.mjs',resolveDir:resolve(dir,'data-access-application')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,preserveSymlinks:true,
   plugins:[{name:'data-access-generated',setup(b){b.onResolve({filter:/^\.\/generated-(validator|protocol)\.mjs$/},a=>({path:a.path,namespace:'data-access-generated'}));b.onLoad({filter:/.*/,namespace:'data-access-generated'},a=>({contents:a.path.includes('validator')?generated:protocol,resolveDir:dir,loader:'js'}));}}]});
  if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Data-access browser external import');
  const leak=/^(?:\/\/ |\s+")[^\n]*(?:\.\.\/|(?<![A-Za-z0-9])[A-Za-z]:[\\/](?!\/)|\/(?:home|Users)\/)/mu.exec(bundled.outputFiles[0].text);if(leak)throw Error('Data-access bundle embeds checkout layout: '+leak[0].slice(0,120));
  const declarations=await compiler.compile({title:'DataAccessApplicationEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:root.$defs},'DataAccessApplicationEnvelope',{bannerComment:'// Generated additive data-access contract from its canonical route/reader owners. No authority implied.',additionalProperties:false,style:{singleQuote:true}});
  const api=`
export declare class DataAccessResponseError extends Error {readonly code:string;}
export declare const dataAccessVersion:'0.1.0';
export declare const dataAccessMetadata:${JSON.stringify(metadata,null,2)};
export declare function receiveDataAccessRequest(jsonText:unknown):DataAccessRequest;
export declare function receiveDataAccessResponse(httpStatus:number,jsonText:unknown,request:DataAccessRequest):DataAccessResponse|DataAccessErrorResponse;
`;
  // Every public definition must be declared under its own name; the envelope title is distinct so no member is renamed.
  for(const name of names)if(!new RegExp('export (?:interface|type) '+name+'[ =]','u').test(declarations))throw Error('Missing data-access declaration '+name);
  const schemaBytes=JSON.stringify(root,null,2)+'\n',outputs=new Map([
   ['data-access-application.mjs','// Generated self-contained browser receiving boundary. No authority or deployment acceptance.\n'+bundled.outputFiles[0].text],['data-access-application.d.ts',declarations+api],['data-access-application.schema.json',schemaBytes],
   ['data-access-application.metadata.json',JSON.stringify({...metadata,bundler:'esbuild',declarations:'json-schema-to-typescript',sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),
    browserInputs:Object.keys(bundled.metafile.inputs).map(path=>{if(path.startsWith('\0'))return 'virtual:'+path.slice(1);const slash=path.replaceAll('\\','/'),modules=slash.lastIndexOf('/node_modules/');return modules>=0?slash.slice(modules+1):isAbsolute(path)?relative(dir,path).replaceAll('\\','/'):slash;}).sort(),browserImports:[]},null,2)+'\n'],
  ]);
  if(check){for(const[name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated data-access drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
  return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
 }finally{esbuild?.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-data-access.mjs [--check] | --help. Generation uses the canonical esbuild/json-schema-to-typescript tools (MERI_CONTRACT_TOOLCHAIN_ROOT optionally selects them). No installs/network; exit 1 on invalid arguments or drift.');
 else if(new Set(args).size!==args.length||args.some(a=>a!=='--check')){process.stderr.write('Invalid arguments\n');process.exitCode=1;}
 else generateDataAccessContracts({check:args.includes('--check'),toolchainRoot:process.env.MERI_CONTRACT_TOOLCHAIN_ROOT}).then(r=>console.log(JSON.stringify(r,null,1)),e=>{process.stderr.write(String(e?.message??e)+'\n');process.exitCode=1;});}
