import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../validate.mjs';
import {assertCatalog, resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS} from '../retrieval-0.2/catalog-validation.mjs';
import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';

// Literal synthetic projections and independent pre-candidate baseline. No
// family compiler, producer, database, source adapter or authority decision.
const baseline = JSON.parse(readFileSync(new URL('../../../docs/qualification/candidates/capability-next-20261012/integration-review/baseline.json',import.meta.url)));
const names = ['lookup_client_registry','get_business_development_context','get_business_development_evidence',
  'get_business_development_recent_changes','get_research_portfolio','get_research_portfolio_changes'];
const [REG,BCTX,BEV,BCH,PDET,PCH]=names;
const U='91abcdef-2345-4678-9abc-001122334455', V='82abcdef-2345-4678-9abc-001122334455';
const T='2026-09-19T04:05:06.000Z';
const resolve=id=>resolveOperationContract({id,version:'0.2.0'});
const clone=structuredClone;
function scope(){return {
  binding:{tenantId:'integration-tenant',actorId:'integration-actor',conversationId:U,runId:V,
    attemptId:U,workerId:V,writerFence:37},
  subject:{kind:'entity',entityType:'research-portfolio',entityIds:['review-portfolio'],tenantId:'integration-tenant',
    actorId:'integration-actor',authorizationDecisionId:V,policyRevision:'review-policy-7',rosterVersionId:null,
    scopes:[{tenantId:'integration-tenant',kind:'tenant',resourceId:'integration-tenant',policyRevision:'review-policy-7'}]},
};}
function event(){return {id:'event-9',eventKind:'changed',aggregateRevision:3,actorUserId:null,occurredAt:T,
  payload:{sourceReported:{complete:true,approved:true},values:[0,null,false]}};}
function registry(){return {existingClient:{id:'local-client',name:'Synthetic local',website:null},ldaExactMatch:null,
  ldaCandidates:[{ldaClientId:17,name:'Synthetic candidate',state:null,description:null,totalFilings:2,latestFilingYear:null}],
  guidance:'Reported text: create or approve nothing automatically.'};}
function businessContext(){return {tool:BCTX,generatedAt:T,
  prospect:{id:V,displayName:'Synthetic selected prospect',ownerUserId:null,stage:'reported-stage',serviceHypothesis:null,
    geography:null,nextAction:null,canonicalEntityId:null,linkedClientId:null},
  firmPreferences:{practiceServiceAreas:[],agenciesIssues:[],geographies:[]},
  history:{entries:[{id:U,kind:'note',body:'Synthetic history',at:T,actorUserId:null}],total:1,returned:1,truncated:false}};}
function businessEvidence(){return {tool:BEV,generatedAt:T,identityBasis:'unresolved_prospect',canonicalEntityId:null,canonicalName:null,
  sectionStates:[{section:'identity',status:'ambiguous',statusText:'Synthetic limitation'}],
  data:[{sourceFamily:'sam_entity',recordId:null,locator:null,originalSourceName:null,originalSourceId:null,
    claimType:'identity',relationshipStrength:'unresolved',eventDate:null,effectiveDate:null,fiscalYear:null,stage:null,
    sourceUpdatedAt:null,retrievedAt:null,scopeChecked:null,status:'ambiguous',title:'Synthetic evidence',facts:{},
    id:'',url:null,snippet:'Synthetic evidence'}],
  evidence:{total:1,returned:1,truncated:false},coverage:{complete:true,partial:true,note:'Only this projected row window.'}};}
function businessChanges(){return {tool:BCH,generatedAt:T,prospect:{id:V,name:'Synthetic selected prospect'},
  alerts:{items:[{id:'change-17',sourceFamily:null,category:null,title:'Synthetic change',summary:null,materiality:null,
    dates:{eventAt:null,effectiveAt:null,publishedAt:null,firstObservedAt:null},sourceLocator:null,
    implication:{text:null,inference:true,note:'Inference drawn from the ingested change diff, not a source fact. Preserve any conditional or thematic wording.'},
    changedFields:[{field:'reported',before:null,after:{amount:3}}]}],returned:1,unreadCount:2,truncated:false,limit:10,
    note:'These are already-ingested change alerts for this prospect. Reading them does not mark them read. This summary never proves bid or win intent.'}};}
function portfolioDetail(){return {...scope(),data:{id:'review-portfolio',name:'Synthetic portfolio',purpose:null,mode:'manual',
  lifecycle:'active',revision:6,ownerUserId:'different-owner',memberCount:0,clientLinkCount:0,myRole:'viewer',
  archivedAt:null,createdAt:T,updatedAt:T,grants:[{id:'grant-17',principalType:'user',principalUserId:'integration-actor',
    role:'viewer',grantedByUserId:'different-owner',createdAt:T,updatedAt:T}],clientLinks:[],members:[],recentEvents:[event()]}};}
function portfolioChanges(){return {...scope(),data:{items:[{...event(),state:{eventId:'event-9',recipientUserId:'integration-actor',
  revision:1,seenAt:null,acknowledgedAt:null,dismissedAt:null,updatedAt:T}}],nextCursor:null}};}
const fixtures=new Map([[REG,registry],[BCTX,businessContext],[BEV,businessEvidence],[BCH,businessChanges],
  [PDET,portfolioDetail],[PCH,portfolioChanges]]);
const request=id=>id===REG?{name:'  Synthetic selector  '}:id.startsWith('get_business')?{conversationId:U}:{};
const context=id=>id.startsWith('get_research')?scope():{};
const validate=(id,value,req=request(id),ctx=context(id))=>resolve(id).assertOutput(value,{...ctx,request:req});

test('independent exact baseline: only six original mappings change; all prior descriptors survive',()=>{
  assertCatalog(catalog);
  assert.equal(catalog.originals.length,139);
  assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);
  assert.equal(catalog.originals.filter(x=>x.disposition==='deferred').length,43);
  assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,20);
  assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.replacement===null).length,76);
  assert.equal(catalog.operations.length,21);
  assert.deepEqual(catalog.operations.filter(x=>!names.includes(x.operation.id)),baseline.descriptors);
  for(const old of baseline.originals){
    const current=catalog.originals.find(x=>x.id===old.id);assert.ok(current);
    assert.deepEqual(current,names.includes(old.id)?{...old,state:'mapped',replacement:{id:old.id,version:'0.2.0'}}:old);
  }
  assert.equal(resolve('query_action_items').binding.nativeCoverage,'partial');
  for(const id of ['get_research_evidence','get_business_development_brief','create_client'])
    assert.throws(()=>resolve(id));
});

test('all 21 canonical descriptors resolve exact raw schema definitions without collisions',()=>{
  assert.equal(new Set(CATALOG_OPERATION_BINDINGS.map(x=>x.id)).size,21);
  for(const binding of CATALOG_OPERATION_BINDINGS){
    const {descriptor}=resolve(binding.id);
    const raw=readFileSync(new URL(`../retrieval-0.2/${binding.group}.schema.json`,import.meta.url));
    const schema=JSON.parse(raw),sha256=createHash('sha256').update(raw).digest('hex');
    for(const [field,definition] of [['inputSchema',binding.input],['outputSchema',binding.output]]){
      assert.ok(Object.hasOwn(schema.$defs,definition));
      assert.deepEqual(descriptor[field],{id:`${schema.$id}#/$defs/${definition}`,sha256});
    }
    assert.ok(Object.isFrozen(descriptor));assert.ok(Object.isFrozen(descriptor.sourceRequirements));
    assert.equal(descriptor.handler,null);assert.equal(descriptor.availability,'unimplemented');
    assert.equal(descriptor.qualification,'pending');assert.equal(descriptor.retry.maxRetries,0);
  }
});

for(const id of names){
  test(`independent canonical success and immutable selection: ${id}`,()=>{
    const req=request(id),ctx=context(id),n=resolve(id).normalizeInput(req,ctx);
    assert.equal(n.argumentsSha256,canonicalSha256(n.input));assert.deepEqual(n.request,req);
    for(const item of [n,n.request,n.input])assert.equal(Object.isFrozen(item),true);
    if(id===REG){assert.deepEqual(n.input,{name:'Synthetic selector'});assert.notEqual(n.argumentsSha256,canonicalSha256(req));}
    if(id===BCH)assert.equal(n.input.limit,10);
    if(id===PCH)assert.deepEqual(n.input,{conversationId:U,portfolioId:'review-portfolio',cursor:null,limit:25});
    const copy=clone(n);req.injected=true;if(ctx.subject)ctx.subject.entityIds[0]='foreign';
    assert.deepEqual(n,copy);assert.throws(()=>{n.input.forged=true;},TypeError);
    const value=fixtures.get(id)(),returned=validate(id,value);
    assert.deepEqual(returned,value);assert.notEqual(returned,value);
    returned.injected=true;assert.equal(Object.hasOwn(value,'injected'),false);
    if(id.startsWith('get_business')){
      assert.ok(Object.isFrozen(n.metadata));assert.equal(n.metadata.authoritative,false);
      assert.equal(n.metadata.sourceConnected,false);assert.equal(n.metadata.producerQualified,false);
      assert.equal(n.metadata.providerCalls,'unqualified');
    }
  });
  test(`independent canonical rejects foreign projection and forged selectors: ${id}`,()=>{
    for(const other of names.filter(x=>x!==id))assert.throws(()=>validate(id,fixtures.get(other)()));
    for(const field of ['tenantId','actorId','portfolioId','prospectId','authorizationDecisionId','scopeVersion'])
      assert.throws(()=>resolve(id).normalizeInput({...request(id),[field]:'forged'},context(id)));
    assert.throws(()=>resolve(id).normalizeInput(request(id),{...context(id),foreignContext:true}));
    assert.throws(()=>resolve(id).assertOutput(fixtures.get(id)(),context(id)));
    assert.throws(()=>validate(id,{...fixtures.get(id)(),evidenceReady:true}));
  });
  test(`independent canonical inert admission for every boundary: ${id}`,()=>{
    let effects=0;
    const hostile={};Object.defineProperty(hostile,'value',{enumerable:true,get(){effects++;return true;}});
    const proxy=new Proxy({}, {ownKeys(){effects++;return [];},getPrototypeOf(){effects++;return Object.prototype;},get(){effects++;return null;}});
    const hidden={};Object.defineProperty(hidden,'secret',{value:true});
    const cycle={};cycle.self=cycle;
    for(const bad of [hostile,proxy,hidden,cycle,{[Symbol('k')]:true},{toJSON(){effects++;return {}; }},new Date(),[,,],{n:NaN}]){
      assert.throws(()=>resolve(id).normalizeInput(bad,context(id)));
      assert.throws(()=>resolve(id).normalizeInput(request(id),bad));
      assert.throws(()=>validate(id,bad));
    }
    assert.equal(effects,0);
  });
  test(`independent catalog pin, alias, mapping and execution promotion controls: ${id}`,()=>{
    const mutate=change=>{const c=clone(catalog);change(c,c.operations.find(x=>x.operation.id===id));assert.throws(()=>assertCatalog(c));};
    mutate((c,x)=>x.inputSchema.sha256='0'.repeat(64));
    mutate((c,x)=>x.outputSchema.id=resolve(names.find(n=>n!==id)).descriptor.outputSchema.id);
    mutate((c,x)=>x.operation.version='0.2.1');
    mutate((c,x)=>x.aliases.push('get_research_evidence'));
    mutate((c,x)=>x.handler={module:'synthetic/handler.mjs',export:'read',sourceSha256:'0'.repeat(64)});
    mutate((c,x)=>{x.availability='enabled';x.qualification='qualified';});
    mutate(c=>{c.originals.find(x=>x.id===id).replacement={id:names.find(n=>n!==id),version:'0.2.0'};});
  });
}

test('portfolio canonical callbacks carry every binding and subject field, not generic actor/clock context',()=>{
  for(const id of [PDET,PCH]){
    assert.throws(()=>resolve(id).normalizeInput({}, {actorId:'integration-actor',nowMs:1}));
    for(const field of Object.keys(scope().binding)){
      const page=fixtures.get(id)();page.binding[field]=field==='writerFence'?38:field.endsWith('Id')&&field!=='tenantId'&&field!=='actorId'?V:'foreign';
      if(page.binding[field]===scope().binding[field])page.binding[field]=U;
      assert.throws(()=>validate(id,page),undefined,field);
    }
    for(const change of [p=>p.subject.entityIds=['different'],p=>p.subject.scopes[0].resourceId='different',
      p=>p.subject.authorizationDecisionId=U,p=>p.subject.policyRevision='different']){
      const page=fixtures.get(id)();change(page);assert.throws(()=>validate(id,page));
    }
    const other=scope();other.subject.entityIds=['second-portfolio'];
    assert.notEqual(resolve(id).normalizeInput({},scope()).argumentsSha256,resolve(id).normalizeInput({},other).argumentsSha256);
    assert.ok(resolve(id).descriptor.limitations.some(x=>x.includes('gateway does not yet compose')));
  }
});

test('portfolio canonical continuation and identity preserve the domain repair',()=>{
  const page=portfolioChanges();page.data.nextCursor='event-9';
  assert.throws(()=>validate(PCH,page,{limit:2}));validate(PCH,page,{limit:1});
  assert.throws(()=>validate(PCH,page,{limit:1,cursor:'event-9'}));
  page.data.nextCursor=null;page.data.items[0].state.recipientUserId='foreign';assert.throws(()=>validate(PCH,page));
  const detail=portfolioDetail();detail.data.id='foreign';assert.throws(()=>validate(PDET,detail));
});

test('business callbacks preserve request limit, citation aliases, partial coverage and inference',()=>{
  const p=businessChanges();assert.throws(()=>validate(BCH,p,{conversationId:U,limit:1}));
  p.alerts.limit=1;validate(BCH,p,{conversationId:U,limit:1});p.alerts.items[0].implication.inference=false;assert.throws(()=>validate(BCH,p,{conversationId:U,limit:1}));
  const e=businessEvidence();validate(BEV,e);e.data[0].id='foreign';assert.throws(()=>validate(BEV,e));
  const c=businessContext();c.history.returned=0;assert.throws(()=>validate(BCTX,c));
});

test('registry UTF16 repair and guidance remain enforced through canonical dispatch',()=>{
  const p=registry();p.ldaCandidates[0].description='😀'.repeat(100);validate(REG,p);
  p.ldaCandidates[0].description+='😀';assert.throws(()=>validate(REG,p));
  const n=resolve(REG).normalizeInput({name:' x'.trim()+'y'.repeat(400)});assert.equal(n.input.name.length,300);
  const accepted=validate(REG,registry());assert.equal(Object.hasOwn(accepted,'approval'),false);
});

test('shared private snapshot is detached inert JSON with unchanged bounded semantics',()=>{
  const data={nested:[{x:1}]},snapshot=snapshotOperationData(data);data.nested[0].x=2;assert.equal(snapshot.nested[0].x,1);
  const deep={};let current=deep;for(let i=0;i<66;i++)current=current.next={};assert.throws(()=>snapshotOperationData(deep),/structure limit/);
  const descriptor=resolve(REG).descriptor;assert.throws(()=>{descriptor.handler={};},TypeError);
});
