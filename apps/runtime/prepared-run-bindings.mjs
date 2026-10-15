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
const fail=code=>{throw Object.assign(Error('PREPARED_RUN_BINDINGS_'+code),{code:'PREPARED_RUN_BINDINGS_'+code});};
export function createPreparedRunBindings(options){
 const o=own(options,['configuration','pool','store','credentials'],['issuanceStore','capabilityAuthority','now','limits']),now=o.now??Date.now,limits=o.limits??{maxRequestMs:3000,maxFactBytes:131072};
 const config=compilePreparedCandidateConfiguration(o.configuration.nativeCandidate,o.configuration.versions);if(config.multiRun===undefined)fail('NOT_CONFIGURED');
 if(!o.issuanceStore||!o.capabilityAuthority)fail('UNAVAILABLE');if(typeof o.pool?.connect!=='function'||typeof o.store?.allocations?.read!=='function')fail('CONFIGURATION');
 const secrets=own(o.credentials,['proxy','control']);if([secrets.proxy,secrets.control].some(v=>typeof v!=='string'||!/^\S{1,8192}$/u.test(v))||secrets.proxy===secrets.control)fail('CONFIGURATION');
 const controlDigest=capabilityDigest(secrets.control),a=allocation(config.allocationJson),scheduleExpiresAtMs=Date.parse(a.schedule.expiresAt);
 const admissionFor=(binding,record)=>createNativeAllocationAdmission({pool:o.pool,allocationJson:config.allocationJson,qualification:record?.qualification??config.qualification,grantIntents:record.grantIntents,binding,now,limits});
 /** Existing admission owner per target binding; the next-run owner calls its `revoke` with the retired task ARN. */
 async function admissionForBinding({binding,record}){const r=data(own(record,['state','original','grantIntents','resource'],['qualification','allocationSha256','taskRequestSha256','allocationKey']));return admissionFor(binding,r);}
 /** Source retirement facade for the issuance owner: the allocation record read for a source is remembered by task ARN so that the
  * revocation goes through the admission of that exact source binding. */
 const sources=new Map();
 const sourceOwners={allocations:{async read(query,check){const saved=await o.store.allocations.read(query,check);if(saved?.record?.resource?.taskArn)sources.set(saved.record.resource.taskArn,{binding:query.binding,record:saved.record});return saved;}},
  admission:{async revoke({taskArn,signal}){const s=sources.get(taskArn);if(!s)fail('SOURCE_UNKNOWN');return admissionFor(s.binding,s.record).revoke({taskArn,signal});}}};
 /** Trusted fact producer: the reviewed static configuration retargeted to the intent's binding and the issued grant. */
 const facts={async compile({intent,issuance}){const c=structuredClone(config),alloc=JSON.parse(c.allocationJson);alloc.run=Object.fromEntries(Object.keys(alloc.run).map(k=>[k,intent.binding[k]]));
  return {runtime:{...c.runtime,binding:intent.binding,deadlineMs:intent.expiresAtMs,proxyCredential:secrets.proxy},plan:c.plan,preparationIntent:c.preparationIntent,allocationJson:JSON.stringify(alloc),qualification:c.qualification,grantIntents:[{grantId:issuance.grantId,capabilitySha256:issuance.capabilitySha256,expiresAtMs:intent.expiresAtMs}],grantId:issuance.grantId,operations:c.operations,taskRequest:c.taskRequest,containerName:c.containerName,controlCapabilitySha256:controlDigest};}};
 const issuer=createPreparedRunIssuer({store:o.issuanceStore,authority:o.capabilityAuthority,now,maxRequestMs:limits.maxRequestMs});
 const runIssuance=createPreparedRunIssuance({issuer,facts,sourceOwners,now,maxRequestMs:limits.maxRequestMs});
 /** The next run's expiry: the reviewed window, never beyond the allocation schedule, never earlier than now. */
 async function issuanceIntent({binding,source,request}){own(data({binding,source,request}),['binding','source','request']);const expiresAtMs=Math.min(now()+config.multiRun.runWindowMs,scheduleExpiresAtMs);if(expiresAtMs<=now())fail('WINDOW_EXPIRED');return {expiresAtMs};}
 return Object.freeze({runIssuance,issuanceIntent,admissionForBinding,issuer,runWindowMs:config.multiRun.runWindowMs,controlCapabilitySha256:controlDigest,configurationSha256:hash({multiRun:config.multiRun,allocationJson:config.allocationJson})});
}
