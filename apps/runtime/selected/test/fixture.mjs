import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createTaskSelectedSkills} from '../task.mjs';import {createSelectedControl} from '../control.mjs';
import {runtimeFixture} from '../../../worker/conversation/skills/test/runtime-fixture.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createSelectedOutputRetention} from '../../../control/conversations/skills/retention.mjs';
import {storeFixture} from '../../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
export async function fixture({queued=false}={}){const f=runtimeFixture(),base=storeFixture(),store=createPostgresConversationStore({pool:base.pool}),c=f.configuration,binding=c.binding,scopes=c.scopes,createdAt=new Date(c.now()).toISOString();
 const run={binding,state:'queued',scopes,createdAt,policyRevision:scopes[0].policyRevision,versions:c.versions},conversation={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt,policyRevision:run.policyRevision};
 const event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
 await store.accept({conversation,run,request:c.request,event},()=>{});for(const state of queued?[]:['starting','running'])await store.append(binding,{eventId:randomUUID(),createdAt,type:'run.status',data:{state,reasonCode:null}},()=>{});
 const retained=createSelectedOutputRetention({journal:store.selectedOutputs,now:c.now,currentOutputAccess:async()=>{throw Error('NO_OUTPUT_APPROVAL');}}),reads=new Map(),calls=[];let control;
 const ledger={async claim(value){const k=hash(value);if(reads.has(k))return {claimed:false};reads.set(k,'PENDING');return {claimed:true};},async retain(value,result){assert.equal(typeof result,'string');reads.set(hash(value),'RETAINED');},async unknown(value){reads.set(hash(value),'UNKNOWN');}};
 control=createSelectedControl({sourceEnabled:true,now:c.now,ledger,loadCurrentTask:async value=>{calls.push(value.operation);if(value.capability!=='synthetic-task-capability'||f.state.revoked)throw Error('CURRENT_TASK_REFUSED');return {binding,versions:c.versions,request:c.request,scopes,selectedClientId:f.selection.subject.entityIds[0],checkedAtMs:c.now(),expiresAtMs:c.now()+5000};},executionOptions:{admissionForBinding:()=>({currentSkillRun:c.currentSkillRun}),gatewayForBinding:()=>({execute:c.gateway.execute,readForSkill:c.readForSkill}),readSelection:async()=>f.selection,readContext:async()=>({context:f.context,checkedAtMs:c.now(),expiresAtMs:c.now()+5000}),retention:retained,defaultCongress:119,publishForBinding:async({output,signal})=>{const result=await control.publication.prepareEvent({binding,request:c.request,scopes,selectedClientId:f.selection.subject.entityIds[0],output,signal});await store.append(binding,result.event,()=>{},scopes);}}});
 const task=createTaskSelectedSkills({sourceEnabled:true,now:c.now,native:{call:(path,input,{signal}={})=>control.handle(path.split('/')[1],input,'synthetic-task-capability',signal)}});
 return {f,base,store,control,task,reads,calls};
}
