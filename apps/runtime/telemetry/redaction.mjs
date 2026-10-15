/** Attribute hygiene for everything this runtime hands to the OpenTelemetry API: secret-shaped keys are dropped, long values are cut
 * at a code-point boundary and marked, and only primitives (or arrays of them) survive. The SDK never sees unfiltered attributes. */
export const SENSITIVE_KEY=/credential|token|authorization|cookie|secret|password|signature/iu;
export const MAX_ATTRIBUTE_BYTES=512;
const primitive=value=>typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value);
export function truncateAttributeValue(value){
 if(typeof value!=='string'||Buffer.byteLength(value)<=MAX_ATTRIBUTE_BYTES)return {value,truncated:false};
 let out='',bytes=0;for(const ch of value){const n=Buffer.byteLength(ch);if(bytes+n>MAX_ATTRIBUTE_BYTES)break;out+=ch;bytes+=n;}
 return {value:out,truncated:true};
}
export function redactAttributes(attributes){
 const out={};if(!attributes||typeof attributes!=='object')return Object.freeze(out);
 for(const [key,raw] of Object.entries(attributes)){
  if(!key||SENSITIVE_KEY.test(key))continue;
  if(primitive(raw)){const {value,truncated}=truncateAttributeValue(raw);out[key]=value;if(truncated)out[`${key}.truncated`]=true;continue;}
  if(Array.isArray(raw)&&raw.length<=64&&raw.every(primitive)){const cut=raw.map(truncateAttributeValue);out[key]=cut.map(c=>c.value);if(cut.some(c=>c.truncated))out[`${key}.truncated`]=true;}
 }
 return Object.freeze(out);
}
/** URL paths become span attributes only with secret-shaped segments replaced: a segment longer than 64 characters, any segment
 * holding a dot-separated base64url pair of at least 16 characters each (signed tokens, JWTs), or any percent-encoded segment is
 * `{redacted}`, and paths with more than 16 segments are cut. Route paths and UUID identifiers pass unchanged. Query strings and
 * fragments are never read by the instrumentation; this only guards clients that misplace a credential in the path. */
export const REDACTED_SEGMENT='{redacted}';
const SECRET_SEGMENT=/[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/u;
export function redactPath(pathname){
 if(typeof pathname!=='string')return '/';const segments=pathname.split('/'),cut=segments.length>17;
 const kept=segments.slice(0,17).map(segment=>segment.length>64||segment.includes('%')||SECRET_SEGMENT.test(segment)?REDACTED_SEGMENT:segment);
 return kept.join('/')+(cut?'/'+REDACTED_SEGMENT:'');
}
