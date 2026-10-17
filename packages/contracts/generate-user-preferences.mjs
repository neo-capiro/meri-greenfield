/** Additive, offline-capable user-preferences distribution. Imports never generate or connect to services. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve,relative,isAbsolute} from 'node:path';
import {userPreferencesSchema} from './user-preferences-application/schema.mjs';
import {createUserPreferencesMetadata} from './user-preferences-application/protocol.mjs';
import {USER_PREFERENCE_DEFAULTS,USER_PREFERENCE_THEMES,USER_PREFERENCE_DENSITIES,USER_PREFERENCE_NOTIFICATIONS} from './user-preferences-application/document.mjs';
import {compileUserPreferencesDeclarations} from './user-preferences-application/declarations.mjs';
import * as application from '../../apps/control/settings/user-application/protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function tooling(root){const locate=root?createRequire(resolve(root,'package.json')):createRequire(import.meta.url),load=name=>import(pathToFileURL(locate.resolve(name)).href);return Promise.all([load('esbuild'),load('json-schema-to-typescript')]);}
export async function generateUserPreferencesContracts({check=false,offline=false,canonical=false,toolchainRoot,bundleRoot,typeModulesRoot}={}){
 if(offline&&canonical)throw Error('Choose --offline or --canonical');
 if(check){const recorded=JSON.parse(await readFile(new URL('dist/user-preferences-application.metadata.json',HERE),'utf8')),mode=recorded.bundler==='rolldown'&&recorded.declarations==='json-schema-to-ts/typescript'?'offline':recorded.bundler==='esbuild'&&recorded.declarations==='json-schema-to-typescript'?'canonical':null;
  if(!mode)throw Error('Unknown recorded user-preferences generation backend');if(offline&&mode!=='offline'||canonical&&mode!=='canonical')throw Error('Requested user-preferences check backend differs from recorded artifacts');offline=mode==='offline';
 }
 if(offline&&(!bundleRoot||!typeModulesRoot))throw Error('Recorded offline generation requires MERI_CONTRACT_BUNDLE_ROOT (installed Rolldown/TypeScript) and MERI_CONTRACT_TYPE_MODULES (installed json-schema-to-ts/ts-algebra); no installation is performed');
 const [{default:Ajv},{default:formats},{default:standalone},builder]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),offline?import(pathToFileURL(createRequire(resolve(bundleRoot,'package.json')).resolve('rolldown')).href):tooling(toolchainRoot)]);
 const [esbuild,compiler]=offline?[]:builder;
 try{
  const sources=new Map(),record=async path=>{const raw=await readFile(new URL(path,HERE));sources.set(path,{path,sha256:hash(raw),bytes:raw.length});return raw;};
  const publicSchema=JSON.parse(await record('meri.schema.json')),errors=(await record('../../apps/control/product-access/errors.mjs')).toString(),fieldPattern=/const FIELD=\/(.+)\/u;/u.exec(errors)?.[1];if(!fieldPattern)throw Error('Missing canonical product error field pattern');
  if(!Array.isArray(application.USER_PREFERENCES_ERROR_OUTCOMES))throw Error('Missing canonical user-preferences error outcomes');
  const config={paths:application.USER_PREFERENCES_PATHS,limits:application.USER_PREFERENCES_LIMITS,errorStatuses:application.USER_PREFERENCES_ERROR_STATUSES,errorOutcomes:application.USER_PREFERENCES_ERROR_OUTCOMES,fieldPattern},metadata=createUserPreferencesMetadata(config);
  for(const path of ['generate-user-preferences.mjs',...['README.md','document.mjs','schema.mjs','protocol.mjs','boundary.mjs','receive.mjs','declarations.mjs'].map(name=>'user-preferences-application/'+name),'document-application/boundary.mjs','../../apps/control/product-access/http.mjs','../../apps/control/settings/routes.mjs','../../apps/control/settings/documents.mjs','../../apps/control/settings/user-application/protocol.mjs'])await record(path);
  const schema=userPreferencesSchema(config);schema.$defs.UserPreferencesOwner=publicSchema.$defs.Identity;const names=Object.keys(schema.$defs);
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(schema);const refs={};for(const name of names){const ref=schema.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs['validate'+name]=ref;}
  const generated=standalone(ajv,refs)+'\nexport const validators={'+names.map(name=>name+':validate'+name).join(',')+'};\n';
  const protocol='import {createUserPreferencesMetadata} from '+JSON.stringify(fileURLToPath(new URL('user-preferences-application/protocol.mjs',HERE)))+';export const userPreferencesPaths=Object.freeze('+JSON.stringify(config.paths)+');export const userPreferencesMetadata=createUserPreferencesMetadata('+JSON.stringify(config)+');';
  let bundled,inputs;
  if(offline){const virtual='\0user-preferences-generated-',bundle=await builder.rolldown({cwd:dir,input:fileURLToPath(new URL('user-preferences-application/receive.mjs',HERE)),platform:'browser',plugins:[{name:'user-preferences-generated',resolveId(id){if(/^\.\/generated-(validator|protocol)\.mjs$/u.test(id))return virtual+(id.includes('validator')?'validator':'protocol');},load(id){if(id===virtual+'validator')return generated;if(id===virtual+'protocol')return protocol;}}]});
   try{const result=await bundle.generate({format:'es',codeSplitting:false}),chunks=result.output.filter(o=>o.type==='chunk');if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length)throw Error('User-preferences browser external import');bundled=chunks[0].code.replace(/^\/\/#(?:end)?region[^\r\n]*\r?\n/gmu,'');inputs=Object.keys(chunks[0].modules);}finally{await bundle.close();}
  }else{const result=await esbuild.build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('user-preferences-application/receive.mjs',HERE),'utf8'),sourcefile:'user-preferences-receiver.mjs',resolveDir:resolve(dir,'user-preferences-application')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,plugins:[{name:'user-preferences-generated',setup(b){b.onResolve({filter:/^\.\/generated-(validator|protocol)\.mjs$/},a=>({path:a.path,namespace:'user-preferences-generated'}));b.onLoad({filter:/.*/,namespace:'user-preferences-generated'},a=>({contents:a.path.includes('validator')?generated:protocol,resolveDir:dir,loader:'js'}));}}]});if(Object.values(result.metafile.outputs).some(o=>o.imports.length))throw Error('User-preferences browser external import');bundled=result.outputFiles[0].text;inputs=Object.keys(result.metafile.inputs);}
  const declarations=offline?await compileUserPreferencesDeclarations(schema,names,{typescriptRoot:bundleRoot,typeModulesRoot}):await compiler.compile({title:'UserPreferencesApplicationEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:schema.$defs},'UserPreferencesApplicationEnvelope',{bannerComment:'// Generated additive user-preferences contract from its canonical document owner. No authority implied.',additionalProperties:false,style:{singleQuote:true}});
  const api=`
export type UserPreferencesRoute='read'|'save';
export interface UserPreferencesRequestMap {read:UserPreferencesReadRequest;save:UserPreferencesSaveRequest;}
export interface UserPreferencesExpectationMap {read:{owner:Readonly<UserPreferencesOwner>};save:{owner:Readonly<UserPreferencesOwner>;request:UserPreferencesSaveRequest};}
export declare class UserPreferencesResponseError extends Error {readonly code:string;}
export declare const userPreferencesVersion:'0.1.0';
export declare const userPreferencesPaths:Readonly<${JSON.stringify(config.paths)}>;
export declare const userPreferencesMetadata:${JSON.stringify(metadata,null,2)};
export declare const USER_PREFERENCE_DEFAULTS:Readonly<UserPreferences>;
export declare const USER_PREFERENCE_THEMES:readonly ${JSON.stringify(USER_PREFERENCE_THEMES)};
export declare const USER_PREFERENCE_DENSITIES:readonly ${JSON.stringify(USER_PREFERENCE_DENSITIES)};
export declare const USER_PREFERENCE_NOTIFICATIONS:readonly ${JSON.stringify(USER_PREFERENCE_NOTIFICATIONS)};
export declare function receiveUserPreferencesRequest<R extends UserPreferencesRoute>(route:R,jsonText:unknown):Promise<UserPreferencesRequestMap[R]>;
export declare function receiveUserPreferencesResponse<R extends UserPreferencesRoute>(route:R,httpStatus:number,jsonText:unknown,expectation:UserPreferencesExpectationMap[R]):Promise<UserPreferencesResponse|UserPreferencesErrorResponse>;
`;
  const schemaBytes=JSON.stringify(schema,null,2)+'\n',outputs=new Map([
   ['user-preferences-application.mjs','// Generated self-contained browser receiver. No authority or deployment acceptance.\n'+bundled],['user-preferences-application.d.ts',declarations+api],['user-preferences-application.schema.json',schemaBytes],
   ['user-preferences-application.metadata.json',JSON.stringify({...metadata,bundler:offline?'rolldown':'esbuild',declarations:offline?'json-schema-to-ts/typescript':'json-schema-to-typescript',sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),browserInputs:inputs.map(path=>{if(path.startsWith('\0'))return 'virtual:'+path.slice(1);const slash=path.replaceAll('\\','/'),modules=slash.lastIndexOf('/node_modules/');return modules>=0?slash.slice(modules+1):isAbsolute(path)?relative(dir,path).replaceAll('\\','/'):slash;}).sort(),browserImports:[]},null,2)+'\n'],
  ]);
  if(check){for(const[name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated user-preferences drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
  return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
 }finally{esbuild?.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-user-preferences.mjs [--check] [--offline|--canonical] | --help. Check selects the recorded backend; generation defaults to canonical esbuild/compiler. Offline requires installed Rolldown/TypeScript at MERI_CONTRACT_BUNDLE_ROOT and json-schema-to-ts/ts-algebra at MERI_CONTRACT_TYPE_MODULES. MERI_CONTRACT_TOOLCHAIN_ROOT optionally selects canonical tools. No installs/network; exit1 invalid arguments/drift.');else if(new Set(args).size!==args.length||args.some(a=>!['--check','--offline','--canonical'].includes(a))){process.stderr.write('Invalid arguments\n');process.exitCode=1;}else generateUserPreferencesContracts({check:args.includes('--check'),offline:args.includes('--offline'),canonical:args.includes('--canonical'),toolchainRoot:process.env.MERI_CONTRACT_TOOLCHAIN_ROOT,bundleRoot:process.env.MERI_CONTRACT_BUNDLE_ROOT,typeModulesRoot:process.env.MERI_CONTRACT_TYPE_MODULES}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});}
