/** Closed durable browser receipts (Node side).
 *
 * The FIELD RULES live in the browser-safe semantics module, so the public receiving bundle can validate a
 * receipt without importing Node crypto; this module re-exports them unchanged and adds only the hash-derived
 * logical event identities. A receipt records what the browser OBSERVED: it is not proof of a remote website
 * commit, it grants nothing, and it is never a generic execution success.
 */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {data} from '../commands-0.2/execution-boundary.mjs';
import {assertBrowserActionReceiptData,assertBrowserDownloadReceiptData,assertBrowserReceiptData,
 isBrowserReceiptEvent} from './browser-receipt-semantics.mjs';

export {BROWSER_RECEIPT_SCHEMA,BROWSER_RECEIPT_EVENT} from './browser-receipt-semantics.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const deny=()=>fail('BROWSER_RECEIPT_REFUSED');

export const assertBrowserActionReceipt=assertBrowserActionReceiptData;
export const assertBrowserDownloadReceipt=assertBrowserDownloadReceiptData;
export const assertBrowserReceipt=assertBrowserReceiptData;
export {isBrowserReceiptEvent};

/** Stable logical event identity, derived from the operation and NOT from the payload: a retry with the
 * same bytes acknowledges the same event, and a changed payload can never mint a new identity. */
const eventId=preimage=>{
 const digest=canonicalSha256(preimage),variant=((parseInt(digest[16],16)&0x3)|0x8).toString(16);
 return `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-${variant}${digest.slice(17,20)}-${digest.slice(20,32)}`;
};
const uuid=value=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value))deny();return value;};
export const browserActionReceiptEventId=({binding,sessionId,toolUseId})=>{
 validateShape('RunBinding',data(binding));
 return eventId({domain:'browser-receipt/action/1',binding:data(binding),sessionId:uuid(sessionId),toolUseId});
};
export const browserDownloadReceiptEventId=({binding,reference})=>{
 validateShape('RunBinding',data(binding));
 if(typeof reference!=='string'||!reference||reference.length>128)deny();
 return eventId({domain:'browser-receipt/download/1',binding:data(binding),reference});
};
