/** Per-control artifact intent ownership. No storage/SDK graph at import time. */
const owners=new WeakMap();
export function registerDocumentIntentOwner(context,prepareForRun,documents){
 if(!context||typeof context!=='object'||typeof prepareForRun!=='function'||owners.has(context))throw Error('PRODUCT_PORTS_CONFIGURATION');
 if(documents!==undefined&&['execute','read','currentBinding'].some(k=>typeof documents?.[k]!=='function'))throw Error('PRODUCT_PORTS_CONFIGURATION');
 owners.set(context,{prepareForRun,documents});
}
export function documentIntentPreparersFor(context,value){return owners.get(context)?.prepareForRun(value)??[];}
export function documentApprovalOwnerFor(context){return owners.get(context)?.documents??null;}
