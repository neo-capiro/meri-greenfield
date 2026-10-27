/** Opaque selector, not authority. A 64-hex cursor binds a bounded position to the exact
 * current root, query and caller. The digest is checked after decoding; no new secret or registry. */
import {createHash,timingSafeEqual} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest();
export function publicationCursor(snapshotSha256,errorCode){
 const mask=hash('artifact-publication-offset:'+snapshotSha256).subarray(0,8),tag=offset=>hash('artifact-publication-page:'+snapshotSha256+':'+offset).subarray(0,24);
 const fail=()=>{throw Object.assign(Error(errorCode),{code:errorCode});};
 function encode(offset){if(!Number.isSafeInteger(offset)||offset<1)fail();const bytes=Buffer.alloc(8);bytes.writeBigUInt64BE(BigInt(offset));for(let i=0;i<8;i++)bytes[i]^=mask[i];return Buffer.concat([bytes,tag(offset)]).toString('hex');}
 function decode(cursor){if(cursor===null)return 0;if(typeof cursor!=='string'||!/^[a-f0-9]{64}$/u.test(cursor))fail();const bytes=Buffer.from(cursor,'hex'),position=Buffer.from(bytes.subarray(0,8));for(let i=0;i<8;i++)position[i]^=mask[i];const n=position.readBigUInt64BE();if(n<1n||n>BigInt(Number.MAX_SAFE_INTEGER))fail();const offset=Number(n);if(!timingSafeEqual(bytes.subarray(8),tag(offset)))fail();return offset;}
 return Object.freeze({encode,decode});
}
