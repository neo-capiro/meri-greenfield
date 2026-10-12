/** Offline evaluation admission, not a source or policy execution boundary. */
import {canonicalSha256,validateShape} from '../../packages/contracts/validate.mjs';
import {snapshotOperationData} from '../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {resolveOperationContract} from '../../packages/contracts/retrieval-0.2/validate.mjs';
export {canonicalSha256 as hash,validateShape as publicShape,snapshotOperationData as snapshot};
export const action=resolveOperationContract({id:'actions.query',version:'0.2.0'});
export const error=code=>{throw Object.assign(new Error(code),{code});};
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function exact(value,keys){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join()!==[...keys].sort().join())error('EVAL_FIELDS');return value;}
export function text(value,max=256){if(typeof value!=='string'||!value.length||value.length>max)error('EVAL_TEXT');return value;}
export function digest(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))error('EVAL_DIGEST');return value;}
export function instant(value){text(value,30);const n=Date.parse(value);if(!Number.isFinite(n)||new Date(n).toISOString()!==value)error('EVAL_INSTANT');return n;}
export function enumeration(value,values){if(!values.includes(value))error('EVAL_ENUM');return value;}
export function array(value,max=2000){if(!Array.isArray(value)||value.length>max)error('EVAL_ARRAY');return value;}
export function unique(values){if(new Set(values).size!==values.length)error('EVAL_DUPLICATE');}
export function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
export const qualification=()=>({state:'UNQUALIFIED',runtimeQualified:false});

// Comparison-only projection. Callers still validate the exact raw observation.
// Source versions, content proofs, asOf/freshness/coverage are never stripped.
export function semanticResult(value){
 const envelope=snapshotOperationData(value);exact(envelope,['binding','subject','operation','argumentsSha256','result']);
 const stable=b=>({tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId});
 envelope.binding=stable(envelope.binding);delete envelope.subject.authorizationDecisionId;
 const page=envelope.result;page.binding=stable(page.binding);delete page.subject.authorizationDecisionId;
 for(const key of ['requestId','traceId','generatedAt'])delete page[key];
 for(const source of page.sources)delete source.retrievedAt;
 return envelope;
}
