import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {assertDocumentDraftProposal} from '../../../../../packages/contracts/commands-0.2/validate.mjs';
import {createCommandApprovalMetadataOwner} from '../owner.mjs';
import {createPostgresApprovalMetadataStore} from '../postgres-store.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture,NOW,id} from './fixture.mjs';

export function draftMetadataFixture(){
 const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(7),policyRevision:'policy-1'}],context={binding,scopes};
 const request={preparationSha256:'a'.repeat(64),artifactRequestSha256:'b'.repeat(64),sourceContextSha256:'c'.repeat(64),baseVersionId:null,title:'Selected draft',format:'docx'};
 const sql=createMetadataPoolFixture(),policy=createMetadataPolicyFixture({binding,scopes,requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId},expiresAt:new Date(NOW+60000).toISOString()});let n=100;
 const owner=createCommandApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:sql.pool}),commandContext:context,preparePolicy:policy.preparePolicy,now:()=>NOW,newId:()=>id(n++)},'document.draft');
 const input={arguments:request,attachments:[]},call={operation:{id:'create_word',version:'0.2.0'},action:'document.draft',binding,request,input,inputSha256:hash(input),deadlineMs:NOW+1000,signal:undefined};
 return {binding,scopes,context,request,sql,policy,owner,call};
}
test('document metadata uses the existing immutable SQL owner and exact native proposal',async()=>{
 const f=draftMetadataFixture(),record=await f.owner.prepare(f.call),payload=[...f.sql.rows.values()][0].payload;
 const proposal={proposalId:record.proposalId,command:{contractVersion:'0.2.0',commandId:record.commandId,binding:f.binding,action:'document.draft',arguments:f.request,attachments:[],scopes:f.scopes,idempotencyKey:record.idempotencyKey},commandSha256:payload.commandSha256,createdAt:record.createdAt,expiresAt:record.expiresAt,requiredApprover:record.requiredApprover};
 assertDocumentDraftProposal(proposal,f.context);assert.equal(f.sql.rows.size,1);
 const read=await f.owner.read({operation:f.call.operation,action:f.call.action,binding:f.binding,proposalId:record.proposalId,commandSha256:payload.commandSha256,deadlineMs:NOW+1000,signal:undefined});
 assert.deepEqual(read,record);assert.deepEqual(f.policy.calls.map(x=>x.phase),['prepare','before_release','before_read','read_release']);
});
for(const change of ['operation','binding','input','scope','release'])test(`document metadata refuses ${change} substitution without inventing approval`,async()=>{
 const f=draftMetadataFixture();
 if(change==='operation')f.call.operation={id:'create_task',version:'0.2.0'};
 if(change==='binding')f.call.binding={...f.binding,actorId:id(90)};
 if(change==='input')f.call.input={arguments:{...f.request,title:'changed'},attachments:[]};
 if(change==='scope')f.policy.state.mutate=r=>r.scopes=[{...f.scopes[0],resourceId:id(90)}];
 if(change==='release')f.policy.state.denyPhase='before_release';
 await assert.rejects(f.owner.prepare(f.call));assert.equal(f.sql.rows.size,change==='release'?1:0);
});
