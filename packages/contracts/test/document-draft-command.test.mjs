import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash,assertProposalIntegrity} from '../validate.mjs';
import {normalizeDocumentDraftInput,assertDocumentDraftCommand,assertDocumentDraftProposal,assertNativeApprovalProposal} from '../commands-0.2/validate.mjs';
import {receiveIntentsResponse} from '../dist/intents-application.mjs';
import {ARTIFACT_MIME_TYPES} from '../artifacts-0.2/artifact-formats.mjs';

export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function documentDraftFixture() {
 const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(7),policyRevision:'test-policy'}],context={binding,scopes};
 const args={preparationSha256:'a'.repeat(64),artifactRequestSha256:'b'.repeat(64),sourceContextSha256:'c'.repeat(64),baseVersionId:null,title:'Selected document',format:'docx'};
 const command={contractVersion:'0.2.0',commandId:id(8),binding,action:'document.draft',arguments:args,attachments:[],scopes,idempotencyKey:'synthetic-selected-document'};
 const proposal={proposalId:id(9),command,commandSha256:hash(command),createdAt:'2026-10-24T12:00:00.000Z',expiresAt:'2026-10-24T12:10:00.000Z',requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId}};
 return {binding,scopes,context,args,command,proposal};
}
test('document draft preserves exact immutable selected preparation and native envelope',()=> {
 const f=documentDraftFixture();assert.deepEqual(normalizeDocumentDraftInput(f.args,f.context),f.args);
 assert.deepEqual(assertDocumentDraftCommand(f.command,f.context),f.command);
 assert.deepEqual(assertDocumentDraftProposal(f.proposal,f.context),f.proposal);
 const snapshot=assertNativeApprovalProposal(f.proposal);f.command.arguments.title='changed';assert.equal(snapshot.command.arguments.title,'Selected document');
 assert.throws(()=>assertProposalIntegrity(snapshot),'frozen0.1 remains closed');
});
for(const field of ['preparationSha256','artifactRequestSha256','sourceContextSha256'])test(`document draft binds ${field} and rejects missing/malformed pins`,()=> {
 const f=documentDraftFixture();for(const value of [undefined,'A'.repeat(64),'a'.repeat(63),'unproven']) {
  const args={...f.args,[field]:value};if(value===undefined)delete args[field];assert.throws(()=>normalizeDocumentDraftInput(args,f.context));
 }
 const p=structuredClone(f.proposal);p.command.arguments[field]='d'.repeat(64);assert.throws(()=>assertNativeApprovalProposal(p));
});
test('document draft rejects extra fields, noncanonical title, non-Word formats and unbound attachments',()=> {
 const f=documentDraftFixture();for(const change of [{taskId:id(10)},{title:' x '},{title:''},{title:'x'.repeat(201)},{title:'😀'.repeat(101)},{format:'pdf'},{baseVersionId:'bad'},{baseVersionId:'ABCDEFAB-0000-4000-8000-000000000001'}])
  assert.throws(()=>normalizeDocumentDraftInput({...f.args,...change},f.context));
 for(const change of [{action:'task.create'},{contractVersion:'0.1.0'},{attachments:[{}]},{fakeGrant:'yes'}])assert.throws(()=>assertDocumentDraftCommand({...f.command,...change},f.context));
 assert.equal(normalizeDocumentDraftInput({...f.args,baseVersionId:id(12)},f.context).baseVersionId,id(12));
});
for(const field of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'])test(`document draft exact current ${field} remains required`,()=> {
 const f=documentDraftFixture(),command=structuredClone(f.command);command.binding[field]=field==='writerFence'?2:id(90);
 assert.throws(()=>assertDocumentDraftCommand(command,f.context));
});
test('document draft scopes cannot be widened, replaced, reordered or moved across tenant',()=> {
 const f=documentDraftFixture();for(const change of [[],[{...f.scopes[0],resourceId:id(91)}],[{...f.scopes[0],tenantId:id(92)}],[...f.scopes,...f.scopes]])
  assert.throws(()=>assertDocumentDraftCommand({...f.command,scopes:change},f.context));
 const other={...f.scopes[0],resourceId:id(93)},context={...f.context,scopes:[...f.scopes,other]};
 assert.throws(()=>assertDocumentDraftCommand({...f.command,scopes:[other,...f.scopes]},context));
});
test('document proposal requires canonical lifetime, exact command hash and same tenant approver',()=> {
 const f=documentDraftFixture();for(const change of [{commandSha256:'0'.repeat(64)},{expiresAt:f.proposal.createdAt},{createdAt:'2026-02-30T12:00:00.000Z'},{createdAt:'2026-10-24T12:00:00Z'},{requiredApprover:{tenantId:id(90),actorId:f.binding.actorId}}])
  assert.throws(()=>assertNativeApprovalProposal({...f.proposal,...change}));
});
test('hostile input is rejected without property execution',()=> {
 const f=documentDraftFixture();let calls=0;const args={...f.args};Object.defineProperty(args,'title',{enumerable:true,get(){calls++;return 'private';}});
 assert.throws(()=>normalizeDocumentDraftInput(args,f.context));assert.equal(calls,0);
});
test('frozen historical proposal schema and valid task proposal remain unchanged',()=> {
 assert.equal(createHash('sha256').update(readFileSync(new URL('../meri.schema.json',import.meta.url))).digest('hex'),'e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b');
 const f=documentDraftFixture(),p=structuredClone(f.proposal);p.command.contractVersion='0.1.0';p.command.action='task.create';p.command.arguments={title:'Historical task',clientId:null,dueDate:null};p.commandSha256=hash(p.command);
 assertProposalIntegrity(p);assert.deepEqual(assertNativeApprovalProposal(p),p);
});

/** Closed canonical metadata only; actual publication/approval owner integration is tested by its owner. */
function publicFixture() {
 const f=documentDraftFixture(),deliveryId='sdk:'+'d'.repeat(64),createdAt='2026-10-24T12:00:01.000Z';
 const decision={proposalId:f.proposal.proposalId,commandSha256:f.proposal.commandSha256,decision:'approved',decidedAt:createdAt,
  expiresAt:f.proposal.expiresAt,approver:f.proposal.requiredApprover,policyRevision:'test-policy'};
 const version={contractVersion:'0.2.0',artifactId:id(20),versionId:id(21),parentVersionId:null,binding:structuredClone(f.binding),
  object:{objectId:id(22),versionId:'immutable-object-version',sha256:'e'.repeat(64),bytes:200,scopes:structuredClone(f.scopes)},
  filename:'Selected document.docx',mimeType:ARTIFACT_MIME_TYPES.docx,scopes:structuredClone(f.scopes),evidence:[],generationStatus:'draft',previewStatus:'pending',createdAt};
 const outcome={version,inspection:{sha256:version.object.sha256,bytes:200,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:1,tables:0,pictures:0}},
  execution:{kind:'native-document',invocationId:'sdk:'+'f'.repeat(64),requestSha256:'d'.repeat(64),authorizationReceiptId:id(23),objectCommitted:true,versionCommitted:true,nativeQualified:false}};
 const item={deliveryId,createdAt:f.proposal.createdAt,operation:{id:'create_word',version:'0.2.0'},state:'prepared',kind:'proposal',proposal:f.proposal,decision:null,execution:null,phase:'awaiting_approval'};
 const request={conversationId:f.binding.conversationId},list={conversationId:f.binding.conversationId,intents:[item],next:null};
 return {...f,deliveryId,decision,outcome,item,request,list};
}
const receiveList=f=>receiveIntentsResponse('list',200,JSON.stringify(f.list),{request:f.request});
test('public document proposal remains pending without a decision or effect',async()=> {
 const f=publicFixture(),value=await receiveList(f);assert.equal(value.intents[0].phase,'awaiting_approval');assert.equal(value.intents[0].execution,null);
 assert.deepEqual(value.intents[0].proposal,f.proposal);assert(Object.isFrozen(value.intents[0].proposal.command));
});
test('public document publication retains actual later run and projected request hash',async()=> {
 const f=publicFixture();Object.assign(f.outcome.version.binding,{runId:id(70),attemptId:id(71),workerId:id(72),writerFence:2});
 f.item.decision=f.decision;f.item.execution={state:'completed',outcome:f.outcome};f.item.phase='completed';
 const value=await receiveList(f);assert.deepEqual(value.intents[0].execution.outcome,f.outcome);
 assert.notEqual(f.outcome.execution.requestSha256,f.args.artifactRequestSha256);
 assert.notEqual(f.outcome.version.binding.runId,f.binding.runId);
});
test('public document publication preserves source evidence provenance and refuses another principal or scope',async()=> {
 const f=publicFixture(),evidence={sourceId:'mail',recordId:'source-record',sourceVersionId:'source-version',citationId:id(35),contentSha256:'a'.repeat(64),
  scopes:structuredClone(f.scopes),observedAt:f.proposal.createdAt,sourceUpdatedAt:null,binding:structuredClone(f.binding)};
 f.outcome.version.binding.runId=id(70);f.outcome.version.evidence=[evidence];f.item.decision=f.decision;f.item.execution={state:'completed',outcome:f.outcome};f.item.phase='completed';
 assert.deepEqual((await receiveList(f)).intents[0].execution.outcome.version.evidence,[evidence]);
 for(const mutate of [e=>e.binding.actorId=id(90),e=>e.scopes[0].resourceId=id(90)]) {
  const changed=structuredClone(f);mutate(changed.list.intents[0].execution.outcome.version.evidence[0]);await assert.rejects(receiveList(changed));
 }
});
test('public task outcome cannot be replaced by a document publication from the same conversation',async()=> {
 const f=publicFixture();Object.assign(f.command,{contractVersion:'0.1.0',action:'task.create',arguments:{title:'Task',clientId:null,dueDate:null}});
 f.proposal.commandSha256=hash(f.command);f.decision.commandSha256=f.proposal.commandSha256;f.item.decision=f.decision;
 f.item.execution={state:'completed',outcome:f.outcome};f.item.phase='completed';
 await assert.rejects(receiveList(f),error=>error.name==='IntentsResponseError'&&error.code==='INTENTS_CORRELATION');
});
for(const [name,mutate]of [
 ['tenant',v=>v.version.binding.tenantId=id(90)],['actor',v=>v.version.binding.actorId=id(90)],['conversation',v=>v.version.binding.conversationId=id(90)],
 ['scope',v=>v.version.scopes[0].resourceId=id(90)],['object scope',v=>v.version.object.scopes[0].resourceId=id(90)],
 ['parent',v=>v.version.parentVersionId=id(90)],['MIME',v=>v.version.mimeType='application/pdf'],['filename',v=>v.version.filename='file.pdf'],
 ['inspection hash',v=>v.inspection.sha256='0'.repeat(64)],['inspection size',v=>v.inspection.bytes++],['byte limit',v=>{v.version.object.bytes=16777217;v.inspection.bytes=16777217;}],
 ['fake legacy ticket',v=>{delete v.execution.kind;delete v.execution.invocationId;v.execution.budgetTicketId='old';}],
 ['uncommitted version',v=>v.execution.versionCommitted=false],['false renderer qualification',v=>v.execution.nativeQualified=true],
 ['historical version for new output',v=>v.version.contractVersion='0.1.0'],
])test(`public document completed outcome refuses ${name}`,async()=> {
 const f=publicFixture();mutate(f.outcome);f.item.decision=f.decision;f.item.execution={state:'completed',outcome:f.outcome};f.item.phase='completed';await assert.rejects(receiveList(f));
});
test('public document approval is distinct from confirmed publication and rejection',async()=> {
 const f=publicFixture();f.item.decision=f.decision;f.item.phase='approved';assert.equal((await receiveList(f)).intents[0].phase,'approved');
 const request={conversationId:f.binding.conversationId,deliveryId:f.deliveryId,proposalId:f.proposal.proposalId,commandSha256:f.proposal.commandSha256,decision:'approved'};
 const value={status:'indeterminate',deliveryId:f.deliveryId,proposalId:f.proposal.proposalId,decision:f.decision};
 assert.equal((await receiveIntentsResponse('decide',200,JSON.stringify(value),{request,proposal:f.proposal})).status,'indeterminate');
 const done={...value,status:'executed',outcome:f.outcome};assert.deepEqual((await receiveIntentsResponse('decide',200,JSON.stringify(done),{request,proposal:f.proposal})).outcome,f.outcome);
 await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify({...done,proposalId:id(99)}),{request,proposal:f.proposal}));
 await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify({...done,decision:{...f.decision,approver:{...f.proposal.requiredApprover,actorId:id(99)}}}),{request,proposal:f.proposal}));
 await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify(done),{request:{...request,decision:'rejected'},proposal:f.proposal}));
});
