/** Downloaded files leave the browser output directory only through the artifact owner, after source, type,
 * structure and size checks. A download slot and the file identity are claimed synchronously, before any
 * asynchronous work, so concurrent calls cannot exceed `maxFiles` or ingest one file twice.
 *
 * The source URL is decided by the egress rule for `download` connections (`egress.mjs`). The ingest request carries
 * provenance (source origin and host, acquisition time, effective policy digest) and a deterministic idempotency key
 * over tenant, conversation, run, filename and content digest, so a retried attempt of the same run cannot create a
 * second artifact version; the artifact owner must echo the key. */
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,realpath,unlink} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {ARTIFACT_MIME_TYPES} from '../../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {egressDecision} from './egress.mjs';
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
export const DOWNLOAD_IDEMPOTENCY_SCHEMA='meri-browser-download/1';
/** Same key for every attempt of one run that ingests the same bytes under the same name. */
export const downloadIdempotencyKey=(binding,filename,sha256)=>canonicalSha256({schema:DOWNLOAD_IDEMPOTENCY_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,runId:binding.runId,filename,sha256});
export const disabledDownloads=Object.freeze({async accept(){fail('BROWSER_DOWNLOADS_DISABLED');}});
export function createDownloadPort({binding,policy,policySha256,sourceScopes,paths,artifacts,receipts,reconcile,now,assertCurrent}){
 const limits=policy.downloads;
 if(!limits.enabled)return disabledDownloads;
 /** `reserved` counts slots held by in-flight or completed downloads; `claimed` holds every filename in flight or done.
  * A filename whose pointer write or receipt acknowledgement was LOST stays claimed as `unknown`, so a retry
  * reconciles the SAME deterministic identity instead of being refused or publishing a second version. */
 let reserved=0;const claimed=new Set(),attempts=new Map(),inflight=new Set();
 return Object.freeze({
 /** @param {{filename?:any,url?:any}} [request] @param {{signal?:AbortSignal}} [options] */
 async accept({filename,url}={},{signal}={}){
 // Synchronous admission: everything up to the reservation runs before the first await.
 if(signal?.aborted)fail('BROWSER_DOWNLOAD_CANCELLED');
 if(typeof filename!=='string'||!NAME.test(filename)||filename.includes('..'))fail('BROWSER_DOWNLOAD_NAME');
 const format=extname(filename).slice(1).toLowerCase();if(!limits.formats.includes(format))fail('BROWSER_DOWNLOAD_TYPE');
 const source=egressDecision(policy,{kind:'download',url});if(!source.ok)fail('BROWSER_DOWNLOAD_SOURCE');
 const urlHost=new URL(source.origin).hostname;
 const prior=attempts.get(filename);
  // Synchronous exclusion: two callers can never both observe the same unknown attempt before its first await.
  if(inflight.has(filename))fail('BROWSER_DOWNLOAD_DUPLICATE');
 // Only a LOST receipt/pointer acknowledgement is retryable; an ingest whose outcome is unknown keeps the
  // existing duplicate refusal, because the artifact owner cannot prove the original pointer from here.
  if(claimed.has(filename)&&!(prior?.status==='unknown'&&prior.published===true))fail('BROWSER_DOWNLOAD_DUPLICATE');
 if(!claimed.has(filename)){
  if(reserved>=limits.maxFiles)fail('BROWSER_DOWNLOAD_LIMIT');
  reserved++;claimed.add(filename);
 }
 inflight.add(filename);
 // A refusal before the artifact owner is called releases a NEW slot; once ingest is attempted the slot stays used.
 let ingestAttempted=prior?.status==='unknown',published=false;
 try{
  const path=join(paths.output,filename);let stat;try{stat=await lstat(path);}catch(error){
   if(error?.code!=='ENOENT'||typeof reconcile!=='function')fail('BROWSER_DOWNLOAD_MISSING');
   // READ-ONLY recovery: a recreated worker with the original output file gone discovers the ORIGINAL committed
   // download through the canonical owners instead of uploading again or inventing bytes/identifiers.
   if(signal?.aborted)fail('BROWSER_DOWNLOAD_CANCELLED');
   let found;try{found=await reconcile({filename},{...(signal===undefined?{}:{signal})});}
   catch{fail('BROWSER_DOWNLOAD_RECOVERY');}
   if(!found||typeof found.versionId!=='string')fail('BROWSER_DOWNLOAD_RECOVERY');
   // A committed version whose receipt is absent is an accurate partial, not permission to append now.
   if(!found.receipt)fail('BROWSER_DOWNLOAD_RECEIPT_PARTIAL');
   ingestAttempted=true;published=true;attempts.set(filename,Object.freeze({status:'done',published:true,
    versionId:found.versionId}));
   return Object.freeze({versionId:found.versionId,sha256:found.sha256,bytes:found.bytes,
    mimeType:found.mimeType,recovered:true});
  }
  if(!stat.isFile()||stat.isSymbolicLink()||await realpath(paths.output)!==paths.output)fail('BROWSER_DOWNLOAD_PATH');
  if(stat.size<1||stat.size>limits.maxBytes)fail('BROWSER_DOWNLOAD_SIZE');
  const bytes=await readBounded(path,limits.maxBytes),structure=structureCheck(bytes,format);if(!bytes.length||!structure.valid)fail('BROWSER_DOWNLOAD_TYPE',structure.reason);
  if(signal?.aborted)fail('BROWSER_DOWNLOAD_CANCELLED');
  const sha256=createHash('sha256').update(bytes).digest('hex'),mimeType=ARTIFACT_MIME_TYPES[format],idempotencyKey=downloadIdempotencyKey(binding,filename,sha256);
  // A retried unknown attempt must still be the SAME bytes under the SAME name; a changed file is a new claim.
  if(prior?.published===true&&prior.key!==idempotencyKey)fail('BROWSER_DOWNLOAD_DUPLICATE');
  await assertCurrent?.({signal});
  if(signal?.aborted)fail('BROWSER_DOWNLOAD_CANCELLED');
  ingestAttempted=true;
  // The ORIGINAL receipt facts are fixed by the first attempt: a retry after a lost ACK must present the
  // identical timestamp/host so the producer's immutable payload matches the stored event.
  const original=prior?.facts??Object.freeze({urlHost,atMs:now(),sha256,bytes:bytes.length,mimeType});
  attempts.set(filename,{key:idempotencyKey,status:'unknown',published:false,facts:original});
  const stored=await artifacts.ingest({binding:structuredClone(binding),scopes:structuredClone(sourceScopes),filename,format,mimeType,bytes:Buffer.from(bytes),sha256,idempotencyKey,
   source:{kind:'browser-download',origin:source.origin,urlHost,acquiredAtMs:now(),policySha256}},{signal});
  if(typeof stored?.versionId!=='string'||!stored.versionId||stored.sha256!==sha256||stored.bytes!==bytes.length||stored.idempotencyKey!==idempotencyKey)fail('BROWSER_DOWNLOAD_INGEST');
  published=true;
  // Authoritative facts come from committed canonical state: a committed receipt's own atMs when this version
  // was replayed, else the committed version's acquisition timestamp. A new clock is never invented here.
  let receiptAtMs=original.atMs,receiptFound=false;
  if(stored?.replay===true&&typeof reconcile==='function'){
   // Authoritative read-only discovery; a refusal/unknown is NOT absence and propagates.
   const found=await reconcile({filename},{...(signal===undefined?{}:{signal})});
   if(found?.receipt&&found.sha256===sha256&&found.versionId===stored.versionId&&
    found.bytes===bytes.length&&found.mimeType===mimeType){receiptAtMs=found.receipt.atMs;receiptFound=true;}
  }
  if(!receiptFound&&Number.isSafeInteger(stored?.acquiredAtMs))receiptAtMs=stored.acquiredAtMs;
  if(receiptAtMs!==original.atMs)attempts.set(filename,{key:idempotencyKey,status:'unknown',published:true,
   facts:Object.freeze({...original,atMs:receiptAtMs})});
  await receipts.record({schema:'meri-browser-receipt/1',kind:'browser.download',binding:structuredClone(binding),
    urlHost:original.urlHost,atMs:receiptAtMs,reference:stored.versionId,sha256:original.sha256,bytes:original.bytes,mimeType:original.mimeType},{signal});
  // A caller cancellation after the receipt must not report a late success or remove the source silently.
  if(signal?.aborted)fail('BROWSER_DOWNLOAD_CANCELLED');
  await unlink(path);
  attempts.set(filename,{key:idempotencyKey,status:'done',published:true,facts:original,versionId:stored.versionId});
  return Object.freeze({versionId:stored.versionId,sha256,bytes:bytes.length,mimeType,
   ...(stored.reconciled===true?{reconciled:true}:{})});
 }catch(error){
  inflight.delete(filename);
  if(!ingestAttempted){reserved--;claimed.delete(filename);}
  else attempts.set(filename,{key:attempts.get(filename)?.key,status:'unknown',published,facts:attempts.get(filename)?.facts});
  // The published version is retained; only a definite receipt/pointer failure is reported as unresolved.
  if(published)throw Object.assign(new Error('BROWSER_DOWNLOAD_RECEIPT_UNKNOWN'),{code:'BROWSER_DOWNLOAD_RECEIPT_UNKNOWN',cause:error});
  throw error;
 }
 }});
 }
