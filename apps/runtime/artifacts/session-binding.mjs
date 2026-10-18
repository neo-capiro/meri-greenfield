/** Late binding of control's action-session owner into the documents options owner (`../product-ports/documents.mjs`).
 * Kept free of SDK and storage imports so trusted assembly (control.mjs) can import it without loading the artifact storage
 * graph. The binder is keyed by the exact frozen product-port context object assembly passed to the family factory, so only a
 * holder of that object can bind, and only the family that composed an options owner registers one. */
const fault=()=>Object.assign(new Error('PRODUCT_PORTS_CONFIGURATION'),{code:'PRODUCT_PORTS_CONFIGURATION'});
const binders=new WeakMap();
/** Family side: one binder per context. */
export function registerDocumentsSessionBinder(context,bind){
 if(context===null||typeof context!=='object'||typeof bind!=='function'||binders.has(context))throw fault();
 binders.set(context,bind);
}
/** Assembly side: call once, right after the action-session owner exists. A context without a composed options owner is a
 * no-op (false); rebinding different sessions is refused by the binder. */
export function bindDocumentsSessions(context,sessions){
 if(context===null||typeof context!=='object')throw fault();
 const bind=binders.get(context);if(bind===undefined)return false;bind(sessions);return true;
}
