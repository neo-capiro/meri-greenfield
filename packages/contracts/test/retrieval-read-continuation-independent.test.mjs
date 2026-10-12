import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../validate.mjs';
import {assertCatalog, resolveOperationContract, validateShape} from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS} from '../retrieval-0.2/catalog-validation.mjs';
import {createPublicDataValidators} from '../retrieval-0.2/public-data-validation.mjs';
import {createStateLegislationValidators} from '../retrieval-0.2/state-legislation-validation.mjs';
import {createSourceDisabledGateway} from '../../../apps/gateway/index.mjs';
import {fixture as gatewayFixture,NOW as GATEWAY_NOW,limits as gatewayLimits,uuid} from '../../../apps/gateway/test/fixtures.mjs';

// Independent pre-candidate baseline and literal synthetic projections. All
// calls below use the real canonical resolver; no family compiler or adapter.
const baseline = JSON.parse(readFileSync(new URL('../../../docs/qualification/candidates/read-continuation-20261012/integration-review/baseline.json', import.meta.url)));
const funding=['search_funding_opportunities','get_funding_opportunity_requirements','get_funding_opportunity','get_opportunity_client_context','get_opportunity_government_landscape'];
const DOC='read_client_documents',ECON='query_economic_data',GRANT='search_federal_grants',AWARD='search_federal_awards';
const DIST='get_district_nexus_context',CHANGES='get_district_nexus_changes',BILL='search_state_bills',PERSON='get_state_legislator';
const CBO='search_cbo_cost_estimates',GAO='search_gao_reports',CRS='search_crs_reports';
const additions=[...funding,DOC,ECON,GRANT,AWARD,DIST,CHANGES,BILL,PERSON,CBO,GAO,CRS];
const U='9abcdef0-1234-4234-9234-123456789012',V='8abcdef0-1234-4234-9234-123456789012';
const T='2026-10-11T07:08:09.000Z',client='combined-client',document='combined-document';
const resolve=id=>resolveOperationContract({id,version:'0.2.0'}), clone=structuredClone;
const hash=s=>createHash('sha256').update(s).digest('hex');
function scope(){return {binding:{tenantId:'combined-tenant',actorId:'combined-actor',conversationId:U,runId:V,
  attemptId:U,workerId:V,writerFence:91},subject:{kind:'client',entityType:'client',entityIds:[client],
  tenantId:'combined-tenant',actorId:'combined-actor',authorizationDecisionId:V,policyRevision:'combined-policy',
  rosterVersionId:null,scopes:[{kind:'client',tenantId:'combined-tenant',resourceId:client,policyRevision:'combined-policy'}]}};}
const expectedKeys=id=>funding.includes(id)?['asOf']:[DOC,DIST,CHANGES].includes(id)?['binding','subject']:[GRANT,AWARD].includes(id)?['evidenceAccuracyMode']:[];
function context(id){return funding.includes(id)?{asOf:T}:[DOC,DIST,CHANGES].includes(id)?scope():[GRANT,AWARD].includes(id)?{evidenceAccuracyMode:'off'}:{};}
function request(id){
  if(funding.includes(id))return [funding[0],funding[3]].includes(id)?{clientId:U}:{clientId:U,source:'sam_gov',sourceRecordId:V};
  if(id===DOC)return {clientId:client};
  if([DIST,CHANGES].includes(id))return {clientId:client,state:' ca ',district:'05'};
  if(id===PERSON)return {query:'Synthetic'};
  return {};
}
function grant(){return {id:'combined-grant',title:'Synthetic grant',agency:'Synthetic agency',subAgency:null,
  opportunityNumber:null,category:null,awardCeiling:null,awardFloor:null,estimatedFunding:null,openDate:null,
  closeDate:null,deadlineStatus:'unknown',syncedStatus:null,eligibility:[],url:null};}
function award(){return {id:V,contractorName:null,awardingAgency:null,awardingSubTier:null,amount:null,description:'Synthetic award',
  peCode:null,recipientState:null,popCongressionalDistrict:null,actionDate:null,piid:null,latestActionDate:null,
  baseAwardSignedDate:null,sourceLastModifiedDate:null,popStartDate:null,popEndDate:null,lastSyncedAt:T};}
function output(id){
  if(funding.includes(id))return {tool:id,state:'disabled',explanation:'Synthetic source is disabled; no source absence established.',asOf:T,data:null};
  if(id===DOC)return {...scope(),data:{tool:id,generatedAt:T,clientId:client,
    coverage:{total:1,returned:1,truncated:false,nextCursor:null,complete:true,paginationComplete:true,query:null,queryAppliesTo:'fileName'},
    note:'Synthetic listing only.',documents:[{id:document,fileName:'Evidence.txt',contentType:'text/plain',byteSize:13,
      createdAt:T,indexedAt:null,extractionStatus:null,extractionMetadata:{claimedAuthorized:true},usable:true,blockedReason:null,disclosure:null}]}};
  if([DIST,CHANGES].includes(id))return {...scope(),data:{available:true,clientId:client,state:'CA',district:'05',generatedAt:T,
    ...(id===DIST?{clientName:'Synthetic Client',facts:[]}:{changes:[]}),gaps:[],truncated:false}};
  if(id===ECON)return {tool:id,source:'census',generatedAt:T,data:[{id:'CA-05',state:'CA',district:'05',congress:119,
    totalPopulation:null,medianHouseholdIncome:null,medianAge:null,percentBachelorPlus:null,percentPoverty:null,
    unemploymentRate:null,laborForceSize:null,topIndustries:null}]};
  if(id===GRANT)return {tool:id,generatedAt:T,asOf:T,total:0,data:[grant()]};
  if(id===AWARD)return {tool:id,generatedAt:T,total:0,page:1,pageSize:20,hasMore:false,nextPage:null,paginationLimitReached:false,data:[award()]};
  if(id===BILL)return {tool:id,generatedAt:T,total:1,data:[{id:'ca-session-hb5',state:'CA',session:'Synthetic session',identifier:'HB 5',title:'Synthetic bill',
    chamber:null,subjects:[],status:'future status',statusLabel:'future status',sponsorName:null,sponsorParty:null,sponsorCount:0,
    latestActionDate:null,latestActionText:null,stateUrl:null,url:null}]};
  if(id===PERSON)return {tool:id,generatedAt:T,matchesFound:1,matches:[{id:'synthetic-person',name:'Synthetic',state:'CA',
    chamber:null,district:null,party:null,committees:{arbitrary:[true,null]},active:false,matchedBy:'name-search'}]};
  if(id===CBO)return {tool:id,generatedAt:T,estimatesFound:1,estimates:[{id:'synthetic-estimate',billId:null,congress:119,
    billType:'hr',billNumber:'5',title:'Synthetic estimate',description:null,pubDate:T,cboUrl:'stored-reference'}]};
  if(id===GAO)return {tool:id,generatedAt:T,total:0,data:[{id:'synthetic-gao',title:'Synthetic report',url:null,publishDate:null,
    reportType:null,topics:[],agencies:[],summary:'Bounded synthetic summary.',recommendations:null}]};
  return {tool:id,generatedAt:T,total:0,data:[{id:'synthetic-crs',title:'Synthetic report',date:null,authors:[],topics:[],
    summary:'Bounded synthetic summary.',pdfUrl:null,htmlUrl:null}]};
}
const verify=(id,page=output(id),raw=request(id),ctx=context(id))=>resolve(id).assertOutput(page,{...ctx,request:raw});

test('independent original139 boundaries and prior21 descriptors survive only the16 explicit mappings',()=>{
  assertCatalog(catalog);assert.equal(catalog.catalogVersion,'0.2.5');
  assert.equal(catalog.originals.length,139);assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);
  assert.equal(catalog.originals.filter(x=>x.disposition==='deferred').length,43);
  assert.equal(catalog.operations.length,37);assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,36);
  assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.state==='pending').length,60);
  assert.deepEqual(catalog.operations.filter(x=>!additions.includes(x.operation.id)),baseline.descriptors);
  for(const before of baseline.originals)assert.deepEqual(catalog.originals.find(x=>x.id===before.id),
    additions.includes(before.id)?{...before,state:'mapped',replacement:{id:before.id,version:'0.2.0'}}:before);
  assert.equal(resolve('query_action_items').binding.nativeCoverage,'partial');
  assert.deepEqual(resolve('query_action_items').descriptor.aliases,[]);
  for(const id of ['query_action_items','get_research_evidence']){
    const old=baseline.originals.find(x=>x.id===id);assert.deepEqual(catalog.originals.find(x=>x.id===id),old);
    assert.equal(old.state,'pending');assert.equal(old.replacement,null);
  }
  for(const id of ['get_research_evidence','get_state_bill_status','search_state_floor_votes','search_sam_opportunities'])assert.throws(()=>resolve(id));
});

test('independent registry exact raw schema pins, explicit context sets and unavailable state',()=>{
  assert.equal(CATALOG_OPERATION_BINDINGS.length,37);
  assert.equal(new Set(CATALOG_OPERATION_BINDINGS.map(x=>x.id)).size,37);
  for(const binding of CATALOG_OPERATION_BINDINGS){
    const c=resolve(binding.id),raw=readFileSync(new URL(`../retrieval-0.2/${binding.group}.schema.json`,import.meta.url));
    const schema=JSON.parse(raw);
    for(const [field,key]of[['inputSchema','input'],['outputSchema','output']]){
      assert.ok(Object.hasOwn(schema.$defs,binding[key]));
      assert.deepEqual(c.descriptor[field],{id:`${schema.$id}#/$defs/${binding[key]}`,sha256:hash(raw)});
    }
    assert.equal(c.descriptor.availability,'unimplemented');assert.equal(c.descriptor.qualification,'pending');assert.equal(c.descriptor.handler,null);
    assert.equal(c.descriptor.retry.maxRetries,0);assert.deepEqual(c.descriptor.retry.retryableCodes,[]);
    assert.ok(Object.isFrozen(c.descriptor));assert.ok(Object.isFrozen(c.descriptor.sourceRequirements));
    if(additions.includes(binding.id))assert.deepEqual(binding.contextKeys,expectedKeys(binding.id));
  }
});

for(const id of additions){
  test(`independent canonical immutable input, digest and result path: ${id}`,()=>{
    const raw=request(id),ctx=context(id),selected=resolve(id).normalizeInput(raw,ctx),before=clone(selected);
    assert.equal(selected.argumentsSha256,canonicalSha256(selected.input));assert.deepEqual(selected.request,raw);
    for(const value of [selected,selected.request,selected.input])assert.ok(Object.isFrozen(value));
    raw.extra='changed';if(ctx.subject)ctx.subject.entityIds[0]='changed';assert.deepEqual(selected,before);
    assert.throws(()=>{selected.input.forged=true;},TypeError);
    const page=output(id),saved=clone(page),returned=verify(id,page);
    assert.deepEqual(returned,saved);assert.deepEqual(page,saved);assert.notEqual(returned,page);
    returned.forged=true;assert.equal(Object.hasOwn(page,'forged'),false);
  });
  test(`independent exact operation, scope and current-context refusal: ${id}`,()=>{
    assert.throws(()=>resolve(id).assertOutput(output(id),context(id)));
    assert.throws(()=>resolve(id).normalizeInput({...request(id),authorized:true},context(id)));
    assert.throws(()=>resolve(id).normalizeInput(request(id),{...context(id),previousPage:{}}));
    assert.throws(()=>verify(id,{...output(id),verified:true}));
    assert.throws(()=>resolveOperationContract({id,version:'0.2.1'}));
    for(const foreign of additions.filter(x=>x!==id)){
      // Both district disabled variants share a shape; available projections
      // above retain distinct facts/changes and must not cross operations.
      assert.throws(()=>verify(id,output(foreign)),undefined,`${id} <- ${foreign}`);
    }
  });
  test(`independent callback hostile input, context and result admission: ${id}`,()=>{
    let effects=0;const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){effects++;return null;}});
    const proxy=new Proxy({}, {get(){effects++;throw Error('bad');},ownKeys(){effects++;throw Error('bad');},getPrototypeOf(){effects++;throw Error('bad');}});
    const hidden={};Object.defineProperty(hidden,'x',{value:true});const cycle={};cycle.x=cycle;
    for(const value of [getter,proxy,hidden,cycle,{[Symbol('x')]:1},[,,],{n:NaN},{toJSON(){effects++;return {};}}]){
      assert.throws(()=>resolve(id).normalizeInput(value,context(id)));
      assert.throws(()=>resolve(id).normalizeInput(request(id),value));assert.throws(()=>verify(id,value));
    }
    assert.equal(effects,0);
  });
}

test('independent catalog refuses every new schema, alias, native mapping and handler substitution',()=>{
  for(const id of additions)for(const change of [
    (c,d)=>d.inputSchema.sha256='0'.repeat(64),(c,d)=>d.outputSchema.id=resolve(ECON).descriptor.inputSchema.id,
    (c,d)=>d.operation.version='0.2.1',(c,d)=>d.aliases.push('get_research_evidence'),
    (c,d)=>d.handler={module:'synthetic/handler.mjs',export:'read',sourceSha256:'0'.repeat(64)},
    (c,d)=>{d.availability='enabled';d.qualification='qualified';},
    (c,d)=>{c.originals.find(x=>x.id===id).replacement={id:'query_tasks',version:'0.2.0'};},
  ]){const mutated=clone(catalog);change(mutated,mutated.operations.find(x=>x.operation.id===id));assert.throws(()=>assertCatalog(mutated));}
});

test('funding canonical clock filters resolver request and binds refusal variants without authority',()=>{
  for(const id of funding){
    const normalized=resolve(id).normalizeInput(request(id),context(id));assert.equal(normalized.metadata.asOf,T);
    for(const key of ['authoritative','sourceConnected','producerQualified','absenceEvidence'])assert.equal(normalized.metadata[key],false);
    for(const state of ['disabled','denied','not_found','unsupported_source','invalid_request']){
      const p={...output(id),state,explanation:state==='denied'?'Not available for this client.':'Synthetic refusal.'};verify(id,p);
      assert.throws(()=>verify(id,{...p,data:{}}));
    }
    assert.throws(()=>resolve(id).normalizeInput(request(id),{}));
    assert.throws(()=>verify(id,output(id),request(id),{asOf:'2026-10-12T07:08:09.000Z'}));
    assert.throws(()=>resolve(id).normalizeInput({...request(id),asOf:T},context(id)));
  }
  for(const raw of [{},{clientId:'not-a-uuid'}])assert.throws(()=>resolve(funding[0]).normalizeInput(raw,{asOf:T}));
  const raw={...request(funding[0]),query:'  synthetic  ',page:100000},n=resolve(funding[0]).normalizeInput(raw,{asOf:T});
  assert.equal(n.input.query,'synthetic');assert.equal(n.input.page,10000);assert.notEqual(n.argumentsSha256,canonicalSha256(raw));
});

test('funding canonical available requirements retain stale count, query and exact offset lineage',()=>{
  const id=funding[1],raw={...request(id),offset:4,limit:1};
  const data={source:'sam_gov',sourceRecordId:V,requirements:[{id:'requirement-4',attachmentId:null,requirementType:'eligibility',
    statement:'Synthetic requirement',sourceExcerpt:'A😀B',excerptStart:2,excerptEnd:6,sourcePage:null,fileName:null,
    extractionMethod:'synthetic',extractionModel:'synthetic-model',confidence:'source label',reviewStatus:'pending',supersededAt:null}],
    coverage:'available',coverageExplanation:'Reported retained document window.',documentTextStatus:[],generatedAt:T,
    pagination:{offset:4,limit:1,total:0,hasMore:true,nextOffset:5}};
  const page={...output(id),state:'available',data};verify(id,page,raw);
  const bad=clone(page);bad.data.requirements[0].excerptEnd--;assert.throws(()=>verify(id,bad,raw));
  const invalidModel=clone(page);invalidModel.data.requirements[0].extractionModel=null;assert.throws(()=>verify(id,invalidModel,raw));
  assert.throws(()=>verify(id,page,{...raw,offset:3}));
  assert.throws(()=>verify(id,page,{...raw,sourceRecordId:U}));
});

test('trusted evidence mode reaches both public-data output assertions',()=>{
  for(const id of [GRANT,AWARD]){
    assert.throws(()=>resolve(id).normalizeInput({}));
    for(const mode of ['off','shadow','enforce'])assert.equal(resolve(id).normalizeInput({},{evidenceAccuracyMode:mode}).metadata.evidenceAccuracyMode,mode);
    assert.throws(()=>resolve(id).normalizeInput({evidenceAccuracyMode:'enforce'},context(id)));
    assert.throws(()=>verify(id,output(id),{}, {evidenceAccuracyMode:'enforce'}));
  }
  const g=output(GRANT);g.data[0].deadline={at:null,dateOnly:null,timeZone:null,basis:'unknown',daysRemaining:null,status:'unknown'};
  verify(GRANT,g,{}, {evidenceAccuracyMode:'enforce'});assert.throws(()=>verify(GRANT,g));
  const a=output(AWARD);a.data[0].dates={latestActionDate:null,baseAwardSignedDate:null,sourceLastModifiedDate:null,
    popStartDate:null,popEndDate:null,capiroSyncedAt:T,semantics:'Source-reported date kinds only.'};
  verify(AWARD,a,{}, {evidenceAccuracyMode:'enforce'});a.data[0].dates.capiroSyncedAt='2026-10-12T07:08:09.000Z';
  assert.throws(()=>verify(AWARD,a,{}, {evidenceAccuracyMode:'enforce'}));
  assert.throws(()=>resolve(ECON).normalizeInput({}, {evidenceAccuracyMode:'off'}));
});

test('all current binding and subject fields survive document/district output callback filtering',()=>{
  for(const id of [DOC,DIST,CHANGES]){
    assert.throws(()=>resolve(id).normalizeInput(request(id)));
    for(const key of Object.keys(scope().binding)){
      const page=output(id);page.binding[key]=key==='writerFence'?92:page.binding[key]===U?V:page.binding[key]===V?U:'foreign';
      assert.throws(()=>verify(id,page),undefined,key);
    }
    for(const change of [p=>p.subject.authorizationDecisionId=U,p=>p.subject.policyRevision='foreign',p=>p.subject.entityIds=['foreign'],p=>p.subject.scopes[0].resourceId='foreign']){
      const page=output(id);change(page);assert.throws(()=>verify(id,page));
    }
    const foreign=scope();foreign.subject.entityIds=['other'];assert.throws(()=>resolve(id).normalizeInput(request(id),foreign));
    const disabled={...scope(),data:{available:false,reason:'feature_disabled'}};
    if(id!==DOC){verify(id,disabled);disabled.binding.writerFence++;assert.throws(()=>verify(id,disabled));}
  }
});

test('document canonical content, UTF16 and cursor hashes remain bound after composition',()=>{
  const text='Synthetic 😀 text',size=text.length,contentHash='c'.repeat(64),sectionHash=hash(text),record=`${document}:${contentHash.slice(0,16)}:1:0-${size}`;
  const raw={clientId:client,documentId:document};
  const page={...scope(),data:{tool:DOC,generatedAt:T,clientId:client,document:{id:document,fileName:'Evidence.txt',contentType:'text/plain',contentHash},
    coverage:{contentScope:'extractable_text_only',extractedSectionEmpty:false,readability:null,continuationBlocked:false,nextCursor:null,truncated:false,complete:true,
      section:1,sectionCount:1,sectionCharacters:size,characterStart:0,characterEnd:size,sectionComplete:true,query:null,matched:null,extractionTruncated:false,
      extractionMetadata:null,disclosure:null,note:'Synthetic bounded text.'},records:[{recordId:record,payload:{id:record,documentId:document,title:'Evidence.txt',fileName:'Evidence.txt',
      contentType:'text/plain',source:'text',section:1,sectionKind:'document',sectionLabel:'Document text',characterStart:0,characterEnd:size,text},
      provenance:{sourceTable:'engagement_attachment',sourceRecordId:document,clientId:client,contentHash,sectionHash,section:1,characterStart:0,characterEnd:size,trust:'external_untrusted'}}]}};
  verify(DOC,page,raw);
  const cursor=value=>'document:'+Buffer.from(JSON.stringify(value)).toString('base64url');
  const good={version:1,documentId:document,clientId:client,contentHash,sectionHash,query:'',section:1,offset:0};
  verify(DOC,page,{...raw,cursor:cursor(good)});
  for(const key of ['contentHash','sectionHash'])assert.throws(()=>verify(DOC,page,{...raw,cursor:cursor({...good,[key]:'d'.repeat(64)})}));
  for(const change of [p=>p.data.records[0].payload.text='Changed text',p=>p.data.records[0].payload.characterEnd--,p=>p.data.records[0].provenance.trust='trusted']){
    const bad=clone(page);change(bad);assert.throws(()=>verify(DOC,bad,raw));
  }
});

test('state and reports preserve domain repairs via canonical output, without caller context',()=>{
  for(const id of [BILL,PERSON,CBO,GAO,CRS])assert.throws(()=>resolve(id).normalizeInput(request(id),{nowMs:0}));
  const b=output(BILL);b.total=0;b.note='No state bill on record matches that. Say so explicitly — do not describe a bill from memory.';verify(BILL,b);
  b.data[0].statusLabel='Invented';assert.throws(()=>verify(BILL,b));
  const p=output(PERSON);p.matches[0].matchedBy='-crosswalk';verify(PERSON,p,{query:'external',state:'NY'});
  p.matches[0].matchedBy='name-search';assert.throws(()=>verify(PERSON,p,{query:'external',state:'NY'}));
  const empty={tool:CBO,generatedAt:T,estimatesFound:0,estimates:[],note:'No CBO cost estimate on record for HR-7. Say so explicitly — do not estimate or guess a score.'};
  verify(CBO,empty,{billId:' HR-7 '});assert.throws(()=>verify(CBO,empty,{billId:'hr-7'}));
  const g=output(GAO);g.data[0].summary='😀'.repeat(201);assert.throws(()=>verify(GAO,g));
  const c=resolve(CRS).normalizeInput({});assert.equal(c.metadata.activeOnly,true);assert.equal(c.metadata.sourceConnected,false);
});

for(const [group,create,prefix,id] of [['public-data',createPublicDataValidators,'PublicData',ECON],
  ['state-legislation',createStateLegislationValidators,'StateLegislation',BILL]]){
  const schema=JSON.parse(readFileSync(new URL(`../retrieval-0.2/${group}.schema.json`,import.meta.url)));
  const family=create({schema,validateShape});
  test(`independent hostile operation selector refusal before coercion: ${group}`,()=>{
    let effects=0;
    const mark=()=>{effects++;return id;};
    const selector={get [Symbol.toPrimitive](){effects++;return mark;}};
    const proxy=new Proxy({}, {get(){effects++;return mark;}});
    for(const value of [selector,proxy,{toString:mark},new String(id),null,undefined,1,Symbol('id')]){
      for(const name of [`${prefix[0].toLowerCase()+prefix.slice(1)}InputDefinition`,`${prefix[0].toLowerCase()+prefix.slice(1)}OutputDefinition`])
        assert.throws(()=>family[name](value));
      assert.throws(()=>family[`normalize${prefix}Input`](value,{},{}));
      assert.throws(()=>family[`assert${prefix}Output`](value,output(id),{},{}));
      assert.throws(()=>resolveOperationContract({id:value,version:'0.2.0'}));
    }
    assert.equal(effects,0);
  });
  test(`independent hostile shape selector refusal before coercion: ${group}`,()=>{
    let effects=0;
    const key=Object.keys(schema.$defs)[0],mark=()=>{effects++;return key;};
    for(const selector of [{[Symbol.toPrimitive]:mark},{get toString(){effects++;return mark;}},
      new Proxy({}, {get(){effects++;return mark;}})])
      assert.throws(()=>family[`validate${prefix}Shape`](selector,{}));
    assert.equal(effects,0);
  });
}

test('independent real source-disabled gateway refuses all37 before any authority, budget or source effect',async()=>{
  const fixture=gatewayFixture();
  const gateway=createSourceDisabledGateway({authorityPorts:fixture.ports,budget:fixture.budget,
    limits:gatewayLimits,now:()=>GATEWAY_NOW,newId:()=>uuid('7')});
  assert.equal(gateway.sourceEnabled,false);assert.deepEqual(await gateway.discover(),[]);
  for(const {operation} of catalog.operations){
    await assert.rejects(gateway.execute(JSON.stringify({operation,arguments:{}}),'synthetic-unqualified'),/UNAVAILABLE/);
    assert.deepEqual(fixture.calls,[]);
  }
  assert.deepEqual(await gateway.discover(),[]);
});
