/** Artifact current-authority wire, Meri side. Specification: docs/integration/ARTIFACT-CURRENT-AUTHORITY-CONTRACT.md; golden vectors:
 * docs/integration/artifact-current-authority.vector.json. Pure: no IO, clock or randomness. Every object is closed and every key
 * required; Core's receiver applies the same request checks and answers the receipt these checks accept.
 *
 * The receipt is Core's current-authority FACT for one documents request. It is never an options object, a grant or a credential:
 * Meri's in-process `artifactOptions` (pool, allocation, executor, validators, ...) stay Meri-local (dot, PR #121 6246642210). */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';

export const ARTIFACT_AUTHORITY_CONTRACT='capiro.meri-artifact-authority.v1';
export const ARTIFACT_AUTHORITY_ROUTE='/api/clio/application-authority/artifact';
/** Closed operation vocabulary, sorted. The first four are the artifact service's `authorize` actions; preview-publish gates the
 * preview write intent. */
export const ARTIFACT_OPERATIONS=Object.freeze(['artifact.download','artifact.generate','artifact.inspect','artifact.preview-publish','artifact.revise']);
/** The operations each `/api/documents/<intent>` needs. The authorize gate admits only these, intersected with Core's answer. */
export const INTENT_OPERATIONS=Object.freeze({
 create:Object.freeze(['artifact.generate']),
 revise:Object.freeze(['artifact.revise']),
 inspect:Object.freeze(['artifact.inspect']),
 download:Object.freeze(['artifact.download']),
 preview:Object.freeze(['artifact.download','artifact.inspect']),
 'preview-publish':Object.freeze(['artifact.download','artifact.inspect','artifact.preview-publish']),
});
/** Core's receipt lifetime on Core's own clock (expiresAtMs - checkedAtMs). Meri counts it from its own pre-send instant. */
export const MAX_RECEIPT_TTL_MS=60000;
export const MAX_ARTIFACT_BYTES=16777216,MAX_REQUEST_BYTES=1024,MAX_RECEIPT_BYTES=4096;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const UUID4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA=/^[0-9a-f]{64}$/u;
const REQUEST_KEYS=Object.freeze(['contract','observationId','conversationId','clientId','intent','requestSha256']);
const RECEIPT_KEYS=Object.freeze(['contract','observationId','principal','identityRevision','conversationId','selectedClientId','contextRevision','intent','requestSha256','operations','limits','authorityRevision','checkedAtMs','expiresAtMs']);
export {REQUEST_KEYS as ARTIFACT_AUTHORITY_REQUEST_KEYS,RECEIPT_KEYS as ARTIFACT_AUTHORITY_RECEIPT_KEYS};

const errors=new WeakSet();
/** Closed refusal codes only: ACCESS_DENIED, SESSION_REFUSED, UNAVAILABLE, DEADLINE, CANCELLED, ARTIFACT_AUTHORITY_CONFIGURATION. */
export class ArtifactAuthorityError extends Error{constructor(code){super(code);this.name='ArtifactAuthorityError';this.code=code;errors.add(this);}}
export const isArtifactAuthorityError=error=>error!==null&&typeof error==='object'&&errors.has(error);
export const refuse=code=>{throw new ArtifactAuthorityError(code);};
function closed(value,keys,code){let snapshot;try{snapshot=data(value);own(snapshot,keys);}catch{refuse(code);}return snapshot;}
const safeInteger=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;

/** The Meri request body. Byte order is the key order above (JSON.stringify of the returned object). */
export function assertArtifactAuthorityRequest(value){
 const v=closed(value,REQUEST_KEYS,'ACCESS_DENIED');
 if(v.contract!==ARTIFACT_AUTHORITY_CONTRACT||typeof v.observationId!=='string'||!UUID4.test(v.observationId)||
  ['conversationId','clientId'].some(k=>typeof v[k]!=='string'||!UUID.test(v[k]))||!Object.hasOwn(INTENT_OPERATIONS,v.intent)||
  typeof v.requestSha256!=='string'||!SHA.test(v.requestSha256))refuse('ACCESS_DENIED');
 const out=Object.freeze(Object.fromEntries(REQUEST_KEYS.map(k=>[k,v[k]])));
 if(Buffer.byteLength(JSON.stringify(out))>MAX_REQUEST_BYTES)refuse('ACCESS_DENIED');
 return out;
}

/** Core's HTTP 200 body for exactly `request`. Echoes must match; operations must cover the intent; times are Core-clock facts whose
 * only cross-clock use is their difference (the lifetime). Any deviation is ACCESS_DENIED (fail closed). */
export function assertArtifactAuthorityReceipt(value,request){
 const q=assertArtifactAuthorityRequest(request),r=closed(value,RECEIPT_KEYS,'ACCESS_DENIED');
 let principal;try{principal=own(r.principal,['tenantId','actorId']);}catch{refuse('ACCESS_DENIED');}
 if(r.contract!==ARTIFACT_AUTHORITY_CONTRACT||r.observationId!==q.observationId||r.conversationId!==q.conversationId||r.selectedClientId!==q.clientId||
  r.intent!==q.intent||r.requestSha256!==q.requestSha256||[principal.tenantId,principal.actorId].some(id=>typeof id!=='string'||!UUID.test(id))||
  [r.identityRevision,r.contextRevision,r.authorityRevision].some(x=>typeof x!=='string'||!SHA.test(x)))refuse('ACCESS_DENIED');
 if(!Array.isArray(r.operations)||r.operations.length<1||r.operations.length>ARTIFACT_OPERATIONS.length||
  r.operations.some((op,i)=>!ARTIFACT_OPERATIONS.includes(op)||i>0&&!(r.operations[i-1]<op))||
  INTENT_OPERATIONS[q.intent].some(op=>!r.operations.includes(op)))refuse('ACCESS_DENIED');
 if(r.limits!==null){let l;try{l=own(r.limits,['maxArtifactBytes']);}catch{refuse('ACCESS_DENIED');}if(!safeInteger(l.maxArtifactBytes,1,MAX_ARTIFACT_BYTES))refuse('ACCESS_DENIED');}
 if(!safeInteger(r.checkedAtMs,0,Number.MAX_SAFE_INTEGER)||!safeInteger(r.expiresAtMs,0,Number.MAX_SAFE_INTEGER)||
  r.expiresAtMs<=r.checkedAtMs||r.expiresAtMs-r.checkedAtMs>MAX_RECEIPT_TTL_MS)refuse('ACCESS_DENIED');
 return r;
}

/** Meri's mapping of a non-200 Core status. Nothing but 200 carries a decision. */
export function artifactAuthorityStatusCode(status){
 if(status===401)return 'SESSION_REFUSED';
 if(status===400||status===403)return 'ACCESS_DENIED';
 return 'UNAVAILABLE';
}
