/** Additive browser usage boundary from canonical schema/receiver owners; no install or package operation. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {conversationUsageSchema} from './conversation-usage/schema.mjs';
import {conversationUsageMetadata,conversationUsageErrors,usageCounterNames,usageUnavailableReasons} from './conversation-usage/protocol.mjs';
import {usageOverviewSchema,usageOverviewSchemaV2} from './conversation-usage/overview-schema.mjs';
import {usageOverviewMetadata,usageOverviewMetadataV2,usageOverviewErrors} from './conversation-usage/overview-protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=value=>createHash('sha256').update(value).digest('hex');
export async function generateUsageContracts({check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},esbuild,{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 try{
  const sources=[];
  for(const path of ['meri.schema.json','generate-usage.mjs','runtime-0.2/usage.mjs','conversation-history/protocol.mjs',
   ...['protocol','schema','semantics','validate','receive'].flatMap(name=>['conversation-usage/'+name+'.mjs','conversation-usage/overview-'+name+'.mjs']),'document-application/boundary.mjs',
   ...['http','store','job-economics'].map(name=>'../../apps/control/conversations/usage-overview/'+name+'.mjs'),
   ...['http','projection'].map(name=>'../../apps/control/conversations/usage-read/'+name+'.mjs'),
   ...['store','service'].map(name=>'../../apps/control/conversations/history/'+name+'.mjs'),'../../apps/control/conversations/postgres-store.mjs',
   '../../apps/control/conversations/usage.mjs','../../apps/runtime/product-applications.mjs']){
   const bytes=await readFile(new URL(path,HERE));sources.push({path,sha256:hash(bytes),bytes:bytes.length});
  }
  const schema=conversationUsageSchema(),names=['ConversationUsageRequest','ConversationUsageResponse'],exports=['validateRequest','validateResponse'];
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(schema);const refs={};
  names.forEach((name,index)=>{const ref=schema.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs[exports[index]]=ref;});const validators=standalone(ajv,refs);
  const overview=usageOverviewSchema(),overviewV2=usageOverviewSchemaV2(),overviewNames=['UsageOverviewRequest','UsageOverviewResponse'],overviewNamesV2=['UsageOverviewRequest2','UsageOverviewResponse2'],overviewExports=['validateOverviewRequest','validateOverviewResponse','validateOverviewRequest2','validateOverviewResponse2'];
  // The /1 pair compiles first from the unchanged /1 document; the successor document is then added and its
  // pair compiles from its own $id, so the generated /2 validators come from the resolvable 2.0.0 document.
  const overviewAjv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(overviewAjv);overviewAjv.addSchema(overview);const overviewRefs={};
  overviewNames.forEach((name,index)=>{const ref=overview.$id+'#/$defs/'+name;overviewAjv.compile({$ref:ref});overviewRefs[overviewExports[index]]=ref;});
  overviewAjv.addSchema(overviewV2);
  overviewNamesV2.forEach((name,index)=>{const ref=overviewV2.$id+'#/$defs/'+name;overviewAjv.compile({$ref:ref});overviewRefs[overviewExports[2+index]]=ref;});const overviewValidators=standalone(overviewAjv,overviewRefs);
  const bundled=await esbuild.build({absWorkingDir:dir,preserveSymlinks:true,stdin:{contents:await readFile(new URL('conversation-usage/receive.mjs',HERE),'utf8'),sourcefile:'conversation-usage-receiver.mjs',resolveDir:resolve(dir,'conversation-usage')},
   bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,
   plugins:[{name:'usage-generated',setup(build){build.onResolve({filter:/^\.\/generated-overview-validator\.mjs$/},args=>({path:args.path,namespace:'overview-generated'}));build.onLoad({filter:/.*/,namespace:'overview-generated'},()=>({contents:overviewValidators,resolveDir:dir,loader:'js'}));build.onResolve({filter:/^\.\/generated-validator\.mjs$/},args=>({path:args.path,namespace:'usage-generated'}));build.onLoad({filter:/.*/,namespace:'usage-generated'},()=>({contents:validators,resolveDir:dir,loader:'js'}));}}]});
  if(Object.values(bundled.metafile.outputs).some(output=>output.imports.length))throw Error('Usage browser external import');
  const declarations=await compile({title:'ConversationUsageEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:schema.$defs},'ConversationUsageEnvelope',
   {bannerComment:'// Generated recorded usage projection. No authority, billing, external-effect or row-correlation claim.',additionalProperties:false,style:{singleQuote:true}});
  const overviewDeclarations=await compile({title:'UsageOverviewEnvelope',anyOf:overviewNames.map(name=>({$ref:'#/$defs/'+name})),$defs:overview.$defs},'UsageOverviewEnvelope',
   {bannerComment:'// Independent tenant usage-overview wire1. No execution authority or complete-job economics claim.',additionalProperties:false,style:{singleQuote:true}});
  const overviewDeclarations2=await compile({title:'UsageOverviewEnvelope2',anyOf:overviewNamesV2.map(name=>({$ref:'#/$defs/'+name})),$defs:overviewV2.$defs},'UsageOverviewEnvelope2',
   {bannerComment:'// Independent tenant usage-overview wire2. Run-level attempts and conversation threads, never complete jobs.',additionalProperties:false,style:{singleQuote:true}});
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
  // The successor error body is closed on the same codes the receiver already enforces at runtime, so a
  // caller cannot type an invented code as valid. The ordinary /1 error declaration stays untouched.
  const overviewErrorCodesV2=Object.keys(usageOverviewErrors).map(code=>JSON.stringify(code)).join('|');
  const overviewApi2=`
declare const admittedUsageOverviewRequest2:unique symbol;
export type AdmittedUsageOverviewRequest2=Readonly<UsageOverviewRequest2>&{readonly [admittedUsageOverviewRequest2]:true};
export type UsageOverviewErrorCodeV2=${overviewErrorCodesV2};
export interface UsageOverviewErrorResponse2 {
  error: {
    code: UsageOverviewErrorCodeV2;
    outcome?: 'UNKNOWN';
  };
}
export declare const USAGE_OVERVIEW_SCHEMA_V2:'meri.usage-overview/2';
export declare const usageOverviewMetadataV2:${JSON.stringify(usageOverviewMetadataV2,null,2)};
export declare function receiveUsageOverviewRequestV2(bytes:Uint8Array):AdmittedUsageOverviewRequest2;
export declare function receiveUsageOverviewResponseV2(status:number,bytes:Uint8Array,request:AdmittedUsageOverviewRequest2):UsageOverviewResponse2|UsageOverviewErrorResponse2;
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
  const schemaBytes=JSON.stringify(schema,null,2)+'\n',overviewSchemaBytes=JSON.stringify(overview,null,2)+'\n',overviewV2SchemaBytes=JSON.stringify(overviewV2,null,2)+'\n';
  const outputs=new Map([['conversation-usage.mjs','// Generated browser recorded usage boundary.\n'+bundled.outputFiles[0].text],['conversation-usage.d.ts',declarations+api+overviewDeclarations+overviewApi+overviewDeclarations2+overviewApi2],
   ['usage-overview.schema.json',overviewSchemaBytes],['usage-overview-v2.schema.json',overviewV2SchemaBytes],['conversation-usage.schema.json',schemaBytes],['conversation-usage.metadata.json',JSON.stringify({...conversationUsageMetadata,overview:{...usageOverviewMetadata,schemaSha256:hash(overviewSchemaBytes)},overviewV2:{...usageOverviewMetadataV2,schemaSha256:hash(overviewV2SchemaBytes)},errorStatuses:conversationUsageErrors,sources:sources.sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),browserInputs:Object.keys(bundled.metafile.inputs).sort()},null,2)+'\n']]);
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
