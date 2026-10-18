/** Canonical closed Objective reader v2 wire. Data validation confers no authority. */
import {strategyTypes} from '../strategy-operations-candidate/shapes.mjs';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const text=(max=128)=>({type:'string',minLength:1,maxLength:max});
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'};
const sha={type:'string',pattern:'^[0-9a-f]{64}$'};
const integer=(minimum=0,maximum=9007199254740991)=>({type:'integer',minimum,maximum});
const ref=name=>({$ref:'#/$defs/'+name});
export const readerPurposes=Object.freeze({
 'active-source':Object.freeze({operation:'objective.source.read',phase:'active-source-read',path:'/v2/internal/objective-generation/accepted-source/read',subject:'capiro-objective-active-source-reader:v2',audience:'meri:objective-active-source-reader:v2'}),
 'historical-source':Object.freeze({operation:'objective.source.read',phase:'historical-source-read',path:'/v2/internal/objective-generation/historical-source/read',subject:'capiro-objective-historical-source-reader:v2',audience:'meri:objective-historical-source-reader:v2'}),
 'retained-result':Object.freeze({operation:'objective.retained-result.read',phase:'retained-result-read',path:'/v2/internal/objective-generation/retained-result/read',subject:'capiro-objective-retained-result-reader:v2',audience:'meri:objective-retained-result-reader:v2'}),
});
export const readerTokenType='capiro-objective-reader-v2+jwt';
export const readerLimits=Object.freeze({requestBytes:4096,tokenBytes:8192,maxTokenSeconds:60,maxRequestMs:3000,maxResponseBytes:4194304});
const purpose={enum:Object.keys(readerPurposes)};
const binding=object({tenantId:text(),actorId:text(),conversationId:uuid,runId:uuid,attemptId:uuid,workerId:uuid,writerFence:integer(1)});
const canonical=object({canonicalPlanId:uuid,tenantId:uuid,clientId:uuid,objectiveId:uuid,canonicalStrategyId:uuid,canonicalProjectId:uuid,bindingVersion:integer(1,2147483647),epoch:{const:1},requestedIntentId:uuid,requestedObjectiveRevisionId:uuid,requestedObjectiveVersion:integer(1,2147483647),snapshotHash:sha});
const admission=object({schemaVersion:{const:1},namespace:{const:'capiro.objective-strategy.admission:v1'},canonical:ref('Canonical'),actorUserId:uuid,clerkUserId:text(),consentId:uuid,controlVersion:integer(1,2147483647),generationJobId:uuid,generationRequestId:uuid,admittedAtMs:integer(),effectExpiresAtMs:integer(),expectedStrategyVersionId:{type:'null'}});
const issuance=object({issuanceKey:sha,binding:ref('Binding'),requestSha256:sha,expiresAtMs:integer(1),grantId:uuid,capabilitySha256:sha,factsSha256:sha});
const selector=object({generationJobId:uuid,sourceAdmissionSha256:sha});
const request=object({schemaVersion:{const:2},purpose,generationJobId:uuid,sourceAdmissionSha256:sha});
const scope=object({purpose,operation:{enum:['objective.source.read','objective.retained-result.read']},phase:{enum:Object.values(readerPurposes).map(v=>v.phase)},method:{const:'POST'},path:{enum:Object.values(readerPurposes).map(v=>v.path)},query:{const:''},bodySha256:sha,sourceAdmissionSha256:sha,generationJobId:uuid});
scope.oneOf=Object.entries(readerPurposes).map(([purpose,p])=>({properties:{purpose:{const:purpose},operation:{const:p.operation},phase:{const:p.phase},path:{const:p.path}}}));
const header=object({alg:{const:'EdDSA'},typ:{const:readerTokenType},kid:{type:'string',pattern:'^[A-Za-z0-9._-]{1,64}$'}});
const claims=object({iss:text(256),sub:text(256),aud:text(256),iat:integer(),nbf:integer(),exp:integer(),jti:{type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'},objective:ref('Scope')});
const observation=object({schemaVersion:{const:2},purpose:{enum:['active-source','historical-source']},generationJobId:uuid,sourceAdmission:ref('Admission'),sourceAdmissionSha256:sha,binding:ref('Binding'),sourceRequestSha256:sha,issuance:ref('Issuance'),typedRequestSha256:sha,executionContextSha256:sha,acceptedRequestId:uuid,acceptedPromptSha256:sha,queuedType:{enum:[...strategyTypes]},runState:{enum:['queued','starting','running','completed','failed','cancelled']},checkedAtMs:integer(),expiresAtMs:integer(1)});
const retained=object({schemaVersion:{const:1},generationJobId:uuid,binding:ref('Binding'),sourceAdmissionSha256:sha,sourceRequestSha256:sha,typedRequestSha256:sha,completionId:uuid,checkpointId:uuid,checkpointSha256:sha,resultRef:uuid,resultSha256:sha,file:object({path:{const:'meri-objective-strategy-draft.result.json'},object:{$ref:'urn:meri:contracts:0.1.0#/$defs/ObjectReference'}}),rawFileSha256:sha,execution:{$ref:'urn:meri:candidate:strategy-operations:20261015:2#/$defs/ExecutionProvenance'},result:{$ref:'urn:meri:candidate:strategy-operations:20261015:2#/$defs/Result'},checkedAtMs:integer(),expiresAtMs:integer(1)});
export const objectiveReaderSchema={
 $schema:'https://json-schema.org/draft/2020-12/schema',
 $id:'https://capiro.ai/contracts/objective-reader/2',
 $defs:{Binding:binding,Canonical:canonical,Admission:admission,Issuance:issuance,Selector:selector,Request:request,Header:header,Scope:scope,Claims:claims,Observation:observation,Retained:retained},
};
