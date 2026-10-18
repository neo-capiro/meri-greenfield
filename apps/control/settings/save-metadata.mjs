/** Canonical settings revision and content-free audit metadata, shared by user and tenant saves. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {refuse} from '../product-access/errors.mjs';
import {intIn} from '../product-access/shape.mjs';
const UUID4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export function changedFields(before,after){
 const out=[];
 for(const key of new Set([...Object.keys(before??{}),...Object.keys(after)])){
  const a=before?.[key],b=after[key];if(canonicalSha256(a??null)===canonicalSha256(b??null))continue;
  const nested=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(nested(a)||nested(b)){for(const sub of new Set([...Object.keys(a??{}),...Object.keys(b??{})]))if(canonicalSha256(a?.[sub]??null)!==canonicalSha256(b?.[sub]??null))out.push(`${key}.${sub}`);}
  else out.push(key);
 }
 return Object.freeze(out.sort());
}
export function settingsRevision(value){if(!intIn(value,0,Number.MAX_SAFE_INTEGER-1))refuse('SETTINGS_REQUEST_INVALID',null,'expectedRevision');return value;}
export function settingsAuditId(newId){const value=newId();if(typeof value!=='string'||!UUID4.test(value))refuse('PRODUCT_CONFIGURATION');return value;}
