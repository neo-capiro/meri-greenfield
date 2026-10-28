/** Additive browser usage boundary from canonical schema/receiver owners; no install or package operation. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {conversationUsageSchema} from './conversation-usage/schema.mjs';
import {conversationUsageMetadata,conversationUsageErrors,usageCounterNames,usageUnavailableReasons} from './conversation-usage/protocol.mjs';
import {usageOverviewSchema} from './conversation-usage/overview-schema.mjs';
import {usageOverviewMetadata} from './conversation-usage/overview-protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=value=>createHash('sha256').update(value).digest('hex');
export async function generateUsageContracts({check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},esbuild,{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 try{
  const sources=[];
  for(const path of ['meri.schema.json','generate-usage.mjs','runtime-0.2/usage.mjs','conversation-history/protocol.mjs',
   ...['protocol','schema','semantics','validate','receive'].flatMap(name=>['conversation-usage/'+name+'.mjs','conversation-usage/overview-'+name+'.mjs']),'document-application/boundary.mjs',
   ...['http','store'].map(name=>'../../apps/control/conversations/usage-overview/'+name+'.mjs'),
   ...['http','projection'].map(name=>'../../apps/control/conversations/usage-read/'+name+'.mjs'),
   ...['store','service'].map(name=>'../../apps/control/conversations/history/'+name+'.mjs'),'../../apps/control/conversations/postgres-store.mjs',
   '../../apps/control/conversations/usage.mjs','../../apps/runtime/product-applications.mjs']){
   const bytes=await readFile(new URL(path,HERE));sources.push({path,sha256:hash(bytes),bytes:bytes.length});
  }
  const schema=conversationUsageSchema(),names=['ConversationUsageRequest','ConversationUsageResponse'],exports=['validateRequest','validateResponse'];
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(schema);const refs={};
  names.forEach((name,index)=>{const ref=schema.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs[exports[index]]=ref;});const validators=standalone(ajv,refs);
  const overview=usageOverviewSchema(),overviewNames=['UsageOverviewRequest','UsageOverviewResponse'],overviewExports=['validateOverviewRequest','validateOverviewResponse'];
  const overviewAjv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(overviewAjv);overviewAjv.addSchema(overview);const overviewRefs={};
  overviewNames.forEach((name,index)=>{const ref=overview.$id+'#/$defs/'+name;overviewAjv.compile({$ref:ref});overviewRefs[overviewExports[index]]=ref;});const overviewValidators=standalone(overviewAjv,overviewRefs);
  const bundled=await esbuild.build({absWorkingDir:dir,preserveSymlinks:true,stdin:{contents:await readFile(new URL('conversation-usage/receive.mjs',HERE),'utf8'),sourcefile:'conversation-usage-receiver.mjs',resolveDir:resolve(dir,'conversation-usage')},
   bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,
   plugins:[{name:'usage-generated',setup(build){build.onResolve({filter:/^\.\/generated-overview-validator\.mjs$/},args=>({path:args.path,namespace:'overview-generated'}));build.onLoad({filter:/.*/,namespace:'overview-generated'},()=>({contents:overviewValidators,resolveDir:dir,loader:'js'}));build.onResolve({filter:/^\.\/generated-validator\.mjs$/},args=>({path:args.path,namespace:'usage-generated'}));build.onLoad({filter:/.*/,namespace:'usage-generated'},()=>({contents:validators,resolveDir:dir,loader:'js'}));}}]});
  if(Object.values(bundled.metafile.outputs).some(output=>output.imports.length))throw Error('Usage browser external import');
  const declarations=await compile({title:'ConversationUsageEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:schema.$defs},'ConversationUsageEnvelope',
   {bannerComment:'// Generated recorded usage projection. No authority, billing, external-effect or row-correlation claim.',additionalProperties:false,style:{singleQuote:true}});
  const overviewDeclarations=await compile({title:'UsageOverviewEnvelope',anyOf:overviewNames.map(name=>({$ref:'#/$defs/'+name})),$defs:overview.$defs},'UsageOverviewEnvelope',
   {bannerComment:'// Independent tenant usage-overview wire1. No execution authority or complete-job economics claim.',additionalProperties:false,style:{singleQuote:true}});
  const overviewApi=`
declare const admittedUsageOverviewRequest:unique symbol;
export type AdmittedUsageOverviewRequest=Readonly<UsageOverviewRequest>&{readonly [admittedUsageOverviewRequest]:true};
export interface UsageOverviewErrorResponse {error:{code:string;outcome?:'UNKNOWN'};}
export declare class UsageOverviewResponseError extends Error {readonly code:string;}
export declare const USAGE_OVERVIEW_SCHEMA:'meri.usage-overview/1',USAGE_OVERVIEW_PATH:'/api/conversations/usage-overview';
export declare const usageOverviewMetadata:${JSON.stringify(usageOverviewMetadata,null,2)};
export declare function receiveUsageOverviewRequest(bytes:Uint8Array):AdmittedUsageOverviewRequest;
export declare function receiveUsageOverviewResponse(status:number,bytes:Uint8Array,request:AdmittedUsageOverviewRequest):UsageOverviewResponse|UsageOverviewErrorResponse;
`;
  const api=`
declare const admittedUsageRequest:unique symbol;
export type AdmittedConversationUsageRequest=Readonly<ConversationUsageRequest>&{readonly [admittedUsageRequest]:true};
export interface ConversationUsageErrorResponse {error:{code:string};}
export declare class ConversationUsageResponseError extends Error {readonly code:string;}
export declare const CONVERSATION_USAGE_SCHEMA:'meri.conversation-usage/1',CONVERSATION_USAGE_PATH:'/api/conversations/usage';
export declare const conversationUsageMetadata:${JSON.stringify(conversationUsageMetadata,null,2)};
export declare const conversationUsageErrors:Readonly<Record<string,readonly number[]>>;
export declare const usageCounterNames:readonly ${JSON.stringify(usageCounterNames)};
export declare const usageUnavailableReasons:readonly ${JSON.stringify(usageUnavailableReasons)};
export declare function receiveConversationUsageRequest(bytes:Uint8Array):AdmittedConversationUsageRequest;
export declare function receiveConversationUsageResponse(status:number,bytes:Uint8Array,request:AdmittedConversationUsageRequest):ConversationUsageResponse|ConversationUsageErrorResponse;
`;
  const schemaBytes=JSON.stringify(schema,null,2)+'\n',overviewSchemaBytes=JSON.stringify(overview,null,2)+'\n';
  const outputs=new Map([['conversation-usage.mjs','// Generated browser recorded usage boundary.\n'+bundled.outputFiles[0].text],['conversation-usage.d.ts',declarations+api+overviewDeclarations+overviewApi],
   ['usage-overview.schema.json',overviewSchemaBytes],['conversation-usage.schema.json',schemaBytes],['conversation-usage.metadata.json',JSON.stringify({...conversationUsageMetadata,overview:{...usageOverviewMetadata,schemaSha256:hash(overviewSchemaBytes)},errorStatuses:conversationUsageErrors,sources:sources.sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),browserInputs:Object.keys(bundled.metafile.inputs).sort()},null,2)+'\n']]);
  if(check){for(const [name,value]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==value)throw Error('Generated usage drift: '+name);}
  else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const [name,value]of outputs)await writeFile(new URL('dist/'+name,HERE),value);}
  return [...outputs].map(([path,value])=>({path,bytes:Buffer.byteLength(value),sha256:hash(value)}));
 }finally{esbuild.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-usage.mjs [--check|--help]');
 else if(args.length>1||args.length&&args[0]!=='--check'){console.error('Invalid arguments');process.exitCode=1;}
 else generateUsageContracts({check:args[0]==='--check'}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
}
