// Explicit reviewed continuation allowlist; the original13-descriptor hash is unchanged.
const continuationIds = ["search_funding_opportunities", "get_funding_opportunity_requirements", "get_funding_opportunity", "get_opportunity_client_context", "get_opportunity_government_landscape", "read_client_documents", "query_economic_data", "search_federal_grants", "search_federal_awards", "get_district_nexus_context", "get_district_nexus_changes", "search_state_bills", "get_state_legislator", "search_cbo_cost_estimates", "search_gao_reports", "search_crs_reports", "search_sec_filings", "search_fara_registrations", "search_lda_filings", "search_acquisition_personnel", "get_acquisition_person", "get_bill_status", "search_floor_votes", "search_congress_bills", "read_bill_text", "get_committee_roster", "list_members", "get_pe_contractors", "get_pe_bills", "get_pe_report_language", "get_state_rule_status", "get_certification_status", "search_intel_articles", "list_global_datasets", "get_representation", "get_state_bill_status", "search_state_floor_votes", "query_regulatory_dockets", "find_contacts", "resolve_entity", "search_tracked_bills", "query_intelligence", "search_public_web", "scrape_web_page", "search_sam_opportunities", "get_florida_budget_project", "query_outreach", "search_program_elements", "get_program_element", "get_pe_budget_timeline"];
// Independently specified synthetic DTOs; no source access or authorization.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalSha256} from '../validate.mjs';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS} from '../retrieval-0.2/catalog-validation.mjs';

const TENANT='11111111-1111-4111-8111-111111111111';
const ACTOR='22222222-2222-4222-8222-222222222222';
const CLIENT='33333333-3333-4333-8333-333333333333';
const OTHER='44444444-4444-4444-8444-444444444444';
const ID='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const OLDER='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reference={id:'memory.list_own_proposals',version:'0.2.0'};
const contract=()=>resolveOperationContract(reference);
const subject=(client=null)=>({tenantId:TENANT,actorId:ACTOR,kind:client?'client':'personal',
  entityType:client?'client':'user',entityIds:[client??ACTOR],rosterVersionId:null,
  policyRevision:'synthetic',authorizationDecisionId:OTHER,
  scopes:[{tenantId:TENANT,kind:client?'client':'private-user',resourceId:client??ACTOR,policyRevision:'synthetic'}]});
const context=(client=null)=>({subject:subject(client)});
const row=(changes={})=>({id:ID,status:'pending',approvedFact:false,scope:'personal',clientId:null,
  sourceKind:'explicit_user',createdAt:'2026-01-02T00:00:00.000Z',restricted:false,
  title:'Synthetic proposal',proposedText:'Unapproved synthetic content',contentTruncated:false,...changes});
const page=(changes={})=>({tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',
  claimsAreApprovedFacts:false,scope:{tenantId:TENANT,userId:ACTOR,clientId:null},candidates:[row()],
  nextCursor:null,coverage:{firstPage:true,complete:true,reason:'own_pending_proposals_complete'},...changes});
const partial=(changes={})=>page({coverage:{firstPage:true,complete:false,reason:'unread_pages_restricted_or_truncated_content'},...changes});
const outputContext=(request={},client=null)=>({...context(client),request});
const classification=kind=>({kind,claimsAreApprovedFacts:false,evidenceReady:false,negativeAssertion:'none'});

test('canonical memory binding resolves only its private version and remains unavailable',()=>{
  const {descriptor,binding}=contract();
  assert.equal(binding,CATALOG_OPERATION_BINDINGS.find(value=>value.nativeId==='list_memory_proposals'));
  assert.deepEqual(binding.contextKeys,['subject','previous']);assert.ok(Object.isFrozen(binding.contextKeys));
  assert.equal(descriptor.handler,null);assert.equal(descriptor.availability,'unimplemented');
  assert.equal(descriptor.qualification,'pending');assert.deepEqual(descriptor.retry.retryableCodes,[]);
  assert.equal(descriptor.retry.maxRetries,0);assert.equal(descriptor.sideEffect,'none');
  assert.equal(descriptor.approvalBoundary,'none');assert.deepEqual(descriptor.aliases,['list_memory_proposals']);
  for(const id of ['list_memory_proposals','memory.approve','memory.list_own_proposals'])
    assert.throws(()=>resolveOperationContract({id,version:'0.1.0'}));
});

test('memory normalization returns frozen original request and effective selection digest',()=>{
  const request={clientId:null,cursor:null,limit:null}, trusted=context(CLIENT);
  const prepared=contract().normalizeInput(request,trusted);
  assert.deepEqual(prepared.request,request);
  assert.deepEqual(prepared.input,{clientId:CLIENT,cursor:null,limit:5});
  assert.equal(prepared.argumentsSha256,canonicalSha256(prepared.input));
  assert.notEqual(prepared.argumentsSha256,canonicalSha256(prepared.request));
  assert.equal(prepared.metadata,null);
  request.limit=10;trusted.subject.entityIds[0]=OTHER;
  assert.equal(prepared.request.limit,null);assert.equal(prepared.input.clientId,CLIENT);
  for(const value of [prepared,prepared.request,prepared.input])assert.ok(Object.isFrozen(value));
  assert.deepEqual(contract().normalizeInput({},context()).input,{clientId:null,cursor:null,limit:5});
});

test('memory requires trusted subject and refuses legacy or model authority keys',()=>{
  const c=contract();
  for(const value of [{},{actorId:ACTOR},{nowMs:0},{subject:null},
    {...context(),actorId:ACTOR},{...context(),nowMs:0},{...context(),previousPage:{}},
    {...context(),request:{}},{...context(),tenantId:TENANT}])assert.throws(()=>c.normalizeInput({},value));
  for(const request of [{subject:subject()},{actorId:ACTOR},{tenantId:TENANT},{approvedFact:true}])
    assert.throws(()=>c.normalizeInput(request,context()));
  const malformed=context();malformed.subject.entityIds=[OTHER];
  assert.throws(()=>c.normalizeInput({},malformed));
  assert.throws(()=>c.assertOutput(page(),context()),/original request/);
  for(const key of ['actorId','nowMs','previousPage'])
    assert.throws(()=>c.assertOutput(page(),{...outputContext(),[key]:null}),/Unknown operation contract context/);
});

test('memory binding preserves selected-client and result actor tenant scope checks',()=>{
  const c=contract(), prepared=c.normalizeInput({},context(CLIENT));
  const selected=page({scope:{tenantId:TENANT,userId:ACTOR,clientId:CLIENT},candidates:[row({scope:'client',clientId:CLIENT})]});
  assert.deepEqual(c.assertOutput(selected,outputContext(prepared.request,CLIENT)),classification('complete'));
  assert.throws(()=>c.normalizeInput({clientId:CLIENT},context()));
  assert.throws(()=>c.normalizeInput({clientId:OTHER},context(CLIENT)));
  for(const scope of [{...selected.scope,tenantId:OTHER},{...selected.scope,userId:OTHER},
    {...selected.scope,clientId:OTHER},{...selected.scope,clientId:null}])
    assert.throws(()=>c.assertOutput({...selected,scope},outputContext(prepared.request,CLIENT)));
  assert.throws(()=>c.assertOutput({...selected,candidates:[row({scope:'client',clientId:OTHER})]},outputContext(prepared.request,CLIENT)));
});

test('complete empty and disabled queue results never become evidence facts or absence',()=>{
  const c=contract();
  assert.deepEqual(c.assertOutput(page(),outputContext()),classification('complete'));
  assert.deepEqual(c.assertOutput(page({candidates:[]}),outputContext()),classification('empty'));
  const disabled=page({enabled:false,candidates:[],coverage:{firstPage:true,complete:false,reason:'review_disabled'}});
  assert.deepEqual(c.assertOutput(disabled,outputContext()),classification('unavailable'));
  for(const change of [{claimsAreApprovedFacts:true},{evidenceReady:true},{negativeAssertion:'complete'},
    {candidates:[row({approvedFact:true})]},{candidates:[row({status:'approved'})]}])
    assert.throws(()=>c.assertOutput(page(change),outputContext()));
});

test('restricted truncated and missing proposal text retain partial coverage and redaction',()=>{
  const c=contract();
  for(const candidate of [row({restricted:true,title:null,proposedText:null}),row({contentTruncated:true}),row({proposedText:null})]){
    assert.deepEqual(c.assertOutput(partial({candidates:[candidate]}),outputContext()),classification('partial'));
    assert.throws(()=>c.assertOutput(page({candidates:[candidate]}),outputContext()));
  }
  assert.throws(()=>c.assertOutput(partial({candidates:[row({restricted:true,title:'leaked',proposedText:null})]}),outputContext()));
});

test('binding continuation retains exact original request page cursor limit and advancing keys',()=>{
  const c=contract(), prior=partial({nextCursor:'next'});
  const options={...context(),previous:{request:{limit:5},page:prior}};
  const prepared=c.normalizeInput({cursor:'next'},options);
  assert.deepEqual(prepared.request,{cursor:'next'});assert.deepEqual(prepared.input,{clientId:null,cursor:'next',limit:5});
  const next=partial({candidates:[row({id:OLDER})],coverage:{firstPage:false,complete:false,reason:'unread_pages_restricted_or_truncated_content'}});
  assert.deepEqual(c.assertOutput(next,{...options,request:prepared.request}),classification('partial'));
  for(const request of [{cursor:'wrong'},{cursor:'next',limit:10},{}])assert.throws(()=>c.normalizeInput(request,options));
  for(const change of [{candidates:[row()]},{nextCursor:'next'},
    {coverage:{firstPage:false,complete:true,reason:'own_pending_proposals_complete'}}])
    assert.throws(()=>c.assertOutput({...next,...change},{...options,request:prepared.request}));
  for(const mutate of [value=>{value.previous.page.scope.userId=OTHER;},
    value=>{value.previous.request.limit=10;},value=>{value.previous.page.nextCursor='other';},
    value=>{value.previous.page.scope.clientId=CLIENT;}]){
    const changed=structuredClone(options);mutate(changed);assert.throws(()=>c.normalizeInput({cursor:'next'},changed));
  }
});

test('finite timestamp admission survives the canonical binding and retained page path',()=>{
  const c=contract(), invalid=row({createdAt:'2026-06-30T23:59:60Z'});
  assert.throws(()=>c.assertOutput(page({candidates:[invalid]}),outputContext()),/finite instant/);
  for(const candidates of [[invalid,row({id:OLDER})],[row({id:OLDER}),invalid]])
    assert.throws(()=>c.assertOutput(page({candidates}),outputContext()),/finite instant/);
  const options={...context(),previous:{request:{},page:partial({candidates:[invalid],nextCursor:'next'})}};
  assert.throws(()=>c.normalizeInput({cursor:'next'},options),/finite instant/);
  assert.throws(()=>c.assertOutput(partial(),{...options,request:{cursor:'next'}}),/finite instant/);
});

test('binding inert admission refuses getters proxies cycles and serialization hooks without effects',()=>{
  const c=contract();let effects=0;
  const getter={};Object.defineProperty(getter,'limit',{enumerable:true,get(){effects++;return 5;}});
  const proxy=new Proxy({},{get(){effects++;throw Error('get');},getPrototypeOf(){effects++;throw Error('prototype');}});
  const hooked={toJSON(){effects++;return {};}};const cyclic={};cyclic.limit=cyclic;
  for(const value of [getter,proxy,hooked,cyclic,new Array(1)])assert.throws(()=>c.normalizeInput(value,context()));
  const options=context();Object.defineProperty(options,'previous',{enumerable:true,get(){effects++;return null;}});
  assert.throws(()=>c.normalizeInput({cursor:'next'},options));
  assert.throws(()=>c.assertOutput(proxy,outputContext()));
  const result=page();Object.defineProperty(result.candidates[0],'createdAt',{enumerable:true,get(){effects++;return '2026-01-02T00:00:00Z';}});
  assert.throws(()=>c.assertOutput(result,outputContext()));assert.equal(effects,0);
});

test('strict family limits and output original request survive binding normalization',()=>{
  const c=contract();
  for(const request of [{limit:0},{limit:11},{limit:'5'},{cursor:'x'.repeat(2049)}])
    assert.throws(()=>c.normalizeInput(request,context()));
  const request={limit:1}, prepared=c.normalizeInput(request,context());request.limit=10;
  assert.throws(()=>c.assertOutput(page({candidates:[row(),row({id:OLDER})]}),outputContext(prepared.request)),/requested limit/);
  assert.deepEqual(c.assertOutput(page(),outputContext(prepared.request)),classification('complete'));
  assert.throws(()=>c.assertOutput(page({candidates:[row({title:'😀'.repeat(101)})]}),outputContext()),/UTF-16/);
});

test('all thirteen earlier bindings retain legacy context grammar and refuse memory-only keys',()=>{
  const requests=[['mail.read_thread',{subject:{kind:'personal'},threadId:ID}],
    ['mail.list_messages',{subject:{kind:'personal'}}],['mail.search_messages',{subject:{kind:'personal'},query:'synthetic'}],
    ['meeting.list_upcoming_meetings',{}],['meeting.read_client_meetings',{clientId:CLIENT}],
    ['meeting.query_debriefs',{clientId:CLIENT}],['query_tasks',{}],['search_capiro_data',{query:'synthetic',domains:['mail']}],
    ['search_federal_contract_awards',{}],['search_federal_subawards',{}],['search_contract_vehicles',{}],
    ['search_procurement_forecasts',{}],['get_district_federal_market',{state:'CA',district:'12'}]];
  assert.equal(requests.length,13);
  const legacy={nowMs:Date.parse('2026-01-01T00:00:00Z'),actorId:ACTOR,previousPage:null};
  for(const [id,request] of requests){
    const c=resolveOperationContract({id,version:'0.2.0'}), prepared=c.normalizeInput(request,legacy);
    assert.deepEqual(prepared.request,request);assert.equal(prepared.argumentsSha256,canonicalSha256(prepared.input));
    for(const key of ['subject','previous','request'])
      assert.throws(()=>c.normalizeInput(request,{...legacy,[key]:null}),/Unknown operation contract context/);
    for(const key of ['subject','previous'])
      assert.throws(()=>c.assertOutput({},{...legacy,request:prepared.request,[key]:null}),/Unknown operation contract context/);
  }
});

test('catalog preserves the original thirteen descriptors and complete selected/deferred ledger',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json',import.meta.url)));
  // Canonical hash of the thirteen descriptors at the assigned source base.
  assert.equal(canonicalSha256(catalog.operations.filter(value=>![reference.id,'query_action_items',
    'lookup_client_registry','get_business_development_context','get_business_development_evidence',
    'get_business_development_recent_changes','get_research_portfolio','get_research_portfolio_changes',...continuationIds].includes(value.operation.id))),
    'c60f90cf599299c1edb14538b653772b4f1d52b9c311636653aba7c08de29095');
  assert.equal(catalog.operations.length,71);assert.equal(catalog.originals.length,139);
  assert.equal(catalog.originals.filter(value=>value.disposition==='selected').length,96);
  assert.equal(catalog.originals.filter(value=>value.disposition==='deferred').length,43);
  assert.equal(catalog.originals.filter(value=>value.disposition==='selected'&&value.state==='pending').length,26);
});
