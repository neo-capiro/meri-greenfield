/** Retention request facts reuse the canonical contracts and data boundary; refusals are closed codes. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {data, own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export {canonicalSha256 as hash, data, own};
export function fail(code){throw Object.assign(new Error(code),{code});}
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function uuid(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value))fail('RETENTION_INVALID_REQUEST');return value;}
export function digest(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/u.test(value))fail('RETENTION_INVALID_REQUEST');return value;}
export function text(value,max=256){if(typeof value!=='string'||!value||value.length>max)fail('RETENTION_INVALID_REQUEST');return value;}
export function instant(value){const n=Date.parse(value);if(typeof value!=='string'||!Number.isSafeInteger(n)||new Date(n).toISOString()!==value)fail('RETENTION_INVALID_REQUEST');return n;}
export function clock(now){if(typeof now!=='function')fail('RETENTION_CONFIGURATION');return ()=>{const t=now();if(!Number.isSafeInteger(t)||t<0)fail('RETENTION_CONFIGURATION');return t;};}
/** A subject is one conversation or one artifact of one tenant, owned by one actor. */
export function subject(value){const s=own(data(value),['tenantId','kind','subjectId'],['ownerActorId']);text(s.tenantId);if(s.ownerActorId!==undefined)text(s.ownerActorId);uuid(s.subjectId);if(!['conversation','artifact'].includes(s.kind))fail('RETENTION_INVALID_REQUEST');return s;}
export const subjectKey=s=>`${s.tenantId}:${s.kind}:${s.subjectId}`;
