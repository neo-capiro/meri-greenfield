/** Candidate validators. Shape/hash checks never authenticate an actor or grant. */
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import canonical from '../meri.schema.json' with {type:'json'};
import {canonicalSha256 as hash,validateShape} from '../validate.mjs';
import {data} from '../commands-0.2/execution-boundary.mjs';
import {candidateSchema,policy} from './schema.mjs';
import {nodeFields} from './shapes.mjs';
import {graph,validateDraftGraph,validateEditGraph} from './graph.mjs';
import {normalizedDraftDto,draftContextPacket} from './draft-context.mjs';
export {hash};
const ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(canonical);const schema=candidateSchema();ajv.addSchema(schema);
const validators=Object.fromEntries(['Request','Result','ModelOutcome','WorkloadDecision','ExecutionProvenance','LegacyDraftDto','ResolvedDocuments','CoreAttachmentResolution','Draft','Edit','Document'].map(n=>[n,ajv.compile({$ref:schema.$id+'#/$defs/'+n})]));
const fail=()=>{throw Error('STRATEGY_CANDIDATE_REFUSED');};
const same=(a,b)=>hash(a)===hash(b);
export const without=(v,key)=>Object.fromEntries(Object.entries(v).filter(([k])=>k!==key));
export const requestInputHash=v=>hash(without(v,'inputSha256'));
function shape(name,value,limit=policy.resultBytes){const v=data(value);if(Buffer.byteLength(JSON.stringify(v))>limit||!validators[name](v))fail();return v;}
export function assertRequest(value){
 const v=shape('Request',value,policy.requestBytes),d=v.delegation;
 if(v.context.contextSha256!==hash(without(v.context,'contextSha256')))fail();
 if(v.operation==='strategy.draft'){
  const p=v.context.draft;if(p===null||p.clientId!==v.principal.clientId||p.selectedOwnerActorId!==v.principal.ownerActorId||!same(p.input,v.input))fail();
  const a=p.attachments;
  if(a.correlation==='unattributed-legacy-bundle'){
   if((a.state==='observed')!==Boolean(a.documents.length)||a.state==='not-requested'&&v.input.attachmentIds.length||a.state==='unavailable'&&!v.input.attachmentIds.length||!v.input.attachmentIds.length&&a.documents.length||!a.documents.length&&a.documentsSha256!==hash([]))fail();
  }else{
   const requested=new Set(v.input.attachmentIds.filter(Boolean)),seen=new Set();
   for(const doc of a.documents){if(!requested.has(doc.id)||seen.has(doc.id)||doc.versionRef.sha256!==doc.snapshotSha256)fail();seen.add(doc.id);}
   for(const id of a.unavailableAttachmentIds){if(!requested.has(id)||seen.has(id))fail();seen.add(id);}
   if(seen.size!==requested.size)fail();
  }
 }else if(v.context.draft!==null)fail();
 if(v.inputSha256!==requestInputHash(v)||v.originalExpiresAtMs<=v.requestedAtMs||v.originalExpiresAtMs-v.requestedAtMs>policy.attemptMs||d.issuedAtMs>v.requestedAtMs||d.absoluteExpiresAtMs<v.originalExpiresAtMs||d.absoluteExpiresAtMs-d.issuedAtMs>policy.delegationMs||v.context.asOfMs>v.requestedAtMs)fail();
 const seen=new Set();for(const e of v.context.evidence){if(seen.has(e.ref)||e.asOfMs>v.context.asOfMs||e.scope==='client'&&e.clientId!==v.principal.clientId||e.scope==='tenant-shared'&&e.clientId!==null)fail();seen.add(e.ref);}
 if(v.basis){graph(v.basis.nodes,n=>n.nodeId,n=>n.dependsOn);const ids=v.basis.nodes.map(n=>n.nodeId);if(v.operation==='strategy.edit'&&(v.input.scope==='node'?(v.input.nodeId===null||!ids.includes(v.input.nodeId)):v.input.nodeId!==null))fail();if(v.operation==='strategy.step-document'){const n=v.basis.nodes.find(n=>n.nodeId===v.input.node.id);if(!n||n.nodeSha256!==hash(v.input.node)||n.startsOn!==v.input.node.startsOn||n.endsOn!==v.input.node.endsOn)fail();}}
 return v;
}
/** Conformance only: expected DTO/documents must come from the trusted backend owner. */
export function assertLegacyDraftMapping(value,{dto,resolvedDocuments}={}){
 const r=assertRequest(value),d=shape('LegacyDraftDto',dto,policy.requestBytes),docs=shape('ResolvedDocuments',resolvedDocuments),n=normalizedDraftDto(d);
 if(r.operation!=='strategy.draft'||r.principal.clientId!==n.clientId||!same(r.input,n.input)||r.principal.ownerActorId!==(d.ownerUserId?.trim()||r.principal.actorId)||!same(r.context.draft,draftContextPacket({clientId:n.clientId,input:n.input,ownerActorId:r.principal.ownerActorId,resolvedDocuments:docs})))fail();
 return r;
}
/** Existing DraftStrategyDto + Core attachment response conformance, not Objective owner authority. */
export function assertCoreDraftMapping(value,{dto,coreResolution}={}){
 const r=assertRequest(value),d=shape('LegacyDraftDto',dto,policy.requestBytes),response=shape('CoreAttachmentResolution',coreResolution),n=normalizedDraftDto(d);
 if(r.operation!=='strategy.draft'||r.principal.clientId!==n.clientId||!same(r.input,n.input)||r.principal.ownerActorId!==(d.ownerUserId?.trim()||r.principal.actorId)||!same(r.context.draft,draftContextPacket({clientId:n.clientId,input:n.input,ownerActorId:r.principal.ownerActorId,coreResolution:response})))fail();
 return r;
}
function payloadFor(v,r){
 const name={'strategy.draft':'Draft','strategy.edit':'Edit','strategy.step-document':'Document'}[r.operation],p=shape(name,v);
 if(name==='Draft')validateDraftGraph(p);if(name==='Edit')validateEditGraph(p,r.basis,[...Object.keys(nodeFields),'dependsOn']);
 const refs=new Map(r.context.evidence.map(e=>[e.ref,e.reviewState]));
 const admitted=(items,state)=>{for(const s of items)if(refs.get(s.ref)!==state)fail();};
 admitted(p.coverage.sources,'accepted');admitted(p.coverage.pendingSources,'pending');
 if(p.coverage.complete&&p.coverage.omitted.length||p.coverage.pendingSources.length&&!p.coverage.assumptions.length)fail();
 if(r.operation==='strategy.draft'&&r.input.attachmentIds.length&&p.coverage.complete)fail();
 for(const n of p.nodes??[])admitted(n.sources,'accepted');for(const s of p.sections??[])admitted(s.sources,'accepted');
 for(const e of p.edits??[])admitted(e.changes.sources??[],'accepted');
 for(const n of [...(p.nodes??[]),...(p.edits??[]).map(e=>e.changes)])if(n.ownerRef!==undefined&&n.ownerRef!==null&&!r.context.ownerRefs.includes(n.ownerRef))fail();
 if(name==='Edit'&&r.input.scope==='node'&&p.edits.some(e=>e.op==='add'||e.nodeId!==r.input.nodeId))fail();
 return p;
}
export function assertResult(value,{request,binding,execution=null}={}){
 const r=assertRequest(request),v=shape('Result',value);validateShape('RunBinding',binding);
 if(!same(v.binding,binding)||binding.tenantId!==r.principal.tenantId||binding.actorId!==r.principal.actorId||v.operation!==r.operation||v.requestId!==r.requestId||v.jobId!==r.jobId||v.inputSha256!==r.inputSha256||v.requestSha256!==hash(r)||v.sourceSha256!==hash(r.source)||v.contextSha256!==r.context.contextSha256||v.basisSha256!==(r.basis===null?null:hash(r.basis))||v.payloadSha256!==hash(v.payload)||v.resultSha256!==hash(without(v,'resultSha256'))||v.completedAtMs<r.requestedAtMs||v.state==='succeeded'&&v.completedAtMs>=r.originalExpiresAtMs)fail();
 if(v.execution!==null){shape('ExecutionProvenance',execution);if(!same(v.execution,execution)||v.execution.bindingSha256!==hash(binding))fail();}else if(execution!==null||v.state==='succeeded')fail();
 if(v.state==='succeeded'){if(v.payload===null||v.issues.length)fail();payloadFor(v.payload,r);}else if(v.payload!==null||!v.issues.length)fail();return v;
}
export function assertSdkPayload(raw,{request}={}){
 const r=assertRequest(request),m=data(raw);if(m.type!=='result'||m.subtype!=='success'||m.is_error!==false||m.structured_output===undefined)fail();const outcome=shape('ModelOutcome',m.structured_output);
 if(outcome.operation!==r.operation)fail();if(outcome.state==='succeeded'){if(outcome.payload===null||outcome.issues.length)fail();payloadFor(outcome.payload,r);}else if(outcome.payload!==null||!outcome.issues.length)fail();return outcome;
}
export function assertRetainedResult(value,{request,binding,execution=null,resultRef,resultSha256}={}){
 const v=assertResult(value,{request,binding,execution});if(v.resultRef!==resultRef||v.resultSha256!==resultSha256)fail();return v;
}
/** Diagnostic candidate policy only: callers must verify Core provenance/current facts independently. */
export function assertWorkloadDecision(value,{expected,nowMs,previousDecision=null}={}){
 const v=shape('WorkloadDecision',value,policy.requestBytes);if(!expected||!Number.isSafeInteger(nowMs))fail();
 for(const key of ['audience','operation','use','delegationRef','delegationRevision','jobId','principal','inputSha256','sourceSha256','policyRevision','confirmedAtMs','absoluteExpiresAtMs','originalExpiresAtMs','allowedSources','productWrites'])if(!same(v[key],expected[key]))fail();
 if(v.issuedAtMs>nowMs||nowMs-v.issuedAtMs>policy.decisionFreshMs||v.expiresAtMs<=nowMs||v.expiresAtMs-v.issuedAtMs>policy.decisionMs||v.issuedAtMs<v.confirmedAtMs||v.expiresAtMs>v.absoluteExpiresAtMs||v.absoluteExpiresAtMs-v.confirmedAtMs>policy.delegationMs||v.absoluteExpiresAtMs<=v.confirmedAtMs||v.originalExpiresAtMs>v.absoluteExpiresAtMs||v.originalExpiresAtMs<=v.confirmedAtMs)fail();
 const planner=v.operation==='objective.plan.prepare';if(v.audience!==(planner?'capiro:objective-planner-materialization:v1':'capiro:objective-strategy-generation:v1'))fail();
 if(planner?(v.use!=='planner-materialize'||!same(v.productWrites,['planner.materialize'])):(v.use==='planner-materialize'||v.productWrites.length>0))fail();
 if(v.use!=='retained-result-read'&&(v.expiresAtMs>v.originalExpiresAtMs||v.originalExpiresAtMs<=nowMs))fail();
 if(v.renewalCount===0){if(v.previousDecisionSha256!==null||previousDecision!==null)fail();}
 else{if(!previousDecision)fail();const p=shape('WorkloadDecision',previousDecision);if(v.previousDecisionSha256!==hash(p)||v.renewalCount!==p.renewalCount+1||v.issuedAtMs<=p.issuedAtMs)fail();for(const k of ['delegationRef','delegationRevision','principal','jobId','audience','operation','use','confirmedAtMs','absoluteExpiresAtMs','originalExpiresAtMs','inputSha256','sourceSha256','policyRevision','allowedSources','productWrites'])if(!same(v[k],p[k]))fail();}
 return v;
}
