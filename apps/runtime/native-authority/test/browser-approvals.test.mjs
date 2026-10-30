/** Core04 browser-approval operations over the shared forwarder transport, with inert HTTP.
 * The transport (bearer, service secret, session freshness, bounded lifetime) is the existing owner;
 * these tests prove the fixed routes/bodies and the permissive/non-permissive rule. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserApprovalOperations} from '../browser-approvals.mjs';
import {CORE_BROWSER_APPROVAL_ROUTES} from '../../../../packages/contracts/runtime-0.2/browser-approval-channel.mjs';
import {browserPreparationFromRequest} from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';

const NOW=1700000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const proposalId='88888888-8888-4888-8888-888888888888';
const consumptionId='99999999-9999-4999-8999-999999999999';
const toolUseId='toolu_01';
const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',toolUseId,
 inputSha256:hash({tool:'browser_click'}),pageOrigin:'https://app.example',policySha256:'a'.repeat(64)};
const subjectSha256=hash(subject);
const preparation=browserPreparationFromRequest({schema:'meri-browser-approval-request/3',subject,
 subjectSha256:hash(subject),input:{tool:'browser_click'},requestedAtMs:NOW-1000,expiresAtMs:NOW+60000});
const decision={proposalId,commandSha256:subjectSha256,decision:'approved',decidedAt:new Date(NOW-500).toISOString(),
 expiresAt:new Date(NOW+60000).toISOString(),approver:{tenantId:'tenant',actorId:'actor'},policyRevision:'policy1'};
const receipt={schema:'meri-browser-approval-receipt/1',subjectSha256:subjectSha256,proposalId,toolUseId,
 decision,consumption:{consumed:true,consumptionId,consumedAtMs:NOW}};
const statusOf=(overrides={})=>({schema:'meri-browser-approval-status/1',proposalId,subjectSha256,toolUseId,
 permissive:false,unknown:true,consumption:{state:'CLAIMED',consumedAtMs:NOW,completedAtMs:null,result:null},...overrides});

function harness({answers}={}){
 const posts=[];
 const transport={
  lifetime:(signal,deadlineMs)=>({signal,deadlineMs,run:fn=>fn(),check(){},close(){},limitDeadline(){},deadline:()=>Infinity}),
  proposal:async()=>({schemaVersion:1,commandSha256:'f'.repeat(64),
   metadata:{record:{proposalId,request:preparation}},run:{binding,policyRevision:'policy1'}}),
  selected:async()=>({binding,selectedClientId:null}),
  post:async(life,route,{selected,body})=>{posts.push({route,body,selected});const canned=answers?.[route];
   if(canned instanceof Error)throw canned;return {value:canned??statusOf(),sessionExpiresAtMs:NOW+60000};}};
 const operations=createBrowserApprovalOperations({transport,now:()=>NOW});
 return {operations,posts};
}

test('record posts exactly the Core04 body for the canonical actor and stamps Meri\'s clock',async()=>{
 const h=harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.record]:{decision,checkedAtMs:1,revoked:false}}});
 const answer=await h.operations.record({proposalId,subjectSha256,decision:'approved',
  approver:{tenantId:'tenant',actorId:'actor'},binding});
 assert.equal(h.posts.length,1);
 assert.equal(h.posts[0].route,'/api/clio/approvals/native/browser/record');
 assert.deepEqual(Object.keys(h.posts[0].body).sort(),['approver','binding','decision','proposalId','subjectSha256']);
 assert.deepEqual(h.posts[0].body.approver,{tenantId:'tenant',actorId:'actor'});
 assert.equal(h.posts[0].body.binding.writerFence,7);
 assert.equal(answer.checkedAtMs,NOW,'Core\'s checkedAtMs is not trusted');
});

test('an independent approver can never record a browser decision',async()=>{
 const h=harness();
 await assert.rejects(h.operations.record({proposalId,subjectSha256,decision:'approved',
  approver:{tenantId:'tenant',actorId:'someone-else'},binding}),/ACCESS_DENIED|BROWSER_APPROVAL_REFUSED/u);
 await assert.rejects(h.operations.record({proposalId,subjectSha256,decision:'approved',
  approver:{tenantId:'other',actorId:'actor'},binding}),/ACCESS_DENIED|BROWSER_APPROVAL_REFUSED/u);
 assert.equal(h.posts.length,0);
});

test('only a fresh receipt is permissive; a status answer refuses and never consumes again',async()=>{
 const fresh=harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.consume]:receipt}});
 const permitted=await fresh.operations.consume({proposalId,subjectSha256,binding});
 assert.equal(permitted.permitted,true);
 assert.equal(permitted.receipt.consumption.consumed,true);
 assert.deepEqual(Object.keys(fresh.posts[0].body).sort(),['binding','proposalId','subjectSha256']);

 const repeat=harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.consume]:statusOf()}});
 const refused=await repeat.operations.consume({proposalId,subjectSha256,binding});
 assert.equal(refused.permitted,false);
 assert.equal(refused.status.schema,'meri-browser-approval-status/1');
 assert.equal(repeat.posts.length,1,'a repeat answer never consumes a second time');
});

test('status-only recovery reads the canonical status without consuming',async()=>{
 const h=harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.status]:statusOf({unknown:false})}});
 const answer=await h.operations.status({proposalId,subjectSha256,binding});
 assert.equal(answer.permitted,false);
 assert.equal(h.posts[0].route,'/api/clio/approvals/native/browser/status');
 assert.equal(h.posts[0].body.subjectSha256,subjectSha256);
});

test('result reports the actual outcome as evidence, never as a permission',async()=>{
 const h=harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.result]:statusOf({unknown:false,consumption:{state:'COMPLETED',consumedAtMs:NOW,completedAtMs:NOW,result:{outcome:'ok'}}})}});
 const answer=await h.operations.result({proposalId,subjectSha256,binding,outcome:'ok',result:{ok:true}});
 assert.equal(answer.permitted,false);
 assert.equal(h.posts[0].route,'/api/clio/approvals/native/browser/result');
 assert.equal(h.posts[0].body.outcome,'ok');
 assert.deepEqual(h.posts[0].body.result,{ok:true});
});

test('a permissive status or a receipt without consumption refuses',async()=>{
 await assert.rejects(harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.status]:statusOf({permissive:true})}})
  .operations.status({proposalId,subjectSha256,binding}),/BROWSER_APPROVAL_REFUSED|INVALID_COMMAND/u);
 await assert.rejects(harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.consume]:{...receipt,consumption:{consumed:false}}}})
  .operations.consume({proposalId,subjectSha256,binding}),/BROWSER_APPROVAL_REFUSED|INVALID_COMMAND|ACCESS_DENIED/u);
 // A receipt for ANOTHER subject is not permission for this one.
 await assert.rejects(harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.consume]:{...receipt,subjectSha256:'b'.repeat(64)}}})
  .operations.consume({proposalId,subjectSha256,binding}),/BROWSER_APPROVAL_REFUSED|INVALID_COMMAND|ACCESS_DENIED/u);
});

test('a missing transport dependency refuses at construction',()=>{
 assert.throws(()=>createBrowserApprovalOperations({}),{message:'BROWSER_APPROVAL_CONFIGURATION'});
 assert.throws(()=>createBrowserApprovalOperations({transport:{lifetime(){},post(){}},now:()=>NOW}),
  {message:'BROWSER_APPROVAL_CONFIGURATION'});
});

test('a malformed, rejected, expired, foreign or future-dated receipt never permits',async()=>{
 const variants=[
  ['rejected decision',{...receipt,decision:{...decision,decision:'rejected'}}],
  ['expired decision',{...receipt,decision:{...decision,expiresAt:new Date(NOW-1).toISOString()}}],
  ['decided in the future',{...receipt,decision:{...decision,decidedAt:new Date(NOW+1000).toISOString()}}],
  ['incomplete decision',{...receipt,decision:{proposalId,commandSha256:subjectSha256,decision:'approved'}}],
  ['wrong tool use',{...receipt,toolUseId:'toolu_other'}],
  ['foreign proposal',{...receipt,proposalId:'99999999-9999-4999-8999-999999999999'}],
  ['future consumption',{...receipt,consumption:{...receipt.consumption,consumedAtMs:NOW+1000}}],
  ['no consumption',{...receipt,consumption:null}],
  ['wrong actor',{...receipt,decision:{...decision,approver:{tenantId:'tenant',actorId:'someone-else'}}}],
  ['wrong policy',{...receipt,decision:{...decision,policyRevision:'policy2'}}]];
 for(const [name,answer] of variants){
  const h=harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.consume]:answer}});
  await assert.rejects(h.operations.consume({proposalId,subjectSha256,binding}),
   /BROWSER_APPROVAL_|ACCESS_DENIED|INVALID/u,`${name} must not permit`);
  assert.equal(h.posts.filter(p=>p.route===CORE_BROWSER_APPROVAL_ROUTES.consume).length,1,`${name} sends exactly one consume`);
 }
});

test('a record answer with an extra field or a different decision is refused',async()=>{
 const extra=harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.record]:{decision,checkedAtMs:1,revoked:false,extra:true}}});
 await assert.rejects(extra.operations.record({proposalId,subjectSha256,decision:'approved',
  approver:{tenantId:'tenant',actorId:'actor'},binding}),/UNAVAILABLE|ACCESS_DENIED/u);
 const other=harness({answers:{[CORE_BROWSER_APPROVAL_ROUTES.record]:{decision:{...decision,decision:'rejected'},
  checkedAtMs:1,revoked:false}}});
 await assert.rejects(other.operations.record({proposalId,subjectSha256,decision:'approved',
  approver:{tenantId:'tenant',actorId:'actor'},binding}),/ACCESS_DENIED|UNAVAILABLE/u);
});
