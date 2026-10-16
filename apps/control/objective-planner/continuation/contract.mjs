/** Fixed Core19ac contract conventions, not a public/frozen wire registration. No authorization is conferred by data/hash checks. */
import {createHash} from 'node:crypto';
import {own,data,canonical,uuid,digest,integer,instant,text,fail} from '../identity.mjs';
import {materializationObservation} from '../core-receipts.mjs';
export {own,data,fail};
export const OPERATION='objective.plan.prepare',APPLICATIONS_PATH='/internal/objective-canonical/planner-applications';
export function coreDigest(value){
 const json=v=>Array.isArray(v)?'['+v.map(json).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+json(v[k])).join(',')+'}':JSON.stringify(v);
 return createHash('sha256').update(json(data(value)),'utf8').digest('hex');
}
const same=(a,b)=>coreDigest(a)===coreDigest(b);
export function applicationRequestId(token,actorUserId){canonical(token);uuid(actorUserId);const h=coreDigest({namespace:'capiro.objective-plan.application:v1',canonical:token,actorUserId});return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
export function continuationWork(value){
 const w=data(own(value,['canonical','actorUserId','consentId','controlVersion','generationJobId','generationRequestId','strategyId','strategyVersionId','objectiveReceiptSha256','snapshotDigest','applicationRequestId']));canonical(w.canonical);integer(w.controlVersion);
 for(const k of ['actorUserId','consentId','generationJobId','generationRequestId','strategyId','strategyVersionId','applicationRequestId'])uuid(w[k]);digest(w.objectiveReceiptSha256);digest(w.snapshotDigest);
 if(w.strategyId!==w.canonical.canonicalStrategyId||w.applicationRequestId!==applicationRequestId(w.canonical,w.actorUserId))fail('WORK_CONFLICT');return w;
}
export function continuationWorkflowId(value){const w=continuationWork(value);return 'meri:objective-planner:'+coreDigest({canonical:w.canonical,actorUserId:w.actorUserId,consentId:w.consentId,controlVersion:w.controlVersion});}
export function corePlannerRequest(value){const w=continuationWork(value);return data({schemaVersion:1,canonical:w.canonical,applicationRequestId:w.applicationRequestId,generationJobId:w.generationJobId,generationRequestId:w.generationRequestId,strategyId:w.strategyId,strategyVersionId:w.strategyVersionId,objectiveReceiptSha256:w.objectiveReceiptSha256,snapshotDigest:w.snapshotDigest});}
export const corePlannerRequestSha256=value=>coreDigest(corePlannerRequest(value));
export function materializationSource(value){const w=continuationWork(value),c=w.canonical;return data({generationJobId:w.generationJobId,generationRequestId:w.generationRequestId,clientId:c.clientId,objectiveId:c.objectiveId,objectiveVersion:c.requestedObjectiveVersion,objectiveRevisionId:c.requestedObjectiveRevisionId,strategyId:w.strategyId,strategyVersionId:w.strategyVersionId,snapshotDigest:w.snapshotDigest});}
function strings(v,validate=text){if(!Array.isArray(v))fail('INVALID_RECEIPT');v.forEach(validate);if(new Set(v).size!==v.length)fail('INVALID_RECEIPT');}
export function creationObservation(raw,value){
 const w=continuationWork(value),r=data(own(raw,['schemaVersion','applicationRequestId','creation','current']));if(r.schemaVersion!==1||r.applicationRequestId!==w.applicationRequestId)fail('INVALID_RECEIPT');
 const current=materializationObservation(r.current,{requestId:w.applicationRequestId,source:materializationSource(w)}),p=own(r.creation,['availability','ack','sha256']);
 // Core's canonical frozen tuple is stricter than the retained legacy projection decoder.
 for(const {output:o} of [...current.projects,...current.tasks])if(o.availability==='unavailable'?o.id!==null||o.currentVersion!==null:o.id===null||o.currentVersion===null)fail('INVALID_RECEIPT');
 if(p.availability==='unavailable'){if(p.ack!==null||p.sha256!==null)fail('INVALID_RECEIPT');return data({kind:'unavailable'});}
 if(p.availability!=='available'||digest(p.sha256)!==coreDigest(p.ack))fail('INVALID_RECEIPT');
 const a=own(p.ack,['schemaVersion','operation','applicationRequestId','requestSha256','canonical','actorUserId','consentId','controlVersion','source','objectiveReceiptSha256','ownerReceiptId','ownerReceiptSha256','recordedAt','outcome','projects','tasks']);
 if(a.schemaVersion!==1||a.operation!==OPERATION||a.applicationRequestId!==w.applicationRequestId||a.requestSha256!==corePlannerRequestSha256(w)||!same(a.canonical,w.canonical)||a.actorUserId!==w.actorUserId||a.consentId!==w.consentId||a.controlVersion!==w.controlVersion||!same(a.source,materializationSource(w))||a.objectiveReceiptSha256!==w.objectiveReceiptSha256||!['applied','applied_with_issues'].includes(a.outcome))fail('INVALID_RECEIPT');
 uuid(a.ownerReceiptId);digest(a.ownerReceiptSha256);instant(a.recordedAt);
 if(!Array.isArray(a.projects)||a.projects.length!==1||!Array.isArray(a.tasks)||a.tasks.length!==current.tasks.length)fail('INVALID_RECEIPT');
 const outputs=new Set(),nodes=new Set();
 for(const [i,p] of a.projects.entries()){own(p,['groupKey','projectId','createdVersion','originalNodeIds']);uuid(p.projectId);strings(p.originalNodeIds,uuid);const c=current.projects[i];if(p.groupKey!=='default'||p.projectId!==w.canonical.canonicalProjectId||p.createdVersion!==1||!c||c.groupKey!==p.groupKey||c.output.id!==p.projectId||c.output.createdVersion!==p.createdVersion||!same(c.originalNodeIds,p.originalNodeIds))fail('INVALID_RECEIPT');outputs.add(p.projectId);}
 for(const [i,t] of a.tasks.entries()){own(t,['sourceNodeId','taskId','createdVersion','originalGroupKeys']);uuid(t.sourceNodeId);uuid(t.taskId);strings(t.originalGroupKeys);const c=current.tasks[i];if(t.createdVersion!==1||nodes.has(t.sourceNodeId)||outputs.has(t.taskId)||!c||c.sourceNodeId!==t.sourceNodeId||c.output.id!==t.taskId||c.output.createdVersion!==t.createdVersion||!same(c.originalGroupKeys,t.originalGroupKeys))fail('INVALID_RECEIPT');nodes.add(t.sourceNodeId);outputs.add(t.taskId);}
 if(current.projects.length!==1||!same(a.projects[0].originalNodeIds,a.tasks.map(t=>t.sourceNodeId)))fail('INVALID_RECEIPT');
 // Store references/creation IDs only. Current edit/version fields never become immutable custody or overwrite ACK identity.
 return data({kind:'ack',ack:{applicationRequestId:a.applicationRequestId,creationAckSha256:p.sha256,ownerReceiptId:a.ownerReceiptId,ownerReceiptSha256:a.ownerReceiptSha256,projects:a.projects,tasks:a.tasks}});
}
