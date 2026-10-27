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
export function documentApprovalOwnerFor(context){return owners.get(context)?.documents??null;}
export function filingApprovalOwnerFor(context){return owners.get(context)?.filing??null;}
export function documentRevisionSourceFor(context,value){const owner=owners.get(context)?.revision;if(!owner)throw Object.assign(Error('UNAVAILABLE'),{code:'UNAVAILABLE'});return owner.read(value);}
