/** Preview publication and serving, owned by the artifact service. Every step runs under the canonical artifact read path
 * (`artifacts` is the canonical ArtifactService): `artifact.download` authorization for the exact version, the retention
 * read gate (suppression, recovery barrier) and current-bytes verification happen before a preview is rendered, before its
 * record is committed and again after preview bytes are read for serving, so a suppressed, revoked or out-of-scope version
 * never yields a preview.
 *
 * publish(versionId, context): renders once per version, writes the preview bytes through the canonical object port, reads
 *   them back, rechecks authority and retention, then commits the immutable preview record (write-once per version). A
 *   failure after the object write is ARTIFACT_EFFECT_UNKNOWN with `previewCommitted:false` and the written object id
 *   (the object may remain unreferenced); it is never reported as no effect. An existing record is returned as-is.
 *   `onWriteStarted` is called once, immediately before the first effect (the preview object write).
 * read(versionId, context): `{version, preview, bytes}` with the preview bound to the version's exact bytes, or
 *   ARTIFACT_PREVIEW_PENDING / ARTIFACT_PREVIEW_UNSUPPORTED. No budget is reserved; rendering is bounded by the context
 *   deadline, MAX_PREVIEW_BYTES and MAX_PREVIEW_PAGES. */
import {createHash} from 'node:crypto';
import {ARTIFACT_MIME_TYPES} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {admittedConverter,isRendererPort} from '../renderer.mjs';
import {renderPreview,PREVIEW_FORMATS,MAX_PREVIEW_BYTES} from './render.mjs';
import {previewRecord,verifyPreviewRecord} from './record.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const formatOf=mimeType=>Object.keys(ARTIFACT_MIME_TYPES).find(format=>ARTIFACT_MIME_TYPES[format]===mimeType)??null;

export function createArtifactPreviewService({validators:v,artifacts,objects,previews,renderer=null,ids,now,maxPreviewBytes=MAX_PREVIEW_BYTES}){
 if(![artifacts?.inspect,artifacts?.download,objects?.put,objects?.get,previews?.read,previews?.commit,ids,now].every(f=>typeof f==='function')||typeof v?.hash!=='function'||
  renderer!==null&&!isRendererPort(renderer)||!Number.isSafeInteger(maxPreviewBytes)||maxPreviewBytes<1||maxPreviewBytes>MAX_PREVIEW_BYTES)fail('ARTIFACT_CONFIGURATION');
 const converter=admittedConverter(renderer);
 async function stored(versionId,version,signal){const value=await previews.read(versionId,signal);return value===null?null:verifyPreviewRecord(v,value,version);}
 async function publish(versionId,contextValue,{signal,onWriteStarted}={}){
  const context=v.context(contextValue),source=await artifacts.download(versionId,context,{signal}),version=source.version,format=formatOf(version.mimeType);
  const existing=await stored(versionId,version,signal);if(existing)return {status:'existing',preview:existing};
  if(!PREVIEW_FORMATS.includes(format))fail('ARTIFACT_PREVIEW_UNSUPPORTED');
  const rendered=await renderPreview({bytes:source.bytes,format,renderer:converter,deadlineMs:context.deadlineMs,maxBytes:maxPreviewBytes,signal});
  const allocation=v.snapshot(ids()),objectId=allocation?.objectId,previewId=allocation?.versionId;
  let writeStarted=false,committed=false;
  try{
   writeStarted=true;onWriteStarted?.();
   const object=v.object(await objects.put({objectId,bytes:Buffer.from(rendered.bytes),scopes:v.snapshot(version.scopes),requestSha256:v.hash({preview:versionId,sourceSha256:version.object.sha256})},signal));
   if(object.objectId!==objectId||object.bytes!==rendered.bytes.length||object.sha256!==sha(rendered.bytes)||v.hash(object.scopes)!==v.hash(version.scopes))fail('ARTIFACT_OBJECT_MISMATCH');
   const readBack=await objects.get(v.snapshot(object),signal);if(!Buffer.isBuffer(readBack)||!readBack.equals(rendered.bytes))fail('ARTIFACT_OBJECT_MISMATCH');
   // Current authority, retention and the exact source bytes again before the record makes the preview servable.
   const current=await artifacts.inspect(versionId,context,{signal});if(current.version.object.sha256!==version.object.sha256)fail('ARTIFACT_OBJECT_MISMATCH');
   const record=previewRecord({v,previewId,version,object,pages:rendered.pages,conversion:rendered.conversion,createdAt:new Date(now()).toISOString()});
   const receipt=await previews.commit(v.snapshot(record),signal);
   if(!['committed','duplicate'].includes(receipt?.status)||receipt.versionId!==versionId||receipt.recordSha256!==v.hash(record))fail('ARTIFACT_PREVIEW_COMMIT_RECEIPT');
   committed=true;return {status:'published',preview:record};
  }catch(cause){
   if(!writeStarted||committed)throw cause;
   throw Object.assign(new Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,previewCommitted:false,objectId});
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
  return {version:second.version,preview:record,bytes:Buffer.from(bytes)};
 }
 return Object.freeze({publish,read});
}
