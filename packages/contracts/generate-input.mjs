/** Focused additive generator. Reads accepted canonical artifacts and writes only new conversation-input artifacts. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {inputSchema} from './conversation-input/schema.mjs';import {conversationInputMetadata} from './conversation-input/protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function generateInputContracts({check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},esbuild,{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 try{
  const originals=new Map(),sources=new Map();
  for(const path of ['meri.schema.json','dist/conversation-application.schema.json']){const bytes=await readFile(new URL(path,HERE)),schema=JSON.parse(bytes);originals.set(schema.$id,{schema,path,sha256:hash(bytes),bytes:bytes.length});}
  for(const path of ['generate-input.mjs',...['protocol','schema','semantics','shape','validate','receive'].map(n=>'conversation-input/'+n+'.mjs'),'document-application/boundary.mjs',...['mjs','d.ts','metadata.json'].map(n=>'dist/conversation-application.'+n),'../../apps/control/conversations/input/http.mjs','../../apps/control/conversations/service.mjs']){const bytes=await readFile(new URL(path,HERE));sources.set(path,{path,sha256:hash(bytes),bytes:bytes.length});}
  const root=inputSchema(),defs={},seen=new Map();
  function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;const out={};
   for(const[key,v]of Object.entries(value)){if(key!=='$ref'){out[key]=transform(v,owner);continue;}const [urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;if(id===root.$id){out[key]='#'+fragment;continue;}
    if(!seen.has(full)){const original=originals.get(id);if(!original)throw Error('Missing canonical schema '+id);const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);sources.set(original.path,{path:original.path,sha256:original.sha256,bytes:original.bytes});let target=original.schema;for(const token of fragment.split('/').slice(1))target=target[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}out[key]='#/$defs/'+seen.get(full);
   }return out;
  }
  root.$defs={...transform(root.$defs,root.$id),...defs};
  const names=['ConversationInputRequest','ConversationInputStoredRequest','ConversationInputAdmittedResponse','ConversationInputExpectedContext','ConversationInputErrorResponse'];
  const exportNames=['validateRequest','validateStoredRequest','validateAdmittedResponse','validateExpectedContext','validateError'];
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);const refs={};names.forEach((name,i)=>{const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs[exportNames[i]]=ref;});const generated=standalone(ajv,refs);
  const canonicalImport='./conversation-application.mjs';
  const bundled=await esbuild.build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('conversation-input/receive.mjs',HERE),'utf8'),sourcefile:'conversation-input-receiver.mjs',resolveDir:resolve(dir,'conversation-input')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,plugins:[
   {name:'input-canonical-provenance',setup(b){b.onResolve({filter:/^\.\.\/dist\/conversation-application\.mjs$/},()=>({path:canonicalImport,external:true}));}},
   {name:'input-generated',setup(b){b.onResolve({filter:/^\.\/generated-validator\.mjs$/},a=>({path:a.path,namespace:'input-generated'}));b.onLoad({filter:/.*/,namespace:'input-generated'},()=>({contents:generated,resolveDir:dir,loader:'js'}));}},
  ]});
  const imports=Object.values(bundled.metafile.outputs).flatMap(o=>o.imports);if(!imports.length||imports.some(i=>!i.external||i.path!==canonicalImport||i.kind!=='import-statement'))throw Error('Unexpected conversation input browser dependency');
  const declarations=await compile({title:'ConversationInputEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:root.$defs},'ConversationInputEnvelope',{bannerComment:'// Generated additive input receipt over accepted canonical schemas. No authorization implied.',additionalProperties:false,style:{singleQuote:true}});
  const api=`
import type {AdmittedConversationRequest,AdmittedConversationView,ConversationHistoryResponse,ConversationErrorResponse} from '@capiro/meri-contracts/conversation-application';
export type ConversationInputErrorResponse=ConversationErrorResponse;
export type AdmittedConversationInputRequest=AdmittedConversationRequest<'submit'>;
declare const admittedInputReceipt:unique symbol;
export type AdmittedConversationInputReceipt=Readonly<ConversationInputAdmittedResponse>&{readonly [admittedInputReceipt]:true};
export type ConversationInputView=Readonly<ConversationHistoryResponse>&AdmittedConversationView;
export declare class ConversationInputResponseError extends Error {readonly code:string;}
export declare const conversationInputMetadata: ${JSON.stringify(conversationInputMetadata,null,2)};
export declare const conversationInputVersion:'1.0.0';
export declare const conversationInputPath:'/api/conversations/input/admit';
export declare function receiveConversationInputRequest(utf8Bytes:Uint8Array):AdmittedConversationInputRequest;
export declare function receiveConversationInputResponse(httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedConversationInputRequest,expectedContext:Readonly<ConversationInputExpectedContext>,currentView?:AdmittedConversationView|AdmittedConversationInputReceipt):Promise<AdmittedConversationInputReceipt|ConversationInputErrorResponse>;
export declare function conversationInputView(receipt:AdmittedConversationInputReceipt):ConversationInputView;
`;
  const schemaBytes=JSON.stringify(root,null,2)+'\n',outputs=new Map([
   ['conversation-input.mjs','// Generated additive browser boundary; shares canonical request/view provenance. No authority.\n'+bundled.outputFiles[0].text],
   ['conversation-input.d.ts',declarations+api],['conversation-input.schema.json',schemaBytes],
   ['conversation-input.metadata.json',JSON.stringify({packageVersion:conversationInputMetadata.packageVersion,inputVersion:conversationInputMetadata.inputVersion,schemaId:root.$id,sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),browserInputs:Object.keys(bundled.metafile.inputs).sort(),browserImports:[{path:canonicalImport,artifact:'dist/conversation-application.mjs',sha256:sources.get('dist/conversation-application.mjs').sha256}]},null,2)+'\n'],
  ]);
  if(check){for(const[name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated input drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
  return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
 }finally{esbuild.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-input.mjs [--check|--help]; offline input-only generation; exit1 invalid arguments/drift.');else if(args.length>1||args.length&&args[0]!=='--check'){process.stderr.write('Invalid arguments\n');process.exitCode=1;}else generateInputContracts({check:args[0]==='--check'}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});}
