import {assertFederalTextLayout,FEDERAL_USLM_XML_PARSER} from './source-layout.mjs';
import canonicalize from 'canonicalize';
import {validateSource,validateSourceEnvelope,validateImport,validateImported,validatePrepare,validateLoad,validatePublish,validateApprove,validateHistory,validateReview,validatePublication,validateHistoryResult,validateError} from './generated-validator.mjs';
import {parseBytes,digest,fail} from '../document-application/boundary.mjs';
import {ARTIFACT_MIME_TYPES,artifactFilename,assertNativeArtifactEvidenceBinding} from '../artifacts-0.2/artifact-formats.mjs';
const requests=new WeakMap(),reviews=new WeakSet(),same=(a,b)=>canonicalize(a)===canonicalize(b);
const hash=value=>digest(new TextEncoder().encode(canonicalize(value)));
const textHash=value=>digest(new TextEncoder().encode(value));
const validators={'federal-prepare':validatePrepare,'federal-load':validateLoad,'federal-publish':validatePublish,'federal-import':validateImport,'federal-approve':validateApprove,'federal-history':validateHistory};
const titles={draft:'Federal review',operative:'Operative amendment',consolidated:'Consolidated text',redline:'Legal redline',docx:'Federal review dossier'};
export const federalWorkbenchVersion='1.3.0';
/** Read an already-inspected/downloaded retained envelope. Shape/hash checks do not
 * authenticate its publisher or source URL; the artifact read owner grants access. */
async function sourceValue(source){
 try{assertFederalTextLayout(source);}catch{fail('SOURCE_MISMATCH');}
 if(!validateSource(source)||await textHash(source.text)!==source.sha256)fail('SOURCE_MISMATCH');
 for(const scope of source.scopes)if(scope.start>=scope.end||scope.end>source.text.length||await textHash(source.text.slice(scope.start,scope.end))!==scope.sha256)fail('SOURCE_MISMATCH');
 return source;
}
function sourcePins(envelope){
 const {selection:s,source}=envelope;
 if(!['federal-plain-text/1',FEDERAL_USLM_XML_PARSER].includes(source.parserVersion)||source.documentId!==s.billId||source.sha256!==s.textHash||source.sourceVersion!==s.versionCode+'/'+s.revisionId||source.coverage.complete!==true)fail('SOURCE_MISMATCH');
}
export async function receiveFederalSource(bytes){
 const stored=parseBytes(bytes,1048576);
 if(stored?.schema==='meri.federal-source.v1'){
  if(!validateSourceEnvelope(stored))fail('SOURCE_MISMATCH');sourcePins(stored);return sourceValue(stored.source);
 }
 return sourceValue(stored);
}
export function receiveFederalRequest(route,bytes){
 const request=parseBytes(bytes,2*1024*1024);
 if(!Object.hasOwn(validators,route)||!validators[route](request))fail('INVALID_REQUEST');
 if(route==='federal-publish'){
  const reviewVersionId=request.reviewVersionId??null;
  if(request.baseVersionId===null?request.baseRevisionSha256!==null:request.baseRevisionSha256===null||request.output!=='draft')fail('INVALID_REQUEST');
  if(request.output==='draft'&&reviewVersionId!==null)fail('INVALID_REQUEST');
 }
 requests.set(request,route);return request;
}
function version(v,format='txt'){
 try{assertNativeArtifactEvidenceBinding(v.binding,v.evidence);}catch{fail('EVIDENCE_BINDING');}
 const scopes=new Set(v.scopes.map(canonicalize));
 if(v.mimeType!==ARTIFACT_MIME_TYPES[format]||!same(v.scopes,v.object.scopes)||v.scopes.some(s=>s.tenantId!==v.binding.tenantId)||
  v.evidence.some(e=>e.scopes.some(s=>!scopes.has(canonicalize(s))))||v.object.bytes>(format==='docx'?8388608:1048576)||
  v.generationStatus!=='draft'||!v.filename.endsWith('.'+format))fail('VERSION_MISMATCH');
}
async function preparation(p){
 const {revisionSha256,approval,...material}=p.draft;
 await sourceValue(p.draft.source);
 if(p.draft.parserVersion!==p.draft.source.parserVersion)fail('SOURCE_MISMATCH');
 if(p.draft.outputs.segments.filter(part=>part.kind!=='insert').map(part=>part.text).join('')!==p.draft.source.text||p.draft.outputs.segments.filter(part=>part.kind!=='delete').map(part=>part.text).join('')!==p.draft.outputs.consolidated)fail('OUTPUT_MISMATCH');
 if(await hash(material)!==revisionSha256||await hash({sourceArtifact:p.sourceArtifact,draftSha256:revisionSha256})!==p.revisionSha256||
  await textHash(p.draft.source.text)!==p.draft.source.sha256)fail('REVISION_MISMATCH');
 for(const kind of ['operative','consolidated','redline'])if(await textHash(p.draft.outputs[kind])!==p.draft.outputHashes[kind])fail('OUTPUT_MISMATCH');
 for(const s of p.draft.source.scopes)if(s.end>p.draft.source.text.length||s.end<=s.start||await textHash(p.draft.source.text.slice(s.start,s.end))!==s.sha256)fail('SOURCE_MISMATCH');
}
/** The store rule, checked on the wire too: an approval names exactly this revision and the version it approved. */
const approvalBinds=(approval,revisionSha256,reviewVersionId)=>approval===null||approval.revisionSha256===revisionSha256&&(reviewVersionId===undefined||approval.reviewVersionId===reviewVersionId);
const reviewContent=(schema,prepared,approval)=>JSON.stringify(approval===null?{schema,prepared}:{schema,prepared,approval});
async function publishedContent(v,inspection,execution,content,title,format){
 version(v,format);
 if(content!==null&&(v.object.sha256!==await textHash(content)||v.object.bytes!==new TextEncoder().encode(content).length))fail('PUBLICATION_MISMATCH');
 if(inspection.sha256!==v.object.sha256||inspection.bytes!==v.object.bytes||inspection.format!==format||execution.kind!=='native-document'||
  v.filename!==artifactFilename({title,format}))fail('PUBLICATION_MISMATCH');
}
/** Request/review brands are local integrity checks, never authority or legal approval. */
export async function receiveFederalResponse(route,status,bytes,request,review){
 if(requests.get(request)!==route)fail('UNADMITTED_REQUEST');
 const result=parseBytes(bytes,2*1024*1024);
 if(status!==200){if(!Number.isInteger(status)||status<400||status>599||!validateError(result))fail('INVALID_ERROR_RESPONSE');return result;}
 if(route==='federal-import'){
  if(!validateImported(result)||!same(result.selection,request.selection))fail('INVALID_RESPONSE');
  await sourceValue(result.source);sourcePins(result);
  const {publication,...envelope}=result,{version:v,inspection,execution}=publication;
  const content=JSON.stringify(envelope),title=(`Federal source [${await hash(envelope)}]: ${result.selection.billId}`).slice(0,160);
  if(v.parentVersionId!==null)fail('PUBLICATION_MISMATCH');
  await publishedContent(v,inspection,execution,content,title,'txt');
  return result;
 }
 if(route==='federal-history'){
  if(!validateHistoryResult(result)||result.anchorVersionId!==request.versionId||result.revisions.length>request.limit)fail('INVALID_RESPONSE');
  const ids=new Set();
  result.revisions.forEach((entry,index)=>{
   version(entry.version);
   const next=result.revisions[index+1];
   if(entry.version.artifactId!==result.artifactId||ids.has(entry.version.versionId)||next&&entry.version.parentVersionId!==next.version.versionId||
    !approvalBinds(entry.approval,entry.revisionSha256,entry.version.parentVersionId??undefined)||entry.approval!==null&&entry.version.parentVersionId===null)fail('HISTORY_MISMATCH');
   ids.add(entry.version.versionId);
  });
  // The first page starts at the head; the anchor may lie on a later page of the same verified chain.
  if(request.cursor===null&&result.revisions[0].version.versionId!==result.headVersionId)fail('HISTORY_MISMATCH');
  return result;
 }
 if(route!=='federal-publish'){
  if(!validateReview(result))fail('INVALID_RESPONSE');await preparation(result.prepared);
  const p=result.prepared;
  if(!same(result.selection.operations,p.draft.operations)||result.selection.versionId!==p.sourceArtifact.versionId||
   result.selection.expectedArtifactSha256!==p.sourceArtifact.sha256)fail('SELECTION_MISMATCH');
  if(route==='federal-prepare'&&(!same(result.selection,request.selection)||result.savedDraft!==null||result.approval!==null))fail('SELECTION_MISMATCH');
  if(route==='federal-load'){
   if(!result.savedDraft||result.savedDraft.versionId!==request.versionId||result.savedDraft.object.sha256!==request.expectedArtifactSha256)fail('VERSION_MISMATCH');
   version(result.savedDraft);
   if(!approvalBinds(result.approval,p.revisionSha256,result.savedDraft.parentVersionId??undefined)||result.approval!==null&&result.savedDraft.parentVersionId===null)fail('APPROVAL_MISMATCH');
   if(await textHash(reviewContent(result.schema,p,result.approval))!==result.savedDraft.object.sha256)fail('REVIEW_MISMATCH');
  }
  if(route==='federal-approve'){
   // The approval is the child of the exact version the request named, for the exact revision it named.
   if(!result.savedDraft||result.savedDraft.parentVersionId!==request.versionId||p.revisionSha256!==request.revisionSha256||
    result.approval===null||!approvalBinds(result.approval,p.revisionSha256,request.versionId))fail('APPROVAL_MISMATCH');
   version(result.savedDraft);
   if(await textHash(reviewContent(result.schema,p,result.approval))!==result.savedDraft.object.sha256)fail('REVIEW_MISMATCH');
  }
  reviews.add(result);return result;
 }
 // A cited approval names the version it approved (the cited version's parent) and exactly this revision.
 const reviewVersionId=request.reviewVersionId??null,expectedReview=request.output==='draft'?'unapproved':result.approval===null?'confirmed-for-export':'approved';
 if(!reviews.has(review)||!validatePublication(result)||!same(request.selection,review.selection)||request.revisionSha256!==review.prepared.revisionSha256||
  result.revisionSha256!==request.revisionSha256||!same(result.sourceArtifact,review.prepared.sourceArtifact)||result.output!==request.output||
  result.review!==expectedReview||request.output==='draft'&&result.approval!==null||reviewVersionId===null&&result.approval!==null||
  !approvalBinds(result.approval,request.revisionSha256)||result.approval!==null&&result.approval.reviewVersionId===reviewVersionId)fail('REVIEW_MISMATCH');
 const {version:v,inspection,execution}=result.publication,format=request.output==='docx'?'docx':'txt';
 // Rendered DOCX bytes are the renderer's; their inspection correlation is checked, not recomputed here.
 const content=request.output==='draft'?reviewContent(review.schema,review.prepared,null):request.output==='docx'?null:review.prepared.draft.outputs[request.output];
 const title=(titles[request.output]+' ['+request.revisionSha256+']: '+review.prepared.draft.source.documentId).slice(0,160);
 if(v.parentVersionId!==request.baseVersionId)fail('PUBLICATION_MISMATCH');
 await publishedContent(v,inspection,execution,content,title,format);
 return result;
}
