import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createSamOpportunitiesValidators,SAM_OPPORTUNITIES_OPERATION_IDS} from '../retrieval-0.2/sam-opportunities-validation.mjs';
import {createOperationContracts} from '../retrieval-0.2/operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/sam-opportunities.schema.json',import.meta.url)));
const funding=JSON.parse(readFileSync(new URL('../retrieval-0.2/funding-opportunities.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(funding);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createSamOpportunitiesValidators({schema,validateShape(name,value){const check=checks.get(name);if(!check?.(value))throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);}});
const id='search_sam_opportunities',asOf='2026-10-12T12:00:00.000Z',context={asOf,evidenceAccuracyMode:'off',sourceStatusAsOf:'2026-10-12T11:00:00.000Z',sourceHealthAsOf:'2026-10-12T10:00:00.000Z'};
const note='Results cover Capiro’s synchronized SAM.gov catalog. No matching records does not establish that no current federal opportunity exists.';
const caution='Source coverage is incomplete or unknown; inspect sourceFreshness before making current-opportunity or absence claims.';
const row=()=>({id:'11111111-1111-4111-8111-111111111111',noticeId:'synthetic-notice',solicitationNumber:null,title:'Synthetic opportunity',noticeType:'arbitrary',agency:null,office:null,pscCode:null,naicsCode:null,postedDate:null,responseDeadline:null,description:'',sourceUrl:null,active:true});
const health=()=>({source:'sam_gov',state:'current',recordCount:10,activeRecordCount:20,lastSyncedAt:'2026-10-12T00:00:00.000Z',countsUnavailable:false,neverSynced:false,lastRunStatus:'current',lastRunDegraded:false,hoursSinceLastSuccess:10});
const result=()=>({tool:id,generatedAt:asOf,total:0,results:[row()],sourceFreshness:[health()],sourceStatus:'healthy',sourceReason:null,notes:[note]});
const norm=(request={},ctx=context)=>v.normalizeSamOpportunitiesInput(id,request,ctx);
const check=(page=result(),request={},ctx=context)=>v.assertSamOpportunitiesOutput(id,page,request,ctx);
function reason(page,why,status){page.sourceReason=why;page.sourceStatus=status;page.notes=why?[note,caution]:[note];return page;}
function state(page,value){const h=page.sourceFreshness[0];h.state=value;h.lastRunStatus=value;h.neverSynced=value==='never_synced';h.lastRunDegraded=value!=='current';return page;}
function deadline(at,daysRemaining,status){return{at,dateOnly:at===null?null:at.slice(0,10),timeZone:null,basis:at===null?'unknown':'explicit_datetime',daysRemaining,status};}

test('independent SAM: exact single operation and definition selectors',()=>{
 assert.deepEqual(SAM_OPPORTUNITIES_OPERATION_IDS,[id]);assert.equal(v.samOpportunitiesSchemaId,'urn:meri:retrieval:sam-opportunities:0.2.0');assert.equal(v.samOpportunitiesInputDefinition(id),'SamOpportunitiesInput');assert.equal(v.samOpportunitiesOutputDefinition(id),'SamOpportunitiesOutput');
 for(const wrong of ['__proto__','constructor','search_funding_opportunities'])assert.throws(()=>v.samOpportunitiesInputDefinition(wrong));
});
test('independent SAM: explicit null/default effective input and detached immutable metadata',()=>{
 const request={query:'  Synthetic  ',naics:' 541  ',includeInactive:null,limit:'2.9'},saved=structuredClone(request),n=norm(request);
 assert.deepEqual(n.input,{query:'Synthetic',naics:'541',includeInactive:false,limit:2});assert.deepEqual(request,saved);assert.ok(Object.isFrozen(n));assert.ok(Object.isFrozen(n.input));assert.ok(Object.isFrozen(n.metadata));
 for(const key of ['sourceConnected','producerQualified','absenceEvidence'])assert.equal(n.metadata[key],false);
 assert.deepEqual(norm().input,{query:null,naics:null,includeInactive:false,limit:20});
});
test('independent SAM: clamp scalar limits and reject effects/nonfinite inputs',()=>{
 for(const [limit,value] of [[-1,1],[0,1],[99,50],[1.9,1],['12.9',12],['bad',20],[null,20],['',1]])assert.equal(norm({limit}).input.limit,value);
 for(const limit of [true,{},[],NaN,Infinity,undefined])assert.throws(()=>norm({limit}));
 for(const key of ['query','naics'])for(const value of [1,true,{},[]])assert.throws(()=>norm({[key]:value}));
 for(const includeInactive of ['false',1,{},[]])assert.throws(()=>norm({includeInactive}));
});
test('independent SAM: effective selector second trim after UTF16 cap',()=>{
 assert.equal(norm({query:'q'.repeat(239)+' x'}).input.query,'q'.repeat(239));assert.equal(norm({naics:'1'.repeat(11)+' x'}).input.naics,'1'.repeat(11));
 assert.equal(norm({query:'q'.repeat(239)+'😀'}).input.query,'q'.repeat(239)+'\ud83d');assert.equal(norm({query:'  ',naics:null}).input.query,null);
});
test('independent SAM: all four trusted fields required; no model authority or context extras',()=>{
 for(const key of Object.keys(context)){const missing={...context};delete missing[key];assert.throws(()=>norm({},missing));assert.throws(()=>norm({[key]:context[key]}));}
 for(const value of ['2026-10-12T12:00:00Z','bad',null])for(const key of ['asOf','sourceStatusAsOf','sourceHealthAsOf'])assert.throws(()=>norm({},{...context,[key]:value}));
 assert.throws(()=>norm({},{...context,actorId:'forged'}));assert.throws(()=>norm({},{...context,evidenceAccuracyMode:'enforced'}));
});
test('independent SAM: exact14 fields, generic raw stored values and nullable timestamp domains',()=>{
 const p=result();p.results[0].title='';p.results[0].noticeId='';p.results[0].noticeType='';p.results[0].sourceUrl='not a URL';p.results[0].agency='';check(p);
 for(const key of ['pocName','pocEmail','raw','baseType','archiveDate','lastSyncedAt','placeOfPerformance']){const p=result();p.results[0][key]=null;assert.throws(()=>check(p));}
 for(const key of Object.keys(row())){const p=result();delete p.results[0][key];assert.throws(()=>check(p));}
});
test('independent SAM: count race and hidden description matches are allowed',()=>{
 const p=result();p.total=0;p.results[0].description='Unrelated excerpt';check(p,{query:'only hidden later text'});
 p.total=9007199254740991;check(p);p.results=[];p.total=100;check(p);assert.deepEqual(p.notes,[note]);
});
test('independent SAM: stored primary ID and notice IDs unique separately',()=>{
 const p=result();p.results.push({...row(),noticeId:'other'});assert.throws(()=>check(p));
 p.results[1].id='22222222-2222-4222-8222-222222222222';p.results[1].noticeId=p.results[0].noticeId;assert.throws(()=>check(p));
});
test('independent SAM: active default differs from deadline-open; true allows inactive',()=>{
 const p=result();p.results[0].responseDeadline='2000-01-01T00:00:00.000Z';check(p);p.results[0].active=false;assert.throws(()=>check(p));check(p,{includeInactive:true});
});
test('independent SAM: NAICS prefix with null/short/different refusal',()=>{
 const p=result();p.results[0].naicsCode='541330';check(p,{naics:' 541 '});for(const code of [null,'54','0541330','x541']){p.results[0].naicsCode=code;assert.throws(()=>check(p,{naics:'541'}));}
});
test('independent SAM: nonnull posted descending without invented null placement',()=>{
 const p=result();p.results=[row(),{...row(),id:'22222222-2222-4222-8222-222222222222',noticeId:'b',postedDate:asOf},{...row(),id:'33333333-3333-4333-8333-333333333333',noticeId:'c',postedDate:null}];check(p);
 p.results[0].postedDate='2026-10-11T12:00:00.000Z';assert.throws(()=>check(p));
});
test('independent SAM: raw varchar codepoint bounds differ from description UTF16 cap',()=>{
 const p=result();p.results[0].noticeType='😀'.repeat(32);p.results[0].pscCode='😀'.repeat(8);p.results[0].naicsCode='😀'.repeat(8);check(p);
 for(const [key,value] of [['noticeType','x'.repeat(33)],['pscCode','x'.repeat(9)],['naicsCode','x'.repeat(9)]]){const q=result();q.results[0][key]=value;assert.throws(()=>check(q));}
 const q=result();for(const description of ['', 'x'.repeat(299)+'\ud83d','x'.repeat(297)+'...']){q.results[0].description=description;check(q);}
 for(const description of [null,'x'.repeat(301),' double','two  spaces','line\nbreak']){q.results[0].description=description;assert.throws(()=>check(q));}
});
test('independent SAM: returned window limit and exact finite stored counts',()=>{
 const p=result();p.results.push({...row(),id:'22222222-2222-4222-8222-222222222222',noticeId:'other'});assert.throws(()=>check(p,{limit:1}));check(p,{limit:2});
 for(const total of [-1,1.1,null,Number.MAX_SAFE_INTEGER+1]){const p=result();p.total=total;assert.throws(()=>check(p));}
});
test('independent SAM: defensive missing SAM health is unavailable, not absence',()=>{
 const p=result();p.sourceFreshness=[];reason(p,'source_freshness_unavailable','unknown');check(p);p.sourceReason=null;assert.throws(()=>check(p));
});
test('independent SAM: missing count takes precedence over all other flags and stale times',()=>{
 const p=state(result(),'never_synced'),h=p.sourceFreshness[0];h.recordCount=null;h.countsUnavailable=true;h.lastSyncedAt=null;h.hoursSinceLastSuccess=null;reason(p,'source_freshness_unavailable','unknown');check(p);
 reason(p,'all_federal_source_never_synced','degraded');assert.throws(()=>check(p));
});
test('independent SAM: null synced timestamp is never-synced reason independent of state flag',()=>{
 const p=result(),h=p.sourceFreshness[0];h.lastSyncedAt=null;h.hoursSinceLastSuccess=null;reason(p,'all_federal_source_never_synced','degraded');check(p);assert.equal(h.neverSynced,false);
 h.neverSynced=true;assert.throws(()=>check(p));
});
test('independent SAM: empty and invalid timestamp yield unknown and JSON-null age',()=>{
 for(const lastSyncedAt of ['', 'invalid-source-date']){const p=state(result(),'error_cached');Object.assign(p.sourceFreshness[0],{lastSyncedAt,hoursSinceLastSuccess:null});reason(p,'source_freshness_unknown','unknown');check(p);p.sourceFreshness[0].hoursSinceLastSuccess=0;assert.throws(()=>check(p));}
});
for(const value of ['degraded','stale','never_synced','initial_partial','error_cached','unavailable','not_enabled','unknown'])test(`independent SAM: ${value} precedes age while keeping separate health flags`,()=>{
 const p=state(result(),value);reason(p,'latest_source_sync_incomplete','degraded');check(p);p.sourceFreshness[0].lastRunStatus='current';assert.throws(()=>check(p));
});
test('independent SAM: 48h exact status boundary uses only sourceStatusAsOf',()=>{
 const p=result();p.sourceFreshness[0].lastSyncedAt='2026-10-10T11:00:00.000Z';p.sourceFreshness[0].hoursSinceLastSuccess=47;reason(p,'source_sync_stale','degraded');check(p);
 reason(p,null,'healthy');check(p,{}, {...context,sourceStatusAsOf:'2026-10-12T10:59:59.999Z'});assert.throws(()=>check(p));
});
test('independent SAM: future sync age clamps zero and current state remains healthy',()=>{
 const p=result();p.sourceFreshness[0].lastSyncedAt='2026-10-13T00:00:00.000Z';p.sourceFreshness[0].hoursSinceLastSuccess=0;check(p);p.sourceFreshness[0].hoursSinceLastSuccess=-1;assert.throws(()=>check(p));
});
test('independent SAM: independent clocks can reverse without order or generatedAt-age inference',()=>{
 const ctx={...context,asOf:'2026-10-01T00:00:00.000Z',sourceStatusAsOf:'2026-10-12T11:00:00.000Z',sourceHealthAsOf:'2026-10-14T00:00:00.000Z'},p=result();p.generatedAt=ctx.asOf;p.sourceFreshness[0].hoursSinceLastSuccess=48;check(p,{},ctx);
 p.sourceFreshness[0].hoursSinceLastSuccess=11;assert.throws(()=>check(p,{},ctx));
});
test('independent SAM: all metadata correlations and exact notes resist substitution',()=>{
 for(const mutate of [p=>p.generatedAt=context.sourceStatusAsOf,p=>p.sourceStatus='degraded',p=>p.sourceReason='invented',p=>p.notes=[],p=>p.notes.push(caution),p=>p.sourceFreshness[0].countsUnavailable=true,p=>p.sourceFreshness[0].neverSynced=true,p=>p.sourceFreshness[0].lastRunDegraded=true,p=>p.sourceFreshness[0].hoursSinceLastSuccess=11,p=>p.sourceFreshness[0].source='grants_gov']){const p=result();mutate(p);assert.throws(()=>check(p));}
});
test('independent SAM: optional raw health observation members retain independent values',()=>{
 const p=result();p.sourceFreshness[0].latestAttemptAt='unparsed-attempt';p.sourceFreshness[0].lastSuccessAt=null;check(p);delete p.sourceFreshness[0].latestAttemptAt;delete p.sourceFreshness[0].lastSuccessAt;check(p);
});
test('independent SAM: enforce unknown deadline versus off/shadow omitted projection',()=>{
 for(const mode of ['off','shadow']){const ctx={...context,evidenceAccuracyMode:mode};check(result(),{},ctx);const p=result();p.results[0].deadline=deadline(null,null,'unknown');assert.throws(()=>check(p,{},ctx));}
 const ctx={...context,evidenceAccuracyMode:'enforce'},p=result();assert.throws(()=>check(p,{},ctx));p.results[0].deadline=deadline(null,null,'unknown');check(p,{},ctx);
});
test('independent SAM: exact deadline equality and one-ms edge use final asOf',()=>{
 const ctx={...context,evidenceAccuracyMode:'enforce'};
 for(const [at,days,status] of [[asOf,0,'open'],['2026-10-12T11:59:59.999Z',0,'closed'],['2026-10-12T12:00:00.001Z',1,'open'],['2026-10-11T12:00:00.000Z',-1,'closed']]){const p=result();p.results[0].responseDeadline=at;p.results[0].deadline=deadline(at,days,status);check(p,{},ctx);p.results[0].deadline.status=status==='open'?'closed':'open';assert.throws(()=>check(p,{},ctx));}
});
test('independent SAM: deadline source lineage timezone and basis cannot drift',()=>{
 const ctx={...context,evidenceAccuracyMode:'enforce'};
 for(const mutate of [d=>d.at='2026-10-13T12:00:00.000Z',d=>d.dateOnly='2026-10-11',d=>d.timeZone='America/New_York',d=>d.basis='date_only_end_of_day',d=>d.daysRemaining=2,d=>d.rawText='unknown']){const p=result();p.results[0].responseDeadline=asOf;p.results[0].deadline=deadline(asOf,0,'open');mutate(p.results[0].deadline);assert.throws(()=>check(p,{},ctx));}
});
test('independent SAM: hostile IDs definitions and JSON hooks fail without execution',()=>{
 let effects=0;const hostile={[Symbol.toPrimitive](){effects++;return id;}};
 for(const bad of [hostile,{},[],null,Symbol('bad')]){assert.throws(()=>v.samOpportunitiesInputDefinition(bad));assert.throws(()=>v.samOpportunitiesOutputDefinition(bad));assert.throws(()=>v.validateSamOpportunitiesShape(bad,{}));assert.throws(()=>v.normalizeSamOpportunitiesInput(bad,{},context));}
 const getter={get query(){effects++;return'q';}},proxy=new Proxy({},{ownKeys(){effects++;return[];}}),cycle={};cycle.self=cycle;
 for(const bad of [getter,proxy,cycle,new Date(),{toJSON(){effects++;return{};}}])assert.throws(()=>norm(bad));
 const p=result();Object.defineProperty(p.sourceFreshness[0],'state',{enumerable:true,get(){effects++;return'current';}});assert.throws(()=>check(p));assert.equal(effects,0);
});
test('independent SAM: no ambient clock during normalization or relations',()=>{
 const old=Date.now;Date.now=()=>{throw new Error('ambient clock read');};try{norm();check();}finally{Date.now=old;}
});
test('independent SAM: canonical resolver binds context and immutable argument digest without activation',()=>{
 const binding={id,version:'0.2.0',contextKeys:Object.keys(context),normalize:(_,request,ctx)=>norm(request,ctx),outputAssert:(_,page,request,ctx)=>{const {request:_request,...policy}=ctx;return check(page,request,policy);}};
 const catalog={operations:[{operation:{id,version:'0.2.0'},handler:null,status:'unavailable'}]},resolver=createOperationContracts({catalog,bindings:[binding],validators:v,assertCatalog(){},canonicalSha256});
 const contract=resolver.resolveOperationContract({id,version:'0.2.0'}),request={query:' Synthetic '},n=contract.normalizeInput(request,context);assert.equal(n.argumentsSha256,canonicalSha256(n.input));assert.ok(Object.isFrozen(n.request));assert.ok(Object.isFrozen(n.input));contract.assertOutput(result(),{request:n.request,...context});assert.throws(()=>contract.assertOutput(result(),context));assert.equal(contract.descriptor.handler,null);
});

test('independent SAM: finite raw health date spellings are parsed, not rewritten as trusted instants',()=>{
 for(const lastSyncedAt of ['2026-10-12','2026-10-12T02:00:00+02:00']){const p=result();p.sourceFreshness[0].lastSyncedAt=lastSyncedAt;check(p);assert.equal(p.sourceFreshness[0].lastSyncedAt,lastSyncedAt);}
});
