/** Per-control artifact intent ownership. No storage/SDK graph at import time. */
const owners=new WeakMap();
export function registerDocumentIntentOwner(context,prepareForRun){
 if(!context||typeof context!=='object'||typeof prepareForRun!=='function'||owners.has(context))throw Error('PRODUCT_PORTS_CONFIGURATION');
 owners.set(context,prepareForRun);
}
export function documentIntentPreparersFor(context,value){return owners.get(context)?.(value)??[];}
