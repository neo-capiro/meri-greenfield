import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {conversationSchema} from './conversation-application/schema.mjs';
import {conversationApplicationMetadata} from './conversation-application/protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function generateConversationContracts({check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},{build},{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 const originals=new Map(),sources=new Map();
 for(const folder of ['', 'retrieval-0.2/'])for(const name of await readdir(new URL(folder,HERE))){if(!name.endsWith('.schema.json'))continue;const path=folder+name,raw=await readFile(new URL(path,HERE)),schema=JSON.parse(raw);originals.set(schema.$id,{schema,path,sha256:hash(raw),bytes:raw.length});}
 for(const path of ['../../apps/control/conversations/http.mjs','../../apps/control/conversations/service.mjs','../../apps/control/conversations/events.mjs','conversation-application/protocol.mjs','conversation-application/schema.mjs','conversation-application/receive.mjs','document-application/boundary.mjs']){const raw=await readFile(new URL(path,HERE));sources.set(path,{path,sha256:hash(raw),bytes:raw.length});}
 const root=conversationSchema(),defs={},seen=new Map();
 function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;
  const out={};for(const [key,v]of Object.entries(value)){if(key==='$ref'){
   const [urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;
   if(id===root.$id){out[key]='#'+fragment;continue;}
   if(!seen.has(full)){const original=originals.get(id);if(!original)throw Error('Missing schema owner '+id);const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);sources.set(original.path,{path:original.path,sha256:original.sha256,bytes:original.bytes});let target=original.schema;for(const token of fragment.split('/').slice(1))target=target[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}
   out[key]='#/$defs/'+seen.get(full);
  }else out[key]=transform(v,owner);}return out;}
 root.$defs={...transform(root.$defs,root.$id),...defs};
 const names=['ConversationSubmitRequest','ConversationHistoryRequest','ConversationCancelRequest','ConversationEventsRequest','ConversationSubmittedResponse','ConversationHistoryResponse','ConversationCancelledResponse','ConversationEvent','ConversationErrorResponse'];
 const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);
 const exportNames=['validateSubmitRequest','validateHistoryRequest','validateCancelRequest','validateEventsRequest','validateSubmitted','validateHistory','validateCancelled','validateEvent','validateError'],exports={};
 names.forEach((name,i)=>{const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});exports[exportNames[i]]=ref;});
 const generated=standalone(ajv,exports);
 const bundled=await build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('conversation-application/receive.mjs',HERE),'utf8'),sourcefile:'conversation-application-receiver.mjs',resolveDir:resolve(dir,'conversation-application')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,plugins:[{name:'conversation-generated',setup(b){b.onResolve({filter:/^\.\/generated-validator\.mjs$/},a=>({path:a.path,namespace:'conversation-generated'}));b.onLoad({filter:/.*/,namespace:'conversation-generated'},()=>({contents:generated,resolveDir:dir,loader:'js'}));}}]});
 if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Conversation browser external import');
 const declarations=await compile({title:'ConversationApplicationEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:root.$defs},'ConversationApplicationEnvelope',{bannerComment:'// Generated from canonical conversation receiving schema. No authorization implied.',additionalProperties:false,style:{singleQuote:true}});
 const api=`
export type ConversationRoute = 'submit' | 'history' | 'cancel' | 'events';
declare const admittedRequest: unique symbol;
declare const admittedView: unique symbol;
declare const admittedCursor: unique symbol;
export interface ConversationRequestMap { submit:ConversationSubmitRequest; history:ConversationHistoryRequest; cancel:ConversationCancelRequest; events:ConversationEventsRequest; }
export type AdmittedConversationRequest<R extends ConversationRoute> = Readonly<ConversationRequestMap[R]> & {readonly [admittedRequest]:R};
export type AdmittedConversationView = Readonly<ConversationSubmittedResponse | ConversationHistoryResponse> & {readonly [admittedView]:true};
export interface ConversationResponseMap {submit:Readonly<ConversationSubmittedResponse> & {readonly [admittedView]:true}; history:Readonly<ConversationHistoryResponse> & {readonly [admittedView]:true}; cancel:Readonly<ConversationCancelledResponse>; events:never;}
export type ConversationResponse<R extends ConversationRoute> = ConversationResponseMap[R] | ConversationErrorResponse;
export interface ConversationCursor {readonly conversationId:string; readonly after:number; readonly [admittedCursor]:true;}
export declare class ConversationResponseError extends Error {readonly code:string;}
export declare const conversationApplicationMetadata: ${JSON.stringify(conversationApplicationMetadata,null,2)};
export declare function receiveConversationRequest<R extends ConversationRoute>(route:R,utf8Bytes:Uint8Array):AdmittedConversationRequest<R>;
export declare function receiveConversationResponse<R extends ConversationRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationRequest<R>,currentView?:AdmittedConversationView):Promise<ConversationResponse<R>>;
export declare function createConversationCursor(view:AdmittedConversationView,after?:number):ConversationCursor;
export declare function receiveConversationEvent(utf8Bytes:Uint8Array,cursor:ConversationCursor):Readonly<{event:ConversationEvent;cursor:ConversationCursor}>;
export declare function conversationReconnect(cursor:ConversationCursor):Readonly<{method:'GET';path:string;headers:Readonly<{'x-meri-resume-sequence':string}>}>;
`;
 const outputs=new Map([['conversation-application.mjs','// Generated browser receiving boundary; no authority.\n'+bundled.outputFiles[0].text],['conversation-application.d.ts',declarations+api],['conversation-application.schema.json',JSON.stringify(root,null,2)+'\n'],['conversation-application.metadata.json',JSON.stringify({packageVersion:'0.1.3',schemaId:root.$id,sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(JSON.stringify(root,null,2)+'\n'),browserInputs:Object.keys(bundled.metafile.inputs).sort()},null,2)+'\n']]);
 if(check){for(const [name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
 return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-conversations.mjs [--check|--help]; offline deterministic build; exit1 invalid arguments/drift.');else if(args.length>1||(args.length&&args[0]!=='--check')){process.stderr.write('Invalid arguments\n');process.exitCode=1;}else generateConversationContracts({check:args[0]==='--check'}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});}
