import {parseBytes} from '../document-application/boundary.mjs';
import {validateRequest,validateResponse,validateEvent,validateHearingRequest,validateHearingResponse,validateHearingEvent,validateHearingMediaRequest,validateHearingMediaResponse} from './generated-validator.mjs';
import {billTextSourceMetadata,billTextSourceErrors} from './protocol.mjs';
import {assertNativeSourceEventSemantics,assertSourceReadSemantics,fail} from './semantics.mjs';
import {assertHearingSourceEventSemantics,assertHearingSourceReadSemantics} from './hearing-semantics.mjs';
import {assertHearingMediaReadSemantics} from './hearing-media-semantics.mjs';
export * from './protocol.mjs';
export {BillTextSourceResponseError} from './semantics.mjs';
const admitted=new WeakMap();
const parse=(bytes,cap)=>{try{return parseBytes(bytes,cap);}catch(error){fail(error.code??'INVALID_BYTES');}};
function receiveSourceError(status,value){
 if(!Number.isInteger(status)||!value||Object.keys(value).length!==1||!value.error||Object.keys(value.error).length!==1||
  typeof value.error.code!=='string'||!Object.hasOwn(billTextSourceErrors,value.error.code)||!billTextSourceErrors[value.error.code].includes(status))fail('INVALID_ERROR_RESPONSE');return value;
}
export function receiveBillTextSourceRequest(bytes){const value=parse(bytes,billTextSourceMetadata.requestBytes);
 if(!validateRequest(value))fail('SOURCE_REQUEST_INVALID');admitted.set(value,structuredClone(value));return value;
}
export function receiveNativeBillTextSourceEvent(bytes){const value=parse(bytes,billTextSourceMetadata.responseBytes);
 if(!validateEvent(value))fail('INVALID_SOURCE_EVENT');return assertNativeSourceEventSemantics(value);
}
export async function receiveBillTextSourceResponse(status,bytes,request){
 const expected=admitted.get(request);if(!expected||expected.schemaVersion!=='meri.bill-text-source-read/1')fail('UNADMITTED_REQUEST');const value=parse(bytes,billTextSourceMetadata.responseBytes);
 if(status!==200)return receiveSourceError(status,value);
 if(!validateResponse(value))fail('INVALID_RESPONSE');assertSourceReadSemantics(value,expected);
 const hash=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value.current.text));
 if(Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')!==value.event.data.page.textSha256)fail('SOURCE_PAGE_MISMATCH');return value;
}
export function receiveHearingSourceRequest(bytes){const value=parse(bytes,billTextSourceMetadata.requestBytes);
 if(!validateHearingRequest(value))fail('SOURCE_REQUEST_INVALID');admitted.set(value,structuredClone(value));return value;
}
export function receiveNativeHearingSourceEvent(bytes){const value=parse(bytes,billTextSourceMetadata.responseBytes);
 if(!validateHearingEvent(value))fail('INVALID_SOURCE_EVENT');return assertHearingSourceEventSemantics(value);
}
export async function receiveHearingSourceResponse(status,bytes,request){
 const expected=admitted.get(request);if(!expected||expected.schemaVersion!=='meri.hearing-source-read/1')fail('UNADMITTED_REQUEST');const value=parse(bytes,billTextSourceMetadata.responseBytes);
 if(status!==200)return receiveSourceError(status,value);
 if(!validateHearingResponse(value))fail('INVALID_RESPONSE');assertHearingSourceReadSemantics(value,expected);
 // Hash JSON, preserving lone UTF-16 surrogates as escapes instead of UTF-8 replacement bytes.
 const hash=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value.current.result.records[0].payload)));
 if(Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')!==value.event.data.page.payloadSha256)fail('SOURCE_PAGE_MISMATCH');return value;
}
export function receiveHearingMediaRequest(bytes){const value=parse(bytes,billTextSourceMetadata.requestBytes);
 if(!validateHearingMediaRequest(value))fail('SOURCE_REQUEST_INVALID');admitted.set(value,structuredClone(value));return value;
}
export async function receiveHearingMediaResponse(status,bytes,request){
 const expected=admitted.get(request);if(!expected||expected.schemaVersion!=='meri.hearing-media-read/1')fail('UNADMITTED_REQUEST');
 const value=parse(bytes,billTextSourceMetadata.responseBytes);if(status!==200)return receiveSourceError(status,value);
 if(!validateHearingMediaResponse(value))fail('INVALID_RESPONSE');return assertHearingMediaReadSemantics(value,expected);
}
