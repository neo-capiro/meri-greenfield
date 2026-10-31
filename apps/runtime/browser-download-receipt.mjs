/** Control-side DOWNLOAD receipt recorder: it proves the acknowledged version is a COMMITTED browser-import of
 * THIS run before the durable receipt is appended. It reuses the same documents owner/storage as ingestion
 * (versions read only, no new authority) and the same receipt producer; nothing is minted here. */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {browserDownloadReceiptEventId} from '../../packages/contracts/runtime-0.2/browser-receipt.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const same=(a,b)=>hash(a)===hash(b);
/** The ONE selected client for the canonical scopes, shared by append and read-only recovery: a single client
 * scope selects that client; a private-user run selects null; anything else is undecidable and refuses. */
const selectClient=(binding,scopes)=>{
 const clients=scopes.filter(scope=>scope.kind==='client');
 const selected=clients.length===1&&!scopes.some(scope=>scope.kind==='private-user')?clients[0].resourceId
  :scopes.length===1&&scopes[0].kind==='private-user'&&scopes[0].resourceId===binding.actorId?null:undefined;
 if(selected===undefined)fail('BROWSER_DOWNLOAD_RECEIPT_SCOPE');
 return selected;};
export function createBrowserDownloadReceiptRecorder({resolve,sessions,append,read,now=Date.now}){
 if(typeof resolve!=='function'||typeof sessions?.nativeCredentialFor!=='function'||typeof append!=='function'||typeof now!=='function')
  fail('BROWSER_DOWNLOAD_RECEIPT_CONFIGURATION');
 return Object.freeze({
  /** READ-ONLY: discover the ONE committed browser-import for this original run identity + filename and report
   * whether its durable receipt exists. Nothing is appended and no fresh write window is opened. */
  async reconcile(value){
   if(typeof read!=='function')fail('BROWSER_DOWNLOAD_RECEIPT_CONFIGURATION');
   const q=own(value,['binding','scopes','filename','deadlineMs'],['signal']);
   const life=q.signal;nativeSignal(life);
   const check=()=>{if(life?.aborted)fail('BROWSER_DOWNLOAD_RECEIPT_CANCELLED');};
   if(typeof q.filename!=='string'||!q.filename)return fail('BROWSER_DOWNLOAD_RECONCILE_REFUSED');
   if(!Number.isSafeInteger(q.deadlineMs)||q.deadlineMs<=now())fail('BROWSER_DOWNLOAD_RECONCILE_DEADLINE');
   const binding=data(q.binding),scopes=data(q.scopes),selectedClientId=selectClient(binding,scopes);
   const body={binding,scopes,filename:q.filename};
   const requestSha256=hash({intent:'browser-import-read',body});
   let credential;
   try{credential=sessions.nativeCredentialFor({binding,selectedClientId,...(life===undefined?{}:{signal:life})}).credential;}
   catch{fail('BROWSER_DOWNLOAD_RECONCILE_AUTHORITY');}
   if(typeof credential!=='string'||!credential)fail('BROWSER_DOWNLOAD_RECONCILE_AUTHORITY');
   let resolved;
   try{resolved=await resolve({credential,intent:'browser-import',body,requestSha256,deadlineMs:q.deadlineMs,
    ...(life===undefined?{}:{signal:life})});}
   catch{fail('BROWSER_DOWNLOAD_RECONCILE_AUTHORITY');}
   check();
   const options=resolved?.documentOptions?.artifactOptions,context=options?.context;
   if(!options||typeof options.versions?.findBrowserImport!=='function'||typeof options.versions?.read!=='function'||
    typeof resolved.recheck!=='function'||!context||!same(context.binding,binding)||!same(context.scopes,scopes)||
    !Number.isSafeInteger(context.deadlineMs)||context.deadlineMs<=now())fail('BROWSER_DOWNLOAD_RECONCILE_AUTHORITY');
   const deadlineMs=Math.min(q.deadlineMs,context.deadlineMs);
   const fresh=async phase=>{check();try{
    await resolved.recheck({phase,intent:'browser-import',requestSha256,resource:null,deadlineMs,
     ...(life===undefined?{}:{signal:life})});
   }catch{fail(phase==='admission'?'BROWSER_DOWNLOAD_RECONCILE_AUTHORITY':'BROWSER_DOWNLOAD_RECONCILE_RELEASE');}
    check();};
   await fresh('admission');
   let committed;
   try{committed=await options.versions.findBrowserImport({tenantId:binding.tenantId,conversationId:binding.conversationId,
    actorId:binding.actorId,runId:binding.runId,filename:q.filename},life);}
   catch(error){if(error?.code==='ENOENT')return fail('BROWSER_DOWNLOAD_RECONCILE_MISSING');
    if(error?.code==='ARTIFACT_VERSION_AMBIGUOUS')return fail('BROWSER_DOWNLOAD_RECONCILE_AMBIGUOUS');
    return fail('BROWSER_DOWNLOAD_RECONCILE_REFUSED');}
   check();
   const reference=committed.versionId;
   const eventId=browserDownloadReceiptEventId({binding,reference});
   let receipt=null;
   try{const event=await read({binding,eventId,reference},life);
    if(event!==null){if(event.eventId!==eventId||event.data?.reference!==reference||event.data?.kind!=='browser.download')
      fail('BROWSER_DOWNLOAD_RECONCILE_REFUSED');
     receipt={eventId:event.eventId,createdAt:event.createdAt,atMs:event.data.atMs,reference};}
   }catch{fail('BROWSER_DOWNLOAD_RECONCILE_READ');}
   await fresh('release');
   // A committed artifact without its receipt is an accurate partial; it never authorizes a new append here.
   return Object.freeze({versionId:reference,sha256:committed.sha256,bytes:committed.bytes,
    mimeType:committed.mimeType,acquiredAtMs:Number.isSafeInteger(committed.acquiredAtMs)?committed.acquiredAtMs:undefined,
    receipt});
  },
  async record(value){
   const q=own(value,['binding','scopes','urlHost','atMs','reference','sha256','bytes','mimeType','deadlineMs'],['signal']);
   const life=q.signal;nativeSignal(life);
   const check=()=>{if(life?.aborted)fail('BROWSER_DOWNLOAD_RECEIPT_CANCELLED');};
   if(typeof q.reference!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(q.reference)||
    typeof q.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(q.sha256)||!Number.isSafeInteger(q.bytes)||q.bytes<1)fail('BROWSER_DOWNLOAD_RECEIPT_REFUSED');
   // The server-supplied ORIGINAL admitted deadline is required; no fresh 30-second window may be minted here.
   if(!Number.isSafeInteger(q.deadlineMs)||q.deadlineMs<=now())fail('BROWSER_DOWNLOAD_RECEIPT_DEADLINE');
   const binding=data(q.binding),scopes=data(q.scopes),selectedClientId=selectClient(binding,scopes);
   const body={binding,scopes,reference:q.reference,sha256:q.sha256,bytes:q.bytes,mimeType:q.mimeType,urlHost:q.urlHost};
   const requestSha256=hash({intent:'browser-import',body});
   let credential;
   try{credential=sessions.nativeCredentialFor({binding,selectedClientId,...(life===undefined?{}:{signal:life})}).credential;}
   catch{fail('BROWSER_DOWNLOAD_RECEIPT_AUTHORITY');}
   if(typeof credential!=='string'||!credential)fail('BROWSER_DOWNLOAD_RECEIPT_AUTHORITY');
   check();
   let resolved;
   try{resolved=await resolve({credential,intent:'browser-import',body,requestSha256,deadlineMs:q.deadlineMs,
    ...(life===undefined?{}:{signal:life})});}
   catch{fail('BROWSER_DOWNLOAD_RECEIPT_AUTHORITY');}
   check();
   const options=resolved?.documentOptions?.artifactOptions,context=options?.context;
   if(!options||typeof options.versions?.read!=='function'||typeof resolved.recheck!=='function'||
    !context||!same(context.binding,binding)||!same(context.scopes,scopes)||!Number.isSafeInteger(context.deadlineMs)||
    context.deadlineMs<=now())fail('BROWSER_DOWNLOAD_RECEIPT_AUTHORITY');
   const deadlineMs=Math.min(q.deadlineMs,context.deadlineMs);
   if(deadlineMs<=now())fail('BROWSER_DOWNLOAD_RECEIPT_DEADLINE');
   const fresh=async phase=>{check();try{
    await resolved.recheck({phase,intent:'browser-import',requestSha256,resource:null,deadlineMs,
     ...(life===undefined?{}:{signal:life})});
   }catch{fail(phase==='admission'?'BROWSER_DOWNLOAD_RECEIPT_AUTHORITY':'BROWSER_DOWNLOAD_RECEIPT_RELEASE');}
    check();};
   await fresh('admission');
   let record;
   try{record=await options.versions.read(q.reference,life);}
   catch{fail('BROWSER_DOWNLOAD_RECEIPT_UNVERIFIED');}
   check();
   try{
    const version=data(record.version),spec=data(record.spec);
    if(version.versionId!==q.reference||!same(version.binding,binding)||!same(version.scopes,scopes)||
     spec.sourceKind!=='meri.browser-download/1'||spec.source?.kind!=='browser-download'||
     spec.source?.urlHost!==q.urlHost||spec.sha256!==q.sha256||spec.bytes!==q.bytes||
     version.object?.sha256!==q.sha256||version.object?.bytes!==q.bytes||
     version.mimeType!==q.mimeType)fail('BROWSER_DOWNLOAD_RECEIPT_UNVERIFIED');
   }catch{fail('BROWSER_DOWNLOAD_RECEIPT_UNVERIFIED');}
   await fresh('release');
   // The admitted deadline is internal evidence only; the producer receives its closed receipt value.
   const {deadlineMs:_window,...receipt}=value;
   // An append committed before a revocation stays recoverable read-only; it is never a late positive success.
   return append(receipt);
  },
 });
}
