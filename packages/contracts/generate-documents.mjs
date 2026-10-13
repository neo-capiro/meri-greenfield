import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {documentSchema} from './document-application/schema.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function generateDocumentContracts({check=false}={}){
 const [{default:Ajv},{default:formats},{default:standalone},{build},{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),import('esbuild'),import('json-schema-to-typescript')]);
 const originals=new Map(),sources=new Map();
 for(const folder of ['', 'artifacts-0.2/'])for(const name of await readdir(new URL(folder,HERE))){if(!name.endsWith('.schema.json'))continue;const path=folder+name,raw=await readFile(new URL(path,HERE)),schema=JSON.parse(raw);originals.set(schema.$id,{schema,path,sha256:hash(raw),bytes:raw.length});}
 const httpFiles=['../../apps/control/document-application/http.mjs','../../apps/control/document-application/index.mjs','../../apps/control/document-application/current.mjs','../../apps/control/document-application/format-admission.mjs','../../apps/control/action-application/http.mjs'];let http='';
 for(const path of httpFiles){const raw=await readFile(new URL(path,HERE));http+=raw.toString()+'\n';sources.set(path,{path,sha256:hash(raw),bytes:raw.length});}
 // Only document faults plus shared JSON-reader faults; no action response vocabulary.
 const documentHttp=await readFile(new URL('../../apps/control/document-application/http.mjs',HERE),'utf8');
 const statuses={DOCUMENT_REFUSED:502,REQUEST_FAILED:502};
 for(const m of documentHttp.matchAll(/\['([A-Z_]+)',(\d+)\]/gu))statuses[m[1]]=Number(m[2]);
 for(const path of httpFiles.slice(0,4)){const text=await readFile(new URL(path,HERE),'utf8');for(const m of text.matchAll(/fail\('([A-Z_]+)'(?:,(\d+))?\)/gu))statuses[m[1]]=Number(m[2]??400);}
 const shared=await readFile(new URL(httpFiles[4],HERE),'utf8'),body=shared.slice(shared.indexOf('export async function jsonBody'),shared.indexOf('export function response'));
 for(const m of body.matchAll(/fail\('([A-Z_]+)'(?:,(\d+))?\)/gu))statuses[m[1]]=Number(m[2]??400);
 const statusEntries=Object.fromEntries(Object.entries(statuses).sort(([a],[b])=>a.localeCompare(b)));
 const artifact=originals.get('urn:meri:artifacts:0.2.0');sources.set(artifact.path,{path:artifact.path,sha256:artifact.sha256,bytes:artifact.bytes});
 const root=documentSchema(artifact.schema,statusEntries),defs={},seen=new Map();
 function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;
  const out={};for(const [key,v]of Object.entries(value)){if(key==='$ref'){
   const [urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;
   if(id===root.$id){out[key]='#'+fragment;continue;}
   if(!seen.has(full)){const original=originals.get(id);if(!original)throw Error('Missing schema owner '+id);const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);sources.set(original.path,{path:original.path,sha256:original.sha256,bytes:original.bytes});let target=original.schema;for(const token of fragment.split('/').slice(1))target=target[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}
   out[key]='#/$defs/'+seen.get(full);
  }else out[key]=transform(v,owner);}return out;}
 const primary=transform(root.$defs,root.$id);root.$defs={...primary,...defs};
 const names=['DocumentCreateRequest','DocumentReviseRequest','DocumentInspectRequest','DocumentDownloadRequest','DocumentCreatedResponse','DocumentInspectionResponse','DocumentErrorResponse'];
 const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);
 const exportNames=['validateCreateRequest','validateReviseRequest','validateInspectRequest','validateDownloadRequest','validateCreated','validateInspection','validateError'];const exports={};names.forEach((name,i)=>{const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});exports[exportNames[i]]=ref;});
 const generated=standalone(ajv,exports),statusSource='export const errorStatuses='+JSON.stringify(statusEntries)+';';
 const bundled=await build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('document-application/receive.mjs',HERE),'utf8'),sourcefile:'document-application-receiver.mjs',resolveDir:resolve(dir,'document-application')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,plugins:[{name:'document-generated',setup(b){b.onResolve({filter:/^\.\/generated-(validator|status)\.mjs$/},a=>({path:a.path,namespace:'document-generated'}));b.onLoad({filter:/.*/,namespace:'document-generated'},a=>({contents:a.path.includes('validator')?generated:statusSource,resolveDir:dir,loader:'js'}));}}]});
 if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Document browser external import');
 const declarations=await compile({title:'DocumentApplicationEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:root.$defs},'DocumentApplicationEnvelope',{bannerComment:'// Generated from canonical document receiving schema. No authorization implied.',additionalProperties:false,style:{singleQuote:true}});
 const api=`
export type DocumentRoute = 'create' | 'revise' | 'inspect' | 'download';
declare const admittedRequest: unique symbol;
declare const admittedVersion: unique symbol;
export interface DocumentRequestMap { create:DocumentCreateRequest; revise:DocumentReviseRequest; inspect:DocumentInspectRequest; download:DocumentDownloadRequest; }
export type AdmittedDocumentRequest<R extends DocumentRoute> = Readonly<DocumentRequestMap[R]> & {readonly [admittedRequest]:R};
export type AdmittedDocumentVersion = Readonly<DocumentVersion> & {readonly [admittedVersion]:true};
export type DocumentReceipt<T> = Omit<T,'version'> & {readonly version:AdmittedDocumentVersion};
export interface DocumentResponseMap {create:DocumentReceipt<DocumentCreatedResponse>; revise:DocumentReceipt<DocumentCreatedResponse>; inspect:DocumentReceipt<DocumentInspectionResponse>; download:never;}
export type DocumentResponse<R extends DocumentRoute> = DocumentResponseMap[R] | DocumentErrorResponse;
export interface DocumentDownload {readonly version:AdmittedDocumentVersion; readonly bytes:Uint8Array;}
export interface DocumentDownloadOptions {maxBytes?:number; timeoutMs?:number; signal?:AbortSignal;}
export declare class DocumentResponseError extends Error {readonly code:string;}
export declare function receiveDocumentRequest<R extends DocumentRoute>(route:R,utf8Bytes:Uint8Array):AdmittedDocumentRequest<R>;
export declare function receiveDocumentResponse<R extends DocumentRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedDocumentRequest<R>):Promise<DocumentResponse<R>>;
export declare function receiveDocumentDownload(response:Response,version:AdmittedDocumentVersion,options?:DocumentDownloadOptions):Promise<DocumentDownload>;
`;
 const outputs=new Map([['document-application.mjs','// Generated browser receiving boundary; no authority.\n'+bundled.outputFiles[0].text],['document-application.d.ts',declarations+api],['document-application.schema.json',JSON.stringify(root,null,2)+'\n'],['document-application.metadata.json',JSON.stringify({packageVersion:'0.1.2',schemaId:root.$id,sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(JSON.stringify(root,null,2)+'\n'),browserInputs:Object.keys(bundled.metafile.inputs).sort()},null,2)+'\n']]);
 if(check){for(const [name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
 return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-documents.mjs [--check|--help]; offline deterministic build; exit1 invalid arguments/drift.');else if(args.length>1||(args.length&&args[0]!=='--check')){process.stderr.write('Invalid arguments\n');process.exitCode=1;}else generateDocumentContracts({check:args[0]==='--check'}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});}
