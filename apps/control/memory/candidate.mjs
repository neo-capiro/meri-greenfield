/** Immutable sourced memory candidates. A candidate records what was proposed, by whom, from which origin and with which cited
 * sources; its SHA-256 is computed once over the complete record and every later step (journal, Core submission, review status) is
 * correlated to that exact hash. Candidates carry no approval, publication or committed-memory assertion. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {refuse} from '../product-access/errors.mjs';
import {SHA256,UUID,closed,text} from '../product-access/shape.mjs';
import {MEMORY_SCOPES,sourceRef} from './wire.mjs';
export const CANDIDATE_SCHEMA='meri.memory-candidate.v1';
const KEYS=['schema','candidateId','tenantId','proposerActorId','kind','scope','clientId','content','key','ttlDays','corrects','reason','sources','origin','idempotencyKey','createdAt'];
const deepFreeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(deepFreeze);Object.freeze(v);}return v;};
function origin(value){
 const o=closed(value,['kind'],['conversationId','runId','commandId','commandSha256'],'MEMORY_CANDIDATE_INVALID');
 if(o.kind==='surface'&&Object.keys(o).length===1)return o;
 if(o.kind==='conversation'&&['conversationId','runId','commandId'].every(k=>typeof o[k]==='string'&&UUID.test(o[k]))&&typeof o.commandSha256==='string'&&SHA256.test(o.commandSha256))return o;
 refuse('MEMORY_CANDIDATE_INVALID');
}
/** Validates a complete candidate (construction and journal readback alike) and returns it deep-frozen with its hash. */
export function assertCandidate(value){
 const c=closed(value,KEYS,[],'MEMORY_CANDIDATE_INVALID');
 const bad=c.schema!==CANDIDATE_SCHEMA||typeof c.candidateId!=='string'||!UUID.test(c.candidateId)||!text(c.tenantId,1,128)||!text(c.proposerActorId,1,128)||
  !['addition','correction'].includes(c.kind)||!MEMORY_SCOPES.includes(c.scope)||(c.scope==='client')!==(typeof c.clientId==='string'&&UUID.test(c.clientId))||c.scope!=='client'&&c.clientId!==null||
  !text(c.content,1,4000)||c.content.trim()!==c.content||!(c.key===null||text(c.key,1,120))||!(c.ttlDays===null||Number.isSafeInteger(c.ttlDays)&&c.ttlDays>=1&&c.ttlDays<=365)||
  (c.kind==='correction')!==(c.corrects!==null)||!(c.reason===null||text(c.reason,1,1000))||c.kind==='addition'&&c.reason!==null||
  !text(c.idempotencyKey,1,128)||typeof c.createdAt!=='string'||new Date(Date.parse(c.createdAt)).toISOString()!==c.createdAt||!Array.isArray(c.sources)||c.sources.length>16;
 if(bad)refuse('MEMORY_CANDIDATE_INVALID');
 if(c.corrects!==null){const t=closed(c.corrects,['memoryId','memorySha256'],[],'MEMORY_CANDIDATE_INVALID');if(!text(t.memoryId,1,128)||!SHA256.test(t.memorySha256))refuse('MEMORY_CANDIDATE_INVALID');}
 let sources;try{sources=c.sources.map(sourceRef);}catch{refuse('MEMORY_CANDIDATE_INVALID');}
 if(canonicalSha256(sources)!==canonicalSha256(c.sources))refuse('MEMORY_CANDIDATE_INVALID');
 const o=origin(c.origin);
 // A sourced candidate cites at least one source or originates in an identified conversation command; a surface correction cites a source.
 if(o.kind==='surface'&&c.kind==='correction'&&sources.length===0)refuse('MEMORY_CANDIDATE_INVALID');
 const candidate=deepFreeze(structuredClone(c));
 return Object.freeze({candidate,candidateSha256:canonicalSha256(candidate)});
}
export function buildCandidate(fields){
 return assertCandidate({schema:CANDIDATE_SCHEMA,candidateId:fields.candidateId,tenantId:fields.principal.tenantId,proposerActorId:fields.principal.actorId,
  kind:fields.corrects?'correction':'addition',scope:fields.scope,clientId:fields.clientId,content:fields.content,key:fields.key,ttlDays:fields.ttlDays,
  corrects:fields.corrects??null,reason:fields.reason??null,sources:[...fields.sources],origin:fields.origin,idempotencyKey:fields.idempotencyKey,createdAt:fields.createdAt});
}
