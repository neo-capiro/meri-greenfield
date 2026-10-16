/** SYNTHETIC test doubles only: an in-memory producer journal with the PostgreSQL journal's port semantics, and a Core double at the
 * transport boundary so the real review/memory adapters validate every answer. No database, network or Core is involved. */
import {refuse} from '../../product-access/errors.mjs';
import {assertCandidate} from '../candidate.mjs';
export const NOW=Date.parse('2026-10-16T12:00:00.000Z');
export const T1='tenant-one',T2='tenant-two';
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const CLIENT_A=id(901),CLIENT_B=id(902);
export function principal(over={}){
 return Object.freeze({tenantId:T1,actorId:'actor-1',role:'member',permissions:Object.freeze([]),clientIds:Object.freeze([CLIENT_A]),membershipRevision:'m1',...over});
}
export function ids(start=100){let n=start;return ()=>id(n++);}
export function createJournalDouble(){
 const rows=new Map();const calls=[];
 const clone=r=>Object.freeze({...r,submission:Object.freeze({...r.submission})});
 return {rows,calls,
  async insert({candidate,candidateSha256,requestSha256}){
   calls.push('insert');
   const existing=[...rows.values()].find(r=>r.candidate.tenantId===candidate.tenantId&&r.candidate.proposerActorId===candidate.proposerActorId&&r.candidate.idempotencyKey===candidate.idempotencyKey);
   if(existing){if(existing.requestSha256!==requestSha256)refuse('MEMORY_IDEMPOTENCY_CONFLICT');return {inserted:false,record:clone(existing)};}
   const stored=assertCandidate(JSON.parse(JSON.stringify(candidate)));if(stored.candidateSha256!==candidateSha256)refuse('MEMORY_JOURNAL_STATE');
   const r={candidate:stored.candidate,candidateSha256,requestSha256,submission:{state:'PREPARED',reviewId:null}};rows.set(`${candidate.tenantId}/${candidate.candidateId}`,r);
   return {inserted:true,record:clone(r)};
  },
  async recordSubmission({tenantId,candidateId,candidateSha256,reviewId}){
   calls.push('recordSubmission');const r=rows.get(`${tenantId}/${candidateId}`);
   if(!r||r.candidateSha256!==candidateSha256||r.submission.state==='SUBMITTED'&&r.submission.reviewId!==reviewId)refuse('MEMORY_JOURNAL_STATE');
   r.submission={state:'SUBMITTED',reviewId};
  },
  async recordUnknown({tenantId,candidateId}){calls.push('recordUnknown');const r=rows.get(`${tenantId}/${candidateId}`);if(r?.submission.state==='PREPARED')r.submission={state:'SUBMISSION_UNKNOWN',reviewId:null};},
  async get({tenantId,proposerActorId,candidateId}){const r=rows.get(`${tenantId}/${candidateId}`);return r&&r.candidate.proposerActorId===proposerActorId?clone(r):null;},
  async listOwn({tenantId,proposerActorId,clientIds,clientId,cursor,limit}){
   return [...rows.values()].filter(r=>r.candidate.tenantId===tenantId&&r.candidate.proposerActorId===proposerActorId&&(r.candidate.scope!=='client'||clientIds.includes(r.candidate.clientId))&&(clientId===null||r.candidate.clientId===clientId))
    .sort((a,b)=>b.candidate.createdAt.localeCompare(a.candidate.createdAt)||b.candidate.candidateId.localeCompare(a.candidate.candidateId))
    .filter(r=>!cursor||r.candidate.createdAt<cursor.createdAt||r.candidate.createdAt===cursor.createdAt&&r.candidate.candidateId<cursor.candidateId).slice(0,limit).map(clone);
  },
 };
}
/** Core at the transport boundary. `answer` lets a test substitute a raw (possibly malformed) answer for one route. */
export function createCoreDouble(){
 const reviews=new Map(),memories=new Map(),calls=[];let reviewN=500;
 const core={reviews,memories,calls,answer:{},failSubmit:null,
  /** Core's own canonical decision (the only review authority in these tests). */
  decide(candidateId,status){const r=reviews.get(candidateId);r.status=status;r.decidedAt=new Date(NOW+1000).toISOString();r.publishedMemoryId=status==='approved'?`mem-${candidateId.slice(-4)}`:null;},
  addMemory(m){memories.set(m.memoryId,{tenantId:T1,memorySha256:'c'.repeat(64),scope:'personal',clientId:null,ownerActorId:'actor-1',key:null,state:'active',...m});},
  transport:{async call(route,{tenantId,actorId,body},failure){
   calls.push({route,tenantId,actorId,body:JSON.parse(JSON.stringify(body))});
   try{
    if(Object.hasOwn(core.answer,route))return core.answer[route];
    if(route==='submit'){
     if(core.failSubmit==='refuse')throw Error('synthetic transport failure before Core received the candidate');
     const {candidate,candidateSha256}=body;const existing=reviews.get(candidate.candidateId);
     if(existing&&existing.candidateSha256!==candidateSha256)throw Error('hash mismatch');
     if(!existing)reviews.set(candidate.candidateId,{tenantId,actorId,candidateSha256,reviewId:id(reviewN++),status:'pending',decidedAt:null,publishedMemoryId:null});
     if(core.failSubmit==='lostAck'){core.failSubmit=null;throw Error('synthetic lost acknowledgement');}
     return {candidateId:candidate.candidateId,candidateSha256,reviewId:reviews.get(candidate.candidateId).reviewId,accepted:true};
    }
    if(route==='status'){
     if(core.failStatus)throw Error('synthetic status failure');
     return {checkedAt:new Date(NOW+2000).toISOString(),reviews:body.candidates.map(({candidateId,candidateSha256})=>{const r=reviews.get(candidateId);
      return r&&r.tenantId===tenantId&&r.actorId===actorId&&r.candidateSha256===candidateSha256?{candidateId,candidateSha256,status:r.status,reviewId:r.reviewId,decidedAt:r.decidedAt,publishedMemoryId:r.publishedMemoryId}:
       {candidateId,candidateSha256,status:'not_found',reviewId:null,decidedAt:null,publishedMemoryId:null};})};
    }
    if(route==='target'){const m=memories.get(body.memoryId);return {memory:m&&m.tenantId===tenantId?{memoryId:body.memoryId,...m}:null};}
    if(route==='findByKey'){const m=[...memories.entries()].find(([,v])=>v.tenantId===tenantId&&v.key===body.key&&v.scope===body.scope&&v.clientId===body.clientId&&(v.scope!=='personal'||v.ownerActorId===actorId));
     return {memory:m?{memoryId:m[0],...m[1]}:null};}
   }catch{refuse(failure);}
   throw Error('unexpected route');
  }},
 };
 return core;
}
