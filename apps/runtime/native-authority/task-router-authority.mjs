/** Read-only join of immutable issuance, canonical allocation journal and current admission. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {remoteOriginal,exactOriginal,digest} from './remote-task-boundary.mjs';
import {parseTransport} from '../prepared-run-issuance.mjs';
import {matchesCapability} from './task-verifier.mjs';
import {taskRouterFault,taskRouterOperation,taskRouterRole} from './task-router-boundary.mjs';
const refuse=()=>{throw taskRouterFault();};
export function createTaskRouterAuthority(configuration){
 const c=own(configuration,['issuanceStore','allocations','admissionForBinding','controlCapabilitySha256','operations','transport'],['approvedReads','now','objectiveFacts','objectiveExecutionSelection']),now=c.now??Date.now;
 if((c.objectiveFacts===undefined)!==(c.objectiveExecutionSelection===undefined))refuse();
 const readIssuance=storageMethod(c.issuanceStore,'read'),readAllocation=storageMethod(c.allocations,'read'),transport=parseTransport(c.transport),operations=data(c.operations);
 if(typeof now!=='function'||typeof c.admissionForBinding!=='function'||!digest(c.controlCapabilitySha256)||!Array.isArray(operations)||!operations.length||new Set(operations).size!==operations.length)refuse();
 const approvedReads=c.approvedReads===undefined?{}:{approvedReads:data(c.approvedReads)};
 async function verify(value){
  const v=own(value,['original','operation','credential','check'],['signal']);nativeSignal(v.signal);const original=remoteOriginal(v.original),operation=taskRouterOperation(v.operation),cleanup=operation==='stop';
  if(typeof v.check!=='function'||typeof v.credential!=='string'||!/^\S{1,8192}$/u.test(v.credential))refuse();
  const check=()=>{v.check();if(v.signal?.aborted||!cleanup&&now()>=original.expiresAtMs)refuse();};check();
  const issued=await readIssuance({issuanceKey:original.executionKey});check();
  if(!issued||issued.state!=='ISSUED'||issued.issuanceKey!==original.executionKey||hash(issued.binding)!==original.executionKey||issued.expiresAtMs!==original.expiresAtMs||!digest(issued.capabilitySha256)||!digest(issued.factsSha256)||issued.capabilitySha256===c.controlCapabilitySha256)refuse();
  if(!taskRouterRole(operation,matchesCapability(v.credential,c.controlCapabilitySha256),matchesCapability(v.credential,issued.capabilitySha256)))refuse();
  const saved=await readAllocation({binding:original.binding,allocationKey:original.executionKey},check);check();const record=saved?.record;
  if(!record||!(cleanup?['ALLOCATED','ADMITTED','UNKNOWN']:['ADMITTED']).includes(record.state)||!record.resource||!saved.run||hash(saved.run.binding)!==original.executionKey||!cleanup&&!['queued','starting','running'].includes(saved.run.state))refuse();
  exactOriginal(record.original,original);
  if(record.allocationKey!==original.executionKey||record.expiresAtMs!==original.expiresAtMs||hash(record.binding)!==original.executionKey||!Array.isArray(record.grantIntents))refuse();
  const grant=record.grantIntents.find(g=>g.grantId===issued.grantId);
  if(!grant||grant.capabilitySha256!==issued.capabilitySha256||grant.expiresAtMs!==original.expiresAtMs)refuse();
  const facts={original,allocationSha256:record.allocationSha256,taskRequestSha256:record.taskRequestSha256,qualification:record.qualification,grantIntents:record.grantIntents,grantId:issued.grantId,operations,controlCapabilitySha256:c.controlCapabilitySha256,transport,...approvedReads};
  const pair=c.objectiveFacts===undefined?null:await c.objectiveFacts.pairFor({binding:original.binding,executionSelection:c.objectiveExecutionSelection,signal:v.signal});check();
  if(hash(pair?{...facts,...pair}:facts)!==issued.factsSha256)refuse();
  const keys=['taskArn','createdAtMs','clusterArn','taskDefinitionArn','containerName'],resource=data(Object.fromEntries(keys.map(k=>[k,record.resource[k]])));
  let expiresAtMs=original.expiresAtMs;
  if(!cleanup){
   const admissionRecord=Object.fromEntries(['state','original','grantIntents','resource','qualification','allocationSha256','taskRequestSha256','allocationKey'].map(k=>[k,record[k]]));
   const admission=await c.admissionForBinding({binding:original.binding,record:admissionRecord});check();const began=now();
   const admitted=await storageMethod(admission,'read')({taskArn:resource.taskArn,signal:v.signal});check();
   if(admitted?.state!=='ADMITTED'||hash(admitted.grantFactsJsons)!==hash(record.resource.grantFactsJsons)||typeof admitted.currentAllocationJson!=='string'||Buffer.byteLength(admitted.currentAllocationJson)>131072)refuse();
   const current=data(JSON.parse(admitted.currentAllocationJson));own(current,['binding','policyRevision','deadlineMs','checkedAtMs','allocation','allocationSha256']);
   if(hash(current.binding)!==original.executionKey||current.policyRevision!==record.qualification.policyRevision||current.allocationSha256!==record.allocationSha256||hash(current.allocation)!==record.allocationSha256||!Number.isSafeInteger(current.checkedAtMs)||current.checkedAtMs<began||current.checkedAtMs>now()||!Number.isSafeInteger(current.deadlineMs)||current.deadlineMs<=now())refuse();
   expiresAtMs=Math.min(expiresAtMs,current.deadlineMs);
  }
  check();return Object.freeze({original,resource,expiresAtMs,pinSha256:hash({factsSha256:issued.factsSha256,resource})});
 }
 return Object.freeze({verify});
}
