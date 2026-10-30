/** Closed durable browser receipts. A receipt records what the browser OBSERVED; it is not proof of a
 * remote website commit and it grants nothing. Identity is derived from the operation it describes, so a
 * retry acknowledges the same event and a changed payload under the same identity is a conflict. */
import {canonicalSha256,validateShape} from '../validate.mjs';
import {own,data} from '../commands-0.2/execution-boundary.mjs';

export const BROWSER_RECEIPT_SCHEMA='meri-browser-receipt/1';
export const BROWSER_RECEIPT_EVENT='browser.receipt';
const HEX=/^[0-9a-f]{64}$/u;
const fail=code=>{throw Object.assign(Error(code),{code});};
const deny=()=>fail('BROWSER_RECEIPT_REFUSED');
const uuid=value=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value))deny();return value;};
const at=value=>{if(!Number.isSafeInteger(value)||value<1)deny();return value;};
const host=value=>{if(typeof value!=='string'||!value||value.length>255)deny();return value;};

/** Kind 'browser.action': one observed tool call on one page host. */
export function assertBrowserActionReceipt(raw){
 const r=data(own(raw,['schema','kind','binding','sessionId','toolUseId','action','urlHost','atMs','reference','outcome']));
 if(r.schema!==BROWSER_RECEIPT_SCHEMA||r.kind!=='browser.action')deny();
 validateShape('RunBinding',data(r.binding));
 if(typeof r.action!=='string'||!r.action||r.action.length>128)deny();
 if(!['ok','error'].includes(r.outcome))deny();
 if(r.reference!==null&&(typeof r.reference!=='string'||!r.reference||r.reference.length>1024||r.reference.startsWith('/')||r.reference.split('/').includes('..')))deny();
 return Object.freeze({schema:BROWSER_RECEIPT_SCHEMA,kind:'browser.action',binding:Object.freeze(data(r.binding)),
  sessionId:uuid(r.sessionId),toolUseId:r.toolUseId===null?null:(typeof r.toolUseId==='string'&&r.toolUseId.length<=256?r.toolUseId:deny()),
  action:r.action,urlHost:host(r.urlHost),atMs:at(r.atMs),reference:r.reference,outcome:r.outcome});
}
/** Kind 'browser.download': one acknowledged artifact version produced by a browser download. */
export function assertBrowserDownloadReceipt(raw){
 const r=data(own(raw,['schema','kind','binding','urlHost','atMs','reference','sha256','bytes','mimeType']));
 if(r.schema!==BROWSER_RECEIPT_SCHEMA||r.kind!=='browser.download')deny();
 validateShape('RunBinding',data(r.binding));
 const reference=r.reference===null?null:(typeof r.reference==='string'&&r.reference.length>0&&r.reference.length<=128?r.reference:deny());
 const sha=r.sha256===null?null:(typeof r.sha256==='string'&&HEX.test(r.sha256)?r.sha256:deny());
 const bytes=r.bytes===null?null:(Number.isSafeInteger(r.bytes)&&r.bytes>=0?r.bytes:deny());
 if(typeof r.mimeType!=='string'||!r.mimeType||r.mimeType.length>255)deny();
 if((reference===null)!==(sha===null)||(reference===null)!==(bytes===null))deny();
 return Object.freeze({schema:BROWSER_RECEIPT_SCHEMA,kind:'browser.download',binding:Object.freeze(data(r.binding)),
  urlHost:host(r.urlHost),atMs:at(r.atMs),reference,sha256:sha,bytes,mimeType:r.mimeType});
}
export const assertBrowserReceipt=raw=>raw?.kind==='browser.download'?assertBrowserDownloadReceipt(raw):assertBrowserActionReceipt(raw);
export const isBrowserReceiptEvent=event=>event?.type===BROWSER_RECEIPT_EVENT;

/** Stable logical event identity, derived from the operation and NOT from the payload: a retry with the
 * same bytes acknowledges the same event, and a changed payload can never mint a new identity. */
const eventId=preimage=>{
 const digest=canonicalSha256(preimage),variant=((parseInt(digest[16],16)&0x3)|0x8).toString(16);
 return `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-${variant}${digest.slice(17,20)}-${digest.slice(20,32)}`;
};
export const browserActionReceiptEventId=({binding,sessionId,toolUseId})=>{
 validateShape('RunBinding',data(binding));
 return eventId({domain:'browser-receipt/action/1',binding:data(binding),sessionId:uuid(sessionId),toolUseId});
};
export const browserDownloadReceiptEventId=({binding,reference})=>{
 validateShape('RunBinding',data(binding));
 if(typeof reference!=='string'||!reference||reference.length>128)deny();
 return eventId({domain:'browser-receipt/download/1',binding:data(binding),reference});
};
