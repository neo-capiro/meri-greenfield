/** Data and whole graph checks. Actual Core admission, history and current authority remain their owners. */
import Ajv from 'ajv/dist/2020.js';import formats from 'ajv-formats';
import canonical from '../meri.schema.json' with {type:'json'};
import {data} from '../commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../validate.mjs';
import {validateDraftGraph} from '../strategy-operations-candidate/graph.mjs';
import {assertRegenerationCommitments} from '../../runtime/objective-strategy-protocol.mjs';
import {candidateSchema,requestVersion,resultVersion} from './schema.mjs';
export {candidateSchema,requestVersion,resultVersion};
const ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(canonical);const schema=candidateSchema();ajv.addSchema(schema);
const validators=Object.fromEntries(['RegenerationRequest','RegenerationResult','Draft','ModelOutcome'].map(n=>[n,ajv.compile({$ref:schema.$id+'#/$defs/'+n})]));
const refuse=()=>{throw Error('OBJECTIVE_REGENERATION_REFUSED');},without=(v,k)=>Object.fromEntries(Object.entries(v).filter(([key])=>key!==k)),same=(a,b)=>hash(a)===hash(b);
function shape(name,value){const v=data(value);if(!validators[name](v))refuse();return v;}
export function assertRequest(value){
 const r=assertRegenerationCommitments(shape('RegenerationRequest',value)),d=r.context.draft;
 if(d===null||d.clientId!==r.principal.clientId||d.selectedOwnerActorId!==r.principal.ownerActorId||!same(d.input,r.input)||r.context.contextSha256!==hash(without(r.context,'contextSha256'))||r.originalExpiresAtMs<=r.requestedAtMs||r.delegation.issuedAtMs>r.requestedAtMs||r.delegation.absoluteExpiresAtMs<r.originalExpiresAtMs||r.context.asOfMs>r.requestedAtMs||r.input.typeHint===null)refuse();
 const seen=new Set();for(const e of r.context.evidence){if(seen.has(e.ref)||e.asOfMs>r.context.asOfMs||e.scope==='client'&&e.clientId!==r.principal.clientId||e.scope==='tenant-shared'&&e.clientId!==null)refuse();seen.add(e.ref);}return r;
}
function outcome(value,r){
 const v=shape('ModelOutcome',value);if(v.operation!=='strategy.draft')refuse();
 if(v.state!=='succeeded'){if(v.payload!==null||!v.issues.length)refuse();return v;}
 if(v.payload===null||v.issues.length)refuse();const p=shape('Draft',v.payload);validateDraftGraph(p);if(p.type!==r.input.typeHint||p.coverage.complete&&p.coverage.omitted.length||p.coverage.pendingSources.length&&!p.coverage.assumptions.length||r.input.attachmentIds.length&&p.coverage.complete)refuse();
 const refs=new Map(r.context.evidence.map(e=>[e.ref,e.reviewState])),admitted=(items,state)=>{for(const s of items)if(refs.get(s.ref)!==state)refuse();};admitted(p.coverage.sources,'accepted');admitted(p.coverage.pendingSources,'pending');
 for(const n of p.nodes){admitted(n.sources,'accepted');if(n.ownerRef!==null&&!r.context.ownerRefs.includes(n.ownerRef))refuse();}return v;
}
export function assertSdkPayload(raw,{request}){
 const r=assertRequest(request),m=data(raw);if(m.type!=='result'||m.subtype!=='success'||m.is_error!==false||m.structured_output===undefined)refuse();return outcome(m.structured_output,r);
}
export function assertRetainedResult(value,{request,binding,execution,resultRef,resultSha256}){
 const r=assertRequest(request),v=shape('RegenerationResult',value);validateShape('RunBinding',binding);
 if(!same(v.binding,binding)||binding.tenantId!==r.principal.tenantId||binding.actorId!==r.principal.actorId||v.resultVersion!==resultVersion||v.operation!=='strategy.draft'||v.requestId!==r.requestId||v.jobId!==r.jobId||v.requestSha256!==hash(r)||v.inputSha256!==r.inputSha256||v.sourceSha256!==hash(r.source)||v.contextSha256!==r.context.contextSha256||v.basisSha256!==r.basisSha256||!same(v.execution,execution)||v.execution.bindingSha256!==hash(binding)||v.resultRef!==resultRef||v.resultSha256!==resultSha256||v.resultSha256!==hash(without(v,'resultSha256'))||v.payloadSha256!==hash(v.payload)||v.completedAtMs<r.requestedAtMs||v.completedAtMs>=r.originalExpiresAtMs)refuse();outcome({operation:v.operation,state:v.state,payload:v.payload,issues:v.issues},r);return v;
}
