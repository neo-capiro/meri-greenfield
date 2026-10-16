/** Focused additive generator: immutable schema owners are read, never regenerated. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {historySchema} from './conversation-history/schema.mjs';import {conversationHistoryMetadata} from './conversation-history/protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function generateHistoryContracts({check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},esbuild,{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 try{
 const originals=new Map(),sources=new Map();
 for(const path of ['meri.schema.json','dist/conversation-application.schema.json']){const bytes=await readFile(new URL(path,HERE)),schema=JSON.parse(bytes);originals.set(schema.$id,{schema,path,sha256:hash(bytes),bytes:bytes.length});}
 for(const path of ['generate-history.mjs',...['protocol','schema','semantics','shape','validate','receive'].map(n=>'conversation-history/'+n+'.mjs'),'document-application/boundary.mjs',...['protocol','http','service','store','lineage'].map(n=>'../../apps/control/conversations/history/'+n+'.mjs'),'../../apps/control/conversations/next-run-reservation.mjs']){const bytes=await readFile(new URL(path,HERE));sources.set(path,{path,sha256:hash(bytes),bytes:bytes.length});}
 const root=historySchema(),defs={},seen=new Map();
 function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;const out={};
  for(const[key,v]of Object.entries(value)){if(key!=='$ref'){out[key]=transform(v,owner);continue;}const [urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;if(id===root.$id){out[key]='#'+fragment;continue;}
   if(!seen.has(full)){const original=originals.get(id);if(!original)throw Error('Missing canonical schema '+id);const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);sources.set(original.path,{path:original.path,sha256:original.sha256,bytes:original.bytes});let target=original.schema;for(const token of fragment.split('/').slice(1))target=target[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}out[key]='#/$defs/'+seen.get(full);
  }return out;
 }
 root.$defs={...transform(root.$defs,root.$id),...defs};
 const names=['ConversationHistoryListRequest','ConversationHistoryTranscriptRequest','ConversationHistoryNextTurnRequest','ConversationHistoryListResponse','ConversationHistoryTranscriptResponse','ConversationHistoryNextTurnResponse','ConversationHistoryErrorResponse'];
 const exportNames=['validateListRequest','validateTranscriptRequest','validateNextTurnRequest','validateListResponse','validateTranscriptResponse','validateNextTurnResponse','validateError'];
 const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);const refs={};names.forEach((name,i)=>{const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs[exportNames[i]]=ref;});const generated=standalone(ajv,refs);
 const bundled=await esbuild.build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('conversation-history/receive.mjs',HERE),'utf8'),sourcefile:'conversation-history-receiver.mjs',resolveDir:resolve(dir,'conversation-history')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,plugins:[{name:'history-generated',setup(b){b.onResolve({filter:/^\.\/generated-validator\.mjs$/},a=>({path:a.path,namespace:'history-generated'}));b.onLoad({filter:/.*/,namespace:'history-generated'},()=>({contents:generated,resolveDir:dir,loader:'js'}));}}]});
 if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('History browser external import');
 const declarations=await compile({title:'ConversationHistoryEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:root.$defs},'ConversationHistoryEnvelope',{bannerComment:'// Generated from accepted history schema; frozen canonical shapes unchanged. No authorization implied.',additionalProperties:false,style:{singleQuote:true}});
 const api=`
export type ConversationHistoryRoute='list'|'transcript'|'nextTurn';
declare const admittedHistoryRequest:unique symbol;
export interface ConversationHistoryRequestMap {list:ConversationHistoryListRequest;transcript:ConversationHistoryTranscriptRequest;nextTurn:ConversationHistoryNextTurnRequest;}
export type AdmittedConversationHistoryRequest<R extends ConversationHistoryRoute>=Readonly<ConversationHistoryRequestMap[R]>&{readonly [admittedHistoryRequest]:R};
export interface ConversationHistoryResponseMap {list:Readonly<ConversationHistoryListResponse>;transcript:Readonly<ConversationHistoryTranscriptResponse>;nextTurn:Readonly<ConversationHistoryNextTurnResponse>;}
export type ConversationHistoryResponse<R extends ConversationHistoryRoute>=ConversationHistoryResponseMap[R]|ConversationHistoryErrorResponse;
export declare class ConversationHistoryResponseError extends Error {readonly code:string;}
export declare const conversationHistoryMetadata: ${JSON.stringify(conversationHistoryMetadata,null,2)};
export declare const conversationHistoryVersion:'1.0.0';
export declare const HISTORY_PATHS: ${JSON.stringify(Object.fromEntries(Object.entries(conversationHistoryMetadata.routes).map(([name,v])=>[name,v.path])),null,2)};
export declare const DISCOVERY_SCHEMA:'meri.conversation-list/1',HISTORY_SCHEMA:'meri.conversation-transcript/1',TURN_SCHEMA:'meri.conversation-turn/1';
export declare function receiveConversationHistoryRequest<R extends ConversationHistoryRoute>(route:R,utf8Bytes:Uint8Array):AdmittedConversationHistoryRequest<R>;
export declare function receiveConversationHistoryResponse<R extends ConversationHistoryRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationHistoryRequest<R>):Promise<ConversationHistoryResponse<R>>;
export declare function validateConversationHistoryRequest(route:ConversationHistoryRoute,utf8Bytes:Uint8Array):boolean;
export declare function validateConversationHistoryResponse<R extends ConversationHistoryRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationHistoryRequest<R>):Promise<boolean>;
`;
 const schemaBytes=JSON.stringify(root,null,2)+'\n',outputs=new Map([['conversation-history.mjs','// Generated additive browser boundary. No authority.\n'+bundled.outputFiles[0].text],['conversation-history.d.ts',declarations+api],['conversation-history.schema.json',schemaBytes],['conversation-history.metadata.json',JSON.stringify({packageVersion:conversationHistoryMetadata.packageVersion,historyVersion:conversationHistoryMetadata.historyVersion,schemaId:root.$id,sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),browserInputs:Object.keys(bundled.metafile.inputs).sort()},null,2)+'\n']]);
 if(check){for(const[name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated history drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
 return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
 }finally{esbuild.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-history.mjs [--check|--help]; offline history-only generation; exit1 invalid arguments/drift.');else if(args.length>1||args.length&&args[0]!=='--check'){process.stderr.write('Invalid arguments\n');process.exitCode=1;}else generateHistoryContracts({check:args[0]==='--check'}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});}
