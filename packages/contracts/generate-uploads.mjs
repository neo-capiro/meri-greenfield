/** Standalone upload receiver generation; no package/version/archive or existing wire changes. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {uploadApplicationSchema} from './uploads-application/schema.mjs';
import {uploadApplicationMetadata,uploadErrorStatuses,uploadRoutes,UPLOAD_LIMITS,UPLOAD_MIME} from './uploads-application/protocol.mjs';
const HERE=new URL('./',import.meta.url),dir=fileURLToPath(HERE),hash=value=>createHash('sha256').update(value).digest('hex');
export async function generateUploadContracts({check=false,toolchainRoot}={}){
 const locate=toolchainRoot?createRequire(resolve(toolchainRoot,'package.json')):createRequire(import.meta.url),load=name=>import(pathToFileURL(locate.resolve(name)).href);
 const [{default:Ajv},{default:formats},{default:standalone},esbuild,{compile}]=await Promise.all([import('ajv/dist/2020.js'),import('ajv-formats'),import('ajv/dist/standalone/index.js'),load('esbuild'),load('json-schema-to-typescript')]);
 try{
  const sources=[];
  for(const path of ['meri.schema.json','generate-uploads.mjs',...['protocol','schema','boundary','receive','download'].map(name=>'uploads-application/'+name+'.mjs'),
   'document-application/boundary.mjs',...['policy','extraction','custody','application','postgres-store'].map(name=>'../../apps/control/uploads/'+name+'.mjs'),
   '../../apps/runtime/product-ports/uploads.mjs','../../apps/runtime/product-applications.mjs']){
   const bytes=await readFile(new URL(path,HERE));sources.push({path,sha256:hash(bytes),bytes:bytes.length});
  }
  const schema=uploadApplicationSchema(),names=['UploadInitiateRequest','UploadIdRequest','UploadReceipt','UploadError'],exports=['validateInitiate','validateId','validateReceipt','validateError'];
  const ajv=new Ajv({strict:true,allErrors:false,code:{source:true,esm:true}});formats(ajv);ajv.addSchema(schema);const refs={};
  names.forEach((name,index)=>{const ref=schema.$id+'#/$defs/'+name;ajv.compile({$ref:ref});refs[exports[index]]=ref;});const validators=standalone(ajv,refs);
  const bundled=await esbuild.build({absWorkingDir:dir,preserveSymlinks:true,stdin:{contents:await readFile(new URL('uploads-application/receive.mjs',HERE),'utf8'),sourcefile:'uploads-receiver.mjs',resolveDir:resolve(dir,'uploads-application')},
   bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',legalComments:'inline',metafile:true,
   plugins:[{name:'uploads-generated',setup(build){build.onResolve({filter:/^\.\/generated-validator\.mjs$/},args=>({path:args.path,namespace:'uploads-generated'}));build.onLoad({filter:/.*/,namespace:'uploads-generated'},()=>({contents:validators,resolveDir:dir,loader:'js'}));}}]});
  if(Object.values(bundled.metafile.outputs).some(output=>output.imports.length))throw Error('Upload browser external import');
  const declarations=await compile({title:'UploadEnvelope',anyOf:names.map(name=>({$ref:'#/$defs/'+name})),$defs:schema.$defs},'UploadEnvelope',
   {bannerComment:'// Generated upload integrity boundary. No authority, malware qualification or retry grant.',additionalProperties:false,style:{singleQuote:true}});
  const api=`
declare const uploadRequestBrand:unique symbol,uploadReceiptBrand:unique symbol;
export type UploadRoute=${uploadRoutes.map(value=>JSON.stringify(value)).join('|')};
export type AdmittedUploadRequest<R extends UploadRoute>=Readonly<R extends 'initiate'?UploadInitiateRequest:UploadIdRequest>&{readonly [uploadRequestBrand]:R};
export type AdmittedUploadReceipt=Readonly<UploadReceipt>&{readonly [uploadReceiptBrand]:true};
export declare class UploadResponseError extends Error {readonly code:string;}
export declare const uploadApplicationVersion:'1.0.0',UPLOAD_POLICY_VERSION:'upload-1';
export declare const uploadApplicationMetadata:${JSON.stringify(uploadApplicationMetadata,null,2)};
export declare const UPLOAD_LIMITS:Readonly<${JSON.stringify(UPLOAD_LIMITS)}>;
export declare const UPLOAD_MIME:Readonly<${JSON.stringify(UPLOAD_MIME)}>;
export declare const uploadRoutes:readonly UploadRoute[],uploadNotDispatchedErrors:readonly string[];
export declare const uploadErrorStatuses:Readonly<Record<string,number>>;
export declare function uploadDisposition(filename:string):string;
export declare function receiveUploadRequest<R extends UploadRoute>(route:R,bytes:Uint8Array):AdmittedUploadRequest<R>;
export declare function uploadRequestPath<R extends UploadRoute>(route:R,request:AdmittedUploadRequest<R>):string;
export declare function receiveUploadResponse<R extends UploadRoute>(route:R,status:number,bytes:Uint8Array,request:AdmittedUploadRequest<R>):AdmittedUploadReceipt|UploadError;
export declare function receiveUploadOriginal(bytes:Uint8Array,request:AdmittedUploadRequest<'complete'>,receipt:AdmittedUploadReceipt):Promise<Uint8Array>;
export declare function receiveUploadDownload(response:Response,request:AdmittedUploadRequest<'read'>,receipt:AdmittedUploadReceipt,options?:{timeoutMs?:number;signal?:AbortSignal}):Promise<Readonly<{receipt:AdmittedUploadReceipt;bytes:Uint8Array}>>;
`;
  const schemaBytes=JSON.stringify(schema,null,2)+'\n';
  const outputs=new Map([['uploads-application.mjs','// Generated upload receiving boundary.\n'+bundled.outputFiles[0].text],['uploads-application.d.ts',declarations+api],
   ['uploads-application.schema.json',schemaBytes],['uploads-application.metadata.json',JSON.stringify({...uploadApplicationMetadata,errorStatuses:uploadErrorStatuses,sources:sources.sort((a,b)=>a.path.localeCompare(b.path)),schemaSha256:hash(schemaBytes),browserInputs:Object.keys(bundled.metafile.inputs).sort()},null,2)+'\n']]);
  if(check){for(const [name,value]of outputs)if(await readFile(new URL('dist/'+name,HERE),'utf8')!==value)throw Error('Generated uploads drift: '+name);}
  else{await mkdir(new URL('dist/',HERE),{recursive:true});for(const [name,value]of outputs)await writeFile(new URL('dist/'+name,HERE),value);}
  return [...outputs].map(([path,value])=>({path,bytes:Buffer.byteLength(value),sha256:hash(value)}));
 }finally{esbuild.stop();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help')console.log('Usage: node generate-uploads.mjs [--check|--help]');
 else if(args.length>1||args.length&&args[0]!=='--check'){console.error('Invalid arguments');process.exitCode=1;}
 else generateUploadContracts({check:args[0]==='--check'}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
}
