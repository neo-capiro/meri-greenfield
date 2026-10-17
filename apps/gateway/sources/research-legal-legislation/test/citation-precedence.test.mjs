/** Native branch precedence only; no citation parser, derived parse result or source qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createResearchLegalLegislationHandlers} from '../handler.mjs';
import {assertLegalSliceRequest,legalSliceContext} from '../request-context.mjs';
import {storedCase,ids} from './fixture.mjs';

const id='get_legal_reference',operation={id,version:'0.2.0'},clientId='a1234567-b123-4c12-8d12-e123456789ab';
const citations=['Article I','1.10','not a parsed reference',' ',`1.10${'(a)'.repeat(11)}`];
const accepted=[
 ['rules ignores citation',{view:'rules',noticeId:'synthetic-notice',edition:'2026'}],
 ['versions ignores citation',{view:'versions',sessionKey:'2026',billId:'synthetic-bill',edition:'2026'}],
 ['explicit reference with absent edition',{referenceId:'explicit-reference'}],
 ['explicit reference with empty edition',{referenceId:'explicit-reference',edition:''}],
 ['explicit reference with null edition',{referenceId:'explicit-reference',edition:null}],
 ['explicit reference with statute filter and no edition',{referenceId:'explicit-reference',code:'statute'}],
 ['explicit constitution suppresses edition',{referenceId:'explicit-reference',code:'constitution',edition:'2026'}],
 ['explicit constitution ignores invalid edition',{referenceId:'explicit-reference',code:'constitution',edition:'not-a-year'}],
 ['unknown view falls through to explicit references',{view:'unknown-view',referenceId:'explicit-reference'}],
 ['whitespace reference is natively truthy',{referenceId:' ',edition:''}],
];

for(const [label,selection] of accepted)test(`citation precedence: ${label} preserves original JSON and null parser context`,async()=>{
 for(const citation of citations){
  const request={...selection,citation},f=storedCase(id,{request}),call=f.call(),out=JSON.parse(await f.handler()(call));
  assert.deepEqual(legalSliceContext(operation,request),{clientResolution:null,citationResolution:null});
  assert.deepEqual(f.credentialCalls[0].normalizationContext,{clientResolution:null,citationResolution:null});
  assert.equal(f.credentialCalls[0].requestSha256,hash(request));assert.equal(f.credentialCalls[0].argumentsSha256,call.argumentsSha256);
  assert.deepEqual(f.wire[0].body,request);assert.equal(f.wire[0].url,'https://native-core.example.invalid/api/clio/tools/get_legal_reference');
  assert.deepEqual(out.result,f.page);assert.equal(call.input.citation,citation);
  if(!['rules','versions'].includes(selection.view)){assert.equal(out.result.result.referenceId,selection.referenceId);assert.equal(out.result.result.edition,null);}
 }
});

test('citation precedence: the frozen reference selector is identical for every possible parse code',()=>{
 const f=storedCase(id);
 for(const [,selection] of accepted.filter(([,s])=>!['rules','versions'].includes(s.view)))for(const citation of citations){
  const request={...selection,citation},base={clientResolution:null,citationResolution:null},expected=f.contract.normalizeInput(request,base).input;
  for(const code of ['statute','constitution']){
   const context={...base,citationResolution:{citation,referenceId:'a-parser-produced-reference',code}};
   assert.deepEqual(f.contract.normalizeInput(request,context).input,expected);
  }
 }
});

test('citation precedence: implicit identity and effective edition stay unavailable before credential factories',async()=>{
 const f=storedCase(id),{getCredentials,...transport}=f.transport;let factories=0;
 const [handler]=createResearchLegalLegislationHandlers({...transport,now:f.now,credentialsForCall:()=>{factories++;return getCredentials;}},[operation]);
 for(const citation of citations)for(const selection of [{},{referenceId:''},{referenceId:null},{referenceId:'explicit',edition:'2026'},
  {referenceId:'explicit',code:'statute',edition:'2026'},{referenceId:'explicit',code:null,edition:'2026'},
  {referenceId:'explicit',code:'Constitution',edition:'2026'},{referenceId:'explicit',code:'constitution ',edition:'2026'}]){
  const request={...selection,citation};assert.throws(()=>assertLegalSliceRequest(operation,request),{message:'UNAVAILABLE'});
  await assert.rejects(handler.execute({...f.call(),request}),{message:'UNAVAILABLE'});
 }
 assert.equal(factories,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('citation precedence: accepted citations cannot relax client name, folder or current UUID resource authority',async()=>{
 for(const selection of [{view:'rules'},{referenceId:'explicit'},{referenceId:'explicit',code:'constitution',edition:'2026'}]){
  const base={...selection,citation:'Article I'};
  for(const extra of [{clientId:'Client name'},{folderId:'folder'},{folderId:' '}])assert.throws(()=>assertLegalSliceRequest(operation,{...base,...extra}),{message:'UNAVAILABLE'});
  const f=storedCase(id,{request:{...base,clientId:` ${clientId.toUpperCase()} `}}),out=JSON.parse(await f.handler()(f.call()));
  assert.equal(out.result.result.scope.clientId,clientId);assert.equal(f.credentialCalls[0].normalizationContext.citationResolution,null);
  const call=structuredClone(f.call());call.authority.subject.entityIds=['d1234567-b123-4c12-8d12-e123456789ab'];
  await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);
 }
});

test('citation precedence: canonical bounds, branch requirements and inert raw data still reject before source IO',async()=>{
 const f=storedCase(id);let hooks=0;
 for(const request of [{view:'rules',citation:'x'.repeat(181)},{view:'versions',citation:'Article I'},
  {referenceId:'explicit',citation:1},{referenceId:'explicit',citation:'Article I',extra:true},
  {referenceId:'explicit',get citation(){hooks++;return 'Article I';}}]){
  assert.throws(()=>assertLegalSliceRequest(operation,request),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),request}),{message:'INVALID_ARGUMENTS'});
 }
 assert.equal(hooks,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 assert.throws(()=>assertLegalSliceRequest({id:'search_legislative_research',version:'0.2.0'},{sessionKey:'2026',citation:'Article I'}),{message:'INVALID_ARGUMENTS'});
 assert.equal(ids.length,2);
});

test('citation precedence: native parser/source errors and receiving substitutions remain failures',async()=>{
 const f=storedCase(id,{request:{referenceId:'explicit',citation:`1.10${'(a)'.repeat(11)}`}});
 for(const message of ['INVALID_LEGAL_REFERENCE','INVALID_STATUTE_HIERARCHY','EDITION_REQUIRED','FEATURE_DISABLED']){
  f.state.responseFactory=()=>Response.json({message},{status:400});await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 f.state.responseFactory=undefined;
 for(const mutate of [p=>p.result.referenceId='a-parsed-substitution',p=>p.result.edition='2026',p=>p.result.scope.clientId=clientId]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 assert.equal(f.wire.length,7);
});
