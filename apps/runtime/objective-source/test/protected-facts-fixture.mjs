/** Reusable synthetic qualification fixture. All credential strings are inert;
 * actual production candidate and prepared-facts compilers run without effects.
 */
import {createHash} from 'node:crypto';
import {normalize} from 'node:path';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {request as candidateRequest,id} from '../../../../packages/contracts/strategy-operations-candidate/fixture-source.mjs';
import {requestInputHash,without} from '../../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {candidateFixture} from '../../test/prepared-candidate-fixture.mjs';
import {compilePreparedRunFacts} from '../../prepared-run-issuance.mjs';
import {compileObjectiveProtectedFacts,decorateObjectiveBindFactsInput} from '../protected-facts.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');

export function objectiveProtectedFactsFixture(){
 const f=candidateFixture(),config=structuredClone(f.configuration.nativeCandidate),nowMs=f.now;
 const binding={...f.binding,tenantId:id(901),actorId:id(902)},request=structuredClone(candidateRequest());
 Object.assign(request.principal,{tenantId:binding.tenantId,actorId:binding.actorId,ownerActorId:binding.actorId});
 Object.assign(request,{requestedAtMs:nowMs,originalExpiresAtMs:nowMs+200000});
 Object.assign(request.delegation,{issuedAtMs:nowMs-1000,absoluteExpiresAtMs:nowMs+86399000});
 request.context.asOfMs=nowMs-1000;request.context.evidence.forEach(e=>{e.asOfMs=nowMs-2000;});
 request.context.draft.selectedOwnerActorId=binding.actorId;
 request.input.typeHint='authorization';request.context.draft.input.typeHint='authorization';
 request.context.contextSha256=hash(without(request.context,'contextSha256'));request.inputSha256=requestInputHash(request);
 const acceptedRequest={requestId:request.requestId,prompt:'Synthetic original accepted Objective request.',skill:null,window:null,windowRequest:null};
 const accepted={run:{binding,state:'queued',scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:request.principal.clientId,policyRevision:config.qualification.policyRevision}],
  createdAt:new Date(nowMs-1000).toISOString(),policyRevision:config.qualification.policyRevision,versions:config.runtime.versions},request:acceptedRequest};
 const issuance={issuanceKey:hash(binding),binding,requestSha256:hash(acceptedRequest),expiresAtMs:config.runtime.deadlineMs,grantId:config.grantId,capabilitySha256:sha(f.secret.task)};
 const intent={issuanceKey:issuance.issuanceKey,binding,requestSha256:issuance.requestSha256,expiresAtMs:issuance.expiresAtMs};
 const allocation=JSON.parse(config.allocationJson);allocation.run=Object.fromEntries(Object.keys(allocation.run).map(key=>[key,binding[key]]));
 for(const key of ['workspace','configParentDirectory','secureStorageDirectory'])config.preparationIntent[key]=normalize(config.preparationIntent[key]);
 config.preparationIntent.launchTemplate.command=normalize(config.preparationIntent.launchTemplate.command);
 config.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=config.preparationIntent.secureStorageDirectory;
 const rawConfiguration={runtime:{...config.runtime,binding,proxyCredential:f.secret.proxy},plan:config.plan,preparationIntent:config.preparationIntent,allocationJson:JSON.stringify(allocation),
  qualification:config.qualification,grantIntents:config.grantIntents,grantId:config.grantId,operations:config.operations,taskRequest:config.taskRequest,containerName:config.containerName,
  controlCapabilitySha256:sha(f.secret.control),transport:{origin:config.taskOrigin,http:config.taskHttp}};
 const preparedFacts=compilePreparedRunFacts(rawConfiguration,{intent,issuance,now:()=>nowMs});
 const canonical={canonicalPlanId:id(910),tenantId:binding.tenantId,clientId:request.principal.clientId,objectiveId:request.source.objectiveId,canonicalStrategyId:id(911),canonicalProjectId:id(912),
  bindingVersion:1,epoch:1,requestedIntentId:id(913),requestedObjectiveRevisionId:request.source.objectiveRevisionId,requestedObjectiveVersion:request.source.objectiveVersion,snapshotHash:request.source.snapshotSha256};
 const sourceAdmission={schemaVersion:1,namespace:'capiro.objective-strategy.admission:v1',canonical,actorUserId:id(914),clerkUserId:binding.actorId,consentId:id(915),controlVersion:1,
  generationJobId:request.jobId,generationRequestId:request.requestId,admittedAtMs:nowMs-1000,effectExpiresAtMs:nowMs+150000,expectedStrategyVersionId:null};
 const raw={sourceAdmission,request,executionContext:{schemaVersion:1,prompt:acceptedRequest.prompt,promptSha256:sha(Buffer.from(acceptedRequest.prompt,'utf8')),
  ownerRefs:[{ownerRef:request.context.ownerRefs[0],clerkUserId:binding.actorId}],contextPacketId:request.context.packetId},queuedType:'authorization',executionSelection:{provider:'synthetic-provider',model:'synthetic-model'}};
 const options={accepted,issuance,nowMs};
 const compile=()=>compileObjectiveProtectedFacts(raw,options);
 const decorate=()=>decorateObjectiveBindFactsInput({preparedFacts,pair:compile()},options);
 return {raw,options,preparedFacts,rawConfiguration,intent,secret:f.secret,compile,decorate};
}
