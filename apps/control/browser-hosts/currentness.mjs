/** Full host currentness joins existing allocation, execution, custody, Core
 * and policy owners. It neither provisions a host nor opens browser activation. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {rowRun} from '../conversations/boundary.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../../worker/conversation/host/binding.mjs';
import {assertCapabilityPolicy} from '../../worker/conversation/capabilities/policy.mjs';
import {validateBrowserPolicy} from '../../worker/conversation/browser/policy.mjs';
import {activationOpen} from '../../worker/conversation/browser/activation.mjs';
import {allocationRow,fail,same} from './allocation.mjs';
import {HOST_ALLOCATION_SQL} from './postgres-allocations.mjs';
import {createCurrentBrowserCoreAccess} from './current-core.mjs';
import {createBrowserCustodyCurrentness} from './custody-currentness.mjs';

export function createBrowserHostCurrentness({store,core,nativeCredentials,capabilityPolicy,readBrowserPolicy,now=Date.now,maxRequestMs=3000}){
 const readExecution=storageMethod(store.executions,'readCurrentOnClient'),currentHost=storageMethod(store.lifecycle.browserCustody,'currentHost');
 const forRun=storageMethod(capabilityPolicy,'forRun'),readCore=createCurrentBrowserCoreAccess({core,nativeCredentials,now});
 if(typeof readBrowserPolicy!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)fail();
 const retained=createBrowserCustodyCurrentness({journal:store.lifecycle.browserCustody,core,nativeCredentials,readBrowserPolicy,now,maxRequestMs});
 async function read(client,input,route){
  const v=own(input,['allocation','binding'],['signal','originalBinding','custody']);nativeSignal(v.signal);
  const allocation=assertHostAllocation(v.allocation),binding=assertHostRunBinding(allocation,v.binding);
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(now()+maxRequestMs,allocation.leaseDeadlineMs),errorFactory:()=>Error('BROWSER_HOST_CURRENTNESS_REFUSED')});
  try{
   const rows=await life.run(()=>client.query(HOST_ALLOCATION_SQL.lock,[allocation.hostId,allocation.generation]));
   if(rows.rows.length!==1)fail();const saved=allocationRow(rows.rows[0]),record=saved.record,original=record.originalBinding;
   if(saved.state!=='active'||!same(record.allocation,allocation)||v.originalBinding&&!same(v.originalBinding,original))fail();
   let authorityCutoff=Math.min(allocation.leaseDeadlineMs,record.hostCertificate.notAfterMs,record.serverCertificateNotAfterMs);
   life.limitDeadline(authorityCutoff);
   await life.run(()=>client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${binding.tenantId}:${binding.conversationId}`]));
   const sourceRows=await life.run(()=>client.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[original.tenantId,original.conversationId,original.runId]));
   if(sourceRows.rows.length!==1)fail();const source=rowRun(sourceRows.rows[0]);
   if(!same(source.projection.binding,original))fail();
   const held=source.projection.state==='paused'&&source.hold_control_id!=null;
   if(held&&(route||same(binding,original))){
    const state=await life.run(signal=>route?retained.readRoute(client,{allocation,originalBinding:original,binding,custody:v.custody,signal}):retained.readHost(client,{allocation,binding:original,signal}));
    life.check();return {...state,browserAdmitted:state.browserAdmitted&&activationOpen(),currentUntilMs:Math.min(state.currentUntilMs,authorityCutoff)};
   }
   if(v.custody!=null)fail();
   // A retained physical host admits SDK/Bash only for its exact canonical
   // takeover successor. An unrelated later prompt cannot reuse this host.
   if(!same(binding,original)){
    if(!held||source.projection.scopes.length!==1)fail();const scopes=source.projection.scopes;
    const selectedClientId=scopes[0].kind==='client'?scopes[0].resourceId:null;
    assertNativeConversationScope({binding:original,scopes,selectedClientId});
    const chain=await life.run(()=>currentHost(client,{allocation,binding:original,scopes,selectedClientId},life.check));
    if(chain.phase!=='browser-successor'||!same(chain.browserSuccessor?.binding,binding))fail();authorityCutoff=Math.min(authorityCutoff,chain.currentUntilMs);life.limitDeadline(authorityCutoff);
   }
   const current=await life.run(signal=>readExecution(client,{binding,signal,deadlineMs:life.deadline()},life.check));
   if(!['queued','starting','running'].includes(current.run.state)||!['launching','started'].includes(current.executionPhase)||current.scopes.length!==1)fail();
   life.limitDeadline(current.deadlineMs);
   const selectedClientId=current.scopes[0].kind==='client'?current.scopes[0].resourceId:null;
   assertNativeConversationScope({binding,scopes:current.scopes,selectedClientId});
   const {receipt:authority,recheck}=await readCore({binding,selectedClientId,life});
   const policy=assertCapabilityPolicy(await life.run(signal=>forRun({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,actorRole:authority.role,signal}))??{});
   const browser=validateBrowserPolicy(await life.run(signal=>readBrowserPolicy({binding,scopes:current.scopes,actorRole:authority.role,signal,deadlineMs:life.deadline()})));
   const credentialCutoff=await recheck();life.check();return {binding,phase:'active',sdkAdmitted:true,bashAdmitted:policy.bash,browserAdmitted:browser.enabled&&activationOpen(),
    capabilityPolicySha256:hash(policy),browserPolicySha256:hash(browser),currentUntilMs:Math.min(current.deadlineMs,authority.expiresAtMs,authorityCutoff,credentialCutoff)};
  }finally{life.close();}
 }
 return Object.freeze({readHost:(client,input)=>read(client,input,false),readRoute:(client,input)=>read(client,input,true)});
}
