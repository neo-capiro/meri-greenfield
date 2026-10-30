/** Durable browser receipts in the existing conversation event owner.
 *
 * A receipt records what the browser OBSERVED on the host: an action's outcome, or an acknowledged
 * download's artifact version. It is not proof of a remote website commit and it grants nothing.
 * Identity comes from the operation (session+tool use, or the acknowledged version), so a retry
 * acknowledges the same event and a changed payload under the same identity refuses.
 */
import {BROWSER_RECEIPT_EVENT,assertBrowserActionReceipt,assertBrowserDownloadReceipt,
 browserActionReceiptEventId,browserDownloadReceiptEventId} from '../../../packages/contracts/runtime-0.2/browser-receipt.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};

export function createBrowserReceiptProducer({store,now=Date.now}={}){
 if(typeof store?.appendBrowserReceipt!=='function'||typeof now!=='function')throw fail('BROWSER_RECEIPT_CONFIGURATION');
 async function append({binding,scopes,receipt,eventId,signal}){
  if(!Array.isArray(scopes)||scopes.length===0)fail('BROWSER_RECEIPT_REFUSED');
  const check=()=>{if(signal?.aborted)fail('BROWSER_RECEIPT_REFUSED');};
  // The owner supplies the durable sequence/createdAt; a retry reuses the stored time (see appendEvent).
  const event=await store.appendBrowserReceipt(binding,
   {eventId,createdAt:new Date(now()).toISOString(),type:BROWSER_RECEIPT_EVENT,data:receipt},check,scopes);
  return Object.freeze({eventId,recorded:true,event});
 }
 /** One observed action outcome. `reference` is a relative file reference or null. */
 async function appendAction(value){
  // The AbortSignal is validated on the raw object and never serialized; only inert fields are copied.
  const v=own(value,['binding','scopes','sessionId','toolUseId','action','urlHost','atMs','outcome'],['reference','signal']);
  nativeSignal(v.signal);v.signal?.throwIfAborted();
  const receipt=assertBrowserActionReceipt({schema:'meri-browser-receipt/1',kind:'browser.action',
   binding:data(v.binding),sessionId:v.sessionId,toolUseId:v.toolUseId??null,action:v.action,urlHost:v.urlHost,
   atMs:v.atMs,reference:v.reference??null,outcome:v.outcome});
  const eventId=browserActionReceiptEventId({binding:receipt.binding,sessionId:receipt.sessionId,toolUseId:receipt.toolUseId});
  return append({binding:receipt.binding,scopes:v.scopes,receipt,eventId,signal:v.signal});
 }
 /** One acknowledged download artifact version. */
 async function appendDownload(value){
  const v=own(value,['binding','scopes','urlHost','atMs','reference','sha256','bytes','mimeType'],['signal']);
  nativeSignal(v.signal);v.signal?.throwIfAborted();
  const receipt=assertBrowserDownloadReceipt({schema:'meri-browser-receipt/1',kind:'browser.download',
   binding:data(v.binding),urlHost:v.urlHost,atMs:v.atMs,reference:v.reference,sha256:v.sha256,bytes:v.bytes,mimeType:v.mimeType});
  const eventId=browserDownloadReceiptEventId({binding:receipt.binding,reference:receipt.reference});
  return append({binding:receipt.binding,scopes:v.scopes,receipt,eventId,signal:v.signal});
 }
 return Object.freeze({appendAction,appendDownload,event:BROWSER_RECEIPT_EVENT});
}
