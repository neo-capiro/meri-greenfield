/** Inert, non-secret facts for reconstructing the existing allocator's Stop after a workload change.
 * A caller must persist and verify this capsule before claiming native allocation. It is not a
 * cleanup receipt, authority grant, task credential, or permission to accept a new run. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {allocation} from '../../gateway/budget/tool-budget-binding.mjs';
import {compileNativeTaskRequest} from './task-request.mjs';
import {compileEcsTaskBinding} from './ecs-task-binding.mjs';
import {assertRequest} from '../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {strategyTypes} from '../../../packages/contracts/strategy-operations-candidate/shapes.mjs';
import {assertPreparedObjectiveSelection,MAX_OBJECTIVE_SELECTION_BYTES} from '../../../packages/runtime/objective-generation-custody.mjs';
import {assertNativeReadConfiguration} from '../../../packages/contracts/runtime-0.2/reads.mjs';

// Existing Objective selection bound plus the existing bounded capsule overhead (including source admission).
export const MAX_HISTORICAL_STOP_FACT_BYTES=MAX_OBJECTIVE_SELECTION_BYTES+131072;
const fail=()=>{throw Object.assign(Error('HISTORICAL_STOP_FACTS_REFUSED'),{code:'HISTORICAL_STOP_FACTS_REFUSED'});};
const same=(a,b)=>hash(a)===hash(b);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
const fields=['schemaVersion','original','allocationJson','taskRequest','containerName','qualification','grantIntents','configurationSha256','effectiveDescriptorSha256'];
const custodyFields=[...fields.slice(0,7),'issuance','issuedFacts'];
const inputFields=value=>value?.schemaVersion===2?custodyFields:fields;
const originalFields=['binding','executionKey','executionId','planSha256','expiresAtMs','versions'];
const allocationFields=['binding','allocationKey','original','allocationSha256','qualification','grantIntents','taskRequestSha256','expiresAtMs','state','resource'];

function checked(value){
 const v=data(own(value,inputFields(value)));
 if(![1,2].includes(v.schemaVersion)||v.schemaVersion===1&&(!digest(v.configurationSha256)||!digest(v.effectiveDescriptorSha256))||
    Buffer.byteLength(JSON.stringify(v),'utf8')>(v.schemaVersion===2?MAX_HISTORICAL_STOP_FACT_BYTES:131072))fail();
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
 const result=data({...v,allocationSha256:hash(a),taskRequestSha256:request.taskRequestSha256});
 if(v.schemaVersion===2)checkIssuance(result);
 return result;
}

/** Build the canonical capsule from closed, reviewed, non-secret inputs. */
export function compileHistoricalStopFacts(value){try{return checked(value);}catch{fail();}}

/** Decode a stored capsule without granting Stop authority. Derived hashes cannot be caller-selected. */
export function assertHistoricalStopFacts(value){try{
 const keys=inputFields(value),v=data(own(value,[...keys,'allocationSha256','taskRequestSha256'])),base=Object.fromEntries(keys.map(k=>[k,v[k]])),expected=checked(base);
 if(v.allocationSha256!==expected.allocationSha256||v.taskRequestSha256!==expected.taskRequestSha256)fail();
 return expected;
}catch{fail();}}

/** Match an already decoded native allocation row, including a CLAIMED/UNKNOWN row with resource:null.
 * The caller still must read the row and issuance under their canonical locks and prove physical Stop. */
export function matchHistoricalStopAllocation(capsule,allocationRecord){try{
 const facts=assertHistoricalStopFacts(capsule),r=data(own(allocationRecord,allocationFields,['retirementFacts']));
 if(r.retirementFacts!==undefined&&!same(r.retirementFacts,facts))fail();
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

/** v2 is issuance-bound Stop custody, not PR178 configuration adoption. Every field is a
 * closed nonsecret projection; neither runtime configuration nor capability material is accepted. */
function checkIssuance(c){
 const {objectiveStrategy,...baseFacts}=c.issuedFacts;
 if(Buffer.byteLength(JSON.stringify({...c,issuedFacts:baseFacts}))>131072)fail();
 const i=own(c.issuance,['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256','factsSha256']);
 const f=own(c.issuedFacts,['original','allocationSha256','taskRequestSha256','qualification','grantIntents','grantId','operations','controlCapabilitySha256','transport'],['approvedReads','objectiveGeneration','objectiveStrategy']);
 if(i.issuanceKey!==c.original.executionKey||!same(i.binding,c.original.binding)||i.expiresAtMs!==c.original.expiresAtMs||
    !digest(i.requestSha256)||!uuid(i.grantId)||!digest(i.capabilitySha256)||!digest(i.factsSha256)||hash(f)!==i.factsSha256||
    !same(f.original,c.original)||f.allocationSha256!==c.allocationSha256||f.taskRequestSha256!==c.taskRequestSha256||
    !same(f.qualification,c.qualification)||!same(f.grantIntents,c.grantIntents)||f.grantId!==i.grantId||
    !c.grantIntents.some(g=>g.grantId===i.grantId&&g.capabilitySha256===i.capabilitySha256&&g.expiresAtMs===i.expiresAtMs)||
    !digest(f.controlCapabilitySha256)||c.grantIntents.some(g=>g.capabilitySha256===f.controlCapabilitySha256)||
    !Array.isArray(f.operations)||f.operations.some(op=>typeof op!=='string'||!/^[a-z][a-zA-Z0-9/.-]{0,127}$/u.test(op)))fail();
 const t=own(f.transport,['origin','http']),url=new URL(t.origin),h=own(t.http,['hostname','port','frontendOrigin']);
 if(url.protocol!=='https:'||url.origin!==t.origin||!['127.0.0.1','0.0.0.0','::1','::'].includes(h.hostname)||
    !Number.isSafeInteger(h.port)||h.port<1||h.port>65535||h.frontendOrigin!==t.origin)fail();
 if(f.approvedReads!==undefined)assertNativeReadConfiguration(f.approvedReads);
 if((f.objectiveGeneration===undefined)!==(f.objectiveStrategy===undefined))fail();
 if(f.objectiveStrategy!==undefined){
  const s=f.objectiveStrategy;assertRequest(s.request);
  if(!strategyTypes.includes(s.queuedType)||Object.values(own(s.executionSelection,['provider','model'])).some(v=>typeof v!=='string'||!v.trim()||v.length>128))fail();
  // Validate the already-issued pair's closed shape here; the resolver additionally
  // binds its request/context to the canonical saved request before any Stop effect.
  assertPreparedObjectiveSelection({objectiveGeneration:f.objectiveGeneration,objectiveStrategy:s},{binding:c.original.binding,acceptedRequest:{requestId:s.request.requestId,prompt:s.executionContext.prompt},expiresAtMs:c.original.expiresAtMs});
 }
}
