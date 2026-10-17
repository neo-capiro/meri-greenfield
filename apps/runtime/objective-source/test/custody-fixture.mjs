/** Explicitly SYNTHETIC rows, CAS and owner ports. No production durability,
 * credential, native authorization, task/image or database claim is made here. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {compileObjectiveProtectedFacts,decorateObjectiveBindFactsInput} from '../protected-facts.mjs';
import {createObjectiveSourceCustody} from '../custody.mjs';
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const NOW=1792065600000;
const without=(v,key)=>Object.fromEntries(Object.entries(v).filter(([k])=>k!==key));
export function custodyFixture(){
 const binding={tenantId:id(1),actorId:id(2),conversationId:id(10),runId:id(11),attemptId:id(12),workerId:id(13),writerFence:1};
 const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
 const request=JSON.parse(readFileSync(new URL('../../../../packages/contracts/strategy-operations-candidate/fixtures/strategy.draft.request.json',import.meta.url),'utf8'));
 request.requestId=id(20);request.jobId=id(21);request.principal={tenantId:binding.tenantId,actorId:binding.actorId,clientId:id(3),ownerActorId:binding.actorId};
 request.source.objectiveId=id(4);request.source.objectiveRevisionId=id(5);request.input.typeHint='appropriations';
 request.context.draft.clientId=id(3);request.context.draft.selectedOwnerActorId=binding.actorId;request.context.draft.input=structuredClone(request.input);
 for(const row of request.context.evidence)if(row.scope==='client')row.clientId=id(3);
 request.context.contextSha256=hash(without(request.context,'contextSha256'));request.inputSha256=hash(without(request,'inputSha256'));
 const acceptedRequest={requestId:request.requestId,prompt:'Synthetic Objective source only.',window:null,windowRequest:null,skill:null};
 const policyRevision='c'.repeat(64),run={binding,state:'queued',scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:id(3),policyRevision}],createdAt:new Date(NOW-1000).toISOString(),policyRevision,versions};
 const accepted={run,request:acceptedRequest},receipt={issuanceKey:hash(binding),binding,requestSha256:hash(acceptedRequest),expiresAtMs:NOW+100000,grantId:id(30),capabilitySha256:'d'.repeat(64)};
 const canonical={canonicalPlanId:id(6),tenantId:binding.tenantId,clientId:id(3),objectiveId:id(4),canonicalStrategyId:id(7),canonicalProjectId:id(8),bindingVersion:1,epoch:1,requestedIntentId:id(9),requestedObjectiveRevisionId:id(5),requestedObjectiveVersion:2,snapshotHash:request.source.snapshotSha256};
 const sourceAdmission={schemaVersion:1,namespace:'capiro.objective-strategy.admission:v1',canonical,actorUserId:id(14),clerkUserId:binding.actorId,consentId:id(15),controlVersion:1,generationJobId:request.jobId,generationRequestId:request.requestId,admittedAtMs:NOW-1000,effectExpiresAtMs:NOW+150000,expectedStrategyVersionId:null};
 const pair=compileObjectiveProtectedFacts({sourceAdmission,request,executionContext:{schemaVersion:1,prompt:acceptedRequest.prompt,promptSha256:createHash('sha256').update(acceptedRequest.prompt).digest('hex'),ownerRefs:[{ownerRef:request.context.ownerRefs[0],clerkUserId:binding.actorId}],contextPacketId:request.context.packetId},queuedType:'appropriations',executionSelection:{provider:'synthetic-provider',model:'synthetic-model'}},{accepted,issuance:receipt,nowMs:NOW});
 const base={original:{binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'e'.repeat(64),expiresAtMs:receipt.expiresAtMs,versions},allocationSha256:'f'.repeat(64),taskRequestSha256:'1'.repeat(64),qualification:{attempt:1,policyRevision},grantIntents:[{grantId:receipt.grantId,capabilitySha256:receipt.capabilitySha256,expiresAtMs:receipt.expiresAtMs}],grantId:receipt.grantId,operations:['load'],controlCapabilitySha256:'2'.repeat(64),transport:{origin:'https://synthetic-control.example',http:{hostname:'127.0.0.1',port:8443,frontendOrigin:'https://synthetic-control.example'}}};
 const decorated=decorateObjectiveBindFactsInput({preparedFacts:{...base,factsSha256:hash(base)},pair},{accepted,issuance:receipt,nowMs:NOW});
 const issued={issuance:{...receipt,factsSha256:decorated.facts.factsSha256},...decorated.facts};
 const state={now:NOW,accepted:structuredClone(accepted),issued:structuredClone(issued),rows:new Map(),unknown:false,putMode:'commit',nativeMode:'valid',nativeCalls:0,calls:{run:0,issuance:0,prepared:0,put:0,read:0}};
 const ports={
  store:{async read({generationJobId}){state.calls.read++;if(state.unknown)return {state:'UNKNOWN'};const record=state.rows.get(generationJobId);return record?{state:'COMMITTED',record:structuredClone(record)}:{state:'ABSENT'};},
   async putOnce({generationJobId,record}){state.calls.put++;const prior=state.rows.get(generationJobId);if(prior&&hash(prior)!==hash(record))throw Error('SYNTHETIC_IMMUTABLE_CONFLICT');
    if(state.putMode==='unknown'){state.unknown=true;throw Object.assign(Error('SYNTHETIC_ACK_LOST'),{code:'OBJECTIVE_CUSTODY_ACK_UNKNOWN'});}
    state.rows.set(generationJobId,structuredClone(record));if(state.putMode==='ack-lost')throw Object.assign(Error('SYNTHETIC_ACK_LOST'),{code:'OBJECTIVE_CUSTODY_ACK_UNKNOWN'});return {state:'COMMITTED',record:structuredClone(record)};}},
  acceptedRuns:{async read(){state.calls.run++;return structuredClone(state.accepted);}},
  issuanceStore:{async read(){state.calls.issuance++;return {state:'ISSUED',...structuredClone(state.issued.issuance),materialRef:'SYNTHETIC-PRIVATE-MATERIAL-REFERENCE',version:3};}},
  preparedReader:{async read(){state.calls.prepared++;return {issued:structuredClone(state.issued),checkedAtMs:state.now,expiresAtMs:state.now+10000};}},
  freshAuthority:{async assertCurrent({source}){state.nativeCalls++;if(state.nativeMode==='revoked'||state.nativeMode==='revoke-second'&&state.nativeCalls>1)throw Error('SYNTHETIC_NATIVE_REVOKED');
   return {binding:source.binding,clientId:id(3),checkedAtMs:state.now,expiresAtMs:state.now+2000};}},
 };
 const create=(options={})=>createObjectiveSourceCustody({...ports,enabled:true,now:()=>state.now,maxRequestMs:3000,...options});
 const selector={generationJobId:request.jobId,sourceAdmissionSha256:pair.objectiveGeneration.sourceAdmissionSha256};
 return {binding,accepted,issued,selector,state,ports,create};
}
