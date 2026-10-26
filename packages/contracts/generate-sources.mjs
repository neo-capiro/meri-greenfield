/** Additive source boundary generator; frozen canonical contracts remain byte-identical. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {billTextSourceMetadata,hearingSourceMetadata} from './conversation-sources/protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function generateSourceContracts({check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},esbuild,{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 try{
  const sources=[],owners=new Map();
  for(const path of ['meri.schema.json','native-bill-text-source.schema.json',"native-hearing-source.schema.json","retrieval-0.2/public-domain-hearings.schema.json","retrieval-0.2/public-domain-hearing-records.schema.json","retrieval-0.2/outreach-query.schema.json",'generate-sources.mjs','conversation-history/protocol.mjs',...['protocol','semantics','hearing-semantics','validate','receive'].map(n=>'conversation-sources/'+n+'.mjs'),'document-application/boundary.mjs']){
   const bytes=await readFile(new URL(path,HERE));sources.push({path,sha256:hash(bytes),bytes:bytes.length});if(path.endsWith('.json')){const s=JSON.parse(bytes);owners.set(s.$id,s);}
  }
  const root=structuredClone(owners.get('urn:meri:native-bill-text-source:1.0.0')),defs={},seen=new Map();
  function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;const out={};
   for(const [key,v]of Object.entries(value)){if(key!=='$ref'){out[key]=transform(v,owner);continue;}const [urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;
    if(id===root.$id){out[key]='#'+fragment;continue;}
    if(!seen.has(full)){const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);let target=owners.get(id);for(const token of fragment.split('/').slice(1))target=target?.[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}out[key]='#/$defs/'+seen.get(full);
   }return out;
  }
  const hearing=owners.get('urn:meri:native-hearing-source:1.0.0');
  root.$defs={...transform(root.$defs,root.$id),...transform(hearing.$defs,hearing.$id),...defs};
  const names=['BillTextSourceReadRequest','BillTextSourceReadResponse','NativeBillTextSourceEvent','HearingSourceReadRequest','HearingSourceReadResponse','NativeHearingSourceEvent'],exports=['validateRequest','validateResponse','validateEvent','validateHearingRequest','validateHearingResponse','validateHearingEvent'];
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);const refs={};names.forEach((n,i)=>{const ref=root.$id+'#/$defs/'+n;ajv.compile({$ref:ref});refs[exports[i]]=ref;});const generated=standalone(ajv,refs);
  const bundled=await esbuild.build({absWorkingDir:dir,preserveSymlinks:true,stdin:{contents:await readFile(new URL('conversation-sources/receive.mjs',HERE),'utf8'),sourcefile:'conversation-sources-receiver.mjs',resolveDir:resolve(dir,'conversation-sources')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,plugins:[{name:'sources-generated',setup(b){b.onResolve({filter:/^\.\/generated-validator\.mjs$/},a=>({path:a.path,namespace:'sources-generated'}));b.onLoad({filter:/.*/,namespace:'sources-generated'},()=>({contents:generated,resolveDir:dir,loader:'js'}));}}]});
  if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Source browser external import');
  const declarations=await compile({title:'BillTextSourceEnvelope',anyOf:names.map(n=>({$ref:'#/$defs/'+n})),$defs:root.$defs},'BillTextSourceEnvelope',{bannerComment:'// Generated source provenance. Validation grants no authority or citation mapping.',additionalProperties:false,style:{singleQuote:true}});
  const api=`
declare const admittedSourceRequest:unique symbol;
export type AdmittedBillTextSourceRequest=Readonly<BillTextSourceReadRequest>&{readonly [admittedSourceRequest]:true};
export type AdmittedHearingSourceRequest=Readonly<HearingSourceReadRequest>&{readonly [admittedSourceRequest]:true};
export declare const hearingSourceMetadata:${JSON.stringify(hearingSourceMetadata,null,2)};
export declare const HEARING_SOURCE_SCHEMA:'meri.native-hearing-source/1',HEARING_SOURCE_READ_SCHEMA:'meri.hearing-source-read/1',HEARING_SOURCE_EVENT:'source.native-hearing-record';
export declare function receiveHearingSourceRequest(bytes:Uint8Array):AdmittedHearingSourceRequest;
export declare function receiveNativeHearingSourceEvent(bytes:Uint8Array):NativeHearingSourceEvent;
export declare function receiveHearingSourceResponse(status:number,bytes:Uint8Array,request:AdmittedHearingSourceRequest):Promise<HearingSourceReadResponse|BillTextSourceErrorResponse>;
export interface BillTextSourceErrorResponse {error:{code:string};}
export declare class BillTextSourceResponseError extends Error {readonly code:string;}
export declare const billTextSourceMetadata:${JSON.stringify(billTextSourceMetadata,null,2)};
export declare const BILL_TEXT_SOURCE_SCHEMA:'meri.native-bill-text-source/1',BILL_TEXT_SOURCE_READ_SCHEMA:'meri.bill-text-source-read/1',BILL_TEXT_SOURCE_EVENT:'source.native-bill-text',BILL_TEXT_SOURCE_PATH:'/api/conversations/source-read';
export declare const billTextSourceErrors:Readonly<Record<string,readonly number[]>>;
export declare function receiveBillTextSourceRequest(bytes:Uint8Array):AdmittedBillTextSourceRequest;
export declare function receiveNativeBillTextSourceEvent(bytes:Uint8Array):NativeBillTextSourceEvent;
export declare function receiveBillTextSourceResponse(status:number,bytes:Uint8Array,request:AdmittedBillTextSourceRequest):Promise<BillTextSourceReadResponse|BillTextSourceErrorResponse>;
`;
  const schemaBytes=JSON.stringify(root,null,2)+'\n',outputs=new Map([['conversation-sources.mjs','// Generated browser source boundary. No authority.\n'+bundled.outputFiles[0].text],['conversation-sources.d.ts',declarations+api],['conversation-sources.schema.json',schemaBytes],['conversation-sources.metadata.json',JSON.stringify({...billTextSourceMetadata,hearing:hearingSourceMetadata,sources:sources.sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),browserInputs:Object.keys(bundled.metafile.inputs).sort()},null,2)+'\n']]);
  if(check){for(const [name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated sources drift: '+name);}
  else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const [name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
  return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
 }finally{esbuild.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-sources.mjs [--check|--help]');else if(args.length>1||args.length&&args[0]!=='--check'){process.stderr.write('Invalid arguments\n');process.exitCode=1;}else generateSourceContracts({check:args[0]==='--check'}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});}
