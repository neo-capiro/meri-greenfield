/** Inert, non-secret facts for reconstructing the existing allocator's Stop after a workload change.
 * A caller must persist and verify this capsule before claiming native allocation. It is not a
 * cleanup receipt, authority grant, task credential, or permission to accept a new run. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {allocation} from '../../gateway/budget/tool-budget-binding.mjs';
import {compileNativeTaskRequest} from './task-request.mjs';
import {compileEcsTaskBinding} from './ecs-task-binding.mjs';

const fail=()=>{throw Object.assign(Error('HISTORICAL_STOP_FACTS_REFUSED'),{code:'HISTORICAL_STOP_FACTS_REFUSED'});};
const same=(a,b)=>hash(a)===hash(b);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
const fields=['schemaVersion','original','allocationJson','taskRequest','containerName','qualification','grantIntents','configurationSha256','effectiveDescriptorSha256'];
const completeFields=[...fields,'allocationSha256','taskRequestSha256'];
const originalFields=['binding','executionKey','executionId','planSha256','expiresAtMs','versions'];
const allocationFields=['binding','allocationKey','original','allocationSha256','qualification','grantIntents','taskRequestSha256','expiresAtMs','state','resource'];

function checked(value){
 const v=data(own(value,fields));
 if(v.schemaVersion!==1||!digest(v.configurationSha256)||!digest(v.effectiveDescriptorSha256)||
    Buffer.byteLength(JSON.stringify(v),'utf8')>131072)fail();
 const original=own(v.original,originalFields);validateShape('RunBinding',original.binding);validateShape('RuntimeVersions',original.versions);
 if(original.executionKey!==hash(original.binding)||original.executionId!==original.executionKey||
    !digest(original.planSha256)||!Number.isSafeInteger(original.expiresAtMs)||original.expiresAtMs<1)fail();
 const a=allocation(v.allocationJson);
 // The native allocator and budget admission bind the parsed allocation's canonical hash. A
 // JSONB readback may reorder keys; raw JSON whitespace/order is not part of that authority.
 if(!same(a.run,{
  tenantId:original.binding.tenantId,actorId:original.binding.actorId,
  conversationId:original.binding.conversationId,runId:original.binding.runId
 })||Date.parse(a.schedule.expiresAt)<original.expiresAtMs)fail();
 // v1 captures render-material.mjs's measured first-chat override. Free-form command/env values could carry a
 // credential even though taskRequest's general parser allows them for other qualified workloads.
 const request=compileNativeTaskRequest({original,taskRequest:v.taskRequest,containerName:v.containerName});
 const worker=request.request.overrides.containerOverrides[0];
 if(!same(worker.command,['start'])||worker.environment.length!==0)fail();
 const q=own(v.qualification,['attempt','policyRevision']);
 if(!Number.isSafeInteger(q.attempt)||q.attempt<1||q.attempt>2147483647||!digest(q.policyRevision)||
    !Array.isArray(v.grantIntents)||v.grantIntents.length<1||v.grantIntents.length>16)fail();
 const ids=new Set(),caps=new Set();
 for(const raw of v.grantIntents){const g=own(raw,['grantId','capabilitySha256','expiresAtMs']);
  if(!uuid(g.grantId)||!digest(g.capabilitySha256)||!Number.isSafeInteger(g.expiresAtMs)||
     g.expiresAtMs<original.expiresAtMs||g.expiresAtMs>Date.parse(a.schedule.expiresAt)||
     ids.has(g.grantId)||caps.has(g.capabilitySha256))fail();
  ids.add(g.grantId);caps.add(g.capabilitySha256);
 }
 return data({...v,allocationSha256:hash(a),taskRequestSha256:request.taskRequestSha256});
}

/** Build the canonical capsule from closed, reviewed, non-secret inputs. */
export function compileHistoricalStopFacts(value){try{return checked(value);}catch{fail();}}

/** Decode a stored capsule without granting Stop authority. Derived hashes cannot be caller-selected. */
export function assertHistoricalStopFacts(value){try{
 const v=data(own(value,completeFields)),base=Object.fromEntries(fields.map(k=>[k,v[k]])),expected=checked(base);
 if(v.allocationSha256!==expected.allocationSha256||v.taskRequestSha256!==expected.taskRequestSha256)fail();
 return expected;
}catch{fail();}}

/** Match an already decoded native allocation row, including a CLAIMED/UNKNOWN row with resource:null.
 * The caller still must read the row and issuance under their canonical locks and prove physical Stop. */
export function matchHistoricalStopAllocation(capsule,allocationRecord){try{
 const facts=assertHistoricalStopFacts(capsule),r=data(own(allocationRecord,allocationFields));
 if(!['CLAIMED','ALLOCATED','ADMITTED','UNKNOWN','RETIRED'].includes(r.state)||
    !same(r.binding,facts.original.binding)||r.allocationKey!==facts.original.executionKey||
    !same(r.original,facts.original)||r.allocationSha256!==facts.allocationSha256||
    !same(r.qualification,facts.qualification)||!same(r.grantIntents,facts.grantIntents)||
    r.taskRequestSha256!==facts.taskRequestSha256||r.expiresAtMs!==facts.original.expiresAtMs||
    (r.resource===null&&['ALLOCATED','ADMITTED','RETIRED'].includes(r.state)))fail();
 if(r.resource!==null){
  const resource=own(r.resource,['taskArn','createdAtMs','clusterArn','taskDefinitionArn','containerName'],['grantFactsJsons','physicalStopProven','launchBinding']);
  compileEcsTaskBinding({original:facts.original,taskArn:resource.taskArn,createdAtMs:resource.createdAtMs,
   clusterArn:resource.clusterArn,taskDefinitionArn:resource.taskDefinitionArn,containerName:resource.containerName});
  if(resource.clusterArn!==facts.taskRequest.cluster||resource.taskDefinitionArn!==facts.taskRequest.taskDefinition||
     resource.containerName!==facts.containerName||r.state==='RETIRED'&&resource.physicalStopProven!==true)fail();
 }
 return facts;
}catch{fail();}}
