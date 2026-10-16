/** Internal current-entry closure shared by original/target composition. No entry creation, material or issuance effects. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {nativeReadConfigurationSha256,nativeReadFault} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {types} from 'node:util';
const same=(a,b)=>hash(a)===hash(b),deny=()=>{throw nativeReadFault('ACCESS_DENIED');};
export function createPreparedReadEntry(configuration){
 const c=own(configuration,['store','issuance','issued','request','readCurrentRun','resource','now'],['maxRequestMs']),issued=data(c.issued),expectedRequest=data(c.request),binding=issued.original.binding;
 const readAllocation=storageMethod(c.store.allocations,'read'),readIssuance=storageMethod(c.issuance,'readIssuance'),now=c.now,maxRequestMs=c.maxRequestMs??3000;
 const readConfigurationSha256=nativeReadConfigurationSha256(issued.approvedReads);
 if([c.readCurrentRun,c.resource,now].some(f=>typeof f!=='function'||types.isProxy(f))||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000||issued.issuance.requestSha256!==hash(expectedRequest)||issued.factsSha256!==issued.issuance.factsSha256)throw nativeReadFault('CONFIGURATION');
 return async function readCurrentEntry(raw){const v=own(raw,['binding','deadlineMs'],['signal']);nativeSignal(v.signal);if(!same(v.binding,binding)||!Number.isSafeInteger(v.deadlineMs))deny();
  const expiresAtMs=Math.min(v.deadlineMs,issued.issuance.expiresAtMs),life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(now()+maxRequestMs,expiresAtMs),errorFactory:()=>nativeReadFault('ACCESS_DENIED')});
  try{
   async function current(){const row=data(await life.run(signal=>c.readCurrentRun(binding,{signal,deadlineMs:expiresAtMs})));life.check();if(!same(row.run.binding,binding)||!['queued','starting','running'].includes(row.run.state)||!same(row.run.versions,issued.original.versions)||row.run.policyRevision!==issued.qualification.policyRevision||!same(row.request,expectedRequest))deny();return row;}
   const before=await current(),receipt=data(await life.run(signal=>readIssuance(issued.issuance,{signal})));if(!same(receipt,issued.issuance))deny();
   const resource=data(c.resource());if(!resource)deny();const saved=data(await life.run(()=>readAllocation({binding,allocationKey:issued.original.executionKey},life.check))),a=saved.record;life.check();
   if(!a||a.state!=='ADMITTED'||!same(a.original,issued.original)||a.allocationSha256!==issued.allocationSha256||a.taskRequestSha256!==issued.taskRequestSha256||!same(a.grantIntents,issued.grantIntents)||a.resource?.taskArn!==resource.taskArn)deny();
   const after=await current();if(!same(before.run.scopes,after.run.scopes)||before.run.policyRevision!==after.run.policyRevision||data(c.resource())?.taskArn!==resource.taskArn)deny();life.check();
   return data({binding,runRequestSha256:receipt.requestSha256,grantId:receipt.grantId,taskArn:resource.taskArn,issuanceFactsSha256:receipt.factsSha256,allocationSha256:issued.allocationSha256,scopes:after.run.scopes,policyRevision:after.run.policyRevision,readConfigurationSha256,checkedAtMs:now(),expiresAtMs});
  }catch{deny();}finally{life.close();}
 };
}
