/** Preview publication and serving, owned by the artifact service. Every step runs under the canonical artifact read path
 * (`artifacts` is the canonical ArtifactService): `artifact.download` authorization for the exact version, the retention
 * read gate (suppression, recovery barrier) and current-bytes verification happen before a preview is rendered, before its
 * record is committed and again after preview bytes are read for serving, so a suppressed, revoked or out-of-scope version
 * never yields a preview.
 *
 * publish(versionId, context): renders once per version, writes the preview bytes through the canonical object port, reads
 *   them back, rechecks authority and retention, then commits the immutable preview record (write-once per version). A
 *   durable claim precedes rendering and object writes; an unresolved claim never dispatches again. Every potential
 *   object identity is retained before put, and its exact returned version is recorded before publication. Failure
 *   after claiming is ARTIFACT_EFFECT_UNKNOWN. An existing immutable record recovers a lost publication acknowledgement.
 *   `onWriteStarted` is called once, immediately before the first effect (the durable claim).
 * read(versionId, context): `{version, preview, bytes}` with the preview bound to the version's exact bytes, or
 *   ARTIFACT_PREVIEW_PENDING / ARTIFACT_PREVIEW_UNSUPPORTED. No budget is reserved; rendering is bounded by the context
 *   deadline, MAX_PREVIEW_BYTES and MAX_PREVIEW_PAGES. */
import {createHash} from 'node:crypto';
import {ARTIFACT_MIME_TYPES} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {admittedConverter,isRendererPort} from '../renderer.mjs';
import {renderPreview,PREVIEW_FORMATS,MAX_PREVIEW_BYTES} from './render.mjs';
import {previewRecord,verifyPreviewRecord} from './record.mjs';
import {previewClaim,verifyPreviewClaim} from './claim.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const formatOf=mimeType=>Object.keys(ARTIFACT_MIME_TYPES).find(format=>ARTIFACT_MIME_TYPES[format]===mimeType)??null;

export function createArtifactPreviewService({validators:v,artifacts,objects,previews,renderer=null,ids,now,maxPreviewBytes=MAX_PREVIEW_BYTES}){
 if(![artifacts?.inspect,artifacts?.download,objects?.put,objects?.get,previews?.read,previews?.commit,previews?.claim,previews?.recordObject,ids,now].every(f=>typeof f==='function')||typeof v?.hash!=='function'||
  renderer!==null&&!isRendererPort(renderer)||previews.assertCurrent!==undefined&&typeof previews.assertCurrent!=='function'||!Number.isSafeInteger(maxPreviewBytes)||maxPreviewBytes<1||maxPreviewBytes>MAX_PREVIEW_BYTES)fail('ARTIFACT_CONFIGURATION');
 const converter=admittedConverter(renderer);
 async function stored(versionId,version,signal){const value=await previews.read(versionId,signal);return value===null?null:verifyPreviewRecord(v,value,version);}
 async function current(versionId,version,context,signal){const read=await artifacts.inspect(versionId,context,{signal});if(v.hash(read.version)!==v.hash(version))fail('ARTIFACT_OBJECT_MISMATCH');}
 async function publish(versionId,contextValue,{signal,onWriteStarted}={}){
  const context=v.context(contextValue),source=await artifacts.download(versionId,context,{signal}),version=source.version,format=formatOf(version.mimeType);
  const existing=await stored(versionId,version,signal);if(existing){await current(versionId,version,context,signal);if(v.hash(await stored(versionId,version,signal))!==v.hash(existing))fail('ARTIFACT_PREVIEW_CORRUPT');return {status:'existing',preview:existing};}
  if(!PREVIEW_FORMATS.includes(format))fail('ARTIFACT_PREVIEW_UNSUPPORTED');
  if(format!=='pdf'&&!converter)fail('ARTIFACT_RENDERER_UNAVAILABLE');
  const allocation=v.snapshot(ids()),objectId=allocation?.objectId,previewId=allocation?.versionId;
  const attempt=previewClaim(v,version,allocation,context,new Date(now()).toISOString());
  let custody=attempt;
  try{
   onWriteStarted?.();
   const claimed=await previews.claim(v.snapshot(attempt),signal);custody=verifyPreviewClaim(v,claimed?.claim,version);
   if(claimed.claimed!==true){
    const recovered=await stored(versionId,version,signal);if(recovered){await current(versionId,version,context,signal);return {status:'existing',preview:recovered};}
    fail('ARTIFACT_PREVIEW_CLAIM_HELD');
   }
   if(v.hash(custody)!==v.hash(attempt))fail('ARTIFACT_PREVIEW_CLAIM');
   await current(versionId,version,context,signal);
   await previews.assertCurrent?.(v.snapshot(custody),signal);
   const rendered=await renderPreview({bytes:source.bytes,format,renderer:converter,deadlineMs:context.deadlineMs,maxBytes:maxPreviewBytes,signal});
   await current(versionId,version,context,signal);
   await previews.assertCurrent?.(v.snapshot(custody),signal);
   const object=v.object(await objects.put({objectId,bytes:Buffer.from(rendered.bytes),scopes:v.snapshot(version.scopes),requestSha256:v.hash({preview:versionId,sourceSha256:version.object.sha256})},signal));
   if(object.objectId!==objectId||object.bytes!==rendered.bytes.length||object.sha256!==sha(rendered.bytes)||v.hash(object.scopes)!==v.hash(version.scopes))fail('ARTIFACT_OBJECT_MISMATCH');
   await previews.recordObject(v.snapshot(custody),v.snapshot(object),signal);
   const readBack=await objects.get(v.snapshot(object),signal);if(!Buffer.isBuffer(readBack)||!readBack.equals(rendered.bytes))fail('ARTIFACT_OBJECT_MISMATCH');
   // Current authority, retention and the exact source bytes again before the record makes the preview servable.
   await current(versionId,version,context,signal);
   await previews.assertCurrent?.(v.snapshot(custody),signal);
   const record=previewRecord({v,previewId,version,object,pages:rendered.pages,conversion:rendered.conversion,createdAt:new Date(now()).toISOString()});
   const receipt=await previews.commit(v.snapshot(record),signal);
   if(!['committed','duplicate'].includes(receipt?.status)||receipt.versionId!==versionId||receipt.recordSha256!==v.hash(record))fail('ARTIFACT_PREVIEW_COMMIT_RECEIPT');
   return {status:'published',preview:record};
  }catch(cause){
   throw Object.assign(new Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,previewCommitted:false,objectId:custody.objectId,versionId});
  }
 }
 async function read(versionId,contextValue,{signal}={}){
  const context=v.context(contextValue),first=await artifacts.download(versionId,context,{signal}),format=formatOf(first.version.mimeType);
  const record=await stored(versionId,first.version,signal);
  if(!record)fail(PREVIEW_FORMATS.includes(format)?'ARTIFACT_PREVIEW_PENDING':'ARTIFACT_PREVIEW_UNSUPPORTED');
  const object=record.preview.object;if(object.bytes>maxPreviewBytes)fail('ARTIFACT_PREVIEW_LIMIT');
  const bytes=await objects.get(v.snapshot(object),signal);
  if(!Buffer.isBuffer(bytes)||bytes.length!==object.bytes||sha(bytes)!==object.sha256)fail('ARTIFACT_OBJECT_MISMATCH');
  // Authority and retention after the preview bytes were read: a suppression or revocation in between releases nothing.
  const second=await artifacts.download(versionId,context,{signal});
  if(v.hash(second.version)!==v.hash(first.version))fail('ARTIFACT_OBJECT_MISMATCH');
  if(v.hash(await stored(versionId,second.version,signal))!==v.hash(record))fail('ARTIFACT_PREVIEW_CORRUPT');
  return {version:second.version,preview:record,bytes:Buffer.from(bytes)};
 }
 return Object.freeze({publish,read});
}
