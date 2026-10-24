/** Data classes and exact reference enumeration over the canonical record snapshot. Pure: no store access. Every retention obligation
 * attached to an exact storage object version is preserved (all classes, every database row that binds it, every database artifact
 * version that shares it), in a deterministic order, so eligibility never depends on which reference was enumerated last and
 * database targets are never conflated with storage objects. The class vocabularies derive from the data-class registry; every row
 * of a row-target class yields an exact row target, so a purge can never report EXECUTED while a retained row stays behind. */
import {own,data,fail,uuid,digest,hash,text,subject} from './boundary.mjs';
import {policyClasses,retainedClasses,rowTargetClasses,rowTargetSubjectKind} from './data-classes.mjs';
import {assertNativeFileState} from '../../../packages/contracts/runtime-0.2/files.mjs';
import {assertNativeSessionCapture} from '../../../packages/contracts/runtime-0.2/session.mjs';
export const classes=policyClasses;
/** Classes the product neither erases nor lets block a purge: identifier-only evidence kept under its own retention rule. */
export const externalClasses=retainedClasses;
/** Classes whose purge is an exact database row deletion by the row owner. */
export const rowClasses=rowTargetClasses;
/** The one subject kind whose database rows each row class may delete: conversation-scoped rows belong to a conversation, artifact
 * version rows to an artifact. A row target of any other kind is a different subject's obligation and must be purged under that subject. */
export const rowClassSubjectKind=rowTargetSubjectKind;
const object=o=>{const v=own(o,['objectId','versionId','sha256'],['bytes','scopes']);
 uuid(v.objectId);text(v.versionId,1024);digest(v.sha256);
 if(v.bytes!==undefined&&(!Number.isSafeInteger(v.bytes)||v.bytes<0))fail('RETENTION_INVALID_REQUEST');
 if(v.scopes!==undefined&&(!Array.isArray(v.scopes)||!v.scopes.length))fail('RETENTION_INVALID_REQUEST');
 return {objectId:v.objectId,versionId:v.versionId,sha256:v.sha256};};
const refKey=o=>`${o.objectId}@${o.versionId}`;
const nativeObjects=files=>{if(!files)return [];const f=assertNativeFileState(files);return [...f.workspace.entries,...f.tasks].map(e=>e.object);};
const sdkTarget=e=>{const v=own(e,['entryId','runId','sessionId','subpath','sequence']);uuid(v.runId);uuid(v.sessionId);text(v.subpath,1024);if(!Number.isSafeInteger(v.sequence)||v.sequence<1)fail('RETENTION_INVALID_REQUEST');return Object.freeze({className:'sdkSession',runId:v.runId,sessionId:v.sessionId,subpath:v.subpath,sequence:v.sequence});};
/** Exact row identity for the classes keyed by one identifier (sdkSession and artifactVersions keep their established shapes). */
const keyTarget=(className,key)=>Object.freeze({className,key:uuid(key)});
const refusal=()=>fail('RETENTION_INVALID_REQUEST');
const sourceFields=['subject','conversation','runs','eventRows','artifactVersionRefs','controls',
 'checkpoints','completionCheckpoints','nextRuns','memoryContinuations','objectVersions'];
const requireList=value=>{if(!Array.isArray(value)||value.length>65536)refusal();return value;};
/** The conversation source owns all these arrays in one repeatable-read snapshot.
 * Its digest never covers independently owned artifact, SDK or budget facts. */
function conversationEvidence(s){
 subject(s.subject);text(s.subject.ownerActorId);
 const c=own(s.conversation,['conversationId','projectionSha256']);
 if(uuid(c.conversationId)!==s.subject.subjectId)refusal();digest(c.projectionSha256);
 const runIds=new Map(),eventCounts=new Map(),eventIds=new Map(),controls=new Map(),controlSequences=new Set();
 for(const r of requireList(s.runs)){
  const row=own(r,['runId','continuation','lastSequence'],['projectionSha256','requestSha256','sequenceBase','sequenceEnd']);
  uuid(row.runId);if(runIds.has(row.runId)||!Number.isSafeInteger(row.lastSequence)||row.lastSequence<1||row.lastSequence>65536)refusal();
  runIds.set(row.runId,row);
 }
 if(!runIds.size)refusal();
 const events=[];
 for(const e of requireList(s.eventRows)){
  const row=own(e,['runId','sequence','eventId','eventSha256']);uuid(row.runId);uuid(row.eventId);digest(row.eventSha256);
  if(!runIds.has(row.runId)||!Number.isSafeInteger(row.sequence)||row.sequence<1)refusal();
  const count=eventCounts.get(row.runId)??new Map(),ids=eventIds.get(row.runId)??new Set();
  if(count.has(row.sequence)||ids.has(row.eventId))refusal();
  count.set(row.sequence,row.eventId);ids.add(row.eventId);eventCounts.set(row.runId,count);eventIds.set(row.runId,ids);
  events.push(Object.freeze({className:'events',table:'events',...row}));
 }
 for(const [runId,run] of runIds){const count=eventCounts.get(runId);
  if(count?.size!==run.lastSequence)refusal();for(let n=1;n<=run.lastSequence;n++)if(!count.has(n))refusal();}
 const controlTargets=[];
 for(const c of requireList(s.controls)){
  const row=own(c,['controlId','runId','controlSequence','projectionSha256'],['nativeFiles']);
  if(row.nativeFiles)assertNativeFileState(row.nativeFiles);
  uuid(row.controlId);uuid(row.runId);digest(row.projectionSha256);
  const sequenceKey=`${row.runId}:${row.controlSequence}`;
  if(!runIds.has(row.runId)||!Number.isSafeInteger(row.controlSequence)||row.controlSequence<1||controls.has(row.controlId)||
     controlSequences.has(sequenceKey))refusal();
  controls.set(row.controlId,row);controlSequences.add(sequenceKey);
  const {nativeFiles,...target}=row;controlTargets.push(Object.freeze({className:'conversation',table:'controls',...target}));
 }
 const hasSourcePin=s.inventorySha256!==undefined||s.artifactVersionRefs!==undefined||s.objectVersions!==undefined;
 if(hasSourcePin){
  digest(s.inventorySha256);requireList(s.artifactVersionRefs);requireList(s.objectVersions);
  const owner=Object.fromEntries(sourceFields.map(field=>[field,s[field]]));
  if(hash(owner)!==s.inventorySha256)refusal();
  const eventKeys=new Set(events.map(e=>`${e.runId}:${e.sequence}:${e.eventId}`)),references=new Set();
  for(const raw of s.artifactVersionRefs){const ref=own(raw,['runId','sequence','eventId','artifactId','versionId']);
   uuid(ref.runId);uuid(ref.eventId);uuid(ref.artifactId);text(ref.versionId,1024);
   const key=`${ref.runId}:${ref.sequence}:${ref.eventId}`;
   if(!eventKeys.has(key)||references.has(key))refusal();references.add(key);}
 }
 return {runIds,events,controls,controlTargets,sourceSha256:hasSourcePin?s.inventorySha256:null};
}
/** Snapshot shape (produced by the owning journals, validated here). Storage objects come from checkpoint proofs, selected outputs,
 * artifact versions and uploads; database row targets come from every row-target class. Explicit conversation event/control rows
 * are required for conversation subjects and refused for artifact subjects. A planned class (editor drafts) has no owner yet and
 * is refused rather than silently ignored. */
export function enumerateReferences(snapshot){
 const s=own(data(snapshot),['subject','runs','checkpoints','completionCheckpoints','nextRuns','sdkSessionEntries','selectedOutputs','artifactVersions','nativeJournalRows','memoryContinuations','uploads'],['schedules','receipts','memoryProposals','budgetRuns','editorDrafts','conversation','eventRows','controls','artifactVersionRefs','objectVersions','inventorySha256']);
 subject(s.subject);
 const list=v=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>65536)fail('RETENTION_INVALID_REQUEST');return v;};
 if(list(s.editorDrafts).length)fail('RETENTION_CLASS_PLANNED');
 const rows=[],objects=new Map(),rowTargets=[],conversation=s.subject?.kind==='conversation',
  owner=conversation?conversationEvidence(s):null,ownerObjects=[],unpublishedCompletionCheckpoints=[];
 if(!conversation&&(s.conversation!=null||list(s.eventRows).length||list(s.controls).length||
   s.inventorySha256!==undefined||s.artifactVersionRefs!==undefined||s.objectVersions!==undefined))refusal();
 const add=(className,key,refs,{artifactVersionId}={})=>{const validated=refs.map(object);
  for(const o of validated){const k=refKey(o),held=objects.get(k);const entry=held??{objectId:o.objectId,versionId:o.versionId,sha256:o.sha256,classes:new Set(),artifactVersionIds:new Set()};if(held&&held.sha256!==o.sha256)fail('RETENTION_INVALID_REQUEST');entry.classes.add(className);if(artifactVersionId)entry.artifactVersionIds.add(artifactVersionId);objects.set(k,entry);}
  rows.push(Object.freeze({className,key,objects:Object.freeze(validated)}));};
 const keyed=(className,key,refs)=>{rowTargets.push(keyTarget(className,key));add(className,key,refs);};
 if(conversation)keyed('conversation',s.subject.subjectId,[]);
 for(const r of list(s.runs)){const refs=r.continuation?.checkpoint?[r.continuation.checkpoint.opaqueSession,...r.continuation.checkpoint.workspace.entries.map(e=>e.object)]:nativeObjects(r.continuation?.files);
  if(conversation)ownerObjects.push(...refs);keyed('conversation',r.runId,refs);}
 if(conversation){for(const target of owner.controlTargets){rowTargets.push(target);add('conversation',`control:${target.controlId}`,[]);}}
 if(conversation)for(const control of owner.controls.values())if(control.nativeFiles){const refs=nativeObjects(control.nativeFiles);ownerObjects.push(...refs);add('lifecycle',`native-control:${control.controlId}`,refs);}
 // Each local proposal continuation is a distinct conversation row, not an
 // external Core memory proposal. A purge owner must consume this exact target
 // before a conversation plan may report deletion complete.
 for(const value of list(s.memoryContinuations)){
  const row=own(value,['runId','keySha256']);uuid(row.runId);digest(row.keySha256);
  if(conversation&&!owner.runIds.has(row.runId))refusal();
  rowTargets.push(Object.freeze({className:'conversation',table:'memory_proposal_contexts',
   runId:row.runId,keySha256:row.keySha256}));
  add('conversation',`memory-proposal:${row.runId}:${row.keySha256}`,[]);
 }
 if(conversation)for(const target of owner.events){rowTargets.push(target);add('events',`${target.runId}:${target.sequence}`,[]);}
 for(const c of list(s.checkpoints)){
  if(conversation){const row=own(c,['checkpointId','runId','controlId','checkpoint']);
   uuid(row.checkpointId);uuid(row.runId);uuid(row.controlId);
   if(!owner.runIds.has(row.runId)||owner.controls.get(row.controlId)?.runId!==row.runId)refusal();}
  const refs=[c.checkpoint.opaqueSession,...c.checkpoint.workspace.entries.map(e=>e.object)];
  if(conversation)ownerObjects.push(...refs);keyed('lifecycle',c.checkpointId,refs);
 }
 const completionIds=new Set(),completionRuns=new Set();
 for(const c of list(s.completionCheckpoints)){
  if(conversation){const row=own(c,['checkpointId','runId','state','checkpoint'],['nativeCapture']);uuid(row.checkpointId);uuid(row.runId);
   if(row.nativeCapture){const p=assertNativeSessionCapture(row.nativeCapture);if(!p.files||p.checkpointId!==row.checkpointId||p.sdkSession.binding.runId!==row.runId||row.checkpoint!==null)refusal();}
   if(!owner.runIds.has(row.runId)||!['CAPTURING','UNKNOWN','PUBLISHED'].includes(row.state)||
      (row.state==='PUBLISHED'?row.checkpoint==null&&!row.nativeCapture:row.checkpoint!==null||row.nativeCapture!==undefined)||completionIds.has(row.checkpointId)||
      completionRuns.has(row.runId))refusal();
   completionIds.add(row.checkpointId);completionRuns.add(row.runId);
   const target=Object.freeze({className:'completionCheckpoints',checkpointId:row.checkpointId,runId:row.runId,state:row.state});
   rowTargets.push(target);if(row.state!=='PUBLISHED')unpublishedCompletionCheckpoints.push(target);
   const refs=row.checkpoint?[row.checkpoint.opaqueSession,...row.checkpoint.workspace.entries.map(e=>e.object)]:nativeObjects(row.nativeCapture?.files);
   ownerObjects.push(...refs);add('completionCheckpoints',row.checkpointId,refs);
  }else keyed('completionCheckpoints',c.checkpointId,[c.checkpoint.opaqueSession,...c.checkpoint.workspace.entries.map(e=>e.object)]);
 }
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
 if(owner?.sourceSha256){const expected=new Map();for(const raw of ownerObjects){const ref=object(raw),key=refKey(ref);
   if(expected.has(key)&&expected.get(key).sha256!==ref.sha256)refusal();expected.set(key,ref);}
  const claimed=new Map();for(const raw of s.objectVersions){const ref=object(raw),key=refKey(ref);
   if(claimed.has(key))refusal();claimed.set(key,ref);}
  const ordered=values=>[...values].sort((a,b)=>refKey(a).localeCompare(refKey(b)));
  if(hash(ordered(expected.values()))!==hash(ordered(claimed.values())))refusal();}
 const distinct=[...objects.values()].map(o=>Object.freeze({objectId:o.objectId,versionId:o.versionId,sha256:o.sha256,classes:Object.freeze(classes.filter(c=>o.classes.has(c))),artifactVersionIds:Object.freeze([...o.artifactVersionIds].sort())})).sort((a,b)=>refKey(a).localeCompare(refKey(b)));
 const targets=Object.freeze(rowTargets.slice().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const unresolved=Object.freeze(unpublishedCompletionCheckpoints.sort((a,b)=>a.checkpointId.localeCompare(b.checkpointId)));
 return Object.freeze({subject:s.subject,rows:Object.freeze(rows),objects:Object.freeze(distinct),rowTargets:targets,
  unpublishedCompletionCheckpoints:unresolved,conversationSourceSha256:owner?.sourceSha256??null,
  inventorySha256:hash({subject:s.subject,conversationSourceSha256:owner?.sourceSha256??null,
   objects:distinct.map(o=>({ref:refKey(o),classes:o.classes,artifactVersionIds:o.artifactVersionIds})),rowTargets:targets,
   unpublishedCompletionCheckpoints:unresolved})});
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
