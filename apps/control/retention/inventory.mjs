/** Data classes and exact reference enumeration over the canonical record snapshot. Pure: no store access. Every retention obligation
 * attached to an exact storage object version is preserved (all classes, every database row that binds it, every database artifact
 * version that shares it), in a deterministic order, so eligibility never depends on which reference was enumerated last and
 * database targets are never conflated with storage objects. The class vocabularies derive from the data-class registry; every row
 * of a row-target class yields an exact row target, so a purge can never report EXECUTED while a retained row stays behind. */
import {own,data,fail,uuid,digest,hash,text} from './boundary.mjs';
import {policyClasses,retainedClasses,rowTargetClasses,rowTargetSubjectKind} from './data-classes.mjs';
export const classes=policyClasses;
/** Classes the product neither erases nor lets block a purge: identifier-only evidence kept under its own retention rule. */
export const externalClasses=retainedClasses;
/** Classes whose purge is an exact database row deletion by the row owner. */
export const rowClasses=rowTargetClasses;
/** The one subject kind whose database rows each row class may delete: conversation-scoped rows belong to a conversation, artifact
 * version rows to an artifact. A row target of any other kind is a different subject's obligation and must be purged under that subject. */
export const rowClassSubjectKind=rowTargetSubjectKind;
const object=o=>{const v=own(o,['objectId','versionId','sha256']);uuid(v.objectId);text(v.versionId,1024);digest(v.sha256);return v;};
const refKey=o=>`${o.objectId}@${o.versionId}`;
const sdkTarget=e=>{const v=own(e,['entryId','runId','sessionId','subpath','sequence']);uuid(v.runId);uuid(v.sessionId);text(v.subpath,1024);if(!Number.isSafeInteger(v.sequence)||v.sequence<1)fail('RETENTION_INVALID_REQUEST');return Object.freeze({className:'sdkSession',runId:v.runId,sessionId:v.sessionId,subpath:v.subpath,sequence:v.sequence});};
/** Exact row identity for the classes keyed by one identifier (sdkSession and artifactVersions keep their established shapes). */
const keyTarget=(className,key)=>Object.freeze({className,key:uuid(key)});
/** Snapshot shape (produced by the owning journals, validated here). Storage objects come from checkpoint proofs, selected outputs,
 * artifact versions and uploads; database row targets come from every row-target class. Conversation-scoped classes (the subject
 * row, events) are enumerated only for a conversation subject; rows a snapshot carries for another kind stay targets and block the
 * plan as a subject mismatch. A planned class (editor drafts) has no owner yet and is refused rather than silently ignored. */
export function enumerateReferences(snapshot){
 const s=own(data(snapshot),['subject','runs','checkpoints','completionCheckpoints','nextRuns','sdkSessionEntries','selectedOutputs','artifactVersions','nativeJournalRows','uploads'],['schedules','receipts','memoryProposals','budgetRuns','editorDrafts']);
 const list=v=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>65536)fail('RETENTION_INVALID_REQUEST');return v;};
 if(list(s.editorDrafts).length)fail('RETENTION_CLASS_PLANNED');
 const rows=[],objects=new Map(),rowTargets=[],conversation=s.subject?.kind==='conversation';
 const add=(className,key,refs,{artifactVersionId}={})=>{const validated=refs.map(object);
  for(const o of validated){const k=refKey(o),held=objects.get(k);const entry=held??{objectId:o.objectId,versionId:o.versionId,sha256:o.sha256,classes:new Set(),artifactVersionIds:new Set()};if(held&&held.sha256!==o.sha256)fail('RETENTION_INVALID_REQUEST');entry.classes.add(className);if(artifactVersionId)entry.artifactVersionIds.add(artifactVersionId);objects.set(k,entry);}
  rows.push(Object.freeze({className,key,objects:Object.freeze(validated)}));};
 const keyed=(className,key,refs)=>{rowTargets.push(keyTarget(className,key));add(className,key,refs);};
 if(conversation)keyed('conversation',s.subject.subjectId,[]);
 for(const r of list(s.runs))keyed('conversation',r.runId,r.continuation?.checkpoint?[r.continuation.checkpoint.opaqueSession,...r.continuation.checkpoint.workspace.entries.map(e=>e.object)]:[]);
 if(conversation)keyed('events',s.subject.subjectId,[]);
 for(const c of list(s.checkpoints))keyed('lifecycle',c.checkpointId,[c.checkpoint.opaqueSession,...c.checkpoint.workspace.entries.map(e=>e.object)]);
 for(const c of list(s.completionCheckpoints))keyed('completionCheckpoints',c.checkpointId,[c.checkpoint.opaqueSession,...c.checkpoint.workspace.entries.map(e=>e.object)]);
 for(const n of list(s.nextRuns))keyed('nextRuns',n.targetRunId,[]);
 for(const e of list(s.sdkSessionEntries)){const t=sdkTarget(e);rowTargets.push(t);add('sdkSession',e.entryId,[]);}
 for(const o of list(s.selectedOutputs))keyed('selectedOutputs',o.outputId,o.object?[o.object]:[]);
 for(const v of list(s.artifactVersions)){uuid(v.versionId);rowTargets.push(Object.freeze({className:'artifactVersions',artifactVersionId:v.versionId}));add('artifactVersions',v.versionId,[v.object],{artifactVersionId:v.versionId});}
 for(const n of list(s.nativeJournalRows))keyed('nativeJournals',n.runId,[]);
 for(const u of list(s.uploads))add('uploads',u.uploadId,[u.object]);
 for(const r of list(s.schedules))keyed('schedules',r.scheduleId,[]);
 for(const r of list(s.receipts))keyed('receipts',r.receiptId,[]);
 for(const m of list(s.memoryProposals))add('memoryProposals',uuid(m.candidateId),[]);
 for(const b of list(s.budgetRuns))add('budgets',uuid(b.runId),[]);
 add('logs',s.subject.subjectId,[]);add('telemetry',s.subject.subjectId,[]);
 const distinct=[...objects.values()].map(o=>Object.freeze({objectId:o.objectId,versionId:o.versionId,sha256:o.sha256,classes:Object.freeze(classes.filter(c=>o.classes.has(c))),artifactVersionIds:Object.freeze([...o.artifactVersionIds].sort())})).sort((a,b)=>refKey(a).localeCompare(refKey(b)));
 const targets=Object.freeze(rowTargets.slice().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 return Object.freeze({subject:s.subject,rows:Object.freeze(rows),objects:Object.freeze(distinct),rowTargets:targets,inventorySha256:hash({subject:s.subject,objects:distinct.map(o=>({ref:refKey(o),classes:o.classes,artifactVersionIds:o.artifactVersionIds})),rowTargets:targets})});
}
/** Cross-subject index: which other subjects still reference each exact version (a fork copies checkpoint references into its own conversation). */
export function createReferenceIndex(){
 const byVersion=new Map();
 return Object.freeze({
  record(subjectKey,inventory){for(const o of inventory.objects){const k=refKey(o);if(!byVersion.has(k))byVersion.set(k,new Set());byVersion.get(k).add(subjectKey);}},
  holders(o){return [...(byVersion.get(refKey(o))??[])].sort();}
 });
}
/** Versions of this subject that another holder still binds: a version may be purged only when every other holder is itself purge-eligible
 * under its own obligations (suppressed, cooling and retention elapsed, no hold, not released). `holderEligibility(key)` is the port that
 * answers that for each holder; a missing or failing answer blocks. */
export function sharedReferences(inventory,index,subjectKey,holderEligibility){
 if(typeof holderEligibility!=='function')fail('RETENTION_INVALID_REQUEST');const shared=[];
 for(const o of inventory.objects){const others=index.holders(o).filter(k=>k!==subjectKey);if(!others.length)continue;
  const blocking=[];for(const k of others){let e;try{e=holderEligibility(k);}catch{e=null;}if(!e||e.eligible!==true)blocking.push({holder:k,reasons:Object.freeze([...(e?.reasons??['HOLDER_AUTHORITY_UNAVAILABLE'])])});}
  if(blocking.length)shared.push(Object.freeze({object:o,heldBy:Object.freeze(others),blocking:Object.freeze(blocking)}));}
 return Object.freeze(shared);
}
export {refKey};
