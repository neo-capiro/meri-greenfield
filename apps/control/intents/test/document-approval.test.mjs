/** Actual intent, immutable metadata and artifact publication owners; synthetic Core decisions and renderer. No live qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {createPostgresIntentJournalStore,createPostgresCommandProposalReader} from '../postgres-journal.mjs';
import {createIntentJournal} from '../journal.mjs';
import {createPreparedSchedulePoolFixture} from './prepared-schedule-fixture.mjs';
import {createCommandApprovalMetadataOwner} from '../../commands/approval-metadata/owner.mjs';
import {createPostgresApprovalMetadataStore} from '../../commands/approval-metadata/postgres-store.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture,id} from '../../commands/approval-metadata/test/fixture.mjs';
import {nativeDocumentFixture} from '../../../artifacts/test/native-document-fixture.mjs';

async function setup(){
 const f=nativeDocumentFixture(),now=()=>f.state.clock,{binding,scopes}=f.context,sql=createPreparedSchedulePoolFixture();
 const request={operation:'create_word',format:'docx',title:'Selected draft',content:{blocks:[{kind:'paragraph',style:'Normal',runs:[{text:'Actual prepared text'}]}]}};
 f.options.executor={async execute({request}){f.state.executions.push(request);const bytes=Buffer.from(JSON.stringify(request));return {bytes,inspection:{sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:1,tables:0,pictures:0}}};}};
 const args={preparationSha256:hash({request,context:f.context}),artifactRequestSha256:hash(request),sourceContextSha256:hash(f.context),baseVersionId:null,title:request.title,format:'docx'},metadata=createMetadataPoolFixture();let next=500;
 const policy=createMetadataPolicyFixture({binding,scopes,requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId},expiresAt:new Date(now()+60000).toISOString(),now});
 const metadataOwner=createCommandApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:metadata.pool}),commandContext:{binding,scopes},preparePolicy:policy.preparePolicy,now,newId:()=>id(next++)},'document.draft'),input={arguments:args,attachments:[]};
 const record=await metadataOwner.prepare({operation:{id:'create_word',version:'0.2.0'},action:'document.draft',binding,request:args,input,inputSha256:hash(input),deadlineMs:now()+1000,signal:undefined});
 const command={contractVersion:'0.2.0',commandId:record.commandId,binding,action:'document.draft',arguments:args,attachments:[],scopes,idempotencyKey:record.idempotencyKey};
 const proposal={proposalId:record.proposalId,command,commandSha256:hash(command),createdAt:record.createdAt,expiresAt:record.expiresAt,requiredApprover:record.requiredApprover};
 const deliveryId='sdk:'+hash({kind:'selected-document-proposal',binding,preparationSha256:args.preparationSha256}),journalStore=createPostgresIntentJournalStore({pool:sql.pool}),journal=createIntentJournal(journalStore),entry={binding,deliveryId,record:{operation:{id:'create_word',version:'0.2.0'},argumentsSha256:hash(args)}};
 await journal.begin(entry);await journal.settle({...entry,state:'PREPARED',outcome:{result:{status:'approval_required',proposal},release:{binding,scopes,expiresAtMs:now()+60000}}});
 const state={decision:null,revoked:false,records:0,documentCalls:0,loseDecision:false,losePublication:false,result:null,mutate:null};
 const decisions={async record({decision,approver}){state.records++;state.decision??={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision,approver,decidedAt:new Date(now()).toISOString(),expiresAt:proposal.expiresAt,policyRevision:scopes[0].policyRevision};if(state.loseDecision){state.loseDecision=false;throw Error('lost Core ack');}return {decision:state.decision,revoked:state.revoked,checkedAtMs:now()};},async readDecision(){return state.revoked?null:state.decision;}};
 const authorize=f.options.authorize;f.options.authorize=async call=>{if(state.revoked||state.decision?.decision!=='approved')throw Error('CURRENT_APPROVAL_REFUSED');return authorize(call);};
 const documents={async execute({proposal:p}){state.documentCalls++;assert.deepEqual(p,proposal);const outcome=await f.run({deliveryId:'approved-document:'+proposal.proposalId,baseVersionId:null,request});state.result=outcome;if(state.losePublication){state.losePublication=false;throw Error('lost publication ack');}const released=structuredClone(outcome);state.mutate?.(released);return {status:'observed',outcome:released};},async read(){if(!state.result)return null;const retained=await f.options.versions.read(state.result.version.versionId);if(!retained)throw Error('missing publication');await f.options.authorize({action:'artifact.inspect',binding,scopes,resource:{versionId:state.result.version.versionId},requestSha256:state.result.execution.requestSha256,deadlineMs:f.context.deadlineMs});return {state:'OUTCOME',outcome:state.result};}};
 const owner=createIntentApprovalOwner({journal:journalStore,decisions,documents,commandOptionsFor(){throw Error('task executor must not run');},now,limits:{maxRequestMs:5000},enabled:true});
 const principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:scopes.filter(s=>s.kind==='client').map(s=>s.resourceId)};
 const decide=(decision='approved',who=principal)=>owner.decide({principal:who,request:{conversationId:binding.conversationId,deliveryId,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision}});
 const list=()=>owner.list({principal,request:{conversationId:binding.conversationId}});
 return {f,sql,metadata,proposal,binding,scopes,deliveryId,owner,state,decide,list,principal,reader:createPostgresCommandProposalReader({pool:sql.pool})};
}
test('real document metadata and proposal custody → Core decision → immutable native publication → replay/history',async()=>{
 const s=await setup();
 assert.deepEqual(await s.reader.readProposal({tenantId:s.binding.tenantId,actorId:s.binding.actorId,conversationId:s.binding.conversationId,proposalId:s.proposal.proposalId}),s.proposal);
 assert.equal((await s.list()).intents[0].phase,'awaiting_approval');const result=await s.decide();assert.equal(result.status,'executed');assert.equal(result.outcome.execution.kind,'native-document');assert.equal(result.outcome.execution.nativeQualified,false);
 assert.equal(s.f.state.executions.length,1);assert.deepEqual((await s.decide()).outcome.version,result.outcome.version);assert.equal(s.f.state.executions.length,1);
 const history=(await s.list()).intents[0];assert.equal(history.phase,'completed');assert.deepEqual(history.execution.outcome.version,result.outcome.version);
});
test('reject, absent access and revoked Core decision never generate the document',async()=>{
 const rejected=await setup();assert.equal((await rejected.decide('rejected')).status,'rejected');assert.equal(rejected.f.state.executions.length,0);assert.equal(rejected.state.documentCalls,0);
 const revoked=await setup();revoked.state.revoked=true;await assert.rejects(revoked.decide(),/APPROVAL_DECISION_REFUSED/);assert.equal(revoked.f.state.executions.length,0);
 const foreign=await setup();await assert.rejects(foreign.decide('approved',{...foreign.principal,actorId:'foreign'}),/INTENT_NOT_FOUND/);assert.equal(foreign.state.records,0);assert.equal(foreign.f.state.executions.length,0);
});
test('lost Core acknowledgement records no artifact; lost publication acknowledgement recovers without rendering again',async()=>{
 const s=await setup();s.state.loseDecision=true;await assert.rejects(s.decide(),/APPROVAL_DECISION_UNKNOWN/);assert.equal(s.f.state.executions.length,0);assert.equal((await s.list()).intents[0].phase,'approved');
 s.state.losePublication=true;await assert.rejects(s.decide(),/INTENT_EXECUTION_UNKNOWN/);assert.equal(s.f.state.executions.length,1);assert.equal((await s.list()).intents[0].phase,'completed');
 assert.equal((await s.decide()).status,'executed');assert.equal(s.f.state.executions.length,1);
});
for(const change of ['foreign actor','wrong parent','wrong bytes','legacy execution'])test(`publication ${change} never releases an executed receipt`,async()=>{
 const s=await setup();s.state.mutate=r=>{if(change==='foreign actor')r.version.binding.actorId='other';if(change==='wrong parent')r.version.parentVersionId=id(999);if(change==='wrong bytes')r.inspection.bytes++;if(change==='legacy execution')r.execution.kind='legacy';};
 await assert.rejects(s.decide(),/INTENT_RESULT_NOT_RELEASED/);assert.equal(s.f.state.executions.length,1);
});
