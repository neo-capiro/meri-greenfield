/** Synthetic fixtures shaped from AWS HistoryEvent/TaskScheduledEventDetails API models; no real provider qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {normalizeNativeObserverResponse as normalize} from '../native-observer-wire.mjs';
import {deriveNativeManagedProvenance,assertNativeHistoryFacts} from '../../control/browser-hosts/native-physical-history.mjs';
import {observerFixture,uuid,instanceId} from './native-observer-fixture.mjs';
const f=await observerFixture(),w=f.declaration.watchdog;
const marker={instanceId,attemptId:`${w.executionArn}:${instanceId}`,attemptedAtMs:62000};
function history(){
 const state=(id,previousEventId,type,name,at,output=marker)=>({id,previousEventId,type,timestamp:new Date(at),
  [type.endsWith('Entered')?'stateEnteredEventDetails':'stateExitedEventDetails']:{name,
   [type.endsWith('Entered')?'input':'output']:JSON.stringify(output),
   [type.endsWith('Entered')?'inputDetails':'outputDetails']:{truncated:false}}});
 return {...f.meta,events:[
  state(20,19,'PassStateExited','CaptureManagedAttempt',62001),
  state(21,20,'PassStateEntered','MarkManagedAttempt',62002),
  state(22,21,'PassStateExited','MarkManagedAttempt',62003),
  state(23,22,'ChoiceStateEntered','TerminateBudget',62004),state(24,23,'ChoiceStateExited','TerminateBudget',62005),
  state(25,24,'TaskStateEntered','TerminateOwned',62006),
  {id:26,previousEventId:25,type:'TaskScheduled',timestamp:new Date(62007),taskScheduledEventDetails:{
   resourceType:'aws-sdk:ec2',resource:'terminateInstances',region:'us-east-1',parameters:JSON.stringify({InstanceIds:[instanceId]}),timeoutInSeconds:10}},
 ]};
}
function entry(api,n=1){return {sequence:n,operationId:uuid(n),phase:'managed',stage:'provenance',sessionId:uuid(50),startedAtMs:63000,callDeadlineMs:65000,
 request:{api,executionArn:w.executionArn,...(api==='GetExecutionHistory'?{nextToken:null,maxResults:100,reverseOrder:false,includeExecutionData:true}:{})},completion:null};}
function complete(e,raw){return {...e,completion:normalize(raw,{row:f.row,event:e,completedAtMs:64000})};}
function journal(raw=history()){
 const describe={...f.meta,executionArn:w.executionArn,stateMachineArn:w.stateMachineVersionArn.replace(/:7$/u,''),
  stateMachineVersionArn:w.stateMachineVersionArn,input:JSON.stringify(w.input),inputDetails:{included:true},redriveCount:0,
  status:'RUNNING',startDate:new Date(1001)};
 return {entries:[complete(entry('DescribeExecution'),describe),complete(entry('GetExecutionHistory',2),raw)]};
}
test('authenticated history retains earlier attempt time independently of later AWS marker and schedule timestamps',()=>{
 const j=journal();assert.equal(j.entries[1].completion.outcome,'success');
 const p=deriveNativeManagedProvenance({journal:j,row:f.row,sessionId:uuid(50)});
 assert.equal(p.attempts[0].attemptedAtMs,62000);assert.equal(p.events.find(e=>e.historyEventId===22).atMs,62003);
 assert.equal(p.scheduled[0].atMs,62007);assert.equal(p.events.find(e=>e.historyEventId===26).attemptedAtMs,null);
 assert.equal(p.events.find(e=>e.historyEventId===26).outcomeDigest,hash({InstanceIds:[instanceId]}));
});
test('missing, unsafe, misplaced, conflicting and wrong-lineage attempt facts fail closed',()=>{
 for(const change of [
  r=>{r.events[2].stateExitedEventDetails.output=JSON.stringify({instanceId,attemptId:marker.attemptId});},
  r=>{r.events[2].stateExitedEventDetails.output=JSON.stringify({...marker,attemptedAtMs:Number.MAX_SAFE_INTEGER+1});},
  r=>{r.events[2].stateExitedEventDetails.output=JSON.stringify({...marker,attemptedAtMs:60000});},
  r=>{r.events[2].stateExitedEventDetails.outputDetails.truncated=true;},
 ]){const r=history();change(r);assert.equal(journal(r).entries[1].completion.outcome,'invalid-response');}
 for(const change of [r=>{r.events[2].previousEventId=19;},r=>{r.events[6].previousEventId=23;},
  r=>{r.events[1].stateEnteredEventDetails.input=JSON.stringify({...marker,attemptedAtMs:62001});}]){
  const r=history();change(r);assert.throws(()=>deriveNativeManagedProvenance({journal:journal(r),row:f.row,sessionId:uuid(50)}));
 }
 const j=journal(),e=j.entries[1];e.completion.facts.events[0].attemptedAtMs=62000;
 assert.throws(()=>assertNativeHistoryFacts(e,e.completion,f.row));
});
test('incomplete page chain or changed exact EC2 request never asserts managed dispatch ordering',()=>{
 const r=history();r.nextToken='more-pages';assert.throws(()=>deriveNativeManagedProvenance({journal:journal(r),row:f.row,sessionId:uuid(50)}));
 const extra=history();extra.events[6].taskScheduledEventDetails.parameters=JSON.stringify({InstanceIds:[instanceId],DryRun:false});
 assert.equal(journal(extra).entries[1].completion.outcome,'invalid-response');
});
