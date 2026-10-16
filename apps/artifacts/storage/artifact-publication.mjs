/** Canonical complete artifact publication history. SQL is a projection; this tenant-purpose CAS is the decision.
 * Retained authority is historical evidence, never permission to generate, put, purge or release bytes. */
import {v,own,data,same,uuid,digest,storageMethod,fail} from './boundary.mjs';
import {verifyArtifactVersionStorageRecord as recordValue} from './version-record.mjs';
export const ARTIFACT_PUBLICATION_NAMESPACE='meri.artifact-publication.proposal-1';
const publicationVersion='meri.artifact-publication-index.proposal-1',namespace=ARTIFACT_PUBLICATION_NAMESPACE;
const corrupt=()=>fail('ARTIFACT_PUBLICATION_CORRUPT');
const parentMatches=(parent,r)=>parent&&['tenantId','actorId','conversationId'].every(k=>parent.version.binding[k]===r.version.binding[k])&&parent.version.artifactId===r.version.artifactId&&same(parent.version.scopes,r.version.scopes)&&parent.spec.operation===r.spec.operation&&parent.spec.format===r.spec.format;
export const emptyArtifactPublications=tenantId=>({publicationVersion,namespace,tenantId,decisions:[],heads:[],tombstones:[]});
export function verifyArtifactPublicationInput(value){
 const p=data(own(value,['record','expectedParentVersionId','authorization','invocation'])),r=recordValue(p.record),b=r.version.binding,a=own(p.authorization,['receiptId','decision','action','binding','scopesSha256','resourceSha256','requestSha256','expiresAtMs']),i=own(p.invocation,['versionId','budgetTicketId','binding','requestSha256','ownedInvocationId']);
 if(p.expectedParentVersionId!==null)uuid(p.expectedParentVersionId);
 if(p.expectedParentVersionId!==r.version.parentVersionId||typeof a.receiptId!=='string'||!a.receiptId||a.receiptId.length>1024||a.decision!=='allow'||a.action!==(p.expectedParentVersionId===null?'artifact.generate':'artifact.revise')||!same(a.binding,b)||a.scopesSha256!==v.hash(r.version.scopes)||a.requestSha256!==r.requestSha256||!Number.isSafeInteger(a.expiresAtMs)||a.expiresAtMs<1)corrupt();digest(a.resourceSha256);
 if(i.versionId!==r.version.versionId||typeof i.budgetTicketId!=='string'||!i.budgetTicketId||i.budgetTicketId.length>1024||!same(i.binding,b)||i.requestSha256!==r.requestSha256||!(i.ownedInvocationId===null||typeof i.ownedInvocationId==='string'&&i.ownedInvocationId==='owned_'+r.version.versionId))corrupt();return p;
}
export function verifyArtifactPublications(value,tenantId,maxDecisions=1024){
 const p=data(own(value,['publicationVersion','namespace','tenantId','decisions','heads','tombstones']));
 if(p.publicationVersion!==publicationVersion||p.namespace!==namespace||p.tenantId!==tenantId||!Array.isArray(p.decisions)||!Array.isArray(p.heads)||!Array.isArray(p.tombstones)||p.decisions.length>maxDecisions||p.heads.length>maxDecisions||p.tombstones.length>maxDecisions||Buffer.byteLength(JSON.stringify(p))>8388608)corrupt();
 const versions=new Map(),heads=new Map();for(const raw of p.decisions){const d=own(raw,['record','recordSha256','expectedParentVersionId','authorization','invocation','decisionSha256']),{recordSha256,decisionSha256,...input}=d,r=verifyArtifactPublicationInput(input).record,id=r.version.versionId,artifactId=r.version.artifactId;
  if(r.version.binding.tenantId!==tenantId||recordSha256!==v.hash(r)||decisionSha256!==v.hash({...input,recordSha256})||versions.has(id)||(heads.get(artifactId)?.versionId??null)!==d.expectedParentVersionId)corrupt();
  if(d.expectedParentVersionId!==null&&!parentMatches(versions.get(d.expectedParentVersionId)?.record,r))corrupt();
  versions.set(id,d);heads.set(artifactId,{artifactId,versionId:id,decisionSha256});
 }
 const expected=[...heads.values()].sort((a,b)=>a.artifactId.localeCompare(b.artifactId));if(!same(p.heads,expected))corrupt();
 const terminal=new Set();for(const raw of p.tombstones){const t=own(raw,['artifactId','versionId','retentionDecisionSha256']);uuid(t.artifactId);digest(t.retentionDecisionSha256);if(t.versionId!==null)uuid(t.versionId);if(terminal.has(t.artifactId)||(heads.get(t.artifactId)?.versionId??null)!==t.versionId)corrupt();terminal.add(t.artifactId);}
 return p;
}
export function createArtifactPublicationJournal({transport,tenantId,now,maxDecisions=1024,maxCasAttempts=3}){
 if(typeof tenantId!=='string'||!tenantId||typeof now!=='function'||!Number.isSafeInteger(maxDecisions)||maxDecisions<1||maxDecisions>1024||!Number.isSafeInteger(maxCasAttempts)||maxCasAttempts<1||maxCasAttempts>8)fail('ARTIFACT_STORAGE_CONFIGURATION');
 const operation=storageMethod(transport,'operation'),read=storageMethod(transport,'read'),write=storageMethod(transport,'write'),parse=value=>verifyArtifactPublications(value,tenantId,maxDecisions);
 const position=index=>v.hash(index),receipt=(decision,created)=>({created,decision:data(decision)});
 async function snapshot(signal){return operation(signal,async life=>{const index=parse((await read(life)).value);return {index,positionSha256:position(index)};});}
 async function publish(value,expectedPositionSha256,signal){const input=verifyArtifactPublicationInput(value),r=input.record;if(r.version.binding.tenantId!==tenantId)corrupt();digest(expectedPositionSha256);
  return operation(signal,async life=>{life.limitDeadline(input.authorization.expiresAtMs);for(let attempt=0;attempt<maxCasAttempts;attempt++){
   const current=await read(life),index=parse(current.value);if(index.tombstones.some(t=>t.artifactId===r.version.artifactId))fail('ARTIFACT_PUBLICATION_TERMINAL');
   const old=index.decisions.find(d=>d.record.version.versionId===r.version.versionId);
   if(old){if(!same(old.record,r)||old.expectedParentVersionId!==input.expectedParentVersionId||!same(old.invocation,input.invocation))fail('ARTIFACT_IMMUTABLE_CONFLICT');return receipt(old,false);}
   if(position(index)!==expectedPositionSha256)fail('ARTIFACT_PUBLICATION_STALE');
   if((index.heads.find(h=>h.artifactId===r.version.artifactId)?.versionId??null)!==input.expectedParentVersionId)fail('ARTIFACT_STALE_PARENT');
   if(input.expectedParentVersionId!==null&&!parentMatches(index.decisions.find(d=>d.record.version.versionId===input.expectedParentVersionId)?.record,r))fail('ARTIFACT_PARENT_BINDING');
   if(input.authorization.expiresAtMs<=now())fail('ARTIFACT_AUTHORITY');if(index.decisions.length>=maxDecisions)fail('ARTIFACT_PUBLICATION_LIMIT');
   const recordSha256=v.hash(r),decision={...input,recordSha256,decisionSha256:v.hash({...input,recordSha256})},heads=[...index.heads.filter(h=>h.artifactId!==r.version.artifactId),{artifactId:r.version.artifactId,versionId:r.version.versionId,decisionSha256:decision.decisionSha256}].sort((a,b)=>a.artifactId.localeCompare(b.artifactId)),next=parse({...index,decisions:[...index.decisions,decision],heads});
   if(await write(life,current,next))return receipt(decision,true);
  }fail('ARTIFACT_PUBLICATION_CONTENTION');});
 }
 // Called only by the trusted retention owner with its already accepted terminal decision. No deletion authority is conferred.
 async function tombstone(value,signal){const t=data(own(value,['artifactId','versionId','retentionDecisionSha256']));uuid(t.artifactId);digest(t.retentionDecisionSha256);if(t.versionId!==null)uuid(t.versionId);
  return operation(signal,async life=>{for(let attempt=0;attempt<maxCasAttempts;attempt++){const current=await read(life),index=parse(current.value),old=index.tombstones.find(row=>row.artifactId===t.artifactId);if(old){if(!same(old,t))fail('ARTIFACT_PUBLICATION_TERMINAL');return data(old);}
   if((index.heads.find(h=>h.artifactId===t.artifactId)?.versionId??null)!==t.versionId)fail('ARTIFACT_PUBLICATION_STALE');const next=parse({...index,tombstones:[...index.tombstones,t]});if(await write(life,current,next))return data(t);
  }fail('ARTIFACT_PUBLICATION_CONTENTION');});
 }
 return Object.freeze({snapshot,publish,tombstone});
}
