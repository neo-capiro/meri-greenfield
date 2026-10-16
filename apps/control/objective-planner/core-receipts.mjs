/** Decode existing Core622 ObjectiveReceipt/MaterializationResult. Data correlation never authenticates an owner or publishes IDs. */
import {own,data,hash,same,fail,uuid,digest,integer,instant,text,canonical,work,expectedSource} from './identity.mjs';
export function strategyApplication({receipt,status,canonical:rawCanonical}){
 const c=canonical(rawCanonical),r=data(own(receipt,['schemaVersion','requestId','source','context','result','failure']));
 if(status!=='completed'||r.schemaVersion!==1||r.failure!==null)fail('STRATEGY_NOT_APPLIED');uuid(r.requestId);
 const s=own(r.source,['clientId','objectiveId','objectiveVersion','objectiveRevisionId']);
 if(!same(s,{clientId:c.clientId,objectiveId:c.objectiveId,objectiveVersion:c.requestedObjectiveVersion,objectiveRevisionId:c.requestedObjectiveRevisionId}))fail('SOURCE_STALE');
 const context=own(r.context,['reobservedAt','state','packetId','compiledAt','sourceDigest','coverageDigest','inputDigest','issues']);
 if(context.state!=='complete'||!Array.isArray(context.issues)||context.issues.length)fail('STRATEGY_NOT_APPLIED');
 instant(context.reobservedAt);instant(context.compiledAt);text(context.packetId);for(const k of ['sourceDigest','coverageDigest','inputDigest'])digest(context[k]);
 const out=own(r.result,['strategyId','strategyVersionId','savedAt','sourceDigest','contextPacketId','coverageDigest','inputDigest']);uuid(out.strategyId);uuid(out.strategyVersionId);instant(out.savedAt);
 if(out.sourceDigest!==context.sourceDigest||out.contextPacketId!==context.packetId||out.coverageDigest!==context.coverageDigest||out.inputDigest!==context.inputDigest)fail('INVALID_RECEIPT');
 return data({generationRequestId:r.requestId,strategyId:out.strategyId,strategyVersionId:out.strategyVersionId,strategyReceiptSha256:hash(r)});
}
function strings(v,check=text){if(!Array.isArray(v))fail('INVALID_RECEIPT');v.forEach(check);if(new Set(v).size!==v.length)fail('INVALID_RECEIPT');return v;}
function output(value){const o=own(value,['availability','id','createdVersion','currentVersion']);
 if(!['available','archived','unavailable'].includes(o.availability))fail('INVALID_RECEIPT');integer(o.createdVersion);if(o.currentVersion!==null)integer(o.currentVersion);
 if(o.id!==null)uuid(o.id);if(o.availability==='available'&&(o.id===null||o.currentVersion===null))fail('INVALID_RECEIPT');return o;
}
/** Mutable current read projection, never the stored creation receipt or its immutable custody hash. */
export function plannerObservation(raw,value){
 const w=work(value);return materializationObservation(raw,{requestId:w.plannerRequestId,source:expectedSource(w)});
}
/** Legacy browser materialization: every projected output was created by this request. */
export function materializationObservation(raw,expected){
 return decodeMaterialization(raw,expected,false);
}
/** Canonical regeneration reuses existing outputs; creation counts report only actual new rows. */
export function canonicalMaterializationObservation(raw,expected){
 return decodeMaterialization(raw,expected,true);
}
function decodeMaterialization(raw,expected,reusesOutputs){
 const e=data(own(expected,['requestId','source'])),r=data(own(raw,['requestId','status','replayed','recordedAt','observedAt','source','projects','tasks','context','edges','exclusions','issues','counts']));
 if(r.requestId!==e.requestId||!['prepared','prepared_with_issues','partial'].includes(r.status)||typeof r.replayed!=='boolean')fail('INVALID_RECEIPT');instant(r.recordedAt);instant(r.observedAt);
 own(r.source,['generationJobId','generationRequestId','clientId','objectiveId','objectiveVersion','objectiveRevisionId','strategyId','strategyVersionId','snapshotDigest']);
 if(!same(r.source,e.source))fail('SOURCE_STALE');
 if(!Array.isArray(r.projects)||!Array.isArray(r.tasks)||!Array.isArray(r.context)||!Array.isArray(r.edges)||!Array.isArray(r.exclusions)||!Array.isArray(r.issues))fail('INVALID_RECEIPT');
 const groups=new Set(),nodes=new Set(),outputs=new Set();
 for(const p of r.projects){own(p,['groupKey','name','originalNodeIds','output']);text(p.groupKey);text(p.name);strings(p.originalNodeIds,uuid);if(groups.has(p.groupKey))fail('INVALID_RECEIPT');groups.add(p.groupKey);output(p.output);if(p.output.id!==null){if(outputs.has(p.output.id))fail('INVALID_RECEIPT');outputs.add(p.output.id);}}
 for(const t of r.tasks){own(t,['sourceNodeId','originalGroupKeys','currentGroupKeys','output']);uuid(t.sourceNodeId);if(nodes.has(t.sourceNodeId))fail('INVALID_RECEIPT');nodes.add(t.sourceNodeId);strings(t.originalGroupKeys);strings(t.currentGroupKeys);output(t.output);if(t.output.id!==null){if(outputs.has(t.output.id))fail('INVALID_RECEIPT');outputs.add(t.output.id);}}
 for(const n of r.context){own(n,['sourceNodeId','kind','title','note','dependsOnSourceNodeIds']);uuid(n.sourceNodeId);text(n.kind);text(n.title);if(n.note!==null&&typeof n.note!=='string')fail('INVALID_RECEIPT');strings(n.dependsOnSourceNodeIds,uuid);if(nodes.has(n.sourceNodeId))fail('INVALID_RECEIPT');nodes.add(n.sourceNodeId);}
 for(const e of r.exclusions){own(e,['sourceNodeId','reason']);uuid(e.sourceNodeId);if(e.reason!=='ARCHIVED_SOURCE_NODE'||nodes.has(e.sourceNodeId))fail('INVALID_RECEIPT');nodes.add(e.sourceNodeId);}
 for(const e of r.edges){own(e,['sourceNodeId','dependsOnSourceNodeId','disposition']);uuid(e.sourceNodeId);uuid(e.dependsOnSourceNodeId);if(!nodes.has(e.sourceNodeId)||!nodes.has(e.dependsOnSourceNodeId)||!['task_dependency','context_only','archived_source'].includes(e.disposition))fail('INVALID_RECEIPT');}
 for(const i of r.issues){own(i,['code','sourceNodeIds','message']);text(i.code);text(i.message);strings(i.sourceNodeIds,uuid);}
 const counts=own(r.counts,['savedNodes','actionableNodes','contextNodes','archivedNodes','createdProjects','createdTasks']);
 if(Object.values(counts).some(n=>!Number.isSafeInteger(n)||n<0)||(reusesOutputs?counts.createdProjects>r.projects.length||counts.createdTasks>r.tasks.length:counts.createdProjects!==r.projects.length||counts.createdTasks!==r.tasks.length)||counts.actionableNodes!==r.tasks.length||counts.contextNodes!==r.context.length||counts.archivedNodes!==r.exclusions.length||counts.savedNodes!==nodes.size)fail('INVALID_RECEIPT');
 // Current groups/version/availability may change after application. Never overwrite human edits or recreate missing outputs.
 return r;
}
