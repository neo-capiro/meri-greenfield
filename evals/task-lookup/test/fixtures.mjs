import {hash} from '../contracts.mjs';
export const id=n=>`acde0000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const NOW='2026-10-12T10:00:00.000Z';
export function input(){
 const binding={tenantId:'synthetic-tenant',actorId:'synthetic-user',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const clientId=id(9),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'test-p1'}];
 const cases=[{caseId:'case-one',groupId:'group-one',split:'held-out',kind:'synthetic',originSha256:'1'.repeat(64),mode:'original',prompt:'Show recommendations for the selected test client.',request:{clientId,limit:20},context:{binding,clientResolution:{reference:clientId,clientId}},scopes,sourceIds:['action_recommendation'],expected:{outcome:'denied',semanticSha256:null,replaySha256:null,recordIds:[],absence:false,exhaustive:false}}];
 const sources=[{sourceId:'action_recommendation',snapshotSha256:'2'.repeat(64),asOf:NOW,receiptSha256:'3'.repeat(64)}];
 const config={sourceCommit:'a'.repeat(40),catalogSha256:'4'.repeat(64),contractsSha256:'5'.repeat(64),imageDigest:null,sdkVersion:null,modelId:null,proxyConfigSha256:'6'.repeat(64),skillManifestSha256:'7'.repeat(64),executionKind:'source-test'};
 return sign({schema:'meri-task-lookup-input/1',cases,sources,config,approval:{receiptId:'synthetic-approval',ownerRef:'test-only',issuedAt:NOW,inputSha256:'0'.repeat(64)}});
}
export function sign(value){value.approval.inputSha256=hash({cases:value.cases,sources:value.sources,config:value.config});return value;}
export const options=value=>({approvalSha256:hash(value.approval)});
export function capture(frozen){
 const c=frozen.input.cases[0],binding=structuredClone(c.context.binding),pin=frozen.casePins[0];
 const auth={original:null,current:binding,scopes:structuredClone(c.scopes),resultReference:id(31),resultSha256:null};auth.bindingSha256=hash(auth);
 const authorization=[{phase:'before_read',binding:auth,receipt:{authorized:false,bindingSha256:auth.bindingSha256,expiresAtMs:Date.parse(NOW)+60000},error:null,observedAtMs:Date.parse(NOW)}];
 return {run:{runId:'evaluation-run-one',corpusSha256:frozen.corpusSha256,configSha256:frozen.configSha256,sourceSetSha256:frozen.sourceSetSha256,startedAt:NOW,completedAt:NOW,bindings:frozen.input.cases.map(c=>({caseId:c.caseId,binding:structuredClone(c.context.binding)}))},observations:c?[{caseId:c.caseId,caseSha256:pin.caseSha256,attemptId:'attempt-one',runId:'evaluation-run-one',configSha256:frozen.configSha256,sourceSetSha256:pin.sourceSetSha256,status:'denied',reason:'SOURCE_DENIED',route:null,authorization,failure:{code:'ACCESS_DENIED',outcome:'NOT_DISPATCHED'},delivery:null,read:null,claims:{absence:false,exhaustive:false,acceptedTasks:false},traceSha256:'8'.repeat(64),startedAt:NOW,completedAt:NOW}]:[]};
}
