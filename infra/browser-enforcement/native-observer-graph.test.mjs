import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileNativeWatchdogDefinition} from './workflow.mjs';
import {createManagedWatchdogReadback} from '../../apps/runtime/native-watchdog-readback.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
const path=process.env.MERI_TEST_JSONATA;
assert.equal(typeof path,'string','Explicit retained evaluator required');
assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),'8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b');
const jsonata=createRequire(import.meta.url)(path);
const observer={schema:'meri-native-managed-observer/1',protocol:'native-observer-around-managed/1',
 route:'/v1/execution/native/physical-observer',authenticationPrincipal:'native-watchdog-observer-v1',
 bridgeFunctionVersionArn:'arn:aws:lambda:us-east-1:111122223333:function:observer:3'};
const def=compileNativeWatchdogDefinition({physicalObserver:observer}),s=def.States;
const placement={availabilityZone:'us-east-1a',vpcId:'vpc-0123456789abcdef0',subnetId:'subnet-0123456789abcdef0',
 securityGroupIds:['sg-0123456789abcdef0'],iamInstanceProfile:'host'};
const launch={ImageId:'ami-0123456789abcdef0',InstanceType:'c7g.large',SubnetId:placement.subnetId,
 SecurityGroupIds:placement.securityGroupIds,IamInstanceProfile:{Name:'host'}};
const owner=createManagedWatchdogReadback({stateMachineVersionArn:'arn:aws:states:us-east-1:111122223333:stateMachine:meri:7',
 definitionSha256:createHash('sha256').update(JSON.stringify(def)).digest('hex'),qualificationEvidenceSha256:'a'.repeat(64),now:()=>1001});
const intent=await owner.makeIntent({hostId:'0f8fad5b-d9cb-469f-a165-70867728950e',generation:1,t0Ms:1000,
 deadlineMs:61000,leaseDeadlineMs:61000,cleanupCeilingMs:86000,allocationSha256:'b'.repeat(64),sourceCommit:'c'.repeat(40),
 imageDigest:'sha256:'+'d'.repeat(64),bootstrapSha256:'e'.repeat(64),placementSha256:hash(placement),launchSha256:hash(launch),
 controlPolicySha256:'f'.repeat(64),provisionToken:'1'.repeat(64),physicalObserver:observer,placement,launch});
async function ev(text,ctx={},ms=1000,input=intent.input){const q=jsonata(text.slice(3,-3));
 q.registerFunction('now',()=>new Date(ms).toISOString(),'<:s>');
 return q.evaluate({}, {ctx,states:{input,context:{Execution:{Id:intent.executionArn,Input:intent.input}}}});}
test('/2 real makeIntent output admits and every compiled expression/transition is valid',async()=>{
 const visit=value=>{if(typeof value==='string'&&value.startsWith('{% '))jsonata(value.slice(3,-3));
  else if(value&&typeof value==='object')Object.values(value).forEach(visit);};visit(def);
 for(const state of Object.values(s))for(const next of [state.Next,state.Default,...(state.Choices??[]).map(x=>x.Next),
  ...(state.Catch??[]).map(x=>x.Next)].filter(Boolean))assert.ok(s[next],next);
 assert.equal(await ev(s.AdmissionGuard.Choices[0].Condition),true);
 assert.equal(await ev(s.AdmissionGuard.Choices[0].Condition,{},1000,{...intent.input,schema:'meri-native-watchdog-input/1'}),false);
 const initialized=await ev(s.Initialize.Assign.ctx);assert.deepEqual(initialized.placement,placement);
 assert.equal(await ev(s.PrearmWait.Seconds,initialized,56000),5,'wake at lease, not cleanup ceiling');
 assert.equal(initialized.cleanupCeilingMs,86000);
});
test('same instance with changed resource mapping has only one managed attempt even after unknown ACK',async()=>{
 const instanceId='i-0123456789abcdef0',rootVolumeId='vol-0123456789abcdef0';
 let ctx={...await ev(s.Initialize.Assign.ctx),owned:[{instanceId,rootVolumeId},{instanceId,rootVolumeId:'vol-11111111'}],index:0};
 ctx=await ev(s.DeduplicateOwned.Assign.ctx,ctx,61000);
 assert.equal(ctx.owned.length,1);assert.equal(ctx.mappingConflict,true);assert.equal(ctx.uncertain,true);
 const marker=await ev(s.CaptureManagedAttempt.Output,ctx,62000);
 assert.deepEqual(await ev(s.MarkManagedAttempt.Output,ctx,62001,marker),marker);
 ctx=await ev(s.MarkManagedAttempt.Assign.ctx,ctx,62001,marker);
 assert.equal(ctx.terminations,1);assert.equal(ctx.attempted[instanceId].instanceId,instanceId);
 assert.equal(await ev(s.ManagedAttemptGate.Choices[0].Condition,ctx,63000),true);
 assert.equal(s.ManagedAttemptGate.Choices[0].Next,'NextOwned');
 assert.equal(Object.hasOwn(s.TerminateOwned,'Retry'),false);
 assert.equal(s.TerminateOwned.Catch[0].Next,'NextOwned');
 assert.equal(await ev(s.TerminateBudget.Choices[0].Condition,ctx,86000),false);
});
test('observer failure preserves original graph cleanup and bridge has only observational modes',()=>{
 assert.equal(s.ObserverPrepare.Catch[0].Next,'CaptureManagedAttempt');
 assert.equal(s.CaptureManagedAttempt.Next,'MarkManagedAttempt');
 assert.equal(s.ObserverPrepare.Arguments.Payload.mode,'prepare');assert.equal(s.ObserverObserve.Arguments.Payload.mode,'observe');
 assert.equal(s.TerminateOwned.Resource,'arn:aws:states:::aws-sdk:ec2:terminateInstances');
 assert.equal(s.ObserverPrepare.Arguments.InvocationType,'RequestResponse');
 assert.equal(Object.hasOwn(s.ObserverPrepare,'Retry'),false);
 assert.equal(s.ObserverPrepare.Arguments.FunctionName,observer.bridgeFunctionVersionArn);
});
test('optional prepare is skipped near the ceiling and its timeout includes transition slack',async()=>{
 let ctx={...await ev(s.Initialize.Assign.ctx),owned:[{instanceId:'i-0123456789abcdef0'}],index:0};
 assert.equal(await ev(s.ObserverPrepareBudget.Choices[0].Condition,ctx,82000),false);
 assert.equal(await ev(s.ObserverPrepareBudget.Choices[0].Condition,ctx,79999),true);
 const timeout=await ev(s.ObserverPrepare.TimeoutSeconds,ctx,79999);assert.equal(timeout,3);
 // Include 1001ms beyond the configured timeout for task delivery and Pass/Choice transitions.
 const marker=await ev(s.CaptureManagedAttempt.Output,ctx,83500);
 ctx=await ev(s.MarkManagedAttempt.Assign.ctx,ctx,83900,marker);
 assert.equal(await ev(s.TerminateBudget.Choices[0].Condition,ctx,84000),true);
 assert.equal(await ev(s.TerminateBudget.Choices[0].Condition,ctx,85000),true);
 assert.equal(await ev(s.TerminateOwned.TimeoutSeconds,ctx,85000),1);
});
