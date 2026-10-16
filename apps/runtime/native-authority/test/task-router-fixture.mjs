import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createExecutionBinding} from '../../../control/conversations/execution-boundary.mjs';
import {binding,versions} from '../../../control/conversations/test/store-fixture.mjs';
import {capabilityDigest} from '../task-verifier.mjs';
import {createTaskRouterAuthority} from '../task-router-authority.mjs';
import {createTaskRouterIngress} from '../task-router-boundary.mjs';
export function taskRouterFixture(){
 const now=Date.now(),original=createExecutionBinding({binding,versions,plan:{test:'task-router'},expiresAtMs:now+30000}),taskCredential='synthetic-task-router-task',controlCredential='synthetic-task-router-control';
 const prefix='arn:aws:ecs:us-east-1:967807252336:',taskArn=prefix+'task/test/'+'a'.repeat(32),resource={taskArn,clusterArn:prefix+'cluster/test',taskDefinitionArn:prefix+'task-definition/test:1',containerName:'worker',createdAtMs:now-100};
 const grantId='11111111-1111-4111-8111-111111111111',qualification={attempt:1,policyRevision:'b'.repeat(64)},allocation={synthetic:'canonical-admission-output'},allocationSha256=hash(allocation),grantIntents=[{grantId,capabilitySha256:capabilityDigest(taskCredential),expiresAtMs:original.expiresAtMs}];
 const grantFactsJsons=[JSON.stringify({grantId,binding:original.binding,qualificationBinding:{runId:binding.runId,attempt:1,workerArn:taskArn,fence:binding.writerFence,policyRevision:qualification.policyRevision},capabilitySha256:capabilityDigest(taskCredential),allocationSha256})];
 const record={binding:original.binding,allocationKey:original.executionKey,original,expiresAtMs:original.expiresAtMs,allocationSha256,qualification,grantIntents,taskRequestSha256:'c'.repeat(64),state:'ADMITTED',resource:{...resource,grantFactsJsons}};
 const config={operations:['runner/execute'],transport:{origin:'https://router.invalid',http:{hostname:'0.0.0.0',port:8080,frontendOrigin:'https://router.invalid'}},controlCapabilitySha256:capabilityDigest(controlCredential)};
 const facts={original,allocationSha256,taskRequestSha256:record.taskRequestSha256,qualification,grantIntents,grantId,operations:config.operations,controlCapabilitySha256:config.controlCapabilitySha256,transport:config.transport};
 const issued={state:'ISSUED',issuanceKey:original.executionKey,binding:original.binding,requestSha256:'d'.repeat(64),expiresAtMs:original.expiresAtMs,grantId,capabilitySha256:capabilityDigest(taskCredential),factsSha256:hash(facts)};
 const saved={run:{binding:original.binding,state:'running'},record},counts={issuance:0,allocation:0,admission:0,network:0,connect:0,send:0,close:0};let admissionHook=()=>{},issuanceHook=()=>{},allocationHook=()=>{};
 const admission={async read(){counts.admission++;admissionHook();return {state:'ADMITTED',grantFactsJsons,currentAllocationJson:JSON.stringify({binding:original.binding,policyRevision:qualification.policyRevision,deadlineMs:original.expiresAtMs,checkedAtMs:Date.now(),allocation,allocationSha256})};}};
 const authority=createTaskRouterAuthority({...config,issuanceStore:{async read(input){counts.issuance++;issuanceHook();if(input.issuanceKey!==original.executionKey)throw Error('foreign-key');return issued;}},allocations:{async read(input,check){counts.allocation++;allocationHook();check();return saved;}},async admissionForBinding({binding:requested,record:passed}){if(hash(requested)!==hash(original.binding)||Object.hasOwn(passed,'binding')||Object.hasOwn(passed,'expiresAtMs'))throw Error('canonical-admission-interface');return admission;}});
 const candidate={...resource,bindingSha256:hash(original.binding),executionKey:original.executionKey,checkedAtMs:now,networkInterfaceId:'eni-abcdef01',privateIPv4Address:'10.40.1.42',subnetId:'subnet-abcd',vpcId:'vpc-abcd',securityGroupIds:['sg-abcd'],port:8080,expiresAtMs:original.expiresAtMs};
 const privateIngress=createTaskRouterIngress(),ingress=privateIngress.issue();
 const request=(operation='inspect',credential=controlCredential,body={})=>new Request('https://router.invalid/v1/native-task/'+operation,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({original,...body})});
 const verify=(operation='inspect',credential=controlCredential)=>authority.verify({original,operation,credential,check:()=>{}});
 return {original,resource,record,issued,saved,counts,candidate,authority,config,admission,taskCredential,controlCredential,request,verify,privateIngress,ingress,onAdmission:hook=>{admissionHook=hook;},onIssuance:hook=>{issuanceHook=hook;},onAllocation:hook=>{allocationHook=hook;}};
}
