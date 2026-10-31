/** Authenticated, retained Step Functions lineage; never a bridge claim or a graph send permit. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {physicalRefused as fail} from './native-physical-journal.mjs';
export const MANAGED_TERMINATE_RESOURCE='arn:aws:states:::aws-sdk:ec2:terminateInstances';
export const HISTORY_STATES=Object.freeze(['CaptureManagedAttempt','MarkManagedAttempt','TerminateBudget','TerminateOwned']);
const int=n=>Number.isSafeInteger(n)&&n>=0;
export function assertNativeHistoryFacts(event,completion,row){
 const w=row.declaration_json.watchdog,f=completion.facts;
 if(event.phase!=='managed'||event.stage!=='provenance'||event.request.executionArn!==w.executionArn)fail();
 if(event.request.api==='DescribeExecution'){
  const v=own(data(f),['executionArn','stateMachineArn','stateMachineVersionArn','inputSha256','status','startAtMs','stopAtMs']);
  if(v.executionArn!==w.executionArn||v.stateMachineVersionArn!==w.stateMachineVersionArn||
   v.stateMachineArn!==w.stateMachineVersionArn.replace(/:[1-9][0-9]*$/u,'')||v.inputSha256!==w.inputSha256||
   !['RUNNING','SUCCEEDED','FAILED','TIMED_OUT','ABORTED'].includes(v.status)||!int(v.startAtMs)||
   v.startAtMs<w.t0Ms||v.startAtMs>w.leaseDeadlineMs||
   (v.stopAtMs!==null&&(!int(v.stopAtMs)||v.stopAtMs<v.startAtMs||v.stopAtMs>completion.completedAtMs)))fail();return;
 }
 const v=own(data(f),['executionArn','nextToken','events']);
 if(event.request.api!=='GetExecutionHistory'||v.executionArn!==w.executionArn||!Array.isArray(v.events)||v.events.length>100||
  (v.nextToken!==null&&(typeof v.nextToken!=='string'||!v.nextToken||Buffer.byteLength(v.nextToken)>2048)))fail();
 let previous=0;
 for(const raw of v.events){
  const e=own(data(raw),['historyEventId','previousEventId','atMs','kind','instanceId','attemptId','attemptedAtMs',
   'taskStateName','taskResource','outcomeDigest']);
  if(!int(e.historyEventId)||e.historyEventId<=previous||!int(e.previousEventId)||e.previousEventId>=e.historyEventId||
   !int(e.atMs)||e.atMs>completion.completedAtMs||e.atMs<w.t0Ms||
   !['state-entered','state-exited','task-scheduled','task-started','task-succeeded','task-failed','task-timed-out'].includes(e.kind)||
   (e.taskStateName!==null&&!HISTORY_STATES.includes(e.taskStateName))||
   (e.taskResource!==null&&e.taskResource!==MANAGED_TERMINATE_RESOURCE)||
   (e.outcomeDigest!==null&&!/^[0-9a-f]{64}$/u.test(e.outcomeDigest)))fail();
  if(e.instanceId!==null&&(!/^i-(?:[0-9a-f]{8}|[0-9a-f]{17})$/u.test(e.instanceId)||e.attemptId!==`${w.executionArn}:${e.instanceId}`))fail();
  if(e.instanceId===null&&e.attemptId!==null)fail();
  const marker=e.kind==='state-exited'&&e.taskStateName==='MarkManagedAttempt';
  if(marker){
   if(e.instanceId===null||!int(e.attemptedAtMs)||e.attemptedAtMs<w.leaseDeadlineMs||e.attemptedAtMs>e.atMs||
    e.attemptedAtMs>=w.cleanupCeilingMs||e.outcomeDigest!==hash({instanceId:e.instanceId,attemptId:e.attemptId,attemptedAtMs:e.attemptedAtMs}))fail();
  }else if(e.attemptedAtMs!==null)fail();
  previous=e.historyEventId;
 }
}
export function deriveNativeManagedProvenance({journal,row,sessionId}){
 const w=row.declaration_json.watchdog;
 const entries=journal.entries.filter(e=>e.phase==='managed'&&e.stage==='provenance'&&e.sessionId===sessionId&&
  e.completion?.outcome==='success'&&e.completion.completedAtMs<=e.callDeadlineMs&&e.completion.completedAtMs<=w.cleanupCeilingMs);
 const describes=entries.filter(e=>e.request.api==='DescribeExecution');if(describes.length<1)fail();
 for(const e of entries)assertNativeHistoryFacts(e,e.completion,row);
 const pages=entries.filter(e=>e.request.api==='GetExecutionHistory');if(!pages.length||pages.length>5)fail();
 let token=null,priorId=0;const events=[];
 for(const [index,page] of pages.entries()){
  if(page.request.nextToken!==token||index>0&&token===null)fail();
  for(const e of page.completion.facts.events){if(e.historyEventId<=priorId)fail();events.push(e);priorId=e.historyEventId;}
  token=page.completion.facts.nextToken;
 }
 if(token!==null)fail();
 const byId=new Map(events.map(e=>[e.historyEventId,e])),attempts=[],scheduled=[];
 for(const marker of events.filter(e=>e.kind==='state-exited'&&e.taskStateName==='MarkManagedAttempt')){
  const entered=byId.get(marker.previousEventId),capture=entered&&byId.get(entered.previousEventId);
  if(entered?.kind!=='state-entered'||entered.taskStateName!=='MarkManagedAttempt'||entered.outcomeDigest!==marker.outcomeDigest||
   capture?.kind!=='state-exited'||capture.taskStateName!=='CaptureManagedAttempt'||capture.outcomeDigest!==marker.outcomeDigest||
   capture.atMs>entered.atMs||entered.atMs>marker.atMs)fail();
  if(attempts.some(a=>a.instanceId===marker.instanceId))fail();
  attempts.push({instanceId:marker.instanceId,attemptId:marker.attemptId,attemptedAtMs:marker.attemptedAtMs,historyEventId:marker.historyEventId});
 }
 if(attempts.length>16)fail();
 for(const task of events.filter(e=>e.kind==='task-scheduled')){
  if(task.taskResource!==MANAGED_TERMINATE_RESOURCE||task.instanceId===null||
   task.outcomeDigest!==hash({InstanceIds:[task.instanceId]}))fail();
  let current=byId.get(task.previousEventId),after=task.atMs;
  for(const [kind,name] of [['state-entered','TerminateOwned'],['state-exited','TerminateBudget'],
   ['state-entered','TerminateBudget'],['state-exited','MarkManagedAttempt']]){
   if(!current||current.kind!==kind||current.taskStateName!==name||current.atMs>after)fail();after=current.atMs;
   if(name==='MarkManagedAttempt'){
    if(current.instanceId!==task.instanceId||current.attemptId!==task.attemptId||task.atMs>=w.cleanupCeilingMs||
     task.atMs<current.attemptedAtMs)fail();
    scheduled.push({instanceId:task.instanceId,attemptId:task.attemptId,atMs:task.atMs,historyEventId:task.historyEventId});
   }else current=byId.get(current.previousEventId);
  }
 }
 if(new Set(scheduled.map(e=>e.instanceId)).size!==scheduled.length)fail();
 return {executionArn:w.executionArn,inputSha256:w.inputSha256,attempts,scheduled,events,
  historyEventIds:events.map(e=>e.historyEventId),eventIds:entries.map(e=>e.operationId)};
}
export function retainedManagedProvenance({journal,row,dispatch,dispatchResult}){
 for(const sessionId of new Set(journal.entries.filter(e=>e.stage==='provenance').map(e=>e.sessionId))){
  let p;try{p=deriveNativeManagedProvenance({journal,row,sessionId});}catch{continue;}
  const claim={executionArn:p.executionArn,inputSha256:p.inputSha256,attempts:p.attempts};
  if(hash(claim)===hash(dispatch)&&hash({executionArn:p.executionArn,historyEventIds:p.historyEventIds})===hash(dispatchResult))return p;
 }fail();
}
