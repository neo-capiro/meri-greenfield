/** One Office-scoped edit admission predicate over the existing bounded structural inspection.
 * A structurally valid PPTX with an embedded chart workbook is unsupported for editing/save/publish
 * through this CODE path. Structural inspection itself stays successful for inspect/download. */
import {inspectOfficeEdit} from './inspect-office.mjs';
const unavailable=()=>{throw Object.assign(Error('EDITOR_CODE_ACTION_UNAVAILABLE'),{code:'EDITOR_CODE_ACTION_UNAVAILABLE'});};
export function officeEditUnavailable(document){
 return document?.format==='pptx'&&Array.isArray(document.members)&&
  document.members.some(name=>/^ppt\/embeddings\/[^/]+\.xlsx$/u.test(name));
}
export function inspectOfficeEditAdmitted(bytes,format){
 const document=inspectOfficeEdit(bytes,format);
 if(officeEditUnavailable(document))unavailable();
 return document;
}
export function assertOfficeEditAdmitted(document){
 if(officeEditUnavailable(document))unavailable();
 return document;
}
