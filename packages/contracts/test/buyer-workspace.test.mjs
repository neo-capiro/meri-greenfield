import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
const contract=resolveOperationContract({id:'get_pe_buyer_workspace',version:'0.2.0'});
const validators={normalizeInput:(r,c={})=>contract.normalizeInput(r,c),assertOutput:(v,r,c={})=>contract.assertOutput(v,{request:r,...c})};
const vectors=JSON.parse(readFileSync(new URL('./fixtures/buyer-workspace.wire.json',import.meta.url))).vectors;
for(const vector of vectors)test('actual Core wire: '+vector.name,()=>{
 assert.doesNotThrow(()=>validators.assertOutput(vector.response,vector.request));
 assert.deepEqual(validators.normalizeInput(vector.request).input,{...vector.request,peCode:'0601234A',knownAt:'2026-09-24T00:00:00.000Z'});
});
const mutate=(label,change)=>test(label,()=>{
 const {request,response}=structuredClone(vectors[0]);validators.assertOutput(response,request);change(response,request);
 assert.throws(()=>validators.assertOutput(response,request));
});
mutate('wrong subject',(r)=>{r.subject.id='0609999A';});
mutate('wrong section fiscal year',(r)=>{r.acquisition.data.asOfFy++;});
mutate('wrong section knowledge time',(r)=>{r.fundingExecution.data.knownAt='2026-09-25T00:00:00.000Z';});
mutate('unproved supported budget',(r)=>{r.budget.state='complete';});
mutate('missing native source coverage',(r)=>{delete r.acquisition.data.coverage;});
mutate('forged wrapper freshness',(r)=>{r.fundingExecution.freshness=[];});
mutate('unfinished page presented complete',(r)=>{r.acquisition.data.page.hasMore=true;r.acquisition.data.page.nextCursor='next';});
mutate('cursor without more rows',(r)=>{r.fundingExecution.data.page.nextCursor='next';});
mutate('proposed funding moved to enacted',(r)=>{r.fundingExecution.data.enacted.transactionDeltas.push(r.fundingExecution.data.proposed.transactionDeltas.pop());});
mutate('negative delta changed in total',(r)=>{r.fundingExecution.data.enacted.totals.transactionDeltaUsd='12.50';});
mutate('candidate promoted to allocation',(r)=>{r.acquisition.data.candidates[0].authoritativeAmountUsd='20.005';});
mutate('uncertified allocation dollar claim',(r)=>{r.fundingExecution.data.allocations[0].allocationCertification='candidate';});
mutate('changed transfer leg',(r)=>{r.fundingExecution.data.transferPairs[0].outflow.amountUsd='5.00';});
mutate('invented transfer group',(r)=>{r.fundingExecution.data.transferPairs[0].transferGroupId='other';});
mutate('duplicate relationship',(r)=>{r.acquisition.data.accepted.push(r.acquisition.data.accepted[0]);});
mutate('foreign federal mention',(r)=>{r.federalEvidence.data.mentions.items[0].canonicalPeCode='0609999A';});
mutate('future event',(r)=>{r.federalEvidence.data.lifecycle.items[0].createdAt='2026-09-25T00:00:00.000Z';});
mutate('before evidence borrowed from after',(r)=>{r.federalEvidence.data.lifecycle.items[0].beforeEvidence=r.federalEvidence.data.lifecycle.items[0].afterEvidence;});
mutate('raw private extension field',(r)=>{r.credentials='not-admitted';});
test('exact opaque cursor bounds and closed request',()=>{
 for(const value of ['',null,3,' cursor ','a'.repeat(4097)])
  assert.throws(()=>validators.normalizeInput({...vectors[0].request,acquisitionCursor:value}));
 for(const field of ['tenantId','actorId','normalizationContext','policy','approval'])
  assert.throws(()=>validators.normalizeInput({...vectors[0].request,[field]:'forged'}));
 assert.throws(()=>validators.normalizeInput(vectors[0].request,{asOf:'2026-01-01T00:00:00.000Z'}));
});
test('incomplete page preserves current data and exact coverage reason',()=>{
 const vector=structuredClone(vectors[0]),section=vector.response.acquisition;
 section.data.page={limit:50,hasMore:true,nextCursor:'next'};
 section.state='partial';section.coverage={...section.data.coverage,state:'partial',unresolvedReasons:[{
  code:'acquisition_page_incomplete',count:null,detail:'More rows remain; follow this section’s next cursor with the same fiscal year and knowledge timestamp.'}]};
 assert.doesNotThrow(()=>validators.assertOutput(vector.response,vector.request));
});
