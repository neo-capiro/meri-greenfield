import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createManagedWatchdogReadback} from '../native-watchdog-readback.mjs';
import {compileNativeWatchdogDefinition} from '../../../infra/browser-enforcement/workflow.mjs';
import {observerFixture} from './native-observer-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
const fixture=await observerFixture(),{physicalObserver,placement,launch}=fixture.declaration;
const protectedArgs={physicalObserver,placement,launch,placementSha256:hash(placement),launchSha256:hash(launch),
 leaseDeadlineMs:876000,cleanupCeilingMs:901000};
const base='arn:aws:states:us-east-1:111122223333:stateMachine:meri',versionArn=base+':7';
const compiled=compileNativeWatchdogDefinition({physicalObserver});
const definition=JSON.stringify(compiled);
assert.notEqual(compiled.States.AdmissionGuard.Choices[0].Condition,'{% false %}');
assert.match(compiled.States.AdmissionGuard.Choices[0].Condition,/meri-native-watchdog-input\/2/);
assert.match(JSON.stringify(compiled),/MeriProvisionToken/);
assert.doesNotMatch(JSON.stringify(compiled),/stateMachineVersionArn/);
const definitionSha256=createHash('sha256').update(definition).digest('hex');
const qualificationEvidenceSha256='b'.repeat(64),hostId='0f8fad5b-d9cb-469f-a165-70867728950e',generation=3;
const t0Ms=1000,deadlineMs=901000;
function sdkWith(state){
 class DescribeExecutionCommand{constructor(input){this.input=input;}}
 class DescribeStateMachineCommand{constructor(input){this.input=input;}}
 class StartExecutionCommand{constructor(input){this.input=input;}}
 return {DescribeExecutionCommand,DescribeStateMachineCommand,StartExecutionCommand,
  async send(command){
   const name=command.constructor.name;
   if(name==='StartExecutionCommand'){
    if(state.execution)throw Object.assign(Error('exists'),{name:'ExecutionAlreadyExists'});
    state.execution={executionArn:command.input.stateMachineArn.replace(/stateMachine:([^:]+):\d+$/u,`execution:$1:${command.input.name}`),
     stateMachineArn:base,stateMachineVersionArn:versionArn,status:'RUNNING',startDate:new Date(t0Ms+10),input:command.input.input};
    return {executionArn:state.execution.executionArn};
   }
   if(name==='DescribeExecutionCommand'){
    if(state.execution===null)throw Object.assign(Error('absent'),{name:'ExecutionDoesNotExist'});
    return {...state.execution};}
   if(name==='DescribeStateMachineCommand')return {stateMachineArn:versionArn,revisionId:'synthetic-revision',
    type:'STANDARD',status:'ACTIVE',definition:state.definition};
   throw Error(name);
  }};
}
test('producer persists one deterministic execution, reads the exact version/definition and recovers lost ACK',async()=>{
 const state={execution:null,definition};const sdk=sdkWith(state),sfn={sdk,send:sdk.send};
 const owner=createManagedWatchdogReadback({stateMachineVersionArn:versionArn,definitionSha256,
  qualificationEvidenceSha256,now:()=>t0Ms+20});
 const intent=await owner.makeIntent({hostId,generation,t0Ms,deadlineMs,allocationSha256:'a'.repeat(64),
  sourceCommit:'c'.repeat(40),imageDigest:'sha256:'+'d'.repeat(64),bootstrapSha256:'e'.repeat(64),
  placementSha256:'f'.repeat(64),launchSha256:'1'.repeat(64),controlPolicySha256:'2'.repeat(64),
  provisionToken:'3'.repeat(64),...protectedArgs});
 const armed=await owner.arm({stepFunctions:sfn,intent});
 assert.equal(armed.armed,true);assert.equal(state.execution.executionArn,intent.executionArn);
 assert.equal(JSON.parse(state.execution.input).schema,'meri-native-watchdog-input/2');
 const again=await owner.arm({stepFunctions:sfn,intent});
 assert.equal(again.executionArn,intent.executionArn);assert.equal(state.execution.executionArn,intent.executionArn);
});
test('a changed reviewed definition is refused even with a running execution',async()=>{
 const state={execution:null,definition:'different'};const sdk=sdkWith(state),sfn={sdk,send:sdk.send};
 const owner=createManagedWatchdogReadback({stateMachineVersionArn:versionArn,definitionSha256,
  qualificationEvidenceSha256,now:()=>t0Ms+20});
 const intent=await owner.makeIntent({hostId,generation,t0Ms,deadlineMs,allocationSha256:'a'.repeat(64),
  sourceCommit:'c'.repeat(40),imageDigest:'sha256:'+'d'.repeat(64),bootstrapSha256:'e'.repeat(64),
  placementSha256:'f'.repeat(64),launchSha256:'1'.repeat(64),controlPolicySha256:'2'.repeat(64),
  provisionToken:'3'.repeat(64),...protectedArgs});
 await assert.rejects(async()=>owner.arm({stepFunctions:sfn,intent}),{code:'NATIVE_WATCHDOG_REFUSED'});
});

test('managed result consumer accepts only correlated proof and retains UNKNOWN custody',async()=>{
 const {validateManagedWatchdogResult}=await import('../native-watchdog-result.mjs');
 const base={schema:'meri-native-watchdog-result/1',hostId,generation,deadlineMs};
 assert.equal(validateManagedWatchdogResult({...base,cleanup:'UNKNOWN',uncertain:true}).status,'UNKNOWN');
 assert.throws(()=>validateManagedWatchdogResult({...base,cleanup:'TERMINATED_AND_CORRELATED_ABSENT',
  instanceId:'i-0123456789abcdef0',rootVolumeId:'vol-0123456789abcdef0',
  networkInterfaceIds:['eni-0123456789abcdef0'],rootAbsentCount:2,eniAbsentCount:2}));
 const unknown=validateManagedWatchdogResult({...base,cleanup:'UNKNOWN',uncertain:true,
  owned:[{instanceId:'i-0123456789abcdef0',rootVolumeId:'vol-0123456789abcdef0',
   networkInterfaceIds:['eni-0123456789abcdef0']}]});
 assert.deepEqual(unknown.owned,[{instanceId:'i-0123456789abcdef0',rootVolumeId:'vol-0123456789abcdef0',
  networkInterfaceIds:['eni-0123456789abcdef0']}]);
});

test('post-ceiling read-only result returns retained UNKNOWN custody from the same execution',async()=>{
 const state={execution:null,definition};const sdk=sdkWith(state),sfn={sdk,send:sdk.send};
 let clock=t0Ms+20;
 const owner=createManagedWatchdogReadback({stateMachineVersionArn:versionArn,definitionSha256,
  qualificationEvidenceSha256,now:()=>clock});
 const intent=await owner.makeIntent({hostId,generation,t0Ms,deadlineMs,allocationSha256:'a'.repeat(64),
  sourceCommit:'c'.repeat(40),imageDigest:'sha256:'+'d'.repeat(64),bootstrapSha256:'e'.repeat(64),
  placementSha256:'f'.repeat(64),launchSha256:'1'.repeat(64),controlPolicySha256:'2'.repeat(64),
  provisionToken:'3'.repeat(64),...protectedArgs});
 await owner.arm({stepFunctions:sfn,intent});
 clock=deadlineMs+1000;
 state.execution.status='SUCCEEDED';
 state.execution.output=JSON.stringify({schema:'meri-native-watchdog-result/1',cleanup:'UNKNOWN',
  hostId,generation,deadlineMs,owned:[{instanceId:'i-0123456789abcdef0',
   rootVolumeId:'vol-0123456789abcdef0',networkInterfaceIds:['eni-0123456789abcdef0']}]});
 const result=await owner.readResult({stepFunctions:sfn,intent});
 assert.equal(result.status,'UNKNOWN');assert.equal(result.quarantine,true);
 assert.equal(result.owned[0].instanceId,'i-0123456789abcdef0');
});

test('D1: legacy intent creation and execution arming refuse before SDK access',async()=>{
 const owner=createManagedWatchdogReadback({stateMachineVersionArn:versionArn,definitionSha256,
  qualificationEvidenceSha256,now:()=>t0Ms+20});
 await assert.rejects(owner.makeIntent({hostId,generation,t0Ms,deadlineMs}),{code:'NATIVE_WATCHDOG_REFUSED'});
 let sends=0;
 await assert.rejects(owner.arm({intent:{input:{schema:'meri-native-watchdog-input/1'}},
  stepFunctions:{send:async()=>{sends++;}}}),{code:'NATIVE_WATCHDOG_REFUSED'});
 assert.equal(sends,0);
});
