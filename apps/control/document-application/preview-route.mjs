/** Preview routes over the artifact preview owner (`../../artifacts/preview/service.mjs`); reads stay on the canonical
 * artifact read path and cannot reach budget reservation or settlement.
 *   POST /api/documents/preview-publish {versionId} -> {status, preview}  (render once, store, commit the immutable record)
 *   POST /api/documents/preview         {versionId} -> the preview PDF, inline, no-store, sandboxed
 * Without trusted `previewOptions` both routes are 503 PREVIEW_UNAVAILABLE. A Word-bound application previews only Word-family
 * versions and an Excel-bound one only workbooks (the same format admission as inspect/download). */
import {createHash} from 'node:crypto';
import {createArtifactService} from '../../artifacts/service.mjs';
import {createArtifactPreviewService} from '../../artifacts/preview/service.mjs';
import {isRendererPort} from '../../artifacts/renderer.mjs';
import {own,v,method} from './current.mjs';
import {admitsDocumentMime} from './format-admission.mjs';
import {response,fail} from './http.mjs';

/** Trusted preview configuration captured at construction, or null when previews are not composed. */
export function previewConfiguration(value){
 if(value===undefined)return null;
 const p=own(value,['previews','renderer'],['maxPreviewBytes']);
 if(p.renderer!==null&&!isRendererPort(p.renderer))fail('DOCUMENT_CONFIGURATION',500);
 return Object.freeze({previews:{read:method(p.previews,'read'),commit:method(p.previews,'commit'),claim:method(p.previews,'claim'),recordObject:method(p.previews,'recordObject'),
  ...(Object.hasOwn(p.previews,'assertCurrent')?{assertCurrent:method(p.previews,'assertCurrent')}:{})},renderer:p.renderer,...(p.maxPreviewBytes===undefined?{}:{maxPreviewBytes:p.maxPreviewBytes})});
}
/** Handles one preview intent; `release(version)` is the application's own version release check. */
export async function previewRoute({config,admission,current,life,intent,versionId,state,release}){
 if(!config.preview)fail('PREVIEW_UNAVAILABLE',503);
 const context=config.options.context,forbidden=()=>fail('DOCUMENT_READ_BUDGET_REFUSED',500);
 const artifacts=createArtifactService({...config.options,authorize:current.authorize,budget:{reserve:forbidden,settle:forbidden}});
 const previews=createArtifactPreviewService({validators:v,artifacts,objects:config.options.objects,previews:config.preview.previews,renderer:config.preview.renderer,ids:config.options.ids,now:config.now,
  ...(config.preview.maxPreviewBytes===undefined?{}:{maxPreviewBytes:config.preview.maxPreviewBytes})});
 if(intent==='preview-publish'){
  // Canonical reads precede the durable claim; claiming begins the uncertain-effect boundary before rendering.
  state.readStarted=true;
  const result=await life.run(async signal=>{const value=await previews.publish(versionId,context,{signal,onWriteStarted:()=>{state.writeStarted=true;}});state.completed=true;return value;});
  if(result.preview.versionId!==versionId||!admitsDocumentMime(admission,result.preview.source.mimeType))fail('DOCUMENT_RESULT_REFUSED',502);
  const body={status:result.status,preview:result.preview};if(Buffer.byteLength(JSON.stringify(body))>config.limits.maxResponseBytes)fail('DOCUMENT_RESPONSE_LIMIT',413);
  await current.fresh();current.check();return response(body);
 }
 state.readStarted=true;
 const result=await life.run(async signal=>{const value=await previews.read(versionId,context,{signal});state.completed=true;return value;});
 const record=release(result.version),object=result.preview.preview.object;
 if(!Buffer.isBuffer(result.bytes)||result.bytes.length!==object.bytes||createHash('sha256').update(result.bytes).digest('hex')!==object.sha256||result.preview.source.sha256!==record.object.sha256||result.bytes.length>config.limits.maxResponseBytes)fail('DOCUMENT_RESULT_REFUSED',502);
 const bytes=Buffer.from(result.bytes);await current.fresh();current.check();
 return new Response(bytes,{status:200,headers:{'content-type':result.preview.preview.mimeType,'content-disposition':`inline; filename="${record.filename}.preview.pdf"`,'content-length':String(bytes.length),
  'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"sandbox; default-src 'none'"}});
}
