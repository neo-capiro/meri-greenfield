/** Focused additive generator. Reads accepted canonical artifacts and writes only new conversation-initial-input artifacts. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {initialInputSchema} from './conversation-initial-input/schema.mjs';import {conversationInitialInputMetadata} from './conversation-initial-input/protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function generateInitialInputContracts({check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},esbuild,{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 try{
  const originals=new Map(),sources=new Map();
  for(const path of ['meri.schema.json','dist/conversation-input.schema.json']){const bytes=await readFile(new URL(path,HERE)),schema=JSON.parse(bytes);originals.set(schema.$id,{schema,path,sha256:hash(bytes),bytes:bytes.length});}
  for(const path of ['generate-initial-input.mjs',...['protocol','schema','semantics','shape','validate','receive'].map(n=>'conversation-initial-input/'+n+'.mjs'),'document-application/boundary.mjs',...['mjs','d.ts','metadata.json'].map(n=>'dist/conversation-application.'+n),...['mjs','d.ts','metadata.json'].map(n=>'dist/conversation-input.'+n),'../../apps/control/conversations/initial-input/http.mjs','../../apps/control/conversations/service.mjs','../../apps/control/conversations/initial-input-facts.mjs','../../apps/control/conversations/initial-input-journal.mjs','../../apps/control/conversations/migrations/0016_initial_inputs.sql','../../apps/control/conversations/postgres-store.mjs']){const bytes=await readFile(new URL(path,HERE));sources.set(path,{path,sha256:hash(bytes),bytes:bytes.length});}
  const root=initialInputSchema(),defs={},seen=new Map();
  function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;const out={};
   for(const[key,v]of Object.entries(value)){if(key!=='$ref'){out[key]=transform(v,owner);continue;}const [urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;if(id===root.$id){out[key]='#'+fragment;continue;}
    if(!seen.has(full)){const original=originals.get(id);if(!original)throw Error('Missing canonical schema '+id);const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);sources.set(original.path,{path:original.path,sha256:original.sha256,bytes:original.bytes});let target=original.schema;for(const token of fragment.split('/').slice(1))target=target[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}out[key]='#/$defs/'+seen.get(full);
   }return out;
  }
  root.$defs={...transform(root.$defs,root.$id),...defs};
  const names=['ConversationInitialInputAllocatedResponse','ConversationInitialInputErrorResponse'];
  const exportNames=['validateAllocatedResponse','validateError'];
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);const refs={};names.forEach((name,i)=>{const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs[exportNames[i]]=ref;});const generated=standalone(ajv,refs);
  const canonicalImport='./conversation-input.mjs';
  const bundled=await esbuild.build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('conversation-initial-input/receive.mjs',HERE),'utf8'),sourcefile:'conversation-initial-input-receiver.mjs',resolveDir:resolve(dir,'conversation-initial-input')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,plugins:[
   {name:'initial-input-canonical-provenance',setup(b){b.onResolve({filter:/^\.\.\/dist\/conversation-input\.mjs$/},()=>({path:canonicalImport,external:true}));}},
   {name:'initial-input-generated',setup(b){b.onResolve({filter:/^\.\/generated-validator\.mjs$/},a=>({path:a.path,namespace:'initial-input-generated'}));b.onLoad({filter:/.*/,namespace:'initial-input-generated'},()=>({contents:generated,resolveDir:dir,loader:'js'}));}},
  ]});
  const imports=Object.values(bundled.metafile.outputs).flatMap(o=>o.imports);if(!imports.length||imports.some(i=>!i.external||i.path!==canonicalImport||i.kind!=='import-statement'))throw Error('Unexpected conversation initial input browser dependency');
  // Declarations cover the envelope's reachable definitions; the request/context aliases are declared over the accepted input types below.
  const declared=Object.fromEntries(Object.entries(root.$defs).filter(([name])=>!['ConversationInitialInputRequest','ConversationInitialInputExpectedContext'].includes(name)&&!name.startsWith('Canonical_ConversationInput')));
  const declarations=await compile({title:'ConversationInitialInputEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:declared},'ConversationInitialInputEnvelope',{bannerComment:'// Generated allocation schema. Validation grants no authority or dispatch permission.',additionalProperties:false,style:{singleQuote:true}});
  const api=`
import type {AdmittedConversationInputRequest,AdmittedConversationInputReceipt,ConversationInputErrorResponse,ConversationInputExpectedContext} from '@capiro/meri-contracts/conversation-input';
export type ConversationInitialInputRequest=Pick<AdmittedConversationInputRequest,'requestId'|'prompt'|'skill'|'windowRequest'>;
export type ConversationInitialInputExpectedContext=ConversationInputExpectedContext;
export type ConversationInitialInputBinding=AdmittedConversationInputReceipt['run']['binding'];
export type ConversationInitialInputScope=AdmittedConversationInputReceipt['run']['scopes'][number];
export type ConversationInitialInputVersions=AdmittedConversationInputReceipt['run']['versions'];
declare const initialInputRequest:unique symbol;
declare const initialInputReceipt:unique symbol;
export type AdmittedConversationInitialInputRequest=AdmittedConversationInputRequest&{readonly [initialInputRequest]:true};
export type AdmittedConversationInitialInputReceipt=Readonly<ConversationInitialInputAllocatedResponse>&{readonly [initialInputReceipt]:true};
export declare class ConversationInitialInputResponseError extends Error {readonly code:string;}
export declare const conversationInitialInputMetadata: ${JSON.stringify(conversationInitialInputMetadata,null,2)};
export declare const conversationInitialInputVersion:'1.0.0';
export declare const conversationInitialInputPath:'/api/conversations/input/allocate';
export declare function receiveConversationInitialInputRequest(utf8Bytes:Uint8Array):AdmittedConversationInitialInputRequest;
export declare function receiveConversationInitialInputResponse(httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationInitialInputRequest,expectedContext:Readonly<ConversationInitialInputExpectedContext>):Promise<AdmittedConversationInitialInputReceipt|ConversationInitialInputErrorResponse>;
export declare function receiveAllocatedConversationInputResponse(httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationInitialInputRequest,expectedContext:Readonly<ConversationInitialInputExpectedContext>,allocation:AdmittedConversationInitialInputReceipt):Promise<AdmittedConversationInputReceipt|ConversationInputErrorResponse>;
`;
  const schemaBytes=JSON.stringify(root,null,2)+'\n',outputs=new Map([
   ['conversation-initial-input.mjs','// Generated original input boundary; imports the genuine0.1.7 input module. No authority.\n'+bundled.outputFiles[0].text],
   ['conversation-initial-input.d.ts',declarations+api],['conversation-initial-input.schema.json',schemaBytes],
   ['conversation-initial-input.metadata.json',JSON.stringify({packageVersion:conversationInitialInputMetadata.packageVersion,initialInputVersion:conversationInitialInputMetadata.initialInputVersion,schemaId:root.$id,sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),browserInputs:Object.keys(bundled.metafile.inputs).sort(),browserImports:[{path:canonicalImport,artifact:'dist/conversation-input.mjs',sha256:sources.get('dist/conversation-input.mjs').sha256}]},null,2)+'\n'],
  ]);
  if(check){for(const[name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated initial input drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
  return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
 }finally{esbuild.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-initial-input.mjs [--check|--help]; offline initial-input-only generation; exit1 invalid arguments/drift.');else if(args.length>1||args.length&&args[0]!=='--check'){process.stderr.write('Invalid arguments\n');process.exitCode=1;}else generateInitialInputContracts({check:args[0]==='--check'}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});}
