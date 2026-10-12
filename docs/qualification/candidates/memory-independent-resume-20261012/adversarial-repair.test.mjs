// Independently specified synthetic review probes. No private producer body copied.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMemoryProposalInput as normalize, assertMemoryProposalReadResult as check} from 'file:///workspace/meri-memory-repair-20261012/packages/contracts/retrieval-0.2/validate.mjs';

const tenant='11111111-1111-4111-8111-111111111111';
const actor='22222222-2222-4222-8222-222222222222';
const client='33333333-3333-4333-8333-333333333333';
const decision='44444444-4444-4444-8444-444444444444';
const firstId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const secondId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const subject=()=>({tenantId:tenant,actorId:actor,kind:'personal',entityType:'user',entityIds:[actor],rosterVersionId:null,policyRevision:'review-only',authorizationDecisionId:decision,scopes:[{tenantId:tenant,kind:'private-user',resourceId:actor,policyRevision:'review-only'}]});
const row=(overrides={})=>({id:firstId,status:'pending',approvedFact:false,scope:'personal',clientId:null,sourceKind:'explicit_user',createdAt:'2026-01-03T00:00:00.000Z',restricted:false,title:'Synthetic',proposedText:'Unapproved synthetic content',contentTruncated:false,...overrides});
const page=(overrides={})=>({tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',claimsAreApprovedFacts:false,scope:{tenantId:tenant,userId:actor,clientId:null},candidates:[row()],nextCursor:null,coverage:{firstPage:true,complete:true,reason:'own_pending_proposals_complete'},...overrides});
const partial=(overrides={})=>page({nextCursor:'review-cursor-1',coverage:{firstPage:true,complete:false,reason:'unread_pages_restricted_or_truncated_content'},...overrides});
const continued=(overrides={})=>page({coverage:{firstPage:false,complete:false,reason:'unread_pages_restricted_or_truncated_content'},...overrides});

test('retained equal-time descending UUID boundary succeeds and replayed identity refuses',()=>{
 const prior=partial(), options={subject:subject(),previous:{request:{limit:2},page:prior}};
 assert.equal(check(continued({candidates:[row({id:secondId})]}),{cursor:'review-cursor-1',limit:2},options).kind,'partial');
 assert.throws(()=>check(continued(),{cursor:'review-cursor-1',limit:2},options));
});
test('a proposal timestamp must denote a finite instant before coverage is admitted',()=>{
 // RFC3339 permits leap seconds; Date.parse does not. The producer uses Date.toISOString.
 const invalidForOrdering='2026-06-30T23:59:60Z';
 assert.equal(Number.isFinite(Date.parse(invalidForOrdering)),false);
 assert.throws(()=>check(page({candidates:[row({createdAt:invalidForOrdering})]}),{},{subject:subject()}));
});
test('nonfinite timestamp must not defeat within-page descending order',()=>{
 assert.throws(()=>check(page({candidates:[row({createdAt:'2026-06-30T23:59:60Z'}),row({id:secondId,createdAt:'2027-01-01T00:00:00.000Z'})]}),{},{subject:subject()}));
});
test('nonfinite timestamp must not admit a newer continuation result',()=>{
 const options={subject:subject(),previous:{request:{},page:partial({candidates:[row({createdAt:'2026-06-30T23:59:60Z'})]})}};
 assert.throws(()=>check(continued({candidates:[row({id:secondId,createdAt:'2027-01-01T00:00:00.000Z'})]}),{cursor:'review-cursor-1'},options));
});
test('disabled continuation remains unavailable and does not fabricate completion',()=>{
 const options={subject:subject(),previous:{request:{},page:partial()}};
 const value=continued({enabled:false,candidates:[],coverage:{firstPage:false,complete:false,reason:'review_disabled'}});
 assert.deepEqual(check(value,{cursor:'review-cursor-1'},options),{kind:'unavailable',claimsAreApprovedFacts:false,evidenceReady:false,negativeAssertion:'none'});
});
test('cross-client metadata can appear in personal proposer queue only as unapproved data',()=>{
 const value=page({candidates:[row({scope:'client',clientId:client,restricted:true,title:null,proposedText:null})],coverage:{firstPage:true,complete:false,reason:'unread_pages_restricted_or_truncated_content'}});
 assert.equal(check(value,{},{subject:subject()}).kind,'partial');
 assert.throws(()=>check({...value,candidates:[{...value.candidates[0],title:'forbidden body'}]},{},{subject:subject()}));
});
test('inert guards refuse hostile retained context without getters or proxy traps',()=>{
 let invoked=0;
 const hostile={subject:subject()};Object.defineProperty(hostile,'previous',{enumerable:true,get(){invoked++;return null;}});
 assert.throws(()=>normalize({cursor:'review-cursor-1'},hostile));
 const p=page();p.candidates[0]=new Proxy(row(),{get(){invoked++;throw Error('must not read');}});
 assert.throws(()=>check(p,{},{subject:subject()}));assert.equal(invoked,0);
});
test('boundaries remain literal: maximum previews accepted and supplementary cursor refused',()=>{
 assert.equal(check(page({candidates:[row({title:'x'.repeat(200),proposedText:'x'.repeat(2000)})]}),{},{subject:subject()}).kind,'complete');
 assert.throws(()=>normalize({cursor:'😀'.repeat(1025)},{subject:subject()}));
});
