/** Immutable private source for an Office revision. This is NOT a public tool
 * request: the model's typed document schemas deliberately continue to refuse it.
 * `operation` retains the existing artifact format owner and journal identity. */
import {data,own} from './commands-0.2/execution-boundary.mjs';
import {isBrowserImport,browserImportSource,browserImportInspection} from './browser-import.mjs';
const fail=()=>{throw Object.assign(Error('OFFICE_EDIT_SOURCE'),{code:'OFFICE_EDIT_SOURCE'});};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,SHA=/^[a-f0-9]{64}$/u;
export const OFFICE_EDIT_KIND='meri.office-edit/1';
export const OFFICE_ORIGINAL_KIND='meri.office-original/1';
/** A user-approved Meri proposal applied to the retained bytes of an Office parent: the same verified-bytes
 * publication as an editor draft, bound to the proposal instead of a Core draft sequence. */
export const OFFICE_PROPOSAL_KIND='meri.office-proposal/1';
export const OFFICE_FORMULA_CACHE='editor-provided/unverified; recalculation required';
export const OFFICE_OPERATIONS=Object.freeze({docx:'create_word',xlsx:'create_excel',pptx:'create_powerpoint'});
export function isOfficeEdit(value){return value?.sourceKind===OFFICE_EDIT_KIND;}
export function isOfficeOriginal(value){return value?.sourceKind===OFFICE_ORIGINAL_KIND;}
export function isOfficeProposal(value){return value?.sourceKind===OFFICE_PROPOSAL_KIND;}
/** Every kind whose bytes are retained Office content a typed regeneration cannot preserve. */
export const isOfficeRetained=value=>isOfficeEdit(value)||isOfficeOriginal(value)||isOfficeProposal(value);
export function officeOriginalTitle(filename,format){
 const prefix=filename.slice(0,-format.length-1).slice(0,200);
 return (prefix.isWellFormed()?prefix:prefix.slice(0,-1))||'Original';
}
/** Private provenance for exact retained upload bytes. A storage version is
 * recorded as source provenance; it is never an artifact version selector. */
export function officeOriginalSource(value){
 try{
  const s=data(own(value,['sourceKind','operation','format','title','original']));
  const o=own(s.original,['uploadId','requestId','objectId','objectVersionId','sha256','bytes','filename']);
  if(s.sourceKind!==OFFICE_ORIGINAL_KIND||!Object.hasOwn(OFFICE_OPERATIONS,s.format)||s.operation!==OFFICE_OPERATIONS[s.format]||
   typeof s.title!=='string'||!s.title.isWellFormed()||!s.title||s.title.length>200||
   !UUID.test(o.uploadId)||!UUID.test(o.requestId)||!UUID.test(o.objectId)||!SHA.test(o.sha256)||
   typeof o.objectVersionId!=='string'||!o.objectVersionId||o.objectVersionId.length>1024||['null','pending'].includes(o.objectVersionId)||
   !Number.isSafeInteger(o.bytes)||o.bytes<1||o.bytes>10*1024*1024||typeof o.filename!=='string'||!o.filename.isWellFormed()||
   new TextEncoder().encode(o.filename).length>255||/[\u0000-\u001f\u007f/\\]/u.test(o.filename)||
   !o.filename.toLowerCase().endsWith('.'+s.format)||s.title!==officeOriginalTitle(o.filename,s.format))fail();
  return s;
 }catch{fail();}
}
export function officeOriginalRequestSha256(v,value,contextValue){
 const request=officeOriginalSource(value),context=v.context(contextValue);
 if(context.assets.length||context.evidence.length)fail();
 const {deadlineMs,...stableContext}=context;
 return v.hash({request,context:stableContext,baseVersionId:null});
}
export function officeEditSource(value){
 try{
  const s=data(own(value,['sourceKind','operation','format','title','edit']));
  const e=own(s.edit,['sessionId','draftSequence','draftSha256','baseVersionId','baseObjectSha256','editorActorId']);
  if(s.sourceKind!==OFFICE_EDIT_KIND||!Object.hasOwn(OFFICE_OPERATIONS,s.format)||s.operation!==OFFICE_OPERATIONS[s.format]||
    typeof s.title!=='string'||!s.title.isWellFormed()||s.title.length<1||s.title.length>200||
    !UUID.test(e.sessionId)||!UUID.test(e.baseVersionId)||!SHA.test(e.draftSha256)||!SHA.test(e.baseObjectSha256)||
    !Number.isInteger(e.draftSequence)||e.draftSequence<1||e.draftSequence>2147483647||
    typeof e.editorActorId!=='string'||!/^[A-Za-z0-9_.:@-]{1,128}$/u.test(e.editorActorId))fail();
  return s;
 }catch{fail();}
}
export function officeProposalSource(value){
 try{
  const s=data(own(value,['sourceKind','operation','format','title','proposal']));
  const p=own(s.proposal,['proposalId','baseVersionId','baseObjectSha256','operationsSha256','outputSha256','actorId']);
  if(s.sourceKind!==OFFICE_PROPOSAL_KIND||!Object.hasOwn(OFFICE_OPERATIONS,s.format)||s.operation!==OFFICE_OPERATIONS[s.format]||
    typeof s.title!=='string'||!s.title.isWellFormed()||s.title.length<1||s.title.length>200||
    !UUID.test(p.proposalId)||!UUID.test(p.baseVersionId)||!SHA.test(p.baseObjectSha256)||!SHA.test(p.operationsSha256)||!SHA.test(p.outputSha256)||
    typeof p.actorId!=='string'||!/^[A-Za-z0-9_.:@-]{1,128}$/u.test(p.actorId))fail();
  return s;
 }catch{fail();}
}
/** An edit or proposal source: the two retained-byte revision kinds the artifact owner publishes alike. */
export const officeRevisionSource=value=>isOfficeProposal(value)?officeProposalSource(value):officeEditSource(value);
/** The exact bytes a retained-byte revision claims to publish, and the artifact intent delivery that owns it. */
export const officeRevisionOutputSha256=request=>isOfficeProposal(request)?request.proposal.outputSha256:request.edit.draftSha256;
export const officeRevisionDeliveryId=request=>isOfficeProposal(request)?`office-proposal:${request.proposal.proposalId}`:`office:${request.edit.sessionId}:${request.edit.draftSequence}`;
/** Private original/edit/proposal/browser provenance is readable; public generation stays typed. */
export function storedArtifactSource(v,value){
 const s=v.snapshot(value);return isOfficeEdit(s)?officeEditSource(s):isOfficeOriginal(s)?officeOriginalSource(s):isOfficeProposal(s)?officeProposalSource(s):isBrowserImport(s)?browserImportSource(s):v.request(s);
}
/** Extend only the private edited-file reader. The immutable typed tool schema
 * and its catalog digest stay unchanged. The substitution below checks the
 * shared shape only; the returned/stored inspection keeps its truthful label. */
export function storedArtifactInspection(v,spec,value){
 // A downloaded file keeps its truthful byte-only inspection: nothing opened, rendered or recalculated.
 if(isBrowserImport(spec))return browserImportInspection(value);
 if(!isOfficeRetained(spec)||spec.format!=='xlsx')return v.inspection(value);
 const inspection=v.snapshot(value);
 if(inspection?.details?.formulaCache!==OFFICE_FORMULA_CACHE||Object.hasOwn(inspection.details,'revisionMethod'))fail();
 v.inspection({...inspection,details:{...inspection.details,formulaCache:'removed/unverified; recalculation required'}});
 return inspection;
}
export function officeEditRequestSha256(v,value,contextValue,baseVersionId){
 const request=officeRevisionSource(value),context=v.context(contextValue),bound=isOfficeProposal(request)?{baseVersionId:request.proposal.baseVersionId,actorId:request.proposal.actorId}:{baseVersionId:request.edit.baseVersionId,actorId:request.edit.editorActorId};
 if(bound.baseVersionId!==baseVersionId||bound.actorId!==context.binding.actorId||context.assets.length)fail();
 const {deadlineMs,...stableContext}=context;
 return v.hash({request,context:stableContext,baseVersionId});
}
export function assertOfficeEditRecord(spec,version){
 if(isOfficeOriginal(spec)&&(version.parentVersionId!==null||spec.original.sha256!==version.object.sha256||spec.original.bytes!==version.object.bytes))fail();
 if(isOfficeEdit(spec)&&(spec.edit.baseVersionId!==version.parentVersionId||
   spec.edit.editorActorId!==version.binding.actorId||spec.edit.draftSha256!==version.object.sha256))fail();
 if(isOfficeProposal(spec)&&(spec.proposal.baseVersionId!==version.parentVersionId||
   spec.proposal.actorId!==version.binding.actorId||spec.proposal.outputSha256!==version.object.sha256))fail();
}
export function officeEditParentMatches(parent,child){
 const bound=isOfficeEdit(child.spec)?child.spec.edit:isOfficeProposal(child.spec)?child.spec.proposal:null;
 return bound===null||bound.baseVersionId===parent.version.versionId&&bound.baseObjectSha256===parent.version.object.sha256&&child.spec.title===parent.spec.title;
}
