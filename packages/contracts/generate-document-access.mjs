/** Additive document read-path distribution (inspect, download) admitting every canonical inspection format. Imports never generate or connect to
 * services; generation reads the canonical artifact schema and the document/preview owners and writes only document-access artifacts.
 * Canonical esbuild/json-schema-to-typescript backend only. The frozen document-application distribution is not touched. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve,relative,isAbsolute} from 'node:path';
import catalog from './retrieval-0.2/catalog.json' with {type:'json'};
import {ARTIFACT_MIME_TYPES} from './artifacts-0.2/artifact-formats.mjs';
import {documentAccessSchema,DOCUMENT_ACCESS_FORMATS} from './document-access-application/schema.mjs';
import {createDocumentAccessMetadata} from './document-access-application/protocol.mjs';
import {admitDocumentDescriptor} from '../../apps/control/document-application/format-admission.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function tooling(root){const locate=root?createRequire(resolve(root,'package.json')):createRequire(import.meta.url),load=name=>import(pathToFileURL(locate.resolve(name)).href);return Promise.all([load('esbuild'),load('json-schema-to-typescript')]);}
/** The preview owner's format list, read from its source text (importing the module would load the whole structure toolchain and its root dependencies);
 * the file's hash is recorded, and a test compares this value with the module's own export. */
async function previewFormats(){
 const text=await readFile(new URL('../../apps/artifacts/preview/render.mjs',HERE),'utf8'),match=/export const PREVIEW_FORMATS=Object\.freeze\(\[([^\]]+)\]\)/u.exec(text);
 if(!match)throw Error('Missing canonical PREVIEW_FORMATS declaration');
 return [...match[1].matchAll(/'([a-z]+)'/gu)].map(m=>m[1]);
}
/** The formats each trusted composition admits, asked of the real admission function with the real catalog descriptors. */
function operationFormats(){
 const descriptor=id=>{const entry=catalog.operations.find(e=>e.operation.id===id);if(!entry)throw Error('Missing catalog operation '+id);return {operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements};};
 const formats=(id,pdf=false)=>[...admitDocumentDescriptor(descriptor(id),{pdf}).formats];
 return {create_word:formats('create_word'),create_word_with_pdf:formats('create_word',true),create_excel:formats('create_excel'),create_powerpoint:formats('create_powerpoint'),run_analysis:formats('run_analysis')};
}
export async function generateDocumentAccessContracts({check=false,toolchainRoot}={}){
 const [{default:Ajv},{default:formats},{default:standalone},[esbuild,compiler]]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),tooling(toolchainRoot)]);
 try{
  const sources=new Map(),record=async path=>{const raw=await readFile(new URL(path,HERE));sources.set(path,{path,sha256:hash(raw),bytes:raw.length});return raw;};
  const originals=new Map();
  for(const path of ['meri.schema.json','artifacts-0.2/artifact.schema.json']){const raw=await record(path),schema=JSON.parse(raw);originals.set(schema.$id,{schema,path});}
  const httpFiles=['../../apps/control/document-application/http.mjs','../../apps/control/document-application/index.mjs','../../apps/control/document-application/current.mjs','../../apps/control/document-application/format-admission.mjs','../../apps/control/action-application/http.mjs'];
  for(const path of httpFiles)await record(path);
  // Only document faults plus shared JSON-reader faults; the same derivation the frozen document-application generator uses.
  const documentHttp=await readFile(new URL(httpFiles[0],HERE),'utf8'),statuses={DOCUMENT_REFUSED:502,REQUEST_FAILED:502};
  for(const m of documentHttp.matchAll(/\['([A-Z_]+)',(\d+)\]/gu))statuses[m[1]]=Number(m[2]);
  for(const path of httpFiles.slice(0,4)){const text=await readFile(new URL(path,HERE),'utf8');for(const m of text.matchAll(/fail\('([A-Z_]+)'(?:,(\d+))?\)/gu))statuses[m[1]]=Number(m[2]??400);}
  const shared=await readFile(new URL(httpFiles[4],HERE),'utf8'),body=shared.slice(shared.indexOf('export async function jsonBody'),shared.indexOf('export function response'));
  for(const m of body.matchAll(/fail\('([A-Z_]+)'(?:,(\d+))?\)/gu))statuses[m[1]]=Number(m[2]??400);
  const errorStatuses=Object.fromEntries(Object.entries(statuses).sort(([a],[b])=>a.localeCompare(b)));
  // Preview owner and format vocabulary: recorded so a change to either forces regeneration and a fresh review of the semantics text.
  for(const path of ['../../apps/artifacts/preview/render.mjs','../../apps/artifacts/preview/service.mjs','../../apps/artifacts/preview/record.mjs','../../apps/control/document-application/preview-route.mjs','artifacts-0.2/artifact-formats.mjs','retrieval-0.2/catalog.json','document-application/boundary.mjs','document-application/download.mjs','generate-document-access.mjs',
   ...['README.md','schema.mjs','protocol.mjs','receive.mjs','native-results.mjs','preview.mjs','preview-schema.mjs'].map(name=>'document-access-application/'+name)])await record(path);
  const byOperation=operationFormats(),producible=new Set(Object.values(byOperation).flat());
  if(DOCUMENT_ACCESS_FORMATS.some(format=>!producible.has(format))||[...producible].some(format=>!DOCUMENT_ACCESS_FORMATS.includes(format)))throw Error('Document format admission does not match the artifact format vocabulary');
  const config={formats:[...DOCUMENT_ACCESS_FORMATS],mimeTypes:{...ARTIFACT_MIME_TYPES},previewFormats:await previewFormats(),operationFormats:byOperation,errorStatuses},metadata=createDocumentAccessMetadata(config);
  const root=documentAccessSchema(originals.get('urn:meri:artifacts:0.2.0').schema,errorStatuses),defs={},seen=new Map();
  function transform(value,owner){if(Array.isArray(value))return value.map(v=>transform(v,owner));if(!value||typeof value!=='object')return value;const out={};
   for(const[key,v]of Object.entries(value)){if(key!=='$ref'){out[key]=transform(v,owner);continue;}const[urn,fragment]=v.split('#'),id=urn||owner,full=id+'#'+fragment;if(id===root.$id){out[key]='#'+fragment;continue;}
    if(!seen.has(full)){const original=originals.get(id);if(!original)throw Error('Missing schema owner '+id);const name='Canonical_'+fragment.split('/').at(-1)+'_'+hash(full).slice(0,8);seen.set(full,name);let target=original.schema;for(const token of fragment.split('/').slice(1))target=target[token.replaceAll('~1','/').replaceAll('~0','~')];if(!target)throw Error('Missing canonical pointer '+full);defs[name]=transform(target,id);}out[key]='#/$defs/'+seen.get(full);
   }return out;}
  root.$defs={...transform(root.$defs,root.$id),...defs};
  const names=['DocumentInspectRequest','DocumentDownloadRequest','DocumentHistoryRequest','DocumentListRequest','DocumentInspectionResponse','DocumentHistoryResponse','DocumentListResponse','DocumentErrorResponse','DocumentPreviewRequest','DocumentPreviewPublication'],exportNames=['validateInspectRequest','validateDownloadRequest','validateHistoryRequest','validateListRequest','validateInspection','validateHistory','validateList','validateError','validatePreviewRequest','validatePreviewPublication'];
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(root);const refs={};names.forEach((name,i)=>{const ref=root.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs[exportNames[i]]=ref;});
  const generated=standalone(ajv,refs),statusSource='export const errorStatuses='+JSON.stringify(errorStatuses)+';';
  const protocol='import {createDocumentAccessMetadata} from '+JSON.stringify(fileURLToPath(new URL('document-access-application/protocol.mjs',HERE)))+';export const documentAccessMetadata=createDocumentAccessMetadata('+JSON.stringify(config)+');';
  const bundled=await esbuild.build({absWorkingDir:dir,stdin:{contents:await readFile(new URL('document-access-application/receive.mjs',HERE),'utf8'),sourcefile:'document-access-application-receiver.mjs',resolveDir:resolve(dir,'document-access-application')},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,preserveSymlinks:true,
   plugins:[{name:'document-access-generated',setup(b){b.onResolve({filter:/^\.\/generated-(validator|status|protocol)\.mjs$/},a=>({path:a.path,namespace:'document-access-generated'}));b.onLoad({filter:/.*/,namespace:'document-access-generated'},a=>({contents:a.path.includes('validator')?generated:a.path.includes('status')?statusSource:protocol,resolveDir:dir,loader:'js'}));}}]});
  if(Object.values(bundled.metafile.outputs).some(o=>o.imports.length))throw Error('Document access browser external import');
  // Output must not depend on where the checkout sits (preserveSymlinks keeps inputs under this package's own node_modules path): no parent-relative, drive-letter or home path in any comment or module label.
  const leak=/^(?:\/\/ |\s+")[^\n]*(?:\.\.\/|(?<![A-Za-z0-9])[A-Za-z]:[\\/](?!\/)|\/(?:home|Users)\/)/mu.exec(bundled.outputFiles[0].text);if(leak)throw Error('Document access bundle embeds checkout layout: '+leak[0].slice(0,120));
  const declarations=await compiler.compile({title:'DocumentAccessApplicationEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:root.$defs},'DocumentAccessApplicationEnvelope',{bannerComment:'// Generated from the canonical document receiving schema (all artifact formats). No authorization implied.',additionalProperties:false,style:{singleQuote:true}});
  const api=`
export type DocumentAccessRoute = 'inspect' | 'download' | 'history' | 'list';
declare const admittedRequest: unique symbol;
declare const admittedVersion: unique symbol;
export interface DocumentAccessRequestMap { inspect:DocumentInspectRequest; download:DocumentDownloadRequest; history:DocumentHistoryRequest; list:DocumentListRequest; }
export type AdmittedDocumentRequest<R extends DocumentAccessRoute> = Readonly<DocumentAccessRequestMap[R]> & {readonly [admittedRequest]:R};
export type NativeArtifactFileMetadata = Extract<DocumentInspectionResponse,{kind:'native-file'}>['version'];
export type AdmittedDocumentVersion = Readonly<DocumentVersion|NativeArtifactFileMetadata> & {readonly [admittedVersion]:true};
export type DocumentReceipt<T> = T extends {version:infer V} ? Omit<T,'version'> & {readonly version:Readonly<V> & {readonly [admittedVersion]:true}} : never;
export interface DocumentAccessResponseMap {inspect:DocumentReceipt<DocumentInspectionResponse>; download:never; history:DocumentHistoryResponse; list:DocumentListResponse;}
export type DocumentResponse<R extends DocumentAccessRoute> = DocumentAccessResponseMap[R] | DocumentErrorResponse;
export interface DocumentDownload<V extends AdmittedDocumentVersion = AdmittedDocumentVersion> {readonly version:V; readonly bytes:Uint8Array<ArrayBuffer>;}
export interface DocumentDownloadOptions {maxBytes?:number; timeoutMs?:number; signal?:AbortSignal;}
// Additive v1 native-result discovery receiver. Separately named and outside DocumentAccessRoute0.2: it admits no
// version for inspect or download, carries no recorded bytes and describes only workspace-entry metadata.
export declare const nativeResultsVersion: '1.0.0';
export declare const NATIVE_RESULTS_MAX: 32;
export declare const nativeResultsMetadata: Readonly<{contractVersion:'1.0.0'; route:Readonly<{method:'POST'; path:'/api/documents/results'; response:'json'}>; maxResults:32; semantics:Readonly<Record<string,string>>}>;
export interface NativeResultSelector {readonly versionId:string; readonly path:string; readonly bytes:number; readonly sha256:string; readonly executable:boolean;}
export interface NativeResultsSnapshot {readonly manifestId:string; readonly capturedAt:string; readonly results:readonly NativeResultSelector[]; readonly truncated:boolean;}
export declare function receiveNativeResultsRequest(utf8Bytes:Uint8Array):Readonly<{route:'results'}>;
export declare function receiveNativeResultsResponse(httpStatus:number,utf8Bytes:Uint8Array,request:Readonly<{route:'results'}>):Readonly<NativeResultsSnapshot & {route:'results'}>;
export declare class DocumentResponseError extends Error {readonly code:string;}
export declare const documentAccessVersion:'0.2.0';
export declare const documentAccessMetadata:${JSON.stringify(metadata,null,2)};
export declare function receiveDocumentRequest<R extends DocumentAccessRoute>(route:R,utf8Bytes:Uint8Array):AdmittedDocumentRequest<R>;
export declare function receiveDocumentResponse<R extends DocumentAccessRoute>(route:R,httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedDocumentRequest<R>):Promise<DocumentResponse<R>>;
export declare function receiveDocumentDownload<V extends AdmittedDocumentVersion>(response:Response,version:V,options?:DocumentDownloadOptions):Promise<DocumentDownload<V>>;
export declare const documentPreviewVersion:'0.1.0';
export declare const documentPreviewMetadata:Readonly<{contractVersion:'0.1.0';publish:Readonly<{method:'POST';path:'/api/documents/preview-publish';response:'json';effect:'write'}>;read:Readonly<{method:'POST';path:'/api/documents/preview';response:'bytes';effect:'read'}>;maxBytes:8388608;maxPages:500;nativeQualified:false}>;
declare const admittedPreviewRequest:unique symbol;
export type DocumentPreviewAction='publish'|'read';
export type AdmittedDocumentPreviewRequest<A extends DocumentPreviewAction>=Readonly<DocumentPreviewRequest>&{readonly[admittedPreviewRequest]:A};
export type AdmittedGeneratedDocumentVersion=Readonly<DocumentVersion>&{readonly[admittedVersion]:true};
export interface DocumentPreview<V extends AdmittedGeneratedDocumentVersion=AdmittedGeneratedDocumentVersion>{readonly version:V;readonly bytes:Uint8Array<ArrayBuffer>;readonly preview:Readonly<{previewId:string;sourceVersionId:string;sourceSha256:string;sha256:string;pages:number;recordSha256:string;nativeQualified:false}>;}
export declare function receiveDocumentPreviewRequest<A extends DocumentPreviewAction>(action:A,utf8Bytes:Uint8Array):AdmittedDocumentPreviewRequest<A>;
export declare function receiveDocumentPreviewPublication(httpStatus:number,utf8Bytes:Uint8Array,request:AdmittedDocumentPreviewRequest<'publish'>,version:AdmittedGeneratedDocumentVersion):DocumentPreviewPublication|DocumentErrorResponse;
export declare function receiveDocumentPreview<V extends AdmittedGeneratedDocumentVersion>(response:Response,version:V,options?:DocumentDownloadOptions):Promise<DocumentPreview<V>>;
`;
  const schemaBytes=JSON.stringify(root,null,2)+'\n',outputs=new Map([
   ['document-access-application.mjs','// Generated self-contained browser receiving boundary. No authority or deployment acceptance.\n'+bundled.outputFiles[0].text],['document-access-application.d.ts',declarations+api],['document-access-application.schema.json',schemaBytes],
   ['document-access-application.metadata.json',JSON.stringify({...metadata,bundler:'esbuild',declarations:'json-schema-to-typescript',sources:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),
    browserInputs:Object.keys(bundled.metafile.inputs).map(path=>{if(path.startsWith('\0'))return 'virtual:'+path.slice(1);const slash=path.replaceAll('\\','/'),modules=slash.lastIndexOf('/node_modules/');return modules>=0?slash.slice(modules+1):isAbsolute(path)?relative(dir,path).replaceAll('\\','/'):slash;}).sort(),browserImports:[]},null,2)+'\n'],
  ]);
  if(check){for(const[name,content]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==content)throw Error('Generated document access drift: '+name);}else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const[name,content]of outputs)await writeFile(new URL('dist/'+name,HERE),content);}
  return [...outputs].map(([path,content])=>({path,bytes:Buffer.byteLength(content),sha256:hash(content)}));
 }finally{esbuild?.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-document-access.mjs [--check] | --help. Generation uses the canonical esbuild/json-schema-to-typescript tools (MERI_CONTRACT_TOOLCHAIN_ROOT optionally selects them). No installs/network; exit 1 on invalid arguments or drift.');
 else if(new Set(args).size!==args.length||args.some(a=>a!=='--check')){process.stderr.write('Invalid arguments\n');process.exitCode=1;}
 else generateDocumentAccessContracts({check:args.includes('--check'),toolchainRoot:process.env.MERI_CONTRACT_TOOLCHAIN_ROOT}).then(r=>console.log(JSON.stringify(r,null,1)),e=>{process.stderr.write(String(e?.message??e)+'\n');process.exitCode=1;});}
