/** Actual preparer, metadata and intent owners; SQL, current access and Core effect ports are scripted. */
import {createNativeAttachmentFilingPreparer} from '../attachment-filing-services.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {createMetadataPoolFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {mount,id,NOW,canonicalSha256 as hash} from './fixture.mjs';
export async function nativeFilingFixture({missing=false}={}){
 const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},clientId=id(5);
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'p1'}],now=()=>state.now;
 const raw={clientId,conversationId:binding.conversationId,objects:[{objectId:id(6),versionId:'opaque-version',sha256:'a'.repeat(64),bytes:2,scopes}]};
 const state={now:NOW,decision:null,outcome:null,unknown:false,loseAck:false,effects:0,executes:0,records:0,inspections:0,mutate:null},sql=createMetadataPoolFixture();
 const pool={options:sql.pool.options,async connect(){const c=await sql.pool.connect();return {async query(q){return typeof q==='string'?{rows:[]}:c.query(q);},release:e=>c.release(e)};}};
 const preparer=createNativeAttachmentFilingPreparer({pool,binding,scopes,selectedClientId:clientId,policyRevision:'p1',expiresAtMs:NOW+60000,now,maxRequestMs:3000,
  async readCurrent(){return {binding,scopes,selectedClientId:clientId,policyRevision:'p1',checkedAtMs:now(),expiresAtMs:now()+5000};},
  custody:{async inspectSelections(){state.inspections++;}}});
 const deliveryId='sdk:'+'a'.repeat(64),operation={id:'save_chat_attachments',version:'0.2.0'},m=mount({binding,preparers:[preparer],now,scopes});
 const prepare=()=>m.mount.prepare({operation,arguments:raw,deliveryId}),{proposal}=await prepare();
 const principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId]};
 const decisions={async record(call){state.records++;state.decision??={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:call.decision,
  decidedAt:new Date(now()).toISOString(),expiresAt:proposal.expiresAt,approver:call.approver,policyRevision:'p1'};return {decision:state.decision,checkedAtMs:now(),revoked:false};},async readDecision(){return state.decision;}};
 const filing={async execute({decision}){state.executes++;if(state.unknown)return {status:'indeterminate'};
  if(!state.outcome){state.effects++;state.outcome={execution:{kind:'native-artifact-file',proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey,
   binding,completedAt:new Date(now()).toISOString(),approvalDecisionSha256:hash(decision)},result:{commandSha256:proposal.commandSha256,files:[{object:proposal.command.attachments[0],status:'saved',fileName:'file.txt',documentId:id(9),location:'/files',indexingStatus:'pending',reused:false}]}};}
  if(state.loseAck){state.loseAck=false;throw Error('lost Core acknowledgement');}const outcome=structuredClone(state.outcome);state.mutate?.(outcome);return {status:'observed',outcome};},
  async read(){return state.unknown?{state:'UNKNOWN'}:state.outcome?{state:'OUTCOME',outcome:state.outcome}:null;}};
 const owner=createIntentApprovalOwner({journal:m.store.port,decisions,...(missing?{}:{filing}),now,limits:{maxRequestMs:3000},enabled:true});
 const request={conversationId:binding.conversationId,deliveryId,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved'};
 return {binding,scopes,raw,state,sql,proposal,principal,request,owner,prepare,store:m.store,
  decide:(extra={})=>owner.decide({principal,request:{...request,...extra}}),list:()=>owner.list({principal,request:{conversationId:binding.conversationId}})};
}
