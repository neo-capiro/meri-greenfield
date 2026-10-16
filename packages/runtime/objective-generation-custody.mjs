/** Private one-shot completion witness. These inert checks confer no source, SDK or read authority. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data} from '../contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape,assertWorkspacePaths} from '../contracts/validate.mjs';
import {coreApplicationSha256} from './core-application-digest.mjs';
import {objectiveDescriptorProtocol,objectiveRequestProtocol,OBJECTIVE_DRAFT_PROTOCOL} from './objective-strategy-protocol.mjs';
export {own,data,hash};
export const OBJECTIVE_DRAFT_PATH=OBJECTIVE_DRAFT_PROTOCOL.path;
export const MAX_TYPED_RESULT_BYTES=2097152;
// The journal retains the accepted request and execution context together. Keep this
// bound shared with pre-query admission so a valid query cannot finish unjournalable.
export const MAX_OBJECTIVE_SELECTION_BYTES=1048576;
export const typedFault=()=>Error('OBJECTIVE_TYPED_RESULT_REFUSED');
const refuse=()=>{throw typedFault();};
const boundedSelection=value=>{if(Buffer.byteLength(JSON.stringify(value),'utf8')>MAX_OBJECTIVE_SELECTION_BYTES)refuse();return value;};
const digest=v=>{if(typeof v!=='string'||v.length!==64||!/^[a-f0-9]{64}$/u.test(v))refuse();return v;};
const uuid=v=>{if(typeof v!=='string'||v.length!==36||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v))refuse();return v;};
export const rawTypedSha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function assertObjectiveExecutionContext(value,{request,acceptedRequest}){
 const c=data(own(value,['schemaVersion','prompt','promptSha256','ownerRefs','contextPacketId']));
 if(c.schemaVersion!==1||typeof c.prompt!=='string'||c.prompt!==acceptedRequest.prompt||rawTypedSha256(Buffer.from(c.prompt,'utf8'))!==c.promptSha256||c.contextPacketId!==request.context.packetId||!Array.isArray(c.ownerRefs)||c.ownerRefs.length!==request.context.ownerRefs.length)refuse();
 const refs=new Set();for(const p of c.ownerRefs){own(p,['ownerRef','clerkUserId']);if(typeof p.ownerRef!=='string'||typeof p.clerkUserId!=='string'||!p.clerkUserId||refs.has(p.ownerRef)||!request.context.ownerRefs.includes(p.ownerRef))refuse();refs.add(p.ownerRef);}return c;
}
/** Existing native completion identity, shared with its one result; no second identity/journal. */
export function objectiveCompletionId(binding){validateShape('RunBinding',binding);const h=hash({binding,kind:'completion'});return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
/** Core's finite sorted-key JSON convention is distinct from the Meri JCS whole-facts/request domains. */
export const sourceAdmissionDigest=coreApplicationSha256;
/** Compare issued facts supplied by their real owner. Hash checks alone never authenticate that owner. Historical validation does not renew expiry. */
export function issuedObjectiveSelection(value,{binding,acceptedRequest}){
 const entry=data(value),{issuance,factsSha256,...facts}=entry;validateShape('RunBinding',binding);
 if(!issuance||hash(issuance.binding)!==hash(binding)||issuance.requestSha256!==hash(acceptedRequest)||issuance.factsSha256!==factsSha256||hash(facts)!==factsSha256||hash(facts.original.binding)!==hash(binding)||facts.original.expiresAtMs!==issuance.expiresAtMs)refuse();
 return assertPreparedObjectiveSelection({objectiveGeneration:facts.objectiveGeneration,objectiveStrategy:facts.objectiveStrategy},{binding,acceptedRequest,expiresAtMs:issuance.expiresAtMs});
}
/** Pre-bind data checks over the real accepted request. No receipt is fabricated. The canonical candidate still owns full schema/graph validation. */
export function assertPreparedObjectiveSelection(value,{binding,acceptedRequest,expiresAtMs,nowMs}){
 validateShape('RunBinding',binding);const pair=data(own(value,['objectiveGeneration','objectiveStrategy']));
 const g=own(pair.objectiveGeneration,['sourceAdmission','sourceAdmissionSha256']),a=own(g.sourceAdmission,['schemaVersion','namespace','canonical','actorUserId','clerkUserId','consentId','controlVersion','generationJobId','generationRequestId','admittedAtMs','effectExpiresAtMs','expectedStrategyVersionId']),s=data(own(pair.objectiveStrategy,['schemaVersion','operation','request','requestSha256','executionContext','queuedType','executionSelection']));
 const c=own(a.canonical,['canonicalPlanId','tenantId','clientId','objectiveId','canonicalStrategyId','canonicalProjectId','bindingVersion','epoch','requestedIntentId','requestedObjectiveRevisionId','requestedObjectiveVersion','snapshotHash']);
 for(const key of ['canonicalPlanId','tenantId','clientId','objectiveId','canonicalStrategyId','canonicalProjectId','requestedIntentId','requestedObjectiveRevisionId'])uuid(c[key]);digest(c.snapshotHash);
 for(const n of [c.bindingVersion,c.requestedObjectiveVersion,a.controlVersion])if(!Number.isInteger(n)||n<1||n>2147483647)refuse();
 for(const key of ['actorUserId','consentId','generationJobId','generationRequestId'])uuid(a[key]);
 const r=s.request;if(a.schemaVersion!==1||a.namespace!=='capiro.objective-strategy.admission:v1'||c.epoch!==1||a.expectedStrategyVersionId!==null||g.sourceAdmissionSha256!==sourceAdmissionDigest(a)||a.clerkUserId!==binding.actorId||c.tenantId!==binding.tenantId||a.generationRequestId!==acceptedRequest.requestId||!Number.isSafeInteger(a.admittedAtMs)||!Number.isSafeInteger(a.effectExpiresAtMs)||a.admittedAtMs<0||a.effectExpiresAtMs<=a.admittedAtMs||s.schemaVersion!==1||s.operation!=='strategy.draft'||hash(r)!==s.requestSha256||r.operation!=='strategy.draft'||r.basis!==null||r.jobId!==a.generationJobId||r.requestId!==a.generationRequestId||r.principal.tenantId!==c.tenantId||r.principal.actorId!==a.clerkUserId||r.principal.clientId!==c.clientId||r.source.kind!=='objective'||r.source.objectiveId!==c.objectiveId||r.source.objectiveRevisionId!==c.requestedObjectiveRevisionId||r.source.objectiveVersion!==c.requestedObjectiveVersion||r.source.snapshotSha256!==c.snapshotHash||r.input.typeHint!==s.queuedType)refuse();
 if(!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=a.admittedAtMs||expiresAtMs>Math.min(a.effectExpiresAtMs,r.originalExpiresAtMs)||nowMs!==undefined&&(!Number.isSafeInteger(nowMs)||nowMs<0||expiresAtMs<=nowMs))refuse();
 own(s.executionSelection,['provider','model']);assertObjectiveExecutionContext(s.executionContext,{request:r,acceptedRequest});return boundedSelection(data({binding,acceptedRequest,sourceAdmissionSha256:g.sourceAdmissionSha256,strategy:s,sourceRequestSha256:hash(acceptedRequest)}));
}
export function typedExecutionWitness(value){
 const v=value,e=v.execution,o=v.observation;
 return data({schemaVersion:1,operation:'strategy.draft',sourceAdmissionSha256:v.sourceAdmissionSha256,sourceRequestSha256:v.sourceRequestSha256,typedRequestSha256:v.typedRequestSha256,
  bindingSha256:e.bindingSha256,provider:e.provider,model:e.model,receiptRef:e.receiptRef,sessionId:o.sessionId,completedAtMs:o.completedAtMs,state:o.state,payloadSha256:o.payloadSha256});
}
export function assertTypedResult(value,{binding,sourceRequestSha256,sessionId}={}){
 const v=data(own(value,['schemaVersion','kind','path','sourceAdmissionSha256','sourceRequestSha256','typedRequestSha256','resultRef','resultSha256','fileSha256','bytes','execution','observation']));
 objectiveDescriptorProtocol(v);if(v.schemaVersion!==1||!Number.isSafeInteger(v.bytes)||v.bytes<1||v.bytes>MAX_TYPED_RESULT_BYTES)refuse();
 for(const k of ['sourceAdmissionSha256','sourceRequestSha256','typedRequestSha256','resultSha256','fileSha256'])digest(v[k]);uuid(v.resultRef);
 const e=own(v.execution,['provider','model','receiptRef','receiptSha256','bindingSha256']),o=own(v.observation,['sessionId','completedAtMs','state','payloadSha256']);
 for(const key of ['provider','model'])if(typeof e[key]!=='string'||e[key].length<1||e[key].length>128||!e[key].trim())refuse();
 uuid(e.receiptRef);digest(e.receiptSha256);digest(e.bindingSha256);uuid(o.sessionId);digest(o.payloadSha256);
 if(!Number.isSafeInteger(o.completedAtMs)||o.completedAtMs<0||!['succeeded','needs-information','refused'].includes(o.state)||hash(typedExecutionWitness(v))!==e.receiptSha256)refuse();
 if(binding!==undefined){validateShape('RunBinding',binding);if(e.bindingSha256!==hash(binding))refuse();}
 if(sourceRequestSha256!==undefined&&v.sourceRequestSha256!==sourceRequestSha256||sessionId!==undefined&&o.sessionId!==sessionId)refuse();return v;
}
/** Retained original selection is written by native capture from issued facts, not the worker's descriptor/body. */
export function assertTypedSelection(value,descriptor,{binding,acceptedRequest}){
 const s=data(own(value,['binding','acceptedRequest','sourceAdmissionSha256','strategy','sourceRequestSha256'])),d=assertTypedResult(descriptor,{binding,sourceRequestSha256:hash(acceptedRequest)}),strategy=own(s.strategy,['schemaVersion','operation','request','requestSha256','executionContext','queuedType','executionSelection']);
 if(hash(s.binding)!==hash(binding)||hash(s.acceptedRequest)!==hash(acceptedRequest)||s.sourceRequestSha256!==d.sourceRequestSha256||s.sourceAdmissionSha256!==d.sourceAdmissionSha256||strategy.schemaVersion!==1||strategy.operation!=='strategy.draft'||strategy.requestSha256!==d.typedRequestSha256||hash(strategy.request)!==strategy.requestSha256||strategy.request.requestId!==acceptedRequest.requestId||strategy.request.principal.tenantId!==binding.tenantId||strategy.request.principal.actorId!==binding.actorId||objectiveRequestProtocol(strategy.request,{sourceAdmissionSha256:s.sourceAdmissionSha256}).kind!==d.kind||strategy.request.input.typeHint!==strategy.queuedType||hash(strategy.executionSelection)!==hash({provider:d.execution.provider,model:d.execution.model}))refuse();assertObjectiveExecutionContext(strategy.executionContext,{request:strategy.request,acceptedRequest});return boundedSelection(s);
}
/** The locator is selected by the immutable journal witness, never by a read caller. */
export function typedCheckpointObject(proof,descriptor){
 const d=assertTypedResult(descriptor),cp=proof.checkpoint;validateShape('Checkpoint',cp);assertWorkspacePaths(cp.workspace);
 if(hash(cp)!==proof.checkpointSha256||hash(cp.workspace)!==cp.workspaceSha256||proof.sourceRequestSha256!==d.sourceRequestSha256||cp.sessionId!==d.observation.sessionId||hash(cp.binding)!==d.execution.bindingSha256)refuse();
 const rows=cp.workspace.entries.filter(e=>e.path===d.path);if(rows.length!==1)refuse();const e=rows[0];
 if(e.kind!=='file'||e.executable!==false||e.object.sha256!==d.fileSha256||e.object.bytes!==d.bytes||e.object.versionId==='null')refuse();return data(e.object);
}
export function assertTypedResultBytes(bytes,descriptor){
 const d=assertTypedResult(descriptor);if(types.isProxy(bytes)||!Buffer.isBuffer(bytes)||bytes.length!==d.bytes||rawTypedSha256(bytes)!==d.fileSha256)refuse();return Buffer.from(bytes);
}
