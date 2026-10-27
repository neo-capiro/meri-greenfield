/** Developer fixture: actual preparation/approval/receivers, synthetic metadata and Core IO only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeMailPreparer} from '../../../runtime/native-authority/native-mail-preparer.mjs';
import {createCoreApprovalForwarder,CORE_APPROVAL_ROUTES} from '../../../runtime/native-authority/approval-forwarder.mjs';
import {createMetadataPoolFixture} from '../../commands/approval-metadata/test/fixture.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(7),policyRevision:'p1'}];
import {createIntentApprovalOwner} from '../approval.mjs';
import {assertPreparedResult} from '../../../worker/conversation/intents/prepared.mjs';
import {assertMailSendProposal} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createMailFixture,uuid,bodyText} from '../../../gateway/sources/mail/test/fixtures.mjs';
import {assertMailThreadSourcePage} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
const NOW=Date.parse('2026-10-27T12:00:00.000Z'),deliveryId='sdk:'+'a'.repeat(64);
async function fixture({mode='send',general=false}={}){
 const admitted=general?[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}]:scopes;
 const selected=general?null:admitted[0].resourceId;
 const args={mode,clientId:selected,senderConnectionId:id(800),senderEmail:'owner@example.test',to:['reader@example.test'],cc:[],bcc:[],subject:'Reviewed subject',bodyHtml:'<p>Reviewed content</p>',files:[],original:mode==='send'?null:{threadId:id(801),messageId:id(802),updatedAt:'2026-10-27T10:00:00.000Z',bodySha256:mode==='forward'?'a'.repeat(64):null}};
 const sql=createMetadataPoolFixture(),pool={options:sql.pool.options,async connect(){const c=await sql.pool.connect();return {async query(q){const text=typeof q==='string'?q:q.text;if(/^(BEGIN|COMMIT|ROLLBACK|SET )/u.test(text))return {rows:[]};return c.query(q);},release:e=>c.release(e)};}};
 const state={rights:0,session:true,dispatches:0,stored:null,loseAck:false,unknown:false,mutate:null,decision:null};
 const preparer=createNativeMailPreparer({pool,binding,scopes:admitted,selectedClientId:selected,policyRevision:admitted[0].policyRevision,expiresAtMs:NOW+60000,now:()=>NOW,maxRequestMs:1000,
 async currentRights(){state.rights++;return {tenantId:binding.tenantId,actorId:binding.actorId,scopes:admitted,checkedAtMs:NOW,expiresAtMs:NOW+60000};}});
 const prepared=await preparer.prepare({arguments:args,deliveryId,signal:undefined}),p=prepared.proposal;
 assertMailSendProposal(p,{binding});assertPreparedResult('command',{id:'mail_send',version:'0.2.0'},prepared,binding,{scopes:admitted,nowMs:NOW});
 const decision={proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'approved',decidedAt:new Date(NOW).toISOString(),expiresAt:p.expiresAt,approver:p.requiredApprover,policyRevision:admitted[0].policyRevision};
 const outcome={execution:{kind:'native-mail',proposalId:p.proposalId,commandSha256:p.commandSha256,idempotencyKey:p.command.idempotencyKey,binding,approvalDecisionSha256:hash(decision)},result:{state:'accepted',intentId:id(803),requestKey:p.proposalId,retryable:false,threadId:id(804),messageId:id(805),provider:'gmail',senderConnectionId:args.senderConnectionId,senderEmail:args.senderEmail,mode,original:args.original,signaturePolicy:'actor',signatureAppended:true,mailboxConfirmation:null}};
 const forwarder=createCoreApprovalForwarder({origin:'https://core.invalid',nativeCredentials:{nativeCredentialFor(){if(!state.session)throw Error('revoked');return {credential:'synthetic-user',expiresAtMs:NOW+60000};}},now:()=>NOW,getServiceSecret:async()=> 'synthetic-service',readProposal:async()=>p,
 async fetchImpl(url,init){assert.equal(init.headers.authorization,'Bearer synthetic-user');assert.deepEqual(JSON.parse(init.body),{proposal:p,binding});
 if(url.endsWith(CORE_APPROVAL_ROUTES.execute)){state.dispatches++;state.stored??=structuredClone(outcome);if(state.loseAck){state.loseAck=false;throw Error('lost response');}const o=structuredClone(state.stored);state.mutate?.(o);return Response.json(state.unknown?{status:'indeterminate'}:{status:'observed',outcome:o});}
 assert(url.endsWith(CORE_APPROVAL_ROUTES.executionRead));return Response.json(state.unknown?{state:'UNKNOWN'}:state.stored?{state:'OUTCOME',outcome:state.stored}:null);}});
 const principal={...p.requiredApprover,role:'member',permissions:[],clientIds:general?[]:[selected],membershipRevision:'m1'},entry={deliveryId,createdAt:p.createdAt,record:{operation:{id:'mail_send',version:'0.2.0'}},state:'PREPARED',outcome:{result:prepared}};
 const owner=createIntentApprovalOwner({journal:{async read(){return structuredClone(entry);},async list(){return {entries:[structuredClone(entry)],next:null};}},decisions:{async record(input){state.decision??={...decision,decision:input.decision};return {decision:state.decision,checkedAtMs:NOW,revoked:false};},async readDecision(){return state.decision;}},mail:{execute:v=>forwarder.executeMail(v),read:v=>forwarder.readMailExecution(v)},now:()=>NOW,limits:{maxRequestMs:1000},enabled:true});
 const request={conversationId:binding.conversationId,deliveryId,proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'approved'},list={conversationId:binding.conversationId};
 return {p,args,owner,principal,state,outcome,decision,forwarder,request,list,sql,call:{proposal:p,principal,deliveryId,decision}};
}
for(const mode of ['send','reply','reply_all','forward'])test('native mail '+mode+' prepares without send, then admits exact durable accepted receipt',async()=>{
 const f=await fixture({mode,general:mode==='send'});assert.equal(f.state.dispatches,0);assert.equal(f.sql.rows.size,1);assert(f.state.rights>=2);
 const out=await f.owner.decide({principal:f.principal,request:f.request});assert.equal((await receiveIntentsResponse('decide',200,JSON.stringify(out),{request:f.request,proposal:f.p})).outcome.result.state,'accepted');
 const page=await f.owner.list({principal:f.principal,request:f.list});assert.equal((await receiveIntentsResponse('list',200,JSON.stringify(page),{request:f.list})).intents[0].execution.outcome.result.messageId,f.outcome.result.messageId);assert.equal(f.state.dispatches,1);
});
test('lost mail ACK recovers by read without repeating execute',async()=>{const f=await fixture();f.state.loseAck=true;await assert.rejects(f.owner.decide({principal:f.principal,request:f.request}));const page=await f.owner.list({principal:f.principal,request:f.list});assert.equal(page.intents[0].execution.outcome.result.state,'accepted');assert.equal(f.state.dispatches,1);});
test('absent and UNKNOWN mail history never dispatch or infer not executed',async()=>{const f=await fixture();assert.equal(await f.forwarder.readMailExecution(f.call),null);f.state.unknown=true;assert.deepEqual(await f.forwarder.readMailExecution(f.call),{state:'UNKNOWN'});assert.equal(f.state.dispatches,0);});
test('current attended credential refusal makes zero Core requests',async()=>{const f=await fixture();f.state.session=false;await assert.rejects(f.forwarder.executeMail(f.call));assert.equal(f.state.dispatches,0);});
test('durable failed mail is observed as failed, never provider acceptance',async()=>{const f=await fixture();f.state.mutate=o=>{o.result={state:'failed',intentId:id(803),requestKey:f.p.proposalId,retryable:false};};const out=await f.owner.decide({principal:f.principal,request:f.request});const admitted=await receiveIntentsResponse('decide',200,JSON.stringify(out),{request:f.request,proposal:f.p});assert.equal(admitted.outcome.result.state,'failed');});
for(const [name,mutate]of Object.entries({mailbox:o=>o.result.senderConnectionId=id(999),origin:o=>o.result.original.messageId=id(999),decision:o=>o.execution.approvalDecisionSha256='f'.repeat(64)}))test('mail outcome refuses changed '+name,async()=>{const f=await fixture({mode:'reply'});f.state.mutate=mutate;await assert.rejects(f.owner.decide({principal:f.principal,request:f.request}));const out={status:'executed',deliveryId,proposalId:f.p.proposalId,decision:f.decision,outcome:structuredClone(f.outcome)};mutate(out.outcome);await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify(out),{request:f.request,proposal:f.p}));});

for(const mode of ['reply_all','forward'])test('typed mail read keeps exact '+mode+' proposal context and refuses a different original',()=>{
 const f=createMailFixture('mail.read_thread'),request={...f.args,messageId:uuid('9')},page=f.page(f.input(request)),message=page.messages[0];
 message.recordVersionId='2026-10-27T10:00:00.000Z';
 const action={mode,senderConnectionId:message.mailboxId,senderEmail:'owner@example.test',subject:'Source subject',to:mode==='forward'?[]:['reader@example.test'],cc:[],original:{threadId:message.threadId,messageId:message.messageId,updatedAt:message.recordVersionId,bodySha256:mode==='forward'?message.contentSha256:null},...(mode==='forward'?{originalBodyText:bodyText}:{})};
 message.nativeActions=[action];assert.deepEqual(assertMailThreadSourcePage(page,request).messages[0].nativeActions,[action]);
 action.original.messageId=uuid('8');assert.throws(()=>assertMailThreadSourcePage(page,request));
});
