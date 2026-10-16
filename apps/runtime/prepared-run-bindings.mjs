/** Production composition of the three multi-run ports (S2): `runIssuance` (the canonical prepared-run issuance over the durable
 * issuer and a trusted fact producer), `issuanceIntent` (the next run's expiry from reviewed static bounds) and `admissionForBinding`
 * (the existing budget admission owner per target binding). Ports are built from startup-supplied owners; configuration names no
 * callback or module. Missing owners fail readiness. The raw proxy credential stays in trusted memory and never enters a receipt. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createPreparedRunIssuance} from './prepared-run-issuance.mjs';
import {createPreparedRunIssuer} from './prepared-run-issuer.mjs';
import {createNativeAllocationAdmission} from '../gateway/budget/native-allocation-admission.mjs';
import {allocation} from '../gateway/budget/tool-budget-binding.mjs';
import {capabilityDigest} from './native-authority/task-verifier.mjs';
import {compilePreparedCandidateConfiguration} from './prepared-candidate-config.mjs';
import {issueRunModelGrant} from './run-model-grant.mjs';
import {createOriginalRunPreparation} from './original-run-preparation.mjs';
import {assertNativeReadConfiguration,nativeReadOperations} from '../../packages/contracts/runtime-0.2/reads.mjs';
const fail=code=>{throw Object.assign(Error('PREPARED_RUN_BINDINGS_'+code),{code:'PREPARED_RUN_BINDINGS_'+code});};
export function createPreparedRunBindings(options){
 const o=own(options,['configuration','pool','store','credentials'],['issuanceStore','capabilityAuthority','modelGrants','now','limits']),now=o.now??Date.now,limits=o.limits??{maxRequestMs:3000,maxFactBytes:131072};
 const config=compilePreparedCandidateConfiguration(o.configuration.nativeCandidate,o.configuration.versions);if(config.multiRun===undefined)fail('NOT_CONFIGURED');
 if(!o.issuanceStore||!o.capabilityAuthority)fail('UNAVAILABLE');if(typeof o.pool?.connect!=='function'||typeof o.store?.allocations?.read!=='function'||typeof o.store?.readOptional!=='function'||typeof o.issuanceStore.read!=='function')fail('CONFIGURATION');
 if(typeof o.modelGrants?.issue!=='function')fail('MODEL_GRANT_UNAVAILABLE');
 const secrets=own(o.credentials,['control'],['proxy']);if(typeof secrets.control!=='string'||!/^\S{1,8192}$/u.test(secrets.control))fail('CONFIGURATION');
 const controlDigest=capabilityDigest(secrets.control),a=allocation(config.allocationJson),scheduleExpiresAtMs=Date.parse(a.schedule.expiresAt);
 /** The authoritative allocation for a target binding: the reviewed static allocation retargeted to exactly that run. Its hash is what
  * the issued facts and the retired record carry; a record naming a different allocation hash is refused rather than admitted. */
 const retarget=binding=>{const alloc=JSON.parse(config.allocationJson);alloc.run=Object.fromEntries(Object.keys(alloc.run).map(k=>[k,binding[k]]));return JSON.stringify(alloc);};
 const admissionFor=(binding,record)=>{const allocationJson=retarget(binding);if(record.allocationSha256!==undefined&&record.allocationSha256!==hash(allocation(allocationJson)))fail('ALLOCATION_MISMATCH');
  return createNativeAllocationAdmission({pool:o.pool,allocationJson,qualification:record?.qualification??config.qualification,grantIntents:record.grantIntents,binding,now,limits});};
 /** Existing admission owner per target binding; the next-run owner calls its `revoke` with the retired task ARN. */
 async function admissionForBinding({binding,record}){const r=data(own(record,['state','original','grantIntents','resource'],['qualification','allocationSha256','taskRequestSha256','allocationKey']));return admissionFor(binding,r);}
 /** Source retirement facade for the issuance owner: the allocation record read for a source is remembered by task ARN so that the
  * revocation goes through the admission of that exact source binding. */
 const sources=new Map();
 const sourceOwners={allocations:{async read(query,check){const saved=await o.store.allocations.read(query,check);if(saved?.record?.resource?.taskArn)sources.set(saved.record.resource.taskArn,{binding:query.binding,record:saved.record});return saved;}},
  admission:{async revoke({taskArn,signal}){const s=sources.get(taskArn);if(!s)fail('SOURCE_UNKNOWN');return admissionFor(s.binding,s.record).revoke({taskArn,signal});}}};
 /** Trusted fact producer: the reviewed static configuration retargeted to the intent's binding and the issued grant, bound to the
  * current durable run record (binding, versions, policy revision) when one exists; a later run must have one. The per-entry
  * transport contract is part of the facts. */
 const facts={async compile({intent,issuance,signal}){const c=structuredClone(config),check=()=>{if(signal?.aborted)fail('CANCELLED');};
  const approvedReads=c.approvedReads===undefined?undefined:assertNativeReadConfiguration(c.approvedReads),operations=[...new Set([...c.operations,...(approvedReads===undefined?[]:nativeReadOperations)])];
  const saved=await o.store.readOptional(intent.binding,{},check);
  if(saved){if(hash(saved.run.binding)!==hash(intent.binding)||hash(saved.run.versions)!==hash(c.runtime.versions)||saved.run.policyRevision!==c.qualification.policyRevision)fail('RUN_RECORD_MISMATCH');}
  else if(intent.binding.writerFence>1)fail('RUN_RECORD_REQUIRED');
  if(approvedReads!==undefined&&(!saved||hash(saved.request)!==intent.requestSha256))fail('RUN_REQUEST_MISMATCH');
  const model=await issueRunModelGrant({owner:o.modelGrants,intent,taskGrant:issuance,controlSha256:controlDigest,now,signal});
  return {runtime:{...c.runtime,binding:intent.binding,deadlineMs:intent.expiresAtMs,proxyCredential:model.proxyCredential},plan:c.plan,preparationIntent:c.preparationIntent,allocationJson:retarget(intent.binding),qualification:c.qualification,grantIntents:[{grantId:issuance.grantId,capabilitySha256:issuance.capabilitySha256,expiresAtMs:intent.expiresAtMs},model.grantIntent],grantId:issuance.grantId,operations,...(approvedReads===undefined?{}:{approvedReads}),taskRequest:c.taskRequest,containerName:c.containerName,controlCapabilitySha256:controlDigest,transport:{origin:c.taskOrigin,http:c.taskHttp}};}};
 const issuer=createPreparedRunIssuer({store:o.issuanceStore,authority:o.capabilityAuthority,now,maxRequestMs:limits.maxRequestMs});
 const runIssuance=createPreparedRunIssuance({issuer,facts,sourceOwners,now,maxRequestMs:limits.maxRequestMs});
 const prepareOriginal=createOriginalRunPreparation({binding:config.runtime.binding,expiresAtMs:config.runtime.deadlineMs,store:o.store,issuer,runIssuance,now,maxRequestMs:limits.maxRequestMs});
 /** The run's expiry. An issuance already recorded durably for this binding keeps its original expiry across process recreation
  * (the window is never recomputed from a later clock); otherwise the reviewed window, never beyond the allocation schedule, never
  * earlier than now. */
 async function issuanceIntent({binding,source,request,signal}){own(data({binding,source,request}),['binding','source','request']);
  const issuanceKey=hash(binding),existing=await o.issuanceStore.read({issuanceKey,signal});
  if(existing){if(existing.issuanceKey!==issuanceKey||hash(existing.binding)!==issuanceKey||!Number.isSafeInteger(existing.expiresAtMs))fail('ISSUANCE_RECORD_REFUSED');return {expiresAtMs:existing.expiresAtMs,persisted:true};}
  const expiresAtMs=Math.min(now()+config.multiRun.runWindowMs,scheduleExpiresAtMs);if(expiresAtMs<=now())fail('WINDOW_EXPIRED');return {expiresAtMs,persisted:false};}
 return Object.freeze({runIssuance,issuanceIntent,admissionForBinding,issuer,facts,prepareOriginal,runWindowMs:config.multiRun.runWindowMs,controlCapabilitySha256:controlDigest,configurationSha256:hash({multiRun:config.multiRun,allocationJson:config.allocationJson})});
}
