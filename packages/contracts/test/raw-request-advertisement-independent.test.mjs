import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveOperationContract,validateShape} from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS} from '../retrieval-0.2/catalog-validation.mjs';

const T='2026-10-12T10:00:00.000Z', U='11111111-1111-4111-8111-111111111111', V='22222222-2222-4222-8222-222222222222';
const binding={tenantId:'review-tenant',actorId:'review-actor',conversationId:U,runId:V,attemptId:U,workerId:V,writerFence:1};
const subject={kind:'client',entityType:'client',entityIds:[U],tenantId:binding.tenantId,actorId:binding.actorId,authorizationDecisionId:V,policyRevision:'review-policy',rosterVersionId:null,scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:U,policyRevision:'review-policy'}]};
const contexts={query_outreach:{clientResolution:null},search_program_elements:{evidenceAccuracyMode:'off'},get_program_element:{evidenceAccuracyMode:'off'},get_pe_budget_timeline:{evidenceAccuracyMode:'off'},search_sam_opportunities:{asOf:T,evidenceAccuracyMode:'off',sourceStatusAsOf:T,sourceHealthAsOf:T},get_florida_budget_project:{asOf:T,effectiveScope:{jurisdiction:'FL',sessionKey:'',folderId:null,clientId:null},clientResolution:null},resolve_entity:{defaultCongress:119},search_tracked_bills:{binding,subject,clientReference:'Review client'},get_state_rule_status:{stageAsOf:T,commentAsOf:T},get_certification_status:{comparisonLocale:'en-US'},get_bill_status:{defaultCongress:119},search_floor_votes:{defaultCongress:119},search_federal_grants:{evidenceAccuracyMode:'off'},search_federal_awards:{evidenceAccuracyMode:'off'}};
const pe=' '.repeat(40)+'0604321'+' '.repeat(5);
// Expected values are independently specified from the existing admission paths,
// not obtained by executing a second copy of the normalization algorithm.
const cases=[
 ['query_outreach','OutreachQueryRequest',{outreachId:' record-7 ',clientId:'suppressed client',status:'ignored',limit:'3'},{outreachId:'record-7'}],
 ['search_program_elements','ProgramElementSearchRequest',{q:' Review alias ',limit:'2.9',page:'3.7',hasData:'true'},{query:'Review alias',service:null,budgetActivity:null,hasData:null,page:3,limit:2}],
 ['get_program_element','ProgramElementDetailRequest',{peCode:pe},{peCode:'0604321'}],
 ['get_pe_budget_timeline','ProgramElementTimelineRequest',{peCode:pe},{peCode:'0604321'}],
 ['search_public_web','PublicWebSearchRequest',{query:' Review public ',limit:'3.8'},{query:'Review public',limit:3}],
 ['scrape_web_page','PublicWebPageRequest',{url:' https://example.test/review ',mode:' extract ',maxChars:'701.9'},{url:'https://example.test/review',mode:'extract',maxChars:701}],
 ['search_sam_opportunities','SamOpportunitiesRequest',{query:' Review source ',naics:null,limit:'2.9'},{query:'Review source',naics:null,includeInactive:false,limit:2}],
 ['get_florida_budget_project','FloridaBudgetRequest',{q:' retained spaces ',offset:'2'},{q:' retained spaces ',fiscalYear:'2026-27',projectId:'',offset:2,sessionKey:'',folderId:null,clientId:null}],
 ['get_state_bill_status','StateBillStatusRequest',{query:' TX HB 7 ',state:' tx '},{billId:'TX HB 7',state:'tx'}],
 ['search_state_floor_votes','StateFloorVotesRequest',{query:' vote ',chamber:' HOUSE ',limit:'3.8'},{query:'vote',chamber:'house',limit:3}],
 ['find_contacts','TenantContactsRequest',{domain:' EXAMPLE.TEST ',query:' Person ',limit:'7.9'},{clientId:null,domain:'example.test',query:'Person',limit:7}],
 ['resolve_entity','EntityCandidatesRequest',{query:' H001234 ',type:' MEMBER ',limit:'3.4'},{limit:3,query:'H001234',type:'member'}],
 ['search_tracked_bills','TrackedBillsRequest',{clientId:' Review client '},{clientId:U}],
 ['get_committee_roster','CommitteeRosterRequest',{committee:' Appropriations ',jurisdiction:' STATE ',state:' fl '},{committee:'Appropriations',jurisdiction:'state',state:'FL'}],
 ['list_members','MemberListRequest',{state:' fl ',chamber:' HOUSE ',limit:'7.8'},{limit:7,state:'Florida',chamber:'house'}],
 ['get_pe_contractors','PeContractorsRequest',{peCode:pe},{peCode:'0604321'}],
 ['get_pe_bills','PeBillsRequest',{peCode:pe},{peCode:'0604321'}],
 ['get_pe_report_language','PeReportLanguageRequest',{peCode:pe},{peCode:'0604321'}],
 ['get_state_rule_status','RuleStatusRequest',{query:' agency review ',state:' fl '},{query:'agency review',state:'FL'}],
 ['get_certification_status','CertificationStatusRequest',{program:'fedramp',query:' Review vendor '},{program:'fedramp',query:'Review vendor'}],
 ['search_sec_filings','DisclosuresSecRequest',{companyName:' Review company ',limit:'3.9'},{limit:3,query:'Review company'}],
 ['search_fara_registrations','DisclosuresFaraRequest',{registrant:' Review registrant ',limit:'4.9'},{limit:4,registrantName:'Review registrant'}],
 ['search_lda_filings','DisclosuresLdaRequest',{query:' Review client ',registrant:' Registry ',issue:' Health ',year:'2025',page:'2.9'},{limit:15,clientName:'Review client',registrantName:'Registry',issueCode:'Health',page:2,year:2025}],
 ['get_bill_status','FederalBillStatusRequest',{query:' HR 7 '},{billId:'119-hr-7'}],
 ['search_floor_votes','FederalFloorVotesRequest',{member:' h001234 ',chamber:' HOUSE ',limit:'4.2'},{billId:null,query:null,member:'h001234',bioguideId:'H001234',chamber:'house',congress:null,limit:4}],
 ['search_state_bills','StateBillSearchRequest',{query:' Water ',state:' fl ',limit:'3.8'},{limit:3,query:'Water',state:'FL'}],
 ['get_state_legislator','StateLegislatorRequest',{query:' Member ',state:' fl ',limit:'3.8'},{limit:3,query:'Member',state:'FL'}],
 ['query_economic_data','PublicEconomicRequest',{dataset:' Survey ',state:' fl ',source:' BLS ',year:'2025',limit:'3.8'},{limit:3,state:'FL',source:'bls',datasetName:'Survey',year:2025}],
 ['search_federal_grants','PublicGrantRequest',{agency:' Agency ',limit:'3.8'},{limit:3,agency:'Agency'}],
 ['search_federal_awards','PublicAwardRequest',{peCode:' ab12 ',page:'2',limit:'3.8'},{limit:3,peCode:'AB12',page:2}],
 ['lookup_client_registry','ClientRegistryRequest',{name:' '+ '🧭'.repeat(160)+' '},{name:'🧭'.repeat(150)}]
];
const descriptorDef=c=>c.descriptor.inputSchema.id.split('#/$defs/')[1];
function contract(id){return resolveOperationContract({id,version:'0.2.0'})}
function advertised(c,raw){const b=c.binding,schema=JSON.parse(readFileSync(new URL(`../retrieval-0.2/${b.group}.schema.json`,import.meta.url)));assert.equal(c.descriptor.inputSchema.id,`${schema.$id}#/$defs/${b.input}`);validateShape(descriptorDef(c),raw)}
for(const[id,rawDef,raw,expected]of cases){
 test(`independent raw factory oracle: ${id}`,()=>{validateShape(rawDef,raw);const result=contract(id).normalizeInput(raw,contexts[id]??{});assert.deepEqual(result.input,expected);assert.deepEqual(result.request,raw);assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result.input),true)});
 test(`independent advertised caller: ${id}`,()=>{const c=contract(id);advertised(c,raw);assert.deepEqual(c.normalizeInput(raw,contexts[id]??{}).input,expected)});
 test(`independent caller closure: ${id}`,()=>{const c=contract(id),ctx=contexts[id]??{};for(const field of ['unadvertisedField','binding','subject','asOf','evidenceAccuracyMode','clientResolution','authorizationDecisionId']){const data={...raw,[field]:'forged'};assert.throws(()=>advertised(c,data));assert.throws(()=>c.normalizeInput(data,ctx))}assert.throws(()=>c.normalizeInput(raw,{...ctx,unadvertisedContext:true}))});
 test(`independent inert canonical admission: ${id}`,()=>{let calls=0;const c=contract(id),ctx=contexts[id]??{},key=Object.keys(raw)[0];const accessor=Object.defineProperty({...raw},key,{get(){calls++;throw Error('getter')},enumerable:true});const proxy=new Proxy(raw,{ownKeys(){calls++;return[]}});for(const value of[accessor,proxy])assert.throws(()=>c.normalizeInput(value,ctx));assert.equal(calls,0)});
}
test('independent exact31 raw bindings advertise actual admitted request definitions',()=>{assert.equal(cases.length,31);assert.equal(new Set(cases.map(x=>x[0])).size,31);for(const[id,rawDef]of cases)assert.equal(contract(id).binding.input,rawDef,id)});
const minimal={get_program_element:{peCode:'x'},get_pe_budget_timeline:{peCode:'x'},get_pe_contractors:{peCode:'x'},get_pe_bills:{peCode:'x'},get_pe_report_language:{peCode:'x'},search_public_web:{query:'x'},scrape_web_page:{url:'https://example.test/'},search_tracked_bills:{clientId:'Review client'},get_certification_status:{program:'fedramp',query:'x'},lookup_client_registry:{name:'x'}};
for(const[id]of cases)test(`independent advertised defaults: ${id}`,()=>{const c=contract(id),raw=minimal[id]??{};const before=c.normalizeInput(raw,contexts[id]??{});advertised(c,raw);assert.deepEqual(c.normalizeInput(raw,contexts[id]??{}),before)});
test('independent trusted resolution remains external, UUID cannot be rebound',()=>{const c=contract('search_tracked_bills');assert.throws(()=>c.normalizeInput({clientId:V},{...contexts.search_tracked_bills,clientReference:V}));assert.throws(()=>c.normalizeInput({clientId:'Review client'},{}));assert.deepEqual(c.normalizeInput({clientId:'Review client'},contexts.search_tracked_bills).input,{clientId:U})});
test('independent required caller fields remain required',()=>{for(const id of Object.keys(minimal))assert.throws(()=>contract(id).normalizeInput({},contexts[id]??{}),id)});
test('independent Request advertisement is not normalized validity or current authority',()=>{const c=contract('scrape_web_page');validateShape('PublicWebPageRequest',{url:'file:///private'});assert.throws(()=>c.normalizeInput({url:'file:///private'}));assert.equal(c.descriptor.availability,'unimplemented');assert.equal(c.descriptor.handler,null)});
test('independent long raw registry selector remains valid before trimming',()=>{const raw={name:' '.repeat(301)+'Review'},c=contract('lookup_client_registry');assert.deepEqual(c.normalizeInput(raw).input,{name:'Review'});advertised(c,raw)});
test('independent normalized domain constraints remain stronger than caller shape',()=>{const raw={offset:'2.5'},c=contract('get_florida_budget_project');validateShape('FloridaBudgetRequest',raw);assert.throws(()=>c.normalizeInput(raw,contexts.get_florida_budget_project))});
// Trace the factory's real validateShape call, rather than treating a suffix as
// admission evidence. These are local Meri contract factories, not source adapters.
const factoryNames={
 'outreach-query':'createOutreachQueryValidators','program-elements':'createProgramElementValidators','public-web':'createPublicWebValidators','sam-opportunities':'createSamOpportunitiesValidators','florida-budget':'createFloridaBudgetValidators','state-status-votes':'createStateStatusVotesValidators','tenant-contacts':'createTenantContactsValidators','entity-candidates':'createEntityCandidatesValidators','tracked-bills':'createTrackedBillsValidators','legislative-directory':'createLegislativeDirectoryValidators','pe-references':'createPeReferenceValidators','rule-status':'createRuleStatusValidators','certification-status':'createCertificationStatusValidators','disclosures':'createDisclosuresValidators','federal-legislation':'createFederalLegislationValidators','state-legislation':'createStateLegislationValidators','public-data':'createPublicDataValidators','client-registry':'createClientRegistryValidators'};
for(const[id,rawDef,raw,expected]of cases)test(`independent instrumented factory admission: ${id}`,async()=>{
 const b=CATALOG_OPERATION_BINDINGS.find(x=>x.id===id),schema=JSON.parse(readFileSync(new URL(`../retrieval-0.2/${b.group}.schema.json`,import.meta.url)));
 const module=await import(`../retrieval-0.2/${b.group}-validation.mjs`);
 const {assertSubject}=await import('../retrieval-0.2/validate.mjs');const {canonicalSha256}=await import('../validate.mjs');const calls=[];
 const factory=module[factoryNames[b.group]]({schema,assertSubject,canonicalSha256,validateShape(name,value){calls.push(name);return validateShape(name,value)}});
 const api=b.group==='florida-budget'?{floridaBudgetValidators:factory}:factory;
 const result=b.normalize(api,raw,contexts[id]??{},b);assert.deepEqual(result.input,expected);assert.ok(calls.includes(rawDef),`${id} never admitted ${rawDef}: ${calls.join(',')}`);validateShape(rawDef.replace(/Request$/,'Input'),result.input);
});
