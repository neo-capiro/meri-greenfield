/** Dual-format canonical publication owner. Legacy roots never upgrade implicitly.
 * Deploy this reader as the rollback floor before explicitly enabling/performing a paged-root upgrade. */
import {v,own,data,same,uuid,digest,storageMethod,fail} from './boundary.mjs';
import {ARTIFACT_PUBLICATION_NAMESPACE as namespace,verifyArtifactPublications,verifyArtifactPublicationInput,createArtifactPublicationJournal,artifactPublicationParentMatches} from './artifact-publication.mjs';
import {publicationPageReference,createPublicationPageTree} from './artifact-publication-pages.mjs';
export const PAGED_ARTIFACT_PUBLICATION_VERSION='meri.artifact-publication-index.2';
export const isPagedArtifactPublication=value=>value?.publicationVersion===PAGED_ARTIFACT_PUBLICATION_VERSION;
const corrupt=()=>fail('ARTIFACT_PUBLICATION_CORRUPT'),reverse=n=>(Number.MAX_SAFE_INTEGER-n).toString().padStart(16,'0');
const historyKey=(artifactId,sequence)=>`h/${artifactId}/${reverse(sequence)}`;
const listKey=r=>`l/${reverse(Date.parse(r.version.createdAt))}/${r.version.versionId.replace(/[a-f0-9]/gu,c=>(15-parseInt(c,16)).toString(16))}`;
function decisionValue(value,tenantId){const d=data(own(value,['record','recordSha256','expectedParentVersionId','authorization','invocation','decisionSha256'])),{recordSha256,decisionSha256,...input}=d;
 const record=verifyArtifactPublicationInput(input,{historical:true}).record;if(record.version.binding.tenantId!==tenantId||v.hash(record)!==recordSha256||v.hash({...input,recordSha256})!==decisionSha256)corrupt();return d;
}
function headValue(value){if(value===null)return null;const h=data(own(value,['artifactId','versionId','sequence','decisionSha256','tombstone']));uuid(h.artifactId);uuid(h.versionId);digest(h.decisionSha256);if(!Number.isSafeInteger(h.sequence)||h.sequence<1)corrupt();
 if(h.tombstone!==null){const t=own(h.tombstone,['artifactId','versionId','retentionDecisionSha256']);if(t.artifactId!==h.artifactId||t.versionId!==h.versionId)corrupt();digest(t.retentionDecisionSha256);}return h;
}
export function verifyArtifactPublicationRoot(value,tenantId,maxDecisions=1024){if(!isPagedArtifactPublication(value))return verifyArtifactPublications(value,tenantId,maxDecisions);
 const root=data(own(value,['publicationVersion','namespace','tenantId','tree','legacy']));if(root.namespace!==namespace||root.tenantId!==tenantId)corrupt();if(root.tree!==null)publicationPageReference(root.tree);
 const legacy=own(root.legacy,['positionSha256','versionId']);digest(legacy.positionSha256);if(legacy.versionId!==null&&(typeof legacy.versionId!=='string'||!legacy.versionId||legacy.versionId==='null'||Buffer.byteLength(legacy.versionId)>1024))corrupt();return root;
}
export function createPagedArtifactPublicationJournal({transport,pages,tenantId,now,pagedWritesEnabled=false,maxCasAttempts=3,maxDecisions=1024}){
 if(typeof pagedWritesEnabled!=='boolean')fail('ARTIFACT_STORAGE_CONFIGURATION');const legacy=createArtifactPublicationJournal({transport,tenantId,now,maxCasAttempts,maxDecisions});
 const operation=storageMethod(transport,'operation'),read=storageMethod(transport,'read'),write=storageMethod(transport,'write');
 const parse=value=>verifyArtifactPublicationRoot(value,tenantId,maxDecisions),tree=life=>createPublicationPageTree({pages,tenantId,life});
 async function current(life){const native=await read(life),index=parse(native.value);return {...native,index,positionSha256:v.hash(index)};}
 async function snapshot(signal){return operation(signal,async life=>{const c=await current(life);return {index:c.index,positionSha256:c.positionSha256};});}
 function guard(c,expected){if(expected!==undefined&&c.positionSha256!==digest(expected))fail('ARTIFACT_PUBLICATION_STALE');}
 async function entry(t,root,id){const value=await t.get(root.tree,'v/'+uuid(id));if(value===null)return null;const e=data(own(value,['decision','sequence'])),d=decisionValue(e.decision,tenantId);if(d.record.version.versionId!==id||!Number.isSafeInteger(e.sequence)||e.sequence<1)corrupt();return {decision:d,sequence:e.sequence};}
 async function artifact(t,root,id){const h=headValue(await t.get(root.tree,'a/'+uuid(id)));if(h&&h.artifactId!==id)corrupt();return h?headValue({...h,tombstone:await t.get(root.tree,'t/'+id)}):null;}
 async function indexed(t,root,id){const found=await entry(t,root,id);if(!found)return null;const r=found.decision.record,h=await artifact(t,root,r.version.artifactId);if(!h||h.sequence<found.sequence)corrupt();
  const link=await t.get(root.tree,historyKey(h.artifactId,found.sequence));if(link?.versionId!==id)corrupt();const top=await entry(t,root,h.versionId);if(!top||top.sequence!==h.sequence||top.decision.decisionSha256!==h.decisionSha256)corrupt();return {...found,head:h,headDecision:top.decision};
 }
 async function append(t,root,decision,sequence){const r=decision.record;let next=root.tree;
  next=await t.set(next,'v/'+r.version.versionId,{decision,sequence});
  next=await t.set(next,historyKey(r.version.artifactId,sequence),{versionId:r.version.versionId});
  next=await t.set(next,listKey(r),{artifactId:r.version.artifactId,versionId:r.version.versionId});
  next=await t.set(next,`o/${r.version.object.objectId}/${r.version.binding.conversationId}/${r.version.versionId}`,{versionId:r.version.versionId});
  next=await t.set(next,'a/'+r.version.artifactId,{artifactId:r.version.artifactId,versionId:r.version.versionId,sequence,decisionSha256:decision.decisionSha256,tombstone:null});return {...root,tree:next};
 }
 async function publish(value,expectedPositionSha256,signal){const input=verifyArtifactPublicationInput(value),r=input.record;if(r.version.binding.tenantId!==tenantId)corrupt();digest(expectedPositionSha256);
  const first=await snapshot(signal);if(!isPagedArtifactPublication(first.index))return legacy.publish(value,expectedPositionSha256,signal);if(!pagedWritesEnabled)fail('ARTIFACT_PUBLICATION_UPGRADE_DISABLED');
  return operation(signal,async life=>{life.limitDeadline(input.authorization.expiresAtMs);for(let attempt=0;attempt<maxCasAttempts;attempt++){
   const c=await current(life);if(!isPagedArtifactPublication(c.index))corrupt();const t=tree(life),h=await artifact(t,c.index,r.version.artifactId);if(await t.get(c.index.tree,'t/'+r.version.artifactId)!==null)fail('ARTIFACT_PUBLICATION_TERMINAL');const old=await indexed(t,c.index,r.version.versionId);
   if(old){if(!same(old.decision.record,r)||old.decision.expectedParentVersionId!==input.expectedParentVersionId||!same(old.decision.invocation,input.invocation))fail('ARTIFACT_IMMUTABLE_CONFLICT');return {created:false,decision:old.decision};}
   guard(c,expectedPositionSha256);if((h?.versionId??null)!==input.expectedParentVersionId)fail('ARTIFACT_STALE_PARENT');
   if(h&&!artifactPublicationParentMatches((await entry(t,c.index,h.versionId))?.decision.record,r))fail('ARTIFACT_PARENT_BINDING');if(input.authorization.expiresAtMs<=now())fail('ARTIFACT_AUTHORITY');
   const recordSha256=v.hash(r),decision={...input,recordSha256,decisionSha256:v.hash({...input,recordSha256})},next=await append(t,c.index,decision,(h?.sequence??0)+1);
   life.check();if(await write(life,c,parse(next)))return {created:true,decision};
  }fail('ARTIFACT_PUBLICATION_CONTENTION');});
 }
 /** Explicit owner operation, never a public request or automatic capacity fallback. Native old root remains retained. */
 async function upgrade(expectedPositionSha256,signal){if(!pagedWritesEnabled)fail('ARTIFACT_PUBLICATION_UPGRADE_DISABLED');digest(expectedPositionSha256);
  return operation(signal,async life=>{const c=await current(life);guard(c,expectedPositionSha256);if(isPagedArtifactPublication(c.index))return {positionSha256:c.positionSha256,upgraded:false};
   const t=tree(life),entries=new Map(),sequences=new Map();
   for(const decision of c.index.decisions){const r=decision.record,id=r.version.artifactId,sequence=(sequences.get(id)??0)+1;sequences.set(id,sequence);
    entries.set('v/'+r.version.versionId,{decision,sequence});entries.set(historyKey(id,sequence),{versionId:r.version.versionId});entries.set(listKey(r),{artifactId:id,versionId:r.version.versionId});
    entries.set(`o/${r.version.object.objectId}/${r.version.binding.conversationId}/${r.version.versionId}`,{versionId:r.version.versionId});entries.set('a/'+id,{artifactId:id,versionId:r.version.versionId,sequence,decisionSha256:decision.decisionSha256,tombstone:null});
   }
   for(const terminal of c.index.tombstones)entries.set('t/'+terminal.artifactId,terminal);
   const next={publicationVersion:PAGED_ARTIFACT_PUBLICATION_VERSION,namespace,tenantId,tree:await t.build([...entries].map(([key,value])=>({key,value}))),legacy:{positionSha256:c.positionSha256,versionId:c.versionId??null}};
   if(!await write(life,c,parse(next)))fail('ARTIFACT_PUBLICATION_STALE');return {positionSha256:v.hash(next),upgraded:true};
  });
 }
 async function readVersion(versionId,signal){uuid(versionId);return operation(signal,async life=>{const c=await current(life);if(!isPagedArtifactPublication(c.index))fail('ARTIFACT_PUBLICATION_LEGACY');const result=await indexed(tree(life),c.index,versionId);return {positionSha256:c.positionSha256,result};});}
 async function readHead(artifactId,signal){uuid(artifactId);return operation(signal,async life=>{const c=await current(life);if(!isPagedArtifactPublication(c.index))fail('ARTIFACT_PUBLICATION_LEGACY');const t=tree(life),h=await artifact(t,c.index,artifactId);return {positionSha256:c.positionSha256,result:h===null?null:await indexed(t,c.index,h.versionId)};});}
 async function page(query,signal){const q=data(own(query,['kind','offset','limit','positionSha256'],['artifactId','anchorVersionId']));if(!['list','history','recovery'].includes(q.kind)||!Number.isSafeInteger(q.offset)||q.offset<0||!Number.isInteger(q.limit)||q.limit<1||q.limit>100)fail('ARTIFACT_STORAGE_INPUT');
  return operation(signal,async life=>{const c=await current(life);guard(c,q.positionSha256);if(!isPagedArtifactPublication(c.index))fail('ARTIFACT_PUBLICATION_LEGACY');const t=tree(life);let prefix=q.kind==='list'?'l/':'v/',anchor=null;
   if(q.kind==='history'){anchor=await indexed(t,c.index,uuid(q.anchorVersionId));if(!anchor||anchor.decision.record.version.artifactId!==uuid(q.artifactId))fail('ARTIFACT_PUBLICATION_UNVERIFIED');prefix='h/'+q.artifactId+'/';}
   const scan=await t.range(c.index.tree,{prefix,offset:q.offset,limit:q.limit}),records=[];
   for(const item of scan.entries){const id=q.kind==='recovery'?item.key.slice(2):item.value.versionId,result=await indexed(t,c.index,uuid(id));if(!result)corrupt();if(q.kind==='list'&&(result.head.versionId!==id||result.head.tombstone!==null))continue;if(q.kind==='history'&&result.head.artifactId!==q.artifactId)corrupt();records.push(result);}
   return {positionSha256:c.positionSha256,records,nextOffset:scan.nextOffset,anchor};
  });
 }
 async function findObject(objectId,conversationId,signal){uuid(objectId);uuid(conversationId);return operation(signal,async life=>{const c=await current(life);if(!isPagedArtifactPublication(c.index))fail('ARTIFACT_PUBLICATION_LEGACY');const t=tree(life),scan=await t.range(c.index.tree,{prefix:`o/${objectId}/${conversationId}/`,limit:2});if(scan.entries.length===0)return null;if(scan.entries.length!==1||scan.nextOffset!==null)fail('ARTIFACT_VERSION_CORRUPT');const result=await indexed(t,c.index,uuid(scan.entries[0].value.versionId));if(result?.decision.record.version.object.objectId!==objectId||result.decision.record.version.binding.conversationId!==conversationId)corrupt();return result;});}
 async function tombstone(value,signal){const terminal=data(own(value,['artifactId','versionId','retentionDecisionSha256']));uuid(terminal.artifactId);if(terminal.versionId!==null)uuid(terminal.versionId);digest(terminal.retentionDecisionSha256);
  if(!isPagedArtifactPublication((await snapshot(signal)).index))return legacy.tombstone(value,signal);if(!pagedWritesEnabled)fail('ARTIFACT_PUBLICATION_UPGRADE_DISABLED');
  return operation(signal,async life=>{for(let attempt=0;attempt<maxCasAttempts;attempt++){const c=await current(life),t=tree(life),h=await artifact(t,c.index,terminal.artifactId);if((h?.versionId??null)!==terminal.versionId)fail('ARTIFACT_PUBLICATION_STALE');const old=await t.get(c.index.tree,'t/'+terminal.artifactId);if(old!==null){if(!same(old,terminal))fail('ARTIFACT_PUBLICATION_TERMINAL');return terminal;}const next={...c.index,tree:await t.set(c.index.tree,'t/'+terminal.artifactId,terminal)};if(await write(life,c,parse(next)))return terminal;}fail('ARTIFACT_PUBLICATION_CONTENTION');});
 }
 return Object.freeze({snapshot,publish,tombstone,upgrade,readVersion,readHead,page,findObject});
}
