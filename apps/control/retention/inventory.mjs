/** Data classes and exact reference enumeration over the canonical record snapshot. Pure: no store access. */
import {own,data,fail,uuid,digest,hash,text} from './boundary.mjs';
export const classes=Object.freeze(['conversation','events','lifecycle','completionCheckpoints','nextRuns','sdkSession','selectedOutputs','nativeJournals','artifactVersions','uploads','logs']);
/** Classes the product can neither suppress by bytes nor purge: identifiers only, policy-configured elsewhere. */
export const externalClasses=Object.freeze(['logs']);
const object=o=>{const v=own(o,['objectId','versionId','sha256']);uuid(v.objectId);text(v.versionId,1024);digest(v.sha256);return v;};
const refKey=o=>`${o.objectId}@${o.versionId}`;
/** Snapshot shape (produced by the owning journals, validated here): runs with continuation envelopes, lifecycle checkpoint proofs, completion checkpoints, selected outputs and artifact versions. */
export function enumerateReferences(snapshot){
 const s=own(data(snapshot),['subject','runs','checkpoints','completionCheckpoints','nextRuns','sdkSessionEntries','selectedOutputs','artifactVersions','nativeJournalRows','uploads']);
 const list=(v,name)=>{if(!Array.isArray(v)||v.length>65536)fail('RETENTION_INVALID_REQUEST');return v;};
 const rows=[],objects=new Map();const add=(className,key,refs)=>{for(const o of refs)objects.set(refKey(o),{...object(o),className});rows.push(Object.freeze({className,key,objects:Object.freeze(refs.map(object))}));};
 for(const r of list(s.runs))add('conversation',r.runId,r.continuation?.checkpoint?[r.continuation.checkpoint.opaqueSession,...r.continuation.checkpoint.workspace.entries.map(e=>e.object)]:[]);
 add('events',s.subject.subjectId,[]);
 for(const c of list(s.checkpoints))add('lifecycle',c.checkpointId,[c.checkpoint.opaqueSession,...c.checkpoint.workspace.entries.map(e=>e.object)]);
 for(const c of list(s.completionCheckpoints))add('completionCheckpoints',c.checkpointId,[c.checkpoint.opaqueSession,...c.checkpoint.workspace.entries.map(e=>e.object)]);
 for(const n of list(s.nextRuns))add('nextRuns',n.targetRunId,[]);
 for(const e of list(s.sdkSessionEntries))add('sdkSession',e.entryId,[]);
 for(const o of list(s.selectedOutputs))add('selectedOutputs',o.outputId,o.object?[o.object]:[]);
 for(const v of list(s.artifactVersions))add('artifactVersions',v.versionId,[v.object]);
 for(const n of list(s.nativeJournalRows))add('nativeJournals',n.runId,[]);
 for(const u of list(s.uploads))add('uploads',u.uploadId,[u.object]);
 add('logs',s.subject.subjectId,[]);
 const distinct=[...objects.values()];
 return Object.freeze({subject:s.subject,rows:Object.freeze(rows),objects:Object.freeze(distinct),inventorySha256:hash({subject:s.subject,objects:distinct.map(refKey).sort()})});
}
/** Cross-subject index: which other subjects still reference each exact version (a fork copies checkpoint references into its own conversation). */
export function createReferenceIndex(){
 const byVersion=new Map();
 return Object.freeze({
  record(subjectKey,inventory){for(const o of inventory.objects){const k=refKey(o);if(!byVersion.has(k))byVersion.set(k,new Set());byVersion.get(k).add(subjectKey);}},
  holders(o){return [...(byVersion.get(refKey(o))??[])];}
 });
}
/** Versions of this subject that another, non-suppressed subject still references: excluded from any purge plan. */
export function sharedReferences(inventory,index,subjectKey,isSuppressed){
 const shared=[];for(const o of inventory.objects){const others=index.holders(o).filter(k=>k!==subjectKey&&!isSuppressed(k));if(others.length)shared.push(Object.freeze({object:o,heldBy:Object.freeze(others)}));}
 return Object.freeze(shared);
}
export {refKey};
