import {parseBytes} from '../document-application/boundary.mjs';
import {validateRequest,validateResponse,validateEvent} from './generated-validator.mjs';
import {billTextSourceMetadata,billTextSourceErrors} from './protocol.mjs';
import {assertNativeSourceEventSemantics,assertSourceReadSemantics,fail} from './semantics.mjs';
export * from './protocol.mjs';
export {BillTextSourceResponseError} from './semantics.mjs';
const admitted=new WeakMap();
const parse=(bytes,cap)=>{try{return parseBytes(bytes,cap);}catch(error){fail(error.code??'INVALID_BYTES');}};
export function receiveBillTextSourceRequest(bytes){const value=parse(bytes,billTextSourceMetadata.requestBytes);
 if(!validateRequest(value))fail('SOURCE_REQUEST_INVALID');admitted.set(value,structuredClone(value));return value;
}
export function receiveNativeBillTextSourceEvent(bytes){const value=parse(bytes,billTextSourceMetadata.responseBytes);
 if(!validateEvent(value))fail('INVALID_SOURCE_EVENT');return assertNativeSourceEventSemantics(value);
}
export async function receiveBillTextSourceResponse(status,bytes,request){
 const expected=admitted.get(request);if(!expected)fail('UNADMITTED_REQUEST');const value=parse(bytes,billTextSourceMetadata.responseBytes);
 if(status!==200){if(!Number.isInteger(status)||!value||Object.keys(value).length!==1||!value.error||Object.keys(value.error).length!==1||
  typeof value.error.code!=='string'||!Object.hasOwn(billTextSourceErrors,value.error.code)||!billTextSourceErrors[value.error.code].includes(status))fail('INVALID_ERROR_RESPONSE');return value;}
 if(!validateResponse(value))fail('INVALID_RESPONSE');assertSourceReadSemantics(value,expected);
 const hash=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value.current.text));
 if(Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')!==value.event.data.page.textSha256)fail('SOURCE_PAGE_MISMATCH');return value;
}
