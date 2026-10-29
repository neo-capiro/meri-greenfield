import {parseBytes,digest} from '../document-application/boundary.mjs';
export const SELECTED_TAB_SCHEMA='meri.selected-tab/1';
export const SELECTED_TAB_LIMITS=Object.freeze({textBytes:262144,messageBytes:524288,pairingMs:600000,captureMs:60000});
const admitted=new WeakSet(),encoder=new TextEncoder();
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const fail=()=>{throw Error('INVALID_SELECTED_TAB_MESSAGE');};
function closed(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail();}
function label(v,max){if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f\u007f]/u.test(v))fail();}
function binding(v){closed(v,['tenantId','actorId','conversationId','clientId']);if(!uuid(v.tenantId)||!uuid(v.actorId)||!uuid(v.conversationId)||v.clientId!==null&&!uuid(v.clientId))fail();}
function source(v){
 label(v.title,256);let url;try{url=new URL(v.url);}catch{fail();}
 if(typeof v.url!=='string'||v.url.length>4096||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.href!==v.url)fail();
 if(typeof v.text!=='string'||!v.text.trim()||!v.text.isWellFormed()||v.text.includes('\0')||encoder.encode(v.text).byteLength>SELECTED_TAB_LIMITS.textBytes)fail();
}
const original=v=>encoder.encode(`Selected tab: ${v.title}\nSource: ${v.url}\n\n${v.text}\n`);
export function selectedTabOriginal(value){if(!admitted.has(value)||value.type!=='share')fail();return original(value);}
export function sameSelectedTabBinding(a,b){return ['tenantId','actorId','conversationId','clientId'].every(k=>a[k]===b[k]);}
/** JSON strings cross Chrome's native port. Validation is data integrity, never
 * account authority; current native conversation/upload owners authorize custody. */
export async function receiveSelectedTabMessage(direction,text){
 if(typeof text!=='string'||text.length>SELECTED_TAB_LIMITS.messageBytes)fail();
 const v=parseBytes(encoder.encode(text),SELECTED_TAB_LIMITS.messageBytes);
 if(v?.schema!==SELECTED_TAB_SCHEMA||!uuid(v.pairingId))fail();
 if(direction==='application'){
  if(v.type==='pair'){
   closed(v,['schema','type','pairingId','binding','labels','expiresAtMs']);binding(v.binding);
   closed(v.labels,['account','conversation']);label(v.labels.account,128);label(v.labels.conversation,256);
   if(!integer(v.expiresAtMs)||v.expiresAtMs===0)fail();
  }else if(['pause','revoke'].includes(v.type))closed(v,['schema','type','pairingId']);
  else if(v.type==='outcome'){
   closed(v,['schema','type','pairingId','selectionId','state','requestId']);
   if(!uuid(v.selectionId)||!['stored','unknown','refused'].includes(v.state)||v.requestId!==null&&!uuid(v.requestId)||v.state==='stored'&&v.requestId===null)fail();
  }else fail();
 }else if(direction==='extension'){
  if(v.type==='status'){
   closed(v,['schema','type','pairingId','deviceId','state']);
   if(!uuid(v.deviceId)||!['connected','active','paused','expired','revoked','disconnected'].includes(v.state))fail();
  }else if(v.type==='share'){
   closed(v,['schema','type','pairingId','deviceId','selectionId','binding','tabId','documentId','url','title','capturedAtMs','text','bytes','sha256']);
   binding(v.binding);source(v);
   if(!uuid(v.deviceId)||!uuid(v.selectionId)||!uuid(v.documentId)||!integer(v.tabId)||!integer(v.capturedAtMs)||
    !integer(v.bytes)||v.bytes>SELECTED_TAB_LIMITS.textBytes+8192||typeof v.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(v.sha256))fail();
   const bytes=original(v);if(bytes.byteLength!==v.bytes||await digest(bytes)!==v.sha256)fail();
  }else fail();
 }else fail();
 admitted.add(v);return v;
}
/** The extension constructs the one exact original before displaying consent. */
export async function createSelectedTabShare(input){
 source(input);const bytes=original(input);
 return receiveSelectedTabMessage('extension',JSON.stringify({...input,bytes:bytes.byteLength,sha256:await digest(bytes)}));
}
