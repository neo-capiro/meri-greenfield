import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../validate.mjs';
import {assertCatalog,resolveOperationContract,validateShape} from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS as bindings} from '../retrieval-0.2/catalog-validation.mjs';
import {createSourceDisabledGateway} from '../../../apps/gateway/index.mjs';
import {fixture,limits,NOW,uuid} from '../../../apps/gateway/test/fixtures.mjs';
const evidence=new URL('../../../docs/qualification/candidates/read-continuation-20261012/reference-integration-review/',import.meta.url);
const baseline=JSON.parse(readFileSync(new URL('baseline.json',evidence))).catalog;
const oldBindings=JSON.parse(readFileSync(new URL('baseline-bindings.json',evidence)));
const ids=['get_committee_roster','list_members','get_pe_contractors','get_pe_bills','get_pe_report_language','get_state_rule_status','get_certification_status','search_intel_articles','list_global_datasets','get_representation'];
const [ROSTER,MEMBERS,CONTRACTORS,BILLS,REPORT,RULE,CERT,INTEL,DATASETS,FACILITY]=ids;
const T='2026-10-12T12:00:00.000Z',AFTER='2026-10-12T12:00:00.001Z',BEFORE='2026-10-12T11:59:59.999Z';
const U='ab123456-1234-4234-8234-123456789abc',V='cd123456-1234-4234-8234-123456789abc';
const copy=structuredClone;
const resolve=id=>resolveOperationContract({id,version:'0.2.0'});
const schema=group=>JSON.parse(readFileSync(new URL(`../retrieval-0.2/${group}.schema.json`,import.meta.url)));
const constant=(group,key)=>schema(group).$defs[key].const;
function scope(){return {binding:{tenantId:'review-tenant',actorId:'review-actor',conversationId:U,runId:V,attemptId:U,workerId:V,writerFence:8},subject:{kind:'client',entityType:'client',entityIds:[U],tenantId:'review-tenant',actorId:'review-actor',authorizationDecisionId:V,policyRevision:'policy-8',rosterVersionId:null,scopes:[{tenantId:'review-tenant',kind:'client',resourceId:U,policyRevision:'policy-8'}]}};}
const ctx=id=>id===RULE?{stageAsOf:T,commentAsOf:T}:id===CERT?{comparisonLocale:'en-US'}:id===FACILITY?scope():{};
const request=id=>[CONTRACTORS,BILLS,REPORT].includes(id)?{peCode:'  0600001  '}:id===CERT?{program:'fedramp',query:' example '}:{};
function output(id){
 const common={tool:id,generatedAt:T};
 switch(id){
 case ROSTER:return {...common,committee:null,chair:null,viceChair:null,rankingMember:null,members:[],note:constant('legislative-directory','DirectorySelectionNote')};
 case MEMBERS:return {...common,matchesFound:0,members:[],note:constant('legislative-directory','DirectoryMemberSelectionNote')};
 case CONTRACTORS:return {...common,data:[],todo:'federal_award table not yet created (Step 28)'};
 case BILLS:return {...common,bills:[]};
 case REPORT:return {...common,peCode:'0600001',provisions:[],note:constant('pe-references','PeNoReportNote')};
 case RULE:return {...common,found:false,note:constant('rule-status','RuleStatusMissingNote')};
 case CERT:return {tool:id,program:'fedramp',searchedEntireDataset:true,found:false,evidenceOfAbsence:true,note:constant('certification-status','CertificationStatusAbsent')??schema('certification-status').$defs.CertificationStatusAbsent.properties.note.const};
 case INTEL:return {...common,total:7,data:[]};
 case DATASETS:return {...common,datasets:[]};
 case FACILITY:return {...scope(),data:{...common,facilities:[],note:'Provide a client UUID.'}};
 }
}
const check=(id,page=output(id),req=request(id),context=ctx(id))=>resolve(id).assertOutput(page,{...context,request:req});

test('exact PR28 descriptors and callback source survive in single registry with full original inventory',()=>{
 assertCatalog(catalog);assert.equal(catalog.operations.length,56);assert.equal(bindings.length,56);
 assert.equal(new Set(bindings.map(x=>x.id)).size,56);
 assert.deepEqual(catalog.operations.filter(x=>!ids.includes(x.operation.id)),baseline.operations);
 assert.equal(catalog.originals.length,139);assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);
 assert.equal(catalog.originals.filter(x=>x.disposition==='deferred').length,43);
 assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,55);
 assert.equal(catalog.originals.filter(x=>x.disposition==='selected'&&x.replacement===null).length,41);
 for(const old of baseline.originals)assert.deepEqual(catalog.originals.find(x=>x.id===old.id),ids.includes(old.id)?{...old,state:'mapped',replacement:{id:old.id,version:'0.2.0'}}:old);
 const serialized=JSON.parse(JSON.stringify(bindings.filter(x=>!ids.includes(x.id)),(k,v)=>typeof v==='function'?{source:v.toString()}:v));assert.deepEqual(serialized,oldBindings);
 for(const id of ['query_global_data','save_memory','create_task','create_word','schedule_task','run_analysis']){
  const old=baseline.originals.find(x=>x.id===id);assert.deepEqual(catalog.originals.find(x=>x.id===id),old);assert.throws(()=>resolve(id));
 }
});

test('all catalog schema fingerprints resolve exact private bytes and keep unavailable admission',()=>{
 for(const b of bindings){const d=resolve(b.id).descriptor,raw=readFileSync(new URL(`../retrieval-0.2/${b.group}.schema.json`,import.meta.url)),s=JSON.parse(raw),hash=createHash('sha256').update(raw).digest('hex');
  for(const [field,def]of [['inputSchema',b.input],['outputSchema',b.output]])assert.deepEqual(d[field],{id:`${s.$id}#/$defs/${def}`,sha256:hash});
  assert.equal(d.handler,null);assert.equal(d.availability,'unimplemented');assert.equal(d.qualification,'pending');assert.equal(d.retry.maxRetries,0);assert.ok(Object.isFrozen(d));
 }
});

for(const id of ids){
 test(`${id}: canonical normalization and output use accepted family with immutable detached selection`,()=>{
  const req=request(id),context=ctx(id),n=resolve(id).normalizeInput(req,context);assert.equal(n.argumentsSha256,canonicalSha256(n.input));assert.deepEqual(n.request,req);
  const saved=copy(n);req.injected=true;if(context.subject)context.subject.entityIds[0]='foreign';assert.deepEqual(n,saved);
  for(const v of [n,n.input,n.metadata,n.request])assert.ok(Object.isFrozen(v));
  const page=output(id),result=check(id,page);assert.deepEqual(result,page);assert.notEqual(result,page);result.injected=true;assert.equal(page.injected,undefined);
 });
 test(`${id}: exact context keys and original request are required at both canonical boundaries`,()=>{
  const expected=id===RULE?['stageAsOf','commentAsOf']:id===CERT?['comparisonLocale']:id===FACILITY?['binding','subject']:[];
  assert.deepEqual(resolve(id).binding.contextKeys,expected);
  for(const key of ['actorId','nowMs','previousPage','sourceEnabled','authorized']){assert.throws(()=>resolve(id).normalizeInput(request(id),{...ctx(id),[key]:true}));assert.throws(()=>check(id,output(id),request(id),{...ctx(id),[key]:true}));}
  for(const key of expected){const c=ctx(id);delete c[key];assert.throws(()=>resolve(id).normalizeInput(request(id),c));assert.throws(()=>check(id,output(id),request(id),c));assert.throws(()=>resolve(id).normalizeInput({...request(id),[key]:ctx(id)[key]},ctx(id)));}
  assert.throws(()=>resolve(id).assertOutput(output(id),ctx(id)));
 });
 test(`${id}: foreign shapes and extra authority claims refuse`,()=>{
  for(const other of ids.filter(x=>x!==id))assert.throws(()=>check(id,output(other)));
  for(const key of ['actorId','tenantId','authorizationDecisionId','sourceConnected'])assert.throws(()=>resolve(id).normalizeInput({...request(id),[key]:'forged'},ctx(id)));
  assert.throws(()=>check(id,{...output(id),sourceQualified:true}));
 });
 test(`${id}: hostile inputs, context, projections and operation references remain inert`,()=>{
  let effects=0;const getter={};Object.defineProperty(getter,'value',{enumerable:true,get(){effects++;return true;}});
  const proxy=new Proxy({},{ownKeys(){effects++;return[];},getPrototypeOf(){effects++;return Object.prototype;},get(){effects++;return null;}});
  const cycle={};cycle.self=cycle;const hidden={};Object.defineProperty(hidden,'secret',{value:true});
  for(const bad of [getter,proxy,cycle,hidden,{toJSON(){effects++;return{};}},{[Symbol('x')]:1},new Date(),[,],{n:NaN}]){
   assert.throws(()=>resolve(id).normalizeInput(bad,ctx(id)));assert.throws(()=>resolve(id).normalizeInput(request(id),bad));assert.throws(()=>check(id,bad));assert.throws(()=>resolveOperationContract(bad));
  }assert.equal(effects,0);
 });
 test(`${id}: schema pin, mapping and source promotion negatives remain enforced`,()=>{
  const mutate=fn=>{const c=copy(catalog);fn(c,c.operations.find(x=>x.operation.id===id));assert.throws(()=>assertCatalog(c));};
  mutate((c,d)=>d.inputSchema.sha256='0'.repeat(64));mutate((c,d)=>d.outputSchema.id=resolve(ids.find(x=>x!==id)).descriptor.outputSchema.id);
  mutate((c,d)=>d.availability='enabled');mutate((c,d)=>d.handler={module:'unreviewed.mjs',export:'run',sourceSha256:'0'.repeat(64)});
  mutate(c=>c.originals.find(x=>x.id===id).replacement={id:ids.find(x=>x!==id),version:'0.2.0'});
 });
}

test('actual production gateway keeps all56 unavailable without any authority or budget effects',async()=>{
 const f=fixture(),options={authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('8')};
 const gateway=createSourceDisabledGateway(options);assert.equal(gateway.sourceEnabled,false);assert.deepEqual(await gateway.discover(),[]);
 for(const id of catalog.operations.map(x=>x.operation.id))await assert.rejects(gateway.execute(JSON.stringify({operation:{id,version:'0.2.0'},arguments:ids.includes(id)?request(id):{}}),'synthetic-opaque'),/UNAVAILABLE/);
 assert.deepEqual(f.calls,[]);assert.throws(()=>createSourceDisabledGateway({...options,sourceEnabled:true}));assert.deepEqual(f.calls,[]);
});

test('directory and PE normalization retain independent selectors and explicit refusals',()=>{
 assert.deepEqual(resolve(MEMBERS).normalizeInput({state:'virgin islands',limit:'2.9'}).input,{state:'Virgin Islands',limit:2});
 assert.equal(resolve(REPORT).normalizeInput({peCode:' x'.repeat(40)}).input.peCode.length,32);
 assert.throws(()=>check(REPORT,{...output(REPORT),peCode:'different'}));assert.throws(()=>check(CONTRACTORS,{...output(CONTRACTORS),todo:null}));
 assert.throws(()=>check(BILLS,{...output(BILLS),peCode:'0600001'}));
 for(const id of [ROSTER,MEMBERS,REPORT])assert.throws(()=>check(id,{...output(id),note:'Complete absence proven'}));
});

function federal(){return {tool:RULE,generatedAt:'1999-01-01T00:00:00.000Z',found:true,jurisdiction:'federal',id:'stored-rule',title:'Synthetic',abstract:null,agencyNames:[],ruleType:'PROPOSED',stage:'nprm',stageLabel:'NPRM',publicationDate:T,commentPeriod:{start:null,end:T,isOpen:true},effectiveDate:null,docketIds:[],sourceUrl:null,linkedBillKeys:[]};}
test('rule callbacks separately carry both clocks across stage and comment exact boundaries',()=>{
 const page=federal(),req={query:'rule'};check(RULE,page,req,{stageAsOf:T,commentAsOf:BEFORE});
 assert.throws(()=>check(RULE,page,req,{stageAsOf:AFTER,commentAsOf:BEFORE}));assert.throws(()=>check(RULE,page,req,{stageAsOf:T,commentAsOf:T}));
 const changed={...page,stage:'comment_closed',stageLabel:'Comment closed',commentPeriod:{...page.commentPeriod,isOpen:false}};
 check(RULE,changed,req,{stageAsOf:AFTER,commentAsOf:BEFORE});
 assert.throws(()=>check(RULE,page,req,{stageAsOf:'2026-10-12T12:00:00Z',commentAsOf:BEFORE}));
});

test('certification callback uses explicit locale without interpreting source absence as authority',()=>{
 const s=schema('certification-status');const record={productId:'FR17',cspName:'ISTANBUL',csoName:'Synthetic',status:s.$defs.CertificationStatusVocabulary.enum[0],impactLevel:s.$defs.CertificationImpactVocabulary.enum[0],authorizationDate:null,sponsoringAgencies:[],sourceUrl:s.$defs.CertificationMarketplaceUrl.const,observedAt:T,program:'fedramp'};
 const page={tool:CERT,program:'fedramp',searchedEntireDataset:true,found:true,ambiguous:false,record};
 check(CERT,page,{program:'fedramp',query:'ıstanbul'},{comparisonLocale:'tr'});
 assert.throws(()=>check(CERT,page,{program:'fedramp',query:'ıstanbul'},{comparisonLocale:'en-US'}));
 assert.throws(()=>resolve(CERT).normalizeInput(request(CERT),{comparisonLocale:'en-us'}));
});

test('stored count races, UTF16 bounds and metadata-only query limits survive real callbacks',()=>{
 const row={id:'article',source:'feed',title:'😀'.repeat(120),url:'stored locator',author:null,publishedAt:T,summary:'',categories:[],topics:[]};
 const page={tool:INTEL,generatedAt:T,total:0,data:[row]};check(INTEL,page,{source:'feed',limit:1});
 assert.throws(()=>check(INTEL,{...page,data:[{...row,title:row.title+'x'}]},{source:'feed'}));assert.throws(()=>check(INTEL,page,{source:'Feed'}));
 const field={name:'amount',type:'number',description:'Stored description',filterable:true,groupable:false,aggregatable:true};
 const data={tool:DATASETS,generatedAt:T,datasets:[{key:'future',description:'No query authority',supportsAsOf:false,fields:[field]}]};check(DATASETS,data);
 assert.throws(()=>check(DATASETS,{...data,datasets:[{...data.datasets[0],fields:[{...field,aggregatable:false}]}]}));
 assert.throws(()=>check(DATASETS,{...data,datasets:[{...data.datasets[0],table:'private_table'}]}));
 const n=resolve(DATASETS).normalizeInput({});assert.equal(n.metadata.queryAuthorized,false);assert.equal(n.metadata.rowAccessAuthorized,false);assert.equal(n.metadata.registrySnapshotQualified,false);
});

test('facility canonical callback checks every binding and exact full subject including decision ID',()=>{
 const req={clientId:U,state:' va '};const page={...scope(),data:{tool:FACILITY,generatedAt:T,facilities:[{facilityId:V,facilityName:'Synthetic',city:null,state:'VA',representation:{unresolved:true,reason:'no_geocode'}}],note:null}};check(FACILITY,page,req);
 for(const field of Object.keys(page.binding)){const p=copy(page);p.binding[field]=field==='writerFence'?9:field.endsWith('Id')&&field!=='tenantId'&&field!=='actorId'?(p.binding[field]===U?V:U):'different';assert.throws(()=>check(FACILITY,p,req),field);}
 for(const mutate of [p=>p.subject.authorizationDecisionId=U,p=>p.subject.entityIds=[V],p=>p.subject.policyRevision='new',p=>p.subject.scopes[0].resourceId=V]){const p=copy(page);mutate(p);assert.throws(()=>check(FACILITY,p,req));}
 assert.throws(()=>resolve(FACILITY).normalizeInput({clientId:V},scope()));assert.throws(()=>check(FACILITY,page,{clientId:U,state:'MD'}));
 assert.equal(resolve(FACILITY).normalizeInput({},scope()).input.clientId,null);
});

// Combined source repair: preserve the canonical SchemaRef owner and reject the
// previously accepted standalone HTTPS identifiers rather than widening admission.
test('directory and rule namespace repair preserves canonical URN-only SchemaRef admission',()=>{
 for(const group of ['legislative-directory','rule-status']){
  const s=schema(group);assert.equal(s.$id,`urn:meri:retrieval:${group}:0.2.0`);
  const def=group==='rule-status'?'RuleStatusInput':'CommitteeRosterInput';
  assert.doesNotThrow(()=>validateShape('SchemaRef',{id:`${s.$id}#/$defs/${def}`,sha256:'0'.repeat(64)}));
  assert.throws(()=>validateShape('SchemaRef',{id:`https://meri.capiro.app/private/retrieval/0.2/${group}.schema.json#/$defs/${def}`,sha256:'0'.repeat(64)}));
 }
});
