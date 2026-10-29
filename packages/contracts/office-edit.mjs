/** Immutable private source for an Office revision. This is NOT a public tool
 * request: the model's typed document schemas deliberately continue to refuse it.
 * `operation` retains the existing artifact format owner and journal identity. */
import {data,own} from './commands-0.2/execution-boundary.mjs';
const fail=()=>{throw Object.assign(Error('OFFICE_EDIT_SOURCE'),{code:'OFFICE_EDIT_SOURCE'});};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,SHA=/^[a-f0-9]{64}$/u;
export const OFFICE_EDIT_KIND='meri.office-edit/1';
export const OFFICE_FORMULA_CACHE='editor-provided/unverified; recalculation required';
export const OFFICE_OPERATIONS=Object.freeze({docx:'create_word',xlsx:'create_excel',pptx:'create_powerpoint'});
export function isOfficeEdit(value){return value?.sourceKind===OFFICE_EDIT_KIND;}
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
/** New readers accept both private source kinds; public generation stays typed. */
export function storedArtifactSource(v,value){
 const s=v.snapshot(value);return isOfficeEdit(s)?officeEditSource(s):v.request(s);
}
/** Extend only the private edited-file reader. The immutable typed tool schema
 * and its catalog digest stay unchanged. The substitution below checks the
 * shared shape only; the returned/stored inspection keeps its truthful label. */
export function storedArtifactInspection(v,spec,value){
 if(!isOfficeEdit(spec)||spec.format!=='xlsx')return v.inspection(value);
 const inspection=v.snapshot(value);
 if(inspection?.details?.formulaCache!==OFFICE_FORMULA_CACHE||Object.hasOwn(inspection.details,'revisionMethod'))fail();
 v.inspection({...inspection,details:{...inspection.details,formulaCache:'removed/unverified; recalculation required'}});
 return inspection;
}
export function officeEditRequestSha256(v,value,contextValue,baseVersionId){
 const request=officeEditSource(value),context=v.context(contextValue);
 if(request.edit.baseVersionId!==baseVersionId||request.edit.editorActorId!==context.binding.actorId||context.assets.length)fail();
 const {deadlineMs,...stableContext}=context;
 return v.hash({request,context:stableContext,baseVersionId});
}
export function assertOfficeEditRecord(spec,version){
 if(isOfficeEdit(spec)&&(spec.edit.baseVersionId!==version.parentVersionId||
   spec.edit.editorActorId!==version.binding.actorId||spec.edit.draftSha256!==version.object.sha256))fail();
}
export function officeEditParentMatches(parent,child){
 return !isOfficeEdit(child.spec)||child.spec.edit.baseVersionId===parent.version.versionId&&
  child.spec.edit.baseObjectSha256===parent.version.object.sha256&&child.spec.title===parent.spec.title;
}
