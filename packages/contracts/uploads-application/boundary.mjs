import {parseBytes,copyBytes,digest} from '../document-application/boundary.mjs';
import {UPLOAD_MIME} from './protocol.mjs';
const errors=new WeakSet();
export class UploadResponseError extends Error{constructor(code){super(code);this.name='UploadResponseError';this.code=code;errors.add(this);}}
export const fail=code=>{throw new UploadResponseError(code);};
export const isFailure=error=>errors.has(error);
export const parse=(bytes,cap)=>{try{return parseBytes(bytes,cap);}catch{fail('INVALID_UPLOAD_BYTES');}};
export const copy=(bytes,cap)=>{try{return copyBytes(bytes,cap);}catch{fail('UPLOAD_BYTE_LIMIT');}};
export {digest};
// Local integrity brands cannot be serialized, restored or used as authorization.
export const requests=new WeakMap(),receipts=new WeakSet();
export function declaration(value){
 const name=value.filename,format=/\.([a-z0-9]+)$/iu.exec(name)?.[1].toLowerCase();
 if(new TextEncoder().encode(name).length>255||/[\u0000-\u001f\u007f/\\]/u.test(name)||!name.trim()||
  !Object.hasOwn(UPLOAD_MIME,format)||value.mimeType!==UPLOAD_MIME[format])fail('INVALID_UPLOAD_DECLARATION');
}
