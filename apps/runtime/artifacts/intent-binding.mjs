/** Per-control artifact intent ownership. No storage/SDK graph at import time. */
const owners=new WeakMap();
export function registerDocumentIntentOwner(context,prepareForRun,documents,filing,revision){
 if(!context||typeof context!=='object'||typeof prepareForRun!=='function'||owners.has(context))throw Error('PRODUCT_PORTS_CONFIGURATION');
 if(documents!==undefined&&['execute','read','currentBinding'].some(k=>typeof documents?.[k]!=='function'))throw Error('PRODUCT_PORTS_CONFIGURATION');
 if(filing!==undefined&&['execute','read','currentBinding'].some(k=>typeof filing?.[k]!=='function'))throw Error('PRODUCT_PORTS_CONFIGURATION');
 if(revision!==undefined&&typeof revision?.read!=='function')throw Error('PRODUCT_PORTS_CONFIGURATION');
 owners.set(context,{prepareForRun,documents,filing,revision});
}
export function documentIntentPreparersFor(context,value){return owners.get(context)?.prepareForRun(value)??[];}
/** The run's immutable document selection, or null; the office owner composes its preparer only for a selected document. */
export async function documentRevisionSelectionFor(context,value){const owner=owners.get(context)?.revision;if(typeof owner?.selectionFor!=='function')return null;return owner.selectionFor(value);}
const offices=new WeakMap();
/** Registered by the office composition when Office is enabled: the propose_office_edit preparer for a run with a selected
 * Office document, and the approval ports that apply, reject or read a retained proposal. Absent, no office tool is
 * listed and an office proposal answers EXECUTION_OWNER_UNAVAILABLE. */
export function registerOfficeIntentOwner(context,owner){
 if(!context||typeof context!=='object'||offices.has(context)||['prepareForRun','apply','reject','read'].some(k=>typeof owner?.[k]!=='function'))throw Error('PRODUCT_PORTS_CONFIGURATION');
 offices.set(context,owner);
}
export function officeIntentPreparersFor(context,value){return offices.get(context)?.prepareForRun(value)??[];}
export function officeApprovalOwnerFor(context){const owner=offices.get(context);return owner?{apply:owner.apply,reject:owner.reject,read:owner.read}:null;}
export function documentApprovalOwnerFor(context){return owners.get(context)?.documents??null;}
export function filingApprovalOwnerFor(context){return owners.get(context)?.filing??null;}
export function documentRevisionSourceFor(context,value){const owner=owners.get(context)?.revision;if(!owner)throw Object.assign(Error('UNAVAILABLE'),{code:'UNAVAILABLE'});return owner.read(value);}
export function selectedDocumentRevisionSourceFor(context,value){const owner=owners.get(context)?.revision;if(typeof owner?.readForSelected!=='function')throw Object.assign(Error('UNAVAILABLE'),{code:'UNAVAILABLE'});return owner.readForSelected(value);}
