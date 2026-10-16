/** Canonical complete reservation decoder shared by next-turn journals and read-only history. */
import {bounded,own,validateShape,same,fail,uuid} from './boundary.mjs';
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export function assertNextRunFacts(value){
 const f=bounded(value);if(f&&typeof f==='object'&&Object.hasOwn(f,'noAuthority')){own(f,['checkpoint','noAuthority']);own(f.noAuthority,['foreclosureSha256']);if(f.checkpoint!==null||!digest(f.noAuthority.foreclosureSha256))fail('NEXT_RUN_FACTS_REFUSED');return f;}
 own(f,['checkpoint','retirement','revocation']);own(f.retirement,['physicalStopProven']);own(f.revocation,['receiptSha256','grantIds']);if(f.checkpoint!==null){own(f.checkpoint,['checkpointId','proofSha256']);uuid(f.checkpoint.checkpointId);}
 if(f.checkpoint!==null&&!digest(f.checkpoint.proofSha256)||f.retirement.physicalStopProven!==true||!digest(f.revocation.receiptSha256)||!Array.isArray(f.revocation.grantIds)||!f.revocation.grantIds.length||f.revocation.grantIds.length>64||f.revocation.grantIds.some(g=>typeof g!=='string'||!g||g.length>256))fail('NEXT_RUN_FACTS_REFUSED');return f;
}
export function assertNextRunReservation(value){
 const v=bounded(value);own(v,['source','target','facts','scopes','versions','policyRevision','reservedAt']);
 const {source,target}=v;validateShape('RunBinding',source);validateShape('RunBinding',target);validateShape('RuntimeVersions',v.versions);assertNextRunFacts(v.facts);
 if(!Array.isArray(v.scopes)||!v.scopes.length||typeof v.policyRevision!=='string'||!v.policyRevision||typeof v.reservedAt!=='string'||!Number.isFinite(Date.parse(v.reservedAt)))fail('STORE_CORRUPT');
 for(const s of v.scopes){validateShape('Scope',s);if(s.tenantId!==source.tenantId||s.policyRevision!==v.policyRevision)fail('STORE_CORRUPT');}
 if(target.tenantId!==source.tenantId||target.actorId!==source.actorId||target.conversationId!==source.conversationId||target.runId===source.runId||target.attemptId===source.attemptId||target.workerId===source.workerId||target.writerFence!==source.writerFence+1||v.scopes.some((s,i)=>v.scopes.slice(0,i).some(other=>same(other,s))))fail('STORE_CORRUPT');
 return v;
}
