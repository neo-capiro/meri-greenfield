/** LOCAL PROPOSAL wire shapes for the Memory surface (memory-surface 0.1-proposal, not a frozen contract). Every request body is a
 * closed object; text is trimmed and bounded; unknown fields refuse with MEMORY_REQUEST_INVALID. Authority is never read from a body. */
import {refuse} from '../product-access/errors.mjs';
import {SHA256,UUID,closed,intIn,lowerUuid,nullable,trimmed} from '../product-access/shape.mjs';
const BAD='MEMORY_REQUEST_INVALID';
export const MEMORY_SCOPES=Object.freeze(['personal','client','firm']);
export const SOURCE_KINDS=Object.freeze(['conversation_message','artifact_version','document','web_page','memory']);
export const REVIEW_STATUSES=Object.freeze(['pending','approved','rejected','expired','withdrawn']);
/** Statuses a listing can show: Core's review statuses plus the producer's own honest non-answers. */
export const VIEW_STATUSES=Object.freeze([...REVIEW_STATUSES,'submission_unknown','review_missing','unavailable']);
const MAX_SOURCES=16;
/** Core memory ids are SCOPED (capiro-backend #84 `0304b0ef`, meri-memory-receiving.service.ts): `clio:<uuid>` is a clio_memory row,
 * `item:<uuid>` an immutable memory_items version. Meri carries them opaquely (never minted, never rewritten); a bare UUID is not a
 * memory Core can find. */
export const MEMORY_ID=/^(?:clio|item):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
/** Core's storage key for an unkeyed Meri addition (`clio_memory.key` is NOT NULL). It is never a logical key: Core refuses it as a
 * candidate key (400 "Reserved memory key") and `find_by_key` never answers it, so the surface refuses it before any Core call. */
export const RESERVED_KEY=/^meri:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
/** A citation the proposer relied on. `reference` is an opaque identifier or an https URL (web_page); `sha256` pins exact bytes when
 * the source owner supplies them. Sources are carried immutably; they are evidence for the reviewer, not proof of truth. */
export function sourceRef(value){
 const s=closed(value,['kind','reference'],['sha256','title'],BAD);
 if(!SOURCE_KINDS.includes(s.kind))refuse(BAD);
 const reference=trimmed(s.reference,512,BAD);
 if(s.kind==='web_page'){let url;try{url=new URL(reference);}catch{refuse(BAD);}if(url.protocol!=='https:'||url.username||url.password)refuse(BAD);}
 const sha256=s.sha256??null,title=s.title===undefined||s.title===null?null:trimmed(s.title,200,BAD);
 if(!nullable(sha256,v=>typeof v==='string'&&SHA256.test(v)))refuse(BAD);
 return Object.freeze({kind:s.kind,reference,sha256,title});
}
function sources(value,min){
 if(!Array.isArray(value)||value.length<min||value.length>MAX_SOURCES)refuse(BAD);
 const out=value.map(sourceRef),keys=new Set(out.map(s=>`${s.kind}\u0000${s.reference}`));
 if(keys.size!==out.length)refuse(BAD);
 return Object.freeze(out);
}
const content=value=>trimmed(value,4000,BAD);
const key=value=>{if(value===undefined||value===null)return null;const k=trimmed(value,120,BAD);if(RESERVED_KEY.test(k))refuse(BAD,undefined,'key');return k;};
function ttl(value){if(value===undefined||value===null)return null;if(!intIn(value,1,365))refuse(BAD);return value;}
/** POST /api/memory/proposals/propose */
export function proposeRequest(value){
 const r=closed(value,['idempotencyKey','scope','content'],['clientId','key','ttlDays','sources'],BAD);
 if(!MEMORY_SCOPES.includes(r.scope))refuse(BAD);
 const clientId=r.clientId===undefined||r.clientId===null?null:lowerUuid(r.clientId,BAD);
 if((r.scope==='client')!==(clientId!==null))refuse(BAD);
 return Object.freeze({idempotencyKey:lowerUuid(r.idempotencyKey,BAD),scope:r.scope,clientId,content:content(r.content),key:key(r.key),ttlDays:ttl(r.ttlDays),sources:sources(r.sources??[],0)});
}
/** POST /api/memory/proposals/correct — scope and client come from the target memory, never from the body. */
export function correctRequest(value){
 const r=closed(value,['idempotencyKey','targetMemoryId','content','reason','sources'],[],BAD);
 return Object.freeze({idempotencyKey:lowerUuid(r.idempotencyKey,BAD),targetMemoryId:trimmed(r.targetMemoryId,128,BAD),content:content(r.content),reason:trimmed(r.reason,1000,BAD),sources:sources(r.sources,1)});
}
/** POST /api/memory/proposals/list */
export function listRequest(value){
 const r=closed(value,[],['cursor','limit','clientId'],BAD);
 const limit=r.limit??20;if(!intIn(limit,1,50))refuse(BAD);
 const cursor=r.cursor===undefined||r.cursor===null?null:decodeCursor(r.cursor);
 return Object.freeze({cursor,limit,clientId:r.clientId===undefined||r.clientId===null?null:lowerUuid(r.clientId,BAD)});
}
/** POST /api/memory/proposals/status */
export function statusRequest(value){const r=closed(value,['candidateId'],[],BAD);return Object.freeze({candidateId:lowerUuid(r.candidateId,BAD)});}
/** POST /api/memory/review/approve `{candidateId}` and /api/memory/review/reject `{candidateId, reason}` (Core requires a non-blank
 * rejection reason; an approval carries none). The decision itself is the route, never a body field. */
export function reviewDecisionRequest(value,decision){
 if(decision==='approved'){const r=closed(value,['candidateId'],[],BAD);return Object.freeze({candidateId:lowerUuid(r.candidateId,BAD),reason:null});}
 if(decision!=='rejected')refuse(BAD);
 const r=closed(value,['candidateId','reason'],[],BAD);
 return Object.freeze({candidateId:lowerUuid(r.candidateId,BAD),reason:trimmed(r.reason,1000,BAD)});
}
/** Opaque keyset cursor over (createdAt desc, candidateId desc). It selects a position only; visibility is re-evaluated per page. */
export function encodeCursor(record){return Buffer.from(JSON.stringify([record.createdAt,record.candidateId])).toString('base64url');}
function decodeCursor(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,256}$/u.test(value))refuse(BAD);
 let v;try{v=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));}catch{refuse(BAD);}
 if(!Array.isArray(v)||v.length!==2||typeof v[0]!=='string'||Number.isNaN(Date.parse(v[0]))||new Date(Date.parse(v[0])).toISOString()!==v[0]||typeof v[1]!=='string'||!UUID.test(v[1]))refuse(BAD);
 return Object.freeze({createdAt:v[0],candidateId:v[1]});
}
