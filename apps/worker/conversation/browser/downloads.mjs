/** Downloaded files leave the browser output directory only through the artifact owner, after source, type,
 * structure and size checks. A download slot and the file identity are claimed synchronously, before any
 * asynchronous work, so concurrent calls cannot exceed `maxFiles` or ingest one file twice. */
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,realpath,unlink} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {ARTIFACT_MIME_TYPES} from '../../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {checkBrowserUrl} from './policy.mjs';
import {structureCheck} from '../../../artifacts/structure/file-structure.mjs';
/** `detail` carries a closed structural refusal reason (STRUCTURE_REASONS) for BROWSER_DOWNLOAD_TYPE. */
const fail=(code,detail)=>{throw Object.assign(new Error(code),{code,...(detail?{detail}:{})});};
const NAME=/^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/u;
async function readBounded(path,maxBytes){
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const buffer=Buffer.alloc(maxBytes+1),{bytesRead}=await handle.read(buffer,0,maxBytes+1,0);if(bytesRead>maxBytes)fail('BROWSER_DOWNLOAD_SIZE');return buffer.subarray(0,bytesRead);}finally{await handle.close();}
}
/** Same-tenant source scopes attached to ingested downloads; a trusted fact from the control owner, not policy. */
export function validateSourceScopes(scopes,binding){
 const refuse=()=>{throw Object.assign(new Error('BROWSER_CONFIGURATION'),{code:'BROWSER_CONFIGURATION'});};
 if(!Array.isArray(scopes)||!scopes.length||scopes.length>64)refuse();
 try{scopes.forEach(s=>validateShape('Scope',s));}catch{refuse();}
 if(scopes.some(s=>s.tenantId!==binding.tenantId))refuse();
 return Object.freeze(structuredClone(scopes));
}
export const disabledDownloads=Object.freeze({async accept(){fail('BROWSER_DOWNLOADS_DISABLED');}});
export function createDownloadPort({binding,policy,sourceScopes,paths,artifacts,receipts,now}){
 const limits=policy.downloads;
 if(!limits.enabled)return disabledDownloads;
 /** `reserved` counts slots held by in-flight or completed downloads; `claimed` holds every filename in flight or done. */
 let reserved=0;const claimed=new Set();
 return Object.freeze({
  /** @param {{filename?:any,url?:any}} [request] @param {{signal?:AbortSignal}} [options] */
  async accept({filename,url}={},{signal}={}){
  // Synchronous admission: everything up to the reservation runs before the first await.
  if(signal?.aborted)fail('BROWSER_DOWNLOAD_CANCELLED');
  if(typeof filename!=='string'||!NAME.test(filename)||filename.includes('..'))fail('BROWSER_DOWNLOAD_NAME');
  const format=extname(filename).slice(1).toLowerCase();if(!limits.formats.includes(format))fail('BROWSER_DOWNLOAD_TYPE');
  const source=checkBrowserUrl(policy,url);if(!source.ok||source.blank)fail('BROWSER_DOWNLOAD_SOURCE');
  if(claimed.has(filename))fail('BROWSER_DOWNLOAD_DUPLICATE');
  if(reserved>=limits.maxFiles)fail('BROWSER_DOWNLOAD_LIMIT');
  reserved++;claimed.add(filename);
  // A refusal before the artifact owner is called releases the slot; once ingest is attempted the slot stays used.
  let ingestAttempted=false;
  try{
   const path=join(paths.output,filename);let stat;try{stat=await lstat(path);}catch{fail('BROWSER_DOWNLOAD_MISSING');}
   if(!stat.isFile()||stat.isSymbolicLink()||await realpath(paths.output)!==paths.output)fail('BROWSER_DOWNLOAD_PATH');
   if(stat.size<1||stat.size>limits.maxBytes)fail('BROWSER_DOWNLOAD_SIZE');
   const bytes=await readBounded(path,limits.maxBytes),structure=structureCheck(bytes,format);if(!bytes.length||!structure.valid)fail('BROWSER_DOWNLOAD_TYPE',structure.reason);
   if(signal?.aborted)fail('BROWSER_DOWNLOAD_CANCELLED');
   const sha256=createHash('sha256').update(bytes).digest('hex'),mimeType=ARTIFACT_MIME_TYPES[format];
   ingestAttempted=true;
   const stored=await artifacts.ingest({binding:structuredClone(binding),scopes:structuredClone(sourceScopes),filename,format,mimeType,bytes:Buffer.from(bytes),sha256,source:{kind:'browser-download',urlHost:source.host}},{signal});
   if(typeof stored?.versionId!=='string'||!stored.versionId||stored.sha256!==sha256||stored.bytes!==bytes.length)fail('BROWSER_DOWNLOAD_INGEST');
   await receipts.record({schema:'meri-browser-receipt/1',kind:'browser.download',binding:structuredClone(binding),urlHost:source.host,atMs:now(),reference:stored.versionId,sha256,bytes:bytes.length,mimeType},{signal});
   await unlink(path);
   return Object.freeze({versionId:stored.versionId,sha256,bytes:bytes.length,mimeType});
  }catch(error){
   if(!ingestAttempted){reserved--;claimed.delete(filename);}
   throw error;
  }
 }});
}
