/** Browser-safe browser-receipt semantics.
 *
 * These are the ONLY field rules for closed browser receipts and for their conversation event envelope.
 * They are pure JavaScript with no Node imports (no crypto, no schema engine), so the public receiving bundle
 * can validate a receipt without pulling the Node boundary into the browser. The Node module
 * runtime-0.2/browser-receipt.mjs re-exports exactly these rules and keeps only its hash-derived event ids.
 *
 * A receipt records what the browser OBSERVED. It is never proof of a remote website commit, a new permission
 * or a completed browser execution, and it grants nothing.
 */
export const BROWSER_RECEIPT_SCHEMA='meri-browser-receipt/1';
export const BROWSER_RECEIPT_EVENT='browser.receipt';

const HEX=/^[0-9a-f]{64}$/u;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const fail=code=>{throw Object.assign(Error(code),{code});};
const deny=()=>fail('BROWSER_RECEIPT_REFUSED');

function closed(value,required,optional=[]){
 if(!value||typeof value!=='object'||Array.isArray(value))deny();
 const keys=Object.keys(value);
 for(const key of required)if(!Object.hasOwn(value,key))deny();
 for(const key of keys)if(!required.includes(key)&&!optional.includes(key))deny();
 return value;
}
const uuid=value=>{if(typeof value!=='string'||!UUID.test(value))deny();return value;};
const at=value=>{if(!Number.isSafeInteger(value)||value<1)deny();return value;};
const host=value=>{if(typeof value!=='string'||!value||value.length>255)deny();return value;};
const sequence=value=>{if(!Number.isSafeInteger(value)||value<0)deny();return value;};
const SLUG=/^[a-z][a-z0-9-]{1,63}$/u;
/** Optional output provenance: the exact site workflow selection a browser action or download ran under. */
function siteWorkflow(value){
 if(value===undefined)return undefined;
 const w=closed(value,['siteId','workflowId','version','manifestSha256']);
 if(typeof w.siteId!=='string'||!SLUG.test(w.siteId)||typeof w.workflowId!=='string'||!SLUG.test(w.workflowId)||
  !Number.isSafeInteger(w.version)||w.version<1||typeof w.manifestSha256!=='string'||!HEX.test(w.manifestSha256))deny();
 return {siteId:w.siteId,workflowId:w.workflowId,version:w.version,manifestSha256:w.manifestSha256};
}

/** Structural equality over inert JSON: key order never matters, and no hash is required. */
export function sameJson(a,b){
 if(a===b)return true;
 if(typeof a!==typeof b||a===null||b===null||typeof a!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b))return false;
 if(Array.isArray(a))return a.length===b.length&&a.every((value,index)=>sameJson(value,b[index]));
 const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();
 return ak.length===bk.length&&ak.every((key,index)=>key===bk[index]&&sameJson(a[key],b[key]));
}

const BINDING=['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'];
function binding(value){
 closed(value,BINDING);
 for(const key of BINDING)if(key!=='writerFence'){if(typeof value[key]!=='string'||!value[key])deny();}
 if(!Number.isSafeInteger(value.writerFence)||value.writerFence<0)deny();
 return value;
}

/** Kind 'browser.action': one observed tool call on one page host. */
export function assertBrowserActionReceiptData(raw){
 const r=closed(raw,['schema','kind','binding','sessionId','toolUseId','action','urlHost','atMs','reference','outcome'],['siteWorkflow']);
 if(r.schema!==BROWSER_RECEIPT_SCHEMA||r.kind!=='browser.action')deny();
 const provenance=siteWorkflow(r.siteWorkflow);
 binding(r.binding);
 if(typeof r.action!=='string'||!r.action||r.action.length>128)deny();
 if(!['ok','error'].includes(r.outcome))deny();
 if(r.reference!==null&&(typeof r.reference!=='string'||!r.reference||r.reference.length>1024||
  r.reference.startsWith('/')||r.reference.split('/').includes('..')))deny();
 if(r.toolUseId!==null&&(typeof r.toolUseId!=='string'||r.toolUseId.length>256))deny();
 return Object.freeze({schema:BROWSER_RECEIPT_SCHEMA,kind:'browser.action',binding:r.binding,
  sessionId:uuid(r.sessionId),toolUseId:r.toolUseId,action:r.action,urlHost:host(r.urlHost),atMs:at(r.atMs),
  reference:r.reference,outcome:r.outcome,...(provenance===undefined?{}:{siteWorkflow:provenance})});
}

/** Kind 'browser.download': one acknowledged artifact version produced by a browser download. */
export function assertBrowserDownloadReceiptData(raw){
 const r=closed(raw,['schema','kind','binding','urlHost','atMs','reference','sha256','bytes','mimeType'],['siteWorkflow']);
 if(r.schema!==BROWSER_RECEIPT_SCHEMA||r.kind!=='browser.download')deny();
 const provenance=siteWorkflow(r.siteWorkflow);
 binding(r.binding);
 const reference=r.reference===null?null:(typeof r.reference==='string'&&r.reference.length>0&&
  r.reference.length<=128?r.reference:deny());
 const sha=r.sha256===null?null:(typeof r.sha256==='string'&&HEX.test(r.sha256)?r.sha256:deny());
 const bytes=r.bytes===null?null:(Number.isSafeInteger(r.bytes)&&r.bytes>=0?r.bytes:deny());
 if(typeof r.mimeType!=='string'||!r.mimeType||r.mimeType.length>255)deny();
 if((reference===null)!==(sha===null)||(reference===null)!==(bytes===null))deny();
 return Object.freeze({schema:BROWSER_RECEIPT_SCHEMA,kind:'browser.download',binding:r.binding,
  urlHost:host(r.urlHost),atMs:at(r.atMs),reference,sha256:sha,bytes,mimeType:r.mimeType,...(provenance===undefined?{}:{siteWorkflow:provenance})});
}

export const assertBrowserReceiptData=raw=>raw?.kind==='browser.download'
 ?assertBrowserDownloadReceiptData(raw):assertBrowserActionReceiptData(raw);

export const isBrowserReceiptEvent=event=>event?.type===BROWSER_RECEIPT_EVENT;

/** The conversation-event envelope for one receipt, correlated with the ADMITTED run it belongs to. */
export function assertBrowserReceiptEventSemantics(raw,{binding:runBinding,scopes:runScopes}={}){
 const event=closed(raw,['contractVersion','eventId','binding','sequence','createdAt','scopes','type','data']);
 if(event.type!==BROWSER_RECEIPT_EVENT)fail('INVALID_BROWSER_RECEIPT_EVENT');
 binding(event.binding);
 if(!UUID.test(String(event.eventId)))fail('INVALID_BROWSER_RECEIPT_EVENT');
 sequence(event.sequence);
 if(typeof event.createdAt!=='string'||Number.isNaN(Date.parse(event.createdAt)))
  fail('INVALID_BROWSER_RECEIPT_EVENT');
 if(!Array.isArray(event.scopes)||event.scopes.length===0)fail('INVALID_BROWSER_RECEIPT_EVENT');
 for(const scope of event.scopes){
  closed(scope,['tenantId','kind','resourceId','policyRevision']);
  if(typeof scope.tenantId!=='string'||typeof scope.kind!=='string'||
   typeof scope.resourceId!=='string'||typeof scope.policyRevision!=='string')
   fail('INVALID_BROWSER_RECEIPT_EVENT');
 }
 const data=assertBrowserReceiptData(event.data);
 // The receipt must describe THIS event's binding, and the event must belong to the admitted run.
 if(!sameJson(data.binding,event.binding))fail('INVALID_BROWSER_RECEIPT_EVENT');
 if(runBinding!==undefined){
  if(!sameJson(event.binding,runBinding))fail('BROWSER_RECEIPT_BINDING_MISMATCH');
  for(const scope of event.scopes)
   if(scope.tenantId!==runBinding.tenantId)fail('BROWSER_RECEIPT_SCOPE_MISMATCH');
  if(runScopes!==undefined){
   const parents=Array.isArray(runScopes)?runScopes:[];
   for(const scope of event.scopes)
    if(!parents.some(parent=>sameJson(scope,parent)))fail('BROWSER_RECEIPT_SCOPE_MISMATCH');
  }
 }
 return Object.freeze({...event,data:Object.freeze(data)});
}
